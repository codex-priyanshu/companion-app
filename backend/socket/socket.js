const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
let contentFilter;
try { contentFilter = require('../middleware/contentFilter'); } catch(e) { console.error('ContentFilter load failed:', e.message); }
const { sendPushNotification } = require('../routes/pushRoutes');

const onlineUsers = new Map();
// Socket rate-limiting map: socket.id -> { count, lastReset }
const socketRateLimits = new Map();

const isSocketRateLimited = (socketId, maxPerWindow = 10, windowMs = 3000) => {
    const now = Date.now();
    if (!socketRateLimits.has(socketId)) {
        socketRateLimits.set(socketId, { count: 1, lastReset: now });
        return false;
    }
    const record = socketRateLimits.get(socketId);
    if (now - record.lastReset > windowMs) {
        record.count = 1;
        record.lastReset = now;
        return false;
    }
    record.count += 1;
    return record.count > maxPerWindow;
};

// Periodic cleanup for stale rate limiter entries (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [sId, record] of socketRateLimits.entries()) {
        if (now - record.lastReset > 60000) {
            socketRateLimits.delete(sId);
        }
    }
}, 5 * 60 * 1000).unref();

let onlineUsersBroadcastTimer = null;

const debouncedBroadcastOnlineUsers = (io, delay = 2500) => {
    if (onlineUsersBroadcastTimer) return;
    onlineUsersBroadcastTimer = setTimeout(async () => {
        onlineUsersBroadcastTimer = null;
        await broadcastOnlineUsers(io);
    }, delay);
};

const broadcastOnlineUsers = async (io) => {
    try {
        const userIds = Array.from(onlineUsers.keys()).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (userIds.length === 0) {
            io.emit("update_online_users", []);
            return;
        }
        // Scale safety: Cap to 2,000 IDs to avoid Postgres parameter limits (max 65,535) & network flood
        const safeUserIds = userIds.slice(0, 2000);
        const placeholders = safeUserIds.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(
            `SELECT id FROM users WHERE id IN (${placeholders}) AND show_online = true`,
            safeUserIds
        );
        const visibleOnlineUsers = result.rows.map(row => row.id.toString());
        io.emit("update_online_users", visibleOnlineUsers);
    } catch (err) {
        console.error("Broadcast online users error:", err.message || err);
        io.emit("update_online_users", Array.from(onlineUsers.keys()).slice(0, 500));
    }
};

module.exports = (io) => {
    // 🛡️ Socket.IO JWT Authentication Handshake Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (token) {
            jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
                if (!err && user && user.id) {
                    socket.user = user;
                } else {
                    socket.user = null;
                }
                next();
            });
        } else {
            socket.user = null;
            next();
        }
    });

    io.on("connection", (socket) => {
        socket.on("user_connected", async (userId) => {
            // If socket is authenticated, ensure user can only bind their own user ID
            if (socket.user && parseInt(socket.user.id) !== parseInt(userId)) {
                return;
            }
            onlineUsers.set(userId.toString(), socket.id);
            debouncedBroadcastOnlineUsers(io);
        });

        socket.on("join_own_room", (userId) => {
            // Prevent joining another user's personal room without matching auth
            if (socket.user && parseInt(socket.user.id) !== parseInt(userId)) {
                return;
            }
            if (userId) {
                socket.join(`user_${userId}`);
                socket.join(userId.toString());
            }
        });

        socket.on("join_room", (room) => {
            if (room) {
                socket.join(room);
                if (room.startsWith("chat_")) {
                    socket.join(room.replace("chat_", ""));
                } else {
                    socket.join(`chat_${room}`);
                }
            }
        });

        socket.on("send_message", async (data) => {
            try {
                // 🛡️ Rate limit check
                if (isSocketRateLimited(socket.id, 8, 3000)) {
                    socket.emit("rate_limited", { error: "Slow down! You are sending messages too quickly." });
                    return;
                }

                // 🛡️ Enforce sender authenticity: authenticated user cannot spoof someone else's ID
                const verifiedSenderId = socket.user ? socket.user.id : data.sender_id;
                if (!verifiedSenderId) {
                    socket.emit("error", { message: "Authentication required to send messages." });
                    return;
                }

                let messageText = data.text || data.message || "";

                // Profanity check (non-blocking)
                try {
                    if (contentFilter) {
                        const profanityResult = contentFilter.checkProfanity(messageText);
                        if (profanityResult.severity === 'high') {
                            socket.emit("message_blocked", {
                                error: "⚠️ Message blocked — please use respectful language.",
                                room: data.room
                            });
                            return;
                        }
                        if (!profanityResult.isClean) {
                            messageText = contentFilter.cleanText(messageText);
                        }
                    }
                } catch (modErr) { console.error('Chat moderation error:', modErr.message); }

                const result = await pool.query(
                    "INSERT INTO messages (sender_id, receiver_id, text, image_url, audio_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, is_read, reaction",
                    [verifiedSenderId, data.receiver_id, messageText, data.image_url || null, data.audio_url || null]
                );
                const savedMessage = result.rows[0];
                data.id = savedMessage.id;
                data.sender_id = verifiedSenderId;
                data.text = messageText;
                data.message = messageText;
                data.created_at = savedMessage.created_at;
                data.is_read = savedMessage.is_read;
                data.reaction = savedMessage.reaction || null;

                // Lookup sender profile details
                const senderDetails = await pool.query(
                    "SELECT name, profile_pic FROM users WHERE id = $1",
                    [verifiedSenderId]
                );
                if (senderDetails.rows.length > 0) {
                    data.sender_name = senderDetails.rows[0].name;
                    data.sender_pic = senderDetails.rows[0].profile_pic;
                }

                io.to(data.room).emit("receive_message", data);
                if (data.receiver_id) {
                    io.to(`user_${data.receiver_id}`).emit("receive_message", data);
                    io.to(data.receiver_id.toString()).emit("receive_message", data);
                    // Trigger Web Push Notification
                    sendPushNotification(data.receiver_id, {
                        title: `💬 ${data.sender_name || 'Companion'}`,
                        body: data.image_url ? '📷 Shared a photo' : (data.audio_url ? '🎤 Sent a voice note' : messageText),
                        icon: data.sender_pic || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                        url: '/#chat',
                        tag: `chat_${verifiedSenderId}`
                    });
                }
            } catch (err) { console.error("send_message error:", err); }
        });

        socket.on("mark_messages_read", async (data) => {
            try {
                const readerId = socket.user ? socket.user.id : data.receiver_id;
                await pool.query("UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false", [data.sender_id, readerId]);
                io.to(data.room).emit("messages_read_update", data);
            } catch (error) { }
        });

        socket.on("initiate_call", (data) => {
            const callerUserId = socket.user ? socket.user.id : data.caller_user_id;
            
            if (data.room) {
                socket.join(data.room);
                if (data.room.startsWith("chat_")) {
                    socket.join(data.room.replace("chat_", ""));
                } else {
                    socket.join(`chat_${data.room}`);
                }
            }

            const payload = {
                type: data.type,
                caller_id: socket.id,
                caller_name: data.caller_name || 'Partner',
                caller_pic: data.caller_pic || '',
                room: data.room,
                caller_user_id: callerUserId
            };

            if (data.receiver_id) {
                io.to([`user_${data.receiver_id}`, data.receiver_id.toString()]).emit("incoming_call", payload);
                // Trigger Web Push Notification for incoming call
                sendPushNotification(data.receiver_id, {
                    title: `📞 Incoming ${data.type === 'video' ? 'Video' : 'Voice'} Call`,
                    body: `${data.caller_name || 'Someone'} is calling you...`,
                    icon: data.caller_pic || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                    url: '/#chat',
                    tag: `call_${callerUserId}`
                });
            } else if (data.room) {
                socket.to(data.room).emit("incoming_call", payload);
            }

            const isReceiverOnline = data.receiver_id && onlineUsers.has(data.receiver_id.toString());
            socket.emit("call_status_update", {
                isOnline: isReceiverOnline,
                statusText: isReceiverOnline ? "Ringing..." : "Calling..."
            });
        });

        socket.on("accept_call", (data) => {
            if (data.room) {
                socket.join(data.room);
                socket.to(data.room).emit("call_accepted", data);
            }
            if (data.to) {
                io.to([`user_${data.to}`, data.to.toString()]).emit("call_accepted", data);
            }
        });

        socket.on("reject_call", (data) => {
            if (data.room) {
                socket.to(data.room).emit("call_rejected", data);
            }
            if (data.to) {
                io.to([`user_${data.to}`, data.to.toString()]).emit("call_rejected", data);
            }
        });

        socket.on("end_call", (data) => {
            if (data.room) {
                socket.to(data.room).emit("call_ended", data);
            }
            if (data.to) {
                io.to([`user_${data.to}`, data.to.toString()]).emit("call_ended", data);
            }
        });

        socket.on("edit_message", async (data) => {
            try {
                const verifiedSender = socket.user ? socket.user.id : data.sender_id;
                await pool.query("UPDATE messages SET text = $1 WHERE id = $2 AND sender_id = $3", [data.newText, data.messageId, verifiedSender]);
                io.to(data.room).emit("message_edited", { messageId: data.messageId, newText: data.newText });
            } catch (error) { }
        });

        socket.on("webrtc_offer", (data) => {
            const offerPayload = data.offer || data;
            if (data.to) {
                io.to([`user_${data.to}`, data.to.toString()]).emit("webrtc_offer", offerPayload);
            } else if (data.room) {
                socket.to(data.room).emit("webrtc_offer", offerPayload);
            }
        });

        socket.on("webrtc_answer", (data) => {
            const answerPayload = data.answer || data;
            if (data.to) {
                io.to([`user_${data.to}`, data.to.toString()]).emit("webrtc_answer", answerPayload);
            } else if (data.room) {
                socket.to(data.room).emit("webrtc_answer", answerPayload);
            }
        });

        socket.on("webrtc_ice_candidate", (data) => {
            // Keep full candidate object ({ candidate, sdpMid, sdpMLineIndex }) intact
            const candidatePayload = (data && data.candidate && typeof data.candidate === 'object') ? data.candidate : data;
            if (data.to) {
                io.to([`user_${data.to}`, data.to.toString()]).emit("webrtc_ice_candidate", candidatePayload);
            } else if (data.room) {
                socket.to(data.room).emit("webrtc_ice_candidate", candidatePayload);
            }
        });

        socket.on("delete_message", async (data) => {
            try {
                const verifiedSender = socket.user ? socket.user.id : data.sender_id;
                await pool.query("DELETE FROM messages WHERE id = $1 AND sender_id = $2", [data.messageId, verifiedSender]);
                io.to(data.room).emit("message_deleted", data.messageId);
            } catch (error) { }
        });

        socket.on("delete_for_me", async (data) => {
            try {
                const userId = socket.user ? socket.user.id : data.userId;
                await pool.query("UPDATE messages SET deleted_for = array_append(deleted_for, $1) WHERE id = $2", [userId, data.messageId]);
            } catch (error) { }
        });

        socket.on("send_booking_notification", (data) => {
            io.to(`user_${data.receiver_id}`).emit("receive_booking_notification", data);
            io.to(data.receiver_id.toString()).emit("receive_booking_notification", data);
        });

        socket.on("send_activity_notification", (data) => {
            if (data?.receiver_id) {
                io.to(`user_${data.receiver_id}`).emit("receive_activity_notification", data);
                io.to(data.receiver_id.toString()).emit("receive_activity_notification", data);
            }
        });

        socket.on("active_status_changed", async () => {
            await broadcastOnlineUsers(io);
        });

        // ── SOS Emergency Alert — Broadcast to all admins ──
        socket.on("sos_alert", async (data) => {
            try {
                const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
                admins.rows.forEach(admin => {
                    io.to(`user_${admin.id}`).emit("sos_notification", {
                        ...data,
                        type: "sos",
                        message: `🚨 SOS Alert from ${data.userName}!`
                    });
                });
                console.log(`🚨 SOS Alert broadcast to ${admins.rows.length} admins`);
            } catch (err) {
                console.error("SOS socket error:", err);
            }
        });

        socket.on("typing", (data) => {
            socket.to(data.room).emit("partner_typing", data);
        });

        socket.on("stop_typing", (data) => {
            socket.to(data.room).emit("partner_stop_typing", data);
        });

        socket.on("react_message", async (data) => {
            try {
                const { messageId, reaction, room } = data;
                await pool.query("UPDATE messages SET reaction = $1 WHERE id = $2", [reaction || null, messageId]);
                io.to(room).emit("message_reaction_updated", { messageId, reaction: reaction || null });
            } catch (err) {
                console.error("react_message socket error:", err);
            }
        });

        socket.on("disconnect", async () => {
            socketRateLimits.delete(socket.id);
            let disconnectedUserId = null;
            for (let [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    disconnectedUserId = userId;
                    onlineUsers.delete(userId);
                    break;
                }
            }
            if (disconnectedUserId) {
                debouncedBroadcastOnlineUsers(io);
            }
        });
    });
};
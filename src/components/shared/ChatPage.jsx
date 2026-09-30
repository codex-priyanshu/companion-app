import React, { useState, useRef, useEffect, useCallback } from "react";
import { PAGES } from "../../App";
import { io } from "socket.io-client";
import { FiArrowLeft, FiPhone, FiVideo, FiPaperclip, FiSend, FiMic, FiEdit2, FiTrash2, FiLock, FiUnlock, FiEye, FiEyeOff, FiX, FiCheck, FiMoreVertical, FiPhoneCall, FiPhoneOff, FiPhoneMissed, FiVideoOff, FiMicOff, FiSlash, FiFlag, FiUser, FiAlertTriangle, FiCheckCircle, FiStar, FiInfo, FiFolder, FiRefreshCw, FiClock, FiKey, FiSmile } from "react-icons/fi";
import { isChatLocked, lockChat, unlockChat, isChatHidden, hideChat, unhideChat, hasChatLockPin } from "../../utils/chatLockManager";
import ChatLockPinModal from "./ChatLockPinModal";
import VoiceNotePlayer from "./VoiceNotePlayer";
import { getStoredPreferences } from "../../utils/themePreferences";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "🔥"];

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

const socket = io(API_BASE, {
    autoConnect: false,
    transports: ['websocket'],
    auth: (cb) => {
        cb({ token: localStorage.getItem('token') });
    }
});

function ChatPage({ girl, currentUser, setPage, setSelectedGirl }) {
    const userPrefs = getStoredPreferences();
    const wallpaperBackgrounds = {
        dark: '#0D0D1A',
        midnight: 'linear-gradient(to bottom, #0B0F19, #111827)',
        emerald: 'linear-gradient(to bottom, #061A14, #0A2E23)',
        sunset: 'linear-gradient(to bottom, #1A0B1E, #2E1029)',
        amoled: '#000000'
    };
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);
    const bottomRef = useRef(null);
    const incomingCallOfferRef = useRef(null);
    const iceCandidatesQueue = useRef([]);

    const [onlineUsers, setOnlineUsers] = useState([]);
    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const lastEmitTypingRef = useRef(false);
    const [editingMsgId, setEditingMsgId] = useState(null);
    const [hoveredMsgId, setHoveredMsgId] = useState(null);
    const [messageToDelete, setMessageToDelete] = useState(null);
    const [lightboxImg, setLightboxImg] = useState(null); // fullscreen image viewer
    const [activeReactionPickerId, setActiveReactionPickerId] = useState(null);
    const longPressTimerRef = useRef(null);
    
    const [showMenu, setShowMenu] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportDesc, setReportDesc] = useState("");
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportDone, setReportDone] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    const menuRef = useRef(null);

    // WhatsApp style states
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [showEncryptionModal, setShowEncryptionModal] = useState(false);
    const [showStarredSubView, setShowStarredSubView] = useState(false);
    const [isMuted, setIsMutedNotifications] = useState(() => {
        return localStorage.getItem(`mute_${currentUser?.id}_${girl?.id}`) === "true";
    });
    const [starredMessages, setStarredMessages] = useState(() => {
        const saved = localStorage.getItem(`stars_${currentUser?.id}_${girl?.id}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [disappearingDuration, setDisappearingDuration] = useState("off"); // 'off' / '24h' / '7d' / '90d'

    // WhatsApp Chat Lock & Hide States
    const [isThisChatLocked, setIsThisChatLocked] = useState(() => isChatLocked(currentUser?.id, girl?.id));
    const [isThisChatHidden, setIsThisChatHidden] = useState(() => isChatHidden(currentUser?.id, girl?.id));
    const [isChatPinVerified, setIsChatPinVerified] = useState(() => !isChatLocked(currentUser?.id, girl?.id) && !isChatHidden(currentUser?.id, girl?.id));
    const [showChatLockModal, setShowChatLockModal] = useState(false);
    const [chatLockModalMode, setChatLockModalMode] = useState("verify");

    // Audio recording states & refs
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 0) {
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        sendAudioMessage(reader.result);
                    };
                }
            };

            recorder.start();
            setIsRecordingAudio(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Microphone access error:", err);
            alert("Could not access microphone. Please allow microphone permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecordingAudio) {
            mediaRecorderRef.current.stop();
            setIsRecordingAudio(false);
            clearInterval(recordingTimerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecordingAudio) {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
            setIsRecordingAudio(false);
            clearInterval(recordingTimerRef.current);
        }
    };

    const sendAudioMessage = (base64Audio) => {
        if (!currentUser || !girl) return;
        const room = roomId;

        const msgData = {
            sender_id: currentUser.id,
            receiver_id: girl.id,
            room: room,
            text: "🎤 Voice Note",
            audio_url: base64Audio
        };

        socket.emit("send_message", msgData);
        setMessages(prev => [...prev, {
            ...msgData,
            id: Date.now(),
            sent: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            is_read: false
        }]);
    };

    // Fetch block status
    useEffect(() => {
        if (!currentUser || !girl || currentUser.id === girl.id) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        fetch(`${API}/block-status/${girl.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setIsBlocked(data.isBlocked); })
        .catch(() => {});
    }, [girl, currentUser]);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Sync Starred Messages to LocalStorage
    const toggleStarMessage = (msgId) => {
        setStarredMessages(prev => {
            const updated = prev.includes(msgId)
                ? prev.filter(id => id !== msgId)
                : [...prev, msgId];
            localStorage.setItem(`stars_${currentUser?.id}_${girl?.id}`, JSON.stringify(updated));
            return updated;
        });
    };

    // Toggle emoji reaction on message
    const handleToggleReaction = (msgId, emoji) => {
        const targetMsg = messages.find(m => String(m.id) === String(msgId));
        const newReaction = targetMsg?.reaction === emoji ? null : emoji;

        setMessages(prev => prev.map(m => String(m.id) === String(msgId) ? { ...m, reaction: newReaction } : m));
        setActiveReactionPickerId(null);

        socket.emit("react_message", { messageId: msgId, reaction: newReaction, room: roomId });

        const token = localStorage.getItem('token');
        if (token) {
            fetch(`${API}/messages/${msgId}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reaction: newReaction })
            }).catch(() => {});
        }
    };

    // Toggle Disappearing Settings
    const handleDisappearingToggle = (duration) => {
        setDisappearingDuration(duration);
        localStorage.setItem(`disappear_${currentUser?.id}_${girl?.id}`, duration);

        let durationText = "off";
        if (duration === "24h") durationText = "24 hours";
        else if (duration === "7d") durationText = "7 days";
        else if (duration === "90d") durationText = "90 days";

        const text = `📢 Disappearing messages set to ${durationText}`;
        socket.emit("send_message", { 
            sender_id: currentUser.id, 
            receiver_id: girl.id, 
            message: text, 
            image_url: null, 
            room: roomId 
        });
    };

    // Parse disappearing settings from messages
    useEffect(() => {
        const systemNotices = messages.filter(m => m.text && m.text.startsWith('📢 Disappearing messages'));
        if (systemNotices.length > 0) {
            const latestNotice = systemNotices[systemNotices.length - 1].text;
            if (latestNotice.includes('24 hours')) setDisappearingDuration('24h');
            else if (latestNotice.includes('7 days')) setDisappearingDuration('7d');
            else if (latestNotice.includes('90 days')) setDisappearingDuration('90d');
            else if (latestNotice.includes('off')) setDisappearingDuration('off');
        }
    }, [messages]);

    // Block / Unblock
    const handleBlockToggle = async () => {
        if (!currentUser) return;
        setBlockLoading(true);
        setShowMenu(false);
        const token = localStorage.getItem('token');
        const endpoint = isBlocked ? '/unblock' : '/block';
        try {
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ blocked_id: girl.id })
            });
            if (res.ok) {
                setIsBlocked(!isBlocked);
                if (!isBlocked) {
                    alert(`${girl.name} has been blocked.`);
                    setPage(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD);
                } else {
                    alert(`${girl.name} has been unblocked.`);
                }
            }
        } catch (e) { /* silent */ } finally { setBlockLoading(false); }
    };

    // Submit Report
    const handleReportSubmit = async (e) => {
        e.preventDefault();
        if (!reportReason) return;
        setReportSubmitting(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ reported_id: girl.id, reason: reportReason, description: reportDesc })
            });
            if (res.ok) {
                setReportDone(true);
                setTimeout(() => { setShowReportModal(false); setReportDone(false); setReportReason(''); setReportDesc(''); }, 2500);
            }
        } catch (e) { /* silent */ } finally { setReportSubmitting(false); }
    };

    // View Profile Details
    const handleViewProfileFromChat = () => {
        if (setSelectedGirl) setSelectedGirl(girl);
        setPage(PAGES.DETAILS);
    };

    // Clear Chat History
    const handleClearChat = async () => {
        if (!window.confirm("Are you sure you want to clear all messages?")) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/messages/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ target_id: girl.id })
            });
            if (res.ok) {
                setMessages([]);
                alert("Chat cleared successfully.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Delete Chat Completely
    const handleDeleteChat = async () => {
        if (!window.confirm("Are you sure you want to delete this chat? This will remove the conversation history.")) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/messages/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ target_id: girl.id })
            });
            if (res.ok) {
                setMessages([]);
                alert("Chat deleted.");
                setPage(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Toggle Mute Notifications
    const handleToggleMute = () => {
        const nextMute = !isMuted;
        setIsMutedNotifications(nextMute);
        localStorage.setItem(`mute_${currentUser?.id}_${girl?.id}`, nextMute ? "true" : "false");
    };

    // Filter disappearing messages
    const getFilteredMessages = () => {
        return messages.filter(msg => {
            if (disappearingDuration === 'off') return true;
            if (msg.text && msg.text.startsWith('📢')) return true;
            
            let limit = 0;
            if (disappearingDuration === '24h') limit = 24 * 60 * 60 * 1000;
            else if (disappearingDuration === '7d') limit = 7 * 24 * 60 * 60 * 1000;
            else if (disappearingDuration === '90d') limit = 90 * 24 * 60 * 60 * 1000;
            
            return Date.now() - msg.timestamp < limit;
        });
    };

    // --- CALLING & WEBRTC STATES ---
    const [callStatus, setCallStatus] = useState("idle"); 
    const [callType, setCallType] = useState(null); 
    const [facingMode, setFacingMode] = useState("user"); 
    
    // Timer and Mute for calls
    const [callDuration, setCallDuration] = useState(0);
    const [isCallMuted, setIsCallMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    
    const callStatusRef = useRef("idle");
    const callTypeRef = useRef(null);
    const isCallerRef = useRef(false);
    const callStartTimeRef = useRef(null);
    
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localVideoRef = useRef(null);

    const incomingRingRef = useRef(null);
    const outgoingRingRef = useRef(null);

    useEffect(() => {
        if (typeof Audio !== "undefined") {
            try {
                const inc = new Audio('/ringtone.mp3');
                inc.preload = 'none';
                inc.loop = true;
                incomingRingRef.current = inc;

                const out = new Audio('/calling.mp3');
                out.preload = 'none';
                out.loop = true;
                outgoingRingRef.current = out;
            } catch (e) {
                console.warn("Audio initialization warning:", e);
            }
        }
        return () => {
            try {
                if (incomingRingRef.current) {
                    incomingRingRef.current.pause();
                    incomingRingRef.current.src = "";
                }
                if (outgoingRingRef.current) {
                    outgoingRingRef.current.pause();
                    outgoingRingRef.current.src = "";
                }
            } catch (e) { }
        };
    }, []);

    const roomId = currentUser?.id < girl?.id
        ? `${currentUser?.id}_${girl?.id}`
        : `${girl?.id}_${currentUser?.id}`;

    const updateCallStatus = (status) => {
        setCallStatus(status);
        callStatusRef.current = status;
    };

    // Ringtone logic
    useEffect(() => {
        if (callStatus === 'calling' && outgoingRingRef.current) {
            outgoingRingRef.current.play().catch(e => console.log("Autoplay blocked:", e));
        } else if (outgoingRingRef.current) {
            outgoingRingRef.current.pause();
            outgoingRingRef.current.currentTime = 0;
        }

        if (callStatus === 'receiving' && incomingRingRef.current) {
            incomingRingRef.current.play().catch(e => console.log("Autoplay blocked:", e));
        } else if (incomingRingRef.current) {
            incomingRingRef.current.pause();
            incomingRingRef.current.currentTime = 0;
        }
    }, [callStatus]);

    // Timer logic
    useEffect(() => {
        let interval;
        if (callStatus === 'active') {
            interval = setInterval(() => {
                if (callStartTimeRef.current) {
                    setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
                }
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [callStatus]);

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Call Logger
    const logCallToChat = useCallback((messageText) => {
        if (!currentUser || !girl) return;
        const messageData = {
            sender_id: currentUser.id,
            receiver_id: girl.id,
            message: messageText,
            image_url: null,
            room: roomId
        };
        socket.emit("send_message", messageData);
    }, [currentUser, girl, roomId]);

    // Hardware stream cleanup
    const cleanupCall = useCallback(() => {
        if (isCallerRef.current && callTypeRef.current) {
            if (callStatusRef.current === 'active' && callStartTimeRef.current) {
                const durationMs = Date.now() - callStartTimeRef.current;
                const totalSeconds = Math.floor(durationMs / 1000);
                const mins = Math.floor(totalSeconds / 60);
                const secs = (totalSeconds % 60).toString().padStart(2, '0');
                logCallToChat(`✅ ${callTypeRef.current === 'video' ? 'Video' : 'Audio'} Call - ${mins}m ${secs}s`);
            } else if (callStatusRef.current === 'calling') {
                logCallToChat(`❌ Missed ${callTypeRef.current === 'video' ? 'Video' : 'Audio'} Call`);
            }
        }

        updateCallStatus("idle");
        setFacingMode("user");
        setIsCallMuted(false);
        setIsVideoOff(false);
        isCallerRef.current = false;
        callStartTimeRef.current = null;
        callTypeRef.current = null;
        incomingCallOfferRef.current = null;
        iceCandidatesQueue.current = [];

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (localVideoRef.current) {
            if (localVideoRef.current.srcObject) {
                localVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
    }, [logCallToChat]);

    // WebRTC SETUP
    const setupWebRTC = useCallback(async (type, isCaller) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video' ? { facingMode: "user" } : false
            });
            localStreamRef.current = stream;

            if (type === 'video' && localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
            });
            peerConnectionRef.current = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("webrtc_ice_candidate", { room: roomId, candidate: event.candidate });
                }
            };

            if (isCaller) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("webrtc_offer", { room: roomId, offer });
            } else if (incomingCallOfferRef.current) {
                // If offer was already received, process it now
                await pc.setRemoteDescription(new RTCSessionDescription(incomingCallOfferRef.current));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("webrtc_answer", { room: roomId, answer });
                
                // Flush queued candidates
                while (iceCandidatesQueue.current.length > 0) {
                    const candidate = iceCandidatesQueue.current.shift();
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) { console.error("Error flushing candidate:", e); }
                }
            }

        } catch (err) {
            console.error("Camera/Mic access denied:", err);
            alert("Camera or Microphone permission denied! Cannot start call.");
            cleanupCall();
        }
    }, [roomId, cleanupCall]);

    // Socket connections
    useEffect(() => {
        if (!currentUser || !girl) return;

        const cacheKey = `chatCache_${currentUser.id}_${girl.id}`;
        const cachedMessages = sessionStorage.getItem(cacheKey);

        if (cachedMessages) {
            setMessages(JSON.parse(cachedMessages));
        }

        const fetchOldMessages = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                const response = await fetch(`${API}/messages/${currentUser.id}/${girl.id}`, { headers });
                if (response.ok) {
                    const dbMessages = await response.json();
                    const formattedMessages = dbMessages.map(msg => {
                        const date = new Date(msg.created_at);
                        return {
                            id: msg.id, text: msg.message, imageUrl: msg.image_url, audio_url: msg.audio_url,
                            reaction: msg.reaction || null,
                            sent: String(msg.sender_id) === String(currentUser.id),
                            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            timestamp: date.getTime(), is_read: msg.is_read
                        };
                    });
                    setMessages(formattedMessages);
                    sessionStorage.setItem(cacheKey, JSON.stringify(formattedMessages));
                }
            } catch (error) { }
        };
        fetchOldMessages();
    }, [currentUser, girl]);

    useEffect(() => {
        socket.connect();
        socket.emit("join_room", roomId);
        socket.emit("user_connected", currentUser.id);
        socket.emit("mark_messages_read", { sender_id: girl.id, receiver_id: currentUser.id, room: roomId });

        const handleReceiveMessage = (data) => {
            setMessages((prev) => {
                if (prev.find(m => String(m.id) === String(data.id))) return prev;
                const date = data.created_at ? new Date(data.created_at) : new Date();
                return [...prev, {
                    id: data.id, text: data.text || data.message, imageUrl: data.image_url, audio_url: data.audio_url,
                    reaction: data.reaction || null,
                    sent: String(data.sender_id) === String(currentUser.id),
                    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    timestamp: date.getTime(), is_read: data.is_read || false
                }];
            });
            if (String(data.sender_id) === String(girl.id)) {
                socket.emit("mark_messages_read", { sender_id: girl.id, receiver_id: currentUser.id, room: roomId });
            }
        };

        const handleMessagesReadUpdate = (data) => {
            if (String(data.receiver_id) === String(girl.id) && String(data.sender_id) === String(currentUser.id)) {
                setMessages(prev => prev.map(msg => msg.sent ? { ...msg, is_read: true } : msg));
            }
        };

        const handlePartnerTyping = (data) => {
            if (String(data.sender_id) === String(girl.id)) {
                setIsPartnerTyping(data.isTyping);
            }
        };

        const handlePartnerStopTyping = (data) => {
            if (!data || String(data.sender_id) === String(girl.id)) {
                setIsPartnerTyping(false);
            }
        };

        const handleMessageReactionUpdated = (data) => {
            if (data && data.messageId) {
                setMessages(prev => prev.map(msg => String(msg.id) === String(data.messageId) ? { ...msg, reaction: data.reaction } : msg));
            }
        };

        socket.on("receive_message", handleReceiveMessage);
        socket.on("update_online_users", (usersArray) => setOnlineUsers(usersArray));
        socket.on("message_edited", (data) => setMessages(prev => prev.map(msg => String(msg.id) === String(data.messageId) ? { ...msg, text: data.newText } : msg)));
        socket.on("message_deleted", (deletedId) => setMessages(prev => prev.filter(msg => String(msg.id) !== String(deletedId))));
        socket.on("messages_read_update", handleMessagesReadUpdate);
        socket.on("partner_typing", handlePartnerTyping);
        socket.on("partner_stop_typing", handlePartnerStopTyping);
        socket.on("message_reaction_updated", handleMessageReactionUpdated);

        // Content moderation: blocked message warning
        socket.on("message_blocked", (data) => {
            alert(data.error || "⚠️ Message blocked — please use respectful language.");
        });

        return () => {
            socket.off("receive_message", handleReceiveMessage);
            socket.off("update_online_users");
            socket.off("message_edited");
            socket.off("message_deleted");
            socket.off("messages_read_update");
            socket.off("partner_typing", handlePartnerTyping);
            socket.off("partner_stop_typing", handlePartnerStopTyping);
            socket.off("message_reaction_updated", handleMessageReactionUpdated);
            socket.off("message_blocked");
            socket.disconnect();
        };
    }, [roomId, currentUser.id, girl.id, setupWebRTC, cleanupCall, isMuted]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // --- CALL ACTIONS ---
    const startCall = (type) => {
        setCallType(type);
        callTypeRef.current = type;
        isCallerRef.current = true;
        callStartTimeRef.current = null;
        updateCallStatus("calling");
        // Start camera/mic preview immediately!
        setupWebRTC(type, false);
        socket.emit("initiate_call", { room: roomId, receiver_id: girl.id, type: type });
    };

    const acceptCall = () => {
        updateCallStatus("active");
        callStartTimeRef.current = Date.now();
        // Start camera/mic immediately so it's ready to handle the offer
        setupWebRTC(callTypeRef.current, false);
        socket.emit("accept_call", { room: roomId, to: girl.id });
    };

    const rejectCall = () => {
        socket.emit("reject_call", { room: roomId, to: girl.id });
        cleanupCall();
    };

    const endCall = () => {
        socket.emit("end_call", { room: roomId, to: girl.id });
        cleanupCall();
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsCallMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const switchCamera = async () => {
        if (!localStreamRef.current || callType !== 'video') return;
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacingMode } });
            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
            
            if (oldVideoTrack) {
                oldVideoTrack.stop();
                localStreamRef.current.removeTrack(oldVideoTrack);
            }
            localStreamRef.current.addTrack(newVideoTrack);
            if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

            if (peerConnectionRef.current) {
                const videoSender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) videoSender.replaceTrack(newVideoTrack);
            }
        } catch (err) {
            console.error("Error switching camera:", err);
            setFacingMode(facingMode);
        }
    };

    const handleInputChange = (val) => {
        setInput(val);

        if (!socket || !roomId) return;

        // Emit typing status if user started typing
        if (!lastEmitTypingRef.current && val.trim().length > 0) {
            lastEmitTypingRef.current = true;
            socket.emit("typing", { room: roomId, sender_id: currentUser.id, isTyping: true });
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Set timeout to emit isTyping: false after 2s of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            if (lastEmitTypingRef.current) {
                lastEmitTypingRef.current = false;
                socket.emit("typing", { room: roomId, sender_id: currentUser.id, isTyping: false });
                socket.emit("stop_typing", { room: roomId, sender_id: currentUser.id });
            }
        }, 2000);

        // If the user cleared the text, emit typing: false immediately
        if (val.trim().length === 0 && lastEmitTypingRef.current) {
            lastEmitTypingRef.current = false;
            socket.emit("typing", { room: roomId, sender_id: currentUser.id, isTyping: false });
            socket.emit("stop_typing", { room: roomId, sender_id: currentUser.id });
        }
    };

    // --- MESSAGING FUNCTIONS ---
    const sendMessage = (imageLink = null) => {
        if (!input.trim() && !imageLink) return;
        if (!currentUser) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (lastEmitTypingRef.current) {
            lastEmitTypingRef.current = false;
            socket.emit("typing", { room: roomId, sender_id: currentUser.id, isTyping: false });
            socket.emit("stop_typing", { room: roomId, sender_id: currentUser.id });
        }

        if (editingMsgId) {
            socket.emit("edit_message", { messageId: editingMsgId, newText: input, room: roomId, sender_id: currentUser.id });
            setMessages(prev => prev.map(msg => String(msg.id) === String(editingMsgId) ? { ...msg, text: input } : msg));
            setEditingMsgId(null);
            setInput("");
            return;
        }

        socket.emit("send_message", { sender_id: currentUser.id, receiver_id: girl.id, message: input, image_url: imageLink, room: roomId });
        setInput("");
    };

    const handleImageAttachment = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingImage(true);
        const formData = new FormData();
        formData.append("image", file);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/chat-image`, {
                method: "POST",
                body: formData,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                sendMessage(data.imageUrl);
            }
        } catch (error) { } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    const handleDeleteForMe = () => {
        if (!messageToDelete) return;
        socket.emit("delete_for_me", { messageId: messageToDelete.id, userId: currentUser.id });
        setMessages(prev => prev.filter(msg => String(msg.id) !== String(messageToDelete.id)));
        setMessageToDelete(null);
    };

    const handleDeleteForEveryone = () => {
        if (!messageToDelete) return;
        socket.emit("delete_message", { messageId: messageToDelete.id, room: roomId, sender_id: currentUser.id });
        setMessageToDelete(null);
    };

    const editMessage = (id, text) => { setEditingMsgId(id); setInput(text); };
    const handleViewProfile = () => { if (setSelectedGirl) setSelectedGirl(girl); setPage(PAGES.DETAILS); };

    const isOnline = onlineUsers.includes(girl.id) || onlineUsers.includes(String(girl.id));
    
    const formatMessageDate = (timestamp) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return "Today";
        else if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        else return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const mediaList = messages.filter(m => m.imageUrl);
    const filteredMessagesToShow = getFilteredMessages();

    return (
        <div className="fixed inset-0 flex z-50" style={{ background: '#0D0D1A' }}>

            {/* ─── MAIN CHAT AREA ─── */}
            <div className="flex-1 flex flex-col h-full relative min-w-0">
                {/* ─── HEADER ─── */}
                <div className="flex items-center gap-3 px-3 py-2.5 shrink-0 border-b" style={{ background: '#16162A', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <button
                        onClick={() => setPage(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD)}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white transition rounded-full hover:bg-white/10"
                    >
                        <FiArrowLeft size={22} />
                    </button>

                    <div onClick={() => setShowContactInfo(true)} className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                        {girl.profile_pic ? (
                            <img src={girl.profile_pic} alt={girl.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/10" />
                        ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-white/10">
                                <span className="text-white font-bold text-base">{girl.name?.[0]?.toUpperCase()}</span>
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{girl.name}</div>
                            <div className="text-xs mt-0.5" style={{ color: isOnline ? '#4ade80' : '#6b7280' }}>
                                {isOnline ? 'online' : 'last seen recently'}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-1 relative shrink-0" ref={menuRef}>
                        <button onClick={() => window.dispatchEvent(new CustomEvent("rentgf_start_call", { detail: { targetUser: girl, type: 'video', room: roomId } }))} className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-[#0095f6] transition rounded-full hover:bg-white/10">
                            <FiVideo size={20} />
                        </button>
                        <button onClick={() => window.dispatchEvent(new CustomEvent("rentgf_start_call", { detail: { targetUser: girl, type: 'audio', room: roomId } }))} className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-[#0095f6] transition rounded-full hover:bg-white/10">
                            <FiPhone size={20} />
                        </button>
                        <button 
                            onClick={() => setShowMenu(!showMenu)} 
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition rounded-full hover:bg-white/10"
                        >
                            <FiMoreVertical size={20} />
                        </button>

                        {/* Dropdown Menu */}
                        {showMenu && (
                            <div className="absolute right-0 top-12 bg-[#16162A] border border-white/10 rounded-xl shadow-2xl py-1.5 w-44 z-50 animate-fade-in text-left">
                                <button
                                    onClick={() => { setShowContactInfo(true); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition"
                                >
                                    <FiInfo size={14} />
                                    Contact Info
                                </button>
                                <button
                                    onClick={handleViewProfileFromChat}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition"
                                >
                                    <FiUser size={14} />
                                    View Companion Profile
                                </button>
                                <button
                                    onClick={() => { setShowReportModal(true); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition"
                                >
                                    <FiFlag size={14} />
                                    Report User
                                </button>
                                <button
                                    onClick={handleBlockToggle}
                                    disabled={blockLoading}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition disabled:opacity-50"
                                >
                                    <FiSlash size={14} />
                                    {isBlocked ? 'Unblock User' : 'Block User'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        if (isThisChatLocked) {
                                            setChatLockModalMode("verify");
                                            setShowChatLockModal(true);
                                        } else {
                                            if (!hasChatLockPin(currentUser?.id)) {
                                                setChatLockModalMode("set_new");
                                                setShowChatLockModal(true);
                                            } else {
                                                lockChat(currentUser?.id, girl?.id);
                                                setIsThisChatLocked(true);
                                                setIsChatPinVerified(true);
                                                alert(`🔒 Chat with ${girl?.name || 'this companion'} has been locked. It will now appear in your Locked Chats folder.`);
                                            }
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-purple-400 hover:bg-purple-500/10 flex items-center gap-2 transition"
                                >
                                    {isThisChatLocked ? <FiUnlock size={14} /> : <FiLock size={14} />}
                                    {isThisChatLocked ? 'Unlock Chat 🔓' : 'Lock Chat 🔒'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        if (isThisChatHidden) {
                                            unhideChat(currentUser?.id, girl?.id);
                                            setIsThisChatHidden(false);
                                            alert(`👁️ Chat with ${girl?.name || 'this companion'} is now unhidden.`);
                                        } else {
                                            if (!hasChatLockPin(currentUser?.id)) {
                                                setChatLockModalMode("set_new");
                                                setShowChatLockModal(true);
                                            } else {
                                                hideChat(currentUser?.id, girl?.id);
                                                setIsThisChatHidden(true);
                                                setIsThisChatLocked(true);
                                                alert(`👁️‍🗨️ Chat with ${girl?.name || 'this companion'} is now hidden. Enter your PIN in the search bar to unhide.`);
                                            }
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-pink-400 hover:bg-pink-500/10 flex items-center gap-2 transition"
                                >
                                    {isThisChatHidden ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                                    {isThisChatHidden ? 'Unhide Chat 👁️' : 'Hide Chat 👁️‍🗨️'}
                                </button>
                                <div className="h-px bg-white/5 my-1" />
                                <button
                                    onClick={() => { handleClearChat(); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white flex items-center gap-2 transition"
                                >
                                    <FiTrash2 size={14} />
                                    Clear Chat
                                </button>
                                <button
                                    onClick={() => { handleDeleteChat(); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition"
                                >
                                    <FiTrash2 size={14} className="text-red-400" />
                                    Delete Chat
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Encryption notice ─── */}
                <div onClick={() => setShowEncryptionModal(true)} className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] shrink-0 cursor-pointer hover:underline" style={{ color: '#6b7280' }}>
                    <FiLock size={10} />
                    <span>Messages are end-to-end encrypted • Click to verify</span>
                </div>

                {/* ─── CHAT MESSAGES OR LOCKED OVERLAY ─── */}
                {isThisChatLocked && !isChatPinVerified ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#0D0D1A]">
                        <div className="w-20 h-20 rounded-3xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-xl">
                            <FiLock size={36} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Chat is Locked 🔒</h2>
                        <p className="text-xs text-gray-400 max-w-xs mb-6">
                            This conversation with {girl?.name} is private and protected by your 4-digit security PIN.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setChatLockModalMode("verify");
                                    setShowChatLockModal(true);
                                }}
                                className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-pink-500/20 hover:opacity-90 transition active:scale-95 flex items-center gap-2"
                            >
                                <FiKey size={14} /> Unlock Conversation
                            </button>
                            <button
                                onClick={() => setPage(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD)}
                                className="px-4 py-2.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ─── CHAT MESSAGES ─── */}
                        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1 transition-colors duration-300" style={{ background: wallpaperBackgrounds[userPrefs?.chatWallpaper] || '#0D0D1A' }} onClick={() => setActiveReactionPickerId(null)}>
                    {filteredMessagesToShow.map((msg, index) => {
                        const isWithinTimeLimit = Date.now() - msg.timestamp < 15 * 60 * 1000;
                        const prevMsg = index > 0 ? filteredMessagesToShow[index - 1] : null;
                        const showDateDivider = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
                        const isMissedCall = msg.text && (msg.text.includes('Missed Video Call') || msg.text.includes('Missed Audio Call') || msg.text.includes('Missed Voice Call') || msg.text.includes('Missed'));
                        const isCompletedCall = msg.text && (msg.text.includes('Call -') || msg.text.includes('Call'));
                        const isCallLog = msg.text && (msg.text.includes('📞') || isMissedCall || isCompletedCall) && (msg.text.includes('Voice Call') || msg.text.includes('Video Call') || msg.text.includes('Audio Call') || isMissedCall);
                        const isLastSentMsg = index === filteredMessagesToShow.map(m => m.sent).lastIndexOf(true);

                        const isSystemNotice = msg.text && msg.text.startsWith('📢');

                        return (
                            <React.Fragment key={msg.id}>
                                {showDateDivider && (
                                    <div className="flex justify-center my-3">
                                        <span className="text-[11px] px-3 py-1 rounded-md font-medium" style={{ background: '#13132A', color: '#6b7280' }}>
                                            {formatMessageDate(msg.timestamp)}
                                        </span>
                                    </div>
                                )}

                                {isSystemNotice ? (
                                    <div className="flex justify-center my-2.5">
                                        <span className="text-[10px] px-3.5 py-1.5 rounded-xl text-center font-medium bg-[#13132A] text-pink-400 border border-pink-500/10">
                                            {msg.text.replace('📢', '').trim()}
                                        </span>
                                    </div>
                                ) : isCallLog ? (
                                    <div className={`flex ${msg.sent ? 'justify-end' : 'justify-start'} my-1 px-1`}>
                                        <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl text-xs border backdrop-blur-md shadow-md ${
                                            msg.sent
                                                ? 'bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-pink-500/25 text-white rounded-br-sm'
                                                : 'bg-[#16162A] border-white/10 text-gray-200 rounded-bl-sm'
                                        }`}>
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isMissedCall ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                                                {isMissedCall ? (
                                                    <FiPhoneMissed size={14} />
                                                ) : msg.text && msg.text.includes('Video') ? (
                                                    <FiVideo size={14} />
                                                ) : (
                                                    <FiPhone size={14} />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <span className={isMissedCall ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                                                        {msg.text.replace('📞 ', '').replace('❌ ', '').replace('✅ ', '')}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                                    <span>{msg.sent ? 'Outgoing' : 'Incoming'}</span>
                                                    <span>•</span>
                                                    <span>{msg.time}</span>
                                                    {msg.sent && <span className="text-blue-400 font-bold ml-0.5">✓✓</span>}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col mb-1">
                                        <div
                                            className={`flex ${msg.sent ? 'justify-end' : 'justify-start'} group relative`}
                                            onMouseEnter={() => setHoveredMsgId(msg.id)}
                                            onMouseLeave={() => setHoveredMsgId(null)}
                                            onTouchStart={() => {
                                                longPressTimerRef.current = setTimeout(() => {
                                                    setActiveReactionPickerId(msg.id);
                                                }, 400);
                                            }}
                                            onTouchEnd={() => {
                                                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                                            }}
                                            onTouchMove={() => {
                                                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                                            }}
                                        >
                                            <div className="relative max-w-[80%] sm:max-w-[65%]">
                                                {/* Floating Emoji Reaction Popover */}
                                                {activeReactionPickerId === msg.id && (
                                                    <div
                                                        className={`absolute -top-11 ${msg.sent ? 'right-0' : 'left-0'} z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#18182f] border border-pink-500/30 shadow-2xl backdrop-blur-md animate-fade-in`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {QUICK_REACTIONS.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleReaction(msg.id, emoji);
                                                                }}
                                                                className={`text-base p-1 rounded-full hover:scale-130 active:scale-95 transition-all ${msg.reaction === emoji ? 'bg-pink-500/30 scale-110' : 'hover:bg-white/10'}`}
                                                                title={`React ${emoji}`}
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Hover action buttons */}
                                                {hoveredMsgId === msg.id && (
                                                    <div className={`absolute top-1 ${msg.sent ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} flex gap-1 z-10`}>
                                                        <div className="flex gap-1 rounded-lg px-1.5 py-1 shadow-lg border border-white/10" style={{ background: '#16162A' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveReactionPickerId(activeReactionPickerId === msg.id ? null : msg.id);
                                                                }}
                                                                className="p-1 text-gray-500 hover:text-pink-400 transition"
                                                                title="Add Reaction"
                                                            >
                                                                <FiSmile size={13} />
                                                            </button>
                                                            {msg.sent && isWithinTimeLimit && !msg.imageUrl && (
                                                                <button onClick={() => editMessage(msg.id, msg.text)} className="p-1 text-gray-500 hover:text-pink-400 transition" title="Edit">
                                                                    <FiEdit2 size={13} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => toggleStarMessage(msg.id)} className="p-1 text-gray-500 hover:text-yellow-400 transition" title="Star Message">
                                                                <FiStar size={13} className={starredMessages.includes(msg.id) ? "fill-yellow-400 text-yellow-400" : ""} />
                                                            </button>
                                                            <button onClick={() => setMessageToDelete(msg)} className="p-1 text-gray-500 hover:text-red-400 transition" title="Delete">
                                                                <FiTrash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Message bubble */}
                                                <div
                                                    className="relative shadow-sm text-sm leading-relaxed"
                                                    style={{
                                                        background: msg.sent ? '#2d1457' : '#16162A',
                                                        color: '#f1f5f9',
                                                        borderRadius: msg.sent ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                                                        border: msg.sent ? '1px solid rgba(236,72,153,0.2)' : '1px solid rgba(255,255,255,0.08)',
                                                        padding: (msg.imageUrl && !msg.text) ? '3px' : (msg.imageUrl && msg.text) ? '4px 4px 6px 4px' : '6px 12px'
                                                    }}
                                                >
                                                    {msg.imageUrl && !msg.text && (
                                                        <div className="relative overflow-hidden" style={{ borderRadius: msg.sent ? '10px 10px 2px 10px' : '10px 10px 10px 2px' }}>
                                                            <img
                                                                src={msg.imageUrl}
                                                                alt="attachment"
                                                                className="w-full max-w-[260px] xs:max-w-[280px] object-cover cursor-pointer active:scale-95 transition-transform block"
                                                                style={{
                                                                    maxHeight: '300px',
                                                                    borderRadius: msg.sent ? '10px 10px 2px 10px' : '10px 10px 10px 2px'
                                                                }}
                                                                onClick={() => setLightboxImg(msg.imageUrl)}
                                                            />
                                                            {/* Timestamp overlay on image */}
                                                            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-[1px] text-[9px] text-white/90 select-none pointer-events-none">
                                                                {starredMessages.includes(msg.id) && (
                                                                    <span className="text-yellow-400 text-[10px]">★</span>
                                                                )}
                                                                <span>{msg.time}</span>
                                                                {msg.sent && (
                                                                    <span
                                                                        className="text-[10px] font-bold tracking-tighter"
                                                                        style={{ color: msg.is_read ? '#38bdf8' : onlineUsers.includes(girl.id?.toString()) ? '#9ca3af' : '#6b7280' }}
                                                                    >
                                                                        {msg.is_read ? '✓✓' : onlineUsers.includes(girl.id?.toString()) ? '✓✓' : '✓'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {msg.imageUrl && msg.text && (
                                                        <>
                                                            <img
                                                                src={msg.imageUrl}
                                                                alt="attachment"
                                                                className="w-full max-w-[260px] xs:max-w-[280px] object-cover cursor-pointer active:scale-95 transition-transform block mb-1.5"
                                                                style={{
                                                                    maxHeight: '300px',
                                                                    borderRadius: msg.sent ? '10px 10px 2px 10px' : '10px 10px 10px 2px'
                                                                }}
                                                                onClick={() => setLightboxImg(msg.imageUrl)}
                                                            />
                                                            <div className="px-1.5 pb-1">
                                                                <span className="break-words text-gray-200">{msg.text}</span>
                                                                <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5 ml-3">
                                                                    {starredMessages.includes(msg.id) && (
                                                                        <span className="text-yellow-400 text-[10px] mr-1">★</span>
                                                                    )}
                                                                    <span className="text-[10px] select-none" style={{ color: '#6b7280' }}>{msg.time}</span>
                                                                    {msg.sent && (
                                                                        <span
                                                                            className="text-[11px] font-bold tracking-tighter select-none"
                                                                            style={{ color: msg.is_read ? '#38bdf8' : onlineUsers.includes(girl.id?.toString()) ? '#9ca3af' : '#6b7280' }}
                                                                        >
                                                                            {msg.is_read ? '✓✓' : onlineUsers.includes(girl.id?.toString()) ? '✓✓' : '✓'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {!msg.imageUrl && (
                                                        <>
                                                            {msg.audio_url || (msg.text && (msg.text.startsWith('data:audio') || msg.text.startsWith('blob:'))) ? (
                                                                <VoiceNotePlayer audioSrc={msg.audio_url || msg.text} sent={msg.sent} />
                                                            ) : (
                                                                msg.text && <span className="break-words">{msg.text}</span>
                                                            )}
                                                            <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5 ml-3">
                                                                {starredMessages.includes(msg.id) && (
                                                                    <span className="text-yellow-400 text-[10px] mr-1">★</span>
                                                                )}
                                                                <span className="text-[10px] select-none" style={{ color: '#6b7280' }}>{msg.time}</span>
                                                                {msg.sent && (
                                                                    <span
                                                                        className="text-[11px] font-bold tracking-tighter select-none"
                                                                        style={{ color: msg.is_read ? '#38bdf8' : onlineUsers.includes(girl.id?.toString()) ? '#9ca3af' : '#6b7280' }}
                                                                        title={msg.is_read ? "Seen" : onlineUsers.includes(girl.id?.toString()) ? "Delivered" : "Sent"}
                                                                    >
                                                                        {msg.is_read ? '✓✓' : onlineUsers.includes(girl.id?.toString()) ? '✓✓' : '✓'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Pinned Reaction Badge */}
                                                    {msg.reaction && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleReaction(msg.id, msg.reaction);
                                                            }}
                                                            className={`absolute -bottom-2.5 ${msg.sent ? 'right-2' : 'left-2'} z-20 px-1.5 py-0.5 rounded-full bg-[#1c1833] border border-pink-500/40 text-[11px] shadow-md hover:scale-110 active:scale-95 transition-all flex items-center cursor-pointer`}
                                                            title="Tap to remove reaction"
                                                        >
                                                            <span>{msg.reaction}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Instagram style "Seen" Receipt */}
                                        {isLastSentMsg && msg.sent && msg.is_read && (
                                            <div className="flex justify-end pr-2 mt-0.5 select-none">
                                                <span className="text-[10px] text-gray-400 font-medium">Seen</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {uploadingImage && (
                        <div className="flex justify-end mb-1">
                            <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2 animate-pulse" style={{ background: '#2d1457', color: '#f1f5f9' }}>
                                <div className="w-3 h-3 border-2 border-pink-400/40 border-t-pink-400 rounded-full animate-spin" />
                                Sending...
                            </div>
                        </div>
                    )}
                    {isPartnerTyping && (
                        <div className="flex justify-start mb-2.5 items-end gap-2">
                            {girl.profile_pic ? (
                                <img src={girl.profile_pic} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                    {girl.name?.[0]?.toUpperCase()}
                                </div>
                            )}
                            <div className="px-4 py-3 rounded-2xl bg-[#16162A] border border-white/5 flex items-center gap-1.5" style={{ borderRadius: '18px 18px 18px 4px' }}>
                                <style>{`
                                    @keyframes typingBounce {
                                        0%, 100% { transform: translateY(0); opacity: 0.4; }
                                        50% { transform: translateY(-4px); opacity: 1; }
                                    }
                                    .typing-dot {
                                        width: 5px;
                                        height: 5px;
                                        background-color: #9ca3af;
                                        border-radius: 50%;
                                        display: inline-block;
                                        animation: typingBounce 1.4s infinite ease-in-out;
                                    }
                                    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                                    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                                `}</style>
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* ─── Editing banner ─── */}
                {editingMsgId && (
                    <div className="flex justify-between items-center px-4 py-2 text-xs border-t shrink-0" style={{ background: '#16162A', borderColor: '#ec4899', color: '#ec4899' }}>
                        <div className="flex items-center gap-2">
                            <FiEdit2 size={13} />
                            <span>Editing message</span>
                        </div>
                        <button onClick={() => { setEditingMsgId(null); setInput(''); }} className="hover:text-white transition">
                            <FiX size={15} />
                        </button>
                    </div>
                )}

                {/* ─── LIVE AUDIO RECORDING OR INPUT BAR ─── */}
                {isRecordingAudio ? (
                    <div className="flex items-center justify-between px-4 py-3 bg-[#16162A] border-t border-pink-500/30 text-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                            <span className="text-xs font-bold text-red-400 font-mono tracking-wider">
                                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                            </span>
                            {/* Live Soundwave Equalizer */}
                            <div className="flex items-center gap-1 ml-1">
                                <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse" />
                                <span className="w-1 h-5 bg-red-500 rounded-full animate-pulse delay-75" />
                                <span className="w-1 h-2.5 bg-red-400 rounded-full animate-pulse delay-150" />
                                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse delay-100" />
                                <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse delay-200" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={cancelRecording}
                                className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-full transition flex items-center gap-1.5 text-xs font-semibold"
                                title="Cancel Recording"
                            >
                                <FiTrash2 size={15} />
                                <span>Cancel</span>
                            </button>
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full transition shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                                title="Send Voice Note"
                            >
                                <FiSend size={14} />
                                <span>Send</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-end gap-2 px-3 py-2 shrink-0 border-t" style={{ background: '#16162A', borderColor: 'rgba(255,255,255,0.08)' }}>
                        <label
                            className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition flex-shrink-0 text-gray-500 hover:text-pink-400 hover:bg-white/10"
                            title="Attach Image"
                        >
                            <FiPaperclip size={20} />
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageAttachment} disabled={uploadingImage || !!editingMsgId} />
                        </label>

                        <div className="flex-1 flex items-end rounded-2xl px-4 py-2.5 border border-white/10" style={{ background: '#0D0D1A', minHeight: 44 }}>
                            <textarea
                                className="flex-1 bg-transparent text-sm outline-none resize-none placeholder-gray-600 border-none"
                                style={{ maxHeight: 120, color: '#f1f5f9' }}
                                placeholder="Message..."
                                value={input}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth' }), 100)}
                                rows={1}
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (input.trim()) {
                                    sendMessage(null);
                                } else {
                                    startRecording();
                                }
                            }}
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition hover:scale-110 active:scale-95 bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20"
                            title={input.trim() ? "Send Message" : "Record Voice Note"}
                        >
                            {input.trim() ? <FiSend size={17} className="text-white" /> : <FiMic size={17} className="text-white" />}
                        </button>
                    </div>
                )}
                    </>
                )}
            </div>

            {/* ─── WHATSAPP STYLE CONTACT INFO SIDEBAR ─── */}
            {showContactInfo && (
                <div className="w-full sm:w-80 bg-[#16162A] border-l border-white/10 shrink-0 z-35 flex flex-col h-full relative text-left">
                    <div className="px-4 py-3.5 border-b border-white/5 flex items-center gap-3 bg-[#121222]">
                        <button onClick={() => { setShowContactInfo(false); setShowStarredSubView(false); }} className="text-gray-400 hover:text-white transition">
                            <FiX size={20} />
                        </button>
                        <h3 className="text-sm font-bold text-white">Contact info</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                        
                        {/* Avatar Card */}
                        <div className="flex flex-col items-center text-center bg-[#0D0D1A]/50 border border-white/5 p-5 rounded-2xl">
                            <div className="w-24 h-24 rounded-full overflow-hidden mb-3.5 border-2 border-pink-500/30 shadow-lg">
                                <img src={girl.profile_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135768.png"} alt={girl.name} className="w-full h-full object-cover" />
                            </div>
                            <h4 className="text-base font-bold text-white mb-0.5">{girl.name}</h4>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">{girl.role}</p>
                        </div>

                        {/* About Bio */}
                        {girl.bio && (
                            <div className="bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl">
                                <h5 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">About & Status</h5>
                                <p className="text-xs text-gray-200 leading-relaxed">{girl.bio}</p>
                            </div>
                        )}

                        {/* Media Links and Docs */}
                        <div className="bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl">
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1.5">
                                    <FiFolder size={11} className="text-pink-400" />
                                    Media, links & docs
                                </h5>
                                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400 font-semibold">{mediaList.length}</span>
                            </div>
                            {mediaList.length === 0 ? (
                                <p className="text-[11px] text-gray-600 text-center py-2">No media shared</p>
                            ) : (
                                <div className="grid grid-cols-4 gap-1.5">
                                    {mediaList.slice(0, 4).map(m => (
                                        <div key={m.id} onClick={() => setLightboxImg(m.imageUrl)} className="aspect-square rounded-md overflow-hidden cursor-pointer border border-white/5">
                                            <img src={m.imageUrl} alt="" className="w-full h-full object-cover hover:brightness-75 transition" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Starred Messages Access */}
                        <button 
                            onClick={() => setShowStarredSubView(true)}
                            className="w-full flex justify-between items-center bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl hover:bg-white/5 transition text-left"
                        >
                            <span className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                                <FiStar size={13} className="text-yellow-400" /> Starred messages
                            </span>
                            <span className="text-gray-500 text-base">›</span>
                        </button>

                        {/* Disappearing Messages */}
                        <div className="bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl space-y-3">
                            <h5 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1.5">
                                <FiClock size={11} className="text-gray-400" /> Disappearing messages
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                                {['off', '24h', '7d', '90d'].map(d => (
                                    <button 
                                        key={d} 
                                        onClick={() => handleDisappearingToggle(d)} 
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition border ${
                                            disappearingDuration === d 
                                                ? 'bg-pink-500/10 border-pink-500/50 text-pink-400' 
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {d === 'off' ? 'Off' : d === '24h' ? '24 Hrs' : d === '7d' ? '7 Days' : '90 Days'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* WhatsApp-Style Chat Lock Toggle in Sidebar */}
                        <div className="bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                                    <FiLock size={12} className="text-purple-400" />
                                    <span>Lock Chat</span>
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                    {isThisChatLocked ? "Chat is locked with PIN" : "Protect with 4-Digit PIN"}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (isThisChatLocked) {
                                        setChatLockModalMode("verify");
                                        setShowChatLockModal(true);
                                    } else {
                                        if (!hasChatLockPin(currentUser?.id)) {
                                            setChatLockModalMode("set_new");
                                            setShowChatLockModal(true);
                                        } else {
                                            lockChat(currentUser?.id, girl?.id);
                                            setIsThisChatLocked(true);
                                            setIsChatPinVerified(true);
                                            alert(`🔒 Chat with ${girl?.name} locked.`);
                                        }
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                                    isThisChatLocked
                                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                }`}
                            >
                                {isThisChatLocked ? "Locked 🔒" : "Lock Chat"}
                            </button>
                        </div>

                        {/* WhatsApp-Style Hide Chat Toggle in Sidebar */}
                        <div className="bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                                    <FiEyeOff size={12} className="text-pink-400" />
                                    <span>Hide Chat</span>
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                    {isThisChatHidden ? "Chat is hidden from inbox" : "Hide completely from inbox"}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (isThisChatHidden) {
                                        unhideChat(currentUser?.id, girl?.id);
                                        setIsThisChatHidden(false);
                                        alert(`👁️ Chat with ${girl?.name} is now unhidden.`);
                                    } else {
                                        if (!hasChatLockPin(currentUser?.id)) {
                                            setChatLockModalMode("set_new");
                                            setShowChatLockModal(true);
                                        } else {
                                            hideChat(currentUser?.id, girl?.id);
                                            setIsThisChatHidden(true);
                                            setIsThisChatLocked(true);
                                            alert(`👁️‍🗨️ Chat with ${girl?.name} is now hidden.`);
                                        }
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                                    isThisChatHidden
                                        ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                }`}
                            >
                                {isThisChatHidden ? "Hidden 👁️‍🗨️" : "Hide Chat"}
                            </button>
                        </div>

                        {/* Mute Notifications */}
                        <div className="bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-300">Mute notifications</span>
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                                <input type="checkbox" checked={isMuted} onChange={handleToggleMute} className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                            </label>
                        </div>

                        {/* Security encryption info */}
                        <button 
                            onClick={() => setShowEncryptionModal(true)}
                            className="w-full bg-[#0D0D1A]/40 border border-white/5 p-4 rounded-xl text-left hover:bg-white/5 transition"
                        >
                            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block mb-1">Encryption</span>
                            <p className="text-[11px] text-gray-400 leading-normal flex items-center gap-1.5">
                                <FiLock size={12} className="text-green-400 shrink-0" />
                                Messages and calls are end-to-end encrypted. Click to verify.
                            </p>
                        </button>

                        {/* Bottom destructive actions */}
                        <div className="pt-2 flex flex-col gap-2">
                            <button onClick={handleClearChat} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 transition">
                                Clear chat
                            </button>
                            <button onClick={handleDeleteChat} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold text-red-400 transition">
                                Delete chat
                            </button>
                            <button onClick={handleBlockToggle} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold text-red-400 transition">
                                {isBlocked ? "Unblock contact" : "Block contact"}
                            </button>
                        </div>
                    </div>

                    {/* Starred Messages Sub View inside sidebar */}
                    {showStarredSubView && (
                        <div className="absolute inset-0 bg-[#16162A] z-[90] flex flex-col">
                            <div className="px-4 py-3.5 border-b border-white/5 flex items-center gap-3 bg-[#121222]">
                                <button onClick={() => setShowStarredSubView(false)} className="text-gray-400 hover:text-white transition">
                                    ←
                                </button>
                                <h3 className="text-sm font-bold text-white">Starred messages</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                                {messages.filter(m => starredMessages.includes(m.id)).length === 0 ? (
                                    <div className="text-center text-gray-500 text-xs py-10">No starred messages.</div>
                                ) : (
                                    messages.filter(m => starredMessages.includes(m.id)).map(m => (
                                        <div key={m.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-xs leading-relaxed relative">
                                            <button onClick={() => toggleStarMessage(m.id)} className="absolute top-3 right-3 text-yellow-400 hover:text-gray-500 transition text-sm">
                                                ★
                                            </button>
                                            <div className="text-[10px] text-pink-400 font-semibold mb-1.5">{m.sent ? "You" : girl.name}</div>
                                            {m.imageUrl && <img src={m.imageUrl} alt="" className="w-full max-w-[120px] rounded-lg mb-2 object-cover border border-white/5" />}
                                            {m.text && <p className="text-gray-200 break-words">{m.text}</p>}
                                            <span className="text-[9px] text-gray-500 block mt-1.5">{m.time}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── FULLSCREEN IMAGE LIGHTBOX ─── */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4"
                    onClick={() => setLightboxImg(null)}
                >
                    <button
                        onClick={() => setLightboxImg(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition z-10"
                    >
                        <FiX size={20} />
                    </button>
                    <img
                        src={lightboxImg}
                        alt="Full view"
                        className="max-w-full max-h-full object-contain rounded-lg select-none"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '95vw', maxHeight: '90vh' }}
                    />
                    <a
                        href={lightboxImg}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition"
                    >
                        <FiPaperclip size={13} /> Save Image
                    </a>
                </div>
            )}

            {/* ─── DELETE MODAL ─── */}
            {messageToDelete && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="w-full max-w-xs overflow-hidden shadow-2xl border border-white/10 bg-[#16162A]" style={{ borderRadius: 16 }}>
                        <div className="px-6 py-5">
                            <h3 className="text-base font-semibold mb-1 text-white">Delete message?</h3>
                            <p className="text-xs mb-5 text-gray-500 font-medium">This action cannot be undone.</p>
                            <div className="flex flex-col gap-2">
                                {messageToDelete.sent && (Date.now() - messageToDelete.timestamp < 15 * 60 * 1000) && (
                                    <button onClick={handleDeleteForEveryone} className="py-2.5 rounded-lg font-semibold text-sm transition bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90">Delete for Everyone</button>
                                )}
                                <button onClick={handleDeleteForMe} className="py-2.5 rounded-lg font-semibold text-sm transition hover:bg-white/10 text-gray-400 border border-white/10">Delete for Me</button>
                                <button onClick={() => setMessageToDelete(null)} className="py-2.5 rounded-lg font-semibold text-sm transition hover:bg-white/10 text-gray-500">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── ENCRYPTION MODAL ─── */}
            {showEncryptionModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowEncryptionModal(false)}>
                    <div className="bg-[#16162A] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto mb-4">
                            <FiLock className="text-pink-500 text-2xl" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Verify encryption</h3>
                        <p className="text-xs text-gray-400 leading-relaxed mb-6 font-medium">
                            Messages and voice/video calls in this chat are end-to-end encrypted with a secure verification code. No one outside of this chat, not even RentGF, can read or listen to them.
                        </p>
                        <div className="flex justify-center gap-2 mb-6">
                            <span className="font-mono text-sm tracking-wider text-pink-400 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
                                8937 4028 1029 4829
                            </span>
                        </div>
                        <button onClick={() => setShowEncryptionModal(false)} className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-xs font-bold transition shadow-lg">
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* ─── CALL UI ─── */}
            {callStatus !== 'idle' && (
                <div className={`fixed inset-0 z-[200] flex flex-col overflow-hidden ${callStatus === 'active' && callType === 'video' ? 'bg-black' : 'bg-[#0D0D1A]'}`}>

                    {/* Audio / Ringing / Active-Audio UI */}
                    {!(callStatus === 'active' && callType === 'video') && (
                        <>
                            {/* Blurred background */}
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <img src={girl.profile_pic || 'https://i.pinimg.com/736x/89/90/48/899048ab0cc455154006fdb9676964b3.jpg'} alt="bg" className="w-full h-full object-cover blur-3xl opacity-10 scale-110" />
                                <div className="absolute inset-0" style={{ background: 'rgba(13,13,26,0.88)' }} />
                            </div>

                            {/* Center info */}
                            <div className="z-10 flex flex-col items-center justify-center flex-1 px-6 pb-32 text-center">
                                <div className="relative mb-5">
                                    <div className={`absolute inset-0 rounded-full animate-ping opacity-20 scale-125 ${callStatus === 'active' ? 'bg-pink-500' : 'bg-purple-500'}`} />
                                    <img
                                        src={girl.profile_pic || 'https://i.pinimg.com/736x/89/90/48/899048ab0cc455154006fdb9676964b3.jpg'}
                                        alt={girl.name}
                                        className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 shadow-2xl relative z-10 border-pink-500/30"
                                    />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">{girl.name}</h2>
                                <p className="text-sm font-medium text-gray-500 text-center">
                                    {callStatus === 'calling' && 'Calling...'}
                                    {callStatus === 'receiving' && `Incoming ${callType === 'video' ? 'video' : 'voice'} call`}
                                    {callStatus === 'active' && <span className="font-mono text-pink-400 text-base">{formatDuration(callDuration)}</span>}
                                </p>
                            </div>

                            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                            <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
                        </>
                    )}

                    {/* Active Video Call */}
                    {callStatus === 'active' && callType === 'video' && (
                        <>
                            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black z-0" />

                            {/* Top bar */}
                            <div className="absolute top-0 left-0 right-0 px-4 sm:px-6 pt-10 sm:pt-10 pb-6 bg-gradient-to-b from-black/70 to-transparent flex justify-between items-start z-20">
                                <div className="text-white">
                                    <div className="font-bold text-base sm:text-lg">{girl.name}</div>
                                    <div className="text-xs font-mono text-pink-400 mt-0.5">{formatDuration(callDuration)}</div>
                                </div>
                                <button
                                    onClick={switchCamera}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition bg-black/50 text-white hover:scale-105 active:scale-95"
                                >
                                    <FiRefreshCw size={18} />
                                </button>
                            </div>

                            {/* Local video PIP */}
                            <video
                                ref={localVideoRef}
                                autoPlay playsInline muted
                                className="absolute bottom-32 sm:bottom-36 right-3 sm:right-5 w-20 h-28 sm:w-28 sm:h-40 rounded-xl sm:rounded-2xl bg-gray-900 object-cover shadow-2xl border-2 border-pink-500/30 z-10"
                            />
                        </>
                    )}

                    {/* Call Controls */}
                    <div className="absolute bottom-8 sm:bottom-12 w-full flex justify-center gap-6 sm:gap-8 z-20 px-6">
                        {callStatus === 'receiving' ? (
                            <div className="flex items-end gap-12 sm:gap-16">
                                <div className="flex flex-col items-center gap-2">
                                    <button onClick={rejectCall} className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition hover:scale-110 active:scale-95">
                                        <FiPhoneOff size={24} className="text-white" />
                                    </button>
                                    <span className="text-xs text-gray-400 font-semibold">Decline</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <button onClick={acceptCall} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg transition hover:scale-110 active:scale-95 animate-bounce bg-gradient-to-br from-pink-500 to-purple-600 shadow-pink-500/30">
                                        {callType === 'video' ? <FiVideo size={24} className="text-white" /> : <FiPhone size={24} className="text-white" />}
                                    </button>
                                    <span className="text-xs text-gray-400 font-semibold">Accept</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-5 sm:gap-8">
                                <div className="flex flex-col items-center gap-1.5">
                                    <button onClick={toggleMic} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition active:scale-90" style={{ background: isCallMuted ? 'white' : 'rgba(255,255,255,0.15)' }}>
                                        {isCallMuted ? <FiMicOff size={20} className="text-black" /> : <FiMic size={20} className="text-white" />}
                                    </button>
                                    <span className="text-[10px] text-gray-400 font-medium">{isCallMuted ? 'Unmute' : 'Mute'}</span>
                                </div>

                                <div className="flex flex-col items-center gap-1.5">
                                    <button onClick={endCall} className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition hover:scale-110 active:scale-95">
                                        <FiPhoneOff size={24} className="text-white" />
                                    </button>
                                    <span className="text-[10px] text-gray-400 font-medium">End</span>
                                </div>

                                <div className="flex flex-col items-center gap-1.5">
                                    {callType === 'video' ? (
                                        <button onClick={toggleVideo} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition active:scale-90" style={{ background: isVideoOff ? 'white' : 'rgba(255,255,255,0.15)' }}>
                                            {isVideoOff ? <FiVideoOff size={20} className="text-black" /> : <FiVideo size={20} className="text-white" />}
                                        </button>
                                    ) : (
                                        <button className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                                            <FiMic size={20} className="text-white" />
                                        </button>
                                    )}
                                    <span className="text-[10px] text-gray-400 font-medium">{callType === 'video' ? (isVideoOff ? 'Cam On' : 'Cam Off') : 'Speaker'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── REPORT MODAL ─── */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-[#16162A] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 relative overflow-hidden animate-slide-up">
                        {reportDone ? (
                            <div className="text-center py-6">
                                <FiCheckCircle className="text-pink-500 text-5xl mx-auto mb-4 animate-bounce" />
                                <h3 className="text-lg font-bold text-white mb-2">Report Submitted</h3>
                                <p className="text-xs text-gray-400 font-medium">Thank you. The admin team will review this user.</p>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setShowReportModal(false)} 
                                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
                                >
                                    <FiX size={20} />
                                </button>
                                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                                    <FiAlertTriangle className="text-pink-500" /> Report Profile
                                </h3>
                                <p className="text-xs text-gray-400 mb-5 font-medium">Help us keep our community safe. Please specify the reason.</p>
                                
                                <form onSubmit={handleReportSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1.5 ml-1">Reason</label>
                                        <select 
                                            required 
                                            value={reportReason} 
                                            onChange={(e) => setReportReason(e.target.value)}
                                            className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white outline-none focus:border-pink-500 transition"
                                        >
                                            <option value="">Select a reason...</option>
                                            <option value="Spam / Fake Profile">Spam / Fake Profile</option>
                                            <option value="Inappropriate Messages">Inappropriate Messages</option>
                                            <option value="Harassment / Abuse">Harassment / Abuse</option>
                                            <option value="Scam / Financial Fraud">Scam / Financial Fraud</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1.5 ml-1">Additional details (Optional)</label>
                                        <textarea
                                            value={reportDesc}
                                            onChange={(e) => setReportDesc(e.target.value)}
                                            placeholder="Provide more context..."
                                            className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition h-20 resize-none"
                                        />
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        disabled={reportSubmitting || !reportReason}
                                        className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-bold text-xs transition shadow-lg disabled:opacity-50 hover:opacity-95"
                                    >
                                        {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* WhatsApp-Style Chat Lock PIN Modal */}
            <ChatLockPinModal
                isOpen={showChatLockModal}
                onClose={() => setShowChatLockModal(false)}
                userId={currentUser?.id}
                mode={chatLockModalMode}
                onSuccess={() => {
                    if (chatLockModalMode === "set_new") {
                        lockChat(currentUser?.id, girl?.id);
                        setIsThisChatLocked(true);
                        setIsChatPinVerified(true);
                        alert(`🔒 Chat with ${girl?.name || 'this companion'} has been locked. It will now appear in your Locked Chats folder.`);
                    } else if (isThisChatLocked && isChatPinVerified) {
                        unlockChat(currentUser?.id, girl?.id);
                        setIsThisChatLocked(false);
                        alert(`🔓 Chat with ${girl?.name || 'this companion'} is now unlocked.`);
                    } else {
                        setIsChatPinVerified(true);
                    }
                }}
                companionName={girl?.name || "this companion"}
            />
        </div>
    );
}

export default ChatPage;

const express = require('express');
const { pool } = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// ─── GET TOTAL UNREAD MESSAGES COUNT — AUTH REQUIRED ──────────
router.get('/unread-messages-count', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT COUNT(*)::int AS count 
             FROM messages 
             WHERE receiver_id = $1 
               AND is_read = false 
               AND NOT ($1 = ANY(COALESCE(deleted_for, '{}')))`,
            [userId]
        );
        res.status(200).json({ count: result.rows[0]?.count || 0 });
    } catch (err) {
        console.error("Get unread messages count error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/chats/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Ensure user is accessing their own chats list, or is an admin
        if (req.user.role !== 'admin' && parseInt(req.user.id) !== parseInt(userId)) {
            return res.status(403).json({ error: "Forbidden: Access Denied." });
        }

        const query = `
            SELECT DISTINCT u.id, u.name, u.role, u.profile_pic
            FROM messages m
            JOIN users u ON (u.id = m.sender_id OR u.id = m.receiver_id)
            WHERE (m.sender_id = $1 OR m.receiver_id = $1)
            AND u.id != $1
            AND EXISTS (
                SELECT 1 FROM messages m2 
                WHERE ((m2.sender_id = $1 AND m2.receiver_id = u.id) OR (m2.sender_id = u.id AND m2.receiver_id = $1))
                AND NOT ($1 = ANY(COALESCE(m2.deleted_for, '{}')))
            )
        `;
        const chatHistory = await pool.query(query, [userId]);
        res.status(200).json(chatHistory.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/messages/:user1/:user2', authenticateToken, async (req, res) => {
    try {
        const { user1, user2 } = req.params;

        // Ensure user is either user1 or user2, or is an admin
        const isMe = parseInt(req.user.id) === parseInt(user1) || parseInt(req.user.id) === parseInt(user2);
        if (req.user.role !== 'admin' && !isMe) {
            return res.status(403).json({ error: "Forbidden: Access Denied." });
        }

        const query = `
            SELECT id, sender_id, receiver_id, text AS message, image_url, audio_url, created_at, is_read, reaction 
            FROM messages 
            WHERE ((sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1))
            AND NOT ($1 = ANY(COALESCE(deleted_for, '{}')))
            ORDER BY created_at ASC
        `;
        const result = await pool.query(query, [user1, user2]);
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Send Direct Message Route
router.post('/messages', authenticateToken, async (req, res) => {
    try {
        const { receiver_id, text, image_url, audio_url } = req.body;
        const sender_id = req.user.id;

        if (!receiver_id || (!text && !image_url && !audio_url)) {
            return res.status(400).json({ error: "receiver_id and text, audio_url, or image_url required." });
        }

        const result = await pool.query(
            "INSERT INTO messages (sender_id, receiver_id, text, image_url, audio_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [sender_id, receiver_id, text || null, image_url || null, audio_url || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Send message error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Message Reaction Route (Add/Remove reaction)
router.post('/messages/:id/react', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reaction } = req.body;
        const result = await pool.query(
            "UPDATE messages SET reaction = $1 WHERE id = $2 RETURNING *",
            [reaction || null, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Message not found" });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("React to message error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Clear Chat Messages Route
router.post('/messages/clear', authenticateToken, async (req, res) => {
    try {
        const { target_id } = req.body;
        const my_id = req.user.id;

        if (!target_id) return res.status(400).json({ error: "target_id required." });

        await pool.query(
            `UPDATE messages 
             SET deleted_for = array_append(COALESCE(deleted_for, '{}'), $1) 
             WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
             AND NOT ($1 = ANY(COALESCE(deleted_for, '{}')))`,
            [my_id, target_id]
        );

        res.status(200).json({ message: "Chat cleared successfully." });
    } catch (err) {
        console.error("Clear chat error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── GET CALL HISTORY — AUTH REQUIRED ─────────────────────────
router.get('/call-history/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (req.user.role !== 'admin' && parseInt(req.user.id) !== parseInt(userId)) {
            return res.status(403).json({ error: "Forbidden: Access Denied." });
        }

        const query = `
            SELECT c.*, 
                   caller.name AS caller_name, caller.profile_pic AS caller_pic, caller.role AS caller_role,
                   receiver.name AS receiver_name, receiver.profile_pic AS receiver_pic, receiver.role AS receiver_role
            FROM call_history c
            JOIN users caller ON c.caller_id = caller.id
            JOIN users receiver ON c.receiver_id = receiver.id
            WHERE c.caller_id = $1 OR c.receiver_id = $1
            ORDER BY c.created_at DESC
            LIMIT 50
        `;
        const result = await pool.query(query, [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Get call history error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── RECORD CALL HISTORY ENTRY — AUTH REQUIRED ─────────────────
router.post('/call-history', authenticateToken, async (req, res) => {
    try {
        const { receiver_id, call_type, duration_seconds, status } = req.body;
        const caller_id = req.user.id;

        if (!receiver_id) return res.status(400).json({ error: "receiver_id is required." });

        const result = await pool.query(
            `INSERT INTO call_history (caller_id, receiver_id, call_type, duration_seconds, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [caller_id, receiver_id, call_type || 'voice', duration_seconds || 0, status || 'completed']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Record call history error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
const express = require('express');
const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const { moderateContent } = require('../middleware/contentFilter');

const router = express.Router();

// Helper: Safely extract user ID from optional Authorization header or query
const getOptionalUserId = (req) => {
    if (req.query.currentUserId) {
        const parsed = parseInt(req.query.currentUserId);
        if (!isNaN(parsed)) return parsed;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            if (decoded && decoded.id) return parseInt(decoded.id);
        } catch (e) {
            // Token expired or invalid, ignore
        }
    }
    return null;
};

// ─── 1. GET ALL ACTIVE STORIES (Grouped by User) ─────────────
router.get('/stories', async (req, res) => {
    try {
        const currentUserId = getOptionalUserId(req);

        let query;
        let queryParams = [];

        if (currentUserId) {
            query = `
                SELECT s.id, s.user_id, s.media_url, s.caption, s.created_at, s.expires_at,
                       u.name as user_name, u.username as user_username, u.profile_pic as user_pic, u.role as user_role,
                       (SELECT COUNT(*)::int FROM story_views sv WHERE sv.story_id = s.id) as view_count,
                       EXISTS (SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) as is_seen
                FROM stories s
                JOIN users u ON s.user_id = u.id
                WHERE s.expires_at > NOW()
                  AND u.is_frozen = false
                  AND u.is_platform_blocked = false
                ORDER BY s.created_at ASC
            `;
            queryParams = [currentUserId];
        } else {
            query = `
                SELECT s.id, s.user_id, s.media_url, s.caption, s.created_at, s.expires_at,
                       u.name as user_name, u.username as user_username, u.profile_pic as user_pic, u.role as user_role,
                       (SELECT COUNT(*)::int FROM story_views sv WHERE sv.story_id = s.id) as view_count,
                       false as is_seen
                FROM stories s
                JOIN users u ON s.user_id = u.id
                WHERE s.expires_at > NOW()
                  AND u.is_frozen = false
                  AND u.is_platform_blocked = false
                ORDER BY s.created_at ASC
            `;
        }

        const result = await pool.query(query, queryParams);

        // Group stories by user for Instagram-style story rings
        const storiesByUser = {};
        result.rows.forEach(story => {
            if (!storiesByUser[story.user_id]) {
                storiesByUser[story.user_id] = {
                    user_id: story.user_id,
                    user_name: story.user_name,
                    user_username: story.user_username,
                    user_pic: story.user_pic,
                    user_role: story.user_role,
                    latest_created_at: story.created_at,
                    has_unseen: false,
                    items: []
                };
            }
            storiesByUser[story.user_id].latest_created_at = story.created_at;

            // If user hasn't seen this story item, mark the user group as having unseen stories
            if (!story.is_seen && story.user_id !== currentUserId) {
                storiesByUser[story.user_id].has_unseen = true;
            }

            storiesByUser[story.user_id].items.push({
                id: story.id,
                media_url: story.media_url,
                caption: story.caption,
                created_at: story.created_at,
                expires_at: story.expires_at,
                view_count: story.view_count || 0,
                is_seen: !!story.is_seen
            });
        });

        // Convert dictionary to array sorted:
        // 1. Current user's stories first
        // 2. Unseen stories next
        // 3. Seen stories last
        const formatted = Object.values(storiesByUser).sort((a, b) => {
            if (currentUserId) {
                if (a.user_id === currentUserId) return -1;
                if (b.user_id === currentUserId) return 1;
                if (a.has_unseen && !b.has_unseen) return -1;
                if (!a.has_unseen && b.has_unseen) return 1;
            }
            return new Date(b.latest_created_at) - new Date(a.latest_created_at);
        });

        res.status(200).json(formatted);
    } catch (err) {
        console.error("Get stories error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── 2. POST A NEW STORY (Supports Direct File or URL) ────────
router.post('/stories', authenticateToken, (req, res, next) => {
    upload.single('media')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || "File upload error." });
        }
        next();
    });
}, moderateContent, async (req, res) => {
    try {
        let mediaUrl = req.body.media_url;
        if (req.file && req.file.path) {
            mediaUrl = req.file.path;
        }

        if (!mediaUrl || !mediaUrl.trim()) {
            return res.status(400).json({ error: "Media file or URL is required to post a story." });
        }

        const caption = req.body.caption ? req.body.caption.trim() : null;

        const newStory = await pool.query(
            "INSERT INTO stories (user_id, media_url, caption) VALUES ($1, $2, $3) RETURNING *",
            [req.user.id, mediaUrl.trim(), caption]
        );

        res.status(201).json({
            message: "Story posted successfully! Active for 24 hours.",
            story: newStory.rows[0]
        });
    } catch (err) {
        console.error("Create story error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── 3. MARK STORY AS VIEWED ─────────────────────────────────
router.post('/stories/:storyId/view', authenticateToken, async (req, res) => {
    try {
        const { storyId } = req.params;
        const viewerId = req.user.id;

        // Ensure story exists and hasn't expired
        const storyCheck = await pool.query("SELECT user_id FROM stories WHERE id = $1 AND expires_at > NOW()", [storyId]);
        if (storyCheck.rows.length === 0) {
            return res.status(404).json({ error: "Story not found or expired." });
        }

        // Record view in story_views (ignore if already viewed)
        await pool.query(
            `INSERT INTO story_views (story_id, viewer_id, viewed_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (story_id, viewer_id) DO NOTHING`,
            [storyId, viewerId]
        );

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Record story view error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── 4. GET STORY VIEWERS (Owner or Admin Only) ───────────────
router.get('/stories/:storyId/viewers', authenticateToken, async (req, res) => {
    try {
        const { storyId } = req.params;

        const storyCheck = await pool.query("SELECT user_id FROM stories WHERE id = $1", [storyId]);
        if (storyCheck.rows.length === 0) {
            return res.status(404).json({ error: "Story not found." });
        }

        if (parseInt(storyCheck.rows[0].user_id) !== parseInt(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: You can only see viewers for your own stories." });
        }

        const viewersRes = await pool.query(`
            SELECT sv.id, sv.viewed_at, u.id as viewer_id, u.name, u.username, u.profile_pic, u.role
            FROM story_views sv
            JOIN users u ON sv.viewer_id = u.id
            WHERE sv.story_id = $1
            ORDER BY sv.viewed_at DESC
        `, [storyId]);

        res.status(200).json({
            count: viewersRes.rows.length,
            viewers: viewersRes.rows
        });
    } catch (err) {
        console.error("Get story viewers error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── 5. DELETE A STORY (Auth Required + Ownership) ────────────
router.delete('/stories/:storyId', authenticateToken, async (req, res) => {
    try {
        const { storyId } = req.params;

        const storyCheck = await pool.query("SELECT * FROM stories WHERE id = $1", [storyId]);
        if (storyCheck.rows.length === 0) {
            return res.status(404).json({ error: "Story not found." });
        }

        // Ownership or admin check
        if (parseInt(storyCheck.rows[0].user_id) !== parseInt(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: You can only delete your own stories." });
        }

        await pool.query("DELETE FROM stories WHERE id = $1", [storyId]);
        res.status(200).json({ message: "Story deleted successfully." });
    } catch (err) {
        console.error("Delete story error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;

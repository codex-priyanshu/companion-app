const express = require('express');
const { pool } = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// ─── GET EMERGENCY CONTACTS — AUTH REQUIRED ──────────────────
router.get('/sos/emergency-contacts', authenticateToken, async (req, res) => {
    try {
        const contacts = await pool.query(
            "SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at DESC",
            [req.user.id]
        );
        res.status(200).json(contacts.rows);
    } catch (err) {
        console.error('Get emergency contacts error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── ADD EMERGENCY CONTACT — AUTH REQUIRED ───────────────────
router.post('/sos/emergency-contacts', authenticateToken, async (req, res) => {
    try {
        const { name, phone, email, relationship } = req.body;

        // Validate required fields
        if (!name || !phone) {
            return res.status(400).json({ error: "Name aur phone number required hain." });
        }

        // Validate phone (10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ error: "Phone number 10 digits ka hona chahiye." });
        }

        // Validate email (optional)
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: "Valid email address daalein." });
            }
        }

        // Check max 3 contacts per user
        const countResult = await pool.query(
            "SELECT COUNT(*) FROM emergency_contacts WHERE user_id = $1",
            [req.user.id]
        );
        if (parseInt(countResult.rows[0].count) >= 3) {
            return res.status(400).json({ error: "Maximum 3 emergency contacts allowed hain." });
        }

        const newContact = await pool.query(
            "INSERT INTO emergency_contacts (user_id, name, phone, email, relationship) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [req.user.id, name, phone, email, relationship]
        );
        res.status(201).json(newContact.rows[0]);
    } catch (err) {
        console.error('Add emergency contact error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── DELETE EMERGENCY CONTACT — AUTH REQUIRED + OWNERSHIP ────
router.delete('/sos/emergency-contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const contactResult = await pool.query(
            "SELECT * FROM emergency_contacts WHERE id = $1",
            [id]
        );
        if (contactResult.rows.length === 0) {
            return res.status(404).json({ error: "Emergency contact nahi mila." });
        }

        if (parseInt(contactResult.rows[0].user_id) !== parseInt(req.user.id)) {
            return res.status(403).json({ error: "Forbidden: Sirf apne contacts delete kar sakte ho." });
        }

        await pool.query("DELETE FROM emergency_contacts WHERE id = $1", [id]);
        res.status(200).json({ message: "Emergency contact delete ho gaya." });
    } catch (err) {
        console.error('Delete emergency contact error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── TRIGGER SOS ALERT — AUTH REQUIRED ───────────────────────
router.post('/sos/trigger', authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude, booking_id, message } = req.body;

        // Validate required fields
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: "latitude aur longitude required hain." });
        }

        // Validate coordinates are valid numbers
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: "Valid latitude (-90 to 90) aur longitude (-180 to 180) daalein." });
        }

        // Sanitize optional message
        const safeMessage = message ? message.replace(/<[^>]*>/g, '').trim().slice(0, 500) : null;

        const newAlert = await pool.query(
            "INSERT INTO sos_alerts (user_id, latitude, longitude, booking_id, message) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [req.user.id, lat, lng, booking_id || null, safeMessage]
        );
        res.status(201).json({
            alert_id: newAlert.rows[0].id,
            timestamp: newAlert.rows[0].created_at,
            message: "SOS alert trigger ho gaya. Help on the way."
        });
    } catch (err) {
        console.error('SOS trigger error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── GET SOS ALERT HISTORY — AUTH REQUIRED ───────────────────
router.get('/sos/alerts', authenticateToken, async (req, res) => {
    try {
        const alerts = await pool.query(`
            SELECT * FROM sos_alerts
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.status(200).json(alerts.rows);
    } catch (err) {
        console.error('Get SOS alerts error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── ADMIN: VIEW ALL SOS ALERTS — AUTH + ADMIN REQUIRED ──────
router.get('/sos/admin/alerts', authenticateToken, async (req, res) => {
    try {
        // Admin role check
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: Sirf admin SOS alerts dekh sakta hai." });
        }

        const alerts = await pool.query(`
            SELECT s.*, u.name as user_name, u.email as user_email, u.profile_pic as user_pic
            FROM sos_alerts s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
        `);
        res.status(200).json(alerts.rows);
    } catch (err) {
        console.error('Admin SOS alerts error:', err);
// ─── ADMIN: RESOLVE SOS ALERT — AUTH + ADMIN REQUIRED ────────
router.put('/sos/admin/alerts/:id/resolve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: Admin access required." });
        }
        const { id } = req.params;
        const result = await pool.query(
            "UPDATE sos_alerts SET status = 'resolved', resolved_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "SOS Alert not found." });
        }
        res.status(200).json({ success: true, message: "SOS Alert marked as resolved.", alert: result.rows[0] });
    } catch (err) {
        console.error('Resolve SOS alert error:', err);
        res.status(500).json({ error: "Server error resolving SOS alert." });
    }
});

module.exports = router;

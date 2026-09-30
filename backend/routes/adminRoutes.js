const express = require('express');
const { pool } = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Middleware: Only admins can access these routes
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Admins only." });
    }
    next();
};

// ─── GET ALL USERS — ADMIN ONLY ───────────────────────────────
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await pool.query(`
            SELECT u.id, u.name, u.email, u.phone, u.role, u.kyc_status, u.id_proof_url,
                   u.is_verified, u.is_frozen, u.is_platform_blocked,
                   u.profile_pic, u.city, u.created_at, u.bio, u.price, u.tags, u.dob, u.age,
                   COALESCE((SELECT COUNT(*) FROM reports WHERE reported_id = u.id), 0) as report_count
            FROM users u
            ORDER BY u.id DESC
        `);
        console.log(`✅ Admin users fetched: ${users.rows.length} users`);
        res.status(200).json(users.rows);
    } catch (err) {
        console.error('❌ Admin /admin/users error:', err.message);
        res.status(500).json({ error: "Server error fetching users." });
    }
});

// ─── UPDATE KYC STATUS — ADMIN ONLY ──────────────────────────
router.put('/admin/kyc/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'verified', 'rejected', 'unverified'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid KYC status value." });
        }
        await pool.query("UPDATE users SET kyc_status = $1 WHERE id = $2", [status, req.params.userId]);
        res.status(200).json({ message: `KYC marked as ${status}` });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ─── FREEZE / UNFREEZE ACCOUNT — ADMIN ONLY ──────────────────
router.put('/admin/users/:userId/freeze', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { freeze } = req.body; // true = freeze, false = unfreeze

        if (parseInt(req.user.id) === parseInt(userId)) {
            return res.status(400).json({ error: "You cannot freeze your own account." });
        }

        await pool.query("UPDATE users SET is_frozen = $1 WHERE id = $2", [!!freeze, userId]);
        res.status(200).json({ message: freeze ? "Account frozen." : "Account unfrozen." });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ─── PLATFORM BLOCK / UNBLOCK — ADMIN ONLY ───────────────────
router.put('/admin/users/:userId/platform-block', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { block } = req.body; // true = block, false = unblock

        if (parseInt(req.user.id) === parseInt(userId)) {
            return res.status(400).json({ error: "You cannot block your own account." });
        }

        await pool.query("UPDATE users SET is_platform_blocked = $1 WHERE id = $2", [!!block, userId]);
        res.status(200).json({ message: block ? "User platform-blocked." : "User platform-unblocked." });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ─── GET PLATFORM STATS — ADMIN ONLY ─────────────────────────
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            totalGirls,
            totalBoys,
            pendingKyc,
            totalPosts,
            totalBookings,
            pendingReports,
            frozenUsers,
            activeSos,
            pendingPayouts
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM users"),
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'girl'"),
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'boy'"),
            pool.query("SELECT COUNT(*) FROM users WHERE kyc_status = 'pending'"),
            pool.query("SELECT COUNT(*) FROM posts"),
            pool.query("SELECT COUNT(*) FROM bookings"),
            pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
            pool.query("SELECT COUNT(*) FROM users WHERE is_frozen = true"),
            pool.query("SELECT COUNT(*) FROM sos_alerts WHERE status = 'active'").catch(() => ({ rows: [{ count: 0 }] })),
            pool.query("SELECT COUNT(*) FROM payout_requests WHERE status = 'pending'").catch(() => ({ rows: [{ count: 0 }] }))
        ]);

        res.status(200).json({
            totalUsers: parseInt(totalUsers.rows[0].count) || 0,
            girls: parseInt(totalGirls.rows[0].count) || 0,
            boys: parseInt(totalBoys.rows[0].count) || 0,
            pendingKyc: parseInt(pendingKyc.rows[0].count) || 0,
            posts: parseInt(totalPosts.rows[0].count) || 0,
            bookings: parseInt(totalBookings.rows[0].count) || 0,
            pendingReports: parseInt(pendingReports.rows[0].count) || 0,
            frozenUsers: parseInt(frozenUsers.rows[0].count) || 0,
            activeSosAlerts: parseInt(activeSos.rows[0].count) || 0,
            pendingPayouts: parseInt(pendingPayouts.rows[0].count) || 0,
        });
    } catch (err) {
        console.error("Admin stats error:", err);
        res.status(500).json({ error: "Server error fetching platform statistics." });
    }
});

// ─── GET ALL REPORTS — ADMIN ONLY ────────────────────────────
router.get('/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const reports = await pool.query(`
            SELECT r.id, r.reason, r.description, r.status, r.created_at,
                   rep.id as reporter_id, rep.name as reporter_name, rep.profile_pic as reporter_pic,
                   rep2.id as reported_id, rep2.name as reported_name, rep2.profile_pic as reported_pic, rep2.role as reported_role
            FROM reports r
            LEFT JOIN users rep ON r.reporter_id = rep.id
            LEFT JOIN users rep2 ON r.reported_id = rep2.id
            ORDER BY r.created_at DESC
        `);
        res.status(200).json(reports.rows);
    } catch (err) {
        console.error("Admin reports error:", err);
        res.status(500).json({ error: "Server error fetching user reports." });
    }
});

// ─── UPDATE REPORT STATUS — ADMIN ONLY ───────────────────────
router.put('/admin/reports/:reportId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status } = req.body;
        const validStatuses = ['pending', 'reviewed', 'dismissed'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status value." });

        await pool.query("UPDATE reports SET status = $1 WHERE id = $2", [status, reportId]);
        res.status(200).json({ message: `Report marked as ${status}.` });
    } catch (err) {
        console.error("Admin update report error:", err);
        res.status(500).json({ error: "Server error updating report status." });
    }
});

// ─── CHANGE USER ROLE (MAKE / REVOKE ADMIN) — ADMIN ONLY ─────
router.post('/admin/change-role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, role } = req.body;
        const allowedRoles = ['admin', 'boy', 'girl'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role. Allowed roles: admin, boy, girl." });
        }

        // Prevent self-demotion to avoid losing super admin access
        if (parseInt(req.user.id) === parseInt(userId) && role !== 'admin') {
            return res.status(400).json({ error: "Security restriction: You cannot demote your own administrator account." });
        }

        const result = await pool.query(
            "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role",
            [role, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        console.log(`🛡️ Admin [${req.user.id}] changed role of user [${userId}] to [${role}]`);
        res.status(200).json({
            message: `Role of ${result.rows[0].name} updated to ${role}.`,
            user: result.rows[0]
        });
    } catch (err) {
        console.error("Change role error:", err);
        res.status(500).json({ error: "Server error updating user role." });
    }
});

// Backward compatible endpoint for make-admin
router.post('/admin/make-admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email required." });
        const result = await pool.query(
            "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, name, email, role",
            [email.toLowerCase().trim()]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ message: `${result.rows[0].name} is now an admin!`, user: result.rows[0] });
        } else {
            res.status(404).json({ error: `User with email ${email} not found.` });
        }
    } catch (err) {
        console.error("Make admin error:", err);
        res.status(500).json({ error: "Error making user an admin." });
    }
});

// ─── SAFE DELETE USER — ATOMIC TRANSACTION & ADMIN PROTECTION ─
router.delete('/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    const { userId } = req.params;

    // 1. Prevent self-deletion
    if (parseInt(req.user.id) === parseInt(userId)) {
        return res.status(400).json({ error: "Security restriction: You cannot delete your own account from the admin dashboard." });
    }

    // 2. Fetch target user to check if they are an admin
    const userCheck = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: "User does not exist." });
    }

    const targetUser = userCheck.rows[0];
    if (targetUser.role === 'admin') {
        return res.status(403).json({ error: "Security Alert: Cannot delete another Administrator account. Demote their role first." });
    }

    // 3. Perform atomic cleanup within a database transaction
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete interactions & dependents
        await client.query("DELETE FROM likes WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM comments WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM saved_posts WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM story_views WHERE viewer_id = $1", [userId]);
        await client.query("DELETE FROM stories WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM push_subscriptions WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM favorites WHERE user_id = $1 OR companion_id = $1", [userId]);
        await client.query("DELETE FROM follows WHERE follower_id = $1 OR following_id = $1", [userId]);
        await client.query("DELETE FROM call_history WHERE caller_id = $1 OR receiver_id = $1", [userId]);
        await client.query("DELETE FROM blocked_users WHERE blocker_id = $1 OR blocked_id = $1", [userId]);
        await client.query("DELETE FROM emergency_contacts WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM sos_alerts WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM wallet_transactions WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM payout_requests WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM wallet_balances WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM reports WHERE reporter_id = $1 OR reported_id = $1", [userId]);
        await client.query("DELETE FROM notifications WHERE user_id = $1 OR sender_id = $1", [userId]);
        await client.query("DELETE FROM reviews WHERE reviewer_id = $1 OR companion_id = $1", [userId]);
        await client.query("DELETE FROM bookings WHERE boy_id = $1 OR girl_id = $1", [userId]);
        await client.query("DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1", [userId]);
        await client.query("DELETE FROM posts WHERE user_id = $1", [userId]);

        // Finally delete the user
        await client.query("DELETE FROM users WHERE id = $1", [userId]);

        await client.query('COMMIT');
        console.log(`🗑️ Admin [${req.user.id}] safely deleted user [${userId}] (${targetUser.name})`);
        res.status(200).json({ success: true, message: `User "${targetUser.name}" has been permanently removed.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Safe user deletion error:', err);
        res.status(500).json({ error: "Failed to delete user safely. Database rolled back." });
    } finally {
        client.release();
    }
});

module.exports = router;
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
require('dotenv').config();

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access Denied. No token." });

    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, user) => {
        if (err || !user || !user.id) return res.status(403).json({ error: "Invalid or expired token. Please login again." });

        try {
            // Check if account is frozen or platform-blocked by admin
            const result = await pool.query(
                "SELECT is_frozen, is_platform_blocked, role FROM users WHERE id = $1",
                [user.id]
            );
            if (result.rows.length === 0) {
                return res.status(403).json({ error: "Account not found." });
            }
            const dbUser = result.rows[0];
            if (dbUser.is_frozen) {
                return res.status(403).json({ error: "Your account has been frozen. Please contact support." });
            }
            if (dbUser.is_platform_blocked && dbUser.role !== 'admin') {
                return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
            }
            if (dbUser.role) {
                user.role = dbUser.role; // Real-time DB sync: prevents revoked admins from using stale tokens
            }
        } catch (dbErr) {
            // If DB check fails, still allow (don't block legit users on DB error)
            console.error("Auth DB check error:", dbErr.message);
        }

        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
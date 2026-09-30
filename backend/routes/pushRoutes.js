const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { pool } = require('../config/db');
const { webpush, vapidPublicKey } = require('../config/vapid');

// 1. Get VAPID Public Key (Public Endpoint)
router.get('/push/vapid-key', (req, res) => {
    res.status(200).json({ publicKey: vapidPublicKey });
});

// 2. Subscribe to Push Notifications
router.post('/push/subscribe', authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: "Invalid subscription payload." });
        }

        const { endpoint, keys } = subscription;
        const { p256dh, auth } = keys;

        await pool.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, endpoint) 
             DO UPDATE SET keys_p256dh = EXCLUDED.keys_p256dh, keys_auth = EXCLUDED.keys_auth`,
            [req.user.id, endpoint, p256dh, auth]
        );

        res.status(200).json({ message: "Push notification subscription saved." });
    } catch (err) {
        console.error("Push subscribe error:", err);
        res.status(500).json({ error: "Failed to save push subscription." });
    }
});

// 3. Unsubscribe from Push Notifications
router.post('/push/unsubscribe', authenticateToken, async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: "Endpoint required." });

        await pool.query(
            "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
            [req.user.id, endpoint]
        );

        res.status(200).json({ message: "Unsubscribed successfully." });
    } catch (err) {
        console.error("Push unsubscribe error:", err);
        res.status(500).json({ error: "Failed to unsubscribe." });
    }
});

/**
 * Utility Function: Send Push Notification to a Specific User
 * @param {number|string} targetUserId 
 * @param {object} payload { title, body, icon, url, tag }
 */
const sendPushNotification = async (targetUserId, payload) => {
    try {
        const result = await pool.query(
            "SELECT id, endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = $1",
            [targetUserId]
        );

        if (result.rows.length === 0) return;

        const notificationData = JSON.stringify({
            title: payload.title || "Coffeely Notification",
            body: payload.body || "You have a new update.",
            icon: payload.icon || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
            badge: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
            url: payload.url || "/",
            tag: payload.tag || "coffeely_notification",
            timestamp: Date.now()
        });

        for (const row of result.rows) {
            const pushSubscription = {
                endpoint: row.endpoint,
                keys: {
                    p256dh: row.keys_p256dh,
                    auth: row.keys_auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, notificationData);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription has expired or is invalid — remove from DB
                    await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [row.id]);
                } else {
                    console.error(`WebPush error for user ${targetUserId}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error("sendPushNotification error:", err);
    }
};

module.exports = {
    router,
    sendPushNotification
};

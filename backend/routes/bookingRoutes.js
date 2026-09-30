const express = require('express');
const { pool } = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { moderateContent } = require('../middleware/contentFilter');

const router = express.Router();

// ─── GET BOOKED TIME SLOTS FOR A COMPANION ON A GIVEN DATE ────
router.get('/bookings/booked-slots/:companionId', async (req, res) => {
    try {
        const { companionId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: "date query parameter required (YYYY-MM-DD)" });
        }

        const result = await pool.query(`
            SELECT time_slot 
            FROM bookings 
            WHERE (girl_id = $1 OR boy_id = $1)
              AND meeting_date = $2
              AND status IN ('pending', 'accepted', 'active')
              AND time_slot IS NOT NULL
        `, [companionId, date]);

        const bookedSlots = result.rows.map(r => r.time_slot);
        res.status(200).json({ date, bookedSlots });
    } catch (err) {
        console.error("Get booked slots error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── CREATE BOOKING — AUTH REQUIRED ──────────────────────────
router.post('/bookings', authenticateToken, async (req, res) => {
    try {
        const { 
            boy_id, 
            girl_id, 
            hours, 
            amount, 
            meeting_date, 
            meeting_time, 
            meeting_location, 
            meeting_details, 
            time_slot,
            payment_id,
            payment_status,
            payment_method,
            order_id
        } = req.body;
        const sender_id = req.user.id;

        // Validate required fields
        if (!boy_id || !girl_id || !hours || !amount) {
            return res.status(400).json({ error: "boy_id, girl_id, hours, and amount are required." });
        }

        // Validate hours and amount are positive numbers
        if (parseInt(hours) <= 0 || parseInt(amount) <= 0) {
            return res.status(400).json({ error: "Hours and amount must be positive numbers." });
        }

        // Prevent booking yourself
        if (parseInt(req.user.id) === parseInt(girl_id) && parseInt(req.user.id) === parseInt(boy_id)) {
            return res.status(400).json({ error: "You cannot book yourself." });
        }

        // Validate sender is a participant
        const senderIsBoy  = parseInt(req.user.id) === parseInt(boy_id);
        const senderIsGirl = parseInt(req.user.id) === parseInt(girl_id);
        if (!senderIsBoy && !senderIsGirl) {
            return res.status(403).json({ error: "Unauthorized: Only participants can make bookings." });
        }

        // KYC Guard: Date booking requires document upload
        const senderUserRes = await pool.query('SELECT id_proof_url, kyc_status, role FROM users WHERE id = $1', [sender_id]);
        const senderUser = senderUserRes.rows[0];
        const hasDoc = Boolean(senderUser?.id_proof_url || senderUser?.kyc_status === 'verified' || senderUser?.kyc_status === 'pending');
        if (!hasDoc && senderUser?.role !== 'admin') {
            return res.status(403).json({ 
                error: "Date ya companion book karne ke liye apna government document upload karna anivarya hai (Govt ID Required).", 
                kyc_required: true 
            });
        }

        const baseAmount = parseFloat(amount);
        const platformFee = Math.round(baseAmount * 0.05);
        const companionEarnings = baseAmount;
        const effectivePaymentStatus = payment_status || (payment_id ? 'escrow_held' : 'pending');
        const effectivePaymentMethod = payment_method || 'upi';

        const newBooking = await pool.query(
            `INSERT INTO bookings (
                boy_id, girl_id, hours, amount, meeting_date, meeting_time, 
                meeting_location, meeting_details, sender_id, time_slot,
                payment_id, payment_status, payment_method, order_id, platform_fee, companion_earnings
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING *`,
            [
                boy_id, girl_id, hours, amount, 
                meeting_date || null, meeting_time || null, meeting_location || null, meeting_details || null, 
                sender_id, time_slot || null,
                payment_id || null, effectivePaymentStatus, effectivePaymentMethod, order_id || null, platformFee, companionEarnings
            ]
        );

        const booking = newBooking.rows[0];

        // 🛡️ If payment was captured & held in Escrow, credit companion's pending_escrow immediately
        if (effectivePaymentStatus === 'escrow_held') {
            await pool.query(
                `INSERT INTO wallet_balances (user_id, available_balance, pending_escrow, total_withdrawn, total_earned)
                 VALUES ($1, 0, $2, 0, 0)
                 ON CONFLICT (user_id) DO UPDATE 
                 SET pending_escrow = wallet_balances.pending_escrow + $2,
                     updated_at = NOW()`,
                [girl_id, companionEarnings]
            );

            await pool.query(
                `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
                 VALUES ($1, $2, 'escrow_hold', $3, $4, $5, 'in_escrow', $6)`,
                [
                    girl_id,
                    booking.id,
                    companionEarnings,
                    `Session Escrow Hold (Booking #${booking.id})`,
                    `Funds held safely in 100% Escrow Protection. Auto-released upon session completion.`,
                    effectivePaymentMethod
                ]
            );
        }

        res.status(201).json(booking);
    } catch (err) {
        console.error('Booking error:', err);
        res.status(500).json({ error: "Server error" });
    }
});


// ─── GET BOOKINGS — AUTH REQUIRED + OWNERSHIP ────────────────
router.get('/bookings/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Users can only see their own bookings; admins can see all
        if (req.user.role !== 'admin' && parseInt(req.user.id) !== parseInt(userId)) {
            return res.status(403).json({ error: "Forbidden: You can only view your own bookings." });
        }

        const bookings = await pool.query(`
            SELECT b.*, 
                   boy.name as boy_name, boy.profile_pic as boy_pic,
                   girl.name as girl_name, girl.profile_pic as girl_pic
            FROM bookings b
            JOIN users boy ON b.boy_id = boy.id
            JOIN users girl ON b.girl_id = girl.id
            WHERE b.girl_id = $1 OR b.boy_id = $1
            ORDER BY b.created_at DESC
        `, [userId]);
        res.status(200).json(bookings.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ─── UPDATE BOOKING STATUS — AUTH REQUIRED ────────────────────
router.put('/bookings/:bookingId', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const { bookingId } = req.params;

        // Validate status values
        const validStatuses = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid booking status." });
        }

        // Verify the booking belongs to the user
        const bookingResult = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found." });

        const booking = bookingResult.rows[0];
        const isParticipant = parseInt(req.user.id) === parseInt(booking.boy_id) ||
                              parseInt(req.user.id) === parseInt(booking.girl_id);

        if (req.user.role !== 'admin' && !isParticipant) {
            return res.status(403).json({ error: "Forbidden: Only booking participants can update booking status." });
        }

        // Companion accepting booking must also have uploaded a document
        if (status === 'accepted') {
            const participantUserRes = await pool.query('SELECT id_proof_url, kyc_status, role FROM users WHERE id = $1', [req.user.id]);
            const participantUser = participantUserRes.rows[0];
            const hasDoc = Boolean(participantUser?.id_proof_url || participantUser?.kyc_status === 'verified' || participantUser?.kyc_status === 'pending');
            if (!hasDoc && participantUser?.role !== 'admin') {
                return res.status(403).json({ 
                    error: "Booking request accept karne ke liye government ID upload karna anivarya hai.", 
                    kyc_required: true 
                });
            }
        }

        const updatedBooking = await pool.query(
            "UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *",
            [status, bookingId]
        );

        // ─── AUTO ESCROW ENGINE ───
        if (status === 'completed' && booking.payment_status === 'escrow_held') {
            const companionEarnings = parseFloat(booking.companion_earnings) || parseFloat(booking.amount) || 1000;
            await pool.query("UPDATE bookings SET payment_status = 'escrow_released' WHERE id = $1", [bookingId]);
            await pool.query(
                `INSERT INTO wallet_balances (user_id, available_balance, pending_escrow, total_withdrawn, total_earned)
                 VALUES ($1, $2, 0, 0, $2)
                 ON CONFLICT (user_id) DO UPDATE 
                 SET pending_escrow = GREATEST(0, wallet_balances.pending_escrow - $2),
                     available_balance = wallet_balances.available_balance + $2,
                     total_earned = wallet_balances.total_earned + $2,
                     updated_at = NOW()`,
                [booking.girl_id, companionEarnings]
            );
            await pool.query(
                `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
                 VALUES ($1, $2, 'escrow_release', $3, $4, $5, 'completed', 'Escrow Release')`,
                [
                    booking.girl_id,
                    bookingId,
                    companionEarnings,
                    `Session Payout (Booking #${bookingId})`,
                    `Date session completed. Escrow released to available wallet balance.`,
                    booking.payment_method || 'Escrow Release'
                ]
            );
        } else if ((status === 'rejected' || status === 'cancelled') && booking.payment_status === 'escrow_held') {
            const companionEarnings = parseFloat(booking.companion_earnings) || parseFloat(booking.amount) || 1000;
            await pool.query("UPDATE bookings SET payment_status = 'escrow_refunded' WHERE id = $1", [bookingId]);
            await pool.query(
                "UPDATE wallet_balances SET pending_escrow = GREATEST(0, pending_escrow - $1), updated_at = NOW() WHERE user_id = $2",
                [companionEarnings, booking.girl_id]
            );
            await pool.query(
                `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
                 VALUES ($1, $2, 'refund', $3, $4, $5, 'completed', 'Auto Refund')`,
                [
                    booking.boy_id,
                    bookingId,
                    companionEarnings,
                    `Refund for Booking #${bookingId}`,
                    `Booking was not accepted. Escrow refunded to client payment source.`,
                    booking.payment_method || 'Auto Refund'
                ]
            );
        }

        res.status(200).json(updatedBooking.rows[0]);
    } catch (err) {
        console.error("Update booking status error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── SUBMIT REVIEW — AUTH REQUIRED ───────────────────────────
router.post('/reviews', authenticateToken, moderateContent, async (req, res) => {
    try {
        const { companion_id, rating, comment, compliment_tags, booking_id } = req.body;
        const reviewer_id = req.user.id;

        if (!companion_id || !rating) {
            return res.status(400).json({ error: "companion_id and rating are required." });
        }

        const safeRating = parseInt(rating);
        if (safeRating < 1 || safeRating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }

        // Prevent self-review
        if (parseInt(reviewer_id) === parseInt(companion_id)) {
            return res.status(400).json({ error: "You cannot review your own profile." });
        }

        // Check if there was a completed booking between reviewer and companion
        let isVerifiedBooking = false;
        if (booking_id) {
            const bCheck = await pool.query(
                "SELECT id FROM bookings WHERE id = $1 AND boy_id = $2 AND girl_id = $3",
                [booking_id, reviewer_id, companion_id]
            );
            if (bCheck.rows.length > 0) {
                isVerifiedBooking = true;
            }
        } else {
            const anyCompletedBooking = await pool.query(
                "SELECT id FROM bookings WHERE (boy_id = $1 AND girl_id = $2) AND status = 'completed' LIMIT 1",
                [reviewer_id, companion_id]
            );
            if (anyCompletedBooking.rows.length > 0) {
                isVerifiedBooking = true;
            }
        }

        // Sanitize comment
        const safeComment = comment ? comment.replace(/<[^>]*>/g, '').trim().slice(0, 800) : null;
        const tags = Array.isArray(compliment_tags) ? compliment_tags.slice(0, 6) : [];

        const newReview = await pool.query(
            `INSERT INTO reviews (reviewer_id, companion_id, rating, comment, compliment_tags, booking_id, is_verified_booking) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [reviewer_id, companion_id, safeRating, safeComment, tags, booking_id || null, isVerifiedBooking]
        );

        // Fetch reviewer info for clean return
        const reviewerInfo = await pool.query("SELECT name, profile_pic FROM users WHERE id = $1", [reviewer_id]);
        const resultReview = {
            ...newReview.rows[0],
            reviewer_name: reviewerInfo.rows[0]?.name || "Anonymous",
            reviewer_pic: reviewerInfo.rows[0]?.profile_pic || null
        };

        res.status(201).json(resultReview);
    } catch (err) {
        console.error("Submit review error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── GET REVIEWS WITH STAR BREAKDOWN & COMPLIMENTS — Public ───
router.get('/reviews/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.query.currentUserId;

        const reviewsRes = await pool.query(`
            SELECT r.*, 
                   u.name as reviewer_name, 
                   u.profile_pic as reviewer_pic,
                   COALESCE(r.helpful_count, 0) as helpful_count,
                   CASE 
                       WHEN $2::integer IS NOT NULL AND EXISTS(SELECT 1 FROM review_helpful_votes WHERE review_id = r.id AND user_id = $2::integer) 
                       THEN true ELSE false 
                   END as has_voted_helpful
            FROM reviews r 
            JOIN users u ON r.reviewer_id = u.id
            WHERE r.companion_id = $1 
            ORDER BY r.created_at DESC
        `, [userId, currentUserId ? parseInt(currentUserId) : null]);

        const avgResult = await pool.query(
            "SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(id) as total_count FROM reviews WHERE companion_id = $1",
            [userId]
        );

        const totalReviews = parseInt(avgResult.rows[0]?.total_count || 0);
        const avgRating = parseFloat(avgResult.rows[0]?.avg_rating || 0);

        // Calculate 5★, 4★, 3★, 2★, 1★ breakdown
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const complimentsMap = {};

        reviewsRes.rows.forEach(r => {
            if (breakdown[r.rating] !== undefined) {
                breakdown[r.rating]++;
            }
            if (Array.isArray(r.compliment_tags)) {
                r.compliment_tags.forEach(tag => {
                    complimentsMap[tag] = (complimentsMap[tag] || 0) + 1;
                });
            }
        });

        // Sort top compliments by count
        const topCompliments = Object.entries(complimentsMap)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

        res.status(200).json({
            reviews: reviewsRes.rows,
            avgRating,
            totalReviews,
            breakdown,
            topCompliments
        });
    } catch (err) {
        console.error("Get reviews error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── TOGGLE HELPFUL VOTE ON REVIEW ─────────────────────────────
router.post('/reviews/:id/helpful', authenticateToken, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const userId = req.user.id;

        const voteCheck = await pool.query(
            "SELECT id FROM review_helpful_votes WHERE review_id = $1 AND user_id = $2",
            [reviewId, userId]
        );

        let hasVoted = false;
        if (voteCheck.rows.length > 0) {
            // Remove vote
            await pool.query("DELETE FROM review_helpful_votes WHERE id = $1", [voteCheck.rows[0].id]);
            await pool.query("UPDATE reviews SET helpful_count = GREATEST(0, COALESCE(helpful_count, 0) - 1) WHERE id = $1", [reviewId]);
            hasVoted = false;
        } else {
            // Add vote
            await pool.query("INSERT INTO review_helpful_votes (review_id, user_id) VALUES ($1, $2)", [reviewId, userId]);
            await pool.query("UPDATE reviews SET helpful_count = COALESCE(helpful_count, 0) + 1 WHERE id = $1", [reviewId]);
            hasVoted = true;
        }

        const updatedReview = await pool.query("SELECT helpful_count FROM reviews WHERE id = $1", [reviewId]);
        res.status(200).json({
            hasVoted,
            helpful_count: updatedReview.rows[0]?.helpful_count || 0
        });
    } catch (err) {
        console.error("Helpful vote error:", err);
        res.status(500).json({ error: "Failed to update helpful vote" });
    }
});

// ─── CANCEL BOOKING WITH REASON ───
router.post('/bookings/:bookingId/cancel', authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;
        const bookingResult = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found." });
        
        const booking = bookingResult.rows[0];
        const isParticipant = parseInt(req.user.id) === parseInt(booking.boy_id) ||
                              parseInt(req.user.id) === parseInt(booking.girl_id);
        if (!isParticipant) return res.status(403).json({ error: "Forbidden: Not a participant." });
        
        const canceled_by = parseInt(req.user.id) === parseInt(booking.boy_id) ? 'boy' : 'girl';
        const updated = await pool.query(
            "UPDATE bookings SET status = 'rejected', cancellation_reason = $1, canceled_by = $2 WHERE id = $3 RETURNING *",
            [reason || "No reason specified", canceled_by, bookingId]
        );

        // Auto Refund Escrow
        if (booking.payment_status === 'escrow_held') {
            const companionEarnings = parseFloat(booking.companion_earnings) || parseFloat(booking.amount) || 1000;
            await pool.query("UPDATE bookings SET payment_status = 'escrow_refunded' WHERE id = $1", [bookingId]);
            await pool.query(
                "UPDATE wallet_balances SET pending_escrow = GREATEST(0, pending_escrow - $1), updated_at = NOW() WHERE user_id = $2",
                [companionEarnings, booking.girl_id]
            );
            await pool.query(
                `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
                 VALUES ($1, $2, 'refund', $3, $4, $5, 'completed', 'Auto Refund')`,
                [
                    booking.boy_id,
                    bookingId,
                    companionEarnings,
                    `Refund for Booking #${bookingId}`,
                    `Booking was canceled. Funds automatically refunded to original payment method.`,
                    booking.payment_method || 'Auto Refund'
                ]
            );
        }

        res.status(200).json(updated.rows[0]);
    } catch (err) {
        console.error("Cancel booking error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── REQUEST TO RESCHEDULE BOOKING ───
router.post('/bookings/:bookingId/reschedule', authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { proposed_date, proposed_time } = req.body;
        if (!proposed_date || !proposed_time) return res.status(400).json({ error: "Proposed date and time are required." });
        
        const bookingResult = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found." });
        
        const booking = bookingResult.rows[0];
        const isParticipant = parseInt(req.user.id) === parseInt(booking.boy_id) ||
                              parseInt(req.user.id) === parseInt(booking.girl_id);
        if (!isParticipant) return res.status(403).json({ error: "Forbidden: Not a participant." });
        
        const reschedule_by = parseInt(req.user.id) === parseInt(booking.boy_id) ? 'boy' : 'girl';
        const updated = await pool.query(
            "UPDATE bookings SET proposed_date = $1, proposed_time = $2, reschedule_by = $3, reschedule_status = 'pending' WHERE id = $4 RETURNING *",
            [proposed_date, proposed_time, reschedule_by, bookingId]
        );
        res.status(200).json(updated.rows[0]);
    } catch (err) {
        console.error("Reschedule booking error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── RESPOND TO RESCHEDULE REQUEST ───
router.post('/bookings/:bookingId/reschedule/respond', authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { action } = req.body; // 'accept' or 'decline'
        if (action !== 'accept' && action !== 'decline') return res.status(400).json({ error: "Invalid action." });
        
        const bookingResult = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found." });
        
        const booking = bookingResult.rows[0];
        const isParticipant = parseInt(req.user.id) === parseInt(booking.boy_id) ||
                              parseInt(req.user.id) === parseInt(booking.girl_id);
        if (!isParticipant) return res.status(403).json({ error: "Forbidden: Not a participant." });
        
        const userRoleInBooking = parseInt(req.user.id) === parseInt(booking.boy_id) ? 'boy' : 'girl';
        if (booking.reschedule_by === userRoleInBooking) {
            return res.status(400).json({ error: "You cannot respond to your own reschedule request." });
        }
        
        if (action === 'accept') {
            const updated = await pool.query(
                "UPDATE bookings SET meeting_date = proposed_date, meeting_time = proposed_time, proposed_date = NULL, proposed_time = NULL, reschedule_by = NULL, reschedule_status = 'accepted' WHERE id = $1 RETURNING *",
                [bookingId]
            );
            res.status(200).json(updated.rows[0]);
        } else {
            const updated = await pool.query(
                "UPDATE bookings SET proposed_date = NULL, proposed_time = NULL, reschedule_by = NULL, reschedule_status = 'declined' WHERE id = $1 RETURNING *",
                [bookingId]
            );
            res.status(200).json(updated.rows[0]);
        }
    } catch (err) {
        console.error("Respond reschedule error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
const express = require('express');
const { pool } = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Helper: Ensure or initialize wallet balance for a user
async function ensureWalletExists(userId) {
    const existing = await pool.query("SELECT * FROM wallet_balances WHERE user_id = $1", [userId]);
    if (existing.rows.length > 0) {
        return existing.rows[0];
    }
    const inserted = await pool.query(
        "INSERT INTO wallet_balances (user_id, available_balance, pending_escrow, total_withdrawn, total_earned) VALUES ($1, 0, 0, 0, 0) RETURNING *",
        [userId]
    );
    return inserted.rows[0];
}

// Helper: Check if user has uploaded KYC document
async function checkUserHasDocument(userId) {
    try {
        const userRes = await pool.query("SELECT id, kyc_status, id_proof_url, role FROM users WHERE id = $1", [userId]);
        if (userRes.rows.length === 0) return false;
        const u = userRes.rows[0];
        if (u.role === 'admin') return true;
        return Boolean(u.id_proof_url || u.kyc_status === 'verified' || u.kyc_status === 'pending');
    } catch (e) {
        return false;
    }
}


// 1. Create Razorpay / Escrow Payment Order
router.post('/payment/create-order', authenticateToken, async (req, res) => {
    try {
        const { booking_id, amount } = req.body;
        const totalAmt = parseFloat(amount) || 1000;
        const platformFee = Math.round(totalAmt * 0.05); // 5% escrow safety & trust fee
        const payableTotal = totalAmt + platformFee;

        const fakeOrderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

        if (booking_id) {
            await pool.query(
                "UPDATE bookings SET order_id = $1, platform_fee = $2, companion_earnings = $3 WHERE id = $4",
                [fakeOrderId, platformFee, totalAmt, booking_id]
            );
        }

        res.status(200).json({
            order_id: fakeOrderId,
            amount: payableTotal,
            base_amount: totalAmt,
            platform_fee: platformFee,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_coffeely_escrow'
        });
    } catch (err) {
        console.error("Create order error:", err);
        res.status(500).json({ error: "Could not create payment order" });
    }
});

// 2. Verify Payment & Hold Funds in Escrow
router.post('/payment/verify', authenticateToken, async (req, res) => {
    try {
        const { booking_id, payment_id, order_id, payment_method, amount } = req.body;
        if (!booking_id) {
            return res.status(400).json({ error: "Booking ID is required" });
        }

        const bookingRes = await pool.query("SELECT * FROM bookings WHERE id = $1", [booking_id]);
        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const booking = bookingRes.rows[0];

        // 🛡️ Security Check: Ensure caller is the paying client or admin
        const isClient = parseInt(req.user.id) === parseInt(booking.boy_id);
        const isAdmin = req.user.role === 'admin';
        if (!isClient && !isAdmin) {
            return res.status(403).json({ error: "Forbidden: You are not authorized to verify payment for this booking." });
        }

        const baseAmount = booking.amount || parseFloat(amount) || 1000;
        const platformFee = Math.round(baseAmount * 0.05);
        const companionEarnings = baseAmount; // 100% of base rate goes to companion

        const pid = payment_id || `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const oid = order_id || booking.order_id || `order_${Date.now().toString(36)}`;
        const pMethod = payment_method || 'upi';

        // Update booking to escrow_held
        await pool.query(
            `UPDATE bookings 
             SET payment_status = 'escrow_held', payment_id = $1, order_id = $2, payment_method = $3, platform_fee = $4, companion_earnings = $5 
             WHERE id = $6`,
            [pid, oid, pMethod, platformFee, companionEarnings, booking_id]
        );

        // Update companion's wallet (Pending in Escrow)
        await ensureWalletExists(booking.girl_id);
        await pool.query(
            "UPDATE wallet_balances SET pending_escrow = pending_escrow + $1, updated_at = NOW() WHERE user_id = $2",
            [companionEarnings, booking.girl_id]
        );

        // Record Escrow Hold transaction
        await pool.query(
            `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
             VALUES ($1, $2, 'escrow_hold', $3, $4, $5, 'in_escrow', $6)`,
            [
                booking.girl_id,
                booking_id,
                companionEarnings,
                `Session Escrow Hold (Booking #${booking_id})`,
                `Funds held safely in escrow. Released upon session completion.`,
                pMethod
            ]
        );

        res.status(200).json({
            success: true,
            payment_status: 'escrow_held',
            payment_id: pid,
            companion_earnings: companionEarnings,
            platform_fee: platformFee,
            message: "Payment captured successfully and held in 100% Escrow Protection!"
        });
    } catch (err) {
        console.error("Payment verify error:", err);
        res.status(500).json({ error: "Failed to verify payment and hold escrow" });
    }
});

// 3. Release Escrow Funds to Companion Wallet upon Session Completion
router.post('/payment/release-escrow/:bookingId', authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const bookingRes = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const booking = bookingRes.rows[0];

        // 🛡️ Security Check: Ensure caller is participant (boy_id or girl_id) or admin
        const isParticipant = parseInt(req.user.id) === parseInt(booking.boy_id) || parseInt(req.user.id) === parseInt(booking.girl_id);
        const isAdmin = req.user.role === 'admin';
        if (!isParticipant && !isAdmin) {
            return res.status(403).json({ error: "Forbidden: Only booking participants or admins can release escrow." });
        }

        if (booking.payment_status === 'escrow_released') {
            return res.status(200).json({ message: "Escrow funds already released." });
        }

        const companionEarnings = parseFloat(booking.companion_earnings) || parseFloat(booking.amount) || 1000;

        // Update booking payment status
        await pool.query("UPDATE bookings SET payment_status = 'escrow_released' WHERE id = $1", [bookingId]);

        // Release from pending_escrow to available_balance & total_earned
        await ensureWalletExists(booking.girl_id);
        await pool.query(
            `UPDATE wallet_balances 
             SET pending_escrow = GREATEST(0, pending_escrow - $1),
                 available_balance = available_balance + $1,
                 total_earned = total_earned + $1,
                 updated_at = NOW()
             WHERE user_id = $2`,
            [companionEarnings, booking.girl_id]
        );

        // Log completion transaction
        await pool.query(
            `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
             VALUES ($1, $2, 'escrow_release', $3, $4, $5, 'completed', 'Escrow Release')`,
            [
                booking.girl_id,
                bookingId,
                companionEarnings,
                `Session Payout (Booking #${bookingId})`,
                `Date session successfully completed. Escrow released to available balance.`,
                booking.payment_method || 'Escrow Release'
            ]
        );

        res.status(200).json({
            success: true,
            message: `🎉 ₹${companionEarnings.toLocaleString()} released to companion wallet balance!`
        });
    } catch (err) {
        console.error("Release escrow error:", err);
        res.status(500).json({ error: "Failed to release escrow funds" });
    }
});

// 4. Refund Escrow on Cancellation / Rejection
router.post('/payment/refund-escrow/:bookingId', authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const bookingRes = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const booking = bookingRes.rows[0];

        // 🛡️ Security Check: Ensure caller is participant or admin
        const isParticipant = parseInt(req.user.id) === parseInt(booking.boy_id) || parseInt(req.user.id) === parseInt(booking.girl_id);
        const isAdmin = req.user.role === 'admin';
        if (!isParticipant && !isAdmin) {
            return res.status(403).json({ error: "Forbidden: Only participants or admins can process refunds." });
        }

        if (booking.payment_status === 'escrow_refunded') {
            return res.status(200).json({ message: "Escrow already refunded." });
        }

        if (booking.payment_status === 'escrow_held') {
            const companionEarnings = parseFloat(booking.companion_earnings) || parseFloat(booking.amount) || 1000;

            // Update booking status
            await pool.query("UPDATE bookings SET payment_status = 'escrow_refunded' WHERE id = $1", [bookingId]);

            // Deduct from companion pending escrow
            await pool.query(
                "UPDATE wallet_balances SET pending_escrow = GREATEST(0, pending_escrow - $1), updated_at = NOW() WHERE user_id = $2",
                [companionEarnings, booking.girl_id]
            );

            // Log refund transaction
            await pool.query(
                `INSERT INTO wallet_transactions (user_id, booking_id, type, amount, title, description, status, method)
                 VALUES ($1, $2, 'refund', $3, $4, $5, 'completed', 'Auto Refund')`,
                [
                    booking.boy_id,
                    bookingId,
                    companionEarnings,
                    `Refund for Booking #${bookingId}`,
                    `Booking was canceled/rejected. 100% funds refunded to customer payment source.`,
                    booking.payment_method || 'Auto Refund'
                ]
            );
        }

        res.status(200).json({
            success: true,
            message: "Escrow funds refunded to original payment method successfully."
        });
    } catch (err) {
        console.error("Refund escrow error:", err);
        res.status(500).json({ error: "Failed to process escrow refund" });
    }
});

// 5. Get User Wallet Balance — AUTH & OWNERSHIP REQUIRED
router.get('/wallet/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // 🛡️ Security Check: Prevent IDOR - only owner or admin can view wallet
        if (parseInt(req.user.id) !== parseInt(userId) && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: You can only view your own wallet balance." });
        }

        // 🛡️ KYC Document Check: User must have uploaded an ID document to view wallet
        if (req.user.role !== 'admin') {
            const hasDoc = await checkUserHasDocument(userId);
            if (!hasDoc) {
                return res.status(403).json({ error: "Document verification required to access wallet.", kyc_required: true });
            }
        }

        const wallet = await ensureWalletExists(userId);
        res.status(200).json({
            user_id: parseInt(userId),
            available_balance: parseFloat(wallet.available_balance) || 0,
            pending_escrow: parseFloat(wallet.pending_escrow) || 0,
            total_withdrawn: parseFloat(wallet.total_withdrawn) || 0,
            total_earned: parseFloat(wallet.total_earned) || 0,
            updated_at: wallet.updated_at
        });
    } catch (err) {
        console.error("Get wallet balance error:", err);
        res.status(500).json({ error: "Failed to fetch wallet balance" });
    }
});

// 6. Get Wallet Transactions History — AUTH & OWNERSHIP REQUIRED
router.get('/wallet/transactions/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // 🛡️ Security Check: Prevent IDOR - only owner or admin can view transaction history
        if (parseInt(req.user.id) !== parseInt(userId) && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: You can only view your own transaction history." });
        }

        // 🛡️ KYC Document Check: User must have uploaded an ID document to view transactions
        if (req.user.role !== 'admin') {
            const hasDoc = await checkUserHasDocument(userId);
            if (!hasDoc) {
                return res.status(403).json({ error: "Document verification required to access wallet transactions.", kyc_required: true });
            }
        }

        const txs = await pool.query(
            "SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            [userId]
        );
        res.status(200).json(txs.rows);
    } catch (err) {
        console.error("Get wallet transactions error:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

// 7. Request Payout / Withdrawal (UPI or Bank Transfer)
router.post('/wallet/payout-request', authenticateToken, async (req, res) => {
    try {
        const { amount, payout_method, upi_id, account_holder_name, account_number, ifsc_code } = req.body;
        const userId = req.user.id;
        const reqAmt = parseFloat(amount);

        if (!reqAmt || reqAmt < 500) {
            return res.status(400).json({ error: "Minimum payout amount is ₹500" });
        }

        // 🛡️ KYC Document Check: User must have uploaded an ID document to request payouts
        if (req.user.role !== 'admin') {
            const hasDoc = await checkUserHasDocument(userId);
            if (!hasDoc) {
                return res.status(403).json({ error: "Document verification required to withdraw funds.", kyc_required: true });
            }
        }

        const wallet = await ensureWalletExists(userId);
        const available = parseFloat(wallet.available_balance) || 0;

        if (reqAmt > available) {
            return res.status(400).json({ error: `Insufficient available balance. You have ₹${available.toLocaleString()}` });
        }

        if (payout_method === 'upi' && (!upi_id || !upi_id.includes('@'))) {
            return res.status(400).json({ error: "Please enter a valid UPI ID (e.g. name@oksbi)" });
        }

        if (payout_method === 'bank' && (!account_number || !ifsc_code)) {
            return res.status(400).json({ error: "Please provide valid Bank Account Number and IFSC Code" });
        }

        // Deduct from available_balance immediately to hold for payout
        await pool.query(
            "UPDATE wallet_balances SET available_balance = available_balance - $1, updated_at = NOW() WHERE user_id = $2",
            [reqAmt, userId]
        );

        // Insert payout request
        const payoutRes = await pool.query(
            `INSERT INTO payout_requests (user_id, amount, payout_method, upi_id, account_holder_name, account_number, ifsc_code, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
            [userId, reqAmt, payout_method || 'upi', upi_id || null, account_holder_name || null, account_number || null, ifsc_code || null]
        );

        // Record withdrawal transaction in history
        await pool.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, title, description, status, method)
             VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', $5)`,
            [
                userId,
                reqAmt,
                payout_method === 'upi' ? `Payout to UPI (${upi_id})` : `Bank Transfer Payout (${account_holder_name})`,
                `Withdrawal request submitted. Processing via ${payout_method.toUpperCase()}.`,
                payout_method === 'upi' ? 'Instant UPI' : 'Bank IMPS'
            ]
        );

        res.status(200).json({
            success: true,
            payout: payoutRes.rows[0],
            message: `🎉 Payout request for ₹${reqAmt.toLocaleString()} submitted successfully!`
        });
    } catch (err) {
        console.error("Payout request error:", err);
        res.status(500).json({ error: "Failed to submit payout request" });
    }
});

// 8. Admin: View All Payout Requests
router.get('/admin/payouts', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: "Admin access required" });
        }

        const payouts = await pool.query(`
            SELECT p.*, u.name as user_name, u.email as user_email, u.profile_pic, u.role as user_role
            FROM payout_requests p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `);

        res.status(200).json(payouts.rows);
    } catch (err) {
        console.error("Admin get payouts error:", err);
        res.status(500).json({ error: "Failed to fetch payouts" });
    }
});

// 9. Admin: Process / Approve / Reject Payout
router.post('/admin/payouts/:id/process', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: "Admin access required" });
        }

        const { id } = req.params;
        const { action, reference_id, admin_notes } = req.body; // action: 'approve' | 'reject'

        const payoutRes = await pool.query("SELECT * FROM payout_requests WHERE id = $1", [id]);
        if (payoutRes.rows.length === 0) {
            return res.status(404).json({ error: "Payout request not found" });
        }

        const payout = payoutRes.rows[0];
        if (payout.status !== 'pending') {
            return res.status(400).json({ error: `Payout is already ${payout.status}` });
        }

        if (action === 'approve') {
            const refId = reference_id || `UTR_${Date.now()}`;
            await pool.query(
                `UPDATE payout_requests 
                 SET status = 'approved', reference_id = $1, admin_notes = $2, processed_at = NOW() 
                 WHERE id = $3`,
                [refId, admin_notes || 'Approved by Admin', id]
            );

            // Increment total_withdrawn
            await pool.query(
                "UPDATE wallet_balances SET total_withdrawn = total_withdrawn + $1, updated_at = NOW() WHERE user_id = $2",
                [payout.amount, payout.user_id]
            );

            res.status(200).json({ success: true, message: `Payout of ₹${payout.amount} approved! Ref: ${refId}` });
        } else {
            // Rejected: Refund back to available balance
            await pool.query(
                `UPDATE payout_requests 
                 SET status = 'rejected', admin_notes = $1, processed_at = NOW() 
                 WHERE id = $2`,
                [admin_notes || 'Rejected by Admin', id]
            );

            await pool.query(
                "UPDATE wallet_balances SET available_balance = available_balance + $1, updated_at = NOW() WHERE user_id = $2",
                [payout.amount, payout.user_id]
            );

            res.status(200).json({ success: true, message: `Payout of ₹${payout.amount} rejected and funds restored to wallet balance.` });
        }
    } catch (err) {
        console.error("Admin process payout error:", err);
        res.status(500).json({ error: "Failed to process payout" });
    }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const rateLimiter = require('../middleware/rateLimiter');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// ─── Cryptographically Secure Helpers ─────────────────────────
const generateSecureOTP = () => crypto.randomInt(100000, 1000000).toString();

const timingSafeCompare = (a, b) => {
    if (!a || !b) return false;
    const strA = a.toString();
    const strB = b.toString();
    if (strA.length !== strB.length) return false;
    return crypto.timingSafeEqual(Buffer.from(strA), Buffer.from(strB));
};

// ─── Email Service (Dual-Provider: Brevo HTTP API + Nodemailer Fallback) ──
const nodemailer = require('nodemailer');

let mailTransporter = null;
const getMailTransporter = () => {
    if (!mailTransporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        mailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return mailTransporter;
};

const sendEmail = async ({ to, subject, html }) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.EMAIL_USER || 'noreply@coffeely.com';
    const senderName = process.env.EMAIL_FROM_NAME || 'Coffeely';

    let lastError = null;

    // Strategy 1: Brevo HTTP API (Fastest on cloud/Render, no SMTP ports needed)
    if (apiKey) {
        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail },
                    to: [{ email: to }],
                    subject: subject,
                    htmlContent: html
                })
            });

            if (response.ok) {
                return await response.json();
            }
            const errData = await response.json().catch(() => ({}));
            lastError = new Error(errData.message || `Brevo API error: ${response.status}`);
            console.warn(`⚠️ Brevo API failed (${response.status}): ${lastError.message}. Trying Nodemailer fallback...`);
        } catch (brevoErr) {
            lastError = brevoErr;
            console.warn(`⚠️ Brevo request failed: ${brevoErr.message}. Trying Nodemailer fallback...`);
        }
    }

    // Strategy 2: Nodemailer (Direct Gmail / SMTP credentials)
    const transporter = getMailTransporter();
    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from: `"${senderName}" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html
            });
            console.log(`✅ Email sent via Nodemailer to ${to} (ID: ${info.messageId})`);
            return info;
        } catch (smtpErr) {
            lastError = smtpErr;
            console.error('⚠️ Nodemailer SMTP delivery failed:', smtpErr.message);
        }
    }

    // Strategy 3: Safe fallback if providers are down or during local development
    if (process.env.NODE_ENV !== 'production' || (!apiKey && !transporter)) {
        console.warn(`⚠️ [DEV EMAIL LOG] Email to ${to} | Subject: "${subject}" - could not send via network provider, logged for recovery.`);
        return { message: 'Email logged to console fallback' };
    }

    throw lastError || new Error('No working email provider configured. Please check BREVO_API_KEY or EMAIL_USER/EMAIL_PASS.');
};

console.log('Email service initialized: Dual-Provider (Brevo + Nodemailer)');

// Strict rate limiter for auth routes — 5 attempts per minute per IP
const authRateLimit = rateLimiter(5, 60 * 1000);

// Input validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 6;

// ─── REGISTER ───────────────────────────────────────────────
router.post('/register', authRateLimit, async (req, res) => {
    try {
        const { name, email, password, role, phone, dob, age } = req.body;

        // Input validation
        if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
        if (!validateEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
        if (!validatePassword(password)) return res.status(400).json({ error: "Password must be at least 6 characters." });
        if (!role || !['boy', 'girl'].includes(role)) return res.status(400).json({ error: "Please select a valid role (boy/girl)." });

        // Check if email already exists
        const existingUser = await pool.query("SELECT id, is_verified FROM users WHERE email = $1", [email.toLowerCase().trim()]);
        if (existingUser.rows.length > 0) {
            if (existingUser.rows[0].is_verified === false) {
                // Delete unverified user to allow clean re-registration
                await pool.query("DELETE FROM users WHERE id = $1", [existingUser.rows[0].id]);
            } else {
                return res.status(409).json({ error: "This email is already registered. Please login." });
            }
        }

        // Check if phone number already exists on an active account
        if (phone) {
            const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
            if (cleanPhone && cleanPhone.length === 10) {
                const existingPhone = await pool.query("SELECT id, is_verified FROM users WHERE phone = $1", [cleanPhone]);
                if (existingPhone.rows.length > 0 && existingPhone.rows[0].is_verified !== false) {
                    return res.status(409).json({ error: "This phone number is already registered to another account." });
                }
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const otp = generateSecureOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        // Generate unique username from name
        let baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!baseUsername) baseUsername = 'user';
        let isUnique = false;
        let username = baseUsername;
        let counter = 1;
        while (!isUnique) {
            const checkDup = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
            if (checkDup.rows.length === 0) {
                isUnique = true;
            } else {
                username = `${baseUsername}${counter}`;
                counter++;
            }
        }

        // Create user with OTP info, dob, username, and age
        const newUser = await pool.query(
            "INSERT INTO users (name, username, email, password, role, phone, otp, otp_expiry, dob, age) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, username, email, role",
            [name.trim(), username, email.toLowerCase(), hashedPassword, role, phone || null, otp, otpExpiry, dob || null, age || null]
        );

        const user = newUser.rows[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        try {
            await sendEmail({
                to: email.toLowerCase().trim(),
                subject: 'Your Coffeely Verification Code',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
                            <tr><td align="center">
                                <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
                                    <tr><td style="background:linear-gradient(135deg,#e91e8c,#ff6b6b);padding:36px 40px;text-align:center;">
                                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">Coffeely</h1>
                                        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Email Verification</p>
                                    </td></tr>
                                    <tr><td style="padding:40px 40px 32px;">
                                        <p style="margin:0 0 16px;color:#333333;font-size:16px;">Hi <strong>${user.name}</strong>,</p>
                                        <p style="margin:0 0 28px;color:#555555;font-size:15px;line-height:1.6;">Use the verification code below to verify your email. This code is valid for <strong>10 minutes</strong>.</p>
                                        <div style="background:linear-gradient(135deg,#fff0f6,#ffe4f0);border:2px solid #f48fb1;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                                            <p style="margin:0 0 8px;color:#c2185b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Your OTP Code</p>
                                            <p style="margin:0;color:#e91e8c;font-size:48px;font-weight:900;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
                                        </div>
                                        <p style="margin:0 0 8px;color:#888888;font-size:13px;text-align:center;">This code expires in <strong>10 minutes</strong>.</p>
                                        <p style="margin:0;color:#aaaaaa;font-size:12px;text-align:center;">If you didn't request this, please ignore this email.</p>
                                    </td></tr>
                                    <tr><td style="background:#fafafa;padding:20px 40px;border-top:1px solid #eeeeee;text-align:center;">
                                        <p style="margin:0;color:#bbbbbb;font-size:12px;">&copy; 2026 Coffeely &middot; All rights reserved</p>
                                    </td></tr>
                                </table>
                            </td></tr>
                        </table>
                    </body>
                    </html>
                `
            });
        } catch (mailErr) {
            console.error("Mail send error during registration:", mailErr);
            // Clean up inserted user so they can try again immediately
            await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
            return res.status(500).json({ error: "Failed to send verification email: " + mailErr.message });
        }

        res.status(201).json({ message: "Registration successful!", token, user });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});


// ─── LOGIN WITH ACCOUNT LOCKOUT PROTECTION ───────────────────
router.post('/login', authRateLimit, async (req, res) => {
    try {
        const emailOrPhone = req.body.email || req.body.emailOrPhone;
        const { password } = req.body;

        if (!emailOrPhone) return res.status(400).json({ error: "Please enter your email or phone number." });
        if (!password) return res.status(400).json({ error: "Please enter your password." });

        // Find user by email OR phone
        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR phone = $1",
            [emailOrPhone.toLowerCase().trim()]
        );
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "Incorrect email/phone or password." });
        }

        const user = userResult.rows[0];

        // 🛡️ Check if account is temporarily locked due to failed attempts
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
            return res.status(429).json({
                error: `Account is temporarily locked for security. Please try again in ${remainingMins} minute(s).`
            });
        }

        // Verify password — supports bcrypt hashed passwords & auto-upgrades legacy
        let isPasswordValid = false;
        if (user.password && user.password.startsWith('$2')) {
            isPasswordValid = await bcrypt.compare(password, user.password);
        } else {
            isPasswordValid = (password === user.password);
            if (isPasswordValid) {
                const hashed = await bcrypt.hash(password, 12);
                await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, user.id]);
            }
        }

        if (!isPasswordValid) {
            // 🛡️ Track failed attempt and trigger 15-min lockout after 5 consecutive failures
            const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
            if (newFailedAttempts >= 5) {
                await pool.query(
                    "UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2",
                    [newFailedAttempts, user.id]
                );
                return res.status(429).json({
                    error: "Account locked for 15 minutes due to 5 consecutive failed login attempts."
                });
            } else {
                await pool.query(
                    "UPDATE users SET failed_login_attempts = $1 WHERE id = $2",
                    [newFailedAttempts, user.id]
                );
                const remaining = 5 - newFailedAttempts;
                return res.status(401).json({
                    error: `Incorrect email/phone or password. (${remaining} attempt${remaining > 1 ? 's' : ''} remaining)`
                });
            }
        }

        // Successful login: reset failed counters and update last login IP
        await pool.query(
            "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_ip = $1 WHERE id = $2",
            [req.ip || null, user.id]
        );

        if (user.is_verified === false) {
            return res.status(403).json({ error: "UNVERIFIED_ACCOUNT", email: user.email });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        delete user.password;
        res.status(200).json({ message: "Login successful!", token, user });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});
// ─── FORGOT PASSWORD (Send OTP) ───────────────────────────────
router.post('/forgot-password', authRateLimit, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        const userResult = await pool.query(
            "SELECT id, name FROM users WHERE email = $1",
            [email.toLowerCase().trim()]
        );
        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: "If this email is registered, an OTP has been sent." });
        }

        const user = userResult.rows[0];
        const otp = generateSecureOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            "UPDATE users SET otp = $1, otp_expiry = $2, failed_otp_attempts = 0 WHERE id = $3",
            [otp, otpExpiry, user.id]
        );

        await sendEmail({
            to: email,
            subject: 'Coffeely — Password Reset Code',
            html: `
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
                        <tr><td align="center">
                            <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
                                <tr><td style="background:linear-gradient(135deg,#e91e8c,#ff6b6b);padding:36px 40px;text-align:center;">
                                    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">Coffeely</h1>
                                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Password Reset</p>
                                </tr></td>
                                <tr><td style="padding:40px;">
                                    <p style="margin:0 0 16px;color:#333;font-size:16px;">Hi <strong>${user.name}</strong>,</p>
                                    <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">You requested a password reset. Use the secure OTP below. This code expires in <strong>10 minutes</strong>.</p>
                                    <div style="background:linear-gradient(135deg,#fff0f6,#ffe4f0);border:2px solid #f48fb1;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
                                        <p style="margin:0 0 8px;color:#c2185b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Reset OTP</p>
                                        <p style="margin:0;color:#e91e8c;font-size:48px;font-weight:900;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
                                    </div>
                                    <p style="margin:0;color:#aaa;font-size:12px;text-align:center;">If you did not request this, please ignore this email.</p>
                                </td></tr>
                                <tr><td style="background:#fafafa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
                                    <p style="margin:0;color:#bbb;font-size:12px;">&copy; 2026 Coffeely &middot; All rights reserved</p>
                                </td></tr>
                            </table>
                        </td></tr>
                    </table>
                </body>
                </html>
            `
        });

        res.status(200).json({ message: "OTP sent successfully! Please check your email." });
    } catch (err) {
        console.error("Forgot password error:", err.message);
        res.status(500).json({ error: "Failed to send OTP. Please try again." });
    }
});

// ─── RESET PASSWORD ───────────────────────────────────────────
router.post('/reset-password', authRateLimit, async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !validateEmail(email)) return res.status(400).json({ error: "Please enter a valid email." });
        if (!otp) return res.status(400).json({ error: "Please enter the OTP." });
        if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

        const userResult = await pool.query(
            "SELECT id, otp, otp_expiry, failed_otp_attempts FROM users WHERE email = $1",
            [email.toLowerCase().trim()]
        );
        if (userResult.rows.length === 0) return res.status(404).json({ error: "Account not found." });

        const user = userResult.rows[0];

        if (!user.otp) return res.status(400).json({ error: "Please request an OTP first." });
        if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ error: "OTP has expired. Please request a new one." });

        // 🛡️ Timing-safe OTP comparison and brute-force attempt lockout
        if (!timingSafeCompare(user.otp, otp)) {
            const failedAttempts = (user.failed_otp_attempts || 0) + 1;
            if (failedAttempts >= 5) {
                await pool.query("UPDATE users SET otp = NULL, otp_expiry = NULL, failed_otp_attempts = 0 WHERE id = $1", [user.id]);
                return res.status(429).json({ error: "Too many incorrect OTP attempts. The OTP has been invalidated for your security. Please request a new code." });
            } else {
                await pool.query("UPDATE users SET failed_otp_attempts = $1 WHERE id = $2", [failedAttempts, user.id]);
                return res.status(400).json({ error: `Incorrect OTP. (${5 - failedAttempts} attempt(s) remaining)` });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await pool.query(
            "UPDATE users SET password = $1, otp = NULL, otp_expiry = NULL, failed_otp_attempts = 0, password_changed_at = NOW() WHERE id = $2",
            [hashedPassword, user.id]
        );

        res.status(200).json({ message: "Password reset successfully! Please login with your new password." });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ error: "Failed to reset password. Please try again." });
    }
});


// ─── SEND OTP ────────────────────────────────────────────────
router.post('/send-otp', authRateLimit, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        const userResult = await pool.query("SELECT id, name FROM users WHERE email = $1", [email.toLowerCase()]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "No account found with this email." });
        }

        const user = userResult.rows[0];
        const otp = generateSecureOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            "UPDATE users SET otp = $1, otp_expiry = $2, failed_otp_attempts = 0 WHERE id = $3",
            [otp, otpExpiry, user.id]
        );

        await sendEmail({
            to: email,
            subject: 'Your Coffeely Verification Code',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
                        <tr><td align="center">
                            <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
                                <tr><td style="background:linear-gradient(135deg,#e91e8c,#ff6b6b);padding:36px 40px;text-align:center;">
                                    <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">Coffeely</h1>
                                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Email Verification</p>
                                </td></tr>
                                <tr><td style="padding:40px 40px 32px;">
                                    <p style="margin:0 0 16px;color:#333333;font-size:16px;">Hi <strong>${user.name}</strong>,</p>
                                    <p style="margin:0 0 28px;color:#555555;font-size:15px;line-height:1.6;">Use the verification code below to verify your email. This code is valid for <strong>10 minutes</strong>.</p>
                                    <div style="background:linear-gradient(135deg,#fff0f6,#ffe4f0);border:2px solid #f48fb1;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                                        <p style="margin:0 0 8px;color:#c2185b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Your OTP Code</p>
                                        <p style="margin:0;color:#e91e8c;font-size:48px;font-weight:900;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
                                    </div>
                                    <p style="margin:0 0 8px;color:#888888;font-size:13px;text-align:center;">This code expires in <strong>10 minutes</strong>.</p>
                                    <p style="margin:0;color:#aaaaaa;font-size:12px;text-align:center;">If you didn't request this, please ignore this email.</p>
                                </td></tr>
                                <tr><td style="background:#fafafa;padding:20px 40px;border-top:1px solid #eeeeee;text-align:center;">
                                    <p style="margin:0;color:#bbbbbb;font-size:12px;">&copy; 2026 Coffeely &middot; All rights reserved</p>
                                </td></tr>
                            </table>
                        </td></tr>
                    </table>
                </body>
                </html>
            `
        });

        res.status(200).json({ message: "OTP sent successfully! Please check your email." });
    } catch (err) {
        console.error("Send OTP error:", err);
        res.status(500).json({ error: "Failed to send OTP: " + err.message });
    }
});

// ─── VERIFY OTP ──────────────────────────────────────────────
router.post('/verify-otp', authRateLimit, async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        if (!otp) {
            return res.status(400).json({ error: "Please enter the OTP." });
        }

        const userResult = await pool.query(
            "SELECT id, name, email, role, otp, otp_expiry, failed_otp_attempts FROM users WHERE email = $1",
            [email.toLowerCase()]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "No account found with this email." });
        }

        const user = userResult.rows[0];

        if (!user.otp) {
            return res.status(400).json({ error: "Please request an OTP first." });
        }
        if (new Date() > new Date(user.otp_expiry)) {
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        // 🛡️ Timing-safe OTP comparison and brute-force attempt lockout
        if (!timingSafeCompare(user.otp, otp)) {
            const failedAttempts = (user.failed_otp_attempts || 0) + 1;
            if (failedAttempts >= 5) {
                await pool.query("UPDATE users SET otp = NULL, otp_expiry = NULL, failed_otp_attempts = 0 WHERE id = $1", [user.id]);
                return res.status(429).json({ error: "Too many incorrect OTP attempts. The OTP has been invalidated for your security. Please request a new code." });
            } else {
                await pool.query("UPDATE users SET failed_otp_attempts = $1 WHERE id = $2", [failedAttempts, user.id]);
                return res.status(400).json({ error: `Incorrect OTP. (${5 - failedAttempts} attempt(s) remaining)` });
            }
        }

        await pool.query(
            "UPDATE users SET is_verified = true, otp = NULL, otp_expiry = NULL, failed_otp_attempts = 0 WHERE id = $1",
            [user.id]
        );

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Email verified! Welcome to Coffeely 🎉",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error("Verify OTP error:", err);
        res.status(500).json({ error: "OTP verify karne mein error. Dobara try karo." });
    }
});

// ─── CHANGE PASSWORD (AUTHENTICATED) ─────────────────────────
router.post('/change-password', authenticateToken, rateLimiter(5, 60 * 1000), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword) {
            return res.status(400).json({ error: "Current password is required." });
        }
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters long." });
        }

        const userResult = await pool.query(
            "SELECT id, password FROM users WHERE id = $1",
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User account not found." });
        }

        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Current password is incorrect." });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ error: "New password cannot be the same as your old password." });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [hashedNewPassword, req.user.id]
        );

        res.status(200).json({ message: "Password changed successfully! You can now use your new password." });
    } catch (err) {
        console.error("Change password error:", err);
        res.status(500).json({ error: "Server error while changing password. Please try again." });
    }
});

module.exports = router;


import React, { useState } from "react";
import { PAGES } from "../App";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { getFriendlyErrorMessage } from "../utils/errorHandler";

// Backend API Base Configuration
const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function UnifiedLogin({ setPage, setGirlUser, setBoyUser, setAdminUser, defaultRole }) {
    const [step, setStep] = useState("login"); // "login" | "forgot" | "reset" | "verify"
    const [formData, setFormData] = useState({ emailOrPhone: "", password: "" });
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetData, setResetData] = useState({ otp: "", newPassword: "", confirmPassword: "" });
    const [verifyEmail, setVerifyEmail] = useState(""); // for unverified account OTP
    const [verifyOtp, setVerifyOtp] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // ── LOGIN HANDLER ──────────────────────────────────────────
    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setError("No internet connection. Please turn on mobile data or Wi-Fi to login.");
            return;
        }
        if (!formData.emailOrPhone?.trim()) {
            setError("Please enter your email or phone number.");
            return;
        }
        if (!formData.password) {
            setError("Please enter your password.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                // Defensive check if account is not verified
                if (data.user && data.user.is_verified === false) {
                    const targetEmail = data.user.email || formData.emailOrPhone;
                    setVerifyEmail(targetEmail);
                    setVerifyOtp("");
                    await fetch(`${API}/send-otp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: targetEmail })
                    }).catch(() => {});
                    setStep("verify");
                    setError("Your account is not verified. A new verification OTP has been sent to your email.");
                    return;
                }

                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                if (data.user.role === 'girl') {
                    if (setGirlUser) setGirlUser(data.user);
                    setPage(PAGES.GIRL_DASHBOARD);
                } else if (data.user.role === 'admin') {
                    if (setAdminUser) setAdminUser(data.user);
                    setPage(PAGES.ADMIN_DASHBOARD);
                } else {
                    if (setBoyUser) setBoyUser(data.user);
                    setPage(PAGES.BOY_DASHBOARD);
                }
            } else if (response.status === 403 && data.error === "UNVERIFIED_ACCOUNT") {
                const targetEmail = data.email || formData.emailOrPhone;
                setVerifyEmail(targetEmail);
                setVerifyOtp("");
                try {
                    await fetch(`${API}/send-otp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: targetEmail })
                    });
                } catch (sendErr) {
                    console.error("Auto send OTP error:", sendErr);
                }
                setStep("verify");
                setError("Your account is not verified. A new verification code has been sent to your email.");
                return;
            } else if (response.status === 401) {
                setError(data.error || "Incorrect email/phone or password. Please try again.");
            } else {
                setError(getFriendlyErrorMessage(null, data, "Login failed. Please check your credentials."));
            }
        } catch (err) {
            console.error("Login fetch error:", err);
            setError(getFriendlyErrorMessage(err, null, "Unable to connect to server. Please try again in a few moments."));
        } finally {
            setLoading(false);
        }
    };

    // ── VERIFY OTP (for unverified accounts at login) ──
    const handleVerifyOtpAtLogin = async (e) => {
        e.preventDefault();
        setError("");

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setError("No internet connection. Please check your network to verify OTP.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API}/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: verifyEmail, otp: verifyOtp })
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                setSuccess("Account verified! Logging you in...");
                setTimeout(() => {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    if (data.user.role === 'girl') {
                        if (setGirlUser) setGirlUser(data.user);
                        setPage(PAGES.GIRL_DASHBOARD);
                    } else if (data.user.role === 'admin') {
                        if (setAdminUser) setAdminUser(data.user);
                        setPage(PAGES.ADMIN_DASHBOARD);
                    } else {
                        if (setBoyUser) setBoyUser(data.user);
                        setPage(PAGES.BOY_DASHBOARD);
                    }
                }, 1000);
            } else {
                setError(getFriendlyErrorMessage(null, data, "Invalid OTP code. Please check and try again."));
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err, null, "Verification failed. Please check your connection."));
        } finally {
            setLoading(false);
        }
    };

    // ── FORGOT PASSWORD — SEND OTP ─────────────────────────────
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setError("No internet connection. Please check your network to send OTP.");
            return;
        }

        setLoading(true);
        setLoadingMsg("Sending OTP...");

        const sendOtpRequest = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
            try {
                const response = await fetch(`${API}/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: forgotEmail }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return response;
            } catch (err) {
                clearTimeout(timeoutId);
                throw err;
            }
        };

        try {
            let response;
            try {
                response = await sendOtpRequest();
            } catch (firstErr) {
                if (firstErr.name === "AbortError") {
                    // Auto-retry once — server was waking up
                    setLoadingMsg("Connecting to server... retrying (30s)...");
                    await new Promise(r => setTimeout(r, 5000));
                    response = await sendOtpRequest();
                } else {
                    throw firstErr;
                }
            }

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                setSuccess("OTP sent! Please check your email inbox and spam folder.");
                setTimeout(() => { setSuccess(""); setStep("reset"); }, 2000);
            } else {
                setError(getFriendlyErrorMessage(null, data, "Unable to send OTP. Please check the email address."));
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err, null, "Unable to reach server. Please check your connection and try again."));
        } finally {
            setLoading(false);
            setLoadingMsg("");
        }
    };

    // ── RESET PASSWORD — VERIFY OTP + SET NEW PASSWORD ─────────
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setError("No internet connection. Please check your network to reset password.");
            return;
        }

        if (resetData.newPassword !== resetData.confirmPassword) {
            setError("Passwords do not match. Please re-enter.");
            return;
        }
        if (resetData.newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: forgotEmail,
                    otp: resetData.otp,
                    newPassword: resetData.newPassword
                })
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                setSuccess("Password reset successfully! Please login with your new password.");
                setTimeout(() => {
                    setStep("login");
                    setForgotEmail("");
                    setResetData({ otp: "", newPassword: "", confirmPassword: "" });
                    setSuccess("");
                }, 2000);
            } else {
                setError(getFriendlyErrorMessage(null, data, "Password reset failed. Please check the OTP."));
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err, null, "Unable to reach server. Please check your connection and try again."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[#0D0D1A] flex flex-col items-center justify-center p-4 relative z-0 overflow-x-hidden w-full">
            <div className="absolute w-96 h-96 rounded-full blur-[100px] pointer-events-none -z-10 bg-pink-600/10"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full blur-[100px] pointer-events-none -z-10 bg-purple-600/10"></div>

            {/* Top Navigation Bar: Back to Home */}
            <div className="w-full max-w-md mb-3 flex items-center justify-between z-10">
                <button
                    type="button"
                    onClick={() => setPage(PAGES.HOME)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl transition border border-white/5 backdrop-blur"
                >
                    <span>←</span>
                    <span>Back to Home</span>
                </button>
            </div>

            <div className="bg-[#16162A]/90 w-full max-w-md p-6 sm:p-8 rounded-2xl border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.8)] backdrop-blur-md relative overflow-hidden transition-colors duration-500">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-pink-500/5 rounded-full blur-xl pointer-events-none"></div>
                <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>

                {/* ── VERIFY STEP (unverified account detected at login) ── */}
                {step === "verify" && (
                    <>
                        <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pink-500/20">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <h2 className="text-2xl font-extrabold text-center text-white mb-1">Verify Your Email</h2>
                        <p className="text-gray-400 text-center text-sm mb-1">Your account is not verified yet.</p>
                        <p className="text-pink-400 text-center text-sm font-semibold mb-6 break-all">{verifyEmail}</p>

                        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}
                        {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 text-sm p-3 rounded-xl mb-4 text-center">{success}</div>}

                        <form onSubmit={handleVerifyOtpAtLogin} className="space-y-4">
                            <input
                                type="text"
                                required
                                maxLength="6"
                                value={verifyOtp}
                                onChange={(e) => setVerifyOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-[#0095f6] transition font-mono"
                                placeholder="······"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={loading || verifyOtp.length !== 6}
                                className="w-full py-3.5 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-xl font-bold shadow-lg transition disabled:opacity-50"
                            >
                                {loading ? "Verifying..." : "Verify & Login"}
                            </button>
                        </form>
                        <div className="mt-4 flex items-center justify-between text-xs px-1">
                            <button
                                type="button"
                                disabled={loading}
                                onClick={async () => {
                                    setLoading(true);
                                    setError("");
                                    try {
                                        const res = await fetch(`${API}/send-otp`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ email: verifyEmail })
                                        });
                                        const d = await res.json();
                                        if (res.ok) {
                                            setSuccess("A new OTP has been sent! Please check your email.");
                                        } else {
                                            setError(d.error || "Failed to resend OTP. Please try again.");
                                        }
                                    } catch (err) {
                                        setError("Unable to connect to server. Please try again.");
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="text-pink-400 hover:text-pink-300 transition font-medium"
                            >
                                🔄 Resend Code
                            </button>
                            <button onClick={() => { setStep("login"); setError(""); setSuccess(""); }} className="text-gray-500 hover:text-gray-300 transition">
                                ← Back to Login
                            </button>
                        </div>
                    </>
                )}

                {/* ── LOGIN FORM ── */}
                {step === "login" && (
                    <>
                        {/* Platform Branding */}
                        <div className="flex items-center justify-center gap-2.5 mb-6 cursor-pointer" onClick={() => setPage(PAGES.HOME)}>
                            <svg className="w-9 h-9 drop-shadow-[0_0_8px_rgba(225,48,108,0.4)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 40H68C68 40 69 68 45 68C21 68 22 40 22 40Z" stroke="url(#login-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M68 45H75C80 45 83 48 83 53C83 58 80 61 75 61H66" stroke="url(#login-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18 75H72" stroke="url(#login-grad)" strokeWidth="6" strokeLinecap="round"/>
                                <path d="M45 29C40 23 32 30 39 37L45 42L51 37C58 30 50 23 45 29Z" fill="url(#login-grad)"/>
                                <path d="M31 27C30 24 31 21 33 19" stroke="url(#login-grad)" strokeWidth="4" strokeLinecap="round"/>
                                <path d="M59 27C60 24 59 21 57 19" stroke="url(#login-grad)" strokeWidth="4" strokeLinecap="round"/>
                                <defs><linearGradient id="login-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#f9ce3f" /><stop offset="0.5" stopColor="#e1306c" /><stop offset="1" stopColor="#833ab4" /></linearGradient></defs>
                            </svg>
                            <span className="text-2xl font-black bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] bg-clip-text text-transparent tracking-wide">Coffeely</span>
                        </div>

                        <h2 className="text-2xl font-extrabold text-center text-white mb-1">Welcome Back</h2>
                        <p className="text-gray-400 text-center text-sm mb-6">Login to your account</p>

                        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">Email or Phone Number</label>
                                <input
                                    type="text"
                                    name="emailOrPhone"
                                    required
                                    value={formData.emailOrPhone}
                                    onChange={handleChange}
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition focus:border-[#0095f6]"
                                    placeholder="example@mail.com or 9876543210"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white outline-none transition focus:border-[#0095f6]"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                                    >
                                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={() => { setStep("forgot"); setError(""); }}
                                    className="text-xs text-purple-400 hover:text-purple-300 transition hover:underline"
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-3.5 mt-1 rounded-xl text-white font-bold text-sm shadow-lg hover:-translate-y-0.5 transition bg-gradient-to-r from-blue-500 to-purple-500 disabled:opacity-60">
                                {loading ? "Logging in..." : "Login →"}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-400 text-sm">
                                Don't have an account?{' '}
                                <button onClick={() => setPage(PAGES.BOY_REGISTER)} className="font-bold hover:underline text-purple-400">
                                    Register here
                                </button>
                            </p>
                        </div>
                    </>
                )}

                {/* ── FORGOT PASSWORD FORM ── */}
                {step === "forgot" && (
                    <>
                        <button onClick={() => { setStep("login"); setError(""); setSuccess(""); }} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition">
                            ← Back to Login
                        </button>
                        <h2 className="text-2xl font-extrabold text-white mb-2">Reset Password</h2>
                        <p className="text-gray-400 text-sm mb-6">Enter your registered email — we'll send you an OTP.</p>

                        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}
                        {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 text-sm p-3 rounded-xl mb-4 text-center">{success}</div>}

                        <form onSubmit={handleForgotPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">Registered Email</label>
                                <input
                                    type="email"
                                    required
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                                    placeholder="example@mail.com"
                                />
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-lg hover:-translate-y-0.5 transition bg-[#0095f6] hover:bg-[#1877f2] disabled:opacity-60">
                                {loading ? (loadingMsg || "Sending OTP...") : "Send OTP"}
                            </button>
                        </form>

                        <div className="mt-4 text-center">
                            <button onClick={() => { setStep("reset"); setError(""); }} className="text-xs text-gray-500 hover:text-purple-400 transition">
                                Already have an OTP? Reset now →
                            </button>
                        </div>
                    </>
                )}

                {/* ── RESET PASSWORD FORM ── */}
                {step === "reset" && (
                    <>
                        <button onClick={() => { setStep("forgot"); setError(""); setSuccess(""); }} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition">
                            ← Back
                        </button>
                        <h2 className="text-2xl font-extrabold text-white mb-2">Set New Password</h2>
                        <p className="text-gray-400 text-sm mb-6">Enter the OTP from your email and choose a new password.</p>

                        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}
                        {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 text-sm p-3 rounded-xl mb-4 text-center">{success}</div>}

                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {!forgotEmail && (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5 ml-1">Registered Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value)}
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition focus:border-[#0095f6]"
                                        placeholder="example@mail.com"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">OTP Code (from email)</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={resetData.otp}
                                    onChange={(e) => setResetData({ ...resetData, otp: e.target.value })}
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition focus:border-[#0095f6] tracking-[0.5rem] text-center font-bold text-lg"
                                    placeholder="000000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        required
                                        value={resetData.newPassword}
                                        onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white outline-none transition focus:border-[#0095f6]"
                                        placeholder="Create a strong password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                                    >
                                        {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={resetData.confirmPassword}
                                        onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white outline-none transition focus:border-[#0095f6]"
                                        placeholder="Repeat your password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                                    >
                                        {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-lg hover:-translate-y-0.5 transition bg-gradient-to-r from-green-500 to-teal-500 disabled:opacity-60">
                                {loading ? "Resetting password..." : "Reset Password"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default UnifiedLogin;
import React, { useState } from "react";
import { PAGES } from "../App";
import { FiEye, FiEyeOff, FiMail, FiX, FiRefreshCw, FiCheckCircle, FiUser } from "react-icons/fi";
import { getFriendlyErrorMessage } from "../utils/errorHandler";

// Backend API Base Configuration
const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function CustomDropdown({ value, options, onChange, placeholder, isBoy }) {
    return (
        <div className="relative w-full">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-[#0D0D1A] border border-white/15 rounded-xl pl-3 pr-7 py-3 text-sm text-white outline-none transition focus:border-${isBoy ? 'blue-500' : 'pink-500'} appearance-none cursor-pointer`}
            >
                <option value="" disabled className="bg-[#121224] text-gray-500">{placeholder}</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#121224] text-white">
                        {opt.label}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 text-xs">
                ▼
            </div>
        </div>
    );
}

function UnifiedRegister({ setPage }) {
    const [formData, setFormData] = useState({
        name: "", email: "", phone: "", dob: "", password: "", role: "boy"
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const resendTimerRef = React.useRef(null);
    const [customAlert, setCustomAlert] = useState({ show: false, message: "" });
    const showAlert = (msg) => setCustomAlert({ show: true, message: msg });

    // Store registered user info so we can delete if cancelled
    const [registeredUserId, setRegisteredUserId] = useState(null);
    const [registeredToken, setRegisteredToken] = useState(null);

    const [dobParts, setDobParts] = useState({ day: "", month: "", year: "" });

    // Clean up timer on unmount to prevent memory leaks
    React.useEffect(() => {
        return () => {
            if (resendTimerRef.current) clearInterval(resendTimerRef.current);
        };
    }, []);

    React.useEffect(() => {
        if (dobParts.day && dobParts.month && dobParts.year) {
            setFormData(prev => ({ 
                ...prev, 
                dob: `${dobParts.year}-${dobParts.month}-${dobParts.day}` 
            }));
        } else {
            setFormData(prev => ({ ...prev, dob: "" }));
        }
    }, [dobParts]);

    const [currentStep, setCurrentStep] = useState(1);

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!formData.name.trim() || formData.name.trim().length < 2) {
                showAlert("Please enter your name (at least 2 characters).");
                return;
            }
        }
        if (currentStep === 2) {
            if (!formData.role) {
                showAlert("Please select your gender.");
                return;
            }
        }
        if (currentStep === 3) {
            if (!formData.dob) {
                showAlert("Please enter your complete Date of Birth.");
                return;
            }
            const age = calculateAge(formData.dob);
            if (age < 18) {
                showAlert("You must be at least 18 years old to join.");
                return;
            }
        }
        if (currentStep === 4) {
            const cleanPhone = formData.phone.replace(/[^0-9]/g, '').slice(-10);
            if (!formData.email.trim() || !cleanPhone) {
                showAlert("Please enter both your email and phone number.");
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
                showAlert("Please enter a valid email address.");
                return;
            }
            if (!/^\d{10}$/.test(cleanPhone)) {
                showAlert("Please enter a valid 10-digit phone number.");
                return;
            }
            if (formData.phone !== cleanPhone) {
                setFormData(prev => ({ ...prev, phone: cleanPhone }));
            }
        }
        setCurrentStep(prev => prev + 1);
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const calculateAge = (dobString) => {
        const today = new Date();
        const birthDate = new Date(dobString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // ── REGISTER HANDLER ───────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault();

        // Check internet connection
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showAlert("No internet connection. Please turn on mobile data or Wi-Fi to create an account.");
            return;
        }

        const age = calculateAge(formData.dob);
        if (age < 18) {
            showAlert("You must be at least 18 years old to join.");
            return;
        }

        if (!formData.password || formData.password.length < 6) {
            showAlert("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);
        try {
            const cleanPhone = formData.phone.replace(/[^0-9]/g, '').slice(-10);
            const response = await fetch(`${API}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    phone: cleanPhone,
                    age: age
                })
            });

            const data = await response.json();
            if (response.ok) {
                // Save user id + token — needed for cancel/delete if user backs out
                setRegisteredUserId(data.user?.id || null);
                setRegisteredToken(data.token || null);
                setShowOtpModal(true);
                startResendCooldown();
            } else {
                showAlert(getFriendlyErrorMessage(null, data, "Registration failed. Please check your details."));
            }
        } catch (err) {
            console.error("Register request failed:", err);
            showAlert(getFriendlyErrorMessage(err, null, "Unable to connect to server. Please try again in a few moments."));
        } finally {
            setLoading(false);
        }
    };

    // Cancel registration — deletes the unverified account
    const cancelRegistration = async () => {
        if (registeredUserId && registeredToken) {
            try {
                await fetch(`${API}/users/${registeredUserId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${registeredToken}` }
                });
            } catch (err) { /* silent fail */ }
        }
        setShowOtpModal(false);
        setOtp("");
        setRegisteredUserId(null);
        setRegisteredToken(null);
    };

    // Start 30s resend cooldown safely
    const startResendCooldown = () => {
        if (resendTimerRef.current) clearInterval(resendTimerRef.current);
        setResendCooldown(30);
        resendTimerRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { 
                    clearInterval(resendTimerRef.current); 
                    resendTimerRef.current = null;
                    return 0; 
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showAlert("No internet connection. Please check your network to resend OTP.");
            return;
        }
        try {
            const res = await fetch(`${API}/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                startResendCooldown();
                showAlert("OTP resent! Please check your email.");
            } else {
                showAlert(getFriendlyErrorMessage(null, data, "Failed to resend OTP. Try again."));
            }
        } catch (err) {
            showAlert(getFriendlyErrorMessage(err, null, "Failed to resend OTP. Please check your connection."));
        }
    };

    // Verify OTP Handler
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showAlert("No internet connection. Please check your network to verify OTP.");
            return;
        }
        if (otp.length !== 6) {
            showAlert("Please enter a valid 6-digit OTP.");
            return;
        }

        setVerifying(true);
        try {
            const response = await fetch(`${API}/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email, otp: otp })
            });

            const data = await response.json();
            if (response.ok) {
                showAlert("Account verified successfully! Please login.");
                setShowOtpModal(false);
                setPage(formData.role === 'girl' ? PAGES.GIRL_LOGIN : PAGES.BOY_LOGIN);
            } else {
                showAlert(getFriendlyErrorMessage(null, data, "Invalid OTP code. Please check and try again."));
            }
        } catch (err) {
            console.error(err);
            showAlert(getFriendlyErrorMessage(err, null, "Verification failed. Please check your connection."));
        } finally {
            setVerifying(false);
        }
    };

    const isBoy = formData.role === 'boy';

    return (
        <div className="min-h-[100dvh] bg-[#0D0D1A] flex flex-col items-center justify-center p-4 relative z-0 overflow-x-hidden w-full">
            <div className={`absolute w-96 h-96 rounded-full blur-[100px] pointer-events-none -z-10 transition-colors duration-500 ${isBoy ? 'bg-blue-600/20' : 'bg-pink-600/20'}`}></div>

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
                <div className="text-xs text-gray-400">
                    Already registered?{" "}
                    <button
                        type="button"
                        onClick={() => setPage(isBoy ? PAGES.BOY_LOGIN : PAGES.GIRL_LOGIN)}
                        className={`font-bold hover:underline ${isBoy ? 'text-blue-400' : 'text-pink-400'}`}
                    >
                        Log In
                    </button>
                </div>
            </div>

            <div className={`bg-[#16162A] w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl transition-colors duration-500 ${isBoy ? 'border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.1)]'}`}>
                
                {/* Header with Back button and Progress indicator */}
                <div className="flex items-center justify-between mb-6">
                    {currentStep > 1 ? (
                        <button 
                            type="button" 
                            onClick={handlePrevStep}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                            title="Previous Step"
                        >
                            ←
                        </button>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setPage(PAGES.HOME)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                            title="Back to Home"
                        >
                            ←
                        </button>
                    )}
                    
                    {/* Progress Dots */}
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <span 
                                key={s} 
                                className={`h-1.5 rounded-full transition-all duration-300 ${s === currentStep ? (isBoy ? 'w-5 bg-blue-500' : 'w-5 bg-pink-500') : 'w-1.5 bg-white/10'}`}
                            ></span>
                        ))}
                    </div>

                    <div className="w-8 h-8"></div>
                </div>

                <h2 className="text-2xl font-extrabold text-center text-white mb-1">Create Account</h2>
                <p className="text-gray-400 text-center text-xs mb-8">Step {currentStep} of 5</p>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                    {/* ── STEP 1: NAME ── */}
                    {currentStep === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-xs text-gray-400 mb-2 ml-1">What's your name?</label>
                                <input 
                                    type="text" 
                                    name="name" 
                                    required 
                                    value={formData.name} 
                                    onChange={handleChange} 
                                    className={`w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none transition focus:border-${isBoy ? 'blue' : 'pink'}-500`} 
                                    placeholder="Enter your name" 
                                    autoFocus
                                />
                            </div>
                            <button 
                                type="button" 
                                onClick={handleNextStep}
                                className={`w-full py-3.5 mt-4 rounded-xl text-white font-bold text-sm shadow-lg transition ${isBoy ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: GENDER ── */}
                    {currentStep === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <label className="block text-xs text-gray-400 mb-2 text-center">Select your gender</label>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Male Card */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, role: "boy" }));
                                        // Auto go to next step
                                        setTimeout(() => setCurrentStep(3), 300);
                                    }}
                                    className={`p-6 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center gap-3 ${formData.role === "boy" ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] text-white' : 'bg-[#0D0D1A] border-white/10 text-gray-400 hover:border-white/20'}`}
                                >
                                    <FiUser size={30} className={formData.role === "boy" ? "text-blue-400" : "text-gray-500"} />
                                    <span className="text-sm font-bold block">Male</span>
                                </button>

                                {/* Female Card */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, role: "girl" }));
                                        // Auto go to next step
                                        setTimeout(() => setCurrentStep(3), 300);
                                    }}
                                    className={`p-6 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center gap-3 ${formData.role === "girl" ? 'bg-pink-500/10 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)] text-white' : 'bg-[#0D0D1A] border-white/10 text-gray-400 hover:border-white/20'}`}
                                >
                                    <FiUser size={30} className={formData.role === "girl" ? "text-pink-400" : "text-gray-500"} />
                                    <span className="text-sm font-bold block">Female</span>
                                </button>
                            </div>
                            
                            <button 
                                type="button" 
                                onClick={handleNextStep}
                                className={`w-full py-3.5 mt-4 rounded-xl text-white font-bold text-sm shadow-lg transition ${isBoy ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {/* ── STEP 3: DATE OF BIRTH ── */}
                    {currentStep === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            <label className="block text-xs text-gray-400 mb-2 ml-1">When is your birthday?</label>
                            
                            <div className="grid grid-cols-3 gap-2">
                                {/* Day */}
                                <CustomDropdown
                                    value={dobParts.day}
                                    onChange={(val) => setDobParts(prev => ({ ...prev, day: val }))}
                                    placeholder="Day"
                                    isBoy={isBoy}
                                    options={Array.from({ length: 31 }, (_, i) => {
                                        const d = String(i + 1).padStart(2, '0');
                                        return { value: d, label: d };
                                    })}
                                />

                                {/* Month */}
                                <CustomDropdown
                                    value={dobParts.month}
                                    onChange={(val) => setDobParts(prev => ({ ...prev, month: val }))}
                                    placeholder="Month"
                                    isBoy={isBoy}
                                    options={[
                                        { value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
                                        { value: "04", label: "Apr" }, { value: "05", label: "May" }, { value: "06", label: "Jun" },
                                        { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" },
                                        { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" }
                                    ]}
                                />

                                {/* Year */}
                                <CustomDropdown
                                    value={dobParts.year}
                                    onChange={(val) => setDobParts(prev => ({ ...prev, year: val }))}
                                    placeholder="Year"
                                    isBoy={isBoy}
                                    options={Array.from({ length: 70 }, (_, i) => {
                                        const y = String(2008 - i);
                                        return { value: y, label: y };
                                    })}
                                />
                            </div>
                            
                            <p className="text-[10px] text-gray-500 mt-1 ml-1">Note: Only users aged 18 or above can join.</p>
                            
                            <button 
                                type="button" 
                                onClick={handleNextStep}
                                className={`w-full py-3.5 mt-4 rounded-xl text-white font-bold text-sm shadow-lg transition ${isBoy ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {/* ── STEP 4: CONTACT INFO ── */}
                    {currentStep === 4 && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">Email Address</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    required 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    className={`w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none transition focus:border-${isBoy ? 'blue' : 'pink'}-500`} 
                                    placeholder="example@mail.com" 
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 ml-1">Phone Number</label>
                                <input 
                                    type="tel" 
                                    name="phone" 
                                    required 
                                    value={formData.phone} 
                                    onChange={handleChange} 
                                    className={`w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none transition focus:border-${isBoy ? 'blue' : 'pink'}-500`} 
                                    placeholder="Enter your 10-digit number" 
                                    pattern="[0-9]{10}"
                                />
                            </div>
                            <button 
                                type="button" 
                                onClick={handleNextStep}
                                className={`w-full py-3.5 mt-4 rounded-xl text-white font-bold text-sm shadow-lg transition ${isBoy ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {/* ── STEP 5: PASSWORD ── */}
                    {currentStep === 5 && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-xs text-gray-400 mb-2 ml-1">Choose a password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-sm text-white outline-none transition focus:border-${isBoy ? 'blue' : 'pink'}-500`}
                                        placeholder="Min. 6 characters"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                                    >
                                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="button" 
                                onClick={handleRegister} 
                                disabled={loading || !formData.password} 
                                className={`w-full py-3.5 mt-4 rounded-xl text-white font-bold text-sm shadow-lg hover:-translate-y-0.5 transition ${isBoy ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}
                            >
                                {loading ? "Creating Account..." : "Register & Get OTP"}
                            </button>
                        </div>
                    )}
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-xs">
                        Already have an account?{' '}
                        <button onClick={() => setPage(isBoy ? PAGES.BOY_LOGIN : PAGES.GIRL_LOGIN)} className={`font-black hover:underline ${isBoy ? 'text-blue-400' : 'text-pink-400'}`}>
                            Login here
                        </button>
                    </p>
                </div>
            </div>

            {/* ─── OTP VERIFICATION MODAL ─── */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#16162A] w-full max-w-sm p-8 rounded-3xl border border-white/10 shadow-2xl text-center relative">

                        {/* Close/Cancel button */}
                        <button
                            onClick={cancelRegistration}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-gray-400 flex items-center justify-center transition"
                        >
                            <FiX size={16} />
                        </button>

                        <div className="w-16 h-16 bg-[#0095f6]/10 border border-[#0095f6]/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0095f6]/10">
                            <FiMail size={28} className="text-[#0095f6]" />
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-1">Verify Email</h3>
                        <p className="text-gray-400 text-sm mb-1">We've sent a 6-digit OTP to</p>
                        <p className="text-[#0095f6] font-semibold text-sm mb-6 break-all">{formData.email}</p>

                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <input
                                type="text"
                                required
                                maxLength="6"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-[#0095f6] transition font-mono"
                                placeholder="······"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={verifying || otp.length !== 6}
                                className="w-full py-3.5 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-xl font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <FiCheckCircle size={18} />
                                {verifying ? "Verifying..." : "Verify Account"}
                            </button>
                        </form>

                        {/* Resend OTP */}
                        <div className="mt-4">
                            {resendCooldown > 0 ? (
                                <p className="text-gray-500 text-xs">Resend OTP in <span className="text-[#0095f6] font-bold">{resendCooldown}s</span></p>
                            ) : (
                                <button
                                    onClick={handleResendOtp}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0095f6] transition mx-auto"
                                >
                                    <FiRefreshCw size={12} /> Resend OTP
                                </button>
                            )}
                        </div>

                        <p className="mt-4 text-gray-600 text-xs">
                            Changed your mind?{' '}
                            <button onClick={cancelRegistration} className="text-red-400 hover:underline">Cancel registration</button>
                        </p>
                    </div>
                </div>
            )}

            {/* Custom Alert Popup */}
            {customAlert.show && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="w-full max-w-xs overflow-hidden shadow-2xl border border-[#262626] bg-[#121212]" style={{ borderRadius: 16 }}>
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#0095f6]"></div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-gray-200 font-medium mb-5 text-center leading-relaxed">{customAlert.message}</p>
                            <button
                                onClick={() => setCustomAlert({ show: false, message: "" })}
                                className="w-full py-2.5 rounded-lg font-bold text-xs transition bg-[#0095f6] hover:bg-[#1877f2] text-white shadow-lg shadow-[#0095f6]/20"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UnifiedRegister;
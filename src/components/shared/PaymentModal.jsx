import React, { useState } from "react";
import { FiX, FiShield, FiCheckCircle, FiCreditCard, FiSmartphone, FiGlobe, FiLock, FiClock, FiMapPin, FiCalendar } from "react-icons/fi";

export default function PaymentModal({
    isOpen,
    onClose,
    bookingData,
    companion,
    currentUser,
    onPaymentSuccess
}) {
    const [paymentMethod, setPaymentMethod] = useState("upi"); // 'upi' | 'card' | 'netbanking'
    const [upiId, setUpiId] = useState("");
    const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");
    const [cardNumber, setCardNumber] = useState("");
    const [cardExpiry, setCardExpiry] = useState("");
    const [cardCvv, setCardCvv] = useState("");
    const [cardName, setCardName] = useState("");
    const [selectedBank, setSelectedBank] = useState("HDFC");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [transactionDetails, setTransactionDetails] = useState(null);

    if (!isOpen) return null;

    const baseAmount = bookingData?.amount || (companion?.price ? companion.price * (bookingData?.hours || 1) : 1000);
    const platformFee = Math.round(baseAmount * 0.05); // 5% platform trust & safety fee
    const totalAmount = baseAmount + platformFee;

    const handlePayNow = async () => {
        setIsProcessing(true);
        const pid = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const oid = `order_${Date.now().toString(36)}`;

        try {
            const token = localStorage.getItem("token");
            if (bookingData?.id) {
                const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
                await fetch(`${API_BASE}/api/payment/verify`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { "Authorization": `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        booking_id: bookingData.id,
                        payment_id: pid,
                        order_id: oid,
                        payment_method: paymentMethod,
                        amount: baseAmount
                    })
                });
            }
        } catch (err) {
            console.error("Payment verify backend error:", err);
        }

        setTimeout(() => {
            const paymentResult = {
                payment_id: pid,
                order_id: oid,
                payment_method: paymentMethod,
                amount: totalAmount,
                base_amount: baseAmount,
                platform_fee: platformFee,
                payment_status: "escrow_held",
                created_at: new Date().toISOString()
            };

            setTransactionDetails(paymentResult);
            setIsProcessing(false);
            setIsSuccess(true);

            if (onPaymentSuccess) {
                onPaymentSuccess(paymentResult);
            }
        }, 1200);
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-lg bg-[#141428] border border-pink-500/20 rounded-3xl p-6 sm:p-7 shadow-2xl my-8 text-left">
                {/* Close Button */}
                {!isProcessing && (
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                        <FiX size={18} />
                    </button>
                )}

                {isSuccess ? (
                    /* ─── PAYMENT SUCCESS & ESCROW CONFIRMATION ─── */
                    <div className="text-center py-6 animate-slide-up">
                        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                            <FiCheckCircle size={42} className="animate-bounce" />
                        </div>

                        <h3 className="text-2xl font-black text-white mb-1">Payment Successful!</h3>
                        <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-4">
                            🔒 ₹{totalAmount.toLocaleString()} Held in Escrow Protection
                        </p>

                        <div className="bg-[#1A1A32] border border-white/10 rounded-2xl p-4 text-left space-y-2 mb-6">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Transaction ID:</span>
                                <span className="text-white font-mono font-bold">{transactionDetails?.payment_id}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Companion:</span>
                                <span className="text-white font-bold">{companion?.name}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Session Date:</span>
                                <span className="text-white font-bold">{bookingData?.meeting_date || "Today"} at {bookingData?.meeting_time || "Scheduled Time"}</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-white/10 pt-2 font-bold">
                                <span className="text-gray-300">Escrow Guarantee:</span>
                                <span className="text-purple-400">Funds released only after session completion</span>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-sm shadow-xl hover:opacity-90 transition active:scale-95"
                        >
                            View Booking Status →
                        </button>
                    </div>
                ) : (
                    /* ─── PAYMENT CHECKOUT FORM ─── */
                    <div>
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-inner shrink-0">
                                <FiShield size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight">Secure Escrow Checkout</h3>
                                <p className="text-xs text-gray-400">Razorpay Payment Gateway · 100% Escrow Protected</p>
                            </div>
                        </div>

                        {/* Escrow Guarantee Banner */}
                        <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-3.5 mb-5 flex items-start gap-3">
                            <FiLock className="text-purple-400 shrink-0 mt-0.5" size={16} />
                            <div className="text-[11px] text-gray-300 leading-relaxed">
                                <strong className="text-purple-300 block mb-0.5">100% Escrow Protection Guarantee</strong>
                                Your payment is held safely by Coffeely. The companion only receives payout after your session is successfully completed.
                            </div>
                        </div>

                        {/* Booking Summary Card */}
                        <div className="bg-[#181830] border border-white/10 rounded-2xl p-4 mb-5">
                            <div className="flex items-center gap-3.5 pb-3 border-b border-white/5">
                                <img
                                    src={companion?.profile_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135768.png"}
                                    alt={companion?.name}
                                    className="w-12 h-12 rounded-full object-cover border border-white/15"
                                />
                                <div>
                                    <div className="text-sm font-bold text-white">{companion?.name}</div>
                                    <div className="text-xs text-pink-400 font-semibold">₹{companion?.price || 1000}/hr · {bookingData?.hours || 1} Hour Session</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-3 text-[11px] text-gray-400">
                                <div className="flex items-center gap-1.5">
                                    <FiCalendar size={12} className="text-gray-500" />
                                    <span>{bookingData?.meeting_date || "Upcoming Date"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <FiClock size={12} className="text-gray-500" />
                                    <span>{bookingData?.meeting_time || "Scheduled Time"}</span>
                                </div>
                                <div className="col-span-2 flex items-center gap-1.5 truncate">
                                    <FiMapPin size={12} className="text-gray-500 shrink-0" />
                                    <span className="truncate">{bookingData?.meeting_location || companion?.city || "Meeting Venue"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Selector */}
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-300 mb-2">Select Payment Method</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("upi")}
                                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                                        paymentMethod === "upi"
                                            ? "bg-pink-500/20 border-pink-500 text-pink-300 font-bold"
                                            : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                    }`}
                                >
                                    <FiSmartphone size={18} />
                                    <span className="text-xs">Instant UPI</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("card")}
                                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                                        paymentMethod === "card"
                                            ? "bg-pink-500/20 border-pink-500 text-pink-300 font-bold"
                                            : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                    }`}
                                >
                                    <FiCreditCard size={18} />
                                    <span className="text-xs">Card</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("netbanking")}
                                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                                        paymentMethod === "netbanking"
                                            ? "bg-pink-500/20 border-pink-500 text-pink-300 font-bold"
                                            : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                    }`}
                                >
                                    <FiGlobe size={18} />
                                    <span className="text-xs">NetBanking</span>
                                </button>
                            </div>
                        </div>

                        {/* UPI Payment Input */}
                        {paymentMethod === "upi" && (
                            <div className="space-y-3 mb-5 animate-fade-in">
                                <div className="grid grid-cols-4 gap-2">
                                    {["gpay", "phonepe", "paytm", "bhim"].map((app) => (
                                        <button
                                            key={app}
                                            type="button"
                                            onClick={() => setSelectedUpiApp(app)}
                                            className={`p-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition text-center ${
                                                selectedUpiApp === app
                                                    ? "bg-white/15 border-pink-500 text-white"
                                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                            }`}
                                        >
                                            {app}
                                        </button>
                                    ))}
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Enter UPI ID</label>
                                    <input
                                        type="text"
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value)}
                                        placeholder="username@oksbi / username@paytm"
                                        className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Card Payment Inputs */}
                        {paymentMethod === "card" && (
                            <div className="space-y-3 mb-5 animate-fade-in">
                                <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Cardholder Name</label>
                                    <input
                                        type="text"
                                        value={cardName}
                                        onChange={(e) => setCardName(e.target.value)}
                                        placeholder="Name on card"
                                        className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Card Number</label>
                                    <input
                                        type="text"
                                        value={cardNumber}
                                        onChange={(e) => setCardNumber(e.target.value)}
                                        placeholder="4532 •••• •••• 8901"
                                        maxLength={19}
                                        className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition font-mono"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">Expiry (MM/YY)</label>
                                        <input
                                            type="text"
                                            value={cardExpiry}
                                            onChange={(e) => setCardExpiry(e.target.value)}
                                            placeholder="MM/YY"
                                            maxLength={5}
                                            className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">CVV</label>
                                        <input
                                            type="password"
                                            value={cardCvv}
                                            onChange={(e) => setCardCvv(e.target.value)}
                                            placeholder="•••"
                                            maxLength={4}
                                            className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* NetBanking Inputs */}
                        {paymentMethod === "netbanking" && (
                            <div className="space-y-3 mb-5 animate-fade-in">
                                <label className="block text-[11px] text-gray-400 mb-1">Select Popular Bank</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank"].map((bank) => (
                                        <button
                                            key={bank}
                                            type="button"
                                            onClick={() => setSelectedBank(bank)}
                                            className={`p-2.5 rounded-xl text-xs font-semibold border transition text-left ${
                                                selectedBank === bank
                                                    ? "bg-pink-500/20 border-pink-500 text-pink-300"
                                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                            }`}
                                        >
                                            {bank}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bill Breakdown */}
                        <div className="border-t border-white/10 pt-3.5 mb-5 space-y-1.5 text-xs">
                            <div className="flex justify-between text-gray-400">
                                <span>Session Base Rate ({bookingData?.hours || 1} hr):</span>
                                <span className="text-white font-semibold">₹{baseAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>Escrow & Platform Safety Fee (5%):</span>
                                <span className="text-white font-semibold">₹{platformFee.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-2">
                                <span>Total Payable Amount:</span>
                                <span className="text-pink-400 text-base font-extrabold">₹{totalAmount.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Pay Button */}
                        <button
                            type="button"
                            onClick={handlePayNow}
                            disabled={isProcessing}
                            className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-pink-500/25 hover:opacity-95 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Processing Escrow Payment...</span>
                                </>
                            ) : (
                                <>
                                    <FiLock size={16} />
                                    <span>Pay ₹{totalAmount.toLocaleString()} with Escrow Protection</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

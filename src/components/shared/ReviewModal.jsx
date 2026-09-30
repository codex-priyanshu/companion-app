import React, { useState } from "react";
import { FiX, FiStar, FiCheck, FiShield, FiHeart, FiClock, FiMessageCircle, FiSmile } from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";

const AVAILABLE_COMPLIMENTS = [
    "Great Listener 💬",
    "Super Polite 😊",
    "Punctual ⏰",
    "Fun & Energetic ✨",
    "Comfortable & Safe 🛡️",
    "Thoughtful & Smart 💡",
    "Elegant & Stylish 👗",
    "Great Conversationalist ☕"
];

const RATING_LABELS = {
    5: "🌟 5/5 — Phenomenal Experience!",
    4: "⭐ 4/5 — Very Good & Polite",
    3: "⭐ 3/5 — Decent Date Session",
    2: "⭐ 2/5 — Below Expectations",
    1: "⭐ 1/5 — Poor Experience"
};

export default function ReviewModal({
    isOpen,
    onClose,
    companion,
    bookingId,
    onReviewSubmitted
}) {
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(5);
    const [comment, setComment] = useState("");
    const [selectedCompliments, setSelectedCompliments] = useState(["Great Listener 💬", "Super Polite 😊"]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    if (!isOpen || !companion) return null;

    const toggleCompliment = (comp) => {
        if (selectedCompliments.includes(comp)) {
            setSelectedCompliments(selectedCompliments.filter(c => c !== comp));
        } else {
            if (selectedCompliments.length >= 5) return;
            setSelectedCompliments([...selectedCompliments, comp]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!rating) {
            setErrorMsg("Please select a star rating");
            return;
        }

        setIsSubmitting(true);
        setErrorMsg("");

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE}/api/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    companion_id: companion.id,
                    booking_id: bookingId || null,
                    rating,
                    comment,
                    compliment_tags: selectedCompliments
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (onReviewSubmitted) onReviewSubmitted(data);
                onClose();
            } else {
                setErrorMsg(data.error || "Failed to submit review");
            }
        } catch (err) {
            console.error("Submit review error:", err);
            setErrorMsg("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeRating = hoverRating || rating;

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-lg bg-[#141428] border border-pink-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl my-8 text-left animate-slide-up">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                >
                    <FiX size={18} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-white/10">
                    <img
                        src={companion.profile_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135768.png"}
                        alt={companion.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-pink-500/40 shadow-lg"
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white">Review & Rate</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <FiShield size={10} /> Verified Client
                            </span>
                        </div>
                        <p className="text-xs text-gray-400">Share your experience with <strong>{companion.name}</strong></p>
                    </div>
                </div>

                {errorMsg && (
                    <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500/50 text-red-300 text-xs font-semibold">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Star Rating Selector */}
                    <div className="text-center py-2 bg-[#181832] rounded-2xl border border-white/5 p-4">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Overall Date Experience
                        </label>
                        <div className="flex justify-center items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="p-1 transition transform hover:scale-125 focus:outline-none"
                                >
                                    <FiStar
                                        size={32}
                                        className={
                                            star <= activeRating
                                                ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                                                : "text-gray-600"
                                        }
                                    />
                                </button>
                            ))}
                        </div>
                        <div className="text-xs font-bold text-pink-300 mt-2">
                            {RATING_LABELS[activeRating]}
                        </div>
                    </div>

                    {/* Compliment Tags Selector */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <FiSmile size={14} className="text-pink-400" /> Compliments (Up to 5)
                            </label>
                            <span className="text-[10px] text-gray-500">{selectedCompliments.length}/5 selected</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {AVAILABLE_COMPLIMENTS.map((comp) => {
                                const isSelected = selectedCompliments.includes(comp);
                                return (
                                    <button
                                        key={comp}
                                        type="button"
                                        onClick={() => toggleCompliment(comp)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                                            isSelected
                                                ? "bg-gradient-to-r from-pink-500/30 to-purple-600/30 border-pink-500 text-pink-200 shadow-md scale-105"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                                        }`}
                                    >
                                        {comp}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Written Comment */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-bold text-gray-300">Your Written Feedback</label>
                            <span className="text-[10px] text-gray-500">{comment.length}/800</span>
                        </div>
                        <textarea
                            rows={3}
                            maxLength={800}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="How was the conversation? Would you recommend them to others?"
                            className="w-full bg-[#181830] border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition resize-none"
                        />
                    </div>

                    {/* Verified Guarantee Seal */}
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <FiCheck size={16} />
                        </div>
                        <div className="text-[11px] text-gray-300">
                            <strong>Verified Authentic Review:</strong> Your feedback helps build trust in the Coffeely community and displays a verified badge.
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-2xl font-bold text-xs shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Posting Your Review...</span>
                            </>
                        ) : (
                            <>
                                <FiStar size={15} className="fill-white" />
                                <span>Submit Review & Rating</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

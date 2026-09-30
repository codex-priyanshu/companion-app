import React, { useState, useEffect } from "react";
import { FiStar, FiShield, FiThumbsUp, FiMessageCircle, FiSmile, FiPlus, FiCheck } from "react-icons/fi";
import ReviewModal from "./ReviewModal";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";

export default function ReviewsSection({ companion, currentUser, onReviewAdded }) {
    const [reviewsData, setReviewsData] = useState({
        reviews: [],
        avgRating: 0,
        totalReviews: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        topCompliments: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filterRating, setFilterRating] = useState(0); // 0 = all
    const [actionLoading, setActionLoading] = useState({});

    const fetchReviews = async () => {
        if (!companion?.id) return;
        setIsLoading(true);
        try {
            const url = currentUser?.id 
                ? `${API_BASE}/api/reviews/${companion.id}?currentUserId=${currentUser.id}`
                : `${API_BASE}/api/reviews/${companion.id}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setReviewsData(data);
            }
        } catch (err) {
            console.error("Fetch reviews error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [companion?.id, currentUser?.id]);

    const handleHelpfulToggle = async (reviewId) => {
        if (!currentUser) {
            alert("Please login to vote on reviews.");
            return;
        }

        setActionLoading(prev => ({ ...prev, [reviewId]: true }));
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE}/api/reviews/${reviewId}/helpful`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                }
            });

            if (res.ok) {
                const data = await res.json();
                setReviewsData(prev => ({
                    ...prev,
                    reviews: prev.reviews.map(r => {
                        if (r.id === reviewId) {
                            return {
                                ...r,
                                helpful_count: data.helpful_count,
                                has_voted_helpful: data.hasVoted
                            };
                        }
                        return r;
                    })
                }));
            }
        } catch (err) {
            console.error("Helpful vote error:", err);
        } finally {
            setActionLoading(prev => ({ ...prev, [reviewId]: false }));
        }
    };

    const handleReviewSubmitted = (newReview) => {
        fetchReviews();
        if (onReviewAdded) onReviewAdded(newReview);
    };

    const filteredReviews = filterRating > 0
        ? reviewsData.reviews.filter(r => r.rating === filterRating)
        : reviewsData.reviews;

    const total = reviewsData.totalReviews || 1;

    return (
        <div className="space-y-6 text-left">
            {/* ─── OVERALL SCORE & BREAKDOWN CARD ─── */}
            <div className="bg-[#141428] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    {/* Score summary */}
                    <div className="text-center md:text-left flex flex-col items-center md:items-start justify-center md:border-r border-white/10 md:pr-6">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl sm:text-5xl font-black text-white">{reviewsData.avgRating || companion?.rating || "5.0"}</span>
                            <span className="text-gray-400 font-bold text-sm">/ 5.0</span>
                        </div>
                        <div className="flex items-center gap-1 my-2">
                            {[1, 2, 3, 4, 5].map(s => (
                                <FiStar
                                    key={s}
                                    size={18}
                                    className={
                                        s <= Math.round(reviewsData.avgRating || companion?.rating || 5)
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-gray-600"
                                    }
                                />
                            ))}
                        </div>
                        <p className="text-xs text-gray-400">
                            Based on <strong className="text-white">{reviewsData.totalReviews}</strong> verified reviews
                        </p>

                        {/* Write review button */}
                        {currentUser && currentUser.id !== companion?.id && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-xs font-bold shadow-lg hover:opacity-90 active:scale-95 transition flex items-center gap-1.5"
                            >
                                <FiPlus size={14} /> Write a Review
                            </button>
                        )}
                    </div>

                    {/* Star Progress Bars */}
                    <div className="space-y-1.5 md:col-span-2">
                        {[5, 4, 3, 2, 1].map((stars) => {
                            const count = reviewsData.breakdown[stars] || 0;
                            const pct = Math.round((count / total) * 100) || 0;
                            const isSelected = filterRating === stars;

                            return (
                                <button
                                    key={stars}
                                    type="button"
                                    onClick={() => setFilterRating(isSelected ? 0 : stars)}
                                    className={`w-full flex items-center gap-3 text-xs p-1 rounded-xl transition ${
                                        isSelected ? "bg-white/10" : "hover:bg-white/5"
                                    }`}
                                >
                                    <span className="w-8 font-bold text-gray-400 text-left">{stars} ★</span>
                                    <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                stars >= 4 ? "bg-gradient-to-r from-amber-400 to-pink-500" : "bg-gray-600"
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className="w-8 text-[11px] text-gray-400 text-right font-mono">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ─── TOP COMPLIMENTS CHIPS ─── */}
                {reviewsData.topCompliments.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-white/5">
                        <div className="text-xs font-bold text-gray-400 mb-2.5 flex items-center gap-1.5">
                            <FiSmile className="text-pink-400" /> Top Praised Highlights
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {reviewsData.topCompliments.map((comp) => (
                                <div
                                    key={comp.tag}
                                    className="px-3 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold flex items-center gap-1.5"
                                >
                                    <span>{comp.tag}</span>
                                    <span className="px-1.5 py-0.2 rounded-full bg-pink-500/30 text-[10px] font-bold">
                                        ×{comp.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── REVIEWS LIST ─── */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Client Reviews</span>
                        {filterRating > 0 && (
                            <span className="text-xs text-pink-400 font-normal">
                                (Filtered: {filterRating} ★ · <button onClick={() => setFilterRating(0)} className="underline hover:text-white">Clear</button>)
                            </span>
                        )}
                    </h3>
                    <span className="text-xs text-gray-500">{filteredReviews.length} reviews</span>
                </div>

                {filteredReviews.length === 0 ? (
                    <div className="bg-[#141428] border border-white/5 rounded-3xl p-8 text-center text-gray-500 text-xs">
                        <FiMessageCircle size={32} className="mx-auto mb-2 opacity-40 text-pink-400" />
                        <p className="font-semibold text-gray-400">No reviews found yet.</p>
                        <p className="text-[11px] text-gray-600 mt-1">Be the first verified client to leave a review for {companion.name}!</p>
                    </div>
                ) : (
                    <div className="space-y-3.5">
                        {filteredReviews.map((r) => (
                            <div key={r.id} className="bg-[#141428] border border-white/5 hover:border-white/10 rounded-2xl p-4 sm:p-5 transition">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        {r.reviewer_pic ? (
                                            <img
                                                src={r.reviewer_pic}
                                                alt={r.reviewer_name}
                                                className="w-10 h-10 rounded-full object-cover border border-white/15"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                {r.reviewer_name?.[0]?.toUpperCase() || "U"}
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-xs sm:text-sm">{r.reviewer_name}</span>
                                                {r.is_verified_booking && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                                                        <FiCheck size={10} /> Verified Client
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <FiStar
                                                        key={star}
                                                        size={12}
                                                        className={
                                                            star <= r.rating
                                                                ? "fill-amber-400 text-amber-400"
                                                                : "text-gray-700"
                                                        }
                                                    />
                                                ))}
                                                <span className="text-[10px] text-gray-500 ml-1.5">
                                                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Helpful button */}
                                    <button
                                        onClick={() => handleHelpfulToggle(r.id)}
                                        disabled={actionLoading[r.id]}
                                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 border ${
                                            r.has_voted_helpful
                                                ? "bg-pink-500/20 border-pink-500 text-pink-300"
                                                : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                                        }`}
                                    >
                                        <FiThumbsUp size={12} className={r.has_voted_helpful ? "fill-pink-400" : ""} />
                                        <span>{r.helpful_count || 0}</span>
                                    </button>
                                </div>

                                {/* Compliments Badges */}
                                {Array.isArray(r.compliment_tags) && r.compliment_tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                                        {r.compliment_tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/5 text-gray-300 text-[10px] font-medium"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Review text */}
                                {r.comment && (
                                    <p className="text-xs text-gray-300 leading-relaxed bg-[#0E0E1C] p-3 rounded-xl border border-white/5">
                                        "{r.comment}"
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── MODAL ─── */}
            <ReviewModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                companion={companion}
                onReviewSubmitted={handleReviewSubmitted}
            />
        </div>
    );
}

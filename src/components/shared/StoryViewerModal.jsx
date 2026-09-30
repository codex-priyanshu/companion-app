import React, { useState, useEffect, useRef } from "react";
import { 
    FiX, FiTrash2, FiChevronLeft, FiChevronRight, FiEye, 
    FiChevronUp, FiVolume2, FiVolumeX, FiSend, FiCheck
} from "react-icons/fi";

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "👏", "😮", "🥂"];

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function StoryViewerModal({ userStoriesList, initialUserIndex = 0, currentUser, onClose, onStoryDeleted }) {
    const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(true);

    // Viewers Drawer State (for story owners)
    const [showViewersDrawer, setShowViewersDrawer] = useState(false);
    const [viewersList, setViewersList] = useState([]);
    const [loadingViewers, setLoadingViewers] = useState(false);

    // Viewer Interaction State (for non-owners)
    const [replyText, setReplyText] = useState("");
    const [sendingReply, setSendingReply] = useState(false);
    const [reactionToast, setReactionToast] = useState("");
    const [flyingEmoji, setFlyingEmoji] = useState(null);

    const timerRef = useRef(null);
    const videoElementRef = useRef(null);

    const currentUserStoryGroup = userStoriesList[currentUserIndex];
    const currentStoryItem = currentUserStoryGroup?.items[currentItemIndex];
    const isOwnStory = currentUser && currentUserStoryGroup && currentUser.id === currentUserStoryGroup.user_id;

    const isVideo = Boolean(
        currentStoryItem?.media_url && (
            /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(currentStoryItem.media_url) ||
            currentStoryItem.media_url.startsWith("data:video")
        )
    );

    const DURATION = isVideo ? 10000 : 5000; // 10s for video, 5s for photo

    // ─── 1. RECORD VIEW IN BACKEND (When viewing others' story) ───
    useEffect(() => {
        if (!currentStoryItem || !currentUser || isOwnStory) return;

        const token = localStorage.getItem("token");
        if (!token) return;

        fetch(`${API}/stories/${currentStoryItem.id}/view`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        }).catch((err) => console.error("Story view recording error:", err));
    }, [currentStoryItem?.id, currentUser?.id, isOwnStory]);

    // ─── 2. RESET PROGRESS ON ITEM CHANGE ───
    useEffect(() => {
        setProgress(0);
        setShowViewersDrawer(false);
        setReplyText("");
    }, [currentUserIndex, currentItemIndex]);

    // ─── 3. STORY TIMER & AUTO-ADVANCE ───
    useEffect(() => {
        if (isPaused || showViewersDrawer) return;

        const intervalTime = 50; // update every 50ms
        const step = (intervalTime / DURATION) * 100;

        timerRef.current = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    handleNext();
                    return 0;
                }
                return prev + step;
            });
        }, intervalTime);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPaused, showViewersDrawer, currentUserIndex, currentItemIndex, DURATION, currentUserStoryGroup]);

    // ─── 4. KEYBOARD NAVIGATION ───
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                handleNext();
            } else if (e.key === "ArrowLeft") {
                handlePrev();
            } else if (e.key === "Escape") {
                if (showViewersDrawer) {
                    setShowViewersDrawer(false);
                } else {
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showViewersDrawer, currentUserIndex, currentItemIndex, currentUserStoryGroup]);

    const handleNext = () => {
        if (!currentUserStoryGroup) return;
        if (currentItemIndex < currentUserStoryGroup.items.length - 1) {
            setCurrentItemIndex((prev) => prev + 1);
        } else if (currentUserIndex < userStoriesList.length - 1) {
            setCurrentUserIndex((prev) => prev + 1);
            setCurrentItemIndex(0);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentItemIndex > 0) {
            setCurrentItemIndex((prev) => prev - 1);
        } else if (currentUserIndex > 0) {
            setCurrentUserIndex((prev) => prev - 1);
            const prevGroup = userStoriesList[currentUserIndex - 1];
            setCurrentItemIndex(prevGroup.items.length - 1);
        }
    };

    // ─── 5. FETCH VIEWERS (FOR STORY OWNER) ───
    const handleOpenViewers = async () => {
        if (!currentStoryItem) return;
        setIsPaused(true);
        setShowViewersDrawer(true);
        setLoadingViewers(true);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/stories/${currentStoryItem.id}/viewers`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setViewersList(data.viewers || []);
            }
        } catch (err) {
            console.error("Fetch viewers error:", err);
        } finally {
            setLoadingViewers(false);
        }
    };

    // ─── 6. DELETE STORY ───
    const handleDelete = async () => {
        if (!currentStoryItem) return;
        if (!window.confirm("Are you sure you want to delete this story?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/stories/${currentStoryItem.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                if (onStoryDeleted) onStoryDeleted(currentStoryItem.id);
                handleNext();
            }
        } catch (e) {
            console.error("Failed to delete story:", e);
        }
    };

    // ─── 7. SEND QUICK REACTION EMOJI ───
    const handleSendReaction = async (emoji) => {
        if (!currentUserStoryGroup || !currentUser) return;
        setFlyingEmoji(emoji);
        setReactionToast(`Sent ${emoji}!`);
        setTimeout(() => setFlyingEmoji(null), 1200);
        setTimeout(() => setReactionToast(""), 2000);

        try {
            const token = localStorage.getItem("token");
            await fetch(`${API}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    receiver_id: currentUserStoryGroup.user_id,
                    text: `Reacted ${emoji} to your story`
                })
            });
        } catch (e) {
            console.error("Reaction send error:", e);
        }
    };

    // ─── 8. SEND STORY DIRECT MESSAGE ───
    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !currentUserStoryGroup || !currentUser) return;

        setSendingReply(true);
        try {
            const token = localStorage.getItem("token");
            await fetch(`${API}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    receiver_id: currentUserStoryGroup.user_id,
                    text: `Replied to story: "${replyText.trim()}"`
                })
            });

            setReplyText("");
            setReactionToast("Message sent! 💬");
            setTimeout(() => setReactionToast(""), 2200);
        } catch (err) {
            console.error("Reply send error:", err);
        } finally {
            setSendingReply(false);
        }
    };

    if (!currentUserStoryGroup || !currentStoryItem) return null;

    const timeAgo = (() => {
        const diff = Date.now() - new Date(currentStoryItem.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ago`;
    })();

    const viewerCount = currentStoryItem.view_count || viewersList.length || 0;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex items-center justify-center select-none animate-fade-in">
            {/* Desktop Navigation Arrows */}
            {(currentUserIndex > 0 || currentItemIndex > 0) && (
                <button
                    onClick={handlePrev}
                    className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition z-50 shadow-2xl backdrop-blur-md"
                >
                    <FiChevronLeft size={24} />
                </button>
            )}

            {(currentUserIndex < userStoriesList.length - 1 || currentItemIndex < currentUserStoryGroup.items.length - 1) && (
                <button
                    onClick={handleNext}
                    className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition z-50 shadow-2xl backdrop-blur-md"
                >
                    <FiChevronRight size={24} />
                </button>
            )}

            {/* Flying Emoji Animation */}
            {flyingEmoji && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[10000]">
                    <span className="text-7xl animate-bounce drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                        {flyingEmoji}
                    </span>
                </div>
            )}

            {/* Floating Toast Notice */}
            {reactionToast && (
                <div className="absolute top-20 z-[10000] bg-white/20 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-2xl animate-fade-in flex items-center gap-1.5">
                    <FiCheck size={14} className="text-pink-400" />
                    <span>{reactionToast}</span>
                </div>
            )}

            {/* Main Story Phone Box */}
            <div
                className="relative w-full h-full sm:max-w-md sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-[#0D0D1A] border border-white/10 flex flex-col justify-between shadow-2xl"
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
            >
                {/* ─── Top Segmented Progress Bars ─── */}
                <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5">
                    {currentUserStoryGroup.items.map((item, idx) => (
                        <div key={item.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-75"
                                style={{
                                    width:
                                        idx < currentItemIndex
                                            ? "100%"
                                            : idx === currentItemIndex
                                            ? `${progress}%`
                                            : "0%"
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* ─── Top User Header ─── */}
                <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img
                            src={currentUserStoryGroup.user_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                            alt={currentUserStoryGroup.user_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-pink-500 shadow-md"
                        />
                        <div>
                            <div className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
                                <span>{currentUserStoryGroup.user_name}</span>
                                <span className="text-[10px] text-gray-300 font-normal">· {timeAgo}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">
                                @{currentUserStoryGroup.user_username || "companion"}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Video Mute / Unmute Button */}
                        {isVideo && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMuted(!isMuted);
                                }}
                                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition backdrop-blur-md"
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? <FiVolumeX size={15} /> : <FiVolume2 size={15} />}
                            </button>
                        )}

                        {/* Owner Delete Button */}
                        {isOwnStory && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete();
                                }}
                                className="w-8 h-8 rounded-full bg-black/50 hover:bg-red-500/90 text-white flex items-center justify-center transition backdrop-blur-md"
                                title="Delete Story"
                            >
                                <FiTrash2 size={14} />
                            </button>
                        )}

                        {/* Close Story Modal */}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-black/50 hover:bg-white/20 text-white flex items-center justify-center transition backdrop-blur-md"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ─── Media Presentation Area (Image or Video) ─── */}
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                    {isVideo ? (
                        <video
                            ref={videoElementRef}
                            src={currentStoryItem.media_url}
                            autoPlay
                            playsInline
                            muted={isMuted}
                            loop
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            src={currentStoryItem.media_url}
                            alt="Story content"
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* Tap zones for previous/next */}
                    <div
                        className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePrev();
                        }}
                    />
                    <div
                        className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNext();
                        }}
                    />
                </div>

                {/* ─── Bottom Story Overlay ─── */}
                <div className="absolute bottom-0 inset-x-0 p-4 pt-12 bg-gradient-to-t from-black via-black/80 to-transparent z-30 space-y-3">
                    {/* Caption */}
                    {currentStoryItem.caption && (
                        <p className="text-white text-sm leading-relaxed text-center font-medium drop-shadow-md px-2">
                            {currentStoryItem.caption}
                        </p>
                    )}

                    {/* ─── Story Owner Experience: Viewers Pill ─── */}
                    {isOwnStory ? (
                        <div className="flex items-center justify-center pt-1">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenViewers();
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-semibold border border-white/15 transition active:scale-95 shadow-lg"
                            >
                                <FiEye size={14} className="text-pink-400" />
                                <span>{viewerCount} {viewerCount === 1 ? "view" : "views"}</span>
                                <FiChevronUp size={14} className="text-gray-400" />
                            </button>
                        </div>
                    ) : (
                        /* ─── Story Viewer Experience: Quick Emojis & DM Input ─── */
                        <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            {/* Quick Emoji Reaction Chips */}
                            <div className="flex items-center justify-center gap-2">
                                {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleSendReaction(emoji)}
                                        className="w-9 h-9 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur-md text-lg flex items-center justify-center transition active:scale-90 border border-white/10"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>

                            {/* Direct Message Input */}
                            <form onSubmit={handleSendReply} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Send message..."
                                    value={replyText}
                                    onFocus={() => setIsPaused(true)}
                                    onBlur={() => setIsPaused(false)}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="flex-1 bg-black/60 border border-white/20 rounded-full px-4 py-2.5 text-xs text-white placeholder-gray-400 outline-none focus:border-pink-500 backdrop-blur-md transition"
                                />
                                {replyText.trim() && (
                                    <button
                                        type="submit"
                                        disabled={sendingReply}
                                        className="w-9 h-9 rounded-full bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] text-white flex items-center justify-center shadow-lg active:scale-90 transition disabled:opacity-50"
                                    >
                                        <FiSend size={14} />
                                    </button>
                                )}
                            </form>
                        </div>
                    )}
                </div>

                {/* ─── Story Viewers Bottom Sheet Drawer (For Story Owner) ─── */}
                {showViewersDrawer && (
                    <div 
                        className="absolute inset-x-0 bottom-0 z-40 bg-[#16162A] border-t border-white/15 rounded-t-3xl p-5 max-h-[70%] flex flex-col shadow-2xl animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Bar & Header */}
                        <div className="flex flex-col items-center mb-3">
                            <div className="w-12 h-1 bg-white/20 rounded-full mb-3" />
                            <div className="w-full flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FiEye className="text-pink-400" size={16} />
                                    <h4 className="text-sm font-bold text-white">
                                        Viewers ({viewersList.length})
                                    </h4>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowViewersDrawer(false);
                                        setIsPaused(false);
                                    }}
                                    className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition"
                                >
                                    <FiX size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Viewers List */}
                        <div className="overflow-y-auto flex-1 divide-y divide-white/5 pr-1 scrollbar-none">
                            {loadingViewers ? (
                                <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                                    <span>Loading viewers...</span>
                                </div>
                            ) : viewersList.length === 0 ? (
                                <div className="py-8 text-center text-xs text-gray-400">
                                    <p className="text-gray-300 font-semibold mb-1">No views yet</p>
                                    <p className="text-[11px] text-gray-500">When people view your story, they will show up here.</p>
                                </div>
                            ) : (
                                viewersList.map((viewer) => {
                                    const viewTime = (() => {
                                        const diff = Date.now() - new Date(viewer.viewed_at).getTime();
                                        const mins = Math.floor(diff / 60000);
                                        if (mins < 60) return `${mins}m ago`;
                                        const hrs = Math.floor(mins / 60);
                                        return `${hrs}h ago`;
                                    })();

                                    return (
                                        <div key={viewer.id} className="py-2.5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={viewer.profile_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                                    alt={viewer.name}
                                                    className="w-9 h-9 rounded-full object-cover border border-white/10"
                                                />
                                                <div>
                                                    <div className="text-white text-xs font-bold leading-tight">
                                                        {viewer.name}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">
                                                        @{viewer.username || "companion"}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-400">
                                                {viewTime}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StoryViewerModal;

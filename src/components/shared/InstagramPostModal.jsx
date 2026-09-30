import React, { useState, useEffect, useRef } from "react";
import { FiHeart, FiMessageCircle, FiX, FiTrash2, FiSend, FiMoreVertical, FiShare2, FiInfo, FiChevronLeft, FiChevronRight, FiMapPin } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function InstagramPostModal({ posts = [], initialPostId, postOwner, currentUser, onClose, onDelete }) {
    // Current active post ID (used for Desktop navigation)
    const [activePostId, setActivePostId] = useState(initialPostId);
    
    // Cache for comments & like details per post ID
    const [postsDetails, setPostsDetails] = useState({});
    const [commentsMap, setCommentsMap] = useState({});
    const [newCommentTexts, setNewCommentTexts] = useState({});
    
    // Drawer/Sheet states
    const [optionsPost, setOptionsPost] = useState(null); // Post for which 3-dots sheet is open
    const [commentsPost, setCommentsPost] = useState(null); // Post for which mobile comments sheet is open
    const [showAboutUser, setShowAboutUser] = useState(false); // "About this account" modal

    const token = localStorage.getItem("token");
    const containerRef = useRef(null);

    // Get current active post index for desktop
    const activeIndex = posts.findIndex(p => p.id === activePostId);
    const activePost = posts[activeIndex] || posts[0] || {};

    // 1. Fetch details (likes/status) & comments for a post
    const loadPostDetails = async (postId) => {
        if (!postId || postsDetails[postId]) return;
        try {
            const headers = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API}/posts/detail/${postId}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setPostsDetails(prev => ({ ...prev, [postId]: data }));
            }
        } catch (err) {
            console.error("Error fetching post detail:", err);
        }
    };

    const loadPostComments = async (postId) => {
        if (!postId || commentsMap[postId]) return;
        try {
            const res = await fetch(`${API}/comments/${postId}`);
            if (res.ok) {
                const data = await res.json();
                setCommentsMap(prev => ({ ...prev, [postId]: data }));
            }
        } catch (err) {
            console.error("Error fetching comments:", err);
        }
    };

    // Load active post details on desktop
    useEffect(() => {
        if (activePost?.id) {
            loadPostDetails(activePost.id);
            loadPostComments(activePost.id);
        }
    }, [activePostId, activePost?.id]);

    // On mobile: Load details for all visible posts and scroll to initial post
    useEffect(() => {
        if (posts.length > 0) {
            posts.forEach(p => {
                loadPostDetails(p.id);
                loadPostComments(p.id);
            });

            // Scroll to the clicked post on mobile
            setTimeout(() => {
                const element = document.getElementById(`mobile-post-${initialPostId}`);
                if (element) {
                    element.scrollIntoView({ block: "start", behavior: "smooth" });
                }
            }, 300);
        }
    }, [posts, initialPostId]);

    // Handle Like Toggle
    const handleLikeToggle = async (postId) => {
        if (!currentUser) {
            alert("Please login to like this post!");
            return;
        }

        try {
            const res = await fetch(`${API}/like`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ post_id: postId })
            });

            if (res.ok) {
                const data = await res.json();
                
                // Update local postsDetails state
                setPostsDetails(prev => {
                    const currentDetail = prev[postId] || posts.find(p => p.id === postId) || {};
                    const prevLikes = Number(currentDetail.total_likes || 0);
                    return {
                        ...prev,
                        [postId]: {
                            ...currentDetail,
                            is_liked_by_me: data.isLiked,
                            total_likes: data.isLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
                        }
                    };
                });
            }
        } catch (err) {
            console.error("Error liking post:", err);
        }
    };

    // Submit Comment
    const handleAddComment = async (e, postId) => {
        e.preventDefault();
        if (!currentUser) {
            alert("Please login to write a comment!");
            return;
        }
        const commentText = newCommentTexts[postId] || "";
        if (!commentText.trim()) return;

        try {
            const res = await fetch(`${API}/comment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ post_id: postId, text: commentText })
            });

            if (res.ok) {
                const newComment = await res.json();
                const commentObj = {
                    ...newComment,
                    user_name: currentUser.name,
                    user_pic: currentUser.profile_pic
                };
                
                setCommentsMap(prev => ({
                    ...prev,
                    [postId]: [...(prev[postId] || []), commentObj]
                }));
                
                setNewCommentTexts(prev => ({ ...prev, [postId]: "" }));
            } else {
                const err = await res.json();
                alert(err.error || "Inappropriate words found. Please keep comment clean.");
            }
        } catch (err) {
            console.error("Error posting comment:", err);
        }
    };

    // Share link copy
    const handleSharePost = (postId) => {
        const shareUrl = `${window.location.origin}/post/${postId}`;
        navigator.clipboard.writeText(shareUrl);
        alert("Post link copied to clipboard!");
        setOptionsPost(null);
    };

    // Delete post helper
    const handleDeletePost = async (postId) => {
        if (!window.confirm("Are you sure you want to delete this photo?")) return;
        try {
            const response = await fetch(`${API}/posts/${postId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                if (onDelete) {
                    onDelete(postId);
                }
                setOptionsPost(null);
                // Close modal if no posts left, or select another post
                const remaining = posts.filter(p => p.id !== postId);
                if (remaining.length === 0) {
                    onClose();
                } else {
                    setActivePostId(remaining[0].id);
                }
            }
        } catch (err) {
            console.error("Delete post error:", err);
        }
    };

    const getPostDetails = (pId, fallbackPost) => {
        return postsDetails[pId] || fallbackPost || {};
    };

    return (
        <div 
            className="fixed inset-0 z-[160] bg-black/90 md:bg-black/80 backdrop-blur-md flex items-center justify-center p-0 md:p-6"
            onClick={onClose}
        >
            {/* ✕ CLOSE BUTTON FOR DESKTOP */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-50 hidden md:flex w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white items-center justify-center transition"
            >
                <FiX size={20} />
            </button>

            {/* ── DESKTOP SPLIT NAVIGATION VIEW (Hidden on Mobile) ── */}
            <div 
                className="hidden md:flex bg-[#121224] border border-white/10 w-full max-w-4xl h-auto max-h-[85vh] rounded-2xl overflow-hidden relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Desktop Left/Right Navigation Arrows */}
                {activeIndex > 0 && (
                    <button 
                        onClick={() => setActivePostId(posts[activeIndex - 1].id)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition border border-white/5"
                    >
                        <FiChevronLeft size={22} />
                    </button>
                )}
                {activeIndex < posts.length - 1 && (
                    <button 
                        onClick={() => setActivePostId(posts[activeIndex + 1].id)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition border border-white/5"
                    >
                        <FiChevronRight size={22} />
                    </button>
                )}

                {/* Left Column: Image */}
                <div className="flex-1 bg-black flex items-center justify-center aspect-square overflow-hidden max-h-[75vh]">
                    <img 
                        src={activePost.image_url} 
                        alt="" 
                        className="w-full h-full object-contain"
                        onDoubleClick={() => handleLikeToggle(activePost.id)}
                    />
                </div>

                {/* Right Column: Panel */}
                <div className="w-[380px] shrink-0 flex flex-col bg-[#121224] border-l border-white/5">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-[#16162A]">
                        <div className="flex items-center gap-3">
                            {postOwner?.profile_pic ? (
                                <img src={postOwner.profile_pic} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                                    {postOwner?.name?.[0]?.toUpperCase()}
                                </div>
                            )}
                            <div>
                                <span className="font-bold text-white text-xs block truncate max-w-[150px]">
                                    {postOwner?.name || activePost.user_name}
                                </span>
                                <span className="text-[9px] text-gray-500 flex items-center gap-0.5">
                                    <FiMapPin size={10} className="text-gray-500 shrink-0" />
                                    <span>{postOwner?.city || "Companion App"}</span>
                                </span>
                            </div>
                        </div>
                        
                        {/* 3-Dot options button */}
                        <button 
                            onClick={() => setOptionsPost(activePost)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                        >
                            <FiMoreVertical size={16} />
                        </button>
                    </div>

                    {/* Comments list */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar">
                        {activePost.caption && (
                            <div className="flex gap-3 items-start pb-3.5 border-b border-white/5">
                                {postOwner?.profile_pic ? (
                                    <img src={postOwner.profile_pic} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                        {postOwner?.name?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div className="text-xs text-gray-300 leading-relaxed">
                                    <span className="font-extrabold text-white mr-1.5">{postOwner?.name?.split(' ')[0]}</span>
                                    {activePost.caption}
                                </div>
                            </div>
                        )}

                        {activePost.disable_comments ? (
                            <div className="text-center py-12 text-xs text-gray-500 italic">Comments are turned off for this post.</div>
                        ) : commentsMap[activePost.id]?.length === 0 ? (
                            <div className="text-center py-8 text-xs text-gray-500">No comments yet.</div>
                        ) : (
                            commentsMap[activePost.id]?.map((comment) => (
                                <div key={comment.id} className="flex gap-3 items-start text-xs text-gray-300">
                                    {comment.user_pic ? (
                                        <img src={comment.user_pic} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/5" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-[#16162A] border border-white/10 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                            {comment.user_name?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 leading-relaxed">
                                        <span className="font-bold text-white mr-1.5">{comment.user_name?.split(' ')[0]}</span>
                                        {comment.text}
                                        <span className="block text-[8px] text-gray-500 mt-1">
                                            {new Date(comment.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Bottom panel */}
                    <div className="p-4 border-t border-white/5 bg-[#16162A]/60">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => handleLikeToggle(activePost.id)}
                                    className={`focus:scale-125 transition ${getPostDetails(activePost.id, activePost).is_liked_by_me ? 'text-red-500' : 'text-white hover:text-gray-400'}`}
                                >
                                    {getPostDetails(activePost.id, activePost).is_liked_by_me ? (
                                        <FaHeart size={20} className="fill-red-500" />
                                    ) : (
                                        <FiHeart size={20} />
                                    )}
                                </button>
                                {!activePost.disable_comments && (
                                    <button className="text-white hover:text-gray-400">
                                        <FiMessageCircle size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {!activePost.hide_likes && (
                            <div className="text-xs font-extrabold text-white mb-1.5">
                                {getPostDetails(activePost.id, activePost).total_likes || 0} likes
                            </div>
                        )}

                        {!activePost.disable_comments ? (
                            <form onSubmit={(e) => handleAddComment(e, activePost.id)} className="flex gap-2 items-center mt-3">
                                <input 
                                    type="text"
                                    value={newCommentTexts[activePost.id] || ""}
                                    onChange={(e) => setNewCommentTexts(prev => ({ ...prev, [activePost.id]: e.target.value }))}
                                    placeholder="Add a comment..."
                                    className="flex-1 bg-[#0D0D1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-pink-500 transition"
                                />
                                <button 
                                    type="submit" 
                                    disabled={!(newCommentTexts[activePost.id] || "").trim()}
                                    className="w-8 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center transition disabled:opacity-30 shrink-0"
                                >
                                    <FiSend size={12} />
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-2 text-xs text-gray-500 italic border-t border-white/5 mt-3 pt-3">Comments are turned off.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MOBILE VERTICAL SCROLLABLE POST FEED (Visible on Mobile) ── */}
            <div 
                className="flex md:hidden flex-col bg-[#0D0D1A] w-full h-full overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                ref={containerRef}
            >
                {/* Mobile Sticky Title bar */}
                <div className="sticky top-0 bg-[#0D0D1A]/95 border-b border-white/5 h-12 flex items-center px-4 justify-between z-30">
                    <button onClick={onClose} className="text-white text-lg font-bold">←</button>
                    <span className="font-extrabold text-xs text-gray-200">Posts Feed</span>
                    <div className="w-6"></div>
                </div>

                {/* Stacks of posts vertically */}
                <div className="flex-1 space-y-8 pb-16 pt-2">
                    {posts.map((p) => {
                        const details = getPostDetails(p.id, p);
                        return (
                            <div 
                                key={p.id} 
                                id={`mobile-post-${p.id}`}
                                className="border-b border-white/5 pb-6 bg-[#121224]/30"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-[#121224]/40">
                                    <div className="flex items-center gap-3">
                                        {postOwner?.profile_pic ? (
                                            <img src={postOwner.profile_pic} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                                                {postOwner?.name?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <span className="font-extrabold text-white text-xs block">{postOwner?.name?.split(' ')[0]}</span>
                                            <span className="text-[8px] text-gray-500 flex items-center gap-0.5">
                                                <FiMapPin size={9} className="text-gray-500 shrink-0" />
                                                <span>{postOwner?.city || "Companion"}</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* 3-dots button */}
                                    <button 
                                        onClick={() => setOptionsPost(p)}
                                        className="w-8 h-8 rounded-full bg-white/5 text-gray-400 flex items-center justify-center transition"
                                    >
                                        <FiMoreVertical size={16} />
                                    </button>
                                </div>

                                {/* Post Image */}
                                <div className="bg-black/50 aspect-square w-full flex items-center justify-center overflow-hidden">
                                    <img 
                                        src={p.image_url} 
                                        alt="" 
                                        className="w-full h-full object-cover"
                                        onDoubleClick={() => handleLikeToggle(p.id)}
                                    />
                                </div>

                                {/* Action Buttons Panel */}
                                <div className="px-4 py-3">
                                    <div className="flex gap-4 mb-2">
                                        <button 
                                            onClick={() => handleLikeToggle(p.id)}
                                            className={`focus:scale-125 transition ${details.is_liked_by_me ? 'text-red-500' : 'text-white'}`}
                                        >
                                            {details.is_liked_by_me ? (
                                                <FaHeart size={22} className="fill-red-500" />
                                            ) : (
                                                <FiHeart size={22} />
                                            )}
                                        </button>
                                        {!p.disable_comments && (
                                            <button 
                                                onClick={() => setCommentsPost(p)}
                                                className="text-white hover:text-gray-400"
                                            >
                                                <FiMessageCircle size={22} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Likes count */}
                                    {!p.hide_likes && (
                                        <div className="text-xs font-bold text-white mb-2">
                                            {details.total_likes || 0} likes
                                        </div>
                                    )}

                                    {/* Caption block */}
                                    {p.caption && (
                                        <p className="text-xs text-gray-300 leading-relaxed mb-3">
                                            <span className="font-extrabold text-white mr-1.5">{postOwner?.name?.split(' ')[0]}</span>
                                            {p.caption}
                                        </p>
                                    )}

                                    {/* Comments link triggers comments sheet */}
                                    {!p.disable_comments ? (
                                        <button 
                                            onClick={() => setCommentsPost(p)}
                                            className="text-[10px] text-gray-500 font-semibold cursor-pointer hover:underline block"
                                        >
                                            View all {commentsMap[p.id]?.length || 0} comments...
                                        </button>
                                    ) : (
                                        <div className="text-[10px] text-gray-600 italic block">Comments are turned off.</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── OPTIONS BOTTOM SHEET (3-DOT OPTIONS POPUP) ─── */}
            {optionsPost && (
                <div 
                    className="fixed inset-0 bg-black/60 z-[220] flex items-end justify-center animate-fade-in"
                    onClick={() => setOptionsPost(null)}
                >
                    <div 
                        className="bg-[#121224] border-t border-white/10 w-full max-w-md rounded-t-3xl overflow-hidden animate-slide-up flex flex-col p-4 space-y-2 pb-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoration bar */}
                        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-3" />

                        {/* Options */}
                        {(currentUser?.id === optionsPost.user_id || currentUser?.id === postOwner?.id) && (
                            <button 
                                onClick={() => handleDeletePost(optionsPost.id)}
                                className="w-full py-4 text-center text-red-500 font-extrabold text-xs hover:bg-white/5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                            >
                                <FiTrash2 size={14} /> Delete Post
                            </button>
                        )}
                        
                        <button 
                            onClick={() => { setShowAboutUser(true); setOptionsPost(null); }}
                            className="w-full py-4 text-center text-white font-bold text-xs hover:bg-white/5 rounded-xl border-t border-white/5 transition-all flex items-center justify-center gap-1.5"
                        >
                            <FiInfo size={14} /> About this profile
                        </button>
                        
                        <button 
                            onClick={() => handleSharePost(optionsPost.id)}
                            className="w-full py-4 text-center text-white font-bold text-xs hover:bg-white/5 rounded-xl border-t border-white/5 transition-all flex items-center justify-center gap-1.5"
                        >
                            <FiShare2 size={14} /> Copy Link
                        </button>
                        
                        <button 
                            onClick={() => setOptionsPost(null)}
                            className="w-full py-4 text-center text-gray-400 font-bold text-xs hover:bg-white/5 rounded-xl border-t border-white/5 transition-all flex items-center justify-center"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ─── ABOUT USER DETAILS MODAL ─── */}
            {showAboutUser && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[230] flex items-center justify-center p-4"
                    onClick={() => setShowAboutUser(false)}
                >
                    <div 
                        className="bg-[#121224] border border-white/10 w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl p-6 text-center animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                            <FiInfo size={24} />
                        </div>
                        <h4 className="font-extrabold text-white text-sm mb-1">About This Account</h4>
                        <p className="text-[10px] text-gray-500 mb-5">Verify information for {postOwner?.name}</p>

                        <div className="space-y-3 text-left text-xs mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                            <div>
                                <span className="text-gray-500 block text-[9px] uppercase font-bold">Full Name</span>
                                <span className="font-bold text-white">{postOwner?.name}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[9px] uppercase font-bold">Category Role</span>
                                <span className="font-bold text-pink-400 capitalize">{postOwner?.role}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[9px] uppercase font-bold">KYC status</span>
                                <span className={`font-bold capitalize ${postOwner?.kyc_status === 'verified' ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {postOwner?.kyc_status || 'Pending'}
                                </span>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowAboutUser(false)}
                            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-extrabold text-white text-xs shadow-lg hover:opacity-90 transition"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* ─── MOBILE COMMENTS BOTTOM DRAWER SHEET ─── */}
            {commentsPost && (
                <div 
                    className="fixed inset-0 bg-black/75 z-[210] flex items-end justify-center animate-fade-in"
                    onClick={() => setCommentsPost(null)}
                >
                    <div 
                        className="bg-[#121224] border-t border-white/10 w-full h-[65vh] rounded-t-3xl overflow-hidden animate-slide-up flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag indicator decoration */}
                        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto my-3 shrink-0" />
                        
                        {/* Header */}
                        <div className="px-4 pb-3 border-b border-white/5 flex justify-between items-center shrink-0">
                            <span className="font-bold text-xs text-white">Comments</span>
                            <button 
                                onClick={() => setCommentsPost(null)}
                                className="w-7 h-7 rounded-full bg-white/5 text-gray-400 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Comments scrollable list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {commentsMap[commentsPost.id]?.length === 0 ? (
                                <div className="text-center py-12 text-xs text-gray-500">No comments yet.</div>
                            ) : (
                                commentsMap[commentsPost.id]?.map((comment) => (
                                    <div key={comment.id} className="flex gap-3 items-start text-xs text-gray-300">
                                        {comment.user_pic ? (
                                            <img src={comment.user_pic} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/5" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-[#16162A] border border-white/10 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                                {comment.user_name?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 leading-relaxed">
                                            <span className="font-bold text-white mr-1.5">{comment.user_name?.split(' ')[0]}</span>
                                            {comment.text}
                                            <span className="block text-[8px] text-gray-500 mt-1">
                                                {new Date(comment.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Text comment form */}
                        <div className="p-4 border-t border-white/5 bg-[#16162A] shrink-0">
                            {!commentsPost.disable_comments ? (
                                <form onSubmit={(e) => { handleAddComment(e, commentsPost.id); }} className="flex gap-2 items-center">
                                    <input 
                                        type="text"
                                        value={newCommentTexts[commentsPost.id] || ""}
                                        onChange={(e) => setNewCommentTexts(prev => ({ ...prev, [commentsPost.id]: e.target.value }))}
                                        placeholder="Add a comment..."
                                        className="flex-1 bg-[#0D0D1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-pink-500 transition"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!(newCommentTexts[commentsPost.id] || "").trim()}
                                        className="w-8 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center transition disabled:opacity-30 shrink-0"
                                    >
                                        <FiSend size={12} />
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-2 text-xs text-gray-500 italic">Comments are turned off for this post.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default InstagramPostModal;

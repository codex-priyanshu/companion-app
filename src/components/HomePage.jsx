import React, { useState, useEffect, useRef } from "react";
import { PAGES } from "../App";
import Footer from "./Footer";
import StoriesBar from "./shared/StoriesBar";
import VerifiedBadge from "./shared/VerifiedBadge";
import { FeedPostSkeleton, CompanionGridSkeleton } from "./shared/SkeletonLoaders";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { FaRegComment, FaInbox } from "react-icons/fa";
import { RiShareForwardLine, RiLoader4Line } from "react-icons/ri";
import { BsBookmarkFill, BsBookmark } from "react-icons/bs";
import { FiWifi, FiBattery, FiMic, FiMicOff, FiPhoneOff, FiVideoOff, FiShield, FiCheckCircle, FiStar, FiClock } from "react-icons/fi";

// Backend API Base Configuration
const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

const DEFAULT_FEATURED_COMPANIONS = [
    {
        id: "default_1",
        name: "Ananya Sharma",
        age: 22,
        city: "Mumbai",
        rating: "4.9",
        profile_pic: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
        tags: ["Coffee Date", "Movie Partner"],
        role: "girl",
        kyc_status: "verified",
        price: 1200,
        userObj: {
            id: 1,
            name: "Ananya Sharma",
            username: "ananya",
            age: 22,
            city: "Mumbai",
            price: 1200,
            bio: "Love coffee, exploring indie cafes, and deep philosophical conversations. Available for casual outings and study sessions.",
            profile_pic: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
            tags: "Coffee Date,Movie Partner,Cafe",
            role: "girl",
            kyc_status: "verified",
            avg_rating: 4.9,
            review_count: 14
        }
    },
    {
        id: "default_2",
        name: "Pooja Verma",
        age: 23,
        city: "Delhi",
        rating: "4.8",
        profile_pic: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        tags: ["Events", "Dinner"],
        role: "girl",
        kyc_status: "verified",
        price: 1500,
        userObj: {
            id: 2,
            name: "Pooja Verma",
            username: "pooja",
            age: 23,
            city: "Delhi",
            price: 1500,
            bio: "Outgoing event enthusiast and foodie. Great plus-one for weddings, art galleries, and dinner parties.",
            profile_pic: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
            tags: "Events,Dinner,Art",
            role: "girl",
            kyc_status: "verified",
            avg_rating: 4.8,
            review_count: 9
        }
    },
    {
        id: "default_3",
        name: "Rohan Malhotra",
        age: 24,
        city: "Bangalore",
        rating: "4.9",
        profile_pic: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
        tags: ["Study Partner", "Coffee Date"],
        role: "boy",
        kyc_status: "verified",
        price: 1100,
        userObj: {
            id: 3,
            name: "Rohan Malhotra",
            username: "rohan",
            age: 24,
            city: "Bangalore",
            price: 1100,
            bio: "Tech professional & fitness enthusiast. Great companion for cafe working sessions, gym partner, or city walks.",
            profile_pic: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
            tags: "Study Partner,Coffee Date,Fitness",
            role: "boy",
            kyc_status: "verified",
            avg_rating: 4.9,
            review_count: 12
        }
    },
    {
        id: "default_4",
        name: "Sneha Kapoor",
        age: 21,
        city: "Pune",
        rating: "4.7",
        profile_pic: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
        tags: ["Shopping", "Movies"],
        role: "girl",
        kyc_status: "verified",
        price: 1000,
        userObj: {
            id: 4,
            name: "Sneha Kapoor",
            username: "sneha",
            age: 21,
            city: "Pune",
            price: 1000,
            bio: "Cinema lover, avid reader, and fashion enthusiast. Let's hang out and catch the newest blockbuster movie together.",
            profile_pic: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
            tags: "Shopping,Movies,Books",
            role: "girl",
            kyc_status: "verified",
            avg_rating: 4.7,
            review_count: 8
        }
    }
];

function HomePage({ setPage, currentUser, setSelectedGirl }) {
    const [feed, setFeed] = useState([]);
    const [stats, setStats] = useState(() => {
        const cached = sessionStorage.getItem("homeStatsCache");
        if (cached) {
            try { return JSON.parse(cached); } catch (e) {}
        }
        return { total: 0, girls: 0, boys: 0, connections: 0 };
    });
    const [loading, setLoading] = useState(false);
    const [followingState, setFollowingState] = useState({});
    const [commentModal, setCommentModal] = useState({ isOpen: false, postId: null, comments: [] });
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);
    const [savedPosts, setSavedPosts] = useState([]);
    const [featuredCompanions, setFeaturedCompanions] = useState(() => {
        const cached = sessionStorage.getItem("homeFeaturedCache");
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) {}
        }
        return DEFAULT_FEATURED_COMPANIONS;
    });

    const isLoggedIn = !!currentUser;
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        if (!isLoggedIn) {
            const interval = setInterval(() => {
                setActiveSlide((prev) => (prev + 1) % 3);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (isLoggedIn && currentUser) {
            const cachedFeed = sessionStorage.getItem("homeFeedCache");
            const cachedFollowing = sessionStorage.getItem("followingStateCache");

            if (cachedFeed && cachedFollowing) {
                setFeed(JSON.parse(cachedFeed));
                setFollowingState(JSON.parse(cachedFollowing));
                setLoading(false);
            } else {
                setLoading(true);
            }
        } else {
            const cachedStats = sessionStorage.getItem("homeStatsCache");
            if (cachedStats) {
                setStats(JSON.parse(cachedStats));
            }
        }

        const fetchData = async () => {
            try {
                if (isLoggedIn && currentUser) {
                    const response = await fetch(`${API}/feed?currentUserId=${currentUser.id}`);
                    if (response.ok) {
                        const data = await response.json();
                        setFeed(data);
                        sessionStorage.setItem("homeFeedCache", JSON.stringify(data));

                        const followData = {};
                        data.forEach(post => {
                            followData[post.user_id] = post.is_followed_by_me;
                        });
                        setFollowingState(followData);
                        sessionStorage.setItem("followingStateCache", JSON.stringify(followData));
                    }

                    // Fetch saved post IDs
                    const token = localStorage.getItem("token");
                    const savedRes = await fetch(`${API}/posts/saved`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (savedRes.ok) {
                        const savedData = await savedRes.json();
                        setSavedPosts(savedData.map(p => p.id));
                    }
                } else {
                    const res = await fetch(`${API}/users`);
                    if (res.ok) {
                        const allUsers = await res.json();
                        if (allUsers && allUsers.length > 0) {
                            const girls = allUsers.filter(u => u.role === 'girl');
                            const boys = allUsers.filter(u => u.role === 'boy' || u.role === 'admin');

                            const newStats = {
                                girls: girls.length,
                                boys: boys.length,
                                total: allUsers.length,
                                connections: allUsers.length * 15 + 120
                            };

                            setStats(newStats);
                            sessionStorage.setItem("homeStatsCache", JSON.stringify(newStats));

                            // Prioritize verified companions
                            const sortedGirls = [...girls].sort((a, b) => (b.kyc_status === 'verified' ? 1 : 0) - (a.kyc_status === 'verified' ? 1 : 0));
                            const sortedBoys = [...boys].sort((a, b) => (b.kyc_status === 'verified' ? 1 : 0) - (a.kyc_status === 'verified' ? 1 : 0));

                            let selectedUsers = [];
                            if (sortedGirls.length > 0 && sortedBoys.length > 0) {
                                selectedUsers = [...sortedGirls.slice(0, 2), ...sortedBoys.slice(0, 2)];
                            } else {
                                selectedUsers = [...allUsers.slice(0, 4)];
                            }

                            if (selectedUsers.length < 4) {
                                const remaining = allUsers.filter(u => !selectedUsers.some(s => s.id === u.id));
                                selectedUsers = [...selectedUsers, ...remaining.slice(0, 4 - selectedUsers.length)];
                            }

                            const defaultAvatars = [
                                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
                                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
                                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
                                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400"
                            ];

                            const mapped = selectedUsers.map((u, index) => {
                                let tagsArray = [];
                                if (typeof u.tags === 'string' && u.tags.trim() !== '') {
                                    tagsArray = u.tags.split(',').map(t => t.trim());
                                } else if (Array.isArray(u.tags)) {
                                    tagsArray = u.tags;
                                } else if (u.bio && u.bio.trim() !== '') {
                                    tagsArray = [u.bio.trim()];
                                } else {
                                    tagsArray = ['Verified Partner', 'Coffee Date'];
                                }

                                const avgRat = parseFloat(u.avg_rating);
                                const displayRating = avgRat > 0 ? avgRat.toFixed(1) : (u.kyc_status === 'verified' ? '4.9' : '4.7');

                                return {
                                    id: u.id,
                                    name: u.name || u.username || 'User',
                                    age: u.age || 21,
                                    city: u.city || 'India',
                                    rating: displayRating,
                                    profile_pic: u.profile_pic || defaultAvatars[index % defaultAvatars.length],
                                    tags: tagsArray,
                                    role: u.role,
                                    kyc_status: u.kyc_status,
                                    price: u.price || 1000,
                                    userObj: u
                                };
                            });

                            if (mapped.length > 0) {
                                setFeaturedCompanions(mapped);
                                sessionStorage.setItem("homeFeaturedCache", JSON.stringify(mapped));
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Home fetchData error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isLoggedIn, currentUser]);

    const handleLike = async (postId, isLikedByMe) => {
        if (!currentUser) return;

        // Optimistically update UI
        setFeed(prevFeed => prevFeed.map(post => {
            if (post.id === postId) {
                return {
                    ...post,
                    is_liked_by_me: !isLikedByMe,
                    total_likes: isLikedByMe ? Math.max(0, parseInt(post.total_likes) - 1) : parseInt(post.total_likes) + 1
                };
            }
            return post;
        }));

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/like`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ post_id: postId })
            });
            if (!res.ok) {
                // Revert optimistic update on server error
                setFeed(prevFeed => prevFeed.map(post => {
                    if (post.id === postId) {
                        return {
                            ...post,
                            is_liked_by_me: isLikedByMe,
                            total_likes: isLikedByMe ? parseInt(post.total_likes) + 1 : Math.max(0, parseInt(post.total_likes) - 1)
                        };
                    }
                    return post;
                }));
            }
        } catch (err) {
            console.error("Like error:", err);
            // Revert optimistic update on network error
            setFeed(prevFeed => prevFeed.map(post => {
                if (post.id === postId) {
                    return {
                        ...post,
                        is_liked_by_me: isLikedByMe,
                        total_likes: isLikedByMe ? parseInt(post.total_likes) + 1 : Math.max(0, parseInt(post.total_likes) - 1)
                    };
                }
                return post;
            }));
        }
    };

    const handleDoubleTap = (e, postId, isLikedByMe) => {
        if (!isLikedByMe) {
            handleLike(postId, isLikedByMe);
        }
    };

    const handleFollowToggle = async (targetUserId) => {
        if (!currentUser) return;

        const isCurrentlyFollowing = followingState[targetUserId];
        const endpoint = isCurrentlyFollowing ? "/api/unfollow" : "/api/follow";

        setFollowingState(prev => ({
            ...prev,
            [targetUserId]: !isCurrentlyFollowing
        }));

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    follower_id: currentUser.id,
                    following_id: targetUserId
                })
            });
            if (!res.ok) {
                setFollowingState(prev => ({
                    ...prev,
                    [targetUserId]: isCurrentlyFollowing
                }));
            }
        } catch (err) {
            setFollowingState(prev => ({
                ...prev,
                [targetUserId]: isCurrentlyFollowing
            }));
            console.error("Follow error:", err);
        }
    };

    const openComments = async (postId) => {
        setCommentModal({ isOpen: true, postId, comments: [] });
        setLoadingComments(true);
        try {
            const res = await fetch(`${API}/comments/${postId}`);
            if (res.ok) {
                const data = await res.json();
                setCommentModal({ isOpen: true, postId, comments: data });
            }
        } catch (err) {
            console.error("Fetch comments error:", err);
        } finally {
            setLoadingComments(false);
        }
    };

    const submitComment = async () => {
        if (!newComment.trim() || !currentUser || !commentModal.postId) return;

        const commentData = {
            post_id: commentModal.postId,
            text: newComment.trim()
        };

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/comment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(commentData)
            });

            if (res.ok) {
                const savedComment = await res.json();
                setCommentModal(prev => ({
                    ...prev,
                    comments: [...prev.comments, { ...savedComment, user_name: currentUser.name, user_pic: currentUser.profile_pic }]
                }));
                setNewComment("");

                setFeed(prevFeed => prevFeed.map(post =>
                    post.id === commentModal.postId
                        ? { ...post, total_comments: parseInt(post.total_comments) + 1 }
                        : post
                ));
            }
        } catch (err) {
            console.error("Submit comment error:", err);
        }
    };

    const toggleSave = async (postId) => {
        const isSaved = savedPosts.includes(postId);
        if (isSaved) {
            setSavedPosts(savedPosts.filter(id => id !== postId));
        } else {
            setSavedPosts([...savedPosts, postId]);
        }

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/posts/save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ post_id: postId })
            });
            if (!res.ok) {
                // Revert on error
                if (isSaved) {
                    setSavedPosts(prev => [...prev, postId]);
                } else {
                    setSavedPosts(prev => prev.filter(id => id !== postId));
                }
            }
        } catch (err) {
            console.error("Save toggle error:", err);
            if (isSaved) {
                setSavedPosts(prev => [...prev, postId]);
            } else {
                setSavedPosts(prev => prev.filter(id => id !== postId));
            }
        }
    };

    const handleShare = async (postId) => {
        const shareUrl = `${window.location.origin}/#post_${postId}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Check out this post on RentGF',
                    url: shareUrl
                });
            } catch (err) {
                console.error(err);
            }
        } else {
            navigator.clipboard.writeText(shareUrl);
            alert("Link copied to clipboard!");
        }
    };

    const handleProfileClick = (post) => {
        if (post.user_id === currentUser?.id) {
            setPage(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD);
        } else {
            if (typeof setSelectedGirl === 'function') {
                setSelectedGirl({
                    id: post.user_id,
                    name: post.user_name,
                    profile_pic: post.user_pic,
                    role: post.user_role
                });
            }
            setPage(PAGES.DETAILS);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    };

    // ─── Instagram-Style Swipe Gestures: Swipe Left to Open Direct Messages ───
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    const handleTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        if (!e.changedTouches || e.changedTouches.length === 0) return;

        const diffX = touchStartX.current - e.changedTouches[0].clientX;
        const diffY = touchStartY.current - e.changedTouches[0].clientY;

        touchStartX.current = null;
        touchStartY.current = null;

        // Ignore touches inside interactive elements
        if (e.target && e.target.closest('button, input, textarea, a, select, [data-prevent-swipe]')) {
            return;
        }

        // Swipe Left (from right to left) -> open Direct Messages
        if (diffX > 75 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
            if (currentUser && typeof setPage === 'function') {
                setPage(PAGES.MESSAGES);
            }
        }
    };

    if (isLoggedIn) {
        return (
            <div 
                className="min-h-[100dvh] bg-black pt-20 pb-20 flex justify-center"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="w-full max-w-lg flex flex-col gap-6 px-4">
                    {/* 📸 24-Hour Ephemeral Stories Bar */}
                    <StoriesBar currentUser={currentUser} />

                    {loading ? (
                        <FeedPostSkeleton count={3} />
                    ) : feed.length === 0 ? (
                        <div className="text-center py-20 bg-[#121212] rounded-2xl border border-[#262626]/80">
                            <FaInbox className="text-5xl text-gray-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No Posts Yet</h3>
                            <p className="text-gray-400">Be the first to share a moment!</p>
                        </div>
                    ) : (
                        feed.map(post => (
                            <div key={post.id} className="bg-[#121212] border border-[#262626] rounded-2xl overflow-hidden shadow-lg">
                                <div className="flex items-center justify-between p-3 border-b border-[#262626]/60">
                                    <div
                                        className="flex items-center gap-3 cursor-pointer group"
                                        onClick={() => handleProfileClick(post)}
                                    >
                                        <img
                                            src={post.user_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                            alt={post.user_name}
                                            className="w-10 h-10 rounded-full object-cover border border-[#262626] group-hover:border-[#e1306c] transition"
                                        />
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-sm text-white group-hover:text-[#e1306c] transition">{post.user_name}</span>
                                                <span className="text-gray-500 text-xs">• {formatTime(post.created_at)}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{post.user_role}</span>
                                        </div>
                                    </div>
 
                                    {post.user_id !== currentUser?.id && (
                                        <button
                                            onClick={() => handleFollowToggle(post.user_id)}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${followingState[post.user_id] ? 'bg-[#363636] text-white hover:bg-[#262626]' : 'bg-[#0095f6] text-white hover:bg-[#1877f2]'}`}
                                        >
                                            {followingState[post.user_id] ? "Following" : "Follow"}
                                        </button>
                                    )}
                                </div>
 
                                <div
                                    className="relative w-full bg-black aspect-square cursor-pointer flex items-center justify-center"
                                    onDoubleClick={(e) => handleDoubleTap(e, post.id, post.is_liked_by_me)}
                                >
                                    <img src={post.image_url} alt="Post" className="w-full h-full object-contain" />
                                </div>
 
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleLike(post.id, post.is_liked_by_me)}
                                                className="text-2xl hover:scale-110 transition active:scale-90"
                                            >
                                                {post.is_liked_by_me
                                                    ? <AiFillHeart className="text-[#ed4956] text-2xl" />
                                                    : <AiOutlineHeart className="text-white text-2xl" />
                                                }
                                            </button>
                                            {!post.disable_comments && (
                                                <button onClick={() => openComments(post.id)} className="hover:scale-110 transition active:scale-90 opacity-90">
                                                    <FaRegComment className="text-white text-2xl" />
                                                </button>
                                            )}
                                            <button onClick={() => handleShare(post.id)} className="hover:scale-110 transition active:scale-90 opacity-90">
                                                <RiShareForwardLine className="text-white text-2xl" />
                                            </button>
                                        </div>
                                        <button onClick={() => toggleSave(post.id)} className="hover:scale-110 transition active:scale-90 opacity-90">
                                            {savedPosts.includes(post.id)
                                                ? <BsBookmarkFill className="text-white text-xl" />
                                                : <BsBookmark className="text-white text-xl" />
                                            }
                                        </button>
                                    </div>
 
                                    {!post.hide_likes && (
                                        <div className="font-bold text-sm text-white mb-1">
                                            {post.total_likes} likes
                                        </div>
                                    )}
 
                                    <div className="text-sm text-gray-200">
                                        <span className="font-bold mr-2 cursor-pointer hover:text-[#e1306c]" onClick={() => handleProfileClick(post)}>
                                            {post.user_name}
                                        </span>
                                        {post.caption}
                                    </div>
 
                                    {!post.disable_comments && parseInt(post.total_comments) > 0 && (
                                        <div
                                            onClick={() => openComments(post.id)}
                                            className="text-gray-500 text-sm mt-2 cursor-pointer hover:text-gray-400"
                                        >
                                            View all {post.total_comments} comments
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
 
                {commentModal.isOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
                        <div className="bg-[#121212] w-full max-w-lg h-[70vh] sm:h-[80vh] sm:rounded-2xl rounded-t-3xl border border-[#262626] flex flex-col animate-slide-up sm:animate-none">
                            <div className="flex justify-between items-center p-4 border-b border-[#262626]">
                                <h3 className="font-bold text-white text-lg w-full text-center">Comments</h3>
                                <button onClick={() => setCommentModal({ isOpen: false, postId: null, comments: [] })} className="text-gray-400 hover:text-white absolute right-4 text-2xl">✕</button>
                            </div>
 
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                                {loadingComments ? (
                                    <div className="flex justify-center items-center my-10">
                                        <RiLoader4Line className="text-[#e1306c] text-3xl animate-spin" />
                                    </div>
                                ) : commentModal.comments.length === 0 ? (
                                    <div className="text-center text-gray-500 my-10">No comments yet. Be the first!</div>
                                ) : (
                                    commentModal.comments.map(c => (
                                        <div key={c.id} className="flex gap-3">
                                            <img src={c.user_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"} className="w-8 h-8 rounded-full object-cover" alt="" />
                                            <div>
                                                <span className="font-bold text-sm text-white mr-2">{c.user_name}</span>
                                                <span className="text-sm text-gray-200">{c.text}</span>
                                                <div className="text-[10px] text-gray-500 mt-0.5">{formatTime(c.created_at)}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
 
                            <div className="p-4 border-t border-[#262626] bg-black flex gap-3 pb-8 sm:pb-4">
                                <img src={currentUser.profile_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"} className="w-10 h-10 rounded-full object-cover animate-pulse" alt="" />
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="Add a comment..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                                        className="w-full bg-transparent border border-[#262626] rounded-full pl-4 pr-12 py-2.5 text-sm text-white outline-none focus:border-[#e1306c]"
                                    />
                                    <button
                                        onClick={submitComment}
                                        disabled={!newComment.trim()}
                                        className={`absolute right-3 top-1/2 -translate-y-1/2 font-bold text-sm ${newComment.trim() ? 'text-[#e1306c]' : 'text-gray-600'}`}
                                    >
                                        Post
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-black pt-24 pb-10">
            {/* Main Hero Container */}
            <div className="max-w-5xl mx-auto px-6 mt-6 md:mt-12 mb-16 relative">
                {/* Ambient lights */}
                <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-[#0095f6]/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none"></div>
 
                {/* Two Column Layout: Left (Phone Mockup) | Right (Login/Signup Box) */}
                <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 relative z-10 w-full">
                    
                    {/* LEFT COLUMN: Phone Mockup (Visible on large screens, hidden on mobile for clean UX) */}
                    <div className="shrink-0 scale-90 sm:scale-100 hidden lg:flex justify-center order-2 lg:order-1">
                        <div className="relative w-[280px] h-[550px] bg-black rounded-[45px] p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-[6px] border-[#262626] overflow-hidden">
                            {/* Notch */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30 flex items-center justify-center">
                                <div className="w-10 h-1 bg-gray-800 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-900 rounded-full ml-2 border border-gray-700"></div>
                            </div>
                            
                            {/* Side Buttons for Phone Mockup */}
                            <div className="absolute left-0 top-24 w-[3px] h-10 bg-gray-800 rounded-r-md"></div>
                            <div className="absolute left-0 top-38 w-[3px] h-14 bg-gray-800 rounded-r-md"></div>
                            <div className="absolute right-0 top-32 w-[3px] h-16 bg-gray-800 rounded-l-md"></div>
 
                            {/* Inner Screen */}
                            <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-black">
                                {/* Slide 0: Discover Profiles */}
                                <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeSlide === 0 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                                    <div className="h-full w-full bg-black flex flex-col p-4 justify-between relative overflow-hidden">
                                        <div className="flex justify-between items-center text-[9px] text-gray-400 z-10 pt-2">
                                            <span>09:41</span>
                                            <div className="flex gap-1.5 items-center">
                                                <FiWifi size={10} />
                                                <FiBattery size={10} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col justify-center my-3 z-10">
                                            <div className="bg-[#121212] rounded-2xl overflow-hidden border border-[#262626] shadow-xl relative h-full flex flex-col justify-between">
                                                <div className="absolute inset-0 bg-gradient-to-tr from-[#0095f6]/10 to-transparent z-0"></div>
                                                
                                                <div className="flex-1 relative z-10 flex items-center justify-center p-3">
                                                    <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg border-2 border-[#0095f6]/40">
                                                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-[#121212]/90 backdrop-blur-md p-3 relative z-10 border-t border-[#262626]">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="font-extrabold text-[12px] text-white">Ananya, 21</span>
                                                        <VerifiedBadge size="xs" />
                                                    </div>
                                                    <p className="text-[9px] text-gray-300 flex items-center gap-1">
                                                        Mumbai • <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span> Online
                                                    </p>
                                                    <div className="flex gap-1 mt-1.5 flex-wrap">
                                                        <span className="bg-[#262626] text-gray-300 text-[7px] px-2 py-0.5 rounded-full border border-[#363636]">Coffee</span>
                                                        <span className="bg-[#262626] text-gray-300 text-[7px] px-2 py-0.5 rounded-full border border-[#363636]">Movies</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[8px] text-center text-gray-500 z-10 font-bold mb-1">Swipe to explore →</div>
                                    </div>
                                </div>
 
                                {/* Slide 1: Premium Chat */}
                                <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeSlide === 1 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                                    <div className="h-full w-full bg-black flex flex-col p-4 justify-between">
                                        <div className="flex justify-between items-center text-[9px] text-gray-400 pt-2">
                                            <span>09:42</span>
                                            <div className="flex gap-1.5 items-center">
                                                <FiWifi size={10} />
                                                <FiBattery size={10} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 border-b border-[#262626] pb-2 mt-2">
                                            <div className="w-6 h-6 rounded-full overflow-hidden shadow">
                                                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80" className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[10px] text-white">Ananya</h4>
                                                <span className="text-[7px] text-green-400">typing...</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col gap-2 justify-end my-3 text-[9px]">
                                            <div className="bg-[#121212] text-white p-2 rounded-2xl rounded-tl-none max-w-[85%] self-start border border-[#262626]">
                                                Hey! Ready for our coffee date?
                                            </div>
                                            <div className="bg-[#0095f6] text-white p-2 rounded-2xl rounded-tr-none max-w-[85%] self-end shadow-md font-medium">
                                                Absolutely! See you at 5.
                                            </div>
                                            <div className="bg-[#121212] text-white p-2 rounded-2xl rounded-tl-none max-w-[85%] self-start border border-[#262626] animate-pulse">
                                                Great! I'm on my way.
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white/5 rounded-full px-3 py-1 flex justify-between items-center border border-[#262626] mb-1">
                                            <span className="text-[8px] text-gray-500">Message...</span>
                                            <span className="text-[#0095f6] text-[8px] font-bold">Send</span>
                                        </div>
                                    </div>
                                </div>
 
                                {/* Slide 2: Video Calling */}
                                <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeSlide === 2 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                                    <div className="h-full w-full bg-black flex flex-col p-4 justify-between relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-b from-[#0095f6]/10 via-black to-transparent z-0"></div>
                                        
                                        <div className="flex justify-between items-center text-[9px] text-gray-400 z-10 pt-2 w-full">
                                            <span>09:43</span>
                                            <span className="font-bold text-white uppercase tracking-wider text-[7px] bg-[#0095f6]/20 px-1.5 py-0.5 rounded-full border border-[#0095f6]/30">HD Video</span>
                                            <div className="flex gap-1.5 items-center text-gray-400">
                                                <FiWifi size={10} />
                                                <FiBattery size={10} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 z-10">
                                            <div className="w-16 h-16 rounded-full overflow-hidden shadow-[0_0_20px_rgba(0,149,246,0.35)] border-2 border-white/30 animate-pulse relative">
                                                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" className="w-full h-full object-cover" alt="" />
                                                <span className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 rounded-full border border-[#111122] flex items-center justify-center">
                                                    <FiMic className="text-white text-[8px]" size={8} />
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-[11px] text-white">Ananya Sharma</h4>
                                            <span className="text-[8px] text-gray-400">Connected • 02:45</span>
                                        </div>
                                        
                                        <div className="absolute top-10 right-4 w-10 h-14 bg-[#121212] rounded-lg border border-[#262626] z-20 overflow-hidden shadow-lg">
                                            <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100" className="w-full h-full object-cover" alt="" />
                                        </div>
                                        
                                        <div className="flex justify-center gap-3 items-center z-10 mb-1">
                                            <div className="w-6 h-6 rounded-full bg-white/10 border border-[#262626] flex items-center justify-center text-white">
                                                <FiMicOff size={9} />
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-[#ed4956] flex items-center justify-center text-white shadow-lg animate-bounce">
                                                <FiPhoneOff size={11} />
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-white/10 border border-[#262626] flex items-center justify-center text-white">
                                                <FiVideoOff size={9} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
 
                    {/* RIGHT COLUMN: Premium Card */}
                    <div className="w-full max-w-[380px] sm:max-w-md flex flex-col gap-4 animate-fade-in order-1 lg:order-2">
                        <div className="bg-[#121212]/95 border border-[#262626] rounded-3xl p-6 sm:p-8 backdrop-blur-md relative overflow-hidden flex flex-col items-center shadow-xl">
                            
                            {/* Ambient card glows */}
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#0095f6]/10 rounded-full blur-xl pointer-events-none"></div>
                            
                            {/* Platform Branding */}
                            <div className="flex items-center gap-2.5 mb-6">
                                <svg className="w-10 h-10 drop-shadow-[0_0_8px_rgba(225,48,108,0.4)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22 40H68C68 40 69 68 45 68C21 68 22 40 22 40Z" stroke="url(#home-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M68 45H75C80 45 83 48 83 53C83 58 80 61 75 61H66" stroke="url(#home-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M18 75H72" stroke="url(#home-grad)" strokeWidth="6" strokeLinecap="round"/>
                                    <path d="M45 29C40 23 32 30 39 37L45 42L51 37C58 30 50 23 45 29Z" fill="url(#home-grad)"/>
                                    <path d="M31 27C30 24 31 21 33 19" stroke="url(#home-grad)" strokeWidth="4" strokeLinecap="round"/>
                                    <path d="M59 27C60 24 59 21 57 19" stroke="url(#home-grad)" strokeWidth="4" strokeLinecap="round"/>
                                    <defs><linearGradient id="home-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#f9ce3f" /><stop offset="0.5" stopColor="#e1306c" /><stop offset="1" stopColor="#833ab4" /></linearGradient></defs>
                                </svg>
                                <span className="text-3xl font-black bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] bg-clip-text text-transparent tracking-wide">Coffeely</span>
                            </div>
 
                            {/* Short Intro */}
                            <p className="text-gray-300 text-sm text-center mb-8 leading-relaxed px-1">
                                India's Premium Companion Platform. Connect with safe &amp; verified partners for coffee dates, movies, events, and meaningful conversations.
                            </p>
 
                            {/* Login / Signup Buttons */}
                            <div className="w-full flex flex-col gap-3.5">
                                <button
                                    onClick={() => setPage(PAGES.BOY_LOGIN)}
                                    className="w-full py-3.5 rounded-xl font-bold bg-[#0095f6] hover:bg-[#1877f2] text-sm text-white shadow-lg shadow-[#0095f6]/20 transition transform hover:-translate-y-0.5 active:scale-95"
                                >
                                    Log In
                                </button>
                                
                                <button
                                    onClick={() => setPage(PAGES.BOY_REGISTER)}
                                    className="w-full py-3.5 bg-[#262626] hover:bg-[#363636] text-white border border-[#363636] rounded-xl font-bold transition-all transform hover:-translate-y-0.5 active:scale-95 text-sm"
                                >
                                    Create New Account
                                </button>

                                <button
                                    onClick={() => setPage(PAGES.FIND)}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl font-medium transition-all text-xs flex items-center justify-center gap-2"
                                >
                                    <span>🔍 Browse Companions First</span>
                                </button>
                            </div>
 
                            {/* Verified Trust Badge */}
                            <div className="mt-8 flex items-center gap-1.5 text-[10px] text-gray-500">
                                <span>🔒 Secure &amp; Encrypted</span>
                                <span>•</span>
                                <span>💯 Verified Profiles</span>
                            </div>
                        </div>
                    </div>
 
                </div>
            </div>

            {/* Premium Trust & Safety Row */}
            <div className="max-w-5xl mx-auto px-6 mb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#121212]/60 border border-[#262626]/80 rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-[#0095f6]/10 flex items-center justify-center text-[#0095f6] mb-4 border border-[#0095f6]/20">
                            <FiShield size={24} />
                        </div>
                        <h4 className="font-bold text-white text-base mb-1.5">100% Safe &amp; Private</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">Your data and personal identity are encrypted. Complete privacy guaranteed.</p>
                    </div>
                    <div className="bg-[#121212]/60 border border-[#262626]/80 rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 border border-purple-500/20">
                            <FiCheckCircle size={24} />
                        </div>
                        <h4 className="font-bold text-white text-base mb-1.5">KYC Verified Profiles</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">Companions undergo government ID verification check for absolute authenticity.</p>
                    </div>
                    <div className="bg-[#121212]/60 border border-[#262626]/80 rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 border border-blue-500/20">
                            <FiClock size={24} />
                        </div>
                        <h4 className="font-bold text-white text-base mb-1.5">Instant Connectivity</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">Fast matchmaking booking and high quality real-time WebRTC audio &amp; video calls.</p>
                    </div>
                </div>
            </div>

            {/* REAL FEATURED COMPANIONS FROM DATABASE */}
            <div className="max-w-5xl mx-auto px-6 mb-20">
                <div className="text-center mb-10">
                    <span className="text-xs font-bold tracking-widest text-[#0095f6] uppercase">Discover</span>
                    <h2 className="text-3xl font-bold mb-3 mt-1 text-white">Featured Companions</h2>
                    <p className="text-gray-400 text-sm">Browse registered companions directly from our platform.</p>
                </div>

                {featuredCompanions.length === 0 ? (
                    <div className="text-center py-12 bg-[#121212] border border-[#262626] rounded-2xl text-gray-400 text-sm">
                        No companion profiles available right now.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {featuredCompanions.map((comp) => (
                            <div 
                                key={comp.id}
                                className="bg-[#121212] border border-[#262626] rounded-2xl overflow-hidden shadow-xl hover:-translate-y-1.5 transition duration-300 flex flex-col justify-between group"
                            >
                                {/* Profile Image Column */}
                                <div className="relative aspect-[4/5] overflow-hidden bg-black shrink-0">
                                    <img src={comp.profile_pic} alt={comp.name} className="w-full h-full object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-95" />
                                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] text-yellow-400 font-bold border border-[#262626] flex items-center gap-1 shadow-md">
                                        <FiStar size={11} className="fill-yellow-400" /> {comp.rating}
                                    </div>
                                    {comp.kyc_status === 'verified' && (
                                        <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] pl-1.5 pr-2.5 py-0.5 rounded-full font-bold shadow-md flex items-center gap-1.5 border border-white/15">
                                            <VerifiedBadge size="xs" />
                                            <span>Verified</span>
                                        </span>
                                    )}
                                </div>

                                {/* Profile Meta Column */}
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div className="space-y-1.5">
                                        <h4 className="font-extrabold text-white text-sm tracking-wide">{comp.name}, {comp.age}</h4>
                                        <p className="text-[10px] text-gray-400">{comp.city} • Companion</p>
                                        
                                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                                            {comp.tags.slice(0, 2).map((tag, idx) => (
                                                <span 
                                                    key={idx} 
                                                    className="px-2.5 py-0.5 text-[9px] font-medium rounded-full bg-[#262626] text-gray-200 border border-[#363636]"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (setSelectedGirl && comp.userObj) {
                                                setSelectedGirl(comp.userObj);
                                                setPage(PAGES.DETAILS);
                                            } else {
                                                setPage(PAGES.BOY_LOGIN);
                                            }
                                        }}
                                        className="w-full mt-4 py-2.5 rounded-lg text-center font-bold text-xs bg-[#0095f6] hover:bg-[#1877f2] text-white transition shadow-sm active:scale-95"
                                    >
                                        Connect Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
 
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-3 text-white">Our Growing Community</h2>
                    <p className="text-gray-400 text-sm">Join thousands of verified users already making meaningful connections.</p>
                </div>
 
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-[#121212] border border-white/5 rounded-2xl p-6 text-center skeleton-shimmer">
                                <div className="h-9 w-20 bg-white/10 rounded-lg mx-auto mb-2.5 skeleton-shimmer" />
                                <div className="h-3 w-28 bg-white/5 rounded-md mx-auto skeleton-shimmer" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#121212] border border-[#262626] rounded-2xl p-6 text-center hover:-translate-y-1 transition duration-300">
                            <div className="text-4xl font-extrabold text-white mb-2">{stats.total}</div>
                            <div className="text-xs text-gray-400 uppercase tracking-widest">Total Users</div>
                        </div>
                        <div className="bg-[#121212] border border-[#0095f6]/25 rounded-2xl p-6 text-center hover:-translate-y-1 transition duration-300 shadow-sm">
                            <div className="text-4xl font-extrabold text-[#0095f6] mb-2">{stats.girls}</div>
                            <div className="text-xs text-[#0095f6]/80 uppercase tracking-widest">Female Companions</div>
                        </div>
                        <div className="bg-[#121212] border border-blue-500/20 rounded-2xl p-6 text-center hover:-translate-y-1 transition duration-300 shadow-sm">
                            <div className="text-4xl font-extrabold text-blue-400 mb-2">{stats.boys}</div>
                            <div className="text-xs text-blue-400/80 uppercase tracking-widest">Male Companions</div>
                        </div>
                        <div className="bg-[#121212] border border-purple-500/25 rounded-2xl p-6 text-center hover:-translate-y-1 transition duration-300 shadow-sm">
                            <div className="text-4xl font-extrabold text-purple-400 mb-2">{stats.connections}+</div>
                            <div className="text-xs text-purple-400/80 uppercase tracking-widest">Happy Connections</div>
                        </div>
                    </div>
                )}
            </div>
 
            <Footer setPage={setPage} />
        </div>
    );
}

export default HomePage;
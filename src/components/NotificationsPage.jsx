import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PAGES } from "../App";
import InstagramPostModal from "./shared/InstagramPostModal";
import { NotificationListSkeleton } from "./shared/SkeletonLoaders";
import { 
    FiRefreshCw, 
    FiInbox, 
    FiArrowLeft, 
    FiHeart, 
    FiMessageCircle, 
    FiUserPlus, 
    FiUserCheck, 
    FiTrash2, 
    FiCheck
} from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function NotificationsPage({ currentUser, setPage, setSelectedGirl, socket }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState("all"); // 'all' | 'follows' | 'likes' | 'comments'
    const [followActionLoading, setFollowActionLoading] = useState({});
    const [followStatusMap, setFollowStatusMap] = useState({});
    
    // Post preview modal state
    const [activePost, setActivePost] = useState(null);
    const [postOwner, setPostOwner] = useState(null);

    const fetchNotifications = useCallback(async (isRefresh = false) => {
        if (!currentUser) return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/notifications/${currentUser.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                sessionStorage.setItem("notifCache", JSON.stringify(data));

                // Initialize follow statuses
                const initFollows = {};
                data.forEach(n => {
                    if (n.sender_id && n.is_following_sender !== undefined) {
                        initFollows[n.sender_id] = Boolean(n.is_following_sender);
                    }
                });
                setFollowStatusMap(prev => ({ ...initFollows, ...prev }));
            }
        } catch (err) {
            console.error("Fetch notifications failed:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;

        const cachedNotifs = sessionStorage.getItem("notifCache");
        if (cachedNotifs) {
            try {
                const parsed = JSON.parse(cachedNotifs);
                setNotifications(parsed);
                setLoading(false);
            } catch (e) {
                setLoading(true);
            }
        }

        fetchNotifications();
    }, [currentUser, fetchNotifications]);

    // ── Real-time Socket Listener ──
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (newNotif) => {
            setNotifications(prev => [
                {
                    id: newNotif.id || Date.now(),
                    type: newNotif.type,
                    sender_id: newNotif.sender_id,
                    sender_name: newNotif.sender_name,
                    sender_username: newNotif.sender_username,
                    sender_pic: newNotif.sender_pic,
                    post_id: newNotif.post_id,
                    post_image: newNotif.post_image,
                    is_read: false,
                    created_at: new Date().toISOString()
                },
                ...prev
            ]);
        };

        socket.on("receive_activity_notification", handleNewNotification);
        return () => {
            socket.off("receive_activity_notification", handleNewNotification);
        };
    }, [socket]);

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "just now";
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return `${Math.floor(diffDays / 7)}w`;
    };

    const handleProfileClick = (notif) => {
        if (setSelectedGirl && notif.sender_id) {
            setSelectedGirl({
                id: notif.sender_id,
                name: notif.sender_name,
                username: notif.sender_username,
                profile_pic: notif.sender_pic,
                role: "user"
            });
            setPage(PAGES.DETAILS);
        }
    };

    // ── Follow / Follow Back handler ──
    const handleFollowToggle = async (e, notif) => {
        e.stopPropagation();
        const targetUserId = notif.sender_id;
        if (!targetUserId || !currentUser) return;

        const isCurrentlyFollowing = followStatusMap[targetUserId] !== undefined
            ? followStatusMap[targetUserId]
            : Boolean(notif.is_following_sender);

        setFollowActionLoading(prev => ({ ...prev, [targetUserId]: true }));
        setFollowStatusMap(prev => ({ ...prev, [targetUserId]: !isCurrentlyFollowing }));

        try {
            const token = localStorage.getItem("token");
            const endpoint = isCurrentlyFollowing ? "/unfollow" : "/follow";
            const res = await fetch(`${API}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ follower_id: currentUser.id, following_id: targetUserId })
            });

            if (!res.ok) {
                setFollowStatusMap(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing }));
            } else if (!isCurrentlyFollowing && socket) {
                socket.emit("send_activity_notification", {
                    receiver_id: targetUserId,
                    sender_id: currentUser.id,
                    sender_name: currentUser.name,
                    sender_pic: currentUser.profile_pic,
                    type: "follow"
                });
            }
        } catch (err) {
            console.error("Follow toggle failed:", err);
            setFollowStatusMap(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing }));
        } finally {
            setFollowActionLoading(prev => ({ ...prev, [targetUserId]: false }));
        }
    };

    // ── Delete single notification ──
    const handleDeleteNotification = async (e, notifId) => {
        e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        try {
            const token = localStorage.getItem("token");
            await fetch(`${API}/notifications/${currentUser.id}/item/${notifId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch (err) {
            console.error("Delete notification failed:", err);
        }
    };

    // ── Clear all notifications ──
    const handleClearAll = async () => {
        if (!window.confirm("Are you sure you want to clear all notifications?")) return;
        setNotifications([]);
        try {
            const token = localStorage.getItem("token");
            await fetch(`${API}/notifications/${currentUser.id}/clear-all`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch (err) {
            console.error("Clear all failed:", err);
        }
    };

    // ── Open post preview ──
    const handleViewPost = async (e, notif) => {
        e.stopPropagation();
        if (!notif.post_id) return;
        try {
            const token = localStorage.getItem("token");
            const headers = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API}/posts/detail/${notif.post_id}`, { headers });
            if (res.ok) {
                const postData = await res.json();
                setActivePost(postData);
                setPostOwner({
                    id: currentUser.id,
                    name: currentUser.name,
                    username: currentUser.username,
                    profile_pic: currentUser.profile_pic
                });
            }
        } catch (err) {
            console.error("Failed to load post detail:", err);
        }
    };

    // ── Filtered notifications ──
    const filteredNotifications = useMemo(() => {
        if (filter === "follows") return notifications.filter(n => n.type === "follow");
        if (filter === "likes") return notifications.filter(n => n.type === "like");
        if (filter === "comments") return notifications.filter(n => n.type === "comment");
        return notifications;
    }, [notifications, filter]);

    // ── Categorize notifications into Today / Yesterday / This Week / Earlier ──
    const categorizedGroups = useMemo(() => {
        const now = new Date();
        const today = [];
        const yesterday = [];
        const thisWeek = [];
        const earlier = [];

        filteredNotifications.forEach(n => {
            const date = new Date(n.created_at);
            const isSameDay = now.getDate() === date.getDate() &&
                              now.getMonth() === date.getMonth() &&
                              now.getFullYear() === date.getFullYear();

            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(now.getDate() - 1);
            const isYesterday = yesterdayDate.getDate() === date.getDate() &&
                                yesterdayDate.getMonth() === date.getMonth() &&
                                yesterdayDate.getFullYear() === date.getFullYear();

            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (isSameDay) {
                today.push(n);
            } else if (isYesterday) {
                yesterday.push(n);
            } else if (diffDays <= 7) {
                thisWeek.push(n);
            } else {
                earlier.push(n);
            }
        });

        return [
            { title: "Today", items: today },
            { title: "Yesterday", items: yesterday },
            { title: "This week", items: thisWeek },
            { title: "Earlier", items: earlier }
        ].filter(g => g.items.length > 0);
    }, [filteredNotifications]);

    if (!currentUser) return null;

    return (
        <div className="pt-20 pb-24 min-h-[100dvh] bg-[#0D0D1A] text-white px-3 sm:px-6 max-w-2xl mx-auto flex flex-col">
            {/* ── Top Header ── */}
            <div className="flex items-center justify-between mb-5 sticky top-16 bg-[#0D0D1A]/90 backdrop-blur-md py-3 z-30 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setPage(PAGES.HOME)} 
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition active:scale-95"
                        title="Back to Feed"
                    >
                        <FiArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                            Notifications
                            {notifications.some(n => !n.is_read) && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#e1306c] animate-pulse" />
                            )}
                        </h1>
                        <span className="text-[11px] text-gray-400">
                            {notifications.length} {notifications.length === 1 ? 'activity' : 'activities'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchNotifications(true)}
                        disabled={refreshing}
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition"
                        title="Refresh"
                    >
                        <FiRefreshCw size={15} className={refreshing ? "animate-spin text-pink-400" : ""} />
                    </button>
                    {notifications.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs font-semibold border border-white/5 transition flex items-center gap-1.5"
                            title="Clear All Activity"
                        >
                            <FiTrash2 size={13} />
                            <span>Clear All</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Filter Pills (Instagram Style) ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 custom-scrollbar text-xs font-bold shrink-0">
                {[
                    { id: "all", label: "All Activity", icon: null },
                    { id: "follows", label: "Followers", icon: <FiUserPlus size={13} /> },
                    { id: "likes", label: "Likes", icon: <FiHeart size={13} /> },
                    { id: "comments", label: "Comments", icon: <FiMessageCircle size={13} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                            filter === tab.id
                                ? "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white shadow-lg shadow-pink-500/20"
                                : "bg-[#16162A] text-gray-400 hover:text-white border border-white/5 hover:border-white/10"
                        }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Activity Content Body ── */}
            <div className="bg-[#16162A] border border-white/5 rounded-3xl shadow-2xl overflow-hidden min-h-[360px] flex-1 flex flex-col">
                {loading ? (
                    <div className="p-3">
                        <NotificationListSkeleton count={6} />
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="text-gray-400 text-center py-24 px-6 flex flex-col items-center justify-center gap-3 flex-1">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500/10 to-purple-600/10 border border-pink-500/20 flex items-center justify-center text-pink-400 text-2xl shadow-inner mb-1">
                            <FiInbox />
                        </div>
                        <h3 className="font-bold text-white text-base">No Notifications Here</h3>
                        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                            {filter === "all"
                                ? "Jab koi aapki profile follow karega ya photos par like/comment karega, toh yahan dikhai dega."
                                : `${filter.toUpperCase()} category me koi activity nahi hai.`}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-white/5">
                        {categorizedGroups.map(group => (
                            <div key={group.title} className="flex flex-col">
                                {/* Group Title Header */}
                                <div className="px-5 py-3 bg-[#131324]/80 backdrop-blur-sm sticky top-0 z-10 border-b border-white/5">
                                    <span className="text-xs font-black uppercase tracking-wider text-gray-400">
                                        {group.title}
                                    </span>
                                </div>

                                {/* Items in this Group */}
                                <div className="divide-y divide-white/[0.04]">
                                    {group.items.map(notif => {
                                        const isFollowingSender = followStatusMap[notif.sender_id] !== undefined
                                            ? followStatusMap[notif.sender_id]
                                            : Boolean(notif.is_following_sender);
                                        const isFollowLoading = Boolean(followActionLoading[notif.sender_id]);

                                        return (
                                            <div
                                                key={notif.id}
                                                className={`flex items-center justify-between p-4 transition-all duration-200 group relative ${
                                                    notif.is_read ? 'hover:bg-white/[0.03]' : 'bg-pink-500/[0.04] hover:bg-pink-500/[0.08]'
                                                }`}
                                            >
                                                {/* Sender avatar & details */}
                                                <div 
                                                    className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0 pr-3" 
                                                    onClick={() => handleProfileClick(notif)}
                                                >
                                                    <div className="relative shrink-0">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden p-[2px] bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 shadow-md">
                                                            <img
                                                                src={notif.sender_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                                                alt={notif.sender_name}
                                                                className="w-full h-full rounded-full object-cover bg-[#0D0D1A]"
                                                            />
                                                        </div>
                                                        {/* Activity badge icon on avatar corner */}
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[#16162A] border border-white/10 shadow-sm">
                                                            {notif.type === 'like' && '❤️'}
                                                            {notif.type === 'comment' && '💬'}
                                                            {notif.type === 'follow' && '👤'}
                                                            {notif.type === 'booking' && '📅'}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs sm:text-sm text-gray-300 leading-snug">
                                                            <span className="font-bold text-white hover:text-pink-400 transition-colors">
                                                                {notif.sender_name}
                                                            </span>
                                                            {notif.sender_username && (
                                                                <span className="text-[11px] text-gray-500 font-medium ml-1">
                                                                    @{notif.sender_username}
                                                                </span>
                                                            )}
                                                            <span className="text-gray-300 ml-1.5">
                                                                {notif.type === 'like' && 'liked your photo.'}
                                                                {notif.type === 'comment' && 'commented on your post.'}
                                                                {notif.type === 'follow' && 'started following you.'}
                                                                {notif.type === 'booking' && 'sent you a session request.'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                                                            <span>{formatTime(notif.created_at)}</span>
                                                            {!notif.is_read && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Side Actions: Follow Button OR Post Thumbnail */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Follow notification -> Follow / Following button */}
                                                    {notif.type === 'follow' && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleFollowToggle(e, notif)}
                                                            disabled={isFollowLoading}
                                                            className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                                                                isFollowingSender
                                                                    ? "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                                                                    : "bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 text-white shadow-pink-500/20"
                                                            }`}
                                                        >
                                                            {isFollowLoading ? (
                                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            ) : isFollowingSender ? (
                                                                <>
                                                                    <FiUserCheck size={13} />
                                                                    <span>Following</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FiUserPlus size={13} />
                                                                    <span>Follow Back</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Like/Comment notification -> Square Post Thumbnail */}
                                                    {(notif.type === 'like' || notif.type === 'comment') && notif.post_image && (
                                                        <div
                                                            onClick={(e) => handleViewPost(e, notif)}
                                                            className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 hover:border-pink-500/50 cursor-pointer shadow-sm group-hover:scale-105 transition duration-200 shrink-0 bg-black/40"
                                                            title="View Post"
                                                        >
                                                            <img
                                                                src={notif.post_image}
                                                                alt="Post"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Delete notification button on hover */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteNotification(e, notif.id)}
                                                        className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center transition text-xs ml-1"
                                                        title="Delete Notification"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Post Detail Viewer Modal (when thumbnail clicked) ── */}
            {activePost && (
                <InstagramPostModal
                    posts={[activePost]}
                    initialPostId={activePost.id}
                    postOwner={postOwner || { name: currentUser.name, profile_pic: currentUser.profile_pic }}
                    currentUser={currentUser}
                    onClose={() => {
                        setActivePost(null);
                        setPostOwner(null);
                    }}
                />
            )}
        </div>
    );
}

export default NotificationsPage;
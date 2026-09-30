import React, { useState, useEffect } from "react";
import { PAGES } from "../App";
import { FiHome, FiSearch, FiMessageCircle, FiBell, FiUser, FiCamera, FiTrash2, FiPlusCircle, FiShield, FiCreditCard, FiHeart, FiMenu, FiPlusSquare, FiLock, FiCrop, FiLogIn, FiUserPlus } from "react-icons/fi";
import { APP_VERSION_TAG } from "../config/version";
import VerifiedBadge from "./shared/VerifiedBadge";
import ImageCropperModal from "./shared/ImageCropperModal";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function Navbar({ page, setPage, girlUser, boyUser, adminUser, setGirlUser, setBoyUser, socket }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showPostModal, setShowPostModal] = useState(false);
    const [postFile, setPostFile] = useState(null);
    const [postPreview, setPostPreview] = useState(null);
    const [rawPostImageSrc, setRawPostImageSrc] = useState(null);
    const [cropModalData, setCropModalData] = useState(null);
    const [postCaption, setPostCaption] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

    // Instagram style post destinations & settings
    const [showOnFeed, setShowOnFeed] = useState(true);
    const [showOnProfile, setShowOnProfile] = useState(true);
    const [followersOnly, setFollowersOnly] = useState(false);
    const [disableComments, setDisableComments] = useState(false);
    const [hideLikes, setHideLikes] = useState(false);

    const currentUser = boyUser || girlUser || adminUser;
    const isBoy = boyUser !== null;
    const isAdmin = adminUser !== null;
    const hasDocument = Boolean(currentUser?.id_proof_url || currentUser?.kyc_status === 'verified' || currentUser?.kyc_status === 'pending');
    const isProfilePage = page === PAGES.BOY_DASHBOARD || page === PAGES.GIRL_DASHBOARD || page === PAGES.ADMIN_DASHBOARD;

    useEffect(() => {
        if (!currentUser) return;

        const fetchTotalUnread = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const headers = { 'Authorization': `Bearer ${token}` };

                // ⚡ Direct high-performance single query
                const fastRes = await fetch(`${API}/unread-messages-count`, { headers });
                if (fastRes.ok) {
                    const data = await fastRes.json();
                    setUnreadCount(data.count || 0);
                    return;
                }

                // Fallback with auth headers
                const res = await fetch(`${API}/chats/${currentUser.id}`, { headers });
                if (res.ok) {
                    const users = await res.json();
                    let totalUnread = 0;

                    await Promise.all(users.map(async (person) => {
                        const msgRes = await fetch(`${API}/messages/${currentUser.id}/${person.id}`, { headers });
                        if (msgRes.ok) {
                            const msgs = await msgRes.json();
                            const unread = msgs.filter(m => String(m.sender_id) === String(person.id) && !m.is_read).length;
                            totalUnread += unread;
                        }
                    }));
                    setUnreadCount(totalUnread);
                }
            } catch (err) { }
        };

        const fetchTotalUnreadNotifs = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API}/notifications/${currentUser.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const notifs = await res.json();
                    if (Array.isArray(notifs)) {
                        setUnreadNotifsCount(notifs.filter(n => !n.is_read).length);
                    }
                }
            } catch (err) { }
        };

        fetchTotalUnread();
        fetchTotalUnreadNotifs();

        if (socket) {
            const handleNewMessage = (data) => {
                if (page !== PAGES.CHAT && String(data.receiver_id) === String(currentUser.id)) {
                    setUnreadCount((prev) => prev + 1);
                }
            };

            const handleMessagesRead = (data) => {
                if (String(data.receiver_id) === String(currentUser.id) || String(data.sender_id) === String(currentUser.id)) {
                    fetchTotalUnread();
                }
            };

            const handleNewNotif = () => {
                setUnreadNotifsCount((prev) => prev + 1);
            };

            socket.on("receive_message", handleNewMessage);
            socket.on("messages_read_update", handleMessagesRead);
            socket.on("new_notification", handleNewNotif);
            socket.on("notification_received", handleNewNotif);

            return () => {
                socket.off("receive_message", handleNewMessage);
                socket.off("messages_read_update", handleMessagesRead);
                socket.off("new_notification", handleNewNotif);
                socket.off("notification_received", handleNewNotif);
            };
        }
    }, [socket, currentUser, page]);

    const getLinkStyle = (targetPage) => {
        const isActive = page === targetPage;
        return `px-3 py-1.5 text-sm transition-all duration-300 ${isActive
            ? "text-pink-400 font-bold border-b-2 border-pink-500"
            : "text-gray-400 hover:text-white"
            }`;
    };

    const handleNavClick = (targetPage) => {
        setPage(targetPage);
        setIsMenuOpen(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setRawPostImageSrc(reader.result);
                setCropModalData({
                    imageSrc: reader.result,
                    isCircular: false,
                    allowAspectChange: true,
                    initialAspect: '1:1',
                    title: 'Crop & Adjust Photo',
                    onComplete: ({ file: croppedFile, dataUrl }) => {
                        setPostFile(croppedFile);
                        setPostPreview(dataUrl);
                        setCropModalData(null);
                    }
                });
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };

    const handleReCrop = () => {
        const source = rawPostImageSrc || postPreview;
        if (!source) return;
        setCropModalData({
            imageSrc: source,
            isCircular: false,
            allowAspectChange: true,
            initialAspect: '1:1',
            title: 'Crop & Adjust Photo',
            onComplete: ({ file: croppedFile, dataUrl }) => {
                setPostFile(croppedFile);
                setPostPreview(dataUrl);
                setCropModalData(null);
            }
        });
    };

    const closePostModal = () => {
        setShowPostModal(false);
        setPostFile(null);
        setPostPreview(null);
        setRawPostImageSrc(null);
        setCropModalData(null);
        setPostCaption("");
        setShowOnFeed(true);
        setShowOnProfile(true);
        setFollowersOnly(false);
        setDisableComments(false);
        setHideLikes(false);
    };

    const handlePostSubmit = async () => {
        if (!postFile || !currentUser) return;
        setIsPosting(true);
        const formData = new FormData();
        formData.append("post_image", postFile);
        formData.append("caption", postCaption);
        formData.append("show_on_feed", showOnFeed);
        formData.append("show_on_profile", showOnProfile);
        formData.append("followers_only", followersOnly);
        formData.append("disable_comments", disableComments);
        formData.append("hide_likes", hideLikes);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/posts/${currentUser.id}`, {
                method: "POST",
                body: formData,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                alert("Post shared successfully!");
                closePostModal();
            } else {
                const data = await response.json();
                alert(data.error || "Upload failed.");
            }
        } catch (err) {
            alert("Upload failed. Please try again.");
        } finally {
            setIsPosting(false);
        }
    };

    const activeColor = "text-[#e1306c] drop-shadow-[0_0_8px_rgba(225,48,108,0.5)]";
    const inactiveColor = "text-gray-500 hover:text-gray-300";
    const isHiddenScreen = 
        page === PAGES.CHAT || 
        page === PAGES.DETAILS || 
        page === PAGES.BOY_LOGIN || 
        page === PAGES.GIRL_LOGIN || 
        page === PAGES.BOY_REGISTER || 
        page === PAGES.GIRL_REGISTER;

    return (
        <>
            {!isHiddenScreen && (
                <nav className="fixed top-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-b border-[#262626] hidden md:block shadow-[0_2px_24px_rgba(0,0,0,0.6)]">
                    <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between gap-6">

                        {/* ─── LEFT: Logo ─── */}
                        <button onClick={() => handleNavClick(PAGES.HOME)} className="flex items-center gap-2.5 shrink-0">
                            <svg className="w-8 h-8 shrink-0 drop-shadow-[0_0_8px_rgba(225,48,108,0.4)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 40H68C68 40 69 68 45 68C21 68 22 40 22 40Z" stroke="url(#ai-grad2)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M68 45H75C80 45 83 48 83 53C83 58 80 61 75 61H66" stroke="url(#ai-grad2)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18 75H72" stroke="url(#ai-grad2)" strokeWidth="6" strokeLinecap="round"/>
                                <path d="M45 29C40 23 32 30 39 37L45 42L51 37C58 30 50 23 45 29Z" fill="url(#ai-grad2)"/>
                                <path d="M31 27C30 24 31 21 33 19" stroke="url(#ai-grad2)" strokeWidth="4" strokeLinecap="round"/>
                                <path d="M59 27C60 24 59 21 57 19" stroke="url(#ai-grad2)" strokeWidth="4" strokeLinecap="round"/>
                                <defs><linearGradient id="ai-grad2" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#f9ce3f" /><stop offset="0.5" stopColor="#e1306c" /><stop offset="1" stopColor="#833ab4" /></linearGradient></defs>
                            </svg>
                            <span className="text-lg font-black bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] bg-clip-text text-transparent tracking-wide">Coffeely</span>
                        </button>

                        {/* ─── CENTER: Nav Icons ─── */}
                        <div className="flex items-center gap-1 flex-1 justify-center">
                            {!currentUser ? (
                                <>
                                    <button onClick={() => handleNavClick(PAGES.HOME)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${page === PAGES.HOME ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Home</button>
                                    <button onClick={() => handleNavClick(PAGES.ABOUT)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${page === PAGES.ABOUT ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>About</button>
                                    <button onClick={() => handleNavClick(PAGES.HELP)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${page === PAGES.HELP ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Help</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleNavClick(PAGES.HOME)} title="Home" className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${page === PAGES.HOME ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                        <FiHome size={20} /><span className="text-[9px] mt-0.5 font-semibold">Home</span>
                                    </button>
                                    <button onClick={() => handleNavClick(PAGES.FIND)} title="Find" className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${page === PAGES.FIND ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                        <FiSearch size={20} /><span className="text-[9px] mt-0.5 font-semibold">Find</span>
                                    </button>
                                    <button onClick={() => handleNavClick(PAGES.MESSAGES)} title="Messages" className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${page === PAGES.MESSAGES ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                        <span className="relative"><FiMessageCircle size={20} />{unreadCount > 0 && <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] text-center leading-[15px]">{unreadCount}</span>}</span>
                                        <span className="text-[9px] mt-0.5 font-semibold">Inbox</span>
                                    </button>
                                    {hasDocument && (
                                        <button onClick={() => handleNavClick(PAGES.WALLET)} title="Wallet" className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${page === PAGES.WALLET ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                            <FiCreditCard size={20} /><span className="text-[9px] mt-0.5 font-semibold">Wallet</span>
                                        </button>
                                    )}
                                    <button onClick={() => handleNavClick(PAGES.NOTIFICATIONS)} title="Activity" className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${page === PAGES.NOTIFICATIONS ? 'text-[#e1306c] bg-[#e1306c]/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                        <span className="relative">
                                            <FiBell size={20} />
                                            {unreadNotifsCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-black animate-pulse" />
                                            )}
                                        </span>
                                        <span className="text-[9px] mt-0.5 font-semibold">Activity</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* ─── RIGHT: Actions ─── */}
                        <div className="flex items-center gap-2 shrink-0">
                            {currentUser ? (
                                <>
                                    {isAdmin && (
                                        <button onClick={() => handleNavClick(PAGES.ADMIN_DASHBOARD)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold rounded-lg shadow-md hover:opacity-90 transition shrink-0">
                                            <FiShield size={13} /> Admin
                                        </button>
                                    )}
                                    {hasDocument && (
                                        <button onClick={() => handleNavClick(PAGES.WALLET)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 rounded-full text-pink-300 transition shrink-0 shadow-sm">
                                            <FiCreditCard size={13} /> Wallet
                                        </button>
                                    )}
                                    <button onClick={() => setShowPostModal(true)} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-white/5 border border-[#262626] hover:bg-white/10 rounded-full text-white transition shrink-0">
                                        <FiPlusCircle size={14} /> Post
                                    </button>
                                    <button
                                        onClick={() => handleNavClick(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD)}
                                        className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm font-bold transition-all border shrink-0 ${page === PAGES.GIRL_DASHBOARD || page === PAGES.BOY_DASHBOARD ? 'bg-[#e1306c] border-[#e1306c]/50 text-white shadow-[0_0_14px_rgba(225,48,108,0.4)]' : 'bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] border-[#e1306c]/30 text-white shadow-[0_0_14px_rgba(225,48,108,0.2)] hover:opacity-95'}`}
                                    >
                                        {currentUser.profile_pic ? (
                                            <img src={currentUser.profile_pic} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-white/30 shrink-0" />
                                        ) : (
                                            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold border-2 border-white/30 shrink-0">{currentUser.name?.[0]?.toUpperCase()}</span>
                                        )}
                                        {currentUser.name.split(" ")[0]}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleNavClick(PAGES.GIRL_LOGIN)} className="px-4 py-1.5 text-sm border border-[#e1306c]/60 text-[#e1306c] rounded-full hover:bg-[#e1306c] hover:text-white transition font-medium">Join as Girl</button>
                                    <button onClick={() => handleNavClick(PAGES.BOY_LOGIN)} className="px-4 py-1.5 text-sm bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] text-white rounded-full hover:opacity-90 transition font-bold shadow-md">Find Companion</button>
                                </>
                            )}
                        </div>
                    </div>
                </nav>
            )}


            {/* ─── MOBILE TOP BAR: Instagram Style for Logged In, Guest Header for Visitors ─── */}
            {!isHiddenScreen && currentUser && (
                <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-b border-[#262626] pt-[env(safe-area-inset-top,0px)] h-[calc(3.5rem+env(safe-area-inset-top,0px))] flex items-center justify-between px-4">
                    {isProfilePage ? (
                        <>
                            {/* Instagram Profile Top Header: Username on Left */}
                            <div className="flex items-center gap-1.5 min-w-0">
                                {currentUser.is_private && <FiLock size={14} className="text-gray-400 shrink-0" />}
                                <h3 className="text-lg font-black text-white tracking-tight truncate max-w-[210px]">
                                    {currentUser.username ? `@${currentUser.username}` : currentUser.name}
                                </h3>
                                {currentUser.kyc_status === 'verified' && (
                                    <VerifiedBadge size="sm" />
                                )}
                            </div>

                            {/* Instagram Profile Top Header: Create Post (+) & Settings Menu (☰) on Right */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowPostModal(true)}
                                    className="w-10 h-10 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition active:scale-90"
                                    title="New Post"
                                    aria-label="New Post"
                                >
                                    <FiPlusSquare size={23} />
                                </button>
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
                                    className="w-10 h-10 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition active:scale-90"
                                    title="Settings & Menu"
                                    aria-label="Settings & Menu"
                                >
                                    <FiMenu size={25} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Instagram Feed Top Header: Coffeely on Left */}
                            <button onClick={() => handleNavClick(PAGES.HOME)} className="flex items-center gap-2 outline-none">
                                <h3 className="text-2xl font-black bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] bg-clip-text text-transparent tracking-wider select-none">
                                    Coffeely
                                </h3>
                            </button>

                            {/* Instagram Feed Top Header: Notification (Heart) + DM (Message) on Right */}
                            <div className="flex items-center gap-1">
                                {/* Notifications (Instagram-Style Heart Activity) */}
                                <button
                                    onClick={() => handleNavClick(PAGES.NOTIFICATIONS)}
                                    className={`relative p-2.5 rounded-full transition active:scale-90 ${page === PAGES.NOTIFICATIONS ? 'text-[#e1306c]' : 'text-white hover:text-gray-300'}`}
                                    title="Notifications"
                                    aria-label="Notifications"
                                >
                                    <FiHeart size={24} className={page === PAGES.NOTIFICATIONS ? "fill-[#e1306c] text-[#e1306c]" : ""} />
                                    {unreadNotifsCount > 0 && (
                                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-black animate-pulse" />
                                    )}
                                </button>

                                {/* Direct Messages Icon */}
                                <button
                                    onClick={() => handleNavClick(PAGES.MESSAGES)}
                                    className={`relative p-2.5 rounded-full transition active:scale-90 ${page === PAGES.MESSAGES ? 'text-[#e1306c]' : 'text-white hover:text-gray-300'}`}
                                    title="Direct Messages"
                                    aria-label="Direct Messages"
                                >
                                    <FiMessageCircle size={24} />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[16px] h-4 flex items-center justify-center ring-2 ring-black">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {!isHiddenScreen && !currentUser && (
                <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-black/95 backdrop-blur border-b border-[#262626] h-14 flex items-center justify-between px-4">
                    <h3 className="text-xl font-black bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] bg-clip-text text-transparent tracking-wider">
                        Coffeely
                    </h3>

                    <button className="text-2xl text-white outline-none" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? "✕" : "☰"}
                    </button>
                </div>
            )}

            {isMenuOpen && !isHiddenScreen && !currentUser && (
                <div className="md:hidden fixed top-14 left-0 w-full bg-[#121212] border-b border-[#262626] py-4 px-6 flex flex-col gap-4 shadow-xl z-40">
                    <button onClick={() => handleNavClick(PAGES.HOME)} className={`text-left ${getLinkStyle(PAGES.HOME)} w-fit`}>Home</button>
                    <button onClick={() => handleNavClick(PAGES.FIND)} className={`text-left ${getLinkStyle(PAGES.FIND)} w-fit`}>Explore Companions</button>
                    <button onClick={() => handleNavClick(PAGES.ABOUT)} className={`text-left ${getLinkStyle(PAGES.ABOUT)} w-fit`}>About</button>
                    <button onClick={() => handleNavClick(PAGES.HELP)} className={`text-left ${getLinkStyle(PAGES.HELP)} w-fit`}>Help</button>
                    <div className="h-px bg-white/10 w-full my-2"></div>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleNavClick(PAGES.BOY_LOGIN)} className="px-4 py-2.5 text-sm bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] text-white font-semibold rounded-xl text-center shadow-lg">Log In</button>
                        <button onClick={() => handleNavClick(PAGES.BOY_REGISTER)} className="px-4 py-2.5 text-sm border border-white/20 hover:border-white/40 text-white font-semibold rounded-xl text-center bg-white/5">Create Account</button>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-[11px] text-gray-500 border-t border-white/5 mt-1">
                        <span>Coffeely App</span>
                        <span className="font-mono text-emerald-400 font-semibold">{APP_VERSION_TAG} (Latest)</span>
                    </div>
                </div>
            )}

            {!isHiddenScreen && (
                <div className="fixed bottom-0 left-0 w-full bg-[#121212]/95 backdrop-blur-xl border-t border-[#262626] z-40 md:hidden pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2">
                    <div className="flex justify-around items-center h-14 max-w-md mx-auto px-2">
                        {currentUser ? (
                            <>
                                <button onClick={() => handleNavClick(PAGES.HOME)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.HOME ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    <FiHome size={22} /><span className="text-[9px] font-bold">Home</span>
                                </button>

                                <button onClick={() => handleNavClick(PAGES.FIND)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.FIND ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    <FiSearch size={22} /><span className="text-[9px] font-bold">Explore</span>
                                </button>

                                <button onClick={() => setShowPostModal(true)} className="flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 text-pink-400 hover:text-pink-300">
                                    <FiPlusCircle size={24} />
                                    <span className="text-[9px] font-bold">Post</span>
                                </button>

                                {hasDocument && (
                                    <button onClick={() => handleNavClick(PAGES.WALLET)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.WALLET ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                        <FiCreditCard size={22} />
                                        <span className="text-[9px] font-bold">Wallet</span>
                                    </button>
                                )}

                                <button onClick={() => handleNavClick(currentUser.role === 'girl' ? PAGES.GIRL_DASHBOARD : PAGES.BOY_DASHBOARD)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${(page === PAGES.BOY_DASHBOARD || page === PAGES.GIRL_DASHBOARD) ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    {currentUser.profile_pic ? (
                                        <img
                                            src={currentUser.profile_pic}
                                            alt=""
                                            className={`w-6 h-6 rounded-full object-cover transition-all ${(page === PAGES.BOY_DASHBOARD || page === PAGES.GIRL_DASHBOARD) ? "ring-2 ring-[#e1306c] ring-offset-1 ring-offset-black" : "border border-white/20"}`}
                                        />
                                    ) : (
                                        <FiUser size={22} />
                                    )}
                                    <span className="text-[9px] font-bold">Profile</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleNavClick(PAGES.HOME)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.HOME ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    <FiHome size={22} /><span className="text-[9px] font-bold">Home</span>
                                </button>
                                <button onClick={() => handleNavClick(PAGES.FIND)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.FIND ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    <FiSearch size={22} /><span className="text-[9px] font-bold">Explore</span>
                                </button>
                                <button onClick={() => handleNavClick(PAGES.BOY_LOGIN)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.BOY_LOGIN || page === PAGES.GIRL_LOGIN ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    <FiLogIn size={22} /><span className="text-[9px] font-bold">Log In</span>
                                </button>
                                <button onClick={() => handleNavClick(PAGES.BOY_REGISTER)} className={`flex flex-col items-center justify-center w-12 gap-1 transition-all duration-300 ${page === PAGES.BOY_REGISTER || page === PAGES.GIRL_REGISTER ? activeColor + " scale-110 -translate-y-1" : inactiveColor}`}>
                                    <FiUserPlus size={22} /><span className="text-[9px] font-bold">Register</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showPostModal && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-0">
                    <div className="bg-[#121212] sm:border border-[#262626] sm:rounded-2xl w-full max-w-md h-full sm:h-auto overflow-hidden flex flex-col animate-slide-up sm:animate-none">
                        <div className="flex justify-between items-center px-4 py-3 border-b border-[#262626] bg-black">
                            <button onClick={closePostModal} className="text-white text-2xl hover:text-red-400 transition">✕</button>
                            <h3 className="font-bold text-white text-lg">New Post</h3>
                            <button
                                onClick={handlePostSubmit}
                                disabled={!postFile || isPosting}
                                className="font-bold text-lg transition text-pink-500 hover:text-pink-400"
                            >
                                {isPosting ? "Posting..." : "Share"}
                            </button>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
                            {!postPreview ? (
                                <label className="w-full aspect-square border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition hover:border-pink-500 hover:bg-pink-500/5">
                                    <FiCamera size={48} className="text-pink-400 mb-3" />
                                    <span className="text-white font-bold text-lg">Select Photo</span>
                                    <span className="text-gray-500 text-sm mt-1">Tap to browse files</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                                </label>
                            ) : (
                                <div className="flex flex-col gap-4 animate-fade-in">
                                    <div className="relative">
                                        <img src={postPreview} alt="Preview" className="w-full aspect-square object-cover rounded-xl border border-white/10 shadow-lg" />
                                        <div className="absolute top-3 right-3 flex items-center gap-2">
                                            <button type="button" onClick={handleReCrop} className="bg-black/60 text-white px-2.5 py-1.5 rounded-full backdrop-blur-md hover:bg-white/20 transition flex items-center gap-1 text-xs">
                                                <FiCrop size={13} className="text-pink-400" /> Adjust
                                            </button>
                                            <button type="button" onClick={() => { setPostFile(null); setPostPreview(null); setRawPostImageSrc(null); }} className="bg-black/60 text-white p-1.5 rounded-full backdrop-blur-md hover:bg-red-500 transition flex items-center gap-1 text-xs">
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <img src={currentUser?.profile_pic || (isBoy ? "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" : "https://cdn-icons-png.flaticon.com/512/3135/3135768.png")} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                        <textarea
                                            placeholder="Write a caption..."
                                            value={postCaption}
                                            onChange={(e) => setPostCaption(e.target.value)}
                                            className={`flex-1 bg-transparent border-b border-white/10 p-2 text-sm text-white resize-none h-20 outline-none transition ${currentUser?.role === 'girl' ? 'focus:border-pink-500' : 'focus:border-blue-500'}`}
                                        />
                                    </div>

                                    {/* Instagram style options block */}
                                    <div className="mt-4 border-t border-white/10 pt-4 flex flex-col gap-3.5 pb-2">
                                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Post Settings & Options</h4>
                                        
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Show on Explore Feed</div>
                                                <div className="text-[11px] text-gray-500">Make visible in the global Explore / Find feed.</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={showOnFeed} 
                                                    onChange={(e) => setShowOnFeed(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className={`w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentUser?.role === 'girl' ? 'peer-checked:bg-pink-500' : 'peer-checked:bg-blue-500'}`}></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Show on Profile Grid</div>
                                                <div className="text-[11px] text-gray-500">Show this photo in your profile gallery grid.</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={showOnProfile} 
                                                    onChange={(e) => setShowOnProfile(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className={`w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentUser?.role === 'girl' ? 'peer-checked:bg-pink-500' : 'peer-checked:bg-blue-500'}`}></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Followers Only</div>
                                                <div className="text-[11px] text-gray-500">Only people who follow you can view this post.</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={followersOnly} 
                                                    onChange={(e) => setFollowersOnly(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className={`w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentUser?.role === 'girl' ? 'peer-checked:bg-pink-500' : 'peer-checked:bg-blue-500'}`}></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Turn off Commenting</div>
                                                <div className="text-[11px] text-gray-500">Disable leaving comments on this specific post.</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={disableComments} 
                                                    onChange={(e) => setDisableComments(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className={`w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentUser?.role === 'girl' ? 'peer-checked:bg-pink-500' : 'peer-checked:bg-blue-500'}`}></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">Hide Likes count</div>
                                                <div className="text-[11px] text-gray-500">Only you can view the likes count of this post.</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={hideLikes} 
                                                    onChange={(e) => setHideLikes(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className={`w-9 h-5 bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentUser?.role === 'girl' ? 'peer-checked:bg-pink-500' : 'peer-checked:bg-blue-500'}`}></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {cropModalData && (
                <ImageCropperModal
                    imageSrc={cropModalData.imageSrc}
                    isCircular={cropModalData.isCircular}
                    allowAspectChange={cropModalData.allowAspectChange}
                    initialAspect={cropModalData.initialAspect}
                    title={cropModalData.title}
                    onCropComplete={cropModalData.onComplete}
                    onClose={() => setCropModalData(null)}
                />
            )}
        </>
    );
}

export default Navbar;
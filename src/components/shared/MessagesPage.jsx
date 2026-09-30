import React, { useState, useEffect, useCallback, useRef } from "react";
import { PAGES } from "../../App";
import { FiMessageCircle, FiRefreshCw, FiInbox, FiPhone, FiLock, FiUnlock, FiEye, FiEyeOff, FiSearch, FiShield, FiX, FiArrowLeft } from "react-icons/fi";
import { isChatLocked, isChatHidden, hideChat, unhideChat, lockChat, unlockChat, isLockedFolderHidden, setLockedFolderHidden, verifyChatLockPin, hasChatLockPin } from "../../utils/chatLockManager";
import ChatLockPinModal from "./ChatLockPinModal";
import { MessageListSkeleton } from "./SkeletonLoaders";

// Backend API Base Configuration
const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function MessagesPage({ currentUser, setPage, setSelectedGirl, socket }) {
    const [activeTab, setActiveTab] = useState("chats"); // 'chats' | 'calls'
    const [chatHistory, setChatHistory] = useState([]);
    const [callLogs, setCallLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [callsLoading, setCallsLoading] = useState(false);

    // Search and Secret Mode States
    const [searchQuery, setSearchQuery] = useState("");
    const [secretCodeToast, setSecretCodeToast] = useState("");
    const [hideLockedFolder, setHideLockedFolder] = useState(() => isLockedFolderHidden(currentUser?.id));

    // WhatsApp-Style Chat Lock & Hide States
    const [isLockedUnlocked, setIsLockedUnlocked] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinModalMode, setPinModalMode] = useState("verify");
    const [pendingChatToOpen, setPendingChatToOpen] = useState(null);

    useEffect(() => {
        if (!currentUser) {
            setPage(PAGES.HOME);
            return;
        }

        const cachedInbox = sessionStorage.getItem("inboxCache");
        if (cachedInbox) {
            setChatHistory(JSON.parse(cachedInbox));
            setLoading(false);
        } else {
            setLoading(true);
        }

        const fetchChatsAndDetails = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                const res = await fetch(`${API}/chats/${currentUser.id}`, { headers });
                if (res.ok) {
                    const users = await res.json();

                    const chatsWithDetails = await Promise.all(users.map(async (person) => {
                        try {
                            const msgRes = await fetch(`${API}/messages/${currentUser.id}/${person.id}`, { headers });
                            if (msgRes.ok) {
                                const msgs = await msgRes.json();
                                const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

                                const unreadCount = msgs.filter(m => String(m.sender_id) === String(person.id) && !m.is_read).length;

                                let preview = '';
                                if (lastMsg) {
                                    if (lastMsg.message && (lastMsg.message.includes('✅') || lastMsg.message.includes('❌'))) {
                                        preview = lastMsg.message;
                                    } else {
                                        preview = lastMsg.message || (lastMsg.image_url ? 'Photo' : 'Attachment');
                                    }
                                }

                                return {
                                    ...person,
                                    lastMessagePreview: preview,
                                    lastMessageTime: lastMsg ? new Date(lastMsg.created_at).getTime() : 0,
                                    unreadCount: unreadCount
                                };
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        return { ...person, lastMessagePreview: '', lastMessageTime: 0, unreadCount: 0 };
                    }));

                    chatsWithDetails.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
                    setChatHistory(chatsWithDetails);
                    sessionStorage.setItem("inboxCache", JSON.stringify(chatsWithDetails));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchChatsAndDetails();
    }, [currentUser, setPage]);

    const fetchCallLogs = useCallback(async () => {
        if (!currentUser) return;
        setCallsLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/call-history/${currentUser.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setCallLogs(await res.json());
            }
        } catch (e) {
            console.error("Fetch call history error:", e);
        } finally {
            setCallsLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (activeTab === 'calls') {
            fetchCallLogs();
        }
    }, [activeTab, fetchCallLogs]);

    useEffect(() => {
        if (!socket || !currentUser) return;

        const handleReceiveMessage = (data) => {
            if (data.sender_id || data.receiver_id) {
                setChatHistory(prev => {
                    const updated = prev.map(p => {
                        if (String(p.id) === String(data.sender_id) || String(p.id) === String(data.receiver_id)) {
                            const isUnread = String(p.id) === String(data.sender_id);
                            return {
                                ...p,
                                lastMessagePreview: data.message || data.text || (data.image_url ? 'Photo' : 'Attachment'),
                                lastMessageTime: Date.now(),
                                unreadCount: isUnread ? (p.unreadCount || 0) + 1 : (p.unreadCount || 0)
                            };
                        }
                        return p;
                    });
                    updated.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
                    return updated;
                });
            }
        };

        socket.on("receive_message", handleReceiveMessage);
        return () => socket.off("receive_message", handleReceiveMessage);
    }, [socket, currentUser]);

    // Secret Code Search Bar Handler
    const handleSearchInput = (val) => {
        setSearchQuery(val);
        const trimmed = val.trim();
        if (trimmed.length === 4 && hasChatLockPin(currentUser?.id) && verifyChatLockPin(currentUser?.id, trimmed)) {
            setIsLockedUnlocked(true);
            setSearchQuery("");
            setSecretCodeToast("🔓 Secret PIN Verified: All Hidden & Locked Chats Revealed!");
            setTimeout(() => setSecretCodeToast(""), 4000);
        }
    };

    // Filter chats based on search query
    const filteredBySearch = chatHistory.filter(p => 
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Split chats into Unlocked, Locked, and Hidden
    const unlockedRegularChats = filteredBySearch.filter(p => 
        !isChatLocked(currentUser?.id, p.id) && !isChatHidden(currentUser?.id, p.id)
    );
    const lockedChats = filteredBySearch.filter(p => 
        isChatLocked(currentUser?.id, p.id) && !isChatHidden(currentUser?.id, p.id)
    );
    const hiddenChats = filteredBySearch.filter(p => 
        isChatHidden(currentUser?.id, p.id)
    );

    const totalProtectedCount = lockedChats.length + hiddenChats.length;

    const handleChatClick = (person) => {
        const isProtected = isChatLocked(currentUser?.id, person.id) || isChatHidden(currentUser?.id, person.id);
        if (isProtected && !isLockedUnlocked) {
            setPendingChatToOpen(person);
            setPinModalMode("verify");
            setShowPinModal(true);
            return;
        }

        setChatHistory(prev => prev.map(p => String(p.id) === String(person.id) ? { ...p, unreadCount: 0 } : p));
        setSelectedGirl(person);
        setPage(PAGES.CHAT);
    };

    const handleUnlockLockedSection = () => {
        if (isLockedUnlocked) {
            setIsLockedUnlocked(false);
        } else {
            setPendingChatToOpen(null);
            setPinModalMode("verify");
            setShowPinModal(true);
        }
    };

    const handlePinSuccess = () => {
        setIsLockedUnlocked(true);
        if (pendingChatToOpen) {
            const target = pendingChatToOpen;
            setPendingChatToOpen(null);
            setChatHistory(prev => prev.map(p => String(p.id) === String(target.id) ? { ...p, unreadCount: 0 } : p));
            setSelectedGirl(target);
            setPage(PAGES.CHAT);
        }
    };

    const handleToggleHideChat = (e, person) => {
        e.stopPropagation();
        if (isChatHidden(currentUser?.id, person.id)) {
            unhideChat(currentUser?.id, person.id);
            setSecretCodeToast(`👁️ Chat with ${person.name} is now unhidden`);
        } else {
            if (!hasChatLockPin(currentUser?.id)) {
                setPendingChatToOpen(person);
                setPinModalMode("set_new");
                setShowPinModal(true);
                return;
            }
            hideChat(currentUser?.id, person.id);
            setSecretCodeToast(`👁️‍🗨️ Chat with ${person.name} hidden! Use PIN to unhide.`);
        }
        setTimeout(() => setSecretCodeToast(""), 3500);
        // Force refresh state
        setChatHistory([...chatHistory]);
    };

    const handleToggleLockChat = (e, person) => {
        e.stopPropagation();
        if (isChatLocked(currentUser?.id, person.id)) {
            unlockChat(currentUser?.id, person.id);
            setSecretCodeToast(`🔓 Chat with ${person.name} unlocked`);
        } else {
            if (!hasChatLockPin(currentUser?.id)) {
                setPendingChatToOpen(person);
                setPinModalMode("set_new");
                setShowPinModal(true);
                return;
            }
            lockChat(currentUser?.id, person.id);
            setSecretCodeToast(`🔒 Chat with ${person.name} locked`);
        }
        setTimeout(() => setSecretCodeToast(""), 3500);
        setChatHistory([...chatHistory]);
    };

    const handleToggleHideFolderMode = () => {
        const nextState = !hideLockedFolder;
        setHideLockedFolder(nextState);
        setLockedFolderHidden(currentUser?.id, nextState);
        setSecretCodeToast(nextState 
            ? "🙈 Locked Chats Folder is now HIDDEN from the list. Type your 4-digit PIN in the Search Bar to reveal!" 
            : "👁️ Locked Chats Folder is now visible at the top."
        );
        setTimeout(() => setSecretCodeToast(""), 5000);
    };

    const formatDuration = (secs) => {
        if (!secs || secs <= 0) return 'Missed';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s}s`;
    };

    // ─── Instagram-Style Swipe Gestures: Swipe Right to Return to Home Feed ───
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

        // Swipe Right (diffX < -75: moved finger left to right) -> back to Home Feed
        if (diffX < -75 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
            if (typeof setPage === 'function') {
                setPage(PAGES.HOME);
            }
        }
    };

    if (!currentUser) return null;

    return (
        <div 
            className="pt-20 pb-20 min-h-[100dvh] bg-[#0D0D1A] px-4 sm:px-6 max-w-3xl mx-auto"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPage(PAGES.HOME)}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition active:scale-90 shrink-0"
                        title="Back to Home Feed"
                        aria-label="Back to Home Feed"
                    >
                        <FiArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
                            <FiMessageCircle className="text-pink-500" /> Direct Messages
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">End-to-end encrypted chats, calls & private lock</p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-[#16162A] p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'chats' 
                                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <FiMessageCircle size={14} /> Messages
                    </button>
                    <button
                        onClick={() => setActiveTab('calls')}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'calls' 
                                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <FiPhone size={14} /> Call History
                    </button>
                </div>
            </div>

            {/* Secret Code / Action Toast Alert */}
            {secretCodeToast && (
                <div className="mb-4 bg-gradient-to-r from-purple-900/90 to-pink-900/90 border border-purple-400/40 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between animate-bounce">
                    <span className="flex items-center gap-2">{secretCodeToast}</span>
                    <button onClick={() => setSecretCodeToast("")} className="text-gray-300 hover:text-white">
                        <FiX size={15} />
                    </button>
                </div>
            )}

            {/* Search Bar with WhatsApp-Style Secret Code PIN Trigger */}
            {activeTab === 'chats' && (
                <div className="relative mb-4">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        placeholder="Search chats or enter 4-digit PIN to unhide secret chats..."
                        className="w-full bg-[#16162A] border border-white/10 rounded-2xl pl-11 pr-24 py-3 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500/50 transition shadow-lg"
                    />
                    {/* Secret Mode Status or Clear */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {searchQuery ? (
                            <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-white p-1">
                                <FiX size={14} />
                            </button>
                        ) : (
                            <button
                                onClick={handleToggleHideFolderMode}
                                title={hideLockedFolder ? "Locked folder is hidden (WhatsApp Secret Code mode)" : "Locked folder is visible"}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition flex items-center gap-1 ${
                                    hideLockedFolder
                                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                }`}
                            >
                                {hideLockedFolder ? <FiEyeOff size={11} /> : <FiEye size={11} />}
                                <span>{hideLockedFolder ? "Hidden 🙈" : "Visible 👁️"}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-[#16162A] border border-white/5 rounded-3xl shadow-xl overflow-hidden min-h-[300px]">
                {activeTab === 'chats' ? (
                    loading ? (
                        <div className="p-3">
                            <MessageListSkeleton count={5} />
                        </div>
                    ) : chatHistory.length === 0 ? (
                        <div className="text-gray-500 text-center py-16 flex flex-col items-center">
                            <FiInbox className="text-pink-500 text-5xl mb-4" />
                            <p>No messages yet. Start a conversation!</p>
                            <button onClick={() => setPage(PAGES.FIND)} className="mt-4 px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-bold hover:opacity-90 transition">
                                Find Companions
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y divide-white/5">
                            {/* ── WhatsApp-Style "Locked / Hidden Chats" Folder ── */}
                            {totalProtectedCount > 0 && (!hideLockedFolder || isLockedUnlocked) && (
                                <div
                                    onClick={handleUnlockLockedSection}
                                    className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer transition ${
                                        isLockedUnlocked
                                            ? "bg-emerald-500/10 border-b border-emerald-500/20"
                                            : "bg-purple-950/25 hover:bg-purple-950/40 border-b border-purple-500/20"
                                    }`}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-inner ${
                                            isLockedUnlocked
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                        }`}>
                                            {isLockedUnlocked ? <FiUnlock size={22} /> : <FiLock size={22} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-base">Locked & Hidden Chats</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/30 text-purple-300 border border-purple-500/40">
                                                    {totalProtectedCount} Private
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {isLockedUnlocked ? "🔓 Unlocked · Tap to lock again" : "🔒 Protected with 4-Digit PIN · Tap to unlock"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-purple-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                                        {isLockedUnlocked ? "Lock 🔒" : "Unlock 🔑"}
                                    </div>
                                </div>
                            )}

                            {/* ── Revealed Locked & Hidden Chats ── */}
                            {isLockedUnlocked && (
                                <div className="bg-purple-950/15 divide-y divide-purple-500/10 border-b border-purple-500/20">
                                    {/* Sub-filter tabs */}
                                    <div className="px-4 py-2 bg-purple-950/30 flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-purple-300 flex items-center gap-1.5">
                                            <FiShield size={12} /> Private Secret Conversations
                                        </span>
                                        <span className="text-gray-400">{lockedChats.length + hiddenChats.length} active</span>
                                    </div>

                                    {/* Render Hidden Chats */}
                                    {hiddenChats.map((person) => (
                                        <div
                                            key={person.id}
                                            onClick={() => handleChatClick(person)}
                                            className="flex items-center justify-between p-4 sm:p-5 hover:bg-purple-500/15 cursor-pointer transition pl-6 sm:pl-8 relative group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    {person.profile_pic ? (
                                                        <img src={person.profile_pic} alt={person.name} className="w-14 h-14 rounded-full object-cover border-2 border-pink-500 shadow-md" />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-full bg-pink-500/30 flex items-center justify-center text-xl font-bold shadow-inner text-white border-2 border-pink-500">
                                                            {person.name[0]}
                                                        </div>
                                                    )}
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center text-[10px] shadow" title="Hidden Chat">
                                                        <FiEyeOff size={10} />
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-lg">{person.name}</span>
                                                        <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded font-bold border border-pink-500/30 flex items-center gap-1">
                                                            <FiEyeOff size={9} /> HIDDEN
                                                        </span>
                                                    </div>
                                                    {person.unreadCount > 0 ? (
                                                        <div className="text-sm text-green-400 font-semibold truncate max-w-[180px] sm:max-w-xs">
                                                            {person.lastMessagePreview || "New message received..."}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 truncate max-w-[180px] sm:max-w-xs">
                                                            {person.lastMessagePreview || "Tap to view conversation"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => handleToggleHideChat(e, person)}
                                                    className="px-2.5 py-1 bg-white/5 hover:bg-pink-500/20 text-pink-300 border border-white/10 rounded-xl text-[11px] font-semibold transition flex items-center gap-1"
                                                    title="Unhide this chat"
                                                >
                                                    <FiEye size={12} /> Unhide
                                                </button>
                                                <div className="text-purple-400 text-xl">›</div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Render Locked Chats */}
                                    {lockedChats.map((person) => (
                                        <div
                                            key={person.id}
                                            onClick={() => handleChatClick(person)}
                                            className="flex items-center justify-between p-4 sm:p-5 hover:bg-purple-500/15 cursor-pointer transition pl-6 sm:pl-8 relative group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    {person.profile_pic ? (
                                                        <img src={person.profile_pic} alt={person.name} className="w-14 h-14 rounded-full object-cover border-2 border-purple-500 shadow-md" />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-full bg-purple-500/30 flex items-center justify-center text-xl font-bold shadow-inner text-white border-2 border-purple-500">
                                                            {person.name[0]}
                                                        </div>
                                                    )}
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] shadow" title="Locked Chat">
                                                        <FiLock size={10} />
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-lg">{person.name}</span>
                                                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold border border-purple-500/30">
                                                            LOCKED
                                                        </span>
                                                    </div>
                                                    {person.unreadCount > 0 ? (
                                                        <div className="text-sm text-green-400 font-semibold truncate max-w-[180px] sm:max-w-xs">
                                                            {person.lastMessagePreview || "New message received..."}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 truncate max-w-[180px] sm:max-w-xs">
                                                            {person.lastMessagePreview || "Tap to view conversation"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => handleToggleHideChat(e, person)}
                                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[11px] font-semibold border border-white/10 transition flex items-center gap-1"
                                                    title="Hide chat completely"
                                                >
                                                    <FiEyeOff size={12} /> Hide
                                                </button>
                                                <button
                                                    onClick={(e) => handleToggleLockChat(e, person)}
                                                    className="px-2.5 py-1 bg-white/5 hover:bg-purple-500/20 text-purple-300 border border-white/10 rounded-xl text-[11px] font-semibold transition flex items-center gap-1"
                                                    title="Unlock this chat"
                                                >
                                                    <FiUnlock size={12} /> Unlock
                                                </button>
                                                <div className="text-purple-400 text-xl">›</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── Regular Unlocked & Visible Chats ── */}
                            {unlockedRegularChats.map((person) => (
                                <div
                                    key={person.id}
                                    onClick={() => handleChatClick(person)}
                                    className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/5 cursor-pointer transition relative group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            {person.profile_pic ? (
                                                <img src={person.profile_pic} alt={person.name} className="w-14 h-14 rounded-full object-cover border border-white/10" />
                                            ) : (
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-xl font-bold shadow-inner text-white">
                                                    {person.name[0]}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="font-bold text-white text-lg">{person.name}</div>
                                            {person.unreadCount > 0 ? (
                                                <div className="text-sm text-green-400 font-semibold truncate max-w-[180px] sm:max-w-xs">
                                                    {person.lastMessagePreview || "New message received..."}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 truncate max-w-[180px] sm:max-w-xs">
                                                    {person.lastMessagePreview || "Tap to view conversation"}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Hover Quick Action Buttons: Lock & Hide */}
                                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5">
                                            <button
                                                onClick={(e) => handleToggleHideChat(e, person)}
                                                className="p-2 bg-white/5 hover:bg-pink-500/20 text-gray-400 hover:text-pink-400 rounded-xl transition border border-white/10"
                                                title="Hide Chat 👁️‍🗨️"
                                            >
                                                <FiEyeOff size={13} />
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleLockChat(e, person)}
                                                className="p-2 bg-white/5 hover:bg-purple-500/20 text-gray-400 hover:text-purple-400 rounded-xl transition border border-white/10"
                                                title="Lock Chat 🔒"
                                            >
                                                <FiLock size={13} />
                                            </button>
                                        </div>

                                        {person.unreadCount > 0 ? (
                                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse">
                                                {person.unreadCount}
                                            </div>
                                        ) : (
                                            <div className="text-gray-600 text-xl">›</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    /* Call History Tab Content */
                    callsLoading ? (
                        <div className="p-3">
                            <MessageListSkeleton count={4} />
                        </div>
                    ) : callLogs.length === 0 ? (
                        <div className="text-gray-500 text-center py-16 flex flex-col items-center">
                            <FiPhone className="text-pink-500 text-5xl mb-4" />
                            <p>No calls recorded yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y divide-white/5">
                            {callLogs.map((log) => {
                                const isOutgoing = parseInt(log.caller_id) === parseInt(currentUser.id);
                                const isMissed = log.status === 'missed';
                                return (
                                    <div key={log.id} className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/5 transition">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
                                                isMissed 
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                                    : isOutgoing 
                                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                                        : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            }`}>
                                                <FiPhone size={20} />
                                            </div>

                                            <div>
                                                <div className="font-bold text-white text-base">
                                                    {isOutgoing ? log.receiver_name || 'Companion' : log.caller_name || 'Companion'}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                                    <span className={isMissed ? 'text-red-400 font-semibold' : ''}>
                                                        {isMissed ? 'Missed Call' : isOutgoing ? 'Outgoing Call' : 'Incoming Call'}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{formatDuration(log.duration_seconds)}</span>
                                                    <span>•</span>
                                                    <span>{new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                const targetId = isOutgoing ? log.receiver_id : log.caller_id;
                                                const targetName = isOutgoing ? log.receiver_name : log.caller_name;
                                                const targetPic = isOutgoing ? log.receiver_pic : log.caller_pic;
                                                setSelectedGirl({ id: targetId, name: targetName, profile_pic: targetPic });
                                                setPage(PAGES.CHAT);
                                            }}
                                            className="px-3.5 py-1.5 bg-white/5 hover:bg-pink-500/20 text-gray-300 hover:text-pink-400 rounded-xl text-xs font-bold border border-white/10 transition flex items-center gap-1.5"
                                        >
                                            <FiMessageCircle size={13} /> Chat
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            {/* WhatsApp-Style Chat Lock & Secret PIN Modal */}
            <ChatLockPinModal
                isOpen={showPinModal}
                onClose={() => {
                    setShowPinModal(false);
                    setPendingChatToOpen(null);
                }}
                userId={currentUser?.id}
                mode={pinModalMode}
                onSuccess={handlePinSuccess}
                companionName={pendingChatToOpen ? pendingChatToOpen.name : "Locked / Hidden Chats"}
            />
        </div>
    );
}

export default MessagesPage;
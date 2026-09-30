/**
 * Chat Lock & Hidden Chats Manager
 * WhatsApp-style Private, Locked & Hidden Chats with Secret Code
 */

// Simple deterministic hash for 4-digit PIN / Secret Code storage
export const hashPin = (pin) => {
    let hash = 0;
    const str = `coffeely_salt_${pin}_secure`;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash.toString();
};

export const hasChatLockPin = (userId) => {
    if (!userId) return false;
    return !!localStorage.getItem(`chat_lock_pin_${userId}`);
};

export const setChatLockPin = (userId, pin) => {
    if (!userId || !pin) return false;
    localStorage.setItem(`chat_lock_pin_${userId}`, hashPin(pin));
    return true;
};

export const verifyChatLockPin = (userId, pin) => {
    if (!userId || !pin) return false;
    const storedHash = localStorage.getItem(`chat_lock_pin_${userId}`);
    if (!storedHash) return false;
    return storedHash === hashPin(pin);
};

// --- LOCKED CHATS ---
export const getLockedChatIds = (userId) => {
    if (!userId) return [];
    try {
        const saved = localStorage.getItem(`locked_chats_${userId}`);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

export const isChatLocked = (userId, companionId) => {
    if (!userId || !companionId) return false;
    const lockedIds = getLockedChatIds(userId);
    return lockedIds.includes(companionId) || lockedIds.includes(String(companionId)) || lockedIds.includes(Number(companionId));
};

export const lockChat = (userId, companionId) => {
    if (!userId || !companionId) return false;
    const lockedIds = getLockedChatIds(userId);
    const idStr = String(companionId);
    if (!lockedIds.includes(idStr)) {
        lockedIds.push(idStr);
        localStorage.setItem(`locked_chats_${userId}`, JSON.stringify(lockedIds));
    }
    return true;
};

export const unlockChat = (userId, companionId) => {
    if (!userId || !companionId) return false;
    const lockedIds = getLockedChatIds(userId);
    const idStr = String(companionId);
    const filtered = lockedIds.filter(id => String(id) !== idStr);
    localStorage.setItem(`locked_chats_${userId}`, JSON.stringify(filtered));
    return true;
};

// --- HIDDEN CHATS (Secret / Ghost Mode) ---
export const getHiddenChatIds = (userId) => {
    if (!userId) return [];
    try {
        const saved = localStorage.getItem(`hidden_chats_${userId}`);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

export const isChatHidden = (userId, companionId) => {
    if (!userId || !companionId) return false;
    const hiddenIds = getHiddenChatIds(userId);
    return hiddenIds.includes(companionId) || hiddenIds.includes(String(companionId)) || hiddenIds.includes(Number(companionId));
};

export const hideChat = (userId, companionId) => {
    if (!userId || !companionId) return false;
    const hiddenIds = getHiddenChatIds(userId);
    const idStr = String(companionId);
    if (!hiddenIds.includes(idStr)) {
        hiddenIds.push(idStr);
        localStorage.setItem(`hidden_chats_${userId}`, JSON.stringify(hiddenIds));
    }
    // Also automatically lock it for double security
    lockChat(userId, companionId);
    return true;
};

export const unhideChat = (userId, companionId) => {
    if (!userId || !companionId) return false;
    const hiddenIds = getHiddenChatIds(userId);
    const idStr = String(companionId);
    const filtered = hiddenIds.filter(id => String(id) !== idStr);
    localStorage.setItem(`hidden_chats_${userId}`, JSON.stringify(filtered));
    return true;
};

// --- WHATSAPP SECRET CODE / HIDE LOCKED FOLDER SETTING ---
export const isLockedFolderHidden = (userId) => {
    if (!userId) return false;
    return localStorage.getItem(`hide_locked_folder_${userId}`) === "true";
};

export const setLockedFolderHidden = (userId, isHidden) => {
    if (!userId) return;
    localStorage.setItem(`hide_locked_folder_${userId}`, isHidden ? "true" : "false");
};

export const clearAllChatLocks = (userId) => {
    if (!userId) return;
    localStorage.removeItem(`locked_chats_${userId}`);
    localStorage.removeItem(`hidden_chats_${userId}`);
    localStorage.removeItem(`chat_lock_pin_${userId}`);
    localStorage.removeItem(`hide_locked_folder_${userId}`);
};

export const THEME_ACCENTS = [
    { id: 'rose', name: 'Coffeely Rose', hex: '#f43f5e', bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500', glow: 'shadow-rose-500/25', gradient: 'from-pink-500 to-rose-600' },
    { id: 'emerald', name: 'WhatsApp Emerald', hex: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', glow: 'shadow-emerald-500/25', gradient: 'from-emerald-500 to-teal-600' },
    { id: 'indigo', name: 'Royal Indigo', hex: '#6366f1', bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500', glow: 'shadow-indigo-500/25', gradient: 'from-indigo-500 to-purple-600' },
    { id: 'amber', name: 'Sunset Amber', hex: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500', glow: 'shadow-amber-500/25', gradient: 'from-amber-500 to-orange-600' },
    { id: 'cyan', name: 'Cyberpunk Cyan', hex: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500', glow: 'shadow-cyan-500/25', gradient: 'from-cyan-500 to-blue-600' }
];

export const CHAT_WALLPAPERS = [
    { id: 'dark', name: 'Classic Dark', desc: 'Sleek standard dark mode', previewBg: 'bg-[#0D0D1A]' },
    { id: 'midnight', name: 'Midnight Nebula', desc: 'Deep blue space gradient', previewBg: 'bg-gradient-to-b from-[#0B0F19] to-[#111827]' },
    { id: 'emerald', name: 'Emerald Glow', desc: 'WhatsApp signature tint', previewBg: 'bg-gradient-to-b from-[#061A14] to-[#0A2E23]' },
    { id: 'sunset', name: 'Instagram Sunset', desc: 'Subtle warm romantic hue', previewBg: 'bg-gradient-to-b from-[#1A0B1E] to-[#2E1029]' },
    { id: 'amoled', name: 'Pure AMOLED', desc: 'Zero light pitch black', previewBg: 'bg-black' }
];

export const getStoredPreferences = () => {
    try {
        const saved = localStorage.getItem('coffeely_user_preferences');
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
        themeAccent: 'rose',
        chatWallpaper: 'dark',
        readReceipts: true,
        enterIsSend: true,
        messageSounds: true,
        callRingtone: true,
        bookingAlerts: true,
        callPrivacy: 'everyone',
        dataSaver: false
    };
};

export const savePreferences = (prefs) => {
    try {
        localStorage.setItem('coffeely_user_preferences', JSON.stringify(prefs));
    } catch (e) {}
};

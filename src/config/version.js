export const APP_VERSION = "0.0.6";
export const APP_VERSION_TAG = "v0.0.6";
export const APP_RELEASE_STAGE = "Beta Early Access";
export const APP_BUILD_DATE = "September 2026";
export const IS_LATEST_VERSION = true;

export const APP_CHANGELOG = [
    {
        version: "v0.0.6 (Beta)",
        date: "September 2026",
        features: [
            "✨ YouTube & Instagram Shimmer Skeleton Loaders across all screens",
            "🔍 Explore & Discover: YouTube card grid skeleton with thumbnails, avatars & text bars",
            "📸 Home Feed & Profile: Instagram post & 3x3 photo grid shimmer skeletons",
            "💬 Messages & Calls: Sleek shimmer list placeholders replacing raw loading texts",
            "🔔 Activity: Smooth notification card shimmer waves during live fetch"
        ]
    },
    {
        version: "v2.4.5",
        date: "September 2026",
        features: [
            "📱 Fixed pre-login mobile pages: no navbar squashing or overlap on login & register",
            "✨ Added clean '← Back to Home' button on Login and Register screens",
            "🎯 Streamlined Mobile Hero: hidden static iPhone frame on mobile so users directly see Hero actions",
            "🎂 Native Date of Birth picker for Day/Month/Year registration on mobile",
            "👤 Allow single-name registration and auto-clean 10-digit phone number input",
            "✨ Sleek 'Sign In to Connect' bottom modal instead of browser alert dialogs"
        ]
    },
    {
        version: "v2.4.4",
        date: "September 2026",
        features: [
            "📡 Smart Offline Mode: Top banner notification when network is lost",
            "⚡ Instant Reconnect: Smooth auto-recovery when connection returns",
            "🔒 Accurate Auth Feedback: Clear error messages for wrong passwords"
        ]
    },
    {
        version: "v2.4.1",
        date: "September 2026",
        features: [
            "🎨 Official Coffeely App Icon across all Android screen resolutions",
            "🌟 Custom branded Coffeely splash launch screen",
            "📹 WebRTC Camera & Microphone auto-grant permissions for video calls",
            "🔙 Android hardware back button gesture navigation",
            "📱 Edge-to-edge safe area notch and navigation bar spacing"
        ]
    },
    {
        version: "v2.4.0",
        date: "September 2026",
        features: [
            "⚡ Enhanced PWA install experience for Laptop, Desktop & Mobile",
            "🛡️ Emergency SOS alert system with live GPS coordinates",
            "💰 Instant wallet balances & automated Escrow protection",
            "🎙️ Real-time voice messaging & HD in-app calling",
            "✨ Real-time dynamic rating & review tracking for companions"
        ]
    }
];

export const getAppPlatform = () => {
    if (typeof window === "undefined") return "Web";
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) return "Installed PWA App";
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "Android Web App";
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "iOS Web App";
    if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(ua)) return "macOS Desktop";
    if (/Win32|Win64|Windows|WinCE/.test(ua)) return "Windows Desktop";
    return "Web Browser";
};

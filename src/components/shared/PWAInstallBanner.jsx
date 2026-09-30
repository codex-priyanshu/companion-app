import React, { useState, useEffect } from "react";
import { APP_VERSION_TAG, APP_RELEASE_STAGE } from "../../config/version";

function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed this session
        if (sessionStorage.getItem('pwa-dismissed')) return;

        // Check if already running as standalone app or native Capacitor APK
        const isNative = Boolean(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone || isNative;
        if (isStandalone) return;

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show banner after 4 seconds
            setTimeout(() => setShowBanner(true), 4000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setDismissed(true);
        sessionStorage.setItem('pwa-dismissed', 'true');
    };

    if (!showBanner || dismissed) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-[90] max-w-md mx-auto animate-slide-up">
            <div className="bg-gradient-to-r from-[#1a1a35] via-[#16162A] to-[#121225] border border-pink-500/30 rounded-2xl p-4 shadow-2xl shadow-pink-500/10 flex items-center gap-3.5 backdrop-blur-md">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-pink-500/20">
                    💝
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-bold tracking-wide">Coffeely App</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            {APP_VERSION_TAG} ({APP_RELEASE_STAGE})
                        </span>
                    </div>
                    <div className="text-gray-300 text-[11px] mt-0.5 leading-snug">
                        Install on Phone or Laptop for the fastest native experience!
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={handleInstall}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-xl hover:opacity-90 active:scale-95 transition shadow-md shadow-pink-500/25"
                    >
                        Install
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-1.5 text-gray-400 hover:text-white text-xs rounded-lg hover:bg-white/5 transition"
                        title="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PWAInstallBanner;

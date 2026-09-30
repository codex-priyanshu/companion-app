import React, { useState, useEffect } from "react";
import { checkForAppUpdate, executeAppUpdate } from "../../utils/updateManager";
import { APP_VERSION } from "../../config/version";

export default function AppUpdateModal() {
    const [updateInfo, setUpdateInfo] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    // Auto-check on launch after 3.5 seconds
    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const res = await checkForAppUpdate();
                if (res.hasUpdate && res.latestInfo) {
                    const dismissedKey = `dismissed_update_${res.latestInfo.version}`;
                    const dismissedTime = localStorage.getItem(dismissedKey);
                    // If dismissed in last 12 hours and not mandatory, don't popup automatically
                    const isRecent = dismissedTime && (Date.now() - parseInt(dismissedTime, 10)) < 12 * 60 * 60 * 1000;
                    if (!isRecent || res.latestInfo.mandatory) {
                        setUpdateInfo(res.latestInfo);
                        setIsOpen(true);
                    }
                }
            } catch (err) {
                // Silently ignore background check failures
            }
        }, 3500);

        return () => clearTimeout(timer);
    }, []);

    // Listen for manual "Check for Updates" trigger (e.g. from Settings)
    useEffect(() => {
        const handleManualCheck = async (e) => {
            const isManual = Boolean(e && e.detail && e.detail.manual);
            if (isManual) {
                setToastMessage("Checking for updates...");
            }
            try {
                const res = await checkForAppUpdate();
                if (res.hasUpdate && res.latestInfo) {
                    setUpdateInfo(res.latestInfo);
                    setIsOpen(true);
                    setToastMessage("");
                } else if (isManual) {
                    setToastMessage(`✅ You're on the latest version of Coffeely (v${APP_VERSION})!`);
                    setTimeout(() => setToastMessage(""), 4000);
                }
            } catch (err) {
                if (isManual) {
                    setToastMessage("Unable to check updates right now. Please try again.");
                    setTimeout(() => setToastMessage(""), 4000);
                }
            }
        };

        window.addEventListener("check-for-coffeely-update", handleManualCheck);
        return () => window.removeEventListener("check-for-coffeely-update", handleManualCheck);
    }, []);

    const handleDismiss = () => {
        if (updateInfo) {
            localStorage.setItem(`dismissed_update_${updateInfo.version}`, Date.now().toString());
        }
        setIsOpen(false);
    };

    const handleUpdateNow = () => {
        setIsUpdating(true);
        executeAppUpdate(updateInfo);
        // Show status message
        setTimeout(() => {
            setIsUpdating(false);
        }, 5000);
    };

    const isNativeAndroid = Boolean(
        (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
        /android/i.test(navigator.userAgent || "")
    );

    return (
        <>
            {/* Manual Check Toast */}
            {toastMessage && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100001] bg-[#16162A]/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full border border-pink-500/40 shadow-xl backdrop-blur-md flex items-center gap-2 animate-bounce">
                    <span>☕</span>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Update Popup Modal */}
            {isOpen && updateInfo && (
                <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="relative w-full max-w-sm bg-gradient-to-b from-[#18182e] via-[#121222] to-[#0d0d1a] border border-pink-500/30 rounded-3xl p-6 shadow-2xl shadow-pink-500/10 text-center">
                        
                        {/* Glow Accent */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-pink-500/15 rounded-full blur-2xl pointer-events-none"></div>

                        {/* Top Badge */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-bold tracking-wider uppercase mb-4">
                            <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping"></span>
                            New Update Available
                        </div>

                        {/* Coffeely Coffee Cup with Heart Steam Logo */}
                        <div className="w-16 h-16 mx-auto mb-3 drop-shadow-[0_0_16px_rgba(225,48,108,0.5)]">
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                <path d="M22 40H68C68 40 69 68 45 68C21 68 22 40 22 40Z" stroke="url(#modal-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M68 45H75C80 45 83 48 83 53C83 58 80 61 75 61H66" stroke="url(#modal-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18 75H72" stroke="url(#modal-grad)" strokeWidth="6" strokeLinecap="round"/>
                                <path d="M45 29C40 23 32 30 39 37L45 42L51 37C58 30 50 23 45 29Z" fill="url(#modal-grad)"/>
                                <path d="M31 27C30 24 31 21 33 19" stroke="url(#modal-grad)" strokeWidth="4" strokeLinecap="round"/>
                                <path d="M59 27C60 24 59 21 57 19" stroke="url(#modal-grad)" strokeWidth="4" strokeLinecap="round"/>
                                <defs>
                                    <linearGradient id="modal-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#f9ce3f" />
                                        <stop offset="0.5" stopColor="#e1306c" />
                                        <stop offset="1" stopColor="#833ab4" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-black text-white mb-1">
                            {updateInfo.releaseTitle || "Coffeely App Update"}
                        </h3>

                        {/* Version Change Tag */}
                        <div className="flex items-center justify-center gap-2 text-xs font-mono text-gray-300 mb-4">
                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400">
                                v{APP_VERSION}
                            </span>
                            <span className="text-pink-400 font-bold">➔</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                                v{updateInfo.version} (Latest)
                            </span>
                        </div>

                        {/* What's New List */}
                        {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 mb-5 text-left text-xs text-gray-300 space-y-1.5 max-h-36 overflow-y-auto">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    What's New:
                                </div>
                                {updateInfo.releaseNotes.map((note, idx) => (
                                    <div key={idx} className="flex items-start gap-2 leading-relaxed">
                                        <span className="text-pink-400 text-sm leading-none">•</span>
                                        <span className="flex-1">{note}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2.5">
                            <button
                                onClick={handleUpdateNow}
                                disabled={isUpdating}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#e1306c] via-[#d6249f] to-[#833ab4] hover:opacity-95 active:scale-98 text-white font-bold text-sm shadow-lg shadow-pink-500/30 transition flex items-center justify-center gap-2"
                            >
                                {isUpdating ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Starting Download...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀</span>
                                        <span>{isNativeAndroid ? "Download & Install Update (APK)" : "Update App Now"}</span>
                                    </>
                                )}
                            </button>

                            {isNativeAndroid && isUpdating && (
                                <p className="text-[11px] text-amber-300/90 leading-tight">
                                    APK डाउनलोड शुरू हो रहा है... डाउनलोड पूरा होने पर नोटिफिकेशन से टैप करके इंस्टॉल कर लें!
                                </p>
                            )}

                            {!updateInfo.mandatory && (
                                <button
                                    onClick={handleDismiss}
                                    className="w-full py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
                                >
                                    Later (बाद में)
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </>
    );
}

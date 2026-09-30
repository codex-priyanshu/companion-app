import React, { useState, useEffect } from "react";
import { FiWifiOff, FiCheck, FiRefreshCw } from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";

function OfflineBanner({ isOnline, onRetry }) {
    const [wasOffline, setWasOffline] = useState(false);
    const [showRestored, setShowRestored] = useState(false);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        if (!isOnline) {
            setWasOffline(true);
            setShowRestored(false);
        } else if (wasOffline && isOnline) {
            // Came back online!
            setShowRestored(true);
            const timer = setTimeout(() => {
                setShowRestored(false);
                setWasOffline(false);
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [isOnline, wasOffline]);

    const handleRetry = async () => {
        setRetrying(true);
        if (onRetry) {
            try {
                await onRetry();
            } catch (e) { }
        } else {
            // Default ping
            try {
                await fetch(`${API_BASE}/api/health`, { cache: "no-store", method: "GET" });
            } catch (e) { }
        }
        setTimeout(() => setRetrying(false), 800);
    };

    if (isOnline && !showRestored) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ease-in-out pointer-events-auto">
            {showRestored ? (
                // 🟢 RESTORED BANNER
                <div className="bg-emerald-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-center gap-2 text-xs md:text-sm font-semibold tracking-wide animate-in fade-in slide-in-from-top-2">
                    <FiCheck className="w-4 h-4 stroke-[3]" />
                    <span>Internet Connection Restored — You are back online!</span>
                </div>
            ) : (
                // 🔴 OFFLINE BANNER
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3 text-xs md:text-sm font-medium border-b border-red-400/30">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-1 bg-white/20 rounded-full animate-pulse flex-shrink-0">
                            <FiWifiOff className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                            <span className="font-bold">No Internet Connection.</span>{" "}
                            <span className="text-white/90 hidden sm:inline">Please check your mobile data or Wi-Fi.</span>
                        </div>
                    </div>

                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="flex-shrink-0 bg-white/20 hover:bg-white/30 active:scale-95 text-white font-semibold px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
                    >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                        <span>{retrying ? "Checking..." : "Retry"}</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default OfflineBanner;

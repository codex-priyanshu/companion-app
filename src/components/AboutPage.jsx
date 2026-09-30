import React from "react";
import { APP_VERSION_TAG, APP_RELEASE_STAGE, APP_BUILD_DATE } from "../config/version";

function AboutPage() {
    return (
        <div className="pt-16 min-h-[100dvh]">
            <div className="text-center max-w-2xl mx-auto px-6 py-20">
                <h1 className="text-4xl font-bold mb-4">
                    About{" "}
                    <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                        Coffeely
                    </span>
                </h1>
                <p className="text-gray-400 text-base leading-relaxed">
                    Coffeely is India's safest and most respectful companionship platform,
                    designed for people who want genuine, meaningful company — whether for
                    a coffee date, movie night, shopping trip, or just a good conversation.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-mono shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Coffeely {APP_VERSION_TAG} • {APP_RELEASE_STAGE} ({APP_BUILD_DATE})</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 pb-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[
                        { icon: "🛡️", title: "100% Secure", desc: "All chats and calls are recorded for safety only. Data is encrypted and never made public." },
                        { icon: "✅", title: "Verified Profiles", desc: "Every girl undergoes identity verification before being listed." },
                        { icon: "⭐", title: "Rating System", desc: "Transparent reviews from real users. Both companions and renters can rate each other." },
                        { icon: "💳", title: "Fair Pricing", desc: "Clear, per-hour pricing. No hidden fees. Pay only for the time you spend." },
                        { icon: "📞", title: "In-App Calling", desc: "All calls happen within the app. No personal numbers shared, ever." },
                        { icon: "❤️", title: "Respectful Community", desc: "We enforce a strict code of conduct. Any violation results in immediate account ban." },
                    ].map((f) => (
                        <div
                            key={f.title}
                            className="bg-[#16162A] border border-white/5 rounded-2xl p-6 hover:border-pink-500/20 transition"
                        >
                            <div className="text-3xl mb-3">{f.icon}</div>
                            <div className="text-base font-semibold mb-2">{f.title}</div>
                            <div className="text-sm text-gray-400 leading-relaxed">{f.desc}</div>
                        </div>
                    ))}
                </div>

                <div className="h-px bg-white/5 my-14" />

                <div className="bg-[#16162A] border border-pink-500/15 rounded-2xl p-8 text-center">
                    <h3 className="text-2xl font-bold mb-4">
                        Our{" "}
                        <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                            Mission
                        </span>
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-xl mx-auto">
                        We believe everyone deserves companionship. Our mission is to provide
                        a safe, dignified, and enjoyable platform that empowers women
                        financially while giving everyone a meaningful social experience —
                        all within clear ethical boundaries.
                    </p>
                </div>
            </div>

            <footer className="border-t border-white/5 py-10 text-center text-gray-500 text-sm">
                <p>💞 Coffeely — Safe, Verified & Respectful Companionship</p>
                <div className="mt-2 text-xs flex items-center justify-center gap-2 text-gray-500">
                    <span>© 2026 Coffeely. All rights reserved.</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-mono font-semibold">{APP_VERSION_TAG} (Latest)</span>
                </div>
            </footer>
        </div>
    );
}

export default AboutPage;
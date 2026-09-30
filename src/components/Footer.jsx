import React from "react";
import { PAGES } from "../App";
import { APP_VERSION_TAG } from "../config/version";

function Footer({ setPage }) {
    return (
        <footer className="bg-[#16162A] border-t border-white/5 pt-12 pb-8 mt-20">
            <div className="max-w-5xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
                            <svg
                                className="w-8 h-8 shrink-0 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]"
                                viewBox="0 0 100 100"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M22 40H68C68 40 69 68 45 68C21 68 22 40 22 40Z" stroke="url(#ai-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M68 45H75C80 45 83 48 83 53C83 58 80 61 75 61H66" stroke="url(#ai-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18 75H72" stroke="url(#ai-grad)" strokeWidth="6" strokeLinecap="round"/>
                                <path d="M45 29C40 23 32 30 39 37L45 42L51 37C58 30 50 23 45 29Z" fill="url(#ai-grad)"/>
                                <path d="M31 27C30 24 31 21 33 19" stroke="url(#ai-grad)" strokeWidth="4" strokeLinecap="round"/>
                                <path d="M59 27C60 24 59 21 57 19" stroke="url(#ai-grad)" strokeWidth="4" strokeLinecap="round"/>
                                <defs>
                                    <linearGradient id="ai-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#ec4899" />
                                        <stop offset="1" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            Coffeely
                        </h2>
                        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                            Find your perfect companion for coffee dates, movies, events, and meaningful conversations. A secure, private, and premium platform for genuine connections.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4 text-white">Quick Links</h3>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><button onClick={() => setPage && setPage(PAGES.HOME)} className="hover:text-pink-400 transition">Home</button></li>
                            <li><button onClick={() => setPage && setPage(PAGES.FIND)} className="hover:text-pink-400 transition">Browse Companions</button></li>
                            <li><button onClick={() => setPage && setPage(PAGES.GIRL_REGISTER)} className="hover:text-pink-400 transition">Join as Companion</button></li>
                        </ul>
                    </div>

                    {/* 🚨 YAHAN ONCLICK ADD KIYA HAI 🚨 */}
                    <div>
                        <h3 className="font-semibold mb-4 text-white">Legal & Support</h3>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><span onClick={() => setPage && setPage(PAGES.HELP)} className="hover:text-pink-400 transition cursor-pointer">Help Center</span></li>
                            <li><span onClick={() => setPage && setPage(PAGES.LEGAL)} className="hover:text-pink-400 transition cursor-pointer">Privacy Policy</span></li>
                            <li><span onClick={() => setPage && setPage(PAGES.LEGAL)} className="hover:text-pink-400 transition cursor-pointer">Terms of Service</span></li>
                            <li><span onClick={() => setPage && setPage(PAGES.LEGAL)} className="hover:text-pink-400 transition cursor-pointer">Safety Guidelines</span></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-xs text-gray-500">
                            © {new Date().getFullYear()} Coffeely. All rights reserved.
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {APP_VERSION_TAG} (Latest)
                        </span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-400">
                        <a href="https://www.instagram.com/rentgf.in?igsh=b29iNDkxejFnaDJt" target="_blank" rel="noreferrer">
                            <span className="hover:text-pink-400 cursor-pointer transition">📸 Instagram</span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
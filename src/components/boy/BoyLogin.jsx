import React, { useState } from "react";
import { PAGES } from "../../App";
import { getFriendlyErrorMessage } from "../../utils/errorHandler";

function BoyLogin({ setPage, setBoyUser }) {
    const [form, setForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setError("No internet connection. Please check your network to login.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("https://rentgf-and-bf.onrender.com/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    role: "boy" 
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                setBoyUser(data.user);
                setPage(PAGES.BOY_DASHBOARD);
            } else if (response.status === 401) {
                setError(data.error || "Incorrect email or password. Please try again.");
            } else {
                setError(getFriendlyErrorMessage(null, data, "Login failed. Please check your credentials."));
            }
        } catch (err) {
            console.error(err);
            setError(getFriendlyErrorMessage(err, null, "Unable to reach server. Please check your connection."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pt-16 min-h-[100dvh] flex items-center justify-center px-4">
            <div className="bg-[#16162A] border border-white/7 rounded-3xl p-10 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-1">🔍 User Login</h2>
                <p className="text-sm text-gray-400 mb-7">Login to find and connect with companions.</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-2 rounded-lg mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                        <input
                            type="email"
                            placeholder="your@email.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                        />
                    </div>

                    <div className="text-right">
                        <span className="text-xs text-pink-400 cursor-pointer">Forgot password?</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold text-base transition ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                    >
                        {loading ? "Logging in..." : "Login →"}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                    New user?{" "}
                    <span
                        className="text-pink-400 cursor-pointer font-semibold"
                        onClick={() => setPage(PAGES.BOY_REGISTER)}
                    >
                        Register here
                    </span>
                </p>
            </div>
        </div>
    );
}

export default BoyLogin;
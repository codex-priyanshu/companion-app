import React, { useState } from "react";
import { PAGES } from "../../App";
import { getFriendlyErrorMessage } from "../../utils/errorHandler";

function BoyRegister({ setPage, setBoyUser }) {
    const [form, setForm] = useState({ name: "", email: "", password: "", age: "", city: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setError("No internet connection. Please check your network to create an account.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("https://rentgf-and-bf.onrender.com/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    age: form.age,
                    city: form.city,
                    password: form.password,
                    role: "boy",
                    price: form.price,
                    tags: [form.city, form.age],
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                alert("Account created successfully! Please login with your email and password.");
                setPage(PAGES.BOY_LOGIN);
            } else {
                setError(getFriendlyErrorMessage(null, data, "Registration failed. Please check your details."));
            }
        } catch (err) {
            console.error(err);
            setError(getFriendlyErrorMessage(err, null, "Unable to reach server. Please check your connection."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pt-16 min-h-[100dvh] flex items-center justify-center px-4 py-10">
            <div className="bg-[#16162A] border border-white/5 rounded-3xl p-10 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-1">🔍 Create Account</h2>
                <p className="text-sm text-gray-400 mb-7">Join to find meaningful companionship.</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-2 rounded-lg mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Full Name</label>
                        <input
                            placeholder="Your name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                        />
                    </div>
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
                            placeholder="Create a strong password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Age (18+)</label>
                        <input
                            type="number"
                            min="18"
                            placeholder="Your age"
                            value={form.age}
                            onChange={(e) => setForm({ ...form, age: e.target.value })}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5">City</label>
                        <select
                            value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500 transition"
                        >
                            <option value="" className="text-black">Select city</option>
                            {["Mumbai", "Delhi", "Pune", "Bangalore", "Chennai", "Hyderabad", "Kolkata", "Jaipur"].map((c) => (
                                <option key={c} value={c} className="text-black">{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300">
                        🛡️ By registering, you agree to our rules of conduct. All interactions are monitored for safety. Violations result in permanent ban.
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold text-base hover:opacity-90 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? "Creating Account..." : "Create Account →"}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                    Already have an account?{" "}
                    <span
                        className="text-pink-400 cursor-pointer font-semibold"
                        onClick={() => setPage(PAGES.BOY_LOGIN)}
                    >
                        Login here
                    </span>
                </p>
            </div>
        </div>
    );
}

export default BoyRegister;
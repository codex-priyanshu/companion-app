import React, { useState } from "react";
import { PAGES } from "../../App";
import { FiCamera } from "react-icons/fi";
import { getFriendlyErrorMessage } from "../../utils/errorHandler";

const TAG_OPTIONS = ["Coffee Date", "Movie", "Shopping", "Study Partner", "Walk", "Events", "Dinner", "Travel", "Gaming"];

function GirlRegister({ setPage, setGirlUser }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        name: "", email: "", password: "", age: "", city: "", bio: "", price: "", tags: [],
    });

    const toggleTag = (tag) => {
        setForm((f) => ({
            ...f,
            tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
        }));
    };

    const handleNext = async (e) => {
        e.preventDefault();

        if (step < 3) {
            setStep((s) => s + 1);
        } else {
            setError("");

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                setError("No internet connection. Please check your network to register.");
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
                        password: form.password,
                        role: "girl",
                        age: form.age,
                        city: form.city,
                        bio: form.bio,
                        price: form.price,
                        tags: form.tags.join(", ") 
                    }),
                });

                const data = await response.json().catch(() => ({}));

                if (response.ok) {
                    alert("Registration Successful! Please login to continue.");
                    setPage(PAGES.GIRL_LOGIN); 
                } else {
                    setError(getFriendlyErrorMessage(null, data, "Registration failed. Please check your details."));
                }
            } catch (err) {
                console.error("Register Error:", err);
                setError(getFriendlyErrorMessage(err, null, "Unable to reach server. Please check your connection."));
            } finally {
                setLoading(false);
            }
        }
    };

    const stepLabels = ["Basic Info", "Profile Details", "Preferences"];

    return (
        <div className="pt-16 min-h-[100dvh] flex items-center justify-center px-4 py-10">
            <div className="bg-[#16162A] border border-white/5 rounded-3xl p-10 w-full max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold mb-1">Join as a Companion</h2>
                <p className="text-sm text-gray-400 mb-2">
                    Step {step} of 3 — {stepLabels[step - 1]}
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-2 rounded-lg mb-4 text-center">
                        {error}
                    </div>
                )}

                <div className="h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>

                <form onSubmit={handleNext} className="space-y-4">
                    {step === 1 && (
                        <>
                            <div className="w-24 h-24 rounded-full bg-pink-500/10 border-2 border-dashed border-pink-500/30 flex items-center justify-center text-3xl cursor-pointer mx-auto mb-4">
                                <FiCamera className="text-pink-500/50" />
                            </div>
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
                        </>
                    )}

                    {step === 2 && (
                        <>
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
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5">Bio (about you)</label>
                                <textarea
                                    rows={3}
                                    placeholder="Tell people about yourself..."
                                    value={form.bio}
                                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition resize-none"
                                />
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5">Rate per hour (₹)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 500"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-2">Activities you offer</label>
                                <div className="flex flex-wrap gap-2">
                                    {TAG_OPTIONS.map((tag) => (
                                        <span
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className={`cursor-pointer px-3 py-1.5 rounded-full text-xs border transition ${form.tags.includes(tag)
                                                ? "bg-pink-500/20 border-pink-500 text-pink-300"
                                                : "bg-pink-500/5 border-pink-500/20 text-pink-400"
                                                }`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300">
                                🛡️ By registering, you agree that all your in-app chats and calls will be recorded for safety purposes. Your data is private.
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 mt-4">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={() => setStep(step - 1)}
                                disabled={loading}
                                className="w-1/3 py-3.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition"
                            >
                                ← Back
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? "Saving..." : step < 3 ? "Continue →" : "Complete Registration"}
                        </button>
                    </div>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                    Already registered?{" "}
                    <span
                        className="text-pink-400 cursor-pointer font-semibold hover:underline"
                        onClick={() => setPage(PAGES.GIRL_LOGIN)}
                    >
                        Login here
                    </span>
                </p>
            </div>
        </div>
    );
}

export default GirlRegister;
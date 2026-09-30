import React, { useState, useRef, useEffect } from "react";
import { FiX, FiImage, FiUploadCloud, FiCamera, FiRefreshCw, FiCheck } from "react-icons/fi";

const FILTERS = [
    { id: "normal", name: "Normal", style: "" },
    { id: "warm", name: "Warm", style: "sepia(0.25) saturate(1.3) contrast(1.05)" },
    { id: "vibrant", name: "Vivid", style: "saturate(1.6) contrast(1.1)" },
    { id: "bw", name: "B&W", style: "grayscale(1) contrast(1.2)" },
    { id: "cyber", name: "Neon", style: "hue-rotate(290deg) contrast(1.15) saturate(1.4)" }
];

const EMOJI_CHIPS = ["🔥", "❤️", "✨", "😍", "☕", "🥂", "📸", "🌴", "💖"];

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function AddStoryModal({ currentUser, onClose, onStoryCreated }) {
    const [activeTab, setActiveTab] = useState("file"); // "file" | "camera" | "url"
    const [mediaUrl, setMediaUrl] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [isVideo, setIsVideo] = useState(false);
    const [caption, setCaption] = useState("");
    const [activeFilter, setActiveFilter] = useState("normal");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Camera states
    const [facingMode, setFacingMode] = useState("user"); // "user" or "environment"
    const videoRef = useRef(null);
    const mediaStreamRef = useRef(null);

    // Stop camera stream helper
    const stopCamera = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    };

    // Start camera stream
    const startCamera = async (facing = facingMode) => {
        stopCamera();
        setError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
                audio: false
            });
            mediaStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setError("Could not access camera. Please allow camera permissions or upload from files.");
        }
    };

    // Flip camera (front <-> back)
    const handleFlipCamera = () => {
        const nextMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(nextMode);
        startCamera(nextMode);
    };

    // Take photo snapshot
    const capturePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext("2d");

        // If front camera, mirror horizontally for natural selfie
        if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setMediaUrl(dataUrl);
        setIsVideo(false);
        stopCamera();
    };

    useEffect(() => {
        if (activeTab === "camera") {
            startCamera();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [activeTab]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 15 * 1024 * 1024) {
                setError("Media file must be less than 15MB.");
                return;
            }
            const isVid = file.type.startsWith("video");
            setIsVideo(isVid);
            setSelectedFile(file);

            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
                setMediaUrl(uploadEvent.target.result);
                setError("");
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEmojiClick = (emoji) => {
        setCaption((prev) => (prev ? `${prev} ${emoji}` : emoji));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!mediaUrl.trim() && !selectedFile) {
            setError("Please upload an image, take a photo, or paste a URL.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("token");

            // Direct upload via FormData if a file is chosen, otherwise JSON
            let res;
            if (selectedFile) {
                const formData = new FormData();
                formData.append("media", selectedFile);
                if (caption.trim()) formData.append("caption", caption.trim());

                res = await fetch(`${API}/stories`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: formData
                });
            } else {
                res = await fetch(`${API}/stories`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        media_url: mediaUrl,
                        caption: caption.trim()
                    })
                });
            }

            const data = await res.json();
            if (res.ok) {
                if (onStoryCreated) onStoryCreated();
                onClose();
            } else {
                setError(data.error || "Failed to post story. Try again.");
            }
        } catch (err) {
            console.error("Story create error:", err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const currentFilterStyle = FILTERS.find((f) => f.id === activeFilter)?.style || "";

    return (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-[#121224] border border-white/10 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white text-xs font-bold shadow-md">
                            +
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white leading-tight">Add Your Story</h3>
                            <p className="text-[10px] text-gray-400">Active for 24 hours</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Source Tab Switcher */}
                <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 mb-4 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("file");
                            stopCamera();
                        }}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                            activeTab === "file" ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        <FiUploadCloud size={14} />
                        <span>Upload</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("camera");
                            setMediaUrl("");
                        }}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                            activeTab === "camera" ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        <FiCamera size={14} />
                        <span>Camera</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("url");
                            stopCamera();
                        }}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                            activeTab === "url" ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        <FiImage size={14} />
                        <span>URL</span>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2.5 rounded-xl mb-3 text-center shrink-0">
                        {error}
                    </div>
                )}

                <div className="overflow-y-auto flex-1 pr-1 space-y-4 scrollbar-none">
                    {/* Media Area */}
                    {activeTab === "camera" && !mediaUrl ? (
                        <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                            <video
                                ref={videoRef}
                                playsInline
                                muted
                                autoPlay
                                className={`w-full h-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
                            />
                            {/* Camera Shutter & Flip buttons */}
                            <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-6 z-20">
                                <button
                                    type="button"
                                    onClick={handleFlipCamera}
                                    title="Switch Camera"
                                    className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
                                >
                                    <FiRefreshCw size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={capturePhoto}
                                    title="Take Photo"
                                    className="w-16 h-16 rounded-full border-4 border-white bg-pink-500 hover:bg-pink-600 transition shadow-xl flex items-center justify-center active:scale-95"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white" />
                                </button>
                                <div className="w-10" /> {/* Spacer */}
                            </div>
                        </div>
                    ) : mediaUrl ? (
                        <div className="space-y-2">
                            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                                {isVideo ? (
                                    <video src={mediaUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
                                ) : (
                                    <img
                                        src={mediaUrl}
                                        alt="Preview"
                                        style={{ filter: currentFilterStyle }}
                                        className="w-full h-full object-cover transition-all duration-300"
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMediaUrl("");
                                        setSelectedFile(null);
                                        if (activeTab === "camera") startCamera();
                                    }}
                                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center transition shadow-lg"
                                >
                                    <FiX size={16} />
                                </button>
                            </div>

                            {/* Aesthetic Filter Pills (Only for images) */}
                            {!isVideo && (
                                <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none">
                                    {FILTERS.map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setActiveFilter(f.id)}
                                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 flex items-center gap-1 ${
                                                activeFilter === f.id
                                                    ? "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                                                    : "bg-white/5 text-gray-400 hover:text-white"
                                            }`}
                                        >
                                            {activeFilter === f.id && <FiCheck size={11} />}
                                            {f.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === "file" ? (
                        <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-white/15 rounded-2xl hover:border-pink-500/50 transition cursor-pointer bg-[#0D0D1A] group">
                            <div className="flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-110 transition mb-3">
                                    <FiUploadCloud size={24} />
                                </div>
                                <p className="text-xs text-gray-200 font-semibold mb-1">Choose Photo or Video</p>
                                <p className="text-[10px] text-gray-500">JPG, PNG, MP4 up to 15MB</p>
                            </div>
                            <input
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    ) : (
                        <div className="space-y-2">
                            <label className="block text-xs text-gray-400 ml-1">Paste Image or Video URL</label>
                            <div className="relative">
                                <FiImage className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                                <input
                                    type="url"
                                    placeholder="https://images.unsplash.com/..."
                                    value={mediaUrl}
                                    onChange={(e) => setMediaUrl(e.target.value)}
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                                />
                            </div>
                        </div>
                    )}

                    {/* Caption Input */}
                    <div>
                        <div className="flex items-center justify-between mb-1 ml-1">
                            <label className="text-xs text-gray-400">Story Caption</label>
                            <span className="text-[10px] text-gray-500">{caption.length}/150</span>
                        </div>
                        <input
                            type="text"
                            maxLength={150}
                            placeholder="Add a moment caption... (e.g. Sunset vibes 🌅)"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                        />

                        {/* Quick Emoji Shortcuts */}
                        <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none py-0.5">
                            {EMOJI_CHIPS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleEmojiClick(emoji)}
                                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-sm flex items-center justify-center transition shrink-0 active:scale-90"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-3 mt-2 border-t border-white/5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-xs font-bold text-gray-400 hover:text-white bg-white/5 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || (!mediaUrl.trim() && !selectedFile)}
                        className="flex-1 py-3 text-xs font-bold text-white rounded-xl transition bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Posting...</span>
                            </>
                        ) : (
                            <span>Share to Story</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AddStoryModal;

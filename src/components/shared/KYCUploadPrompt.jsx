import React, { useState } from "react";
import { FiShield, FiUploadCloud, FiCheckCircle, FiLock, FiAlertCircle, FiFileText, FiX } from "react-icons/fi";

const DOC_TYPES = [
    { id: "aadhaar", label: "Aadhaar Card", hint: "Front side with clear name & photo" },
    { id: "pan", label: "PAN Card", hint: "Clear readable PAN number" },
    { id: "dl", label: "Driving License", hint: "Valid government issued DL" },
    { id: "passport", label: "Passport", hint: "First page with personal details" }
];

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

export default function KYCUploadPrompt({ 
    user, 
    onUploadSuccess, 
    onCancel, 
    title = "Document Verification", 
    badge = "Security Gate", 
    subtitle = "Financial safety aur user protection ke liye Date Booking & Wallet features unlock karne se pehle apna government ID proof verify karana zaroori hai.",
    buttonText = "Upload Document & Continue"
}) {
    const [selectedDocType, setSelectedDocType] = useState("aadhaar");
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;

        if (!selected.type.startsWith("image/")) {
            setError("Kripya image file (JPG, PNG, JPEG) select karein");
            return;
        }

        if (selected.size > 10 * 1024 * 1024) {
            setError("File size 10MB se kam honi chahiye");
            return;
        }

        setError(null);
        setFile(selected);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(selected);
    };

    const handleUpload = async () => {
        if (!file || !user) {
            setError("Kripya apna ID document select karein");
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("id_document", file);
            formData.append("doc_type", selectedDocType);

            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/kyc/${user.id}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Document upload fail ho gaya. Kripya punah prayas karein.");
            }

            setSuccess(true);
            const updatedUser = {
                ...user,
                kyc_status: data.kyc_status || 'pending',
                id_proof_url: data.id_proof_url || preview
            };

            setTimeout(() => {
                if (typeof onUploadSuccess === 'function') {
                    onUploadSuccess(updatedUser);
                }
            }, 1200);

        } catch (err) {
            console.error("KYC upload error:", err);
            setError(err.message || "Upload me samasya aayi. Kripya internet check karein.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-[#121212] border border-[#262626] rounded-3xl p-6 sm:p-8 shadow-2xl animate-fade-in relative overflow-hidden">
            {/* Top Glowing Gradient Accent */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 blur-3xl pointer-events-none rounded-full" />

            {/* Header Icon & Status */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-inner">
                        <FiLock size={24} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400">
                            {badge}
                        </span>
                        <h2 className="text-xl font-black text-white mt-1">
                            {title}
                        </h2>
                    </div>
                </div>

                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                    >
                        <FiX size={18} />
                    </button>
                )}
            </div>

            {/* Subtitle / Explanation */}
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                {subtitle}
            </p>

            {/* Success Banner */}
            {success ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center flex flex-col items-center gap-3 animate-fade-in my-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <FiCheckCircle size={28} />
                    </div>
                    <h3 className="text-base font-bold text-emerald-300">
                        Document Upload Ho Gaya! 🎉
                    </h3>
                    <p className="text-xs text-gray-300 max-w-xs">
                        Aapka document verification queue me hai. Aapka Wallet unlock ho chuka hai!
                    </p>
                </div>
            ) : (
                <>
                    {/* Document Type Selector */}
                    <div className="mb-5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                            Document Ka Prakar Select Karein:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {DOC_TYPES.map(doc => (
                                <button
                                    key={doc.id}
                                    type="button"
                                    onClick={() => setSelectedDocType(doc.id)}
                                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                                        selectedDocType === doc.id
                                            ? "bg-pink-500/10 border-pink-500/50 text-white shadow-sm"
                                            : "bg-white/[0.02] border-[#262626] text-gray-400 hover:bg-white/[0.05] hover:text-gray-300"
                                    }`}
                                >
                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                        <FiFileText size={13} className={selectedDocType === doc.id ? "text-pink-400" : "text-gray-500"} />
                                        {doc.label}
                                    </span>
                                    <span className="text-[10px] text-gray-500 truncate">{doc.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Upload Box or Preview */}
                    <div className="mb-6">
                        {!preview ? (
                            <label className="w-full border-2 border-dashed border-[#262626] hover:border-pink-500/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-white/[0.01] hover:bg-pink-500/[0.02] group">
                                <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-pink-500/10 flex items-center justify-center text-gray-400 group-hover:text-pink-400 transition mb-3">
                                    <FiUploadCloud size={24} />
                                </div>
                                <span className="text-sm font-bold text-white group-hover:text-pink-300 transition">
                                    Document Image Choose Karein
                                </span>
                                <span className="text-xs text-gray-500 mt-1">
                                    JPG, PNG ya JPEG (Max 10MB)
                                </span>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        ) : (
                            <div className="relative rounded-2xl overflow-hidden border border-[#262626] bg-black group">
                                <img
                                    src={preview}
                                    alt="Document Preview"
                                    className="w-full max-h-52 object-contain mx-auto bg-black/60 p-2"
                                />
                                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
                                        Selected
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => { setFile(null); setPreview(null); }}
                                        className="w-7 h-7 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center transition backdrop-blur-md"
                                        title="Remove & choose another"
                                    >
                                        <FiX size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                            <FiAlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className={`w-full py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg ${
                            !file || uploading
                                ? "bg-white/10 text-gray-500 cursor-not-allowed border border-white/5"
                                : "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white shadow-pink-500/25"
                        }`}
                    >
                        {uploading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Verifying & Uploading...</span>
                            </>
                        ) : (
                            <>
                                <FiShield size={16} />
                                <span>{buttonText}</span>
                            </>
                        )}
                    </button>
                </>
            )}

            {/* Privacy & Trust Footer */}
            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5">
                    <FiShield size={13} className="text-emerald-400" />
                    256-Bit Bank Grade Encryption
                </span>
                <span className="text-gray-500">100% Confidential</span>
            </div>
        </div>
    );
}

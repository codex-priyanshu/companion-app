import React, { useState, useEffect } from "react";
import { FiLock, FiX, FiKey, FiDelete } from "react-icons/fi";
import { hasChatLockPin, setChatLockPin, verifyChatLockPin } from "../../utils/chatLockManager";

export default function ChatLockPinModal({
    isOpen,
    onClose,
    userId,
    mode = "verify", // 'verify' | 'set_new' | 'change_pin'
    onSuccess,
    companionName = "this chat"
}) {
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [step, setStep] = useState("enter_pin"); // 'enter_pin' | 'confirm_pin'
    const [errorMsg, setErrorMsg] = useState("");
    const [shake, setShake] = useState(false);

    const hasExistingPin = hasChatLockPin(userId);
    const activeMode = (!hasExistingPin && mode === "verify") ? "set_new" : mode;

    useEffect(() => {
        if (isOpen) {
            setPin("");
            setConfirmPin("");
            setStep("enter_pin");
            setErrorMsg("");
            setShake(false);
        }
    }, [isOpen, mode]);

    if (!isOpen) return null;

    const triggerError = (msg) => {
        setErrorMsg(msg);
        setShake(true);
        setPin("");
        setConfirmPin("");
        setStep("enter_pin");
        setTimeout(() => setShake(false), 500);
    };

    const handleKeyPress = (num) => {
        setErrorMsg("");
        if (activeMode === "set_new" || activeMode === "change_pin") {
            if (step === "enter_pin") {
                if (pin.length < 4) {
                    const newPin = pin + num;
                    setPin(newPin);
                    if (newPin.length === 4) {
                        setTimeout(() => {
                            setStep("confirm_pin");
                        }, 200);
                    }
                }
            } else {
                if (confirmPin.length < 4) {
                    const newConfirm = confirmPin + num;
                    setConfirmPin(newConfirm);
                    if (newConfirm.length === 4) {
                        if (newConfirm === pin) {
                            setChatLockPin(userId, newConfirm);
                            if (onSuccess) onSuccess();
                            onClose();
                        } else {
                            triggerError("PINs do not match. Please start again.");
                        }
                    }
                }
            }
        } else {
            // Verify Mode
            if (pin.length < 4) {
                const newPin = pin + num;
                setPin(newPin);
                if (newPin.length === 4) {
                    if (verifyChatLockPin(userId, newPin)) {
                        if (onSuccess) onSuccess();
                        onClose();
                    } else {
                        triggerError("Incorrect PIN. Please try again.");
                    }
                }
            }
        }
    };

    const handleDelete = () => {
        setErrorMsg("");
        if (step === "enter_pin") {
            setPin(prev => prev.slice(0, -1));
        } else {
            setConfirmPin(prev => prev.slice(0, -1));
        }
    };

    const currentEntered = step === "enter_pin" ? pin : confirmPin;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className={`relative w-full max-w-sm bg-[#141428] border border-white/15 rounded-3xl p-6 shadow-2xl text-center ${shake ? 'animate-bounce' : ''}`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                >
                    <FiX size={18} />
                </button>

                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-inner mb-4">
                    {activeMode === "set_new" ? <FiKey size={24} /> : <FiLock size={24} />}
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                    {activeMode === "set_new" 
                        ? (step === "enter_pin" ? "Create 4-Digit Chat PIN" : "Confirm Your PIN")
                        : `Unlock Locked Chats`}
                </h3>

                <p className="text-xs text-gray-400 mb-6">
                    {activeMode === "set_new"
                        ? (step === "enter_pin" ? "Set a secret PIN to protect private conversations" : "Re-enter your 4-digit PIN to confirm")
                        : `Enter your 4-digit PIN to access private conversations with ${companionName}`}
                </p>

                {/* 4 Glowing PIN Dots */}
                <div className="flex justify-center gap-4 mb-6">
                    {[0, 1, 2, 3].map((index) => {
                        const filled = currentEntered.length > index;
                        return (
                            <div
                                key={index}
                                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                                    filled
                                        ? "bg-gradient-to-r from-pink-500 to-purple-500 scale-110 shadow-[0_0_12px_rgba(236,72,153,0.7)]"
                                        : "bg-white/10 border border-white/20"
                                }`}
                            />
                        );
                    })}
                </div>

                {errorMsg && (
                    <div className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 py-2 px-3 rounded-xl mb-4">
                        {errorMsg}
                    </div>
                )}

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto mb-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleKeyPress(num.toString())}
                            className="w-16 h-14 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 text-white font-bold text-xl transition border border-white/5 flex items-center justify-center shadow-md"
                        >
                            {num}
                        </button>
                    ))}
                    <div className="w-16 h-14 flex items-center justify-center text-xs text-gray-500">
                        🔒
                    </div>
                    <button
                        onClick={() => handleKeyPress("0")}
                        className="w-16 h-14 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 text-white font-bold text-xl transition border border-white/5 flex items-center justify-center shadow-md"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="w-16 h-14 rounded-2xl bg-white/5 hover:bg-red-500/20 active:scale-95 text-gray-300 hover:text-red-400 transition border border-white/5 flex items-center justify-center shadow-md"
                        title="Delete"
                    >
                        <FiDelete size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

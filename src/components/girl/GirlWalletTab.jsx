import React, { useState, useEffect } from "react";
import { FiDollarSign, FiLock, FiTrendingUp, FiArrowUpRight, FiArrowDownLeft, FiClock, FiCreditCard, FiSmartphone, FiX, FiCheck, FiRefreshCw } from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";

export default function GirlWalletTab({ user }) {
    const [availableBalance, setAvailableBalance] = useState(0);
    const [escrowPending, setEscrowPending] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [totalWithdrawn, setTotalWithdrawn] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const [filterType, setFilterType] = useState("all"); // 'all' | 'escrow' | 'withdrawals'
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawMethod, setWithdrawMethod] = useState("upi"); // 'upi' | 'bank'
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [upiId, setUpiId] = useState("");
    const [accountHolder, setAccountHolder] = useState(user?.name || "");
    const [accountNumber, setAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const [transactions, setTransactions] = useState([]);

    const fetchWalletData = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem("token");
            const headers = token ? { "Authorization": `Bearer ${token}` } : {};

            // Fetch balance
            const balRes = await fetch(`${API_BASE}/api/wallet/${user.id}`, { headers });
            if (balRes.ok) {
                const balData = await balRes.json();
                setAvailableBalance(balData.available_balance || 0);
                setEscrowPending(balData.pending_escrow || 0);
                setTotalEarned(balData.total_earned || 0);
                setTotalWithdrawn(balData.total_withdrawn || 0);
            }

            // Fetch transactions
            const txRes = await fetch(`${API_BASE}/api/wallet/transactions/${user.id}`, { headers });
            if (txRes.ok) {
                const txData = await txRes.json();
                setTransactions(txData || []);
            }
        } catch (err) {
            console.error("Fetch wallet error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
    }, [user?.id]);

    const handleWithdrawSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(withdrawAmount);
        if (!amt || amt < 500) {
            setErrorMessage("Minimum withdrawal amount is ₹500.");
            return;
        }
        if (amt > availableBalance) {
            setErrorMessage(`Insufficient balance. You have ₹${availableBalance.toLocaleString()} available.`);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage("");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE}/api/wallet/payout-request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    amount: amt,
                    payout_method: withdrawMethod,
                    upi_id: withdrawMethod === "upi" ? upiId : undefined,
                    account_holder_name: withdrawMethod === "bank" ? accountHolder : undefined,
                    account_number: withdrawMethod === "bank" ? accountNumber : undefined,
                    ifsc_code: withdrawMethod === "bank" ? ifscCode : undefined
                })
            });

            const data = await res.json();
            if (res.ok) {
                setAvailableBalance(prev => Math.max(0, prev - amt));
                setShowWithdrawModal(false);
                setWithdrawAmount("");
                setSuccessMessage(data.message || `🎉 Payout of ₹${amt.toLocaleString()} submitted!`);
                fetchWalletData();
                setTimeout(() => setSuccessMessage(""), 6000);
            } else {
                setErrorMessage(data.error || "Failed to submit withdrawal request.");
            }
        } catch (err) {
            setErrorMessage("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        if (filterType === "escrow") return t.type && (t.type.includes("escrow") || t.type.includes("hold"));
        if (filterType === "withdrawals") return t.type === "withdrawal";
        return true;
    });

    return (
        <div className="space-y-6 text-left">
            {/* Success Toast */}
            {successMessage && (
                <div className="bg-gradient-to-r from-emerald-900/90 to-teal-900/90 border border-emerald-400/40 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between animate-slide-up">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage("")} className="text-gray-300 hover:text-white">
                        <FiX size={16} />
                    </button>
                </div>
            )}

            {/* ─── WALLET METRICS OVERVIEW CARDS ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Available Balance */}
                <div className="bg-gradient-to-br from-[#16162A] to-[#1E1238] border border-pink-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available Balance</span>
                        <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                            <FiDollarSign size={18} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-white mb-2">₹{availableBalance.toLocaleString()}</div>
                    <button
                        onClick={() => setShowWithdrawModal(true)}
                        className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 active:scale-95 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-1.5"
                    >
                        <FiArrowUpRight size={14} /> Withdraw Funds
                    </button>
                </div>

                {/* Locked in Escrow */}
                <div className="bg-[#16162A] border border-purple-500/20 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Locked in Escrow</span>
                        <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                            <FiLock size={18} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-purple-300 mb-2">₹{escrowPending.toLocaleString()}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                        <FiClock size={12} className="text-purple-400" />
                        <span>Releases upon session completion</span>
                    </div>
                </div>

                {/* Total Lifetime Earnings */}
                <div className="bg-[#16162A] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lifetime Earnings</span>
                        <div className="w-9 h-9 rounded-2xl bg-white/10 text-pink-400 border border-white/10 flex items-center justify-center">
                            <FiTrendingUp size={18} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-white mb-2">₹{totalEarned.toLocaleString()}</div>
                    <div className="text-[11px] text-gray-400">
                        Total Withdrawn: <span className="text-gray-200 font-bold">₹{totalWithdrawn.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* ─── TRANSACTIONS & PAYOUT HISTORY ─── */}
            <div className="bg-[#16162A] border border-white/10 rounded-3xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white">Wallet Activity & History</h3>
                            <button
                                onClick={fetchWalletData}
                                title="Refresh Balance & History"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                            >
                                <FiRefreshCw size={13} className={isLoading ? "animate-spin text-pink-400" : ""} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">Track your completed date payouts and withdrawals</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-[#0D0D1A] p-1 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setFilterType("all")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                filterType === "all" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            All ({transactions.length})
                        </button>
                        <button
                            onClick={() => setFilterType("escrow")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                filterType === "escrow" ? "bg-purple-500/30 text-purple-300" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Escrow Credits
                        </button>
                        <button
                            onClick={() => setFilterType("withdrawals")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                filterType === "withdrawals" ? "bg-pink-500/30 text-pink-300" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Withdrawals
                        </button>
                    </div>
                </div>

                {/* Transactions Table / List */}
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-xs">
                        <FiClock size={28} className="mx-auto mb-2 opacity-40 text-purple-400" />
                        <p className="font-semibold">No transactions found.</p>
                        <p className="text-[11px] text-gray-600 mt-1">When bookings are completed or payouts are requested, they will appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredTransactions.map((tx) => {
                            const isCredit = tx.type === "escrow_credit" || tx.type === "escrow_release" || tx.type === "escrow_hold";
                            const isInEscrow = tx.status === "in_escrow";

                            return (
                                <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-white/5 px-2 rounded-2xl transition">
                                    <div className="flex items-center gap-3.5">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base ${
                                            isInEscrow
                                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                                : isCredit
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                        }`}>
                                            {isInEscrow ? <FiLock size={18} /> : isCredit ? <FiArrowDownLeft size={18} /> : <FiArrowUpRight size={18} />}
                                        </div>

                                        <div>
                                            <div className="font-bold text-white text-xs sm:text-sm">{tx.title}</div>
                                            <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                                                <span>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : (tx.date || "Recent")}</span>
                                                <span>•</span>
                                                <span className="font-mono">#{tx.id}</span>
                                                <span>•</span>
                                                <span>{tx.method || "Escrow"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className={`text-sm sm:text-base font-extrabold ${
                                            isInEscrow ? "text-purple-400" : isCredit ? "text-emerald-400" : "text-white"
                                        }`}>
                                            {isCredit ? "+" : "-"}₹{parseFloat(tx.amount || 0).toLocaleString()}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                            isInEscrow
                                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                                : tx.status === "completed"
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                        }`}>
                                            {isInEscrow ? "In Escrow" : tx.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── WITHDRAWAL MODAL ─── */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="relative w-full max-w-md bg-[#141428] border border-pink-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl text-left">
                        <button
                            onClick={() => setShowWithdrawModal(false)}
                            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                        >
                            <FiX size={18} />
                        </button>

                        <h3 className="text-lg font-bold text-white mb-1">Request Earnings Payout</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            Available to withdraw: <strong className="text-emerald-400">₹{availableBalance.toLocaleString()}</strong>
                        </p>

                        {errorMessage && (
                            <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500/50 text-red-300 text-xs font-semibold">
                                {errorMessage}
                            </div>
                        )}

                        <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                            {/* Payout Method */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1.5">Payout Method</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setWithdrawMethod("upi")}
                                        className={`p-3 rounded-2xl border text-center transition flex items-center justify-center gap-2 ${
                                            withdrawMethod === "upi"
                                                ? "bg-pink-500/20 border-pink-500 text-pink-300 font-bold"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                        }`}
                                    >
                                        <FiSmartphone size={16} /> Instant UPI
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWithdrawMethod("bank")}
                                        className={`p-3 rounded-2xl border text-center transition flex items-center justify-center gap-2 ${
                                            withdrawMethod === "bank"
                                                ? "bg-pink-500/20 border-pink-500 text-pink-300 font-bold"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                        }`}
                                    >
                                        <FiCreditCard size={16} /> Bank Transfer
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">Withdrawal Amount (₹)</label>
                                <input
                                    type="number"
                                    required
                                    min="500"
                                    max={availableBalance}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="Enter amount (min ₹500)"
                                    className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition font-bold"
                                />
                                <div className="flex gap-2 mt-2">
                                    {[1000, 2500, 5000].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setWithdrawAmount(amt.toString())}
                                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-gray-300 border border-white/5"
                                        >
                                            ₹{amt.toLocaleString()}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setWithdrawAmount(availableBalance.toString())}
                                        className="px-2.5 py-1 bg-pink-500/20 text-pink-300 rounded-lg text-[10px] font-bold border border-pink-500/30 ml-auto"
                                    >
                                        Max All
                                    </button>
                                </div>
                            </div>

                            {/* UPI ID Input */}
                            {withdrawMethod === "upi" ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1">Your UPI ID (VPA)</label>
                                    <input
                                        type="text"
                                        required
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value)}
                                        placeholder="yourname@okhdfcbank / mobile@paytm"
                                        className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                                    />
                                </div>
                            ) : (
                                /* Bank Account Details */
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-300 mb-1">Account Holder Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={accountHolder}
                                            onChange={(e) => setAccountHolder(e.target.value)}
                                            placeholder="As per bank records"
                                            className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-300 mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={accountNumber}
                                            onChange={(e) => setAccountNumber(e.target.value)}
                                            placeholder="987654321000"
                                            className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-300 mb-1">IFSC Code</label>
                                        <input
                                            type="text"
                                            required
                                            value={ifscCode}
                                            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                            placeholder="HDFC0001234"
                                            className="w-full bg-[#181830] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 transition uppercase font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !withdrawAmount}
                                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-xs shadow-xl hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Processing Payout Request...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiCheck size={16} />
                                        <span>Confirm Payout of ₹{(parseFloat(withdrawAmount) || 0).toLocaleString()}</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

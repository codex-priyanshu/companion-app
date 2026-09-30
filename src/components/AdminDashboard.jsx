import React, { useState, useEffect } from "react";
import { PAGES } from "../App";
import {
    FiShield,
    FiUser,
    FiAlertTriangle,
    FiCheckCircle,
    FiLock,
    FiUnlock,
    FiSlash,
    FiTrash2,
    FiBarChart2,
    FiPrinter,
    FiCalendar,
    FiMail,
    FiX,
    FiRefreshCw,
    FiArrowLeft,
    FiDollarSign,
    FiCreditCard,
    FiClock,
    FiCheck,
    FiMapPin,
    FiExternalLink,
    FiKey
} from "react-icons/fi";

// Backend API Base URL
const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

/**
 * Super Admin Dashboard Component
 * 
 * Features:
 * - Real-time statistics across users, KYC, bookings, reports, financial payouts, and SOS alerts.
 * - Comprehensive user management (Freeze, Platform-Block, KYC Approval, Role Change, Safe Deletion).
 * - Emergency SOS Monitoring with live GPS coordinates and Google Maps integration.
 * - Financial Payouts & Escrow settlement with custom confirmation modals (Mobile/WebView safe).
 * - User report resolution and moderation tools.
 * - Platform summary report with Print / Save PDF capability.
 */
function AdminDashboard({ user, setPage }) {
    /* ════════════════════════════════════════════════════════════════════
       1. STATE MANAGEMENT
       ════════════════════════════════════════════════════════════════════ */
    
    // Core Platform Statistics
    const [stats, setStats] = useState({
        totalUsers: 0,
        girls: 0,
        boys: 0,
        pendingKyc: 0,
        posts: 0,
        bookings: 0,
        pendingReports: 0,
        frozenUsers: 0,
        activeSosAlerts: 0,
        pendingPayouts: 0
    });

    // Data Collections
    const [users, setUsers] = useState([]);
    const [reports, setReports] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [sosAlerts, setSosAlerts] = useState([]);

    // UI & Loading States
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    const [activeTab, setActiveTab] = useState("users"); // "users" | "sos" | "unverified" | "reports" | "payouts" | "insights"
    const [activeFilter, setActiveFilter] = useState("all"); // Filter for users tab: all, girls, boys, frozen, blocked, pendingKyc, unverified
    const [actionLoading, setActionLoading] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    
    // Selected User for Detail & Management Modal
    const [selectedUser, setSelectedUser] = useState(null);

    // Custom Interactive Dialog Modals (Replacing browser prompt() for mobile safety)
    const [payoutModal, setPayoutModal] = useState({ open: false, payout: null, action: 'approve', textValue: '' });
    const [roleModal, setRoleModal] = useState({ open: false, targetUser: null, selectedRole: 'boy' });

    /* ════════════════════════════════════════════════════════════════════
       2. DYNAMIC AUTH HEADERS HELPER
       ════════════════════════════════════════════════════════════════════ */
    // Fetches the latest token on every call to prevent stale token authorization errors
    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    const setLoaderFor = (key, val) => setActionLoading(prev => ({ ...prev, [key]: val }));

    /* ════════════════════════════════════════════════════════════════════
       3. DATA FETCHING (ALL PLATFORM DATA)
       ════════════════════════════════════════════════════════════════════ */
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        setAuthError(null);

        try {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
                setAuthError("No authentication token found. Please login with an Administrator account.");
                setLoading(false);
                return;
            }

            const currentHeaders = getHeaders();

            // Parallel fetch for optimal load speed
            const [statsRes, usersRes, reportsRes, payoutsRes, sosRes] = await Promise.all([
                fetch(`${API}/admin/stats`, { headers: currentHeaders }).catch(() => ({ ok: false, status: 500 })),
                fetch(`${API}/admin/users`, { headers: currentHeaders }).catch(() => ({ ok: false, status: 500 })),
                fetch(`${API}/admin/reports`, { headers: currentHeaders }).catch(() => ({ ok: false, status: 500 })),
                fetch(`${API}/admin/payouts`, { headers: currentHeaders }).catch(() => ({ ok: false, status: 500 })),
                fetch(`${API}/sos/admin/alerts`, { headers: currentHeaders }).catch(() => ({ ok: false, status: 500 }))
            ]);

            // Authentication & Authorization check
            if (statsRes.status === 401 || statsRes.status === 403 || usersRes.status === 401 || usersRes.status === 403) {
                setAuthError("Access Restricted: Super Admin credentials required to view this dashboard.");
                setLoading(false);
                return;
            }

            if (statsRes.ok) {
                const s = await statsRes.json();
                setStats(prev => ({ ...prev, ...s }));
            }

            if (usersRes.ok) {
                const usersData = await usersRes.json();
                if (Array.isArray(usersData)) setUsers(usersData);
            }

            if (reportsRes.ok) {
                const repData = await reportsRes.json();
                if (Array.isArray(repData)) setReports(repData);
            }

            if (payoutsRes.ok) {
                const payData = await payoutsRes.json();
                if (Array.isArray(payData)) setPayouts(payData);
            }

            if (sosRes.ok) {
                const sosData = await sosRes.json();
                if (Array.isArray(sosData)) setSosAlerts(sosData);
            }
        } catch (err) {
            console.error('Admin fetchAll error:', err);
        } finally {
            setLoading(false);
        }
    };

    /* ════════════════════════════════════════════════════════════════════
       4. ADMINISTRATIVE ACTIONS
       ════════════════════════════════════════════════════════════════════ */

    /**
     * Update user's KYC verification status
     * @param {number} userId 
     * @param {'verified'|'rejected'|'pending'} status 
     */
    const handleKycUpdate = async (userId, status) => {
        setLoaderFor(`kyc_${userId}`, true);
        try {
            const res = await fetch(`${API}/admin/kyc/${userId}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, kyc_status: status } : u));
                if (selectedUser?.id === userId) {
                    setSelectedUser(prev => prev ? { ...prev, kyc_status: status } : null);
                }
                alert(`KYC marked as ${status}.`);
            } else {
                const err = await res.json();
                alert(err.error || "Failed to update KYC status.");
            }
        } catch (e) {
            alert("Network error updating KYC.");
        } finally {
            setLoaderFor(`kyc_${userId}`, false);
        }
    };

    /**
     * Freeze / Unfreeze user account
     * @param {number} userId 
     * @param {boolean} freeze 
     */
    const handleFreeze = async (userId, freeze) => {
        // Prevent freezing self
        if (parseInt(user?.id) === parseInt(userId)) {
            alert("Security restriction: You cannot freeze your own account.");
            return;
        }

        setLoaderFor(`freeze_${userId}`, true);
        try {
            const res = await fetch(`${API}/admin/users/${userId}/freeze`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ freeze })
            });
            if (res.ok) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_frozen: freeze } : u));
                if (selectedUser?.id === userId) {
                    setSelectedUser(prev => prev ? { ...prev, is_frozen: freeze } : null);
                }
                setStats(prev => ({
                    ...prev,
                    frozenUsers: Math.max(0, prev.frozenUsers + (freeze ? 1 : -1))
                }));
            } else {
                const err = await res.json();
                alert(err.error || "Failed to freeze/unfreeze account.");
            }
        } catch (e) {
            alert("Network error updating freeze status.");
        } finally {
            setLoaderFor(`freeze_${userId}`, false);
        }
    };

    /**
     * Platform Block / Unblock user
     * @param {number} userId 
     * @param {boolean} block 
     */
    const handlePlatformBlock = async (userId, block) => {
        // Prevent blocking self
        if (parseInt(user?.id) === parseInt(userId)) {
            alert("Security restriction: You cannot block your own account.");
            return;
        }

        setLoaderFor(`block_${userId}`, true);
        try {
            const res = await fetch(`${API}/admin/users/${userId}/platform-block`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ block })
            });
            if (res.ok) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_platform_blocked: block } : u));
                if (selectedUser?.id === userId) {
                    setSelectedUser(prev => prev ? { ...prev, is_platform_blocked: block } : null);
                }
                alert(block ? "User has been blocked from the platform." : "User has been unblocked.");
            } else {
                const err = await res.json();
                alert(err.error || "Failed to update block status.");
            }
        } catch (e) {
            alert("Network error updating block status.");
        } finally {
            setLoaderFor(`block_${userId}`, false);
        }
    };

    /**
     * Safely delete user account (uses database transaction on backend)
     * @param {number} userId 
     * @param {string} name 
     */
    const handleDeleteUser = async (userId, name) => {
        // Prevent self deletion
        if (parseInt(user?.id) === parseInt(userId)) {
            alert("Security restriction: You cannot delete your own admin account.");
            return false;
        }

        const confirmDelete = window.confirm(`Permanently delete "${name}"? This action CANNOT be undone and removes all user data!`);
        if (!confirmDelete) return false;

        setLoaderFor(`del_${userId}`, true);
        try {
            const res = await fetch(`${API}/admin/users/${userId}`, {
                method: "DELETE",
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
                if (selectedUser?.id === userId) {
                    setSelectedUser(null); // Cleanly close modal
                }
                setStats(prev => ({
                    ...prev,
                    totalUsers: Math.max(0, prev.totalUsers - 1)
                }));
                alert(data.message || `User "${name}" has been permanently removed.`);
                return true;
            } else {
                alert(data.error || "Failed to delete user.");
                return false;
            }
        } catch (e) {
            alert("Network error deleting user.");
            return false;
        } finally {
            setLoaderFor(`del_${userId}`, false);
        }
    };

    /**
     * Update User Role (Admin, Boy, Girl)
     */
    const handleRoleSubmit = async () => {
        if (!roleModal.targetUser) return;
        const userId = roleModal.targetUser.id;
        const newRole = roleModal.selectedRole;

        setLoaderFor(`role_${userId}`, true);
        try {
            const res = await fetch(`${API}/admin/change-role`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ userId, role: newRole })
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
                if (selectedUser?.id === userId) {
                    setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
                }
                alert(data.message || `Role updated to ${newRole}.`);
                setRoleModal({ open: false, targetUser: null, selectedRole: 'boy' });
            } else {
                alert(data.error || "Failed to update role.");
            }
        } catch (e) {
            alert("Network error updating role.");
        } finally {
            setLoaderFor(`role_${userId}`, false);
        }
    };

    /**
     * Update Report Status (Reviewed / Dismissed)
     */
    const handleReportStatus = async (reportId, status) => {
        setLoaderFor(`rep_${reportId}`, true);
        try {
            const res = await fetch(`${API}/admin/reports/${reportId}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
                setStats(prev => ({
                    ...prev,
                    pendingReports: Math.max(0, prev.pendingReports - 1)
                }));
            } else {
                alert("Failed to update report status.");
            }
        } catch (e) {
            alert("Network error updating report.");
        } finally {
            setLoaderFor(`rep_${reportId}`, false);
        }
    };

    /**
     * Resolve Emergency SOS Alert
     */
    const handleResolveSos = async (alertId) => {
        setLoaderFor(`sos_${alertId}`, true);
        try {
            const res = await fetch(`${API}/sos/admin/alerts/${alertId}/resolve`, {
                method: "PUT",
                headers: getHeaders()
            });
            if (res.ok) {
                setSosAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'resolved', resolved_at: new Date().toISOString() } : a));
                setStats(prev => ({
                    ...prev,
                    activeSosAlerts: Math.max(0, prev.activeSosAlerts - 1)
                }));
                alert("SOS Alert marked as Resolved. Safety confirmed!");
            } else {
                alert("Failed to resolve SOS alert.");
            }
        } catch (e) {
            alert("Network error resolving SOS alert.");
        } finally {
            setLoaderFor(`sos_${alertId}`, false);
        }
    };

    /**
     * Submit Payout Approval or Rejection (Via Custom Modal)
     */
    const submitPayoutAction = async () => {
        const { payout, action, textValue } = payoutModal;
        if (!payout) return;

        if (action === 'approve' && !textValue.trim()) {
            alert("Please enter the UTR or Bank Transaction Reference ID.");
            return;
        }

        setLoaderFor(`payout_${payout.id}`, true);
        try {
            const res = await fetch(`${API}/admin/payouts/${payout.id}/process`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    action,
                    reference_id: action === 'approve' ? textValue.trim() : null,
                    admin_notes: action === 'approve' ? `Approved with Ref: ${textValue.trim()}` : (textValue.trim() || "Rejected by Admin")
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || `Payout ${action}d successfully!`);
                setPayoutModal({ open: false, payout: null, action: 'approve', textValue: '' });
                fetchAll(); // Refresh updated balances
            } else {
                alert(data.error || "Failed to process payout.");
            }
        } catch (e) {
            alert("Network error processing payout.");
        } finally {
            setLoaderFor(`payout_${payout.id}`, false);
        }
    };

    /* ════════════════════════════════════════════════════════════════════
       5. AUTH RESTRICTION & LOADING SCREENS
       ════════════════════════════════════════════════════════════════════ */
    if (authError) {
        return (
            <div className="min-h-[100dvh] bg-[#0D0D1A] flex items-center justify-center p-4 text-center">
                <div className="max-w-md w-full bg-[#16162A] border border-red-500/30 rounded-3xl p-8 shadow-2xl space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                        <FiSlash size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Super Admin Access Required</h2>
                    <p className="text-xs text-gray-400 leading-relaxed">{authError}</p>
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => { if (setPage) setPage(PAGES.HOME); else window.location.hash = "#home"; }}
                            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs transition border border-white/10"
                        >
                            Back to Home
                        </button>
                        <button
                            onClick={() => { if (setPage) setPage(PAGES.BOY_LOGIN); else window.location.hash = "#boy_login"; }}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs shadow-lg hover:opacity-90 transition"
                        >
                            Admin Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-[#0D0D1A] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-pink-400 font-bold text-sm tracking-wide animate-pulse">Loading Super Admin Panel...</div>
            </div>
        );
    }

    /* ════════════════════════════════════════════════════════════════════
       6. COMPUTED FILTERING
       ════════════════════════════════════════════════════════════════════ */
    const unverifiedUsers = users.filter(u => u.is_verified === false);
    const activeSosCount = sosAlerts.filter(s => s.status === 'active').length;

    const getFilteredUsers = () => {
        let base = users;
        switch (activeFilter) {
            case "girls":       base = users.filter(u => u.role === 'girl'); break;
            case "boys":        base = users.filter(u => u.role === 'boy'); break;
            case "frozen":      base = users.filter(u => u.is_frozen); break;
            case "blocked":     base = users.filter(u => u.is_platform_blocked); break;
            case "pendingKyc":  base = users.filter(u => u.kyc_status === 'pending'); break;
            case "unverified":  base = unverifiedUsers; break;
            default:            base = users; break;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            base = base.filter(u =>
                (u.name && u.name.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.phone && u.phone.includes(q))
            );
        }
        return base;
    };

    const filteredUsers = getFilteredUsers();

    // Stat cards definition for quick navigation
    const statCards = [
        { label: "Total Users", value: stats.totalUsers, color: "text-white", border: "border-white/10", bg: "hover:bg-white/5", filter: "all" },
        { label: "Girls", value: stats.girls, color: "text-pink-400", border: "border-pink-500/30", bg: "hover:bg-pink-500/5", filter: "girls" },
        { label: "Boys", value: stats.boys, color: "text-blue-400", border: "border-blue-500/30", bg: "hover:bg-blue-500/5", filter: "boys" },
        { label: "Pending KYC", value: stats.pendingKyc, color: "text-yellow-400", border: "border-yellow-500/30", bg: "hover:bg-yellow-500/5", filter: "pendingKyc" },
        { label: "Bookings", value: stats.bookings, color: "text-green-400", border: "border-green-500/30", bg: "hover:bg-green-500/5", filter: null },
        { label: "Pending Reports", value: stats.pendingReports, color: "text-orange-400", border: "border-orange-500/30", bg: "hover:bg-orange-500/5", goTab: "reports" },
        { label: "Active SOS Alerts", value: activeSosCount, color: "text-red-400", border: "border-red-500/40", bg: "hover:bg-red-500/10", goTab: "sos" },
        { label: "Pending Payouts", value: payouts.filter(p => p.status === 'pending').length, color: "text-emerald-400", border: "border-emerald-500/30", bg: "hover:bg-emerald-500/5", goTab: "payouts" },
        { label: "Frozen Accounts", value: stats.frozenUsers, color: "text-cyan-400", border: "border-cyan-500/30", bg: "hover:bg-cyan-500/5", filter: "frozen" },
        { label: "OTP Unverified", value: unverifiedUsers.length, color: "text-red-400", border: "border-red-500/30", bg: "hover:bg-red-500/5", filter: "unverified" },
    ];

    const filterLabels = {
        all: "All Users",
        girls: "Girls Only",
        boys: "Boys Only",
        frozen: "Frozen Accounts",
        blocked: "Blocked Users",
        pendingKyc: "Pending KYC",
        unverified: "OTP Unverified",
    };

    /* ════════════════════════════════════════════════════════════════════
       7. MAIN DASHBOARD RENDER
       ════════════════════════════════════════════════════════════════════ */
    return (
        <div className="pt-24 pb-20 min-h-[100dvh] bg-[#0D0D1A] px-4 sm:px-6 max-w-6xl mx-auto">
            {/* Header Bar */}
            <div className="flex items-center justify-between mb-8 print:hidden">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
                        <FiShield className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" /> Super Admin Panel
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Full administrative authority over accounts, security, and finances.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setLoading(true); fetchAll(); }}
                        className="px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30 transition text-sm font-bold flex items-center gap-1.5"
                    >
                        <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                    <button
                        onClick={() => setPage(PAGES.HOME)}
                        className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm flex items-center gap-1.5"
                    >
                        <FiArrowLeft size={14} /> Home
                    </button>
                </div>
            </div>

            {/* Stats Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8 print:hidden">
                {statCards.map(s => (
                    <div
                        key={s.label}
                        onClick={() => {
                            if (s.goTab) { setActiveTab(s.goTab); return; }
                            if (s.filter !== null && s.filter !== undefined) {
                                setActiveTab("users");
                                setActiveFilter(s.filter);
                                setSearchQuery("");
                            }
                        }}
                        className={`bg-[#16162A] border ${s.border} rounded-2xl p-4 shadow-lg transition ${
                            (s.filter !== null && s.filter !== undefined) || s.goTab
                                ? `cursor-pointer ${s.bg} ${activeFilter === s.filter && activeTab === 'users' ? 'ring-2 ring-white/30 scale-[1.02]' : ''}`
                                : 'cursor-default opacity-80'
                        }`}
                    >
                        <div className="text-gray-400 text-xs mb-1 flex items-center justify-between">
                            <span>{s.label}</span>
                            {((s.filter !== null && s.filter !== undefined) || s.goTab) && (
                                <span className="text-[9px] text-gray-600 font-medium">view →</span>
                            )}
                        </div>
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 bg-[#16162A] p-1.5 rounded-2xl border border-white/5 w-fit print:hidden">
                {/* Users Tab */}
                <button
                    onClick={() => { setActiveTab("users"); setActiveFilter("all"); }}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                        activeTab === "users" ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <FiUser size={15} /> Users ({users.length})
                </button>

                {/* Emergency SOS Alerts Tab */}
                <button
                    onClick={() => setActiveTab("sos")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                        activeTab === "sos" ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <FiAlertTriangle size={15} /> Emergency SOS
                    {activeSosCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-ping">
                            {activeSosCount}
                        </span>
                    )}
                </button>

                {/* OTP Pending Tab */}
                <button
                    onClick={() => setActiveTab("unverified")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                        activeTab === "unverified" ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <FiMail size={15} /> OTP Pending
                    {unverifiedUsers.length > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unverifiedUsers.length}
                        </span>
                    )}
                </button>

                {/* Reports Tab */}
                <button
                    onClick={() => setActiveTab("reports")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                        activeTab === "reports" ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <FiAlertTriangle size={15} /> Reports
                    {stats.pendingReports > 0 && (
                        <span className="w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {stats.pendingReports}
                        </span>
                    )}
                </button>

                {/* Payouts Tab */}
                <button
                    onClick={() => setActiveTab("payouts")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                        activeTab === "payouts" ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <FiDollarSign size={15} /> Payouts & Escrow
                    {payouts.filter(p => p.status === 'pending').length > 0 && (
                        <span className="w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {payouts.filter(p => p.status === 'pending').length}
                        </span>
                    )}
                </button>

                {/* Insights Tab */}
                <button
                    onClick={() => setActiveTab("insights")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                        activeTab === "insights" ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <FiBarChart2 size={15} /> Insights & Proofs
                </button>
            </div>

            {/* ════════════════════════════════════════════════════════════
               TAB 1: USERS DIRECTORY
               ════════════════════════════════════════════════════════════ */}
            {activeTab === "users" && (
                <div>
                    {/* Search & Filter Controls */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by name, email, phone..."
                                className="w-full bg-[#16162A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-pink-500 transition"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    <FiX size={14} />
                                </button>
                            )}
                        </div>

                        {["all", "girls", "boys", "frozen", "blocked", "pendingKyc"].map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    activeFilter === f
                                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {filterLabels[f]}
                            </button>
                        ))}
                    </div>

                    <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                        Showing <span className="text-pink-400 font-bold">{filterLabels[activeFilter]}</span>
                        <span className="text-gray-600">— {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
                    </div>

                    {filteredUsers.length === 0 ? (
                        <div className="p-12 bg-[#16162A] border border-white/10 rounded-2xl text-center text-gray-500 flex flex-col items-center gap-2 shadow-xl">
                            <FiUser size={32} className="text-gray-600" />
                            <span className="font-bold text-sm">No users found under this filter.</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredUsers.map((u) => {
                                const isGirl = u.role === 'girl';
                                const isAdmin = u.role === 'admin';

                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => setSelectedUser(u)}
                                        className={`relative bg-gradient-to-br from-[#181832] to-[#121224] border border-white/8 hover:border-pink-500/40 p-4 rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-pink-500/5 cursor-pointer flex flex-col justify-between ${
                                            u.is_frozen || u.is_platform_blocked ? 'opacity-70' : ''
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-3">
                                                {u.profile_pic ? (
                                                    <img src={u.profile_pic} alt="" className="w-12 h-12 rounded-full object-cover border border-white/10" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-base font-extrabold shadow-inner">
                                                        {u.name?.[0]?.toUpperCase() || 'U'}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                                                        {u.name}
                                                        {u.report_count > 0 && (
                                                            <span className="shrink-0 text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded-full font-extrabold border border-orange-500/20">
                                                                🚩 {u.report_count}
                                                            </span>
                                                        )}
                                                    </h3>
                                                    <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 ${
                                                        isAdmin ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                        isGirl ? 'bg-pink-500/15 text-pink-400 border border-pink-500/20' :
                                                        'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                                    }`}>
                                                        {u.role}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2 border-t border-white/5 pt-3 text-xs text-gray-400">
                                                <div className="flex justify-between items-center">
                                                    <span>Email:</span>
                                                    <span className="text-white font-mono truncate max-w-[150px]">{u.email}</span>
                                                </div>
                                                {u.phone && (
                                                    <div className="flex justify-between items-center">
                                                        <span>Phone:</span>
                                                        <span className="text-white font-mono">{u.phone}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center">
                                                    <span>KYC:</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        u.kyc_status === 'verified' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                        u.kyc_status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                        {u.kyc_status || 'unverified'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                {u.is_platform_blocked ? (
                                                    <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">Blocked</span>
                                                ) : u.is_frozen ? (
                                                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">Frozen</span>
                                                ) : (
                                                    <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">Active</span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-pink-400 font-extrabold hover:text-pink-300 transition flex items-center gap-0.5">
                                                Manage →
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
               TAB 2: EMERGENCY SOS ALERTS (LIVE MONITORING)
               ════════════════════════════════════════════════════════════ */}
            {activeTab === "sos" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-red-950/30 border border-red-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                                <FiAlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Emergency SOS Monitor</h3>
                                <p className="text-xs text-red-300">Live GPS alerts triggered by companions or clients in distress.</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchAll}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 flex items-center gap-1.5 transition"
                        >
                            <FiRefreshCw size={12} /> Refresh
                        </button>
                    </div>

                    {sosAlerts.length === 0 ? (
                        <div className="bg-[#16162A] border border-white/5 rounded-2xl p-12 text-center text-gray-500 flex flex-col items-center gap-2">
                            <FiCheckCircle size={32} className="text-green-500" />
                            <span className="font-bold text-sm text-white">Zero Active SOS Alerts</span>
                            <span className="text-xs text-gray-500">All users are safe. No emergency requests recorded.</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sosAlerts.map(alert => {
                                const isActive = alert.status === 'active';
                                const mapsUrl = alert.latitude && alert.longitude
                                    ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`
                                    : null;

                                return (
                                    <div
                                        key={alert.id}
                                        className={`p-5 rounded-2xl border transition ${
                                            isActive
                                                ? 'bg-red-950/20 border-red-500/40 shadow-xl shadow-red-500/10'
                                                : 'bg-[#16162A] border-white/5 opacity-70'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5">
                                                {alert.user_pic ? (
                                                    <img src={alert.user_pic} alt="" className="w-12 h-12 rounded-full object-cover border border-white/15" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-red-600/30 text-red-400 font-bold flex items-center justify-center text-base">
                                                        {alert.user_name?.[0]?.toUpperCase() || "U"}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-sm">{alert.user_name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                            isActive ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                            {alert.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-0.5">{alert.user_email}</div>
                                                    {alert.message && (
                                                        <div className="text-xs text-red-200 mt-1 italic bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                                                            "{alert.message}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                {mapsUrl && (
                                                    <a
                                                        href={mapsUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-3.5 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                                                    >
                                                        <FiMapPin size={13} /> View Live GPS ({alert.latitude}, {alert.longitude}) <FiExternalLink size={12} />
                                                    </a>
                                                )}

                                                {isActive && (
                                                    <button
                                                        onClick={() => handleResolveSos(alert.id)}
                                                        disabled={actionLoading[`sos_${alert.id}`]}
                                                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-xs shadow-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                                                    >
                                                        <FiCheck size={14} /> Mark as Resolved
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-500 flex justify-between">
                                            <span>Alert ID: #{alert.id}</span>
                                            <span>Time: {new Date(alert.created_at).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
               TAB 3: OTP UNVERIFIED USERS
               ════════════════════════════════════════════════════════════ */}
            {activeTab === "unverified" && (
                <div>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <FiMail size={14} className="text-red-400" />
                            <span className="text-red-400 text-xs font-bold">{unverifiedUsers.length} users have not verified OTP</span>
                        </div>
                        <span className="text-gray-500 text-xs">Unverified accounts cannot login to the platform.</span>
                    </div>

                    <div className="bg-[#16162A] border border-red-500/20 rounded-2xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            {unverifiedUsers.length === 0 ? (
                                <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-2">
                                    <FiCheckCircle size={28} className="text-green-500" />
                                    <span>All users have verified their email & phone OTP! 🎉</span>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="text-xs text-gray-400 uppercase bg-red-500/5">
                                        <tr>
                                            <th className="px-4 py-3">User</th>
                                            <th className="px-4 py-3">Role</th>
                                            <th className="px-4 py-3">Email</th>
                                            <th className="px-4 py-3">Phone</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {unverifiedUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-red-500/5 transition">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                                                            {u.name?.[0]}
                                                        </div>
                                                        <div className="font-medium text-white">{u.name}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 uppercase text-xs">{u.role}</td>
                                                <td className="px-4 py-3 text-xs text-gray-300">{u.email}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{u.phone || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-full font-bold flex items-center gap-1 w-fit">
                                                        <FiMail size={10} /> OTP Pending
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id, u.name)}
                                                        disabled={actionLoading[`del_${u.id}`]}
                                                        className="px-2.5 py-1 bg-red-900/30 text-red-400 rounded-lg text-xs hover:bg-red-900/60 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <FiTrash2 size={12} /> Clean
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
               TAB 4: USER REPORTS & MODERATION
               ════════════════════════════════════════════════════════════ */}
            {activeTab === "reports" && (
                <div className="space-y-3">
                    {reports.length === 0 && (
                        <div className="bg-[#16162A] border border-white/5 rounded-2xl p-10 text-center text-gray-500 flex flex-col items-center gap-2">
                            <FiCheckCircle size={28} className="text-green-500" />
                            <span>No reports yet. Platform safety clean!</span>
                        </div>
                    )}
                    {reports.map(r => (
                        <div key={r.id} className="bg-[#16162A] border border-white/10 rounded-2xl p-4 shadow-lg">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            {r.reporter_pic ? <img src={r.reporter_pic} alt="" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px]">{r.reporter_name?.[0]}</div>}
                                            <span className="text-xs text-blue-300 font-medium">{r.reporter_name || 'Unknown'}</span>
                                        </div>
                                        <span className="text-gray-500 text-xs">reported</span>
                                        <div className="flex items-center gap-1.5">
                                            {r.reported_pic ? <img src={r.reported_pic} alt="" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px]">{r.reported_name?.[0]}</div>}
                                            <span className="text-xs text-red-300 font-medium">{r.reported_name || 'Deleted'}</span>
                                            <span className="text-gray-600 text-xs">({r.reported_role})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-xs font-bold flex items-center gap-1"><FiAlertTriangle size={10} /> {r.reason}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : r.status === 'reviewed' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
                                            {r.status}
                                        </span>
                                    </div>
                                    {r.description && <p className="text-gray-400 text-xs mt-1">"{r.description}"</p>}
                                    <p className="text-gray-600 text-[10px] mt-1">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="flex flex-col gap-1.5 shrink-0">
                                    {r.status !== 'reviewed' && (
                                        <button onClick={() => handleReportStatus(r.id, 'reviewed')} disabled={actionLoading[`rep_${r.id}`]} className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold hover:bg-green-500/40 disabled:opacity-50">
                                            ✓ Reviewed
                                        </button>
                                    )}
                                    {r.status !== 'dismissed' && (
                                        <button onClick={() => handleReportStatus(r.id, 'dismissed')} disabled={actionLoading[`rep_${r.id}`]} className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-500/40 disabled:opacity-50">
                                            ✗ Dismiss
                                        </button>
                                    )}
                                    {r.reported_id && (
                                        <button onClick={() => handlePlatformBlock(r.reported_id, true)} disabled={actionLoading[`block_${r.reported_id}`]} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/40 disabled:opacity-50 flex items-center justify-center gap-1">
                                            <FiSlash size={12} /> Block User
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
               TAB 5: PAYOUTS & ESCROW SETTLEMENT
               ════════════════════════════════════════════════════════════ */}
            {activeTab === "payouts" && (() => {
                const pendingPayouts = payouts.filter(p => p.status === 'pending');
                const pendingAmount = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const approvedPayouts = payouts.filter(p => p.status === 'approved');
                const approvedAmount = approvedPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                return (
                    <div className="space-y-6 text-left">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#16162A] border border-amber-500/30 rounded-2xl p-4 shadow-lg">
                                <div className="text-gray-400 text-xs mb-1 flex items-center justify-between">
                                    <span>Pending Payouts</span>
                                    <FiClock size={16} className="text-amber-400" />
                                </div>
                                <div className="text-2xl font-bold text-amber-400">₹{pendingAmount.toLocaleString()}</div>
                                <div className="text-[11px] text-gray-500 mt-1">{pendingPayouts.length} requests awaiting transfer</div>
                            </div>

                            <div className="bg-[#16162A] border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
                                <div className="text-gray-400 text-xs mb-1 flex items-center justify-between">
                                    <span>Settled Payouts</span>
                                    <FiCheckCircle size={16} className="text-emerald-400" />
                                </div>
                                <div className="text-2xl font-bold text-emerald-400">₹{approvedAmount.toLocaleString()}</div>
                                <div className="text-[11px] text-gray-500 mt-1">{approvedPayouts.length} successful transfers</div>
                            </div>

                            <div className="bg-[#16162A] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                                <div className="text-gray-400 text-xs flex items-center justify-between">
                                    <span>Total Requests</span>
                                    <FiDollarSign size={16} className="text-pink-400" />
                                </div>
                                <div className="text-2xl font-bold text-white">{payouts.length}</div>
                                <button
                                    onClick={fetchAll}
                                    className="w-fit px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 flex items-center gap-1.5 transition"
                                >
                                    <FiRefreshCw size={12} /> Refresh Payouts
                                </button>
                            </div>
                        </div>

                        {/* Payout Queue */}
                        <div className="bg-[#16162A] border border-white/10 rounded-3xl p-6 shadow-xl">
                            <h3 className="text-base font-bold text-white mb-4">Companion Withdrawal Queue</h3>

                            {payouts.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-xs">
                                    <FiCreditCard size={32} className="mx-auto mb-2 opacity-40 text-emerald-400" />
                                    <p className="font-semibold">No payout requests found.</p>
                                    <p className="text-[11px] text-gray-600 mt-1">When companions submit withdrawal requests, they will show up here for 1-click settlement.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {payouts.map((p) => {
                                        const isPending = p.status === 'pending';
                                        const isApproved = p.status === 'approved';

                                        return (
                                            <div key={p.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/5 px-3 rounded-2xl transition">
                                                <div className="flex items-center gap-3.5">
                                                    {p.profile_pic ? (
                                                        <img src={p.profile_pic} alt="" className="w-12 h-12 rounded-full object-cover border border-white/15" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-base">
                                                            {p.user_name?.[0]?.toUpperCase() || "U"}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white text-sm">{p.user_name}</span>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300">
                                                                {p.user_role}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-0.5">{p.user_email}</div>
                                                        <div className="text-xs text-gray-300 mt-1.5 bg-[#0E0E1C] px-2.5 py-1 rounded-lg border border-white/5 font-mono w-fit">
                                                            {p.payout_method === 'upi' ? (
                                                                <span>📱 UPI: <strong>{p.upi_id}</strong></span>
                                                            ) : (
                                                                <span>🏦 Bank: <strong>{p.account_holder_name}</strong> | A/C: <strong>{p.account_number}</strong> | IFSC: <strong>{p.ifsc_code}</strong></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 self-end sm:self-center">
                                                    <div className="text-right">
                                                        <div className="text-xl font-black text-emerald-400">₹{parseFloat(p.amount).toLocaleString()}</div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                            isPending ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                            isApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                            'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        }`}>
                                                            {p.status}
                                                        </span>
                                                    </div>

                                                    {isPending && (
                                                        <div className="flex flex-col gap-1.5">
                                                            <button
                                                                onClick={() => setPayoutModal({ open: true, payout: p, action: 'approve', textValue: `UTR_${Date.now().toString().slice(-8)}` })}
                                                                disabled={actionLoading[`payout_${p.id}`]}
                                                                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                <FiCheck size={13} /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => setPayoutModal({ open: true, payout: p, action: 'reject', textValue: '' })}
                                                                disabled={actionLoading[`payout_${p.id}`]}
                                                                className="px-3.5 py-1 bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ════════════════════════════════════════════════════════════
               TAB 6: INSIGHTS & PRINTABLE PDF REPORT
               ════════════════════════════════════════════════════════════ */}
            {activeTab === "insights" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                        <div className="bg-[#16162A] border border-white/10 rounded-2xl p-5 shadow-lg">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-1.5">
                                <FiUser className="text-pink-500" /> Gender Distribution
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-blue-400">Boys</span>
                                        <span className="font-bold text-white">{stats.boys} ({Math.round((stats.boys / stats.totalUsers) * 100) || 0}%)</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(stats.boys / stats.totalUsers) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-pink-400">Girls</span>
                                        <span className="font-bold text-white">{stats.girls} ({Math.round((stats.girls / stats.totalUsers) * 100) || 0}%)</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${(stats.girls / stats.totalUsers) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#16162A] border border-white/10 rounded-2xl p-5 shadow-lg">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-1.5">
                                <FiCheckCircle className="text-yellow-500" /> KYC Verification Rate
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-green-400">KYC Verified</span>
                                        <span className="font-bold text-white">{Math.max(0, stats.totalUsers - stats.pendingKyc)}</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${((stats.totalUsers - stats.pendingKyc) / (stats.totalUsers || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-yellow-400">Pending KYC</span>
                                        <span className="font-bold text-white">{stats.pendingKyc}</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(stats.pendingKyc / (stats.totalUsers || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Official Platform Summary Document (Print / Save as PDF) */}
                    <div className="pt-4">
                        <div className="flex justify-between items-center mb-4 print:hidden">
                            <h3 className="text-gray-400 text-sm font-bold">Official Platform Summary Report</h3>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-xs font-bold hover:opacity-90 transition shadow-lg shadow-pink-500/20"
                            >
                                <FiPrinter size={14} /> Print / Save PDF Proof
                            </button>
                        </div>

                        <style dangerouslySetInnerHTML={{__html: `
                            @media print {
                                body { background: white !important; color: black !important; }
                                nav, .print\\:hidden, button, header, footer { display: none !important; }
                                .print-box { background: white !important; color: black !important; border: 2px solid #000 !important; box-shadow: none !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 20px !important; }
                                .print-box text, .print-box span, .print-box div, .print-box p, .print-box h1, .print-box h2, .print-box h3, .print-box th, .print-box td { color: black !important; }
                                .print-border { border-color: #ccc !important; }
                            }
                        `}} />

                        <div id="print-section" className="print-box bg-[#16162A] border border-white/10 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl relative overflow-hidden">
                            <div className="flex flex-col items-center text-center pb-6 border-b border-white/10 print-border">
                                <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent tracking-wide print:text-black">Coffeely</span>
                                <p className="text-[10px] text-gray-400 tracking-widest uppercase mt-1">Official Platform Summary Report</p>
                            </div>
                            <div className="py-5 grid grid-cols-2 gap-4 text-xs border-b border-white/10 print-border">
                                <div>
                                    <span className="text-gray-500 block mb-0.5">Generated On</span>
                                    <span className="text-gray-200 font-mono font-bold flex items-center gap-1">
                                        <FiCalendar size={12} className="text-pink-500" /> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block mb-0.5">Platform Security</span>
                                    <span className="text-green-400 font-bold flex items-center gap-1">🛡️ Secured & Verified</span>
                                </div>
                            </div>
                            <div className="py-6 space-y-4">
                                <h4 className="text-sm font-bold text-white border-b border-white/5 pb-2">Statistical Breakdown</h4>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                                    <div className="flex justify-between pr-4 border-r border-white/5 print-border">
                                        <span className="text-gray-400">Total Users:</span>
                                        <span className="text-white font-bold">{stats.totalUsers}</span>
                                    </div>
                                    <div className="flex justify-between pl-4">
                                        <span className="text-gray-400">Total Bookings:</span>
                                        <span className="text-white font-bold">{stats.bookings}</span>
                                    </div>
                                    <div className="flex justify-between pr-4 border-r border-white/5 print-border">
                                        <span className="text-gray-400">Male Users (Boys):</span>
                                        <span className="text-white font-bold">{stats.boys}</span>
                                    </div>
                                    <div className="flex justify-between pl-4">
                                        <span className="text-gray-400">Female Users (Girls):</span>
                                        <span className="text-white font-bold">{stats.girls}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-white/10 print-border flex justify-between items-end text-[10px]">
                                <div className="space-y-1">
                                    <span className="text-gray-500 block">Security Verification</span>
                                    <span className="text-gray-300 font-mono select-all">COFFEELY_SECURE_VERIFIED</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-300 font-bold block">Super Admin Authority</span>
                                    <span className="text-gray-500">Coffeely Trust & Safety</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
               MODAL 1: USER DETAIL & MANAGEMENT MODAL
               ════════════════════════════════════════════════════════════ */}
            {selectedUser && (() => {
                const u = users.find(x => x.id === selectedUser.id) || selectedUser;
                const isGirl = u.role === 'girl';
                const isAdmin = u.role === 'admin';
                const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                const isSelf = parseInt(user?.id) === parseInt(u.id);

                return (
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedUser(null)}>
                        <div
                            className="bg-[#121224] border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-[#181832] to-[#121224] p-5 border-b border-white/5 flex justify-between items-center">
                                <h2 className="font-extrabold text-white text-base flex items-center gap-2">
                                    🛡️ User Management
                                </h2>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Profile Card */}
                                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                    {u.profile_pic ? (
                                        <a href={u.profile_pic} target="_blank" rel="noreferrer" title="Click to view full photo">
                                            <img src={u.profile_pic} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/50 hover:opacity-80 transition" />
                                        </a>
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xl font-black">
                                            {u.name?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-white text-base truncate">{u.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                                isAdmin ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                isGirl ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                                {u.role}
                                            </span>
                                            {/* Role Modification Button */}
                                            {!isSelf && (
                                                <button
                                                    onClick={() => setRoleModal({ open: true, targetUser: u, selectedRole: u.role || 'boy' })}
                                                    className="text-[10px] text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 transition"
                                                >
                                                    <FiKey size={10} /> Change Role
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1 font-semibold">Joined: {createdDate}</div>
                                    </div>
                                </div>

                                {/* General Details Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1">
                                        <span className="text-gray-500 block">Email Address:</span>
                                        <span className="text-white font-semibold font-mono">{u.email}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-gray-500 block">Phone Number:</span>
                                        <span className="text-white font-semibold font-mono">{u.phone || 'Not Provided'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-gray-500 block">Date of Birth (DOB):</span>
                                        <span className="text-white font-semibold">{u.dob || 'Not Provided'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-gray-500 block">Age:</span>
                                        <span className="text-white font-semibold">{u.age ? `${u.age} Years` : 'Not Provided'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-gray-500 block">Location (City):</span>
                                        <span className="text-white font-semibold">{u.city || 'Not Provided'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-gray-500 block">Hourly Price:</span>
                                        <span className="text-pink-400 font-bold">₹{u.price || 0}/hour</span>
                                    </div>
                                </div>

                                {/* Bio & Tags */}
                                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs">
                                    <div>
                                        <span className="text-gray-500 block mb-1">Bio / Description:</span>
                                        <p className="text-white bg-[#0D0D1A]/50 p-2.5 rounded-xl border border-white/5 leading-relaxed italic">{u.bio || 'No bio provided.'}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block mb-1">Tags / Services:</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(u.tags || 'Coffee Date').split(',').map((tag, i) => (
                                                <span key={i} className="px-2 py-1 bg-white/5 rounded-lg text-white font-semibold text-[10px] border border-white/5">
                                                    {tag.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* KYC ID Document Verification */}
                                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <h4 className="text-xs font-bold text-white flex justify-between items-center">
                                        <span>KYC Status:</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                            u.kyc_status === 'verified' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                            u.kyc_status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                            'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                            {u.kyc_status || 'unverified'}
                                        </span>
                                    </h4>

                                    {u.id_proof_url ? (
                                        <div className="space-y-2">
                                            <span className="text-[10px] text-gray-500 block">Uploaded ID Document:</span>
                                            <div className="relative group overflow-hidden rounded-xl border border-white/10 max-h-[200px]">
                                                <img src={u.id_proof_url} alt="KYC proof" className="w-full h-full object-contain bg-black/60" />
                                                <a
                                                    href={u.id_proof_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all"
                                                >
                                                    🔍 View Full Size Image
                                                </a>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => handleKycUpdate(u.id, 'verified')}
                                                    disabled={actionLoading[`kyc_${u.id}`]}
                                                    className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/35 border border-green-500/30 text-green-400 rounded-xl text-xs font-black transition disabled:opacity-50"
                                                >
                                                    ✓ Approve KYC
                                                </button>
                                                <button
                                                    onClick={() => handleKycUpdate(u.id, 'rejected')}
                                                    disabled={actionLoading[`kyc_${u.id}`]}
                                                    className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 text-red-400 rounded-xl text-xs font-black transition disabled:opacity-50"
                                                >
                                                    ✗ Reject KYC
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10 text-xs text-gray-500">
                                            No ID proof uploaded yet.
                                        </div>
                                    )}
                                </div>

                                {/* Security & Account Moderation Actions */}
                                {!isSelf && (
                                    <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <h4 className="text-xs font-bold text-white">Administrative Moderation</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleFreeze(u.id, !u.is_frozen)}
                                                disabled={actionLoading[`freeze_${u.id}`]}
                                                className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                                                    u.is_frozen
                                                        ? 'bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/40'
                                                        : 'bg-slate-500/10 border border-white/10 text-slate-300 hover:bg-white/5'
                                                }`}
                                            >
                                                {u.is_frozen ? <><FiUnlock size={13} /> Unfreeze</> : <><FiLock size={13} /> Freeze Account</>}
                                            </button>
                                            <button
                                                onClick={() => handlePlatformBlock(u.id, !u.is_platform_blocked)}
                                                disabled={actionLoading[`block_${u.id}`]}
                                                className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                                                    u.is_platform_blocked
                                                        ? 'bg-green-500/25 border border-green-500/30 text-green-300 hover:bg-green-500/40'
                                                        : 'bg-orange-500/15 border border-orange-500/20 text-orange-400 hover:bg-orange-500/25'
                                                }`}
                                            >
                                                {u.is_platform_blocked ? <><FiCheckCircle size={13} /> Unblock User</> : <><FiSlash size={13} /> Block User</>}
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteUser(u.id, u.name)}
                                            disabled={actionLoading[`del_${u.id}`]}
                                            className="w-full py-2 bg-red-900/20 hover:bg-red-900/35 border border-red-900/35 text-red-400 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <FiTrash2 size={13} /> Delete Account Permanently
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ════════════════════════════════════════════════════════════
               MODAL 2: PAYOUT PROCESS DIALOG (MOBILE-SAFE)
               ════════════════════════════════════════════════════════════ */}
            {payoutModal.open && payoutModal.payout && (
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#121224] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <h3 className="font-bold text-white text-base">
                                {payoutModal.action === 'approve' ? '💰 Approve Withdrawal Settlement' : '❌ Reject Withdrawal Request'}
                            </h3>
                            <button
                                onClick={() => setPayoutModal({ open: false, payout: null, action: 'approve', textValue: '' })}
                                className="text-gray-400 hover:text-white"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="text-xs text-gray-300 space-y-2 bg-white/5 p-3 rounded-xl border border-white/5">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Companion:</span>
                                <span className="font-bold text-white">{payoutModal.payout.user_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Amount:</span>
                                <span className="font-black text-emerald-400 text-sm">₹{parseFloat(payoutModal.payout.amount).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Method:</span>
                                <span className="font-mono text-white">
                                    {payoutModal.payout.payout_method === 'upi' ? `UPI: ${payoutModal.payout.upi_id}` : `A/C: ${payoutModal.payout.account_number}`}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 block mb-1.5 font-medium">
                                {payoutModal.action === 'approve' ? 'Bank / UPI Transaction Reference ID (UTR / Txn ID):' : 'Reason for rejection (will be shown in user wallet):'}
                            </label>
                            <input
                                type="text"
                                value={payoutModal.textValue}
                                onChange={e => setPayoutModal(prev => ({ ...prev, textValue: e.target.value }))}
                                placeholder={payoutModal.action === 'approve' ? 'e.g. UTR_98234123...' : 'e.g. Invalid bank account details'}
                                className="w-full bg-[#16162A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-pink-500 font-mono"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setPayoutModal({ open: false, payout: null, action: 'approve', textValue: '' })}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitPayoutAction}
                                disabled={actionLoading[`payout_${payoutModal.payout.id}`]}
                                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg ${
                                    payoutModal.action === 'approve'
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {payoutModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
               MODAL 3: ROLE MODIFICATION DIALOG
               ════════════════════════════════════════════════════════════ */}
            {roleModal.open && roleModal.targetUser && (
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#121224] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <h3 className="font-bold text-white text-base flex items-center gap-2">
                                <FiKey className="text-yellow-400" /> Modify User Role
                            </h3>
                            <button
                                onClick={() => setRoleModal({ open: false, targetUser: null, selectedRole: 'boy' })}
                                className="text-gray-400 hover:text-white"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-gray-400">
                            Select the new role for <strong className="text-white">{roleModal.targetUser.name}</strong>:
                        </p>

                        <div className="space-y-2">
                            {[
                                { id: 'boy', label: 'Client / Boy User', desc: 'Can browse, book companions, and chat.' },
                                { id: 'girl', label: 'Companion / Girl User', desc: 'Has companion profile, receives bookings, and has wallet.' },
                                { id: 'admin', label: 'Super Administrator', desc: 'Full administrative control over all accounts and finances.' },
                            ].map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => setRoleModal(prev => ({ ...prev, selectedRole: r.id }))}
                                    className={`p-3 rounded-xl border cursor-pointer transition ${
                                        roleModal.selectedRole === r.id
                                            ? 'bg-yellow-500/10 border-yellow-500/40 text-white'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <div className="text-xs font-bold capitalize">{r.label}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">{r.desc}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setRoleModal({ open: false, targetUser: null, selectedRole: 'boy' })}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRoleSubmit}
                                disabled={actionLoading[`role_${roleModal.targetUser.id}`]}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold transition shadow-lg hover:opacity-90 disabled:opacity-50"
                            >
                                Save Role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
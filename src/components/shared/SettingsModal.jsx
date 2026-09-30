import React, { useState, useRef, useEffect } from 'react';
import { PAGES } from '../../App';
import { 
    FiUser, FiLock, FiBookmark, FiHeart, FiSlash, FiHelpCircle, FiInfo, 
    FiLogOut, FiAlertTriangle, FiCamera, FiLoader, FiMessageCircle, FiPlus, FiTrash2, 
    FiCheckCircle, FiRefreshCw, FiSmartphone, FiShield, FiBell, FiEye, FiEyeOff, 
    FiHardDrive, FiCheck, FiSearch, FiChevronRight, FiKey, FiGlobe, FiDatabase 
} from 'react-icons/fi';
import { APP_VERSION, APP_VERSION_TAG, APP_RELEASE_STAGE, APP_BUILD_DATE, APP_CHANGELOG, getAppPlatform } from '../../config/version';
import { THEME_ACCENTS, CHAT_WALLPAPERS, getStoredPreferences, savePreferences } from '../../utils/themePreferences';
import ImageCropperModal from './ImageCropperModal';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function SettingsModal({ user, setUser, onClose, setPage, socket }) {
    const [activeView, setActiveView] = useState('menu');
    const [searchQuery, setSearchQuery] = useState('');
    const [cropModalData, setCropModalData] = useState(null);

    // User Preferences (WhatsApp & Instagram style)
    const [preferences, setPreferences] = useState(getStoredPreferences);

    const updatePreference = (key, value) => {
        setPreferences(prev => {
            const updated = { ...prev, [key]: value };
            savePreferences(updated);
            return updated;
        });
    };

    const currentAccent = THEME_ACCENTS.find(a => a.id === preferences.themeAccent) || THEME_ACCENTS[0];

    const [formData, setFormData] = useState({
        name: user.name || '',
        username: user.username || '',
        age: user.age || '',
        city: user.city || 'Mumbai',
        bio: user.bio || '',
        price: user.price || '',
        tags: typeof user.tags === 'string' ? user.tags : (user.tags?.join(', ') || ''),
        link: user.social_link || user.link || '',
        is_private: user.is_private || false,
        show_online: user.show_online !== false
    });

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Change Password States
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [showPass, setShowPass] = useState({ current: false, next: false, confirm: false });

    // Instagram/WhatsApp settings states
    const [savedPosts, setSavedPosts] = useState([]);
    const [likedPosts, setLikedPosts] = useState([]);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [expandedPost, setExpandedPost] = useState(null);

    // Location Autocomplete states/refs
    const [citySuggestions, setCitySuggestions] = useState([]);
    const [citySearchLoading, setCitySearchLoading] = useState(false);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const citySearchTimeoutRef = useRef(null);

    // Gallery Photo management states
    const [galleryPhotos, setGalleryPhotos] = useState([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [newPhotoFile, setNewPhotoFile] = useState(null);
    const [newPhotoPreview, setNewPhotoPreview] = useState(null);
    const [newPhotoCaption, setNewPhotoCaption] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [updateStatus, setUpdateStatus] = useState(null);

    // Storage calculation
    const [storageInfo, setStorageInfo] = useState({ totalKB: '0', itemCount: 0, cleared: false });

    const calculateStorage = () => {
        let total = 0;
        let count = localStorage.length;
        for (let x in localStorage) {
            if (localStorage.hasOwnProperty(x)) {
                total += (localStorage[x].length * 2);
            }
        }
        setStorageInfo({
            totalKB: (total / 1024).toFixed(1),
            itemCount: count,
            cleared: false
        });
    };

    useEffect(() => {
        calculateStorage();
    }, [activeView]);

    const handleClearCache = () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        const prefs = localStorage.getItem('coffeely_user_preferences');

        sessionStorage.clear();
        localStorage.clear();
        if (token) localStorage.setItem('token', token);
        if (userStr) localStorage.setItem('user', userStr);
        if (prefs) localStorage.setItem('coffeely_user_preferences', prefs);

        calculateStorage();
        setStorageInfo(prev => ({ ...prev, cleared: true }));
        setTimeout(() => {
            setStorageInfo(prev => ({ ...prev, cleared: false }));
        }, 3000);
    };

    const handleCheckUpdate = () => {
        setCheckingUpdate(true);
        setUpdateStatus(null);
        setTimeout(() => {
            setCheckingUpdate(false);
            setUpdateStatus({
                latest: true,
                message: `You're using the latest version of Coffeely (${APP_VERSION_TAG})!`
            });
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(r => r.update());
                }).catch(() => {});
            }
        }, 1200);
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (response.ok) {
                const updatedUser = { ...user, ...data.user, link: data.user.social_link };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                if (socket) {
                    socket.emit('active_status_changed');
                }
                alert('Profile updated successfully!');
                setActiveView('menu');
            } else {
                alert(data.error || 'Update failed!');
            }
        } catch (error) {
            console.error(error);
            alert(getFriendlyErrorMessage(error, null, 'Failed to update profile. Please check your connection.'));
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (!passwordData.currentPassword) {
            setPasswordError('Please enter your current password.');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters long.');
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('New password and confirm password do not match.');
            return;
        }

        setPasswordLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordSuccess('Password changed successfully!');
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => {
                    setActiveView('menu');
                }, 1800);
            } else {
                setPasswordError(data.error || 'Failed to update password.');
            }
        } catch (err) {
            setPasswordError('Server connection error. Please try again.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setCropModalData({
                imageSrc: reader.result,
                isCircular: true,
                title: "Set Profile Picture",
                onComplete: async ({ file: croppedFile }) => {
                    setCropModalData(null);
                    setUploading(true);
                    const uploadFormData = new FormData();
                    uploadFormData.append('profile_pic', croppedFile);
                    try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API}/upload/${user.id}`, {
                            method: 'POST',
                            body: uploadFormData,
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            const updatedUser = { ...user, profile_pic: data.imageUrl };
                            setUser(updatedUser);
                            localStorage.setItem('user', JSON.stringify(updatedUser));
                            if (socket) {
                                socket.emit('active_status_changed');
                            }
                            alert('Profile picture updated successfully!');
                        } else {
                            alert('Failed to upload profile picture.');
                        }
                    } catch (err) {
                        console.error(err);
                        alert(getFriendlyErrorMessage(err, null, 'Failed to upload profile picture. Please check your connection.'));
                    } finally {
                        setUploading(false);
                    }
                }
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
            window.location.href = window.location.origin + '/#home';
            window.location.reload();
        }
    };

    const handleDeleteAccount = async () => {
        const confirmDelete = window.confirm('WARNING: This will permanently delete your account, chats, and bookings.');
        if (confirmDelete) {
            try {
                const token = localStorage.getItem('token');
                await fetch(`${API}/users/${user.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.clear();
                setUser(null);
                alert('Account deleted forever.');
                setPage(PAGES.HOME);
            } catch (error) {
                console.error(error);
            }
        }
    };

    // Instagram / WhatsApp Settings APIs
    const fetchSavedPosts = async () => {
        setListLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/posts/saved`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setSavedPosts(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setListLoading(false);
        }
    };

    const fetchLikedPosts = async () => {
        setListLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/posts/liked`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setLikedPosts(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setListLoading(false);
        }
    };

    const fetchBlockedUsers = async () => {
        setListLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/blocked-users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setBlockedUsers(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setListLoading(false);
        }
    };

    const handleUnsave = async (postId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/posts/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ post_id: postId })
            });
            if (res.ok) {
                setSavedPosts(savedPosts.filter(p => p.id !== postId));
                setExpandedPost(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUnlike = async (postId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ post_id: postId })
            });
            if (res.ok) {
                setLikedPosts(likedPosts.filter(p => p.id !== postId));
                setExpandedPost(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUnblock = async (blockedId) => {
        if (!window.confirm('Are you sure you want to unblock this user?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/unblock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ blocked_id: blockedId })
            });
            if (res.ok) {
                setBlockedUsers(blockedUsers.filter(u => u.id !== blockedId));
                alert('User unblocked successfully!');
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Nominatim Location Autocomplete handler
    const handleCityChange = (val) => {
        setFormData(prev => ({ ...prev, city: val }));
        if (citySearchTimeoutRef.current) clearTimeout(citySearchTimeoutRef.current);
        if (!val.trim()) {
            setCitySuggestions([]);
            return;
        }

        setCitySearchLoading(true);
        citySearchTimeoutRef.current = setTimeout(() => {
            const query = encodeURIComponent(val + ', India');
            fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=5`, {
                headers: { 'User-Agent': 'CoffeelyApp/2.4' }
            })
            .then(res => res.json())
            .then(data => {
                const mapped = data.map(item => ({
                    label: item.display_name.split(',')[0],
                    description: item.display_name.split(',').slice(1).join(',').trim(),
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                }));
                setCitySuggestions(mapped);
                setCitySearchLoading(false);
                setShowCitySuggestions(true);
            })
            .catch(() => {
                setCitySearchLoading(false);
            });
        }, 600);
    };

    // Gallery Photo management handlers
    const fetchGalleryPhotos = async () => {
        setGalleryLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/posts/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setGalleryPhotos(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setGalleryLoading(false);
        }
    };

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewPhotoFile(file);
            setNewPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleUploadPhoto = async (e) => {
        e.preventDefault();
        if (!newPhotoFile) return;
        setIsUploadingPhoto(true);

        const uploadData = new FormData();
        uploadData.append('post_image', newPhotoFile);
        uploadData.append('caption', newPhotoCaption);
        uploadData.append('show_on_feed', true);
        uploadData.append('show_on_profile', true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/posts/${user.id}`, {
                method: 'POST',
                body: uploadData,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                alert('Photo uploaded to gallery successfully!');
                setNewPhotoFile(null);
                setNewPhotoPreview(null);
                setNewPhotoCaption('');
                fetchGalleryPhotos();
            } else {
                const errData = await response.json();
                alert(errData.error || 'Upload failed.');
            }
        } catch (err) {
            alert('Upload failed. Try again.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleDeletePhoto = async (postId) => {
        if (!window.confirm('Are you sure you want to delete this photo?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setGalleryPhotos(galleryPhotos.filter(p => p.id !== postId));
                alert('Photo deleted.');
            }
        } catch (err) {
            console.error('Delete photo error:', err);
        }
    };

    const isGirl = user.role === 'girl';

    // Settings Filter Logic for Search
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = (terms) => {
        if (!searchLower) return true;
        return terms.some(t => t.toLowerCase().includes(searchLower));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-[#141426] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]">

                {/* ─── Top Header ─── */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#141426]/95 backdrop-blur-xl z-20">
                    <div className="flex items-center gap-3">
                        {activeView !== 'menu' && (
                            <button 
                                onClick={() => setActiveView('menu')} 
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition"
                            >
                                ←
                            </button>
                        )}
                        <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                            {activeView === 'menu' && (
                                <span className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${currentAccent.bg} animate-pulse`}></span>
                                    Settings
                                </span>
                            )}
                            {activeView === 'edit_profile' && 'Edit Profile'}
                            {activeView === 'change_password' && 'Password & Security'}
                            {activeView === 'privacy' && 'Privacy & Permissions'}
                            {activeView === 'appearance' && 'Chats & Appearance'}
                            {activeView === 'notifications' && 'Notifications & Sounds'}
                            {activeView === 'storage' && 'Storage & Data'}
                            {activeView === 'manage_gallery' && 'My Gallery'}
                            {activeView === 'saved_posts' && 'Saved Posts'}
                            {activeView === 'liked_posts' && 'Liked Posts'}
                            {activeView === 'blocked_accounts' && 'Blocked Accounts'}
                            {activeView === 'safety' && 'Safety & Emergency'}
                            {activeView === 'app_version' && 'App Version & Updates'}
                            {activeView === 'danger' && 'Delete Account'}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
                    >
                        ✕
                    </button>
                </div>

                {/* ─── Body Content ─── */}
                <div className="overflow-y-auto custom-scrollbar flex-1 pb-4">

                    {/* ══════════ 1. MAIN MENU VIEW ══════════ */}
                    {activeView === 'menu' && (
                        <div className="p-4 space-y-4">

                            {/* ── Hero Profile Card (Instagram / WhatsApp Profile Card) ── */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A32] to-[#121224] p-4 border border-white/10 shadow-lg">
                                <div className="flex items-center gap-3.5">
                                    {/* Avatar with Story gradient ring */}
                                    <div className="relative shrink-0">
                                        <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#f9ce3f] via-[#e1306c] to-[#833ab4]">
                                            <div className="w-full h-full rounded-full overflow-hidden bg-[#16162A] flex items-center justify-center">
                                                {user?.profile_pic ? (
                                                    <img src={user.profile_pic} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <FiUser size={26} className="text-white/70" />
                                                )}
                                            </div>
                                        </div>
                                        <label 
                                            className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${currentAccent.bg} text-white flex items-center justify-center cursor-pointer shadow-md border-2 border-[#141426] hover:scale-110 transition`}
                                            title="Change photo"
                                        >
                                            {uploading ? <FiLoader className="animate-spin" size={10} /> : <FiCamera size={10} />}
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                                        </label>
                                    </div>

                                    {/* User Details */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-base font-bold text-white truncate">{user.name}</h3>
                                            {user.kyc_status === 'verified' && (
                                                <span className="text-sky-400 shrink-0" title="Verified User">✓</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 font-medium truncate">
                                            @{user.username || user.name?.toLowerCase().replace(/\s+/g, '')}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                                isGirl 
                                                    ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' 
                                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                            }`}>
                                                {isGirl ? 'Companion' : 'Client'}
                                            </span>
                                            <button 
                                                onClick={() => setActiveView('edit_profile')}
                                                className="text-[11px] font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 transition"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Live Search Bar (WhatsApp / Instagram settings search) ── */}
                            <div className="relative">
                                <FiSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search settings (e.g. password, privacy, theme)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500/50 transition"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* ── Category 1: Account & Security ── */}
                            {matchesSearch(['account', 'profile', 'password', 'security', 'pin', 'edit']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Account & Security</span>
                                        <FiShield size={12} className="text-indigo-400" />
                                    </div>
                                    
                                    <button onClick={() => setActiveView('edit_profile')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                                                <FiUser size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Edit Profile Details</p>
                                                <p className="text-[10px] text-gray-400">Name, bio, hourly rate, location & tags</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>

                                    <button onClick={() => setActiveView('change_password')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center text-white shadow-sm">
                                                <FiKey size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Password & Security</p>
                                                <p className="text-[10px] text-gray-400">Update login password & security info</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>
                                </div>
                            )}

                            {/* ── Category 2: Privacy (WhatsApp Style) ── */}
                            {matchesSearch(['privacy', 'active', 'online', 'seen', 'receipts', 'call', 'block', 'private']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Privacy & Permissions</span>
                                        <FiLock size={12} className="text-emerald-400" />
                                    </div>

                                    <button onClick={() => setActiveView('privacy')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
                                                <FiLock size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Privacy Controls</p>
                                                <p className="text-[10px] text-gray-400">Active status, read receipts, profile lock</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>

                                    <button onClick={() => { setActiveView('blocked_accounts'); fetchBlockedUsers(); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-500 to-rose-600 flex items-center justify-center text-white shadow-sm">
                                                <FiSlash size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Blocked Accounts</p>
                                                <p className="text-[10px] text-gray-400">Manage blocked profiles & unblock</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>
                                </div>
                            )}

                            {/* ── Category 3: Chats & Appearance (Instagram / WhatsApp style) ── */}
                            {matchesSearch(['chat', 'theme', 'color', 'wallpaper', 'appearance', 'dark', 'font']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Chats & Appearance</span>
                                        <span className={`w-2 h-2 rounded-full ${currentAccent.bg}`}></span>
                                    </div>

                                    <button onClick={() => setActiveView('appearance')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-sm">
                                                <FiMessageCircle size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Theme & Wallpaper</p>
                                                <p className="text-[10px] text-gray-400">Accent colors, chat wallpapers & bubble style</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-3 h-3 rounded-full ${currentAccent.bg} shadow-sm`}></span>
                                            <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* ── Category 4: Notifications & Sounds ── */}
                            {matchesSearch(['notification', 'sound', 'ringtone', 'bell', 'alert']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Notifications & Alerts</span>
                                        <FiBell size={12} className="text-amber-400" />
                                    </div>

                                    <button onClick={() => setActiveView('notifications')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
                                                <FiBell size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Notification Preferences</p>
                                                <p className="text-[10px] text-gray-400">Message tones, call ringtone, booking alerts</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>
                                </div>
                            )}

                            {/* ── Category 5: Storage & Data (WhatsApp Style) ── */}
                            {matchesSearch(['storage', 'data', 'cache', 'clear', 'memory', 'clean']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Storage & Data</span>
                                        <FiHardDrive size={12} className="text-sky-400" />
                                    </div>

                                    <button onClick={() => setActiveView('storage')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                                                <FiDatabase size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Storage Usage</p>
                                                <p className="text-[10px] text-gray-400">Manage storage & 1-click cache cleaner</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                                            <span>{storageInfo.totalKB} KB</span>
                                            <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* ── Category 6: My Activity (Instagram Style) ── */}
                            {matchesSearch(['activity', 'gallery', 'saved', 'liked', 'posts', 'photos']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>My Activity</span>
                                        <FiBookmark size={12} className="text-pink-400" />
                                    </div>

                                    <button onClick={() => { setActiveView('manage_gallery'); fetchGalleryPhotos(); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                                                <FiCamera size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Manage My Gallery</p>
                                                <p className="text-[10px] text-gray-400">Upload & manage photos on your profile</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>

                                    <button onClick={() => { setActiveView('saved_posts'); fetchSavedPosts(); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-sm">
                                                <FiBookmark size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Saved Posts</p>
                                                <p className="text-[10px] text-gray-400">Bookmarked photos and reels</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>

                                    <button onClick={() => { setActiveView('liked_posts'); fetchLikedPosts(); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-sm">
                                                <FiHeart size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Liked Posts</p>
                                                <p className="text-[10px] text-gray-400">Posts you have liked</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>
                                </div>
                            )}

                            {/* ── Category 7: Safety & SOS ── */}
                            {matchesSearch(['safety', 'sos', 'emergency', 'contacts', 'help']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Safety & Security</span>
                                        <FiShield size={12} className="text-red-400" />
                                    </div>

                                    <button onClick={() => setActiveView('safety')} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
                                                <FiShield size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">SOS & Emergency Contacts</p>
                                                <p className="text-[10px] text-gray-400">Safety shield, emergency contacts & guide</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>
                                </div>
                            )}

                            {/* ── Category 8: Support & About ── */}
                            {matchesSearch(['support', 'help', 'about', 'version', 'updates']) && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 space-y-0.5">
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                                        <span>Support & Info</span>
                                        <FiInfo size={12} className="text-gray-400" />
                                    </div>

                                    <button onClick={() => { onClose(); setPage(PAGES.HELP); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-gray-700 to-gray-800 flex items-center justify-center text-white shadow-sm">
                                                <FiHelpCircle size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">Help Center & FAQs</p>
                                                <p className="text-[10px] text-gray-400">Guides, safety tips & customer support</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>

                                    <button onClick={() => { onClose(); setPage(PAGES.ABOUT); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-gray-700 to-gray-800 flex items-center justify-center text-white shadow-sm">
                                                <FiInfo size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">About Coffeely</p>
                                                <p className="text-[10px] text-gray-400">Platform story & terms</p>
                                            </div>
                                        </div>
                                        <FiChevronRight size={15} className="text-gray-500 group-hover:text-white transition" />
                                    </button>

                                    <button onClick={() => { setActiveView('app_version'); setUpdateStatus(null); }} className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition flex items-center justify-between text-xs font-semibold text-gray-200 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-sm">
                                                <FiCheckCircle size={15} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-xs">App Version</p>
                                                <p className="text-[10px] text-gray-400">Check for updates & changelog</p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            {APP_VERSION_TAG}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* ── App Update Check ── */}
                            <div className="pt-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('check-for-coffeely-update', { detail: { manual: true } }));
                                    }} 
                                    className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-transparent hover:bg-white/10 rounded-xl transition flex items-center justify-between text-xs font-bold text-gray-200 border border-pink-500/20 active:scale-98"
                                >
                                    <div className="flex items-center gap-2">
                                        <FiRefreshCw size={14} className="text-pink-400" />
                                        <span>Check for App Updates</span>
                                    </div>
                                    <span className="text-[10px] bg-white/10 text-pink-300 font-mono px-2 py-0.5 rounded-full border border-pink-500/30">v{APP_VERSION}</span>
                                </button>
                            </div>

                            {/* ── Log Out & Danger Zone ── */}
                            <div className="space-y-2">
                                <button 
                                    onClick={handleLogout} 
                                    className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center justify-center gap-2 text-xs font-bold text-gray-300 hover:text-white border border-white/5"
                                >
                                    <FiLogOut size={15} className="text-pink-400" />
                                    <span>Log Out of @{user.username || user.name}</span>
                                </button>

                                <button 
                                    onClick={() => setActiveView('danger')} 
                                    className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition flex items-center justify-center gap-2 text-xs font-bold text-red-400 border border-red-500/20"
                                >
                                    <FiAlertTriangle size={14} />
                                    <span>Delete Account Permanently</span>
                                </button>
                            </div>

                        </div>
                    )}


                    {/* ══════════ 2. EDIT PROFILE VIEW ══════════ */}
                    {activeView === 'edit_profile' && (
                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div className="flex flex-col items-center mb-4">
                                <div className="relative w-24 h-24 mb-2">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-[#16162A] border-4 border-white/10 flex items-center justify-center shadow-xl">
                                        {user?.profile_pic ? (
                                            <img src={user.profile_pic} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <FiUser size={38} className="text-white/60" />
                                        )}
                                    </div>
                                    <label className={`absolute bottom-0 right-0 text-white w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition shadow-lg border-2 border-[#16162A] ${currentAccent.bg}`}>
                                        {uploading ? <FiLoader className="animate-spin" size={13} /> : <FiCamera size={13} />}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                                    </label>
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium">Tap camera icon to update avatar</span>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Username Handle</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">@</span>
                                    <input 
                                        type="text" 
                                        name="username" 
                                        value={formData.username} 
                                        onChange={(e) => {
                                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                                            setFormData({ ...formData, username: val });
                                        }} 
                                        required 
                                        placeholder="username"
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                    />
                                </div>
                                <span className="text-[10px] text-gray-500 block mt-1 ml-1">Lowercase letters, numbers, underscores and dots.</span>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Display Name</label>
                                <input 
                                    type="text" 
                                    name="name" 
                                    value={formData.name} 
                                    onChange={handleChange} 
                                    required 
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1 font-semibold">Age</label>
                                    <input 
                                        type="number" 
                                        name="age" 
                                        value={formData.age} 
                                        onChange={handleChange} 
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-xs text-gray-400 mb-1 font-semibold">City</label>
                                    <input 
                                        type="text" 
                                        name="city" 
                                        value={formData.city} 
                                        onChange={(e) => handleCityChange(e.target.value)} 
                                        onFocus={() => { if (citySuggestions.length > 0) setShowCitySuggestions(true); }}
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                    />
                                    {citySearchLoading && (
                                        <div className="absolute right-3 top-8 flex items-center">
                                            <div className="w-3.5 h-3.5 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
                                        </div>
                                    )}
                                    {showCitySuggestions && citySuggestions.length > 0 && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setShowCitySuggestions(false)} />
                                            <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-xl border border-white/10 shadow-2xl z-40 bg-[#0D0D1A] divide-y divide-white/5 scrollbar-thin">
                                                {citySuggestions.map((sug, i) => (
                                                    <div 
                                                        key={i}
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, city: sug.label + ', ' + sug.description }));
                                                            setShowCitySuggestions(false);
                                                        }}
                                                        className="px-3 py-2 hover:bg-white/5 cursor-pointer text-left transition"
                                                    >
                                                        <div className="text-xs font-bold text-white truncate">{sug.label}</div>
                                                        <div className="text-[10px] text-gray-500 truncate">{sug.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Hourly Rate (₹ / hr)</label>
                                <input 
                                    type="number" 
                                    name="price" 
                                    value={formData.price} 
                                    onChange={handleChange} 
                                    placeholder="e.g. 500" 
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Bio</label>
                                <textarea 
                                    name="bio" 
                                    value={formData.bio} 
                                    onChange={handleChange} 
                                    rows="3" 
                                    placeholder="Share a bit about yourself, interests, hobbies..."
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none resize-none focus:border-pink-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Activity Tags (comma separated)</label>
                                <input 
                                    type="text" 
                                    name="tags" 
                                    value={formData.tags} 
                                    onChange={handleChange} 
                                    placeholder="Coffee Date, Movies, City Walk, Events" 
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Social Link / Instagram</label>
                                <input 
                                    type="url" 
                                    name="link" 
                                    value={formData.link} 
                                    onChange={handleChange} 
                                    placeholder="https://instagram.com/yourhandle" 
                                    className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition" 
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading} 
                                className={`w-full py-3 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition mt-2 bg-gradient-to-r ${currentAccent.gradient}`}
                            >
                                {loading ? 'Saving Profile...' : 'Save Profile Changes'}
                            </button>
                        </form>
                    )}


                    {/* ══════════ 3. CHANGE PASSWORD VIEW ══════════ */}
                    {activeView === 'change_password' && (
                        <form onSubmit={handleChangePassword} className="p-5 space-y-4">
                            <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/10 text-xs text-gray-400 leading-relaxed">
                                <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                                    <FiLock size={14} className="text-indigo-400" /> Strong Password Policy
                                </p>
                                Keep your password at least 6 characters long and include numbers or symbols to protect your account.
                            </div>

                            {passwordError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
                                    <FiAlertTriangle size={15} className="shrink-0" />
                                    <span>{passwordError}</span>
                                </div>
                            )}

                            {passwordSuccess && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                                    <FiCheckCircle size={15} className="shrink-0" />
                                    <span>{passwordSuccess}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Current Password</label>
                                <div className="relative">
                                    <input 
                                        type={showPass.current ? 'text' : 'password'}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        placeholder="Enter current password"
                                        required
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition pr-10" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPass(p => ({ ...p, current: !p.current }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        {showPass.current ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">New Password</label>
                                <div className="relative">
                                    <input 
                                        type={showPass.next ? 'text' : 'password'}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="At least 6 characters"
                                        required
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition pr-10" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPass(p => ({ ...p, next: !p.next }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        {showPass.next ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Confirm New Password</label>
                                <div className="relative">
                                    <input 
                                        type={showPass.confirm ? 'text' : 'password'}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        placeholder="Repeat new password"
                                        required
                                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition pr-10" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        {showPass.confirm ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={passwordLoading}
                                className={`w-full py-3 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition mt-3 bg-gradient-to-r ${currentAccent.gradient} flex items-center justify-center gap-2`}
                            >
                                {passwordLoading ? (
                                    <>
                                        <FiLoader className="animate-spin" size={14} />
                                        <span>Updating Password...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiCheck size={15} />
                                        <span>Save New Password</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}


                    {/* ══════════ 4. PRIVACY & PERMISSIONS (WhatsApp Style) ══════════ */}
                    {activeView === 'privacy' && (
                        <div className="p-5 space-y-4">
                            {/* Private Account */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Private Account</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Only approved followers can view your gallery and posts</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        name="is_private" 
                                        checked={formData.is_private} 
                                        onChange={(e) => {
                                            const val = e.target.checked;
                                            setFormData(p => ({ ...p, is_private: val }));
                                        }} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* Active Online Status */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Show Active Status</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Allow other users to see when you're active & online</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        name="show_online" 
                                        checked={formData.show_online} 
                                        onChange={(e) => {
                                            const val = e.target.checked;
                                            setFormData(p => ({ ...p, show_online: val }));
                                        }} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* Read Receipts (WhatsApp Style) */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Read Receipts (Blue Ticks)</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Show when you have read messages and see when others read yours</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={preferences.readReceipts} 
                                        onChange={(e) => updatePreference('readReceipts', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* Call Privacy */}
                            <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                                <div>
                                    <div className="text-xs font-bold text-white">Who can call me (Voice & Video)</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Filter incoming calls to prevent unwanted requests</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button 
                                        type="button"
                                        onClick={() => updatePreference('callPrivacy', 'everyone')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                                            preferences.callPrivacy === 'everyone'
                                                ? `${currentAccent.bg} text-white border-transparent shadow-md`
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <FiGlobe size={13} />
                                        <span>Everyone</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => updatePreference('callPrivacy', 'booked_only')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                                            preferences.callPrivacy === 'booked_only'
                                                ? `${currentAccent.bg} text-white border-transparent shadow-md`
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <FiLock size={13} />
                                        <span>Booked Only</span>
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={handleSave}
                                disabled={loading}
                                className={`w-full py-3 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition mt-3 bg-gradient-to-r ${currentAccent.gradient}`}
                            >
                                {loading ? 'Saving Privacy...' : 'Save Privacy Changes'}
                            </button>
                        </div>
                    )}


                    {/* ══════════ 5. CHATS & APPEARANCE (Instagram / WhatsApp Style) ══════════ */}
                    {activeView === 'appearance' && (
                        <div className="p-5 space-y-5">

                            {/* Theme Accent Picker */}
                            <div>
                                <label className="block text-xs font-bold text-white mb-1.5">Theme Accent Color</label>
                                <p className="text-[11px] text-gray-400 mb-3">Personalize buttons, badges and glows across your experience</p>
                                <div className="grid grid-cols-5 gap-2">
                                    {THEME_ACCENTS.map(acc => (
                                        <button
                                            key={acc.id}
                                            onClick={() => updatePreference('themeAccent', acc.id)}
                                            className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition ${
                                                preferences.themeAccent === acc.id 
                                                    ? 'bg-white/10 border-white/40 scale-105 shadow-lg' 
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className={`w-7 h-7 rounded-full ${acc.bg} flex items-center justify-center text-white shadow-md`}>
                                                {preferences.themeAccent === acc.id && <FiCheck size={14} />}
                                            </div>
                                            <span className="text-[9px] font-semibold text-gray-300 text-center truncate w-full">{acc.name.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Chat Wallpapers Selector */}
                            <div>
                                <label className="block text-xs font-bold text-white mb-1.5">Chat Wallpaper</label>
                                <p className="text-[11px] text-gray-400 mb-3">Choose wallpaper ambiance for real-time messages</p>
                                <div className="space-y-2">
                                    {CHAT_WALLPAPERS.map(wp => (
                                        <button
                                            key={wp.id}
                                            onClick={() => updatePreference('chatWallpaper', wp.id)}
                                            className={`w-full p-3 rounded-2xl border transition flex items-center justify-between text-left ${
                                                preferences.chatWallpaper === wp.id
                                                    ? 'bg-white/10 border-pink-500/50 shadow-md'
                                                    : 'bg-white/[0.03] border-white/5 hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl ${wp.previewBg} border border-white/10 shadow-inner flex items-center justify-center`}>
                                                    <FiMessageCircle size={14} className="text-white/40" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white">{wp.name}</p>
                                                    <p className="text-[10px] text-gray-400">{wp.desc}</p>
                                                </div>
                                            </div>
                                            {preferences.chatWallpaper === wp.id && (
                                                <span className={`w-5 h-5 rounded-full ${currentAccent.bg} text-white flex items-center justify-center text-xs shadow`}>
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Enter is Send Toggle */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div>
                                    <div className="text-xs font-bold text-white">Enter is Send (Key Action)</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Pressing Enter key sends message instantly</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={preferences.enterIsSend} 
                                        onChange={(e) => updatePreference('enterIsSend', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* Saved Feedback toast */}
                            <div className="text-center text-[11px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                                <FiCheckCircle size={13} />
                                <span>Preferences saved automatically</span>
                            </div>

                        </div>
                    )}


                    {/* ══════════ 6. NOTIFICATIONS & SOUNDS (WhatsApp Style) ══════════ */}
                    {activeView === 'notifications' && (
                        <div className="p-5 space-y-4">
                            {/* In-app message notifications */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Message Alerts & Badges</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Show unread message badge count & popup banners</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={preferences.messageSounds} 
                                        onChange={(e) => updatePreference('messageSounds', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* Call Ringtone */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Incoming Call Ringtone</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Play audio chime when companion initiates audio/video call</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={preferences.callRingtone} 
                                        onChange={(e) => updatePreference('callRingtone', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* Booking & Escrow Alerts */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Booking & Escrow Updates</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Real-time notifications for payment release, deposits & dates</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={preferences.bookingAlerts} 
                                        onChange={(e) => updatePreference('bookingAlerts', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            <div className="text-center text-[11px] text-emerald-400 font-semibold flex items-center justify-center gap-1 pt-2">
                                <FiCheckCircle size={13} />
                                <span>Notification settings active</span>
                            </div>
                        </div>
                    )}


                    {/* ══════════ 7. STORAGE & DATA (WhatsApp Style) ══════════ */}
                    {activeView === 'storage' && (
                        <div className="p-5 space-y-4">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-left space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white">Local Storage Meter</span>
                                    <span className="text-xs font-mono font-bold text-sky-400">{storageInfo.totalKB} KB</span>
                                </div>

                                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-pink-500 w-[45%]" title="User & Auth Profile"></div>
                                    <div className="h-full bg-sky-500 w-[30%]" title="Chat Preferences"></div>
                                    <div className="h-full bg-emerald-500 w-[25%]" title="Temporary Feed Cache"></div>
                                </div>

                                <div className="grid grid-cols-3 text-[10px] text-gray-400 pt-1">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Profile</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span> Settings</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Cache</span>
                                </div>
                            </div>

                            {/* Data Saver Mode */}
                            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <div className="pr-2">
                                    <div className="text-xs font-bold text-white">Low Data Saver Mode</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Compress thumbnails and limit background map pre-loading</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={preferences.dataSaver} 
                                        onChange={(e) => updatePreference('dataSaver', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className={`w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${currentAccent.bg}`}></div>
                                </label>
                            </div>

                            {/* 1-Click Clear Cache Button (WhatsApp Style) */}
                            <button
                                onClick={handleClearCache}
                                className="w-full py-3 px-4 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg"
                            >
                                <FiTrash2 size={14} />
                                <span>Clear Temporary Cache & Free Memory</span>
                            </button>

                            {storageInfo.cleared && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 animate-fade-in">
                                    <FiCheckCircle size={14} />
                                    <span>Temporary cache cleaned successfully!</span>
                                </div>
                            )}

                            <p className="text-[10px] text-gray-500 text-center leading-relaxed">
                                Clearing cache removes cached images and temporary feed memory. Your login session, active bookings, and profile will NOT be lost.
                            </p>
                        </div>
                    )}


                    {/* ══════════ 8. SAFETY & EMERGENCY (Coffeely Safety) ══════════ */}
                    {activeView === 'safety' && (
                        <div className="p-5 space-y-4">
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-left">
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <FiShield size={15} /> Safety First Guarantee
                                </h3>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    Coffeely provides instant SOS emergency triggers, GPS coordinate broadcast to verified guardians, and 24/7 dedicated support.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-white">Emergency SOS Trigger</p>
                                        <p className="text-[10px] text-gray-400">Available on every active booking screen</p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-red-500/20 text-red-400 font-bold text-[10px] rounded-full border border-red-500/30">
                                        ACTIVE
                                    </span>
                                </div>

                                <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-white">Escrow Protected Payments</p>
                                        <p className="text-[10px] text-gray-400">Funds released only after meeting completion</p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-bold text-[10px] rounded-full border border-emerald-500/30">
                                        PROTECTED
                                    </span>
                                </div>
                            </div>

                            <button 
                                onClick={() => { onClose(); setPage(PAGES.HELP); }}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition border border-white/10 flex items-center justify-center gap-2"
                            >
                                <FiHelpCircle size={14} />
                                <span>Read Full Safety & Community Guidelines</span>
                            </button>
                        </div>
                    )}


                    {/* ══════════ 9. GALLERY MANAGEMENT ══════════ */}
                    {activeView === 'manage_gallery' && (
                        <div className="p-4 space-y-4">
                            <form onSubmit={handleUploadPhoto} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 text-left">
                                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <FiPlus size={14} className={currentAccent.text} /> Add New Photo
                                </h3>

                                <div className="flex gap-3 items-center">
                                    {newPhotoPreview ? (
                                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10">
                                            <img src={newPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => { setNewPhotoFile(null); setNewPhotoPreview(null); }}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="w-16 h-16 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition shrink-0">
                                            <FiCamera size={18} className="text-gray-400" />
                                            <span className="text-[9px] text-gray-500 mt-1">Select</span>
                                            <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                                        </label>
                                    )}

                                    <div className="flex-1">
                                        <textarea
                                            placeholder="Write a caption..."
                                            value={newPhotoCaption}
                                            onChange={(e) => setNewPhotoCaption(e.target.value)}
                                            rows="2"
                                            className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none resize-none focus:border-pink-500 transition"
                                        />
                                    </div>
                                </div>

                                {newPhotoFile && (
                                    <button 
                                        type="submit" 
                                        disabled={isUploadingPhoto}
                                        className={`w-full py-2.5 text-white rounded-xl text-xs font-bold transition shadow-md bg-gradient-to-r ${currentAccent.gradient}`}
                                    >
                                        {isUploadingPhoto ? 'Uploading...' : 'Share to Gallery'}
                                    </button>
                                )}
                            </form>

                            <div className="border-t border-white/5 pt-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-left">
                                    Current Gallery ({galleryPhotos.length})
                                </h3>

                                {galleryLoading ? (
                                    <div className="text-center py-8 text-xs text-gray-500 animate-pulse">Loading gallery...</div>
                                ) : galleryPhotos.length === 0 ? (
                                    <div className="text-center py-8 text-xs text-gray-500">No photos in gallery yet. Upload one above!</div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {galleryPhotos.map(photo => (
                                            <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/5 group">
                                                <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => handleDeletePhoto(photo.id)}
                                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition duration-200"
                                                >
                                                    <FiTrash2 size={16} className="text-red-400 hover:scale-125 transition" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* ══════════ 10. SAVED POSTS ══════════ */}
                    {activeView === 'saved_posts' && (
                        <div className="p-4">
                            {listLoading ? (
                                <div className="text-center py-10 text-pink-500 animate-pulse text-sm">Loading saved posts...</div>
                            ) : savedPosts.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-xs flex flex-col items-center gap-2">
                                    <FiBookmark size={26} className="text-gray-600" />
                                    <span>No saved posts yet. Bookmarks will appear here.</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {savedPosts.map(post => (
                                        <div key={post.id} onClick={() => setExpandedPost({ ...post, type: 'saved' })} className="aspect-square cursor-pointer overflow-hidden border border-white/5 rounded-xl">
                                            <img src={post.image_url} alt="Saved" className="w-full h-full object-cover hover:brightness-75 transition duration-300" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                    {/* ══════════ 11. LIKED POSTS ══════════ */}
                    {activeView === 'liked_posts' && (
                        <div className="p-4">
                            {listLoading ? (
                                <div className="text-center py-10 text-pink-500 animate-pulse text-sm">Loading liked posts...</div>
                            ) : likedPosts.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-xs flex flex-col items-center gap-2">
                                    <FiHeart size={26} className="text-gray-600" />
                                    <span>No liked posts yet.</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {likedPosts.map(post => (
                                        <div key={post.id} onClick={() => setExpandedPost({ ...post, type: 'liked' })} className="aspect-square cursor-pointer overflow-hidden border border-white/5 rounded-xl">
                                            <img src={post.image_url} alt="Liked" className="w-full h-full object-cover hover:brightness-75 transition duration-300" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                    {/* ══════════ 12. BLOCKED ACCOUNTS ══════════ */}
                    {activeView === 'blocked_accounts' && (
                        <div className="p-4 space-y-2.5">
                            {listLoading ? (
                                <div className="text-center py-10 text-pink-500 animate-pulse text-sm">Loading blocked list...</div>
                            ) : blockedUsers.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-xs flex flex-col items-center gap-2">
                                    <FiSlash size={26} className="text-gray-600" />
                                    <span>No blocked accounts.</span>
                                </div>
                            ) : (
                                blockedUsers.map(u => (
                                    <div key={u.id} className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/10">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={u.profile_pic || 'https://cdn-icons-png.flaticon.com/512/3135/3135768.png'} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0" />
                                            <div className="min-w-0 flex-1 text-left">
                                                <p className="text-xs font-bold text-white truncate">{u.name}</p>
                                                <p className="text-[10px] text-gray-400 capitalize">{u.role}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleUnblock(u.id)} className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex-shrink-0">
                                            Unblock
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}


                    {/* ══════════ 13. APP VERSION & UPDATES ══════════ */}
                    {activeView === 'app_version' && (
                        <div className="p-5 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center text-3xl shadow-xl shadow-pink-500/25 mb-3">
                                ☕
                            </div>
                            <h3 className="text-xl font-extrabold text-white tracking-wide">Coffeely</h3>
                            <div className="flex items-center gap-2 mt-1 mb-4">
                                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    {APP_VERSION_TAG} • {APP_RELEASE_STAGE}
                                </span>
                            </div>

                            <div className="w-full bg-[#0D0D1A] rounded-2xl border border-white/5 p-4 text-left space-y-2.5 mb-4 text-xs">
                                <div className="flex justify-between items-center text-gray-400">
                                    <span>Running On</span>
                                    <span className="text-white font-semibold flex items-center gap-1.5">
                                        <FiSmartphone size={13} className="text-pink-400" /> {getAppPlatform()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-gray-400 border-t border-white/5 pt-2">
                                    <span>Release Date</span>
                                    <span className="text-white font-semibold">{APP_BUILD_DATE}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-400 border-t border-white/5 pt-2">
                                    <span>Status</span>
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                        <FiCheckCircle size={13} /> Up to Date (Latest)
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleCheckUpdate}
                                disabled={checkingUpdate}
                                className={`w-full py-3 px-4 bg-gradient-to-r ${currentAccent.gradient} hover:opacity-90 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 transition`}
                            >
                                <FiRefreshCw size={13} className={checkingUpdate ? 'animate-spin' : ''} />
                                {checkingUpdate ? 'Checking for updates...' : 'Check for Updates'}
                            </button>

                            {updateStatus && (
                                <div className="w-full mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 animate-fade-in">
                                    <FiCheckCircle size={14} className="shrink-0 text-emerald-400" />
                                    <span>{updateStatus.message}</span>
                                </div>
                            )}

                            <div className="w-full mt-5 text-left border-t border-white/10 pt-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">What's new in {APP_VERSION_TAG}</h4>
                                <div className="space-y-2">
                                    {APP_CHANGELOG[0]?.features.map((feat, idx) => (
                                        <div key={idx} className="text-[11px] text-gray-300 flex items-start gap-2 leading-relaxed">
                                            <span className="text-pink-400 font-bold">•</span>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}


                    {/* ══════════ 14. DANGER ZONE ══════════ */}
                    {activeView === 'danger' && (
                        <div className="p-5 space-y-4">
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-left">
                                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2 text-xs">
                                    <FiAlertTriangle size={15} /> Permanent Account Deletion
                                </h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Deleting your account is permanent. All your chats, gallery photos, reviews, bookmarks, and booking records will be erased from our database forever.
                                </p>
                            </div>
                            <button onClick={handleDeleteAccount} className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 transition text-xs">
                                Delete Account Permanently
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* ── Sub-view: Post detail expanded view ── */}
            {expandedPost && (
                <div className="fixed inset-0 bg-black/95 z-[150] flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in" onClick={() => setExpandedPost(null)}>
                    <button className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition">
                        ✕
                    </button>
                    <div className="max-w-md w-full bg-[#16162A] rounded-3xl border border-white/10 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 p-3.5 border-b border-white/5 bg-[#121222]">
                            <img src={expandedPost.user_pic || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} alt={expandedPost.user_name} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                            <div className="text-left">
                                <span className="font-bold text-xs text-white block">{expandedPost.user_name}</span>
                                <span className="text-gray-500 text-[10px] block capitalize">{expandedPost.user_role}</span>
                            </div>
                        </div>
                        <div className="aspect-square bg-black flex items-center justify-center">
                            <img src={expandedPost.image_url} alt="Expanded" className="w-full h-full object-contain" />
                        </div>
                        <div className="p-4 bg-[#16162A] text-left">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs text-gray-400 flex items-center gap-2">
                                    <span className="flex items-center gap-1"><FiHeart size={12} className="text-red-500 fill-red-500" /> {expandedPost.total_likes} Likes</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><FiMessageCircle size={12} className="text-gray-400" /> {expandedPost.total_comments} Comments</span>
                                </span>
                                {expandedPost.type === 'saved' ? (
                                    <button onClick={() => handleUnsave(expandedPost.id)} className="px-3 py-1 bg-pink-500/20 border border-pink-500/40 text-pink-400 hover:bg-pink-500 hover:text-white rounded-xl text-xs font-bold transition">
                                        Unsave Post
                                    </button>
                                ) : (
                                    <button onClick={() => handleUnlike(expandedPost.id)} className="px-3 py-1 bg-pink-500/20 border border-pink-500/40 text-pink-400 hover:bg-pink-500 hover:text-white rounded-xl text-xs font-bold transition">
                                        Unlike Post
                                    </button>
                                )}
                            </div>
                            {expandedPost.caption && (
                                <p className="text-gray-200 text-xs leading-relaxed mt-2 border-t border-white/5 pt-2">
                                    <span className="font-bold mr-2 text-pink-400">{expandedPost.user_name}</span>
                                    {expandedPost.caption}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {cropModalData && (
                <ImageCropperModal
                    imageSrc={cropModalData.imageSrc}
                    isCircular={cropModalData.isCircular}
                    title={cropModalData.title}
                    onCropComplete={cropModalData.onComplete}
                    onClose={() => setCropModalData(null)}
                />
            )}
        </div>
    );
}

export default SettingsModal;

import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./components/HomePage";
import AboutPage from "./components/AboutPage";
import HelpPage from "./components/HelpPage";
import GirlDashboard from "./components/girl/GirlDashboard";
import BoyDashboard from "./components/boy/BoyDashboard";
import AdminDashboard from "./components/AdminDashboard";
import FindPage from "./components/shared/FindPage";
import DetailsPage from "./components/shared/DetailsPage";
import ChatPage from "./components/shared/ChatPage";
import MessagesPage from "./components/shared/MessagesPage";
import UnifiedRegister from "./components/UnifiedRegister";
import UnifiedLogin from "./components/UnifiedLogin";
import NotificationsPage from "./components/NotificationsPage";
import LegalPages from "./components/shared/LegalPages";
import PWAInstallBanner from "./components/shared/PWAInstallBanner";
import AppUpdateModal from "./components/shared/AppUpdateModal";
import CallOverlay from "./components/shared/CallOverlay";
import GirlWalletTab from "./components/girl/GirlWalletTab";
import KYCUploadPrompt from "./components/shared/KYCUploadPrompt";
import OfflineBanner from "./components/shared/OfflineBanner";
import { registerPushNotifications } from "./utils/pushManager";
import { io } from "socket.io-client";

const socket = io("https://rentgf-and-bf.onrender.com", {
  transports: ['websocket'],
  auth: (cb) => {
    cb({ token: localStorage.getItem('token') });
  }
});

export const PAGES = {
  HOME: "home",
  ABOUT: "about",
  HELP: "help",
  GIRL_LOGIN: "girl_login",
  GIRL_REGISTER: "girl_register",
  GIRL_DASHBOARD: "girl_dashboard",
  BOY_LOGIN: "boy_login",
  BOY_REGISTER: "boy_register",
  BOY_DASHBOARD: "boy_dashboard",
  ADMIN_DASHBOARD: "admin_dashboard",
  FIND: "find",
  DETAILS: "details",
  CHAT: "chat",
  MESSAGES: "messages",
  NOTIFICATIONS: "notifications",
  LEGAL: "legal",
  WALLET: "wallet",
};

function App() {
  const [page, setPage] = useState(PAGES.HOME);
  const [selectedGirl, setSelectedGirl] = useState(null);
  const [girlUser, setGirlUser] = useState(null);
  const [boyUser, setBoyUser] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [globalAlert, setGlobalAlert] = useState(null);
  const [activeMessageAlert, setActiveMessageAlert] = useState(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    window.alert = (msg) => {
      setGlobalAlert({
        message: msg,
        type: 'alert',
        onConfirm: () => setGlobalAlert(null)
      });
    };

    window.showConfirm = (msg) => {
      return new Promise((resolve) => {
        setGlobalAlert({
          message: msg,
          type: 'confirm',
          onConfirm: () => {
            setGlobalAlert(null);
            resolve(true);
          },
          onCancel: () => {
            setGlobalAlert(null);
            resolve(false);
          }
        });
      });
    };
  }, []);

  // ── Server Wake-Up Ping (Render free tier sleeps after 15 min) ──
  useEffect(() => {
    const wakeUpServer = async () => {
      try {
        await fetch("https://rentgf-and-bf.onrender.com/", { method: "GET" });
      } catch (e) {
        // Silently ignore — just a wake-up ping
      }
    };
    wakeUpServer();
    // Ping every 10 minutes to keep server awake during active session
    const interval = setInterval(wakeUpServer, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash.replace("#", "");
      if (currentHash) {
        setPage(currentHash);
      } else {
        setPage(PAGES.HOME);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (window.location.hash !== `#${page}`) {
      window.history.pushState(null, "", `#${page}`);
    }
  }, [page]);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch("https://rentgf-and-bf.onrender.com/api/me", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          localStorage.setItem("user", JSON.stringify(userData));

          if (userData.role === "admin") {
            setAdminUser(userData);
            setPage(PAGES.ADMIN_DASHBOARD);
          } else if (userData.role === "boy") {
            setBoyUser(userData);
            setPage(PAGES.BOY_DASHBOARD);
          } else if (userData.role === "girl") {
            setGirlUser(userData);
            setPage(PAGES.GIRL_DASHBOARD);
          }
        } else if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      } catch (err) {
        console.warn("Session verification offline or server unreachable, attempting cached user fallback:", err);
        // If offline or network error, restore cached user so user is not forcibly logged out
        const cachedUserStr = localStorage.getItem("user");
        if (cachedUserStr) {
          try {
            const cachedUser = JSON.parse(cachedUserStr);
            if (cachedUser.role === "admin") {
              setAdminUser(cachedUser);
              setPage(PAGES.ADMIN_DASHBOARD);
            } else if (cachedUser.role === "boy") {
              setBoyUser(cachedUser);
              setPage(PAGES.BOY_DASHBOARD);
            } else if (cachedUser.role === "girl") {
              setGirlUser(cachedUser);
              setPage(PAGES.GIRL_DASHBOARD);
            }
          } catch (parseErr) { }
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    verifySession();
  }, []);

  const currentUser = boyUser || girlUser || adminUser;

  useEffect(() => {
    if (currentUser && socket) {
      socket.emit("user_connected", currentUser.id);
      socket.emit("join_own_room", currentUser.id);
      registerPushNotifications(currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !socket) return;

    let alertTimeout = null;

    const playMessageChime = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch (e) { }
    };

    const handleGlobalMessage = (data) => {
      // Ignore if we are the sender
      if (String(data.sender_id) === String(currentUser.id)) return;

      // Ignore if we are already viewing the chat page with this specific sender
      if (page === PAGES.CHAT && selectedGirl && String(selectedGirl.id) === String(data.sender_id)) {
        return;
      }

      // Play soft notification sound
      playMessageChime();

      // Show alert banner
      setActiveMessageAlert({
        sender_id: data.sender_id,
        sender_name: data.sender_name || 'Companion',
        sender_pic: data.sender_pic || '',
        text: data.text || 'Sent a message',
        userObj: {
          id: data.sender_id,
          name: data.sender_name || 'Companion',
          profile_pic: data.sender_pic || '',
          role: currentUser.role === 'girl' ? 'boy' : 'girl'
        }
      });

      // Clear previous timeout and set auto-dismiss after 4.5 seconds
      if (alertTimeout) clearTimeout(alertTimeout);
      alertTimeout = setTimeout(() => {
        setActiveMessageAlert(null);
      }, 4500);
    };

    socket.on("receive_message", handleGlobalMessage);
    return () => {
      socket.off("receive_message", handleGlobalMessage);
      if (alertTimeout) clearTimeout(alertTimeout);
    };
  }, [currentUser, page, selectedGirl]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center gap-6 text-white">
        <div className="relative">
          <svg className="w-16 h-16 drop-shadow-[0_0_12px_rgba(225,48,108,0.6)] animate-pulse" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 40H68C68 40 69 68 45 68C21 68 22 40 22 40Z" stroke="url(#loader-ai-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M68 45H75C80 45 83 48 83 53C83 58 80 61 75 61H66" stroke="url(#loader-ai-grad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18 75H72" stroke="url(#loader-ai-grad)" strokeWidth="6" strokeLinecap="round"/>
            <path d="M45 29C40 23 32 30 39 37L45 42L51 37C58 30 50 23 45 29Z" fill="url(#loader-ai-grad)"/>
            <path d="M31 27C30 24 31 21 33 19" stroke="url(#loader-ai-grad)" strokeWidth="4" strokeLinecap="round"/>
            <path d="M59 27C60 24 59 21 57 19" stroke="url(#loader-ai-grad)" strokeWidth="4" strokeLinecap="round"/>
            <defs>
              <linearGradient id="loader-ai-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f9ce3f" />
                <stop offset="0.5" stopColor="#e1306c" />
                <stop offset="1" stopColor="#833ab4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="text-base font-bold bg-gradient-to-r from-[#f9ce3f] via-[#e1306c] to-[#833ab4] bg-clip-text text-transparent animate-pulse tracking-wide">
          Loading your companion experience...
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case PAGES.HOME:
        return <HomePage setPage={setPage} currentUser={currentUser} setSelectedGirl={setSelectedGirl} />;
      case PAGES.ABOUT:
        return <AboutPage />;
      case PAGES.HELP:
        return <HelpPage />;
      case PAGES.MESSAGES:
        return currentUser ? <MessagesPage currentUser={currentUser} setPage={setPage} setSelectedGirl={setSelectedGirl} socket={socket} /> : <UnifiedLogin setPage={setPage} />;
      case PAGES.NOTIFICATIONS:
        return currentUser ? <NotificationsPage currentUser={currentUser} setPage={setPage} setSelectedGirl={setSelectedGirl} socket={socket} /> : <UnifiedLogin setPage={setPage} />;
      case PAGES.GIRL_LOGIN:
        return <UnifiedLogin setPage={setPage} setGirlUser={setGirlUser} setBoyUser={setBoyUser} setAdminUser={setAdminUser} defaultRole="girl" />;
      case PAGES.BOY_LOGIN:
        return <UnifiedLogin setPage={setPage} setGirlUser={setGirlUser} setBoyUser={setBoyUser} setAdminUser={setAdminUser} defaultRole="boy" />;
      case PAGES.GIRL_REGISTER:
      case PAGES.BOY_REGISTER:
        return <UnifiedRegister setPage={setPage} />;
      case PAGES.GIRL_DASHBOARD:
        return girlUser ? <GirlDashboard user={girlUser} setGirlUser={setGirlUser} setPage={setPage} socket={socket} setSelectedGirl={setSelectedGirl} /> : <UnifiedLogin setPage={setPage} setGirlUser={setGirlUser} setBoyUser={setBoyUser} defaultRole="girl" />;
      case PAGES.BOY_DASHBOARD:
        return (boyUser || adminUser) ? <BoyDashboard user={boyUser || adminUser} setBoyUser={setBoyUser} setPage={setPage} socket={socket} setSelectedGirl={setSelectedGirl} /> : <UnifiedLogin setPage={setPage} setGirlUser={setGirlUser} setBoyUser={setBoyUser} defaultRole="boy" />;
      case PAGES.ADMIN_DASHBOARD:
        return adminUser ? <AdminDashboard user={adminUser} setPage={setPage} /> : <UnifiedLogin setPage={setPage} />;
      case PAGES.FIND:
        return <FindPage setPage={setPage} setSelectedGirl={setSelectedGirl} currentUser={currentUser} />;
      case PAGES.DETAILS:
        return selectedGirl ? (
          <DetailsPage 
            girl={selectedGirl} 
            setPage={setPage} 
            currentUser={currentUser} 
            setSelectedGirl={setSelectedGirl} 
            onUpdateUser={(updated) => {
              if (currentUser?.role === 'girl') setGirlUser(updated);
              else setBoyUser(updated);
            }} 
          />
        ) : <FindPage setPage={setPage} setSelectedGirl={setSelectedGirl} currentUser={currentUser} />;
      case PAGES.CHAT:
        return selectedGirl ? <ChatPage girl={selectedGirl} currentUser={currentUser} setPage={setPage} setSelectedGirl={setSelectedGirl} /> : <FindPage setPage={setPage} setSelectedGirl={setSelectedGirl} currentUser={currentUser} />;
      case PAGES.WALLET: {
        const hasDoc = Boolean(currentUser?.id_proof_url || currentUser?.kyc_status === 'verified' || currentUser?.kyc_status === 'pending');
        return currentUser ? (
          !hasDoc ? (
            <div className="pt-20 pb-24 min-h-[100dvh] max-w-lg mx-auto px-4 flex flex-col items-center justify-center">
              <KYCUploadPrompt
                user={currentUser}
                onUploadSuccess={(updatedUser) => {
                  if (currentUser.role === 'girl') setGirlUser(updatedUser);
                  else setBoyUser(updatedUser);
                }}
                onCancel={() => setPage(PAGES.HOME)}
              />
            </div>
          ) : (
            <div className="pt-20 pb-24 min-h-[100dvh] max-w-4xl mx-auto px-4">
              <div className="mb-6 text-left">
                <h1 className="text-2xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
                  My Wallet & Earnings 💰
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">Manage your available balance, escrow holds, and instant payouts</p>
              </div>
              <GirlWalletTab user={currentUser} />
            </div>
          )
        ) : (
          <UnifiedLogin setPage={setPage} setGirlUser={setGirlUser} setBoyUser={setBoyUser} />
        );
      }
      case PAGES.LEGAL:
        return <LegalPages setPage={setPage} />;
      default:
        return <HomePage setPage={setPage} currentUser={currentUser} setSelectedGirl={setSelectedGirl} />;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black text-[#f5f5f5] overflow-x-hidden w-full relative">
      <OfflineBanner isOnline={isOnline} />
      <Navbar
        page={page}
        setPage={setPage}
        girlUser={girlUser}
        boyUser={boyUser}
        adminUser={adminUser}
        setGirlUser={setGirlUser}
        setBoyUser={setBoyUser}
        socket={socket}
      />
      {renderPage()}
      <PWAInstallBanner />
      <AppUpdateModal />
      {/* Instagram-Style Top Floating Message Alert Banner */}
      {activeMessageAlert && (
        <div 
          onClick={() => {
            setSelectedGirl(activeMessageAlert.userObj);
            setPage(PAGES.CHAT);
            setActiveMessageAlert(null);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] bg-[#121212]/90 backdrop-blur-md border border-[#262626] rounded-2xl p-3.5 flex items-center gap-3 shadow-2xl z-[10000] cursor-pointer hover:bg-[#1a1a1a]/95 active:scale-98 transition-all duration-300"
          style={{
            animation: "slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { transform: translate(-50%, -80px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>
          
          {/* Sender Avatar */}
          {activeMessageAlert.sender_pic ? (
            <img src={activeMessageAlert.sender_pic} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
              {activeMessageAlert.sender_name?.[0]?.toUpperCase()}
            </div>
          )}

          {/* Sender Details & Snippet */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-xs truncate">{activeMessageAlert.sender_name}</span>
              <span className="text-[8px] bg-[#0095f6] text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90">Message</span>
            </div>
            <p className="text-[11px] text-gray-300 truncate mt-0.5 pr-2 font-medium">
              {activeMessageAlert.text.startsWith('📞') ? '📞 Call log updated' : activeMessageAlert.text}
            </p>
          </div>

          {/* Quick Action Button: Reply */}
          <button 
            className="px-3.5 py-1.5 bg-[#0095f6] hover:bg-[#1877f2] text-white text-[10px] font-extrabold rounded-lg shadow-md shrink-0 transition"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGirl(activeMessageAlert.userObj);
              setPage(PAGES.CHAT);
              setActiveMessageAlert(null);
            }}
          >
            Reply
          </button>

          {/* Dismiss Icon */}
          <button 
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition shrink-0 ml-1"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMessageAlert(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      <CallOverlay socket={socket} currentUser={currentUser} />

      {/* Global Alert & Confirm Dialog (Instagram Style) */}
      {globalAlert && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-[#121212] w-full max-w-[280px] rounded-2xl border border-[#262626] overflow-hidden shadow-2xl flex flex-col items-center">
            <div className="px-6 py-6 flex flex-col items-center text-center">
              <p className="text-sm text-gray-200 font-medium leading-relaxed break-words w-full">{globalAlert.message}</p>
            </div>
            <div className="w-full flex flex-col divide-y divide-[#262626] border-t border-[#262626]">
              {globalAlert.type === 'confirm' ? (
                <>
                  <button
                    onClick={globalAlert.onConfirm}
                    className="w-full py-3.5 text-center text-sm font-bold text-[#0095f6] hover:bg-white/5 active:bg-white/10 transition outline-none"
                  >
                    OK
                  </button>
                  <button
                    onClick={globalAlert.onCancel}
                    className="w-full py-3.5 text-center text-sm font-medium text-gray-400 hover:bg-white/5 active:bg-white/10 transition outline-none"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={globalAlert.onConfirm}
                  className="w-full py-3.5 text-center text-sm font-bold text-[#0095f6] hover:bg-white/5 active:bg-white/10 transition outline-none"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
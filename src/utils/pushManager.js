// Helper to convert base64 VAPID key to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";

export const registerPushNotifications = async (currentUser) => {
    if (!currentUser) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log("Push notifications not supported on this browser.");
        return;
    }

    try {
        // Register Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Fetch VAPID Public Key from backend
        const keyRes = await fetch(`${API_BASE}/api/push/vapid-key`);
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        // Check permission
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            console.log("Notification permission not granted.");
            return;
        }

        // Subscribe to PushManager
        const existingSubscription = await registration.pushManager.getSubscription();
        let subscription = existingSubscription;

        if (!subscription) {
            const convertedKey = urlBase64ToUint8Array(publicKey);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey
            });
        }

        // Send subscription to backend
        const token = localStorage.getItem("token");
        if (token && subscription) {
            await fetch(`${API_BASE}/api/push/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ subscription })
            });
            console.log(" Web Push Notification subscription active!");
        }
    } catch (err) {
        console.error("Push registration error:", err);
    }
};

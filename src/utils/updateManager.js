import { APP_VERSION } from "../config/version";

/**
 * Compare two semver strings: e.g. "2.4.3" > "2.4.2"
 * Returns true if remote is strictly newer than local.
 */
export function isVersionHigher(remote, local) {
    if (!remote || !local) return false;
    const rParts = String(remote).replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    const lParts = String(local).replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(rParts.length, lParts.length);
    for (let i = 0; i < maxLen; i++) {
        const r = rParts[i] || 0;
        const l = lParts[i] || 0;
        if (r > l) return true;
        if (r < l) return false;
    }
    return false;
}

/**
 * Fetch latest version metadata from public endpoint
 */
export async function fetchLatestVersionInfo() {
    const endpoints = [
        `https://coffeely-app.vercel.app/version.json?t=${Date.now()}`,
        `/version.json?t=${Date.now()}`
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                cache: "no-store",
                headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.version) {
                    return data;
                }
            }
        } catch (e) {
            // Try next endpoint
        }
    }

    // Fallback: GitHub Releases API
    try {
        const ghRes = await fetch("https://api.github.com/repos/Priyanshu-kumar-maurya/companion-app/releases/latest", {
            cache: "no-store"
        });
        if (ghRes.ok) {
            const release = await ghRes.json();
            const tag = release.tag_name ? release.tag_name.replace(/^v/i, "") : null;
            if (tag) {
                return {
                    version: tag,
                    releaseTitle: release.name || `Coffeely v${tag} Update`,
                    releaseNotes: release.body ? release.body.split("\n").filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim()) : ["Performance improvements and bug fixes"],
                    apkDownloadUrl: "https://github.com/Priyanshu-kumar-maurya/companion-app/releases/latest/download/coffeely.apk",
                    webUrl: "https://coffeely-app.vercel.app",
                    mandatory: false
                };
            }
        }
    } catch (e) {
        // Fallback failed
    }

    return null;
}

/**
 * Check if an update is available compared to local APP_VERSION
 */
export async function checkForAppUpdate() {
    const latest = await fetchLatestVersionInfo();
    if (!latest) {
        return { hasUpdate: false, latestInfo: null, currentVersion: APP_VERSION };
    }

    const hasUpdate = isVersionHigher(latest.version, APP_VERSION);
    return {
        hasUpdate,
        latestInfo: latest,
        currentVersion: APP_VERSION
    };
}

/**
 * Trigger the appropriate update action based on platform
 */
export function executeAppUpdate(latestInfo) {
    const isNativeAndroid = Boolean(
        (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
        /android/i.test(navigator.userAgent || "")
    );

    const apkUrl = (latestInfo && latestInfo.apkDownloadUrl) || 
        "https://github.com/Priyanshu-kumar-maurya/companion-app/releases/latest/download/coffeely.apk";

    if (isNativeAndroid) {
        // Trigger direct APK download for Android
        const a = document.createElement("a");
        a.href = apkUrl;
        a.download = "coffeely.apk";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        // Web / PWA: Clear cache and reload
        if ('caches' in window) {
            caches.keys().then((names) => {
                names.forEach((name) => caches.delete(name));
            });
        }
        window.location.reload(true);
    }
}

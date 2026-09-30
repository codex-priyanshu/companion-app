/**
 * Centralized error handler and message translator for Coffeely.
 * Differentiates network/offline errors, validation errors, and server errors.
 */

export function isNetworkError(error) {
    // In browser or Capacitor WebView, check if strictly offline
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
        return true;
    }
    if (!error) return false;
    const msg = String(error.message || error || '').toLowerCase();
    return (
        error.name === 'TypeError' ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('err_internet_disconnected') ||
        msg.includes('err_connection_refused') ||
        msg.includes('err_network_changed') ||
        msg.includes('connection refused')
    );
}

export function isTimeoutError(error) {
    if (!error) return false;
    const msg = String(error.message || error || '').toLowerCase();
    return error.name === 'AbortError' || msg.includes('timeout') || msg.includes('timed out');
}

/**
 * Returns a friendly, accurate error message for any situation.
 * @param {Error|null} error - The JavaScript catch error object
 * @param {object|string|null} responseData - The JSON parsed response body from server (if any)
 * @param {string} fallbackMsg - Default message if nothing specific is found
 */
export function getFriendlyErrorMessage(error, responseData = null, fallbackMsg = "Something went wrong. Please try again.") {
    // 1. If server sent a specific error message, that ALWAYS takes priority!
    // (If we received responseData from the server, we obviously connected to the server)
    if (responseData) {
        if (typeof responseData === 'string' && responseData.trim()) {
            return responseData.trim();
        }
        if (responseData.error && typeof responseData.error === 'string') {
            return responseData.error.trim();
        }
        if (responseData.message && typeof responseData.message === 'string') {
            return responseData.message.trim();
        }
    }

    // 2. Check for offline / network disconnection
    if (isNetworkError(error)) {
        return "No internet connection. Please check your mobile data or Wi-Fi and try again.";
    }

    // 3. Check for connection timeout / cold start delay
    if (isTimeoutError(error)) {
        return "Connection timed out. The server is taking longer than usual to respond. Please try again.";
    }

    // 4. Default fallback (clean, professional)
    return fallbackMsg;
}

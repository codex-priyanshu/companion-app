// Robust In-Memory Rate Limiter with Proxy Support & Standard RateLimit Headers

const rateLimitMap = new Map();

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.socket?.remoteAddress || req.ip || 'unknown';
};

const rateLimiter = (maxRequests = 60, windowMs = 60 * 1000, customMessage = null) => {
    return (req, res, next) => {
        const ip = getClientIp(req);
        const now = Date.now();
        // Differentiate buckets by IP and route prefix
        const routePrefix = req.baseUrl || req.path || '';
        const key = `${ip}:${routePrefix}`;

        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, { count: 1, firstRequest: now });
            res.setHeader('RateLimit-Limit', maxRequests);
            res.setHeader('RateLimit-Remaining', maxRequests - 1);
            return next();
        }

        const entry = rateLimitMap.get(key);

        // Reset window if elapsed
        if (now - entry.firstRequest > windowMs) {
            entry.count = 1;
            entry.firstRequest = now;
            res.setHeader('RateLimit-Limit', maxRequests);
            res.setHeader('RateLimit-Remaining', maxRequests - 1);
            return next();
        }

        // Increment count
        entry.count += 1;
        const remaining = Math.max(0, maxRequests - entry.count);
        const resetSeconds = Math.ceil((windowMs - (now - entry.firstRequest)) / 1000);

        res.setHeader('RateLimit-Limit', maxRequests);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', resetSeconds);

        if (entry.count > maxRequests) {
            return res.status(429).json({
                error: customMessage || "Too many requests. Please slow down and try again later.",
                retryAfterSeconds: resetSeconds
            });
        }

        next();
    };
};

// Cleanup stale entries every 3 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now - entry.firstRequest > 5 * 60 * 1000) {
            rateLimitMap.delete(key);
        }
    }
}, 3 * 60 * 1000);

module.exports = rateLimiter;

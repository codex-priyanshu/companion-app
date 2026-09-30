// middleware/sanitize.js - XSS & Injection Prevention: strips dangerous HTML/script tags, null bytes, and malicious payloads

const DANGEROUS_PATTERNS = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /data\s*:\s*text\/html/gi,
    /vbscript\s*:/gi,
    /expression\s*\(/gi,
    /<svg[\s\S]*?>[\s\S]*?<\/svg>/gi
];

function sanitizeString(value) {
    if (typeof value !== 'string') return value;
    let clean = value.replace(/[\0\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    for (const pattern of DANGEROUS_PATTERNS) {
        clean = clean.replace(pattern, '');
    }
    return clean;
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'string') return sanitizeString(item);
            if (typeof item === 'object' && item !== null) return sanitizeObject(item);
            return item;
        });
    }
    const cleaned = {};
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string') cleaned[key] = sanitizeString(val);
        else if (Array.isArray(val)) cleaned[key] = val.map(i => typeof i === 'string' ? sanitizeString(i) : (typeof i === 'object' && i !== null ? sanitizeObject(i) : i));
        else if (typeof val === 'object' && val !== null) cleaned[key] = sanitizeObject(val);
        else cleaned[key] = val;
    }
    return cleaned;
}

const sanitizeInputs = (req, res, next) => {
    if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body);
    if (req.query && typeof req.query === 'object') req.query = sanitizeObject(req.query);
    if (req.params && typeof req.params === 'object') req.params = sanitizeObject(req.params);
    next();
};

module.exports = sanitizeInputs;

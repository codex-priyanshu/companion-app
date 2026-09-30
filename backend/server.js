const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
const compression = require('compression');
require('dotenv').config();

const { connectDB } = require('./config/db');
const socketHandler = require('./socket/socket');
const rateLimiter = require('./middleware/rateLimiter');
const sanitizeInputs = require('./middleware/sanitize');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const sosRoutes = require('./routes/sosRoutes');
const storyRoutes = require('./routes/storyRoutes');
const { router: pushRoutes } = require('./routes/pushRoutes');
const webrtcRoutes = require('./routes/webrtcRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const server = http.createServer(app);

// ─── Allowed Origins (CORS Whitelist) ────────────────────────
const ALLOWED_ORIGINS = [
    'https://coffeely-app.vercel.app',
    'https://rentgf-app.vercel.app',
    'https://companion-app-jade.vercel.app',
    'https://companion-app.vercel.app',
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
];

const isAllowedOrigin = (origin) => {
    // Allow requests with no origin (native mobile apps, PWA standalone, server-to-server)
    if (!origin) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    // Allow native Capacitor / Android / iOS WebViews
    if (
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('https://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('https://127.0.0.1')
    ) {
        return true;
    }
    // Allow only verified project Vercel deployments (prevents foreign *.vercel.app malicious sites)
    const isProjectVercel = /^https:\/\/(coffeely|rentgf|companion-app)(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isProjectVercel) return true;
    return false;
};

const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked: ${origin}`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
};

// ─── Socket.IO with strict CORS ───────────────────────────────
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Socket CORS blocked: ${origin}`));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
    }
});
socketHandler(io);

// ─── Redis Adapter for Multi-Instance Socket.IO Clustering ───
if (process.env.REDIS_URL) {
    try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const Redis = require('ioredis');
        const pubClient = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        });
        const subClient = pubClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        console.log('⚡ Redis Adapter connected: Multi-instance Socket.IO clustering enabled');
    } catch (err) {
        console.warn('⚠️ Redis adapter setup skipped/failed:', err.message);
    }
}

// ─── Performance & Compression ─────────────────────────────────
app.use(compression());

// ─── Security Middleware ───────────────────────────────────────

// 1. Helmet — sets 30+ HTTP security headers automatically
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://i.pinimg.com', 'blob:'],
            connectSrc: ["'self'", 'https://rentgf-and-bf.onrender.com', 'wss://rentgf-and-bf.onrender.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        }
    },
    crossOriginEmbedderPolicy: false, // needed for media
}));

// 2. CORS
app.use(cors(corsOptions));
app.options('/{*splat}', cors(corsOptions)); // preflight

// 3. Request size limits — 5MB for JSON, 10MB for files
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 4. XSS Input Sanitization — strips <script>, onclick=, javascript: etc.
app.use(sanitizeInputs);

// 5. Global Rate Limiter: 120 requests per minute per IP
app.use(rateLimiter(120, 60 * 1000));

// 6. Hide server technology info & add extra security headers
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
});

// 7. Prevent parameter pollution (duplicate query params)
app.use((req, res, next) => {
    for (const key of Object.keys(req.query)) {
        if (Array.isArray(req.query[key])) {
            req.query[key] = req.query[key][0]; // take first value only
        }
    }
    next();
});

// ─── Database ─────────────────────────────────────────────────
connectDB();

// ─── Routes ───────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', bookingRoutes);
app.use('/api', postRoutes);
app.use('/api', adminRoutes);
app.use('/api', chatRoutes);
app.use('/api', sosRoutes);
app.use('/api', storyRoutes);
app.use('/api', pushRoutes);
app.use('/api', webrtcRoutes);

// 🛡️ Dedicated rate limiting on financial & payment operations (25 req/min)
const paymentRateLimit = rateLimiter(25, 60 * 1000, "Too many payment or wallet attempts. Please wait a minute.");
app.use('/api/payment', paymentRateLimit);
app.use('/api/wallet', paymentRateLimit);
app.use('/api', paymentRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Coffeely Secure Backend running.' });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    // Suppress sensitive error stack traces
    console.error("Security/Server Unhandled Error:", err.message);
    if (err.message && err.message.startsWith('CORS')) {
        return res.status(403).json({ error: "CORS: Origin not allowed." });
    }
    res.status(500).json({ error: "Internal server error." });
});

// ─── Multi-Core Process Clustering & Server Launch ─────────────
const cluster = require('cluster');
const os = require('os');

const numWorkers = parseInt(process.env.WEB_CONCURRENCY || '0', 10) || (process.env.CLUSTER_MODE === 'true' ? os.cpus().length : 1);

const startServer = () => {
    const PORT = process.env.PORT || 5000;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 30000;

    server.listen(PORT, () => {
        console.log(`🛡️ Coffeely Hardened Server (pid: ${process.pid}) running on port ${PORT}`);
    });
};

// ─── Graceful Shutdown & DB Connection Drain ───────────────────
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 ${signal} received. Draining pool and closing server (pid: ${process.pid})...`);
    server.close(async () => {
        try {
            const { pool } = require('./config/db');
            await pool.end();
            console.log('✅ PostgreSQL connection pool drained.');
        } catch (e) {
            console.error('⚠️ Error closing pool:', e.message);
        }
        process.exit(0);
    });
    setTimeout(() => {
        console.error('⚠️ Force terminating after shutdown timeout.');
        process.exit(1);
    }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (cluster.isPrimary && numWorkers > 1) {
    console.log(`🚀 Primary process ${process.pid} running. Forking ${numWorkers} worker processes across CPU cores...`);
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.warn(`⚠️ Worker ${worker.process.pid} exited (${signal || code}). Spawning replacement...`);
        cluster.fork();
    });
} else {
    startServer();
}

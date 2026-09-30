const { Pool } = require('pg');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
    try {
        const parsedUrl = new URL(connectionString);
        parsedUrl.searchParams.set('sslmode', 'verify-full');
        parsedUrl.searchParams.set('usestdlibpqcompat', 'true');
        connectionString = parsedUrl.toString();
    } catch (e) {
        if (!connectionString.includes('usestdlibpqcompat=true')) {
            const separator = connectionString.includes('?') ? '&' : '?';
            connectionString = `${connectionString}${separator}sslmode=verify-full&usestdlibpqcompat=true`;
        }
    }
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_POOL_MAX || '25', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '8000', 10),
    allowExitOnIdle: false
});

pool.on('error', (err) => {
    console.error('⚠️ Unexpected error on idle PostgreSQL client:', err.message || err);
});

const connectDB = async () => {
    try {
        await pool.connect();
        console.log('✅ PostgreSQL Connected Successfully');

        // Auto-fix tables
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online BOOLEAN DEFAULT true;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction VARCHAR(20);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'unverified';");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS id_proof_url TEXT;");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for INTEGER[] DEFAULT '{}';");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR(10);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP;");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sender_id INTEGER;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_link TEXT;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_blocked BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dob VARCHAR(20);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;");
        await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_on_feed BOOLEAN DEFAULT true;");
        await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_on_profile BOOLEAN DEFAULT true;");
        await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS followers_only BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS disable_comments BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_likes BOOLEAN DEFAULT false;");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS canceled_by VARCHAR(10);");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_date DATE;");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_time TIME;");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_by VARCHAR(10);");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_status VARCHAR(20) DEFAULT 'none';");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_slot VARCHAR(50);");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100);");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS order_id VARCHAR(100);");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'upi';");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0;");
        await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS companion_earnings DECIMAL(10, 2) DEFAULT 0;");
        await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;");
        await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS compliment_tags TEXT[];");
        await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified_booking BOOLEAN DEFAULT true;");
        await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;");
        
        // --- Security & Account Lockout Columns ---
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_otp_attempts INTEGER DEFAULT 0;");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(60);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;");
        
        // --- Username Column Migration & Unique Constraint ---
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);");
        const checkNullUsernames = await pool.query("SELECT id, name FROM users WHERE username IS NULL OR username = '';");
        for (const u of checkNullUsernames.rows) {
            let baseUsername = u.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!baseUsername) baseUsername = `user${u.id}`;
            let isUnique = false;
            let tempUsername = baseUsername;
            let counter = 1;
            while (!isUnique) {
                const checkDup = await pool.query("SELECT id FROM users WHERE username = $1 AND id != $2;", [tempUsername, u.id]);
                if (checkDup.rows.length === 0) {
                    isUnique = true;
                } else {
                    tempUsername = `${baseUsername}${counter}`;
                    counter++;
                }
            }
            await pool.query("UPDATE users SET username = $1 WHERE id = $2;", [tempUsername, u.id]);
        }
        await pool.query("ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username);").catch(() => {});
        await pool.query("UPDATE users SET is_verified = true WHERE is_verified IS NULL;").catch(() => {});
        await pool.query("UPDATE users SET is_frozen = false WHERE is_frozen IS NULL;").catch(() => {});
        await pool.query("UPDATE users SET is_platform_blocked = false WHERE is_platform_blocked IS NULL;").catch(() => {});

        // Saved posts table
        await pool.query(`CREATE TABLE IF NOT EXISTS saved_posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id)
        );`);

        // Block/Report tables
        await pool.query(`CREATE TABLE IF NOT EXISTS blocked_users (
            id SERIAL PRIMARY KEY,
            blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(blocker_id, blocked_id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            reported_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reason TEXT NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            boy_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            girl_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            hours INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            meeting_date DATE,
            meeting_time TIME,
            meeting_location TEXT,
            meeting_details TEXT
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS likes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS follows (
            id SERIAL PRIMARY KEY,
            follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(follower_id, following_id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            companion_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS emergency_contacts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            email VARCHAR(255),
            relationship VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS sos_alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            message TEXT,
            status VARCHAR(20) DEFAULT 'active',
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS call_history (
            id SERIAL PRIMARY KEY,
            caller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            call_type VARCHAR(10) DEFAULT 'voice',
            duration_seconds INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS stories (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            media_url TEXT NOT NULL,
            caption TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS story_views (
            id SERIAL PRIMARY KEY,
            story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
            viewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(story_id, viewer_id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            companion_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, companion_id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL,
            keys_p256dh TEXT NOT NULL,
            keys_auth TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, endpoint)
        );`);

        // ─── Wallet Balances Table ─────────────────────────────────
        await pool.query(`CREATE TABLE IF NOT EXISTS wallet_balances (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
            available_balance DECIMAL(10, 2) DEFAULT 0,
            pending_escrow DECIMAL(10, 2) DEFAULT 0,
            total_withdrawn DECIMAL(10, 2) DEFAULT 0,
            total_earned DECIMAL(10, 2) DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        // ─── Wallet Transactions Table ─────────────────────────────
        await pool.query(`CREATE TABLE IF NOT EXISTS wallet_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
            type VARCHAR(30) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            title VARCHAR(255),
            description TEXT,
            status VARCHAR(30) DEFAULT 'completed',
            method VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

        // ─── Payout / Withdrawal Requests Table ────────────────────
        await pool.query(`CREATE TABLE IF NOT EXISTS payout_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL,
            payout_method VARCHAR(30) NOT NULL,
            upi_id VARCHAR(100),
            account_holder_name VARCHAR(100),
            account_number VARCHAR(50),
            ifsc_code VARCHAR(30),
            status VARCHAR(30) DEFAULT 'pending',
            reference_id VARCHAR(100),
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP
        );`);

        // ─── Performance Indexes ───────────────────────────────────
        await pool.query("CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_favorites_companion ON favorites(companion_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_call_history_caller ON call_history(caller_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_call_history_receiver ON call_history(receiver_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_users_kyc ON users(kyc_status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_boy ON bookings(boy_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_girl ON bookings(girl_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_wallet_balances_user ON wallet_balances(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);");
        await pool.query(`CREATE TABLE IF NOT EXISTS review_helpful_votes (
            id SERIAL PRIMARY KEY,
            review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(review_id, user_id)
        );`);

        // ─── Performance Indexes ───────────────────────────────────
        await pool.query("CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_favorites_companion ON favorites(companion_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_call_history_caller ON call_history(caller_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_call_history_receiver ON call_history(receiver_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_users_kyc ON users(kyc_status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_boy ON bookings(boy_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_girl ON bookings(girl_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_wallet_balances_user ON wallet_balances(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_reviews_companion ON reviews(companion_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_reviews_helpful ON review_helpful_votes(review_id, user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_sos_alerts_user ON sos_alerts(user_id);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);");

        // ─── High-Throughput Composite Indexes for Scale (100k+ Users) ───
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_chat_composite ON messages (sender_id, receiver_id, created_at);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_chat_rev_composite ON messages (receiver_id, sender_id, created_at);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (receiver_id, is_read);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);");
        await pool.query("CREATE INDEX IF NOT EXISTS idx_posts_feed_lookup ON posts (created_at DESC);");

        console.log('✅ Database Auto-Fixed: Tables & Indexes ready!');
    } catch (err) {
        console.error('❌ Database connection error:', err.stack);
    }
};

module.exports = { pool, connectDB };
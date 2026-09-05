/**
 * Mine Pool Game Server with Multiplayer Support
 * Features: Authentication, WebSocket, Matchmaking, Tournaments
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const { randomUUID: uuidv4 } = require('crypto');
const { OAuth2Client } = require('google-auth-library');

// Multiplayer modules
const { MultiplayerServer } = require('./multiplayer/WebSocketHandler');
const { TournamentManager } = require('./multiplayer/Tournament');
const { TournamentManager16, ENTRY_FEE_TIERS, TournamentState } = require('./multiplayer/Tournament16');
const { EloCalculator } = require('./multiplayer/MatchmakingQueue');

// Anti-fraud system

const app = express();
const PORT = process.env.PORT || 8000;

// Environment config
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRY = '7d';
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || '';
const googleOAuthClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID || undefined);
const authAttempts = new Map();

// Guest authentication requires no external provider.

// Persistent user storage
const DATA_DIR = process.env.MINEPOOL_DATA_DIR ? path.resolve(process.env.MINEPOOL_DATA_DIR) : path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DELETION_REQUESTS_FILE = path.join(DATA_DIR, 'deletion-requests.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load users from file or create default
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            const usersArray = JSON.parse(data);
            const usersMap = new Map();
            usersArray.forEach(user => {
                usersMap.set(user.email, user);
            });
            console.log(`📁 Loaded ${usersMap.size} users from persistent storage`);
            return usersMap;
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
    return null;
}

// Save users to file
function saveUsers() {
    try {
        const usersArray = Array.from(users.values());
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersArray, null, 2));
        console.log(`💾 Saved ${usersArray.length} users to persistent storage`);
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

function loadDeletionRequests() {
    try {
        if (fs.existsSync(DELETION_REQUESTS_FILE)) return JSON.parse(fs.readFileSync(DELETION_REQUESTS_FILE, 'utf8'));
    } catch (error) {
        console.error('Error loading deletion requests:', error);
    }
    return [];
}

function saveDeletionRequests() {
    fs.writeFileSync(DELETION_REQUESTS_FILE, JSON.stringify(deletionRequests, null, 2));
}

// Initialize users from persistent storage or create defaults
let users = loadUsers();
let deletionRequests = loadDeletionRequests();
let nextUserId = 1;

if (!users || users.size === 0) {
    users = new Map();
    // Sample users for testing
    const samplePasswordHash = bcrypt.hashSync('password123', 10);
    users.set('demo@example.com', {
        id: nextUserId++,
        username: 'DemoPlayer',
        email: 'demo@example.com',
        password: samplePasswordHash,
        provider: 'email',
        coins: 5000,
        elo: 1200,
        gamesPlayed: 10,
        gamesWon: 6,
        createdAt: new Date().toISOString(),
        achievements: [],
        matchHistory: [],
        nationality: 'TR',
        profilePicture: null
    });

    users.set('pro@example.com', {
        id: nextUserId++,
        username: 'PoolPro',
        email: 'pro@example.com',
        password: samplePasswordHash,
        provider: 'email',
        coins: 15000,
        elo: 1650,
        gamesPlayed: 50,
        gamesWon: 35,
        createdAt: new Date().toISOString(),
        achievements: ['first_win', 'ten_wins', 'streak_5', 'gold_rank'],
        matchHistory: [],
        nationality: 'US',
        profilePicture: null
    });
    saveUsers();
    console.log('📁 Created default users');
} else {
    // Find max user ID from loaded users
    for (const user of users.values()) {
        if (user.id >= nextUserId) {
            nextUserId = user.id + 1;
        }
    }
}

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Initialize multiplayer server with saveUsers callback
const multiplayer = new MultiplayerServer(io, users, saveUsers, JWT_SECRET);
const tournamentManager = new TournamentManager();
const tournament16Manager = new TournamentManager16();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('token');
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
};

// Set auth cookie
const setAuthCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

const publicUser = (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    provider: user.provider,
    profilePicture: user.profilePicture || null,
    coins: user.coins,
    diamonds: user.diamonds || 0,
    elo: user.elo,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    rank: EloCalculator.getRankFromElo(user.elo),
    profileComplete: user.profileComplete !== false,
    cues: user.cues || ['standard']
});

const issueSession = (res, user) => {
    const token = generateToken(user);
    setAuthCookie(res, token);
    return res.json({ success: true, token, user: publicUser(user) });
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const cleanUsername = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
const verifyGoogleIdToken = async (idToken) => {
    if (!GOOGLE_WEB_CLIENT_ID) throw new Error('Google sign-in is not configured');
    const ticket = await googleOAuthClient.verifyIdToken({ idToken: String(idToken || ''), audience: GOOGLE_WEB_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error('Google account could not be verified');
    return payload;
};
const authRateLimit = (req, res, next) => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const key = String(req.ip || req.socket.remoteAddress || 'unknown');
    const recent = (authAttempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= 20) return res.status(429).json({ success: false, error: 'Too many sign-in attempts. Try again later.' });
    recent.push(now);
    authAttempts.set(key, recent);
    next();
};

// ============ AUTH ROUTES ============

app.post('/api/auth/register', authRateLimit, async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const username = cleanUsername(req.body?.username);
        const password = String(req.body?.password || '');
        if (!validEmail(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address' });
        if (username.length < 3) return res.status(400).json({ success: false, error: 'Username must be 3-20 letters or numbers' });
        if (password.length < 8 || password.length > 128) return res.status(400).json({ success: false, error: 'Password must be 8-128 characters' });
        if (users.has(email)) return res.status(409).json({ success: false, error: 'An account already exists for this email' });
        for (const existing of users.values()) {
            if (String(existing.username).toLowerCase() === username.toLowerCase()) return res.status(409).json({ success: false, error: 'Username is already taken' });
        }
        const user = {
            id: nextUserId++, username, email, password: await bcrypt.hash(password, 12), provider: 'email',
            coins: 1000, diamonds: 0, elo: 1200, gamesPlayed: 0, gamesWon: 0,
            createdAt: new Date().toISOString(), achievements: [], matchHistory: [], nationality: null,
            profilePicture: null, profileComplete: true, cues: ['standard']
        };
        users.set(email, user);
        saveUsers();
        return issueSession(res, user);
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, error: 'Account could not be created' });
    }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');
        const user = users.get(email);
        const accepted = Boolean(user?.password) && await bcrypt.compare(password, user.password);
        if (!accepted) return res.status(401).json({ success: false, error: 'Email or password is incorrect' });
        return issueSession(res, user);
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, error: 'Sign-in failed' });
    }
});

app.post('/api/auth/google', authRateLimit, async (req, res) => {
    if (!GOOGLE_WEB_CLIENT_ID) return res.status(503).json({ success: false, error: 'Google sign-in is not configured on the server' });
    try {
        const idToken = String(req.body?.idToken || '');
        if (!idToken) return res.status(400).json({ success: false, error: 'Google ID token is required' });
        const payload = await verifyGoogleIdToken(idToken);
        const email = normalizeEmail(payload.email);
        let user = Array.from(users.values()).find((candidate) => candidate.googleSubject === payload.sub) || users.get(email);
        if (!user) {
            let username = cleanUsername(payload.name || email.split('@')[0]) || `Player${nextUserId}`;
            const base = username;
            let suffix = 1;
            while (Array.from(users.values()).some((candidate) => String(candidate.username).toLowerCase() === username.toLowerCase())) username = `${base.slice(0, 16)}${suffix++}`;
            user = {
                id: nextUserId++, username, email, provider: 'google', googleSubject: payload.sub,
                coins: 1000, diamonds: 0, elo: 1200, gamesPlayed: 0, gamesWon: 0,
                createdAt: new Date().toISOString(), achievements: [], matchHistory: [], nationality: null,
                profilePicture: payload.picture || null, profileComplete: true, cues: ['standard']
            };
        } else {
            const previousKey = Array.from(users.entries()).find(([, candidate]) => candidate === user)?.[0];
            if (previousKey && previousKey !== email) users.delete(previousKey);
            user.email = email;
            user.googleSubject = payload.sub;
            user.provider = user.provider === 'email' ? 'email+google' : 'google';
            user.profilePicture = payload.picture || user.profilePicture || null;
        }
        users.set(email, user);
        saveUsers();
        return issueSession(res, user);
    } catch (error) {
        console.warn('Rejected Google sign-in:', error.message);
        return res.status(401).json({ success: false, error: 'Google sign-in could not be verified' });
    }
});

// Frictionless guest sessions for embedded play.
app.post('/api/auth/guest-login', (req, res) => {
    const safeName = String(req.body?.username || 'Player').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'Player';
    const guestId = uuidv4();
    const email = `guest_${guestId}@minepool.local`;
    const user = { id: nextUserId++, username: safeName, email, provider: 'guest', coins: 1000, diamonds: 100, elo: 1200, gamesPlayed: 0, gamesWon: 0, createdAt: new Date().toISOString(), achievements: [], matchHistory: [], nationality: null, profilePicture: null, profileComplete: true, cues: ['standard'] };
    users.set(email, user); saveUsers();
    const token = generateToken(user); setAuthCookie(res, token);
    res.json({ success: true, token, user: publicUser(user) });
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = users.get(req.user.email);
    console.log(`📊 /api/auth/me called for: ${req.user.email}, found: ${!!user}, profileComplete: ${user?.profileComplete}`);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            coins: user.coins,
            elo: user.elo,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0,
            rank: EloCalculator.getRankFromElo(user.elo),
            achievements: user.achievements || [],
            createdAt: user.createdAt,
            nationality: user.nationality || null,
            profilePicture: user.profilePicture || null,
            profileComplete: user.profileComplete || false,
            cues: user.cues || [],
            cash: user.cash || 0
        }
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
});

// ============ PROFILE COMPLETION ============

// Complete profile (username, country, avatar)
app.post('/api/profile/complete', authenticateToken, (req, res) => {
    try {
        const { username, country, avatar } = req.body;
        const userEmail = req.user.email;

        if (!username || username.length < 3) {
            return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
        }

        if (username.length > 20) {
            return res.status(400).json({ success: false, error: 'Username must be 20 characters or less' });
        }

        // Check username uniqueness
        const normalizedUsername = username.toLowerCase();
        for (const [email, u] of users) {
            if (email !== userEmail && u.username.toLowerCase() === normalizedUsername) {
                return res.status(400).json({ success: false, error: 'Username already taken' });
            }
        }

        // Update user
        const user = users.get(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.username = username;
        user.nationality = country || null;
        user.avatar = avatar || '🎱';
        user.profileComplete = true;

        users.set(userEmail, user);
        saveUsers();

        console.log(`✅ Profile completed for: ${username} (email: ${userEmail}, profileComplete: ${user.profileComplete})`);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                nationality: user.nationality,
                avatar: user.avatar,
                profileComplete: user.profileComplete
            }
        });

    } catch (error) {
        console.error('Profile complete error:', error);
        res.status(500).json({ success: false, error: 'Failed to save profile' });
    }
});

// Change username
app.post('/api/profile/change-username', authenticateToken, (req, res) => {
    try {
        const { username } = req.body;
        const userEmail = req.user.email;

        // Validation
        if (!username || username.trim().length < 3) {
            return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
        }

        if (username.length > 20) {
            return res.status(400).json({ success: false, error: 'Username must be 20 characters or less' });
        }

        // Only allow alphanumeric, underscores and hyphens
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, underscores and hyphens' });
        }

        // Check username uniqueness
        const normalizedUsername = username.toLowerCase();
        for (const [email, u] of users) {
            if (email !== userEmail && u.username.toLowerCase() === normalizedUsername) {
                return res.status(400).json({ success: false, error: 'Username already taken' });
            }
        }

        // Get and update user
        const user = users.get(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const oldUsername = user.username;
        user.username = username;
        users.set(userEmail, user);
        saveUsers();

        console.log(`📝 Username changed: ${oldUsername} → ${username}`);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Change username error:', error);
        res.status(500).json({ success: false, error: 'Failed to change username' });
    }
});

// ============ REFERRAL SYSTEM ============

// Generate a unique referral code for a user
function generateReferralCode(user) {
    const base = user.username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4) || 'MINE';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${base}${random}`;
}

// Get or generate referral code
app.get('/api/referral/code', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Generate referral code if not exists
        if (!user.referralCode) {
            user.referralCode = generateReferralCode(user);
            users.set(req.user.email, user);
            saveUsers();
        }

        const referralLink = `${req.protocol}://${req.get('host')}/login.html?ref=${user.referralCode}`;

        res.json({
            success: true,
            referralCode: user.referralCode,
            referralLink: referralLink,
            referrals: user.referrals || [],
            totalReferrals: (user.referrals || []).length,
            totalEarnings: (user.referrals || []).length * 500
        });
    } catch (error) {
        console.error('Get referral code error:', error);
        res.status(500).json({ success: false, error: 'Failed to get referral code' });
    }
});

// Get referral statistics
app.get('/api/referral/stats', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const referrals = user.referrals || [];

        res.json({
            success: true,
            totalReferrals: referrals.length,
            referrals: referrals.map(r => ({
                username: r.username,
                joinedAt: r.joinedAt
            })),
            totalEarnings: referrals.length * 500
        });
    } catch (error) {
        console.error('Get referral stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get referral stats' });
    }
});

// ============ AVATAR UPLOAD ============

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        // Use timestamp for unique filename (user id will be added after auth)
        const filename = `avatar_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
        cb(null, filename);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
        }
    }
});

// Serve uploaded avatars statically
app.use('/uploads/avatars', express.static(uploadsDir));

// Upload avatar endpoint with error handling
app.post('/api/profile/avatar', authenticateToken, (req, res) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
            }
            return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const user = users.get(req.user.email);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            // Delete old avatar if exists
            if (user.profilePicture && user.profilePicture.startsWith('/uploads/avatars/')) {
                const oldPath = path.join(__dirname, user.profilePicture);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            // Save new avatar path
            const avatarUrl = `/uploads/avatars/${req.file.filename}`;
            user.profilePicture = avatarUrl;

            console.log('Avatar uploaded successfully:', avatarUrl);
            saveUsers(); // Persist avatar change

            res.json({
                success: true,
                avatarUrl: avatarUrl,
                message: 'Avatar uploaded successfully'
            });
        } catch (error) {
            console.error('Avatar upload error:', error);
            res.status(500).json({ success: false, error: 'Failed to upload avatar' });
        }
    });
});

// Delete avatar endpoint
app.delete('/api/profile/avatar', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Delete avatar file if exists
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/avatars/')) {
            const avatarPath = path.join(__dirname, user.profilePicture);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
        }

        user.profilePicture = null;
        saveUsers(); // Persist avatar removal

        res.json({
            success: true,
            message: 'Avatar removed successfully'
        });
    } catch (error) {
        console.error('Avatar delete error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete avatar' });
    }
});

// ============ OAUTH REMOVED ============
// Guest authentication requires no external provider.
// Google and Facebook OAuth routes have been removed

// ============ LEADERBOARD ============

app.get('/api/leaderboard', (req, res) => {
    try {
        const type = req.query.type || 'elo';
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        const players = Array.from(users.values())
            .filter(u => u.gamesPlayed > 0)
            .sort((a, b) => {
                if (type === 'wins') return (b.gamesWon || 0) - (a.gamesWon || 0);
                if (type === 'coins') return (b.coins || 0) - (a.coins || 0);
                if (type === 'winrate') {
                    const aRate = a.gamesPlayed ? a.gamesWon / a.gamesPlayed : 0;
                    const bRate = b.gamesPlayed ? b.gamesWon / b.gamesPlayed : 0;
                    return bRate - aRate;
                }
                return (b.elo || 1200) - (a.elo || 1200);
            })
            .slice(0, limit)
            .map((u, i) => ({
                rank: i + 1,
                username: u.username,
                elo: u.elo || 1200,
                wins: u.gamesWon || 0,
                games: u.gamesPlayed || 0,
                coins: u.coins || 0,
                winRate: u.gamesPlayed ? ((u.gamesWon / u.gamesPlayed) * 100).toFixed(1) : '0.0',
                rankInfo: EloCalculator.getRankFromElo(u.elo || 1200)
            }));

        res.json({ success: true, leaderboard: players, type });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, error: 'Failed to load leaderboard' });
    }
});

// ============ PLAYER PROFILE ============

app.get('/api/profile/:username', (req, res) => {
    try {
        const { username } = req.params;

        let targetUser = null;
        for (const user of users.values()) {
            if (user.username.toLowerCase() === username.toLowerCase()) {
                targetUser = user;
                break;
            }
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            profile: {
                username: targetUser.username,
                coins: targetUser.coins,
                elo: targetUser.elo,
                rank: EloCalculator.getRankFromElo(targetUser.elo),
                gamesPlayed: targetUser.gamesPlayed,
                gamesWon: targetUser.gamesWon,
                winRate: targetUser.gamesPlayed > 0
                    ? ((targetUser.gamesWon / targetUser.gamesPlayed) * 100).toFixed(1)
                    : 0,
                achievements: targetUser.achievements || [],
                createdAt: targetUser.createdAt
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to load profile' });
    }
});

// Update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { username, avatar, settings, nationality, profilePicture } = req.body;

        if (username && username !== user.username) {
            // Check if username is taken
            for (const u of users.values()) {
                if (u.username.toLowerCase() === username.toLowerCase() && u.id !== user.id) {
                    return res.status(400).json({ success: false, error: 'Username already taken' });
                }
            }
            user.username = username;
        }

        if (avatar) {
            user.avatar = avatar;
        }

        if (nationality !== undefined) {
            user.nationality = nationality;
        }

        if (profilePicture !== undefined) {
            user.profilePicture = profilePicture;
        }

        if (settings) {
            user.settings = { ...user.settings, ...settings };
        }

        saveUsers(); // Persist profile changes
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// ============ AI GAME RESULTS ============

// Report AI game result (for updating user stats after playing against AI)
app.post('/api/game/ai-result', authenticateToken, async (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { won, wager = 0, gameDuration = 0 } = req.body;

        // Validate
        if (typeof won !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Invalid game result' });
        }
        // Rate limit AI games (prevent farming) - max 20 games per hour
        const now = Date.now();
        const aiGameKey = `ai_${user.id}`;
        if (!user.aiGameHistory) user.aiGameHistory = [];

        // Clean old entries (older than 1 hour)  
        user.aiGameHistory = user.aiGameHistory.filter(t => now - t < 60 * 60 * 1000);

        if (user.aiGameHistory.length >= 20) {
            console.log(`🚫 AI game rate limit: ${user.username} played 20+ games in 1 hour`);
            return res.status(429).json({
                success: false,
                error: 'Too many games. Please take a break and try again later.'
            });
        }

        user.aiGameHistory.push(now);

        // Update stats
        user.gamesPlayed = (user.gamesPlayed || 0) + 1;

        let coinsChange = 0;

        if (won) {
            user.gamesWon = (user.gamesWon || 0) + 1;
            user.winStreak = (user.winStreak || 0) + 1;

            if (wager > 0) {
                // AI games give reduced rewards (50% of wager as winnings)
                coinsChange = Math.floor(wager * 0.5);
                user.coins = (user.coins || 0) + coinsChange;
                console.log(`🎮 AI Win: ${user.username} +${coinsChange} coins (50% of ${wager} wager)`);
            } else {
                // No wager = practice mode, small coin bonus
                coinsChange = 10;
                user.coins = (user.coins || 0) + coinsChange;
                console.log(`🎮 AI Practice Win: ${user.username} +${coinsChange} coins`);
            }
        } else {
            user.winStreak = 0;

            if (wager > 0) {
                // Losing against AI = no coin loss (it's practice with stakes display only)
                coinsChange = 0;
                console.log(`🎮 AI Loss: ${user.username} (no coin loss for AI games)`);
            } else {
                console.log(`🎮 AI Practice Loss: ${user.username}`);
            }
        }

        saveUsers();

        res.json({
            success: true,
            won,
            coinsChange,
            newBalance: user.coins || 0,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon || 0,
            winStreak: user.winStreak || 0
        });

    } catch (error) {
        console.error('AI game result error:', error);
        res.status(500).json({ success: false, error: 'Failed to record game result' });
    }
});

// ============ MATCH HISTORY ============

app.get('/api/matches', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const matches = (user.matchHistory || []).slice(0, limit);

        res.json({ success: true, matches });
    } catch (error) {
        console.error('Match history error:', error);
        res.status(500).json({ success: false, error: 'Failed to load match history' });
    }
});

// ============ ACHIEVEMENTS ============

app.get('/api/achievements', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const achievements = multiplayer.achievements.getPlayerAchievements(req.user.email);
        res.json({ success: true, ...achievements });
    } catch (error) {
        console.error('Achievements error:', error);
        res.status(500).json({ success: false, error: 'Failed to load achievements' });
    }
});


// ============ DAILY TASKS & REWARDS ============

// Claim daily reward
app.post('/api/rewards/claim', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { reward, day } = req.body;

        if (!reward || reward <= 0 || reward > 5000) {
            return res.status(400).json({ success: false, error: 'Invalid reward amount' });
        }

        // Add coins to user
        user.coins = (user.coins || 0) + reward;
        saveUsers();

        console.log("REWARD: " + user.username + " claimed daily reward: " + reward + " coins (Day " + day + ")");

        res.json({
            success: true,
            message: 'Reward claimed!',
            coins: user.coins,
            reward: reward
        });
    } catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({ success: false, error: 'Failed to claim reward' });
    }
});

// Claim task reward
app.post('/api/tasks/claim', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { taskId, reward } = req.body;

        if (!taskId || !reward || reward <= 0 || reward > 2000) {
            return res.status(400).json({ success: false, error: 'Invalid task or reward' });
        }

        // Initialize completedTasks if not exists
        if (!user.completedTasks) {
            user.completedTasks = [];
        }

        // Check if already claimed (except for repeatable tasks)
        if (taskId !== 'invite_friend' && user.completedTasks.includes(taskId)) {
            return res.status(400).json({ success: false, error: 'Task already claimed' });
        }

        // Mark task as completed
        if (!user.completedTasks.includes(taskId)) {
            user.completedTasks.push(taskId);
        }

        // Add coins to user
        user.coins = (user.coins || 0) + reward;
        saveUsers();

        console.log("TASK: " + user.username + " completed task: " + taskId + " (+" + reward + " coins)");

        res.json({
            success: true,
            message: 'Task reward claimed!',
            taskId: taskId,
            coins: user.coins,
            reward: reward
        });
    } catch (error) {
        console.error('Claim task error:', error);
        res.status(500).json({ success: false, error: 'Failed to claim task reward' });
    }
});

// Get completed tasks for user
app.get('/api/tasks', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            completedTasks: user.completedTasks || [],
            invitedFriends: user.invitedFriends || 0
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, error: 'Failed to get tasks' });
    }
});

// Process referral during registration
app.post('/api/referral/apply', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { referralCode } = req.body;

        if (!referralCode) {
            return res.status(400).json({ success: false, error: 'Referral code required' });
        }

        // Check if user already used a referral
        if (user.usedReferral) {
            return res.status(400).json({ success: false, error: 'Referral already applied' });
        }

        // Find the referrer by invite code
        let referrer = null;
        for (const u of users.values()) {
            if (u.inviteCode && u.inviteCode === referralCode) {
                referrer = u;
                break;
            }
        }

        if (!referrer) {
            return res.status(404).json({ success: false, error: 'Invalid referral code' });
        }

        if (referrer.email === user.email) {
            return res.status(400).json({ success: false, error: 'Cannot use your own code' });
        }

        // Award both users
        const referralBonus = 500;
        const referrerBonus = 1000;

        user.coins = (user.coins || 0) + referralBonus;
        user.usedReferral = referralCode;

        referrer.coins = (referrer.coins || 0) + referrerBonus;
        referrer.invitedFriends = (referrer.invitedFriends || 0) + 1;

        saveUsers();

        console.log("REFERRAL: " + user.username + " used referral from " + referrer.username);

        res.json({
            success: true,
            message: "You received " + referralBonus + " bonus coins!",
            bonus: referralBonus
        });
    } catch (error) {
        console.error('Apply referral error:', error);
        res.status(500).json({ success: false, error: 'Failed to apply referral' });
    }
});

// Generate/Get invite code for user
app.get('/api/invite-code', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Generate invite code if not exists
        if (!user.inviteCode) {
            const base = user.username.toUpperCase().substring(0, 4);
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            user.inviteCode = base + random;
            saveUsers();
        }

        res.json({
            success: true,
            inviteCode: user.inviteCode,
            invitedFriends: user.invitedFriends || 0
        });
    } catch (error) {
        console.error('Get invite code error:', error);
        res.status(500).json({ success: false, error: 'Failed to get invite code' });
    }
});



// ============ SHOP API ============

// Purchase a cue
app.post('/api/shop/purchase', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { cueId, price, currency } = req.body;

        if (!cueId || !price || !currency) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Check if user has enough currency
        const balance = currency === 'coins' ? (user.coins || 0) : (user.cash || 0);
        if (balance < price) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient ' + currency
            });
        }

        // Deduct the price
        if (currency === 'coins') {
            user.coins = (user.coins || 0) - price;
        } else {
            user.cash = (user.cash || 0) - price;
        }

        // Add cue to user's collection
        if (!user.cues) user.cues = [];
        if (!user.cues.includes(cueId)) {
            user.cues.push(cueId);
        }

        saveUsers();

        console.log("SHOP: " + user.username + " purchased " + cueId + " for " + price + " " + currency);

        res.json({
            success: true,
            message: 'Cue purchased successfully!',
            user: {
                username: user.username,
                coins: user.coins,
                cash: user.cash,
                cues: user.cues
            }
        });
    } catch (error) {
        console.error('Shop purchase error:', error);
        res.status(500).json({ success: false, error: 'Purchase failed' });
    }
});

// Get user's cues
app.get('/api/shop/cues', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            cues: user.cues || [],
            coins: user.coins || 0,
            cash: user.cash || 0
        });
    } catch (error) {
        console.error('Get cues error:', error);
        res.status(500).json({ success: false, error: 'Failed to get cues' });
    }
});

// ============ FRIENDS API ============

// Get user's friends list
app.get('/api/friends', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get friends list (or create empty if doesn't exist)
        const friendEmails = user.friends || [];

        // Build friends data with online status
        const friends = friendEmails.map(email => {
            const friend = users.get(email);
            if (!friend) return null;

            // Check if friend is online (connected via WebSocket)
            const isOnline = multiplayer.isUserOnline ? multiplayer.isUserOnline(email) : false;
            const isInGame = multiplayer.isUserInGame ? multiplayer.isUserInGame(email) : false;

            return {
                id: friend.id,
                name: friend.username,
                avatar: friend.profilePicture ? null : '??',
                avatarUrl: friend.profilePicture || null,
                status: isInGame ? 'ingame' : (isOnline ? 'online' : 'offline'),
                statusText: isInGame ? 'In Game' : (isOnline ? 'Online' : 'Offline'),
                elo: friend.elo,
                rank: EloCalculator.getRankFromElo(friend.elo)
            };
        }).filter(f => f !== null);

        res.json({ success: true, friends });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ success: false, error: 'Failed to get friends' });
    }
});

// Add a friend
app.post('/api/friends/add', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { friendEmail, friendUsername } = req.body;

        // Find friend by email or username
        let friend = null;
        if (friendEmail) {
            friend = users.get(friendEmail.toLowerCase());
        } else if (friendUsername) {
            for (const u of users.values()) {
                if (u.username.toLowerCase() === friendUsername.toLowerCase()) {
                    friend = u;
                    break;
                }
            }
        }

        if (!friend) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (friend.email === user.email) {
            return res.status(400).json({ success: false, error: 'Cannot add yourself' });
        }

        // Initialize friends array if needed
        if (!user.friends) user.friends = [];

        if (user.friends.includes(friend.email)) {
            return res.status(400).json({ success: false, error: 'Already friends' });
        }

        user.friends.push(friend.email);
        saveUsers();

        res.json({ success: true, message: `Added ${friend.username} as friend` });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ success: false, error: 'Failed to add friend' });
    }
});

// Remove a friend
app.delete('/api/friends/:friendId', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const friendId = parseInt(req.params.friendId);

        // Find friend by ID
        let friendEmail = null;
        for (const u of users.values()) {
            if (u.id === friendId) {
                friendEmail = u.email;
                break;
            }
        }

        if (!friendEmail || !user.friends || !user.friends.includes(friendEmail)) {
            return res.status(404).json({ success: false, error: 'Friend not found' });
        }

        user.friends = user.friends.filter(e => e !== friendEmail);
        saveUsers();

        res.json({ success: true, message: 'Friend removed' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove friend' });
    }
});

// ============ TOURNAMENTS ============

app.get('/api/tournaments', (req, res) => {
    try {
        const tournaments = tournamentManager.getActiveTournaments();
        res.json({ success: true, tournaments });
    } catch (error) {
        console.error('Tournaments error:', error);
        res.status(500).json({ success: false, error: 'Failed to load tournaments' });
    }
});

app.post('/api/tournaments', authenticateToken, (req, res) => {
    try {
        const { name, description, type, maxPlayers, entryFee } = req.body;

        const tournament = tournamentManager.createTournament({
            name: name || 'Pool Tournament',
            description,
            type: type || 'single_elimination',
            maxPlayers: maxPlayers || 8,
            entryFee: entryFee || 100
        });

        res.json({ success: true, tournament: tournament.toJSON() });
    } catch (error) {
        console.error('Create tournament error:', error);
        res.status(500).json({ success: false, error: 'Failed to create tournament' });
    }
});

app.post('/api/tournaments/:id/register', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const result = tournamentManager.registerPlayer(req.params.id, {
            id: user.id,
            username: user.username,
            elo: user.elo,
            coins: user.coins
        });

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Deduct entry fee
        const tournament = tournamentManager.getTournament(req.params.id);
        if (tournament) {
            user.coins -= tournament.entryFee;
        }

        res.json({ success: true, position: result.position });
    } catch (error) {
        console.error('Tournament registration error:', error);
        res.status(500).json({ success: false, error: 'Failed to register' });
    }
});

// ============ 16-PLAYER TOURNAMENTS ============

// Get available entry fee tiers
app.get('/api/tournaments16/tiers', (req, res) => {
    res.json({ success: true, tiers: ENTRY_FEE_TIERS });
});

// Get queue status for all tiers (how many players waiting in each queue)
app.get('/api/tournaments16/queues', (req, res) => {
    try {
        const queueStatus = tournament16Manager.getQueueStatus();
        res.json({ success: true, queues: queueStatus });
    } catch (error) {
        console.error('Queue status error:', error);
        res.status(500).json({ success: false, error: 'Failed to load queue status' });
    }
});

// Get all active 16-player tournaments (in progress)
app.get('/api/tournaments16', (req, res) => {
    try {
        const tournaments = tournament16Manager.getActiveTournaments();
        res.json({ success: true, tournaments });
    } catch (error) {
        console.error('16-Player tournaments error:', error);
        res.status(500).json({ success: false, error: 'Failed to load tournaments' });
    }
});

// Register to a queue for a specific tier
app.post('/api/tournaments16/queue/:tier/register', authenticateToken, (req, res) => {
    try {
        const tier = parseInt(req.params.tier);
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Validate tier
        if (!ENTRY_FEE_TIERS.includes(tier)) {
            return res.status(400).json({
                success: false,
                error: `Invalid tier. Must be one of: ${ENTRY_FEE_TIERS.join(', ')}`
            });
        }

        // Check coins
        if (user.coins < tier) {
            return res.status(400).json({
                success: false,
                error: `Insufficient coins. Need ${tier}, have ${user.coins}`
            });
        }

        const result = tournament16Manager.registerToQueue(tier, {
            id: user.id,
            username: user.username,
            elo: user.elo,
            coins: user.coins
        });

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Deduct entry fee immediately upon queue join
        user.coins -= tier;

        // Emit queue update
        io.emit('tournament16:queue_update', {
            tier,
            playersInQueue: tournament16Manager.getQueue(tier).players.length,
            maxPlayers: 16
        });

        // If tournament started, emit to all players
        if (result.tournamentStarted) {
            io.emit('tournament16:started', {
                tournamentId: result.tournamentId,
                tier,
                players: result.players,
                tournament: result.tournament
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Queue registration error:', error);
        res.status(500).json({ success: false, error: 'Failed to register' });
    }
});

// Leave queue
app.post('/api/tournaments16/queue/:tier/leave', authenticateToken, (req, res) => {
    try {
        const tier = parseInt(req.params.tier);
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const result = tournament16Manager.leaveQueue(tier, user.id);

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Refund entry fee
        user.coins += result.refund;

        // Emit queue update
        io.emit('tournament16:queue_update', {
            tier,
            playersInQueue: tournament16Manager.getQueue(tier).players.length,
            maxPlayers: 16
        });

        res.json({ success: true, refund: result.refund, newBalance: user.coins });
    } catch (error) {
        console.error('Queue leave error:', error);
        res.status(500).json({ success: false, error: 'Failed to leave queue' });
    }
});

// Check which queue player is in
app.get('/api/tournaments16/queue/status', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const queueInfo = tournament16Manager.getPlayerQueue(user.id);
        const tournamentInfo = tournament16Manager.getPlayerTournament(user.id);

        res.json({
            success: true,
            inQueue: queueInfo,
            inTournament: tournamentInfo ? {
                id: tournamentInfo.id,
                status: tournamentInfo.status,
                tier: tournamentInfo.entryFee
            } : null
        });
    } catch (error) {
        console.error('Queue status error:', error);
        res.status(500).json({ success: false, error: 'Failed to get status' });
    }
});

// Get specific tournament details
app.get('/api/tournaments16/:id', (req, res) => {
    try {
        const tournament = tournament16Manager.getTournament(req.params.id);
        if (!tournament) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }
        res.json({ success: true, tournament: tournament.toJSON() });
    } catch (error) {
        console.error('Tournament details error:', error);
        res.status(500).json({ success: false, error: 'Failed to load tournament' });
    }
});

// Get tournament bracket
app.get('/api/tournaments16/:id/bracket', (req, res) => {
    try {
        const tournament = tournament16Manager.getTournament(req.params.id);
        if (!tournament) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }
        res.json({
            success: true,
            bracket: tournament.getBracketInfo(),
            status: tournament.status,
            prizes: {
                totalPot: tournament.totalPot,
                winner: tournament.winnerPrize,
                runnerUp: tournament.runnerUpPrize
            }
        });
    } catch (error) {
        console.error('Tournament bracket error:', error);
        res.status(500).json({ success: false, error: 'Failed to load bracket' });
    }
});

// Register for 16-player tournament
app.post('/api/tournaments16/:id/register', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const tournament = tournament16Manager.getTournament(req.params.id);
        if (!tournament) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Atomic coin check before registration
        if (user.coins < tournament.entryFee) {
            return res.status(400).json({
                success: false,
                error: `Insufficient coins. Need ${tournament.entryFee}, have ${user.coins}`
            });
        }

        const result = tournament16Manager.registerPlayer(req.params.id, {
            id: user.id,
            username: user.username,
            elo: user.elo,
            coins: user.coins
        });

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Deduct entry fee
        user.coins -= tournament.entryFee;

        // Emit real-time update via WebSocket
        io.emit('tournament16:player_joined', {
            tournamentId: req.params.id,
            playerId: user.id,
            playerName: user.username,
            currentPlayers: tournament.players.length,
            maxPlayers: 16
        });

        // If tournament started, emit bracket update
        if (result.brackets) {
            io.emit('tournament16:started', {
                tournamentId: req.params.id,
                brackets: result.brackets,
                prizes: result.prizes
            });
        }

        res.json({
            success: true,
            position: result.position,
            playersNeeded: result.playersNeeded,
            tournamentStarted: !!result.brackets
        });
    } catch (error) {
        console.error('16-Player tournament registration error:', error);
        res.status(500).json({ success: false, error: 'Failed to register' });
    }
});

// Unregister from tournament
app.post('/api/tournaments16/:id/unregister', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const result = tournament16Manager.unregisterPlayer(req.params.id, user.id);

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Refund entry fee
        user.coins += result.refund;

        io.emit('tournament16:player_left', {
            tournamentId: req.params.id,
            playerId: user.id
        });

        res.json({ success: true, refund: result.refund });
    } catch (error) {
        console.error('Tournament unregister error:', error);
        res.status(500).json({ success: false, error: 'Failed to unregister' });
    }
});

// Report match result
app.post('/api/tournaments16/:id/match/:matchId/result', authenticateToken, (req, res) => {
    try {
        const { winnerId } = req.body;
        if (!winnerId) {
            return res.status(400).json({ success: false, error: 'Winner ID required' });
        }

        const result = tournament16Manager.reportMatchResult(
            req.params.id,
            req.params.matchId,
            winnerId
        );

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Emit bracket update
        io.emit('tournament16:match_completed', {
            tournamentId: req.params.id,
            matchId: req.params.matchId,
            winnerId,
            match: result.match
        });

        // If tournament complete, distribute prizes
        if (result.tournamentComplete) {
            const tournament = tournament16Manager.getTournament(req.params.id);

            // Award prizes
            for (const [email, user] of users) {
                if (user.id === result.winner.id) {
                    user.coins += result.prizes.winner.amount;
                } else if (user.id === result.runnerUp.id) {
                    user.coins += result.prizes.runnerUp.amount;
                }
            }

            io.emit('tournament16:finished', {
                tournamentId: req.params.id,
                winner: result.winner,
                runnerUp: result.runnerUp,
                prizes: result.prizes
            });
        }

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Match result error:', error);
        res.status(500).json({ success: false, error: 'Failed to report result' });
    }
});

// Handle walkover (disconnect)
app.post('/api/tournaments16/:id/match/:matchId/walkover', authenticateToken, (req, res) => {
    try {
        const { disconnectedPlayerId } = req.body;
        if (!disconnectedPlayerId) {
            return res.status(400).json({ success: false, error: 'Disconnected player ID required' });
        }

        const result = tournament16Manager.handleWalkover(
            req.params.id,
            req.params.matchId,
            disconnectedPlayerId
        );

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        io.emit('tournament16:walkover', {
            tournamentId: req.params.id,
            matchId: req.params.matchId,
            disconnectedPlayerId,
            winnerId: result.match.winner.id
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Walkover error:', error);
        res.status(500).json({ success: false, error: 'Failed to process walkover' });
    }
});

// ============ SERVER STATS ============

app.get('/api/stats', (req, res) => {
    try {
        const stats = multiplayer.getStats();
        res.json({
            success: true,
            stats: {
                ...stats,
                totalUsers: users.size,
                activeTournaments: tournamentManager.getActiveTournaments().length
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to load stats' });
    }
});




// ============ ADMIN DASHBOARD APIs ============

// Admin analytics overview
app.get('/api/admin/analytics/overview', (req, res) => {
    try {
        res.json({
            success: true,
            overview: {
                today: {
                    activeUsers: Array.from(users.values()).filter(u => u.lastLogin && new Date(u.lastLogin) > new Date(Date.now() - 86400000)).length,
                    newUsers: 0,
                    gamesPlayed: 0,
                    revenue: 0
                }
            }
        });
    } catch (error) {
        console.error('Admin analytics error:', error);
        res.status(500).json({ success: false, error: 'Failed to load analytics' });
    }
});

// Admin live games
app.get('/api/admin/games/live', (req, res) => {
    try {
        const stats = multiplayer.getStats ? multiplayer.getStats() : { activeGames: 0, games: [] };
        res.json({
            success: true,
            count: stats.activeGames || 0,
            games: []
        });
    } catch (error) {
        console.error('Admin games error:', error);
        res.status(500).json({ success: false, error: 'Failed to load games' });
    }
});

// Admin user stats
app.get('/api/admin/users/stats', (req, res) => {
    try {
        const allUsers = Array.from(users.values());
        res.json({
            success: true,
            stats: {
                totalUsers: allUsers.length,
                activeUsers: allUsers.filter(u => u.lastLogin && new Date(u.lastLogin) > new Date(Date.now() - 86400000)).length,
                bannedUsers: allUsers.filter(u => u.banned).length
            }
        });
    } catch (error) {
        console.error('Admin users stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to load user stats' });
    }
});

// Admin activity log
app.get('/api/admin/settings/activity', (req, res) => {
    try {
        res.json({
            success: true,
            logs: []
        });
    } catch (error) {
        console.error('Admin activity error:', error);
        res.status(500).json({ success: false, error: 'Failed to load activity' });
    }
});

// Admin users list
app.get('/api/admin/users', (req, res) => {
    try {
        const allUsers = Array.from(users.values()).map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            status: u.banned ? 'banned' : 'active',
            elo: u.elo || 1200,
            gamesPlayed: u.gamesPlayed || 0,
            wins: u.wins || 0,
            losses: u.losses || 0,
            coins: u.coins || 0
        }));
        res.json({ success: true, users: allUsers });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, error: 'Failed to load users' });
    }
});

// Admin moderation reports
app.get('/api/admin/moderation/reports', (req, res) => {
    try {
        res.json({ success: true, reports: [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load moderation reports' });
    }
});

app.get('/api/admin/moderation/reports/stats', (req, res) => {
    try {
        res.json({ success: true, stats: { open: 0, reviewing: 0, resolved: 0 } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load reports stats' });
    }
});

// Admin settings
app.get('/api/admin/settings', (req, res) => {
    try {
        res.json({
            success: true,
            settings: {
                game: {
                    physics: {
                        ballRadius: 12,
                        pocketRadius: 18,
                        cushionWidth: 20,
                        maxCueSpeed: 2000,
                        gravity: 0,
                        muRoll: 0.01,
                        muSlide: 0.2,
                        muSpin: 10,
                        eBall: 0.95,
                        eCushion: 0.75
                    },
                    gameplay: {
                        shotTimeLimit: 60,
                        breakTimeLimit: 90,
                        maxPower: 100,
                        enableSpin: true,
                        callPocket: false
                    },
                    economy: {
                        startingCoins: 1000,
                        minBet: 100,
                        maxBet: 50000,
                        winReward: 100
                    }
                },
                features: {
                    maintenance: false,
                    newUserRegistration: true,
                    chatEnabled: true,
                    tournamentMode: true
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load settings' });
    }
});

// Admin analytics endpoints
app.get('/api/admin/analytics/users', (req, res) => {
    res.json({ success: true, data: { activeUsers: [], newUsers: [] } });
});

app.get('/api/admin/analytics/games', (req, res) => {
    res.json({ success: true, data: { gamesPerDay: [], avgDuration: 300 } });
});

app.get('/api/admin/analytics/revenue', (req, res) => {
    res.json({ success: true, data: { totalRevenue: 0 } });
});

app.get('/api/admin/games/history', (req, res) => {
    res.json({ success: true, games: [] });
});

// ============ ADMIN AUTH ============

// Admin login - simple username/password verification
app.post('/api/admin/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;

        // Simple admin credentials (in production, use proper authentication)
        if (username === 'admin' && password === 'admin123') {
            res.json({
                success: true,
                token: 'admin-token-' + Date.now(),
                user: { username: 'admin', role: 'admin' }
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});
// ============ REPORTS & FEEDBACK API ============

const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

// Load reports from file
function loadReports() {
    try {
        if (fs.existsSync(REPORTS_FILE)) {
            const data = fs.readFileSync(REPORTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading reports:', error);
    }
    return [];
}

// Save reports to file
function saveReports(reports) {
    try {
        fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2));
    } catch (error) {
        console.error('Error saving reports:', error);
    }
}

let reports = loadReports();
let nextReportId = reports.length > 0 ? Math.max(...reports.map(r => r.id)) + 1 : 1;

// Submit a report (authenticated users)
app.post('/api/reports', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { type, subject, category, description, priority } = req.body;

        if (!type || !subject || !description) {
            return res.status(400).json({ success: false, error: 'Type, subject, and description are required' });
        }

        const report = {
            id: nextReportId++,
            type: type,
            subject: subject,
            category: category || 'other',
            description: description,
            priority: priority || 'low',
            status: 'open',
            userId: user.id,
            username: user.username,
            userEmail: user.email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            adminNotes: null,
            resolvedBy: null
        };

        reports.push(report);
        saveReports(reports);

        console.log('New ' + type + ': "' + subject + '" from ' + user.username);

        res.json({
            success: true,
            message: 'Report submitted successfully',
            reportId: report.id
        });
    } catch (error) {
        console.error('Submit report error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit report' });
    }
});

// Get all reports (for admin)
app.get('/api/admin/reports', (req, res) => {
    try {
        const { status, type, priority } = req.query;

        let filteredReports = [...reports];

        if (status && status !== 'all') {
            filteredReports = filteredReports.filter(r => r.status === status);
        }
        if (type && type !== 'all') {
            filteredReports = filteredReports.filter(r => r.type === type);
        }
        if (priority && priority !== 'all') {
            filteredReports = filteredReports.filter(r => r.priority === priority);
        }

        filteredReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            reports: filteredReports,
            stats: {
                total: reports.length,
                open: reports.filter(r => r.status === 'open').length,
                inProgress: reports.filter(r => r.status === 'in_progress').length,
                resolved: reports.filter(r => r.status === 'resolved').length,
                bugs: reports.filter(r => r.type === 'bug').length,
                features: reports.filter(r => r.type === 'feature').length
            }
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ success: false, error: 'Failed to get reports' });
    }
});

// Update report status (for admin)
app.patch('/api/admin/reports/:id', (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const report = reports.find(r => r.id === reportId);

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const { status, adminNotes, resolvedBy } = req.body;

        if (status) report.status = status;
        if (adminNotes !== undefined) report.adminNotes = adminNotes;
        if (resolvedBy) report.resolvedBy = resolvedBy;
        report.updatedAt = new Date().toISOString();

        saveReports(reports);

        console.log('Report #' + reportId + ' updated: status=' + (status || report.status));

        res.json({ success: true, report });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ success: false, error: 'Failed to update report' });
    }
});

// Delete report (for admin)
app.delete('/api/admin/reports/:id', (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const index = reports.findIndex(r => r.id === reportId);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        reports.splice(index, 1);
        saveReports(reports);

        console.log('Report #' + reportId + ' deleted');

        res.json({ success: true, message: 'Report deleted' });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete report' });
    }
});

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin', 'client')));
// ============ STATIC FILE SERVING ============

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

app.delete('/api/auth/account', authRateLimit, authenticateToken, async (req, res) => {
    try {
        if (String(req.body?.confirmation || '') !== 'DELETE') {
            return res.status(400).json({ success: false, error: 'Type DELETE to confirm permanent account deletion' });
        }
        const user = users.get(req.user.email);
        if (!user) return res.status(404).json({ success: false, error: 'Account not found' });

        let verified = false;
        if (user.password && req.body?.password) verified = await bcrypt.compare(String(req.body.password), user.password);
        if (!verified && user.googleSubject && req.body?.idToken) {
            const payload = await verifyGoogleIdToken(req.body.idToken);
            verified = payload.sub === user.googleSubject;
        }
        if (!verified) return res.status(401).json({ success: false, error: 'Re-authentication is required to delete this account' });

        if (user.profilePicture && user.profilePicture.startsWith('/uploads/avatars/')) {
            const avatarPath = path.join(uploadsDir, path.basename(user.profilePicture));
            if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        }
        users.delete(req.user.email);
        deletionRequests = deletionRequests.filter((request) => request.email !== req.user.email);
        saveUsers();
        saveDeletionRequests();
        multiplayer.matchmaking.setUsersData(Array.from(users.values()));
        res.clearCookie('token');
        return res.json({ success: true, message: 'Account and associated player data were permanently deleted' });
    } catch (error) {
        console.warn('Account deletion rejected:', error.message);
        return res.status(401).json({ success: false, error: 'Account deletion could not be verified' });
    }
});

app.post('/api/account-deletion-requests', authRateLimit, (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const username = cleanUsername(req.body?.username);
    if (!validEmail(email) || username.length < 3) {
        return res.status(400).json({ success: false, error: 'Enter the account email and player name' });
    }
    const existing = deletionRequests.find((request) => request.email === email && request.status === 'pending');
    if (!existing) {
        deletionRequests.push({
            id: uuidv4(), email, username, status: 'pending', requestedAt: new Date().toISOString()
        });
        saveDeletionRequests();
    }
    return res.json({
        success: true,
        message: 'If the account details match, the deletion request will be processed after ownership verification.'
    });
});

app.get('/game.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'game.html'));
});

app.use(express.static(path.join(__dirname, 'www')));

// ============ HEALTH CHECK (for Railway/deployment) ============

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        users: users.size
    });
});

// ============ START SERVER ============

server.listen(PORT, () => {
    console.log(`\n🎱 Mine Pool Multiplayer Server Running!\n`);
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Network:  http://127.0.0.1:${PORT}\n`);
    console.log(`   Login:    http://localhost:${PORT}/login.html`);
    console.log(`   Menu:     http://localhost:${PORT}/index.html`);
    console.log(`   Game:     http://localhost:${PORT}/game.html\n`);
    console.log(`   WebSocket: ws://localhost:${PORT}\n`);
    console.log(`Demo credentials: demo@example.com / password123`);
    console.log(`Pro credentials:  pro@example.com / password123\n`);
    console.log(`Press Ctrl+C to stop the server\n`);
});

module.exports = app;

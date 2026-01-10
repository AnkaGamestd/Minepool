/**
 * Anti-Fraud System for TAIN Games
 * Handles rate limiting, withdrawal limits, account verification, and fraud detection
 */

// ============ CONFIGURATION ============

const ANTIFRAUD_CONFIG = {
    // Rate Limiting
    DEPOSIT_MAX_PER_HOUR: 10,
    WITHDRAWAL_MAX_PER_DAY: 3,
    WITHDRAWAL_COOLDOWN_HOURS: 1,

    // Withdrawal Limits
    DAILY_WITHDRAWAL_LIMIT: 10000,      // 10,000 TAIN per day
    WEEKLY_WITHDRAWAL_LIMIT: 50000,     // 50,000 TAIN per week
    LARGE_WITHDRAWAL_THRESHOLD: 5000,   // Requires review above this

    // Account Verification
    MIN_ACCOUNT_AGE_HOURS: 24,          // 24 hours before withdrawals
    MIN_GAMES_FOR_WITHDRAWAL: 5,        // Must play 5 games first

    // Game Integrity
    MIN_GAME_DURATION_SECONDS: 30,      // Games shorter than this are suspicious
    MAX_WIN_RATE_THRESHOLD: 0.85,       // 85% win rate triggers review
    MIN_GAMES_FOR_WIN_RATE_CHECK: 20,   // Only check after 20 games

    // IP Tracking
    MAX_ACCOUNTS_PER_IP: 3,             // Max accounts from same IP
    SUSPICIOUS_LOGIN_COUNTRIES: [],     // Add country codes if needed
};

// ============ IN-MEMORY TRACKING ============

// Rate limiting trackers (in production, use Redis)
const depositAttempts = new Map();      // Map<userId, { count, resetAt }>
const withdrawalAttempts = new Map();   // Map<userId, { count, lastAt, dailyAmount, weeklyAmount, weekResetAt }>
const suspiciousUsers = new Set();      // Set of flagged user IDs
const userIPHistory = new Map();        // Map<userId, Set<ipAddress>>
const ipAccountMapping = new Map();     // Map<ipAddress, Set<userId>>
const transactionLog = [];              // Audit trail

// ============ RATE LIMITING ============

/**
 * Check if user can make a deposit verification
 */
function canDeposit(userId) {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);

    let record = depositAttempts.get(userId);

    // Reset if hour has passed
    if (!record || record.resetAt < now) {
        record = { count: 0, resetAt: now + (60 * 60 * 1000) };
    }

    if (record.count >= ANTIFRAUD_CONFIG.DEPOSIT_MAX_PER_HOUR) {
        return { allowed: false, reason: 'Rate limit: Maximum deposits per hour reached', retryAfter: record.resetAt };
    }

    record.count++;
    depositAttempts.set(userId, record);
    return { allowed: true };
}

/**
 * Check if user can make a withdrawal
 */
function canWithdraw(userId, amount) {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const cooldownTime = ANTIFRAUD_CONFIG.WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000;

    let record = withdrawalAttempts.get(userId) || {
        count: 0,
        lastAt: 0,
        dailyAmount: 0,
        dailyResetAt: now + (24 * 60 * 60 * 1000),
        weeklyAmount: 0,
        weekResetAt: now + (7 * 24 * 60 * 60 * 1000)
    };

    // Reset daily counter if day has passed
    if (record.dailyResetAt < now) {
        record.count = 0;
        record.dailyAmount = 0;
        record.dailyResetAt = now + (24 * 60 * 60 * 1000);
    }

    // Reset weekly counter if week has passed
    if (record.weekResetAt < now) {
        record.weeklyAmount = 0;
        record.weekResetAt = now + (7 * 24 * 60 * 60 * 1000);
    }

    // Check cooldown
    if (record.lastAt && (now - record.lastAt) < cooldownTime) {
        const retryAfter = record.lastAt + cooldownTime;
        const minutesLeft = Math.ceil((retryAfter - now) / 60000);
        return { allowed: false, reason: `Cooldown: Please wait ${minutesLeft} minutes between withdrawals`, retryAfter };
    }

    // Check daily count
    if (record.count >= ANTIFRAUD_CONFIG.WITHDRAWAL_MAX_PER_DAY) {
        return { allowed: false, reason: 'Daily limit: Maximum withdrawals per day reached', retryAfter: record.dailyResetAt };
    }

    // Check daily amount
    if (record.dailyAmount + amount > ANTIFRAUD_CONFIG.DAILY_WITHDRAWAL_LIMIT) {
        const remaining = ANTIFRAUD_CONFIG.DAILY_WITHDRAWAL_LIMIT - record.dailyAmount;
        return { allowed: false, reason: `Daily limit: Maximum ${ANTIFRAUD_CONFIG.DAILY_WITHDRAWAL_LIMIT} TAIN per day. Remaining: ${remaining} TAIN` };
    }

    // Check weekly amount
    if (record.weeklyAmount + amount > ANTIFRAUD_CONFIG.WEEKLY_WITHDRAWAL_LIMIT) {
        const remaining = ANTIFRAUD_CONFIG.WEEKLY_WITHDRAWAL_LIMIT - record.weeklyAmount;
        return { allowed: false, reason: `Weekly limit: Maximum ${ANTIFRAUD_CONFIG.WEEKLY_WITHDRAWAL_LIMIT} TAIN per week. Remaining: ${remaining} TAIN` };
    }

    // Check large withdrawal
    if (amount >= ANTIFRAUD_CONFIG.LARGE_WITHDRAWAL_THRESHOLD) {
        return { allowed: false, reason: `Large withdrawals (${ANTIFRAUD_CONFIG.LARGE_WITHDRAWAL_THRESHOLD}+ TAIN) require manual approval. Please contact support.`, requiresReview: true };
    }

    return { allowed: true };
}

/**
 * Record a successful withdrawal
 */
function recordWithdrawal(userId, amount) {
    const now = Date.now();
    let record = withdrawalAttempts.get(userId) || {
        count: 0,
        lastAt: 0,
        dailyAmount: 0,
        dailyResetAt: now + (24 * 60 * 60 * 1000),
        weeklyAmount: 0,
        weekResetAt: now + (7 * 24 * 60 * 60 * 1000)
    };

    record.count++;
    record.lastAt = now;
    record.dailyAmount += amount;
    record.weeklyAmount += amount;

    withdrawalAttempts.set(userId, record);
}

// ============ ACCOUNT VERIFICATION ============

/**
 * Check if account meets withdrawal requirements
 */
function verifyAccountForWithdrawal(user) {
    const now = Date.now();

    // Check account age
    if (user.createdAt) {
        const createdAt = new Date(user.createdAt).getTime();
        const accountAgeHours = (now - createdAt) / (60 * 60 * 1000);

        if (accountAgeHours < ANTIFRAUD_CONFIG.MIN_ACCOUNT_AGE_HOURS) {
            const hoursLeft = Math.ceil(ANTIFRAUD_CONFIG.MIN_ACCOUNT_AGE_HOURS - accountAgeHours);
            return { verified: false, reason: `Account too new. Please wait ${hoursLeft} more hours before withdrawing.` };
        }
    }

    // Check games played
    const gamesPlayed = user.gamesPlayed || 0;
    if (gamesPlayed < ANTIFRAUD_CONFIG.MIN_GAMES_FOR_WITHDRAWAL) {
        const gamesNeeded = ANTIFRAUD_CONFIG.MIN_GAMES_FOR_WITHDRAWAL - gamesPlayed;
        return { verified: false, reason: `Play ${gamesNeeded} more games before withdrawing. (${gamesPlayed}/${ANTIFRAUD_CONFIG.MIN_GAMES_FOR_WITHDRAWAL})` };
    }

    // Check if user is flagged
    if (suspiciousUsers.has(user.id)) {
        return { verified: false, reason: 'Account under review. Please contact support.' };
    }

    return { verified: true };
}

// ============ GAME INTEGRITY ============

/**
 * Validate game result for fraud
 */
function validateGameResult(winnerId, loserId, gameDurationSeconds, wager) {
    const flags = [];

    // Check game duration
    if (gameDurationSeconds < ANTIFRAUD_CONFIG.MIN_GAME_DURATION_SECONDS) {
        flags.push(`Game too short: ${gameDurationSeconds}s`);
    }

    return {
        valid: flags.length === 0,
        flags
    };
}

/**
 * Check user's win rate for anomalies
 */
function checkWinRateAnomaly(user) {
    const gamesPlayed = user.gamesPlayed || 0;
    const gamesWon = user.gamesWon || 0;

    // Only check after minimum games
    if (gamesPlayed < ANTIFRAUD_CONFIG.MIN_GAMES_FOR_WIN_RATE_CHECK) {
        return { suspicious: false };
    }

    const winRate = gamesWon / gamesPlayed;

    if (winRate > ANTIFRAUD_CONFIG.MAX_WIN_RATE_THRESHOLD) {
        return {
            suspicious: true,
            winRate: (winRate * 100).toFixed(1) + '%',
            reason: `Abnormally high win rate: ${(winRate * 100).toFixed(1)}%`
        };
    }

    return { suspicious: false, winRate: (winRate * 100).toFixed(1) + '%' };
}

// ============ IP TRACKING ============

/**
 * Track user IP and check for multi-accounting
 */
function trackUserIP(userId, ipAddress) {
    if (!ipAddress) return { allowed: true };

    // Track IPs for this user
    if (!userIPHistory.has(userId)) {
        userIPHistory.set(userId, new Set());
    }
    userIPHistory.get(userId).add(ipAddress);

    // Track users for this IP
    if (!ipAccountMapping.has(ipAddress)) {
        ipAccountMapping.set(ipAddress, new Set());
    }
    const usersOnIP = ipAccountMapping.get(ipAddress);
    usersOnIP.add(userId);

    // Check for too many accounts
    if (usersOnIP.size > ANTIFRAUD_CONFIG.MAX_ACCOUNTS_PER_IP) {
        return {
            allowed: true,  // Still allow but flag
            warning: `Multiple accounts detected from same IP (${usersOnIP.size} accounts)`,
            flagged: true
        };
    }

    return { allowed: true };
}

/**
 * Get all users from same IP
 */
function getUsersFromSameIP(ipAddress) {
    return Array.from(ipAccountMapping.get(ipAddress) || []);
}

// ============ AUDIT LOGGING ============

/**
 * Log transaction for audit trail
 */
function logTransaction(type, userId, username, amount, details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        type,
        userId,
        username,
        amount,
        ...details
    };

    transactionLog.push(entry);

    // Keep last 10000 entries in memory (in production, persist to database)
    if (transactionLog.length > 10000) {
        transactionLog.shift();
    }

    // Console log for monitoring
    console.log(`📊 [AUDIT] ${type}: ${username} - ${amount} TAIN`, details);

    return entry;
}

/**
 * Flag user as suspicious
 */
function flagUser(userId, reason) {
    suspiciousUsers.add(userId);
    console.log(`🚨 [ALERT] User ${userId} flagged: ${reason}`);

    logTransaction('FLAG', userId, 'SYSTEM', 0, { reason });
}

/**
 * Unflag user
 */
function unflagUser(userId) {
    suspiciousUsers.delete(userId);
    console.log(`✅ [ALERT] User ${userId} unflagged`);
}

/**
 * Get recent transactions for audit
 */
function getRecentTransactions(limit = 100) {
    return transactionLog.slice(-limit).reverse();
}

/**
 * Get suspicious users list
 */
function getSuspiciousUsers() {
    return Array.from(suspiciousUsers);
}

// ============ EXPORTS ============

module.exports = {
    ANTIFRAUD_CONFIG,
    // Rate limiting
    canDeposit,
    canWithdraw,
    recordWithdrawal,
    // Account verification
    verifyAccountForWithdrawal,
    // Game integrity
    validateGameResult,
    checkWinRateAnomaly,
    // IP tracking
    trackUserIP,
    getUsersFromSameIP,
    // Audit
    logTransaction,
    flagUser,
    unflagUser,
    getRecentTransactions,
    getSuspiciousUsers
};

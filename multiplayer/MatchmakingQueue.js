/**
 * Matchmaking Queue for 8-Ball Pool
 * Implements skill-based matchmaking with ELO ratings
 */

class MatchmakingQueue {
    constructor(roomManager) {
        this.roomManager = roomManager;
        this.queues = {
            // Legacy tiers (for backwards compatibility)
            casual: [],      // 50 coins wager
            competitive: [], // 250 coins wager
            highStakes: [],  // 1000 coins wager
            // New UI tiers (Coins)
            bronze: [],      // 50 coins wager
            silver: [],      // 100 coins wager
            gold: [],        // 250 coins wager
            diamond: [],     // 500 coins wager
            ruby: [],        // 1000 coins wager
            crown: [],       // 2500 coins wager
            // TAIN tiers
            starter: [],     // 10 TAIN
            rookie: [],      // 50 TAIN
            pro: [],         // 100 TAIN
            elite: [],       // 250 TAIN
            master: [],      // 500 TAIN
            legend: []       // 1000 TAIN
        };
        this.playerQueues = new Map(); // playerId -> {queue, joinedAt}

        // Matchmaking settings
        this.settings = {
            initialEloRange: 500,     // Starting ELO difference tolerance (raised for easier matching)
            eloRangeExpansion: 100,   // Expand by this much every interval
            expansionInterval: 5000,  // 5 seconds
            maxEloRange: 1000,        // Maximum ELO difference
            maxWaitTime: 120000,      // 2 minutes max wait
            aiTimeout: 15000          // 15 seconds before AI fallback
        };

        // AI bot tracking
        this.activeBots = new Set();
        this.usersData = null;
    }

    addPlayer(player, tier = 'casual', currency = 'coins', stake = 0) {
        // Check if already in queue
        if (this.playerQueues.has(player.id)) {
            return { error: 'Already in queue', position: this.getPosition(player.id) };
        }

        // Validate tier
        if (!this.queues[tier]) {
            tier = 'casual';
        }

        // Tier-to-stake mapping (ensures correct wager even if stake=0)
        const tierStakes = {
            // Coins tiers
            casual: { stake: 50, currency: 'coins' },
            competitive: { stake: 250, currency: 'coins' },
            highStakes: { stake: 1000, currency: 'coins' },
            bronze: { stake: 50, currency: 'coins' },
            silver: { stake: 100, currency: 'coins' },
            gold: { stake: 250, currency: 'coins' },
            diamond: { stake: 500, currency: 'coins' },
            ruby: { stake: 1000, currency: 'coins' },
            crown: { stake: 2500, currency: 'coins' },
            // TAIN tiers
            starter: { stake: 10, currency: 'tainBalance' },
            rookie: { stake: 50, currency: 'tainBalance' },
            pro: { stake: 100, currency: 'tainBalance' },
            elite: { stake: 250, currency: 'tainBalance' },
            master: { stake: 500, currency: 'tainBalance' },
            legend: { stake: 1000, currency: 'tainBalance' }
        };

        // Determine actual stake and currency from tier if not explicitly provided
        const tierConfig = tierStakes[tier] || tierStakes.casual;
        const actualStake = stake > 0 ? stake : tierConfig.stake;
        const actualCurrency = currency || tierConfig.currency;

        console.log(`🎮 Queue entry: tier=${tier}, stake=${actualStake}, currency=${actualCurrency}`);
        console.log(`   Player data: email=${player.email}, wallet=${player.walletAddress}, oderId=${player.oderId}`);

        const queueEntry = {
            id: player.id,
            oderId: player.oderId,  // CRITICAL for user lookup
            username: player.username,
            elo: player.elo || 1200,
            coins: player.coins || 1000,
            tainBalance: player.tainBalance || 0,
            walletAddress: player.walletAddress,
            email: player.email,
            currency: actualCurrency,
            stake: actualStake,
            joinedAt: Date.now()
        };

        this.queues[tier].push(queueEntry);
        this.playerQueues.set(player.id, { queue: tier, joinedAt: Date.now() });
        console.log(`➕ ${player.username} joined queue '${tier}' (${this.queues[tier].length} players now in ${tier} queue)`);

        // Try to find a match immediately
        const match = this.tryMatch(queueEntry, tier);
        if (match.matched) {
            return match;
        }

        return {
            matched: false,
            position: this.queues[tier].length,
            tier,
            estimatedWait: this.estimateWaitTime(tier)
        };
    }

    removePlayer(playerId) {
        const playerInfo = this.playerQueues.get(playerId);
        if (!playerInfo) return false;

        const tier = playerInfo.queue;
        this.queues[tier] = this.queues[tier].filter(p => p.id !== playerId);
        this.playerQueues.delete(playerId);
        return true;
    }

    tryMatch(player, tier) {
        const queue = this.queues[tier];
        const now = Date.now();

        // Calculate current ELO range based on wait time
        const waitTime = now - player.joinedAt;
        const expansions = Math.floor(waitTime / this.settings.expansionInterval);
        const currentRange = Math.min(
            this.settings.initialEloRange + (expansions * this.settings.eloRangeExpansion),
            this.settings.maxEloRange
        );

        console.log(`🔎 tryMatch for ${player.username}: queue has ${queue.length} players, ELO range: ${currentRange}`);

        // Find best match within ELO range
        let bestMatch = null;
        let bestEloDiff = Infinity;

        for (let i = 0; i < queue.length; i++) {
            const opponent = queue[i];
            if (opponent.id === player.id) continue;

            const eloDiff = Math.abs(player.elo - opponent.elo);
            console.log(`   Checking ${opponent.username}: ELO diff ${eloDiff}, range ${currentRange}`);

            // Check if within range
            if (eloDiff <= currentRange && eloDiff < bestEloDiff) {
                bestMatch = opponent;
                bestEloDiff = eloDiff;
            }
        }

        if (bestMatch) {
            // Match found! Remove both from queue
            this.queues[tier] = queue.filter(p => p.id !== player.id && p.id !== bestMatch.id);
            this.playerQueues.delete(player.id);
            this.playerQueues.delete(bestMatch.id);

            const wager = player.stake || 50;
            const currency = player.currency || 'coins';

            // Create room (let host be the one who waited longer)
            const host = player.joinedAt < bestMatch.joinedAt ? player : bestMatch;
            const guest = player.joinedAt < bestMatch.joinedAt ? bestMatch : player;

            const room = this.roomManager.createRoom(host, wager, currency);
            this.roomManager.joinRoom(room.id, guest);

            return {
                matched: true,
                roomId: room.id,
                opponent: bestMatch,
                wager,
                currency,
                tier
            };
        }

        return { matched: false };
    }

    // Run periodic matching for players who have been waiting
    processQueue(tier) {
        const queue = this.queues[tier];
        const now = Date.now();

        // Sort by join time (oldest first)
        queue.sort((a, b) => a.joinedAt - b.joinedAt);

        // Process each player
        for (let i = 0; i < queue.length; i++) {
            const player = queue[i];

            // Skip if matched already
            if (!this.playerQueues.has(player.id)) continue;

            // Try to find a match
            const match = this.tryMatch(player, tier);
            if (match.matched) {
                return match;
            }

            // Check for timeout
            if (now - player.joinedAt > this.settings.maxWaitTime) {
                this.removePlayer(player.id);
                return { timeout: true, playerId: player.id };
            }
        }

        return null;
    }

    getPosition(playerId) {
        const playerInfo = this.playerQueues.get(playerId);
        if (!playerInfo) return -1;

        const queue = this.queues[playerInfo.queue];
        const index = queue.findIndex(p => p.id === playerId);
        return index + 1;
    }

    estimateWaitTime(tier) {
        const queue = this.queues[tier];
        if (queue.length === 0) return 30; // 30 seconds if empty
        if (queue.length === 1) return 15; // Match likely soon
        return Math.max(5, 30 - queue.length * 2); // Less wait with more players
    }

    getQueueStats() {
        return {
            casual: {
                players: this.queues.casual.length,
                avgWait: this.calculateAverageWait('casual')
            },
            competitive: {
                players: this.queues.competitive.length,
                avgWait: this.calculateAverageWait('competitive')
            },
            highStakes: {
                players: this.queues.highStakes.length,
                avgWait: this.calculateAverageWait('highStakes')
            },
            totalPlayers: this.playerQueues.size
        };
    }

    calculateAverageWait(tier) {
        const queue = this.queues[tier];
        if (queue.length === 0) return 0;

        const now = Date.now();
        const totalWait = queue.reduce((sum, p) => sum + (now - p.joinedAt), 0);
        return Math.round(totalWait / queue.length / 1000);
    }

    getPlayerStatus(playerId) {
        const playerInfo = this.playerQueues.get(playerId);
        if (!playerInfo) return null;

        const queue = this.queues[playerInfo.queue];
        const player = queue.find(p => p.id === playerId);
        if (!player) return null;

        const now = Date.now();
        const waitTime = now - player.joinedAt;
        const expansions = Math.floor(waitTime / this.settings.expansionInterval);
        const currentRange = Math.min(
            this.settings.initialEloRange + (expansions * this.settings.eloRangeExpansion),
            this.settings.maxEloRange
        );

        return {
            position: this.getPosition(playerId),
            tier: playerInfo.queue,
            waitTime: Math.round(waitTime / 1000),
            currentEloRange: currentRange,
            playersInQueue: queue.length
        };
    }

    // === AI Bot Methods ===

    setUsersData(usersData) {
        this.usersData = usersData;
    }

    getRandomBot(playerElo = 1200) {
        if (!this.usersData) return null;
        const availableBots = this.usersData.filter(u => u.isBot && !this.activeBots.has(u.id));
        if (availableBots.length === 0) return null;
        const similarBots = availableBots.filter(b => Math.abs(b.elo - playerElo) <= 400);
        const pool = similarBots.length > 0 ? similarBots : availableBots;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    processQueueWithAI(tier) {
        const queue = this.queues[tier];
        if (!queue) return null;
        const now = Date.now();
        queue.sort((a, b) => a.joinedAt - b.joinedAt);

        for (let i = 0; i < queue.length; i++) {
            const player = queue[i];
            if (!this.playerQueues.has(player.id)) continue;
            const waitTime = now - player.joinedAt;

            // Try real player first
            const match = this.tryMatch(player, tier);
            if (match.matched) return match;

            // AI fallback after 15 seconds
            if (waitTime >= this.settings.aiTimeout) {
                const bot = this.getRandomBot(player.elo);
                if (bot) {
                    return this.matchWithBot(player, bot, tier);
                }
            }

            // Max wait timeout
            if (waitTime > this.settings.maxWaitTime) {
                this.removePlayer(player.id);
                return { timeout: true, playerId: player.id };
            }
        }
        return null;
    }

    matchWithBot(player, bot, tier) {
        this.queues[tier] = this.queues[tier].filter(p => p.id !== player.id);
        this.playerQueues.delete(player.id);
        this.activeBots.add(bot.id);

        const wager = player.stake || 50;
        const currency = player.currency || 'coins';
        const room = this.roomManager.createRoom(player, wager, currency);

        const botEntry = {
            id: bot.id,
            username: bot.username,
            elo: bot.elo,
            coins: bot.coins || 5000,
            isBot: true,
            aiDifficulty: bot.aiDifficulty || 'expert',
            profilePicture: bot.profilePicture,
            nationality: bot.nationality
        };

        this.roomManager.joinRoom(room.id, botEntry);
        console.log(`🤖 AI Match: ${player.username} vs ${bot.username}`);

        return {
            matched: true,
            roomId: room.id,
            opponent: botEntry,
            wager,
            currency,
            tier,
            isAiMatch: true
        };
    }

    releaseBot(botId) {
        this.activeBots.delete(botId);
    }
}

// ELO calculation helper
class EloCalculator {
    static K_FACTOR = 32; // Standard K-factor

    static calculateExpectedScore(playerElo, opponentElo) {
        return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    }

    static calculateNewRatings(winnerElo, loserElo) {
        const expectedWinner = this.calculateExpectedScore(winnerElo, loserElo);
        const expectedLoser = this.calculateExpectedScore(loserElo, winnerElo);

        const newWinnerElo = Math.round(winnerElo + this.K_FACTOR * (1 - expectedWinner));
        const newLoserElo = Math.round(loserElo + this.K_FACTOR * (0 - expectedLoser));

        return {
            winner: {
                oldElo: winnerElo,
                newElo: newWinnerElo,
                change: newWinnerElo - winnerElo
            },
            loser: {
                oldElo: loserElo,
                newElo: Math.max(100, newLoserElo), // Minimum ELO of 100
                change: newLoserElo - loserElo
            }
        };
    }

    static getRankFromElo(elo) {
        if (elo >= 2400) return { rank: 'Grandmaster', tier: 6, color: '#FF6B6B' };
        if (elo >= 2000) return { rank: 'Master', tier: 5, color: '#C0C0C0' };
        if (elo >= 1700) return { rank: 'Diamond', tier: 4, color: '#00D4FF' };
        if (elo >= 1400) return { rank: 'Platinum', tier: 3, color: '#4ECDC4' };
        if (elo >= 1100) return { rank: 'Gold', tier: 2, color: '#FFD700' };
        if (elo >= 800) return { rank: 'Silver', tier: 1, color: '#A0A0A0' };
        return { rank: 'Bronze', tier: 0, color: '#CD7F32' };
    }
}

module.exports = { MatchmakingQueue, EloCalculator };

/**
 * Match History System for 8-Ball Pool
 * Stores and retrieves match records
 */

const { v4: uuidv4 } = require('uuid');

class MatchHistory {
    constructor() {
        // In-memory storage (in production, use a database)
        this.matches = new Map();
        this.playerMatches = new Map(); // playerId -> [matchIds]
        this.maxStoredMatches = 10000;
    }

    recordMatch(data) {
        const matchId = uuidv4();

        const match = {
            id: matchId,
            roomId: data.roomId,
            players: {
                host: {
                    id: data.host.id,
                    username: data.host.username,
                    email: data.host.email,
                    elo: data.host.elo
                },
                guest: {
                    id: data.guest.id,
                    username: data.guest.username,
                    email: data.guest.email,
                    elo: data.guest.elo
                }
            },
            winner: data.winner, // 1 or 2
            winnerUsername: data.winner === 1 ? data.host.username : data.guest.username,
            loserUsername: data.winner === 1 ? data.guest.username : data.host.username,
            reason: data.reason, // '8ball', 'forfeit', 'timeout', 'scratch'
            wager: data.wager,
            eloChanges: data.eloChanges,
            stats: this.calculateMatchStats(data),
            duration: data.duration,
            timestamp: Date.now()
        };

        // Store match
        this.matches.set(matchId, match);

        // Index by player
        this.indexMatchForPlayer(data.host.email || data.host.id, matchId);
        this.indexMatchForPlayer(data.guest.email || data.guest.id, matchId);

        // Cleanup old matches if needed
        if (this.matches.size > this.maxStoredMatches) {
            this.cleanupOldMatches();
        }

        return match;
    }

    calculateMatchStats(data) {
        const shotHistory = data.shotHistory || [];

        return {
            totalShots: shotHistory.length,
            shotsByPlayer: {
                1: shotHistory.filter(s => s.player === 1).length,
                2: shotHistory.filter(s => s.player === 2).length
            },
            avgPower: shotHistory.length > 0
                ? shotHistory.reduce((sum, s) => sum + s.power, 0) / shotHistory.length
                : 0,
            spinsUsed: shotHistory.filter(s => s.spinX !== 0 || s.spinY !== 0).length
        };
    }

    indexMatchForPlayer(playerId, matchId) {
        if (!this.playerMatches.has(playerId)) {
            this.playerMatches.set(playerId, []);
        }
        this.playerMatches.get(playerId).unshift(matchId);

        // Keep only last 100 matches per player
        const matches = this.playerMatches.get(playerId);
        if (matches.length > 100) {
            matches.pop();
        }
    }

    getMatch(matchId) {
        return this.matches.get(matchId);
    }

    getPlayerHistory(playerId, limit = 20) {
        const matchIds = this.playerMatches.get(playerId) || [];
        const matches = [];

        for (let i = 0; i < Math.min(matchIds.length, limit); i++) {
            const match = this.matches.get(matchIds[i]);
            if (match) {
                // Determine if this player won
                const isHost = match.players.host.email === playerId ||
                    match.players.host.id === playerId;
                const isWinner = (isHost && match.winner === 1) ||
                    (!isHost && match.winner === 2);

                matches.push({
                    ...match,
                    isWinner,
                    coinsChange: isWinner ? match.wager : -match.wager,
                    eloChange: isHost
                        ? (match.winner === 1 ? match.eloChanges.winner.change : match.eloChanges.loser.change)
                        : (match.winner === 2 ? match.eloChanges.winner.change : match.eloChanges.loser.change)
                });
            }
        }

        return matches;
    }

    getPlayerStats(playerId) {
        const matchIds = this.playerMatches.get(playerId) || [];
        let wins = 0, losses = 0, totalCoins = 0, totalEloChange = 0;
        let currentStreak = 0, maxStreak = 0, streakType = null;

        for (const matchId of matchIds) {
            const match = this.matches.get(matchId);
            if (!match) continue;

            const isHost = match.players.host.email === playerId ||
                match.players.host.id === playerId;
            const isWinner = (isHost && match.winner === 1) ||
                (!isHost && match.winner === 2);

            if (isWinner) {
                wins++;
                totalCoins += match.wager;
                totalEloChange += isHost
                    ? match.eloChanges.winner.change
                    : match.eloChanges.winner.change;

                if (streakType === 'win') {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                    streakType = 'win';
                }
            } else {
                losses++;
                totalCoins -= match.wager;
                totalEloChange += isHost
                    ? match.eloChanges.loser.change
                    : match.eloChanges.loser.change;

                if (streakType === 'loss') {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                    streakType = 'loss';
                }
            }

            maxStreak = Math.max(maxStreak, currentStreak);
        }

        return {
            gamesPlayed: matchIds.length,
            wins,
            losses,
            winRate: matchIds.length > 0 ? (wins / matchIds.length * 100).toFixed(1) : 0,
            totalCoinsEarned: totalCoins,
            totalEloChange,
            currentStreak,
            maxStreak,
            streakType
        };
    }

    getRecentMatches(limit = 20) {
        const matches = Array.from(this.matches.values());
        matches.sort((a, b) => b.timestamp - a.timestamp);
        return matches.slice(0, limit);
    }

    cleanupOldMatches() {
        const matches = Array.from(this.matches.entries());
        matches.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 10%
        const toRemove = Math.floor(matches.length * 0.1);
        for (let i = 0; i < toRemove; i++) {
            this.matches.delete(matches[i][0]);
        }
    }
}

module.exports = { MatchHistory };

/**
 * 16-Player Tournament System for 8-Ball Pool
 * Features: Group A/B Bracket, Entry Tiers, Automated Prize Distribution
 */

const { v4: uuidv4 } = require('uuid');

// Tournament State Machine
const TournamentState = {
    REGISTERING: 'REGISTERING',
    LOCKED: 'LOCKED',
    IN_PROGRESS: 'IN_PROGRESS',
    FINISHED: 'FINISHED'
};

// Tournament Configuration
const ENTRY_FEE_TIERS = [50, 100, 200, 500];
const MAX_PLAYERS = 16;
const HOUSE_FEE_RATE = 0.05;
const WINNER_PRIZE_RATE = 0.80;
const RUNNER_UP_PRIZE_RATE = 0.20;

class Tournament16 {
    constructor(id, config) {
        this.id = id;
        this.name = config.name || '16-Player Tournament';
        this.description = config.description || '';
        this.entryFee = ENTRY_FEE_TIERS.includes(config.entryFee) ? config.entryFee : 100;
        this.maxPlayers = MAX_PLAYERS;
        this.status = TournamentState.REGISTERING;
        this.players = [];
        this.groupA = [];
        this.groupB = [];
        this.matches = new Map();
        this.brackets = { groupA: [], groupB: [], grandFinal: null };
        this.totalPot = 0;
        this.houseFee = 0;
        this.netPrizePool = 0;
        this.winnerPrize = 0;
        this.runnerUpPrize = 0;
        this.winner = null;
        this.runnerUp = null;
        this.createdAt = Date.now();
        this.startedAt = null;
        this.completedAt = null;
    }

    registerPlayer(player) {
        if (this.status !== TournamentState.REGISTERING) return { error: 'Registration closed' };
        if (this.players.length >= this.maxPlayers) return { error: 'Tournament full' };
        if (this.players.find(p => p.id === player.id)) return { error: 'Already registered' };
        if ((player.coins || 0) < this.entryFee) return { error: 'Insufficient coins' };

        this.players.push({
            id: player.id, username: player.username, elo: player.elo || 1200,
            coins: player.coins, bracketSide: null, eliminated: false,
            matchesWon: 0, registeredAt: Date.now()
        });
        this.totalPot += this.entryFee;

        if (this.players.length === this.maxPlayers) return this.lockAndStart();
        return { success: true, position: this.players.length, playersNeeded: this.maxPlayers - this.players.length };
    }

    unregisterPlayer(playerId) {
        if (this.status !== TournamentState.REGISTERING) return { error: 'Cannot unregister' };
        const idx = this.players.findIndex(p => p.id === playerId);
        if (idx === -1) return { error: 'Not registered' };
        this.players.splice(idx, 1);
        this.totalPot -= this.entryFee;
        return { success: true, refund: this.entryFee };
    }

    lockAndStart() {
        if (this.players.length !== MAX_PLAYERS) return { error: 'Need 16 players' };
        this.status = TournamentState.LOCKED;
        this.calculatePrizes();
        this.shuffleAndAssignGroups();
        this.generateGroupBrackets();
        this.status = TournamentState.IN_PROGRESS;
        this.startedAt = Date.now();
        return {
            success: true, message: 'Tournament started!',
            brackets: this.getBracketInfo(),
            prizes: { totalPot: this.totalPot, houseFee: this.houseFee, netPool: this.netPrizePool, winner: this.winnerPrize, runnerUp: this.runnerUpPrize }
        };
    }

    calculatePrizes() {
        this.totalPot = this.entryFee * MAX_PLAYERS;
        this.houseFee = Math.floor(this.totalPot * HOUSE_FEE_RATE);
        this.netPrizePool = this.totalPot - this.houseFee;
        this.winnerPrize = Math.floor(this.netPrizePool * WINNER_PRIZE_RATE);
        this.runnerUpPrize = Math.floor(this.netPrizePool * RUNNER_UP_PRIZE_RATE);
    }

    shuffleAndAssignGroups() {
        const shuffled = [...this.players];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        this.groupA = shuffled.slice(0, 8).map(p => { p.bracketSide = 'A'; return p; });
        this.groupB = shuffled.slice(8, 16).map(p => { p.bracketSide = 'B'; return p; });
        this.players = [...this.groupA, ...this.groupB];
    }

    generateGroupBrackets() {
        this.brackets.groupA = this.createGroupBracket(this.groupA, 'A');
        this.brackets.groupB = this.createGroupBracket(this.groupB, 'B');
        this.brackets.grandFinal = {
            id: uuidv4(), round: 4, type: 'GRAND_FINAL',
            player1: null, player2: null, winner: null, loser: null, status: 'pending', roomId: null
        };
        this.matches.set(this.brackets.grandFinal.id, this.brackets.grandFinal);
    }

    createGroupBracket(groupPlayers, groupName) {
        const rounds = [];
        const round1 = [];
        for (let i = 0; i < 4; i++) {
            const match = {
                id: uuidv4(), round: 1, group: groupName, matchNumber: i + 1,
                player1: groupPlayers[i * 2], player2: groupPlayers[i * 2 + 1],
                winner: null, loser: null, status: 'ready', roomId: null
            };
            this.matches.set(match.id, match);
            round1.push(match);
        }
        rounds.push({ round: 1, name: 'Round of 16', matches: round1 });

        const round2 = [];
        for (let i = 0; i < 2; i++) {
            const match = {
                id: uuidv4(), round: 2, group: groupName, matchNumber: i + 1,
                player1: null, player2: null,
                feedsFrom: [round1[i * 2].id, round1[i * 2 + 1].id],
                winner: null, loser: null, status: 'pending', roomId: null
            };
            this.matches.set(match.id, match);
            round2.push(match);
        }
        rounds.push({ round: 2, name: 'Quarter-Finals', matches: round2 });

        const groupFinal = {
            id: uuidv4(), round: 3, group: groupName, matchNumber: 1,
            player1: null, player2: null,
            feedsFrom: [round2[0].id, round2[1].id],
            winner: null, loser: null, status: 'pending', roomId: null
        };
        this.matches.set(groupFinal.id, groupFinal);
        rounds.push({ round: 3, name: `Group ${groupName} Final`, matches: [groupFinal] });
        return rounds;
    }

    reportMatchResult(matchId, winnerId) {
        const match = this.matches.get(matchId);
        if (!match) return { error: 'Match not found' };
        if (match.status === 'completed') return { error: 'Already completed' };
        if (match.status === 'pending') return { error: 'Not ready' };

        if (match.player1?.id === winnerId) { match.winner = match.player1; match.loser = match.player2; }
        else if (match.player2?.id === winnerId) { match.winner = match.player2; match.loser = match.player1; }
        else return { error: 'Invalid winner' };

        match.status = 'completed';
        match.completedAt = Date.now();
        const winnerPlayer = this.players.find(p => p.id === winnerId);
        const loserPlayer = this.players.find(p => p.id === match.loser.id);
        if (winnerPlayer) winnerPlayer.matchesWon++;
        if (loserPlayer) loserPlayer.eliminated = true;

        this.advanceWinner(match);
        if (this.isTournamentComplete()) return this.completeTournament();
        return { success: true, match, nextMatch: this.getNextMatchForPlayer(winnerId) };
    }

    handleWalkover(matchId, disconnectedPlayerId) {
        const match = this.matches.get(matchId);
        if (!match) return { error: 'Match not found' };
        if (match.status === 'completed') return { error: 'Already completed' };
        let winnerId;
        if (match.player1?.id === disconnectedPlayerId) winnerId = match.player2?.id;
        else if (match.player2?.id === disconnectedPlayerId) winnerId = match.player1?.id;
        else return { error: 'Player not in match' };
        if (!winnerId) return { error: 'No opponent' };
        return this.reportMatchResult(matchId, winnerId);
    }

    advanceWinner(completedMatch) {
        const { round, group, winner } = completedMatch;
        if (round === 1) {
            const rounds = group === 'A' ? this.brackets.groupA : this.brackets.groupB;
            const nextRound = rounds.find(r => r.round === 2);
            const matchIndex = Math.floor((completedMatch.matchNumber - 1) / 2);
            const nextMatch = nextRound.matches[matchIndex];
            if (completedMatch.matchNumber % 2 === 1) nextMatch.player1 = winner;
            else nextMatch.player2 = winner;
            if (nextMatch.player1 && nextMatch.player2) nextMatch.status = 'ready';
        } else if (round === 2) {
            const rounds = group === 'A' ? this.brackets.groupA : this.brackets.groupB;
            const groupFinal = rounds.find(r => r.round === 3).matches[0];
            if (completedMatch.matchNumber === 1) groupFinal.player1 = winner;
            else groupFinal.player2 = winner;
            if (groupFinal.player1 && groupFinal.player2) groupFinal.status = 'ready';
        } else if (round === 3) {
            if (group === 'A') this.brackets.grandFinal.player1 = winner;
            else this.brackets.grandFinal.player2 = winner;
            if (this.brackets.grandFinal.player1 && this.brackets.grandFinal.player2) this.brackets.grandFinal.status = 'ready';
        } else if (round === 4) {
            this.winner = winner;
            this.runnerUp = completedMatch.loser;
        }
    }

    isTournamentComplete() { return this.brackets.grandFinal.status === 'completed'; }

    completeTournament() {
        this.status = TournamentState.FINISHED;
        this.completedAt = Date.now();
        return {
            success: true, tournamentComplete: true,
            winner: this.winner, runnerUp: this.runnerUp,
            prizes: { winner: { player: this.winner, amount: this.winnerPrize }, runnerUp: { player: this.runnerUp, amount: this.runnerUpPrize } }
        };
    }

    getNextMatchForPlayer(playerId) {
        for (const match of this.matches.values()) {
            if ((match.status === 'ready' || match.status === 'pending') && (match.player1?.id === playerId || match.player2?.id === playerId)) return match;
        }
        return null;
    }

    getReadyMatches() { return Array.from(this.matches.values()).filter(m => m.status === 'ready'); }
    getBracketInfo() { return { groupA: this.brackets.groupA, groupB: this.brackets.groupB, grandFinal: this.brackets.grandFinal }; }

    toJSON() {
        return {
            id: this.id, name: this.name, description: this.description, entryFee: this.entryFee,
            maxPlayers: this.maxPlayers, currentPlayers: this.players.length, status: this.status,
            players: this.players.map(p => ({ id: p.id, username: p.username, bracketSide: p.bracketSide, eliminated: p.eliminated })),
            brackets: this.getBracketInfo(),
            prizes: { totalPot: this.totalPot, houseFee: this.houseFee, netPool: this.netPrizePool, winner: this.winnerPrize, runnerUp: this.runnerUpPrize },
            winner: this.winner, runnerUp: this.runnerUp, createdAt: this.createdAt, startedAt: this.startedAt, completedAt: this.completedAt
        };
    }
}

class TournamentManager16 {
    constructor() {
        this.tournaments = new Map();
        this.playerTournaments = new Map();
        // Queue for each entry fee tier
        this.queues = new Map();
        ENTRY_FEE_TIERS.forEach(tier => {
            this.queues.set(tier, {
                entryFee: tier,
                players: [],
                createdAt: Date.now()
            });
        });
    }

    // Get queue status for all tiers
    getQueueStatus() {
        const status = {};
        for (const [tier, queue] of this.queues) {
            status[tier] = {
                entryFee: tier,
                playersInQueue: queue.players.length,
                maxPlayers: MAX_PLAYERS,
                players: queue.players.map(p => ({ id: p.id, username: p.username }))
            };
        }
        return status;
    }

    // Get queue for specific tier
    getQueue(tier) {
        return this.queues.get(tier);
    }

    // Register player to a tier queue
    registerToQueue(tier, player) {
        if (!ENTRY_FEE_TIERS.includes(tier)) {
            return { error: `Invalid tier. Must be one of: ${ENTRY_FEE_TIERS.join(', ')}` };
        }

        // Check if player already in a queue or tournament
        if (this.playerTournaments.has(player.id)) {
            const existing = this.tournaments.get(this.playerTournaments.get(player.id));
            if (existing && existing.status !== TournamentState.FINISHED) {
                return { error: 'Already in an active tournament' };
            }
        }

        // Check if player already in any queue
        for (const [queueTier, queue] of this.queues) {
            if (queue.players.find(p => p.id === player.id)) {
                return { error: `Already in queue for ${queueTier} tier` };
            }
        }

        // Check coins
        if ((player.coins || 0) < tier) {
            return { error: `Insufficient coins. Need ${tier}, have ${player.coins || 0}` };
        }

        const queue = this.queues.get(tier);
        queue.players.push({
            id: player.id,
            username: player.username,
            elo: player.elo || 1200,
            coins: player.coins,
            joinedAt: Date.now()
        });

        // Check if queue is full - start tournament
        if (queue.players.length >= MAX_PLAYERS) {
            return this.startTournamentFromQueue(tier);
        }

        return {
            success: true,
            position: queue.players.length,
            playersNeeded: MAX_PLAYERS - queue.players.length,
            tier: tier
        };
    }

    // Leave queue
    leaveQueue(tier, playerId) {
        const queue = this.queues.get(tier);
        if (!queue) return { error: 'Invalid tier' };

        const idx = queue.players.findIndex(p => p.id === playerId);
        if (idx === -1) return { error: 'Not in queue' };

        queue.players.splice(idx, 1);
        return { success: true, refund: tier };
    }

    // Find which queue a player is in
    getPlayerQueue(playerId) {
        for (const [tier, queue] of this.queues) {
            if (queue.players.find(p => p.id === playerId)) {
                return { tier, position: queue.players.findIndex(p => p.id === playerId) + 1 };
            }
        }
        return null;
    }

    // Start tournament when queue has 16 players
    startTournamentFromQueue(tier) {
        const queue = this.queues.get(tier);
        if (!queue || queue.players.length < MAX_PLAYERS) {
            return { error: 'Not enough players' };
        }

        // Take 16 players from queue
        const tournamentPlayers = queue.players.splice(0, MAX_PLAYERS);

        // Create tournament
        const id = uuidv4();
        const tournament = new Tournament16(id, {
            name: `${tier} Coin Tournament`,
            entryFee: tier
        });
        this.tournaments.set(id, tournament);

        // Register all players
        for (const player of tournamentPlayers) {
            tournament.registerPlayer(player);
            this.playerTournaments.set(player.id, id);
        }

        // Tournament should auto-start since it has 16 players
        const result = tournament.toJSON();

        return {
            success: true,
            tournamentStarted: true,
            tournamentId: id,
            tournament: result,
            players: tournamentPlayers.map(p => ({ id: p.id, username: p.username }))
        };
    }

    // Legacy methods for managing active tournaments
    getTournament(id) { return this.tournaments.get(id); }

    getActiveTournaments() {
        return Array.from(this.tournaments.values())
            .filter(t => t.status === TournamentState.REGISTERING || t.status === TournamentState.IN_PROGRESS)
            .map(t => t.toJSON());
    }

    reportMatchResult(tournamentId, matchId, winnerId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return { error: 'Tournament not found' };
        return tournament.reportMatchResult(matchId, winnerId);
    }

    handleWalkover(tournamentId, matchId, disconnectedPlayerId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return { error: 'Tournament not found' };
        return tournament.handleWalkover(matchId, disconnectedPlayerId);
    }

    getPlayerTournament(playerId) {
        const tournamentId = this.playerTournaments.get(playerId);
        return tournamentId ? this.tournaments.get(tournamentId) : null;
    }

    cleanupCompleted() {
        const oneDay = 24 * 60 * 60 * 1000;
        const now = Date.now();
        for (const [id, tournament] of this.tournaments) {
            if (tournament.status === TournamentState.FINISHED && now - tournament.completedAt > oneDay) {
                for (const player of tournament.players) this.playerTournaments.delete(player.id);
                this.tournaments.delete(id);
            }
        }
    }
}

module.exports = { Tournament16, TournamentManager16, TournamentState, ENTRY_FEE_TIERS, MAX_PLAYERS };

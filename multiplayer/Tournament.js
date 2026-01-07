/**
 * Tournament System for 8-Ball Pool
 * Manages tournament creation, brackets, and progression
 */

const { v4: uuidv4 } = require('uuid');

class Tournament {
    constructor(id, config) {
        this.id = id;
        this.name = config.name || 'Pool Tournament';
        this.description = config.description || '';
        this.type = config.type || 'single_elimination'; // single_elimination, double_elimination, round_robin
        this.maxPlayers = config.maxPlayers || 8; // Powers of 2: 4, 8, 16, 32
        this.entryFee = config.entryFee || 100;
        this.prizePool = 0;
        this.prizeDistribution = config.prizeDistribution || { 1: 0.6, 2: 0.25, 3: 0.15 };

        this.players = [];
        this.brackets = [];
        this.currentRound = 0;
        this.matches = new Map(); // matchId -> match

        this.status = 'registration'; // registration, in_progress, completed, cancelled
        this.createdAt = Date.now();
        this.startedAt = null;
        this.completedAt = null;

        this.settings = {
            registrationDeadline: config.registrationDeadline || Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            timePerMatch: config.timePerMatch || 15 * 60 * 1000, // 15 minutes
            autoStart: config.autoStart !== false
        };
    }

    registerPlayer(player) {
        if (this.status !== 'registration') {
            return { error: 'Registration is closed' };
        }

        if (this.players.length >= this.maxPlayers) {
            return { error: 'Tournament is full' };
        }

        if (this.players.find(p => p.id === player.id)) {
            return { error: 'Already registered' };
        }

        if ((player.coins || 0) < this.entryFee) {
            return { error: 'Insufficient coins for entry fee' };
        }

        this.players.push({
            id: player.id,
            username: player.username,
            elo: player.elo || 1200,
            seed: null,
            eliminated: false,
            wins: 0,
            losses: 0,
            registeredAt: Date.now()
        });

        this.prizePool += this.entryFee;

        // Auto-start if full
        if (this.players.length === this.maxPlayers && this.settings.autoStart) {
            this.start();
        }

        return { success: true, position: this.players.length };
    }

    unregisterPlayer(playerId) {
        if (this.status !== 'registration') {
            return { error: 'Cannot unregister after tournament starts' };
        }

        const index = this.players.findIndex(p => p.id === playerId);
        if (index === -1) {
            return { error: 'Not registered' };
        }

        this.players.splice(index, 1);
        this.prizePool -= this.entryFee;

        return { success: true, refund: this.entryFee };
    }

    start() {
        if (this.status !== 'registration') {
            return { error: 'Tournament already started' };
        }

        if (this.players.length < 2) {
            return { error: 'Not enough players' };
        }

        // Seed players by ELO
        this.seedPlayers();

        // Generate brackets based on tournament type
        if (this.type === 'single_elimination') {
            this.generateSingleEliminationBracket();
        } else if (this.type === 'round_robin') {
            this.generateRoundRobinBracket();
        }

        this.status = 'in_progress';
        this.startedAt = Date.now();
        this.currentRound = 1;

        return { success: true, brackets: this.brackets };
    }

    seedPlayers() {
        // Sort by ELO descending
        this.players.sort((a, b) => b.elo - a.elo);

        // Assign seeds
        this.players.forEach((player, index) => {
            player.seed = index + 1;
        });

        // Pad to power of 2 for elimination brackets
        if (this.type !== 'round_robin') {
            const targetSize = Math.pow(2, Math.ceil(Math.log2(this.players.length)));
            while (this.players.length < targetSize) {
                this.players.push({
                    id: `bye_${this.players.length}`,
                    username: 'BYE',
                    isBye: true,
                    seed: this.players.length + 1
                });
            }
        }
    }

    generateSingleEliminationBracket() {
        const numRounds = Math.log2(this.players.length);
        this.brackets = [];

        // Create seeded matchups for first round
        const firstRoundMatches = this.createSeededMatchups(this.players);

        let roundMatches = firstRoundMatches.map((pair, index) => {
            const match = {
                id: uuidv4(),
                round: 1,
                matchNumber: index + 1,
                player1: pair[0],
                player2: pair[1],
                winner: null,
                loser: null,
                status: 'pending', // pending, in_progress, completed
                roomId: null,
                scores: { 1: 0, 2: 0 }
            };

            // Auto-win for bye matches
            if (match.player2?.isBye) {
                match.winner = match.player1;
                match.status = 'completed';
            }

            this.matches.set(match.id, match);
            return match;
        });

        this.brackets.push({ round: 1, matches: roundMatches });

        // Create placeholder matches for subsequent rounds
        for (let round = 2; round <= numRounds; round++) {
            const numMatches = Math.pow(2, numRounds - round);
            roundMatches = [];

            for (let i = 0; i < numMatches; i++) {
                const match = {
                    id: uuidv4(),
                    round,
                    matchNumber: i + 1,
                    player1: null, // TBD
                    player2: null, // TBD
                    winner: null,
                    loser: null,
                    status: 'pending',
                    roomId: null,
                    scores: { 1: 0, 2: 0 }
                };
                this.matches.set(match.id, match);
                roundMatches.push(match);
            }

            this.brackets.push({ round, matches: roundMatches });
        }
    }

    createSeededMatchups(players) {
        // Standard seeding: 1v16, 8v9, 4v13, 5v12, etc.
        const n = players.length;
        const matchups = [];

        for (let i = 0; i < n / 2; i++) {
            const seedA = this.getSeedPosition(i * 2 + 1, n);
            const seedB = this.getSeedPosition(i * 2 + 2, n);
            matchups.push([players[seedA - 1], players[seedB - 1]]);
        }

        return matchups;
    }

    getSeedPosition(position, bracketSize) {
        // Returns the seed that should be in a given bracket position
        if (bracketSize === 2) return position;

        const half = bracketSize / 2;
        if (position <= half) {
            return this.getSeedPosition(position, half);
        } else {
            return bracketSize + 1 - this.getSeedPosition(position - half, half);
        }
    }

    generateRoundRobinBracket() {
        const n = this.players.length;
        const rounds = n % 2 === 0 ? n - 1 : n;
        const matchesPerRound = Math.floor(n / 2);

        this.brackets = [];
        const playersCopy = [...this.players];

        // Add dummy player if odd number
        if (n % 2 !== 0) {
            playersCopy.push({ id: 'bye', username: 'BYE', isBye: true });
        }

        for (let round = 1; round <= rounds; round++) {
            const roundMatches = [];

            for (let i = 0; i < matchesPerRound; i++) {
                const p1 = playersCopy[i];
                const p2 = playersCopy[playersCopy.length - 1 - i];

                if (!p1.isBye && !p2.isBye) {
                    const match = {
                        id: uuidv4(),
                        round,
                        matchNumber: roundMatches.length + 1,
                        player1: p1,
                        player2: p2,
                        winner: null,
                        loser: null,
                        status: 'pending',
                        roomId: null
                    };
                    this.matches.set(match.id, match);
                    roundMatches.push(match);
                }
            }

            this.brackets.push({ round, matches: roundMatches });

            // Rotate players (keep first player fixed)
            const last = playersCopy.pop();
            playersCopy.splice(1, 0, last);
        }
    }

    reportMatchResult(matchId, winnerId) {
        const match = this.matches.get(matchId);
        if (!match) return { error: 'Match not found' };
        if (match.status === 'completed') return { error: 'Match already completed' };

        // Determine winner/loser
        if (match.player1.id === winnerId) {
            match.winner = match.player1;
            match.loser = match.player2;
        } else if (match.player2.id === winnerId) {
            match.winner = match.player2;
            match.loser = match.player1;
        } else {
            return { error: 'Invalid winner' };
        }

        match.status = 'completed';
        match.completedAt = Date.now();

        // Update player stats
        const winner = this.players.find(p => p.id === winnerId);
        const loser = this.players.find(p => p.id === match.loser.id);

        if (winner) winner.wins++;
        if (loser) {
            loser.losses++;
            if (this.type === 'single_elimination') {
                loser.eliminated = true;
            }
        }

        // Advance winner to next round (single elimination)
        if (this.type === 'single_elimination') {
            this.advanceWinner(match);
        }

        // Check if tournament is complete
        if (this.isComplete()) {
            this.complete();
        }

        return { success: true, match };
    }

    advanceWinner(completedMatch) {
        const currentRound = completedMatch.round;
        const nextRound = this.brackets[currentRound]; // 0-indexed, so this is the next round

        if (!nextRound) return; // Finals completed

        // Find the next match for this winner
        const matchIndex = Math.floor((completedMatch.matchNumber - 1) / 2);
        const nextMatch = nextRound.matches[matchIndex];

        if (nextMatch) {
            if (completedMatch.matchNumber % 2 === 1) {
                nextMatch.player1 = completedMatch.winner;
            } else {
                nextMatch.player2 = completedMatch.winner;
            }

            // Check if next match is ready
            if (nextMatch.player1 && nextMatch.player2) {
                nextMatch.status = 'ready';
            }
        }
    }

    isComplete() {
        if (this.type === 'single_elimination') {
            const finals = this.brackets[this.brackets.length - 1];
            return finals?.matches[0]?.status === 'completed';
        } else if (this.type === 'round_robin') {
            return Array.from(this.matches.values()).every(m => m.status === 'completed');
        }
        return false;
    }

    complete() {
        this.status = 'completed';
        this.completedAt = Date.now();

        // Determine final standings
        this.calculateFinalStandings();

        return this.getResults();
    }

    calculateFinalStandings() {
        if (this.type === 'single_elimination') {
            const finals = this.brackets[this.brackets.length - 1].matches[0];
            this.standings = [
                { place: 1, player: finals.winner, prize: Math.floor(this.prizePool * this.prizeDistribution[1]) },
                { place: 2, player: finals.loser, prize: Math.floor(this.prizePool * this.prizeDistribution[2]) }
            ];

            // Semi-final losers for 3rd place
            if (this.brackets.length > 1) {
                const semis = this.brackets[this.brackets.length - 2];
                const thirdPlacePrize = Math.floor(this.prizePool * (this.prizeDistribution[3] || 0) / 2);
                semis.matches.forEach(m => {
                    if (m.loser && m.loser.id !== finals.loser.id) {
                        this.standings.push({ place: 3, player: m.loser, prize: thirdPlacePrize });
                    }
                });
            }
        } else if (this.type === 'round_robin') {
            // Sort by wins, then head-to-head
            this.standings = this.players
                .filter(p => !p.isBye)
                .sort((a, b) => b.wins - a.wins)
                .map((player, index) => ({
                    place: index + 1,
                    player,
                    prize: this.prizeDistribution[index + 1]
                        ? Math.floor(this.prizePool * this.prizeDistribution[index + 1])
                        : 0
                }));
        }
    }

    getResults() {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            standings: this.standings,
            totalMatches: this.matches.size,
            prizePool: this.prizePool
        };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            type: this.type,
            maxPlayers: this.maxPlayers,
            currentPlayers: this.players.filter(p => !p.isBye).length,
            entryFee: this.entryFee,
            prizePool: this.prizePool,
            status: this.status,
            currentRound: this.currentRound,
            brackets: this.brackets,
            settings: this.settings,
            createdAt: this.createdAt,
            startedAt: this.startedAt
        };
    }
}

class TournamentManager {
    constructor() {
        this.tournaments = new Map();
        this.playerTournaments = new Map(); // playerId -> tournamentId
    }

    createTournament(config) {
        const id = uuidv4();
        const tournament = new Tournament(id, config);
        this.tournaments.set(id, tournament);
        return tournament;
    }

    getTournament(id) {
        return this.tournaments.get(id);
    }

    getActiveTournaments() {
        return Array.from(this.tournaments.values())
            .filter(t => t.status === 'registration' || t.status === 'in_progress')
            .map(t => t.toJSON());
    }

    getUpcomingTournaments() {
        return Array.from(this.tournaments.values())
            .filter(t => t.status === 'registration')
            .map(t => t.toJSON());
    }

    registerPlayer(tournamentId, player) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return { error: 'Tournament not found' };

        // Check if player already in a tournament
        if (this.playerTournaments.has(player.id)) {
            return { error: 'Already registered in another tournament' };
        }

        const result = tournament.registerPlayer(player);
        if (result.success) {
            this.playerTournaments.set(player.id, tournamentId);
        }

        return result;
    }

    unregisterPlayer(tournamentId, playerId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return { error: 'Tournament not found' };

        const result = tournament.unregisterPlayer(playerId);
        if (result.success) {
            this.playerTournaments.delete(playerId);
        }

        return result;
    }

    getPlayerTournament(playerId) {
        const tournamentId = this.playerTournaments.get(playerId);
        if (!tournamentId) return null;
        return this.tournaments.get(tournamentId);
    }

    cleanupCompleted() {
        const oneDay = 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const [id, tournament] of this.tournaments) {
            if (tournament.status === 'completed' &&
                now - tournament.completedAt > oneDay) {
                this.tournaments.delete(id);
            }
        }
    }
}

module.exports = { Tournament, TournamentManager };

/**
 * Room Manager for 8-Ball Pool Multiplayer
 * Handles room creation, joining, and management
 */

const { v4: uuidv4 } = require('uuid');

class GameRoom {
    constructor(roomId, host, wager = 50, currency = 'coins') {
        this.id = roomId;
        this.host = host;
        this.guest = null;
        this.spectators = [];
        this.wager = wager;
        this.currency = currency;

        this.gameState = {
            balls: [],
            currentPlayer: 1,
            playerTypes: { 1: null, 2: null }, // 'solids' or 'stripes'
            isBreakShot: true,
            tableOpen: true,
            ballInHand: false,
            ballInHandKitchen: true,
            pocketedBalls: { 1: [], 2: [] },
            fouls: [],
            shotHistory: [],
            turnsSinceLastPocket: 0
        };

        this.status = 'waiting'; // waiting, ready, playing, finished
        this.winner = null;
        this.createdAt = Date.now();
        this.lastAction = Date.now();
        this.shotTimer = null;
        this.shotTimeLimit = 30; // seconds
    }

    addGuest(player) {
        if (this.guest) return false;
        this.guest = player;
        this.status = 'ready';
        return true;
    }

    addSpectator(player) {
        if (this.spectators.length >= 10) return false;
        this.spectators.push(player);
        return true;
    }

    removeSpectator(playerId) {
        this.spectators = this.spectators.filter(s => s.id !== playerId);
    }

    startGame() {
        this.status = 'playing';
        this.gameState = {
            balls: this.initializeBalls(),
            currentPlayer: 1, // Host always breaks first
            playerTypes: { 1: null, 2: null },
            isBreakShot: true,
            tableOpen: true,
            ballInHand: false,
            ballInHandKitchen: false,
            pocketedBalls: { 1: [], 2: [] },
            fouls: [],
            shotHistory: [],
            turnsSinceLastPocket: 0
        };
        this.lastAction = Date.now();
        return this.gameState;
    }

    initializeBalls() {
        const balls = [];
        const tableWidth = 1000;
        const tableHeight = 500;
        const startX = tableWidth * 0.75;
        const startY = tableHeight / 2;
        const radius = 14;  // Synchronized with client physics.BALL_RADIUS
        const gap = 1;      // Synchronized with client (ballRadius * 2 + 1)

        // Cue ball
        balls.push({
            id: 0,
            x: tableWidth * 0.25,
            y: tableHeight / 2,
            vx: 0,
            vy: 0,
            active: true,
            spinX: 0,
            spinY: 0
        });

        // Rack balls - proper 8-ball order
        const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
        let ballIndex = 0;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                const x = startX + row * (radius * 2 + gap) * 0.866;
                const y = startY + (col - row / 2) * (radius * 2 + gap);
                const id = rackOrder[ballIndex];
                balls.push({
                    id,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    active: true,
                    spinX: 0,
                    spinY: 0
                });
                ballIndex++;
            }
        }

        return balls;
    }

    getPlayerNumber(playerId) {
        if (this.host.id === playerId) return 1;
        if (this.guest?.id === playerId) return 2;
        return 0;
    }

    processShot(playerId, shotData) {
        const playerNum = this.getPlayerNumber(playerId);
        if (playerNum !== this.gameState.currentPlayer) {
            console.log(`❌ Turn validation failed: Player ${playerNum} tried to shoot, but it's Player ${this.gameState.currentPlayer}'s turn`);
            return { error: 'Not your turn' };
        }

        // Validate shot data
        if (!this.validateShot(shotData)) {
            return { error: 'Invalid shot data' };
        }

        // Record shot
        const shot = {
            player: playerNum,
            angle: shotData.angle,
            power: shotData.power,
            spinX: shotData.spinX,
            spinY: shotData.spinY,
            timestamp: Date.now()
        };

        this.gameState.shotHistory.push(shot);
        this.lastAction = Date.now();

        // DO NOT switch turn here - wait for shot result after balls stop
        console.log(`✅ Shot processed for Player ${playerNum}, waiting for result...`);

        return { success: true, shot };
    }

    validateShot(shotData) {
        if (shotData.power < 0 || shotData.power > 100) return false;
        if (shotData.spinX < -1 || shotData.spinX > 1) return false;
        if (shotData.spinY < -1 || shotData.spinY > 1) return false;
        if (isNaN(shotData.angle)) return false;
        return true;
    }

    updateBallPositions(balls) {
        this.gameState.balls = balls;
    }

    handleShotResult(result) {
        console.log(`📊 handleShotResult called:`, {
            foul: result.foul,
            continueTurn: result.continueTurn,
            pocketedBalls: result.pocketedBalls?.length || 0,
            currentPlayer: this.gameState.currentPlayer,
            isBreakShot: this.gameState.isBreakShot
        });

        // Mark break shot as complete
        if (this.gameState.isBreakShot) {
            this.gameState.isBreakShot = false;
            console.log(`   - Break shot completed, isBreakShot set to false`);
        }

        // Reset ball-in-hand since a shot was taken (player already placed the cue ball)
        if (this.gameState.ballInHand) {
            this.gameState.ballInHand = false;
            this.gameState.ballInHandKitchen = false;
            console.log(`   - Ball-in-hand cleared (shot was taken)`);
        }

        // Update pocketed balls
        if (result.pocketedBalls && result.pocketedBalls.length > 0) {
            const currentPlayer = this.gameState.currentPlayer;
            this.gameState.pocketedBalls[currentPlayer].push(...result.pocketedBalls);
            this.gameState.turnsSinceLastPocket = 0;
        } else {
            this.gameState.turnsSinceLastPocket++;
        }

        // Handle table assignment after break
        if (result.assignGroup && this.gameState.tableOpen) {
            this.gameState.tableOpen = false;
            const currentPlayer = this.gameState.currentPlayer;
            this.gameState.playerTypes[currentPlayer] = result.assignGroup;
            this.gameState.playerTypes[currentPlayer === 1 ? 2 : 1] =
                result.assignGroup === 'solid' ? 'stripe' : 'solid';
            console.log(`   - Groups assigned: Player ${currentPlayer} = ${result.assignGroup}`);
        }

        // Also sync tableOpen and playerTypes directly from client if provided
        if (result.tableOpen !== undefined) {
            this.gameState.tableOpen = result.tableOpen;
        }
        if (result.playerTypes) {
            this.gameState.playerTypes = result.playerTypes;
        }

        // Handle fouls and turn changes
        if (result.foul) {
            console.log(`   ⚠️ FOUL detected - switching turn`);
            this.gameState.fouls.push({
                player: this.gameState.currentPlayer,
                type: result.foul,
                timestamp: Date.now()
            });
            this.gameState.ballInHand = true;
            this.gameState.ballInHandKitchen = false;
            this.switchTurn();
        } else if (result.continueTurn) {
            // Player pocketed their ball, continue
            console.log(`   ✅ Player continues (continueTurn=true)`);
        } else {
            console.log(`   🔄 Switching turn (continueTurn=false or undefined)`);
            this.switchTurn();
        }

        console.log(`   → New current player: ${this.gameState.currentPlayer}`);

        // Check for winner
        if (result.winner) {
            this.status = 'finished';
            this.winner = result.winner;
            return { gameOver: true, winner: result.winner, reason: result.reason };
        }

        this.lastAction = Date.now();
        return { gameOver: false };
    }

    switchTurn() {
        this.gameState.currentPlayer =
            this.gameState.currentPlayer === 1 ? 2 : 1;
    }

    placeCueBall(x, y) {
        const cueBall = this.gameState.balls.find(b => b.id === 0);
        if (cueBall) {
            cueBall.x = x;
            cueBall.y = y;
            cueBall.active = true;
        }
        this.gameState.ballInHand = false;
        this.gameState.ballInHandKitchen = false;
    }

    toJSON() {
        return {
            id: this.id,
            host: {
                id: this.host.id,
                username: this.host.username,
                elo: this.host.elo || 1200,
                profilePicture: this.host.profilePicture || null,
                nationality: this.host.nationality || null
            },
            guest: this.guest ? {
                id: this.guest.id,
                username: this.guest.username,
                elo: this.guest.elo || 1200,
                profilePicture: this.guest.profilePicture || null,
                nationality: this.guest.nationality || null
            } : null,
            spectators: this.spectators.map(s => ({ id: s.id, username: s.username })),
            spectatorCount: this.spectators.length,
            status: this.status,
            wager: this.wager,
            currency: this.currency,
            gameState: this.gameState,
            createdAt: this.createdAt
        };
    }
}

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.playerRooms = new Map();
    }

    createRoom(hostPlayer, wager = 50, currency = 'coins') {
        const roomId = this.generateRoomId();
        const room = new GameRoom(roomId, hostPlayer, wager, currency);
        this.rooms.set(roomId, room);
        this.playerRooms.set(hostPlayer.id, roomId);
        return room;
    }

    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        // Check if this player is already in the room (rejoin after page navigation)
        if (room.host && room.host.username === player.username) {
            // Reconnecting host - update socket ID and profile info
            room.host.id = player.id;
            room.host.profilePicture = player.profilePicture || room.host.profilePicture;
            room.host.nationality = player.nationality || room.host.nationality;
            this.playerRooms.set(player.id, roomId);
            console.log(`🔄 Host ${player.username} rejoined room ${roomId}`);
            return { success: true, room, rejoin: true };
        }

        if (room.guest && room.guest.username === player.username) {
            // Reconnecting guest - update socket ID and profile info
            room.guest.id = player.id;
            room.guest.profilePicture = player.profilePicture || room.guest.profilePicture;
            room.guest.nationality = player.nationality || room.guest.nationality;
            this.playerRooms.set(player.id, roomId);
            console.log(`🔄 Guest ${player.username} rejoined room ${roomId}`);
            return { success: true, room, rejoin: true };
        }

        // New player trying to join
        if (room.guest) return { error: 'Room is full' };
        if (room.status !== 'waiting') return { error: 'Game already started' };

        room.addGuest(player);
        this.playerRooms.set(player.id, roomId);
        return { success: true, room };
    }

    spectateRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        if (room.addSpectator(player)) {
            this.playerRooms.set(player.id, roomId);
            return { success: true, room };
        }
        return { error: 'Cannot spectate this room' };
    }

    leaveRoom(playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) return null;

        const room = this.rooms.get(roomId);
        if (!room) {
            this.playerRooms.delete(playerId);
            return null;
        }

        // Handle player leaving
        if (room.host.id === playerId) {
            // Host left - if game in progress, guest wins
            if (room.status === 'playing' && room.guest) {
                room.winner = 2;
                room.status = 'finished';
            } else {
                // Delete room
                this.rooms.delete(roomId);
            }
        } else if (room.guest?.id === playerId) {
            // Guest left - if game in progress, host wins
            if (room.status === 'playing') {
                room.winner = 1;
                room.status = 'finished';
            } else {
                room.guest = null;
                room.status = 'waiting';
            }
        } else {
            // Spectator left
            room.removeSpectator(playerId);
        }

        this.playerRooms.delete(playerId);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getPlayerRoom(playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) return null;
        return this.rooms.get(roomId);
    }

    getAvailableRooms(limit = 20) {
        const available = [];
        for (const room of this.rooms.values()) {
            if (room.status === 'waiting' && !room.guest) {
                available.push(room.toJSON());
            }
            if (available.length >= limit) break;
        }
        return available;
    }

    getActiveGames(limit = 20) {
        const active = [];
        for (const room of this.rooms.values()) {
            if (room.status === 'playing') {
                active.push(room.toJSON());
            }
            if (active.length >= limit) break;
        }
        return active;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    cleanupOldRooms() {
        const timeout = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();

        for (const [roomId, room] of this.rooms) {
            if (now - room.lastAction > timeout) {
                // Remove all players from room
                if (room.host) this.playerRooms.delete(room.host.id);
                if (room.guest) this.playerRooms.delete(room.guest.id);
                for (const spec of room.spectators) {
                    this.playerRooms.delete(spec.id);
                }
                this.rooms.delete(roomId);
            }
        }
    }

    getStats() {
        let waiting = 0, playing = 0, finished = 0;
        for (const room of this.rooms.values()) {
            if (room.status === 'waiting') waiting++;
            else if (room.status === 'playing') playing++;
            else if (room.status === 'finished') finished++;
        }
        return { waiting, playing, finished, total: this.rooms.size };
    }
}

module.exports = { RoomManager, GameRoom };

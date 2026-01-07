/**
 * Network Manager Client for 8-Ball Pool Multiplayer
 * Handles WebSocket communication with the game server
 */

class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomId = null;
        this.playerId = null;
        this.isHost = false;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.callbacks = {};
    }

    connect(serverUrl = null) {
        // Auto-detect server URL
        if (!serverUrl) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            serverUrl = `${protocol}//${window.location.host}`;
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket = io(serverUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: 1000
                });

                this.setupEventListeners();

                this.socket.on('connect', () => {
                    this.connected = true;
                    this.playerId = this.socket.id;
                    this.reconnectAttempts = 0;
                    console.log('🎱 Connected to game server:', this.playerId);

                    // Authenticate with current user
                    if (window.currentUser) {
                        this.authenticate(window.currentUser);
                    }

                    resolve(this.playerId);
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    this.connected = false;
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    setupEventListeners() {
        // Authentication
        this.socket.on('authenticated', (data) => {
            console.log('✅ Authenticated successfully');
            this.emit('authenticated', data);
        });

        this.socket.on('auth_error', (data) => {
            console.error('❌ Authentication failed:', data.error);
            this.emit('auth_error', data);
        });

        // Room events
        this.socket.on('room_created', (data) => {
            this.roomId = data.roomId;
            this.isHost = true;
            console.log('🏠 Room created:', data.roomId);
            this.emit('room_created', data);
        });

        this.socket.on('player_joined', (data) => {
            console.log('👤 Player joined room');
            this.emit('player_joined', data);
        });

        this.socket.on('player_left', (data) => {
            console.log('👋 Player left room');
            this.emit('player_left', data);
        });

        this.socket.on('room_error', (data) => {
            console.error('Room error:', data.error);
            this.emit('room_error', data);
        });

        this.socket.on('rooms_list', (data) => {
            this.emit('rooms_list', data);
        });

        this.socket.on('active_games', (data) => {
            this.emit('active_games', data);
        });

        // Matchmaking events
        this.socket.on('matchmaking_started', (data) => {
            console.log('🔍 Matchmaking started, position:', data.position);
            this.emit('matchmaking_started', data);
        });

        this.socket.on('match_found', (data) => {
            this.roomId = data.roomId;
            this.isHost = data.room.host.id === this.playerId;
            console.log('⚡ Match found!', data.roomId);
            this.emit('match_found', data);
        });

        this.socket.on('matchmaking_cancelled', (data) => {
            console.log('❌ Matchmaking cancelled');
            this.emit('matchmaking_cancelled', data);
        });

        this.socket.on('matchmaking_timeout', (data) => {
            console.log('⏱️ Matchmaking timeout');
            this.emit('matchmaking_timeout', data);
        });

        this.socket.on('queue_status', (data) => {
            this.emit('queue_status', data);
        });

        // Game events
        this.socket.on('game_start', (data) => {
            console.log('🎮 Game starting!');
            this.emit('game_start', data);
            if (this.game && this.game.onGameStart) {
                this.game.onGameStart(data);
            }
        });

        this.socket.on('opponent_aim', (data) => {
            this.emit('opponent_aim', data);
            if (this.game && this.game.onOpponentAim) {
                this.game.onOpponentAim(data);
            }
        });

        this.socket.on('shot_taken', (data) => {
            console.log('🎯 shot_taken received:', data);
            this.emit('shot_taken', data);
            if (this.game && this.game.onShotTaken) {
                this.game.onShotTaken(data);
            }
        });

        this.socket.on('game_state_update', (data) => {
            this.emit('game_state_update', data);
            if (this.game && this.game.onGameStateUpdate) {
                this.game.onGameStateUpdate(data);
            }
        });

        this.socket.on('cue_ball_placed', (data) => {
            this.emit('cue_ball_placed', data);
            if (this.game && this.game.onCueBallPlaced) {
                this.game.onCueBallPlaced(data);
            }
        });

        this.socket.on('game_over', (data) => {
            console.log('🏆 Game over! Winner:', data.winnerName);
            this.emit('game_over', data);
            if (this.game && this.game.onGameOver) {
                this.game.onGameOver(data);
            }
        });

        this.socket.on('opponent_disconnected', (data) => {
            console.log('👋 Opponent disconnected');
            this.emit('opponent_disconnected', data);
            if (this.game && this.game.onOpponentDisconnected) {
                this.game.onOpponentDisconnected(data);
            }
        });

        // Reconnection events
        this.socket.on('opponent_disconnecting', (data) => {
            console.log('⏱️ Opponent disconnecting, starting timer:', data.timeout + 's');
            this.emit('opponent_disconnecting', data);
            if (this.game && this.game.onOpponentDisconnecting) {
                this.game.onOpponentDisconnecting(data);
            }
        });

        this.socket.on('opponent_reconnected', (data) => {
            console.log('✅ Opponent reconnected:', data.reconnectedPlayer);
            this.emit('opponent_reconnected', data);
            if (this.game && this.game.onOpponentReconnected) {
                this.game.onOpponentReconnected(data);
            }
        });

        this.socket.on('game_rejoin', (data) => {
            console.log('🔄 Rejoining game:', data.roomId);
            this.roomId = data.roomId;
            this.emit('game_rejoin', data);
            if (this.game && this.game.onGameRejoin) {
                this.game.onGameRejoin(data);
            }
        });

        // Chat events
        this.socket.on('chat_message', (data) => {
            this.emit('chat_message', data);
        });

        this.socket.on('quick_chat', (data) => {
            this.emit('quick_chat', data);
        });

        // Rematch events
        this.socket.on('rematch_requested', (data) => {
            this.emit('rematch_requested', data);
        });

        // Social events
        this.socket.on('leaderboard', (data) => {
            this.emit('leaderboard', data);
        });

        this.socket.on('match_history', (data) => {
            this.emit('match_history', data);
        });

        this.socket.on('achievements', (data) => {
            this.emit('achievements', data);
        });

        // Server stats
        this.socket.on('server_stats', (data) => {
            this.emit('server_stats', data);
        });

        // Spectating
        this.socket.on('spectating', (data) => {
            this.roomId = data.roomId;
            console.log('👀 Now spectating room:', data.roomId);
            this.emit('spectating', data);
        });

        this.socket.on('spectator_joined', (data) => {
            this.emit('spectator_joined', data);
        });

        // Disconnect
        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('❌ Disconnected from server');
            this.emit('disconnected', {});
        });

        this.socket.on('reconnect', (attemptNumber) => {
            this.connected = true;
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');

            // Re-authenticate
            if (window.currentUser) {
                this.authenticate(window.currentUser);
            }

            this.emit('reconnected', { attempts: attemptNumber });
        });
    }

    // === Authentication ===
    authenticate(user) {
        this.socket.emit('authenticate', { user });
    }

    // === Room Operations ===
    createRoom(wager = 50) {
        this.socket.emit('create_room', { wager });
    }

    joinRoom(roomId) {
        this.socket.emit('join_room', { roomId: roomId.toUpperCase() });
    }

    leaveRoom() {
        this.socket.emit('leave_room');
        this.roomId = null;
        this.isHost = false;
    }

    spectateRoom(roomId) {
        this.socket.emit('spectate_room', { roomId: roomId.toUpperCase() });
    }

    getRooms() {
        this.socket.emit('get_rooms');
    }

    getActiveGames() {
        this.socket.emit('get_active_games');
    }

    // === Matchmaking ===
    findMatch(tier = 'casual') {
        this.socket.emit('find_match', { tier });
    }

    cancelMatchmaking() {
        this.socket.emit('cancel_matchmaking');
    }

    getQueueStatus() {
        this.socket.emit('get_queue_status');
    }

    // === Game Actions ===
    ready() {
        this.socket.emit('ready');
    }

    sendAim(angle, power, spinX, spinY) {
        this.socket.emit('aim_update', { angle, power, spinX, spinY });
    }

    sendShot(angle, power, spinX, spinY) {
        this.socket.emit('take_shot', { angle, power, spinX, spinY });
    }

    sendShotResult(result) {
        this.socket.emit('shot_result', result);
    }

    sendCueBallPosition(x, y) {
        this.socket.emit('cue_ball_placed', { x, y });
    }

    requestRematch() {
        this.socket.emit('request_rematch');
    }

    acceptRematch() {
        this.socket.emit('accept_rematch');
    }

    // === Chat ===
    sendMessage(message) {
        this.socket.emit('chat_message', { message });
    }

    sendQuickChat(messageId) {
        this.socket.emit('quick_chat', { messageId });
    }

    // === Social ===
    getLeaderboard(type = 'elo', limit = 20) {
        this.socket.emit('get_leaderboard', { type, limit });
    }

    getMatchHistory(limit = 20) {
        this.socket.emit('get_match_history', { limit });
    }

    getAchievements() {
        this.socket.emit('get_achievements');
    }

    // === Event System ===
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    // === Connection ===
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.roomId = null;
        this.playerId = null;
    }

    isConnected() {
        return this.connected && this.socket?.connected;
    }

    getPlayerId() {
        return this.playerId;
    }

    getRoomId() {
        return this.roomId;
    }

    isHostPlayer() {
        return this.isHost;
    }
}

// Make available globally
window.NetworkManager = NetworkManager;

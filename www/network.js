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

        // AI Match properties
        this.isAiMatch = false;
        this.aiOpponent = null;
        this.myPlayerNumber = 0;

        // 8-Ball pocket call
        this.calledPocket = null;
        this.needsPocketCall = false;
        this.pocketCallOverlay = null;
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
            console.log('🎮 Game starting!', data);

            // Detect AI match - check both isAiMatch flag AND isBot property on players
            const hostIsBot = data.host && data.host.isBot;
            const guestIsBot = data.guest && data.guest.isBot;
            this.isAiMatch = data.isAiMatch || hostIsBot || guestIsBot;

            if (this.isAiMatch) {
                console.log('🤖 Playing against AI opponent!');
                const isHost = data.host && data.host.id === this.playerId;
                this.myPlayerNumber = isHost ? 1 : 2;
                this.aiOpponent = isHost ? data.guest : data.host;
                console.log(`🤖 I am Player ${this.myPlayerNumber}, AI is Player ${this.myPlayerNumber === 1 ? 2 : 1}`);
            }

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
            console.log('📥 game_state_update received from server');
            this.emit('game_state_update', data);
            if (this.game && this.game.onGameStateUpdate) {
                this.game.onGameStateUpdate(data);
            }

            // Handle AI turn if applicable
            console.log(`🔍 AI Check: isAiMatch=${this.isAiMatch}, hasGameState=${!!data.gameState}, gameOver=${data.gameOver}, aiShotPending=${this.aiShotPending}`);
            if (this.isAiMatch && data.gameState && !data.gameOver) {
                const currentPlayer = data.gameState.currentPlayer;
                const isAiTurn = currentPlayer !== this.myPlayerNumber;
                console.log(`🔍 Turn Check: currentPlayer=${currentPlayer}, myPlayerNumber=${this.myPlayerNumber}, isAiTurn=${isAiTurn}`);

                if (isAiTurn && this.game && !this.aiShotPending) {
                    console.log('🤖 AI turn detected from server update, executing shot...');
                    this.executeAiTurn(data);
                } else if (this.aiShotPending) {
                    console.log('🤖 AI shot already pending, skipping duplicate trigger');
                }
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

        // Chat events
        this.socket.on('chat_message', (data) => {
            console.log('💬 Chat message from server:', data);
            this.emit('chat_message', data);
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
    findMatch(tier = 'casual', currency = 'coins', stake = 0) {
        this.socket.emit('find_match', { tier, currency, stake });
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

    // === AI Turn Execution ===
    executeAiTurn(data) {
        if (!this.game || !this.isAiMatch) return;

        // Prevent duplicate AI shots
        if (this.aiShotPending) {
            console.log('🤖 AI shot already pending, skipping...');
            return;
        }
        this.aiShotPending = true;

        // Get fresh game state
        const balls = this.game.balls || [];
        const cueBall = balls.find(b => b.id === 0);
        if (!cueBall || !cueBall.active) {
            console.log('🤖 Cue ball not available, skipping AI turn');
            this.aiShotPending = false;
            return;
        }

        // Add thinking delay (1.5-3 seconds)
        const thinkingTime = 1500 + Math.random() * 1500;
        console.log(`🤖 AI thinking for ${Math.round(thinkingTime)}ms...`);

        setTimeout(() => {
            // Get fresh ball references
            const freshBalls = this.game.balls || [];
            let freshCueBall = freshBalls.find(b => b.id === 0);
            if (!freshCueBall || !freshCueBall.active) {
                console.log('🤖 Cue ball not ready, aborting shot');
                this.aiShotPending = false;
                return;
            }

            // If AI has ball-in-hand, position cue ball optimally
            if (this.game.ballInHand) {
                console.log('🎱 AI has ball-in-hand, positioning cue ball...');
                // Find the best position for the cue ball
                const targetBall = this.findBestBallForAi(freshBalls);
                if (targetBall) {
                    // Position cue ball directly behind the target ball for easy straight shot
                    const pockets = this.game.physics?.pockets || [
                        { x: 40, y: 40 }, { x: 460, y: 40 }, { x: 880, y: 40 },
                        { x: 40, y: 460 }, { x: 460, y: 460 }, { x: 880, y: 460 }
                    ];

                    // Find closest pocket to target ball
                    let closestPocket = pockets[0];
                    let minDist = Infinity;
                    for (const pocket of pockets) {
                        const dist = Math.sqrt((pocket.x - targetBall.x) ** 2 + (pocket.y - targetBall.y) ** 2);
                        if (dist < minDist) {
                            minDist = dist;
                            closestPocket = pocket;
                        }
                    }

                    // Place cue ball on opposite side from pocket for straight shot
                    const dx = closestPocket.x - targetBall.x;
                    const dy = closestPocket.y - targetBall.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const dirX = dx / dist;
                    const dirY = dy / dist;

                    freshCueBall.x = targetBall.x - dirX * 80;
                    freshCueBall.y = targetBall.y - dirY * 80;

                    // Make sure cue ball is within table bounds
                    freshCueBall.x = Math.max(50, Math.min(950, freshCueBall.x));
                    freshCueBall.y = Math.max(50, Math.min(450, freshCueBall.y));

                    console.log(`🎱 AI placed cue ball at (${freshCueBall.x.toFixed(0)}, ${freshCueBall.y.toFixed(0)}) for straight shot at ball ${targetBall.id}`);
                }
                this.game.ballInHand = false;
            }

            // Determine AI's target group (AI is typically player 2)
            const aiPlayerNum = this.myPlayerNumber === 1 ? 2 : 1;
            const aiGroup = this.game.playerTypes ? this.game.playerTypes[aiPlayerNum] : null;
            console.log(`🤖 AI is Player ${aiPlayerNum}, Group: ${aiGroup || 'OPEN'}`);

            // Find valid target balls based on game state
            let targetBalls = [];
            const activeBalls = freshBalls.filter(b => b.id > 0 && b.active);

            if (!aiGroup || this.game.tableState === 'open') {
                // Open table - can target any ball except 8-ball
                targetBalls = activeBalls.filter(b => b.id !== 8);
                console.log('🤖 Open table - targeting any ball');
            } else {
                // Closed table - target own group
                const ownBalls = activeBalls.filter(b => b.type === aiGroup);

                if (ownBalls.length > 0) {
                    // Still have own balls - target them
                    targetBalls = ownBalls;
                    console.log(`🤖 Targeting ${aiGroup}s (${ownBalls.length} remaining)`);
                } else {
                    // All own balls pocketed - target 8-ball
                    const eightBall = activeBalls.find(b => b.id === 8);
                    if (eightBall) {
                        targetBalls = [eightBall];
                        console.log('🤖 All own balls pocketed - targeting 8-BALL!');
                    }
                }
            }

            if (targetBalls.length === 0) {
                console.log('🤖 No valid target balls found');
                this.aiShotPending = false;
                return;
            }

            // Get pockets from physics
            const pockets = this.game.physics?.pockets || [
                { x: 40, y: 40 }, { x: 460, y: 40 }, { x: 880, y: 40 },
                { x: 40, y: 460 }, { x: 460, y: 460 }, { x: 880, y: 460 }
            ];

            const ballRadius = 14;
            const allBalls = freshBalls.filter(b => b.active && b.id !== 0);

            // Helper: Check if path is clear (no obstructing balls)
            const isPathClear = (fromX, fromY, toX, toY, excludeBallId) => {
                const dx = toX - fromX;
                const dy = toY - fromY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 1) return true;

                const dirX = dx / dist;
                const dirY = dy / dist;

                for (const ball of allBalls) {
                    if (ball.id === excludeBallId) continue;

                    // Vector from start to ball center
                    const toBallX = ball.x - fromX;
                    const toBallY = ball.y - fromY;

                    // Project onto direction
                    const projection = toBallX * dirX + toBallY * dirY;
                    if (projection < 0 || projection > dist) continue;

                    // Perpendicular distance
                    const perpDist = Math.abs(toBallX * (-dirY) + toBallY * dirX);
                    if (perpDist < ballRadius * 2.2) return false; // Path blocked
                }
                return true;
            };

            // Helper: Calculate optimal power for distance
            const calcPower = (distance) => Math.min(85, Math.max(40, 30 + distance * 0.12));

            // Find all possible shots with scoring
            let shots = [];

            for (const ball of targetBalls) {
                for (const pocket of pockets) {
                    // Vector from ball to pocket
                    const ballToPocketDx = pocket.x - ball.x;
                    const ballToPocketDy = pocket.y - ball.y;
                    const ballToPocketDist = Math.sqrt(ballToPocketDx * ballToPocketDx + ballToPocketDy * ballToPocketDy);

                    // Skip if ball is too far from pocket (>400 units)
                    if (ballToPocketDist > 400) continue;

                    // Direction to pocket (normalized)
                    const dirX = ballToPocketDx / ballToPocketDist;
                    const dirY = ballToPocketDy / ballToPocketDist;

                    // Ghost ball position (contact point)
                    const ghostX = ball.x - dirX * (ballRadius * 2);
                    const ghostY = ball.y - dirY * (ballRadius * 2);

                    // Vector from cue ball to ghost ball
                    const cueToGhostDx = ghostX - freshCueBall.x;
                    const cueToGhostDy = ghostY - freshCueBall.y;
                    const cueToGhostDist = Math.sqrt(cueToGhostDx * cueToGhostDx + cueToGhostDy * cueToGhostDy);

                    // Aim angle
                    const aimAngle = Math.atan2(cueToGhostDy, cueToGhostDx);

                    // Cut angle
                    const pocketAngle = Math.atan2(ballToPocketDy, ballToPocketDx);
                    let cutAngle = Math.abs(aimAngle - pocketAngle);
                    if (cutAngle > Math.PI) cutAngle = Math.PI * 2 - cutAngle;

                    // Skip impossible cuts (> 80 degrees)
                    if (cutAngle > Math.PI * 0.44) continue;

                    // Check if cue ball path to ghost ball is clear
                    const cueToBallClear = isPathClear(freshCueBall.x, freshCueBall.y, ghostX, ghostY, ball.id);

                    // Check if ball path to pocket is clear
                    const ballToPocketClear = isPathClear(ball.x, ball.y, pocket.x, pocket.y, ball.id);

                    if (!cueToBallClear || !ballToPocketClear) continue;

                    // Score this shot (higher = better)
                    const totalDist = cueToGhostDist + ballToPocketDist;
                    const distScore = 1000 / (totalDist + 1);
                    const cutScore = 300 * (1 - cutAngle / (Math.PI * 0.5));
                    const nearPocketBonus = ballToPocketDist < 100 ? 200 : 0;
                    const score = distScore + cutScore + nearPocketBonus;

                    shots.push({
                        ball,
                        pocket,
                        ghostBall: { x: ghostX, y: ghostY },
                        angle: aimAngle,
                        power: calcPower(cueToGhostDist),
                        cutAngle: cutAngle * 180 / Math.PI,
                        score,
                        cueToBallDist: cueToGhostDist,
                        ballToPocketDist
                    });
                }
            }

            // EXPERT AI: Add bank shot detection (bounce off cushion)
            const findBankShots = () => {
                const bankShots = [];
                const tableWidth = 960;
                const tableHeight = 500;
                const cushion = 25;

                for (const ball of targetBalls) {
                    for (const pocket of pockets) {
                        // Try each cushion (left, right, top, bottom)
                        const cushions = [
                            { axis: 'x', value: cushion, mirror: 2 * cushion },           // Left
                            { axis: 'x', value: tableWidth - cushion, mirror: 2 * (tableWidth - cushion) }, // Right
                            { axis: 'y', value: cushion, mirror: 2 * cushion },           // Top
                            { axis: 'y', value: tableHeight - cushion, mirror: 2 * (tableHeight - cushion) } // Bottom
                        ];

                        for (const cush of cushions) {
                            // Mirror pocket across cushion
                            let mirrorPocket;
                            if (cush.axis === 'x') {
                                mirrorPocket = { x: cush.mirror - pocket.x, y: pocket.y };
                            } else {
                                mirrorPocket = { x: pocket.x, y: cush.mirror - pocket.y };
                            }

                            // Calculate intersection with cushion (where bank happens)
                            const dx = mirrorPocket.x - ball.x;
                            const dy = mirrorPocket.y - ball.y;

                            let bankPoint;
                            if (cush.axis === 'x') {
                                const t = (cush.value - ball.x) / dx;
                                if (t > 0 && t < 1) {
                                    bankPoint = { x: cush.value, y: ball.y + t * dy };
                                }
                            } else {
                                const t = (cush.value - ball.y) / dy;
                                if (t > 0 && t < 1) {
                                    bankPoint = { x: ball.x + t * dx, y: cush.value };
                                }
                            }

                            if (!bankPoint) continue;
                            if (bankPoint.x < cushion || bankPoint.x > tableWidth - cushion) continue;
                            if (bankPoint.y < cushion || bankPoint.y > tableHeight - cushion) continue;

                            // Ghost ball for hitting ball toward bank point
                            const ballToBankDx = bankPoint.x - ball.x;
                            const ballToBankDy = bankPoint.y - ball.y;
                            const ballToBankDist = Math.sqrt(ballToBankDx ** 2 + ballToBankDy ** 2);

                            const ghostX = ball.x - (ballToBankDx / ballToBankDist) * (ballRadius * 2);
                            const ghostY = ball.y - (ballToBankDy / ballToBankDist) * (ballRadius * 2);

                            // Check paths
                            const cueToGhostClear = isPathClear(freshCueBall.x, freshCueBall.y, ghostX, ghostY, ball.id);
                            const ballToBankClear = isPathClear(ball.x, ball.y, bankPoint.x, bankPoint.y, ball.id);

                            if (!cueToGhostClear || !ballToBankClear) continue;

                            const cueToGhostDx = ghostX - freshCueBall.x;
                            const cueToGhostDy = ghostY - freshCueBall.y;
                            const cueToGhostDist = Math.sqrt(cueToGhostDx ** 2 + cueToGhostDy ** 2);

                            const totalDist = cueToGhostDist + ballToBankDist +
                                Math.sqrt((pocket.x - bankPoint.x) ** 2 + (pocket.y - bankPoint.y) ** 2);

                            // Bank shots get lower score (harder shots)
                            const score = 400 / (totalDist + 1);

                            bankShots.push({
                                ball,
                                pocket,
                                ghostBall: { x: ghostX, y: ghostY },
                                angle: Math.atan2(cueToGhostDy, cueToGhostDx),
                                power: Math.min(80, Math.max(50, 40 + totalDist * 0.1)),
                                cutAngle: 0,
                                score,
                                cueToBallDist: cueToGhostDist,
                                ballToPocketDist: totalDist,
                                isBank: true
                            });
                        }
                    }
                }
                return bankShots;
            };

            // Add bank shots to consideration (only if no good direct shots)
            if (shots.length === 0 || shots[0].score < 150) {
                const bankShots = findBankShots();
                shots.push(...bankShots);
                if (bankShots.length > 0) {
                    console.log(`🤖 Found ${bankShots.length} bank shot opportunities`);
                }
            }

            // Sort by score (best first)
            shots.sort((a, b) => b.score - a.score);

            let bestShot = shots[0];

            if (!bestShot) {
                // EXPERT SAFETY PLAY: Strategic defensive shot
                console.log('🤖 No pocketing shot - playing expert safety');

                // Strategy: Hit a ball and leave cue ball near a cushion
                // Also try to send target ball away from pockets

                let bestSafetyShot = null;
                let bestSafetyScore = -Infinity;

                for (const target of targetBalls) {
                    // Calculate angle to hit ball
                    const dx = target.x - freshCueBall.x;
                    const dy = target.y - freshCueBall.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);

                    if (!isPathClear(freshCueBall.x, freshCueBall.y, target.x, target.y, target.id)) {
                        continue;
                    }

                    // Check all pockets - safety is better if ball goes away from pockets
                    let minPocketDist = Infinity;
                    for (const pocket of pockets) {
                        const pDist = Math.sqrt((pocket.x - target.x) ** 2 + (pocket.y - target.y) ** 2);
                        if (pDist < minPocketDist) minPocketDist = pDist;
                    }

                    // Score: prefer hitting balls that are far from pockets
                    // Also prefer leaving cue ball at opposite end of table
                    const distScore = minPocketDist / 5; // Ball far from pockets = good
                    const cueBallScore = dist > 200 ? 20 : 0; // Long distance = harder for opponent
                    const score = distScore + cueBallScore;

                    if (score > bestSafetyScore) {
                        bestSafetyScore = score;
                        bestSafetyShot = {
                            ball: target,
                            angle: angle,
                            power: 30 + Math.random() * 15, // Soft but controlled
                            cutAngle: 0,
                            isSafety: true
                        };
                    }
                }

                if (bestSafetyShot) {
                    // Add draw spin to control cue ball (don't follow through)
                    bestSafetyShot.spinY = 0.5; // Draw back
                    bestShot = bestSafetyShot;
                    console.log(`🤖 Safety: hit ball ${bestShot.ball.id} softly with draw`);
                } else {
                    // Fallback: random target
                    const target = targetBalls[Math.floor(Math.random() * targetBalls.length)];
                    bestShot = {
                        ball: target,
                        angle: Math.atan2(target.y - freshCueBall.y, target.x - freshCueBall.x),
                        power: 30,
                        cutAngle: 0,
                        isSafety: true
                    };
                }
            }

            // EXPERT AI: Calculate strategic spin for position play
            const calculatePositionSpin = (shot, cueBall, remainingTargets, pockets) => {
                if (shot.isSafety || remainingTargets.length === 0) {
                    return { spinX: 0, spinY: 0 };
                }

                // Find the next best target ball after this shot
                let nextTarget = null;
                let bestNextScore = -Infinity;

                for (const ball of remainingTargets) {
                    if (ball.id === shot.ball.id) continue;
                    for (const pocket of pockets) {
                        const dist = Math.sqrt((pocket.x - ball.x) ** 2 + (pocket.y - ball.y) ** 2);
                        const score = 1000 / (dist + 1);
                        if (score > bestNextScore) {
                            bestNextScore = score;
                            nextTarget = ball;
                        }
                    }
                }

                if (!nextTarget) return { spinX: 0, spinY: 0 };

                // Calculate where cue ball will naturally go after impact
                const impactAngle = shot.angle;
                const cutAngleRad = (shot.cutAngle || 0) * Math.PI / 180;

                // For thin cuts, cue ball deflects more; for straight shots, follows through
                // Use draw (backspin) for control on most shots
                // Use follow (topspin) when next ball is in front

                let spinY = 0; // Topspin(-) / Backspin(+)
                let spinX = 0; // English

                // If cut angle is small (< 30°), use follow to continue forward
                if (cutAngleRad < 0.5) {
                    spinY = -0.4; // Follow/topspin
                }
                // Medium cuts (30-50°), use slight draw
                else if (cutAngleRad < 0.9) {
                    spinY = 0.3; // Draw
                }
                // Sharp cuts, use strong draw to pull back
                else {
                    spinY = 0.6; // Strong draw
                }

                // Position adjustment: if next target is to the side, add english
                if (nextTarget) {
                    const ghostBall = shot.ghostBall || { x: shot.ball.x, y: shot.ball.y };
                    const nextAngle = Math.atan2(nextTarget.y - ghostBall.y, nextTarget.x - ghostBall.x);
                    const angleDiff = nextAngle - impactAngle;

                    // Add side spin to help with positioning
                    if (angleDiff > 0.3) spinX = 0.3;  // Right english
                    else if (angleDiff < -0.3) spinX = -0.3; // Left english
                }

                return { spinX, spinY };
            };

            // Get spin for this shot
            const spin = calculatePositionSpin(bestShot, freshCueBall, targetBalls, pockets);

            // EXPERT DIFFICULTY: Perfect aim with strategic spin
            const finalAngle = bestShot.angle;
            const finalPower = bestShot.power;

            const spinInfo = `spin=(${spin.spinX.toFixed(1)},${spin.spinY.toFixed(1)})`;
            const shotType = bestShot.isSafety ? 'SAFETY' : `cut=${bestShot.cutAngle.toFixed(0)}°, ${spinInfo}`;
            console.log(`🤖 EXPERT AI: ball ${bestShot.ball.id} → pocket, ${shotType}, power=${finalPower.toFixed(0)}%`);

            // Execute AI shot with spin
            this.game.gameState = 'shooting';
            this.game.shotPocketedBalls = [];
            this.game.wasMyShot = false;

            this.game.physics.applyShot(freshCueBall, finalAngle, finalPower, spin.spinX, spin.spinY);

            if (this.game.sound) {
                this.game.sound.playCueHit(finalPower);
            }

            console.log('🤖 AI shot executed');
            this.aiShotPending = false;

            // Wait for balls to stop and handle result LOCALLY (don't use checkShotResult which talks to server)
            this.waitForAiShotComplete();
        }, thinkingTime);
    }

    // Wait for AI shot to complete and determine if AI continues or switches turn
    waitForAiShotComplete() {
        if (!this.game.physics.allBallsStopped(this.game.balls)) {
            setTimeout(() => this.waitForAiShotComplete(), 100);
            return;
        }

        console.log('🤖 AI shot complete - balls stopped');

        // Reset ball velocities
        this.game.balls.forEach(ball => {
            if (ball.active) {
                ball.vx = 0;
                ball.vy = 0;
                ball.spinX = 0;
                ball.spinY = 0;
            }
        });

        // Get AI's player number and group
        const aiPlayerNum = this.myPlayerNumber === 1 ? 2 : 1;
        const aiGroup = this.game.playerTypes ? this.game.playerTypes[aiPlayerNum] : null;

        // Check what balls were pocketed this shot (tracked in shotPocketedBalls)
        const pocketedBalls = this.game.shotPocketedBalls || [];
        console.log(`🤖 Pocketed balls this shot:`, pocketedBalls.map(b => `${b.id}(${b.type})`));

        // Check if 8-ball was pocketed - GAME OVER
        const eightBallPocketed = pocketedBalls.some(b => b.id === 8);
        if (eightBallPocketed) {
            // Check if AI won or lost
            const aiHadAllBallsCleared = this.game.balls.filter(b =>
                b.id > 0 && b.id !== 8 && b.type === aiGroup && b.active
            ).length === 0;

            if (aiHadAllBallsCleared && !pocketedBalls.some(b => b.id === 0)) {
                // AI cleared all its balls and pocketed 8-ball legally - AI WINS
                console.log('🤖 AI pocketed 8-ball legally - AI WINS!');
                const aiWinnerNum = this.myPlayerNumber === 1 ? 2 : 1;
                this.game.onGameOver({ winner: aiWinnerNum, reason: 'AI pocketed the 8-ball!' });
            } else {
                // AI pocketed 8-ball illegally - HUMAN WINS
                console.log('🏆 AI pocketed 8-ball early - YOU WIN!');
                this.game.onGameOver({ winner: this.myPlayerNumber, reason: 'Opponent pocketed 8-ball early!' });
            }
            return;
        }

        // Check if cue ball was pocketed (scratch/foul)
        const cueBallPocketed = pocketedBalls.some(b => b.id === 0);
        if (cueBallPocketed) {
            console.log('🎱 AI scratched! You get ball-in-hand');
            // Restore cue ball for human's ball-in-hand
            const cueBall = this.game.balls.find(b => b.id === 0);
            if (cueBall) {
                cueBall.active = true;
                cueBall.x = this.game.tableWidth * 0.25;
                cueBall.y = this.game.tableHeight / 2;
                cueBall.vx = 0;
                cueBall.vy = 0;
            }
            this.game.ballInHand = true;
            this.game.gameState = 'aiming';
            this.switchToHumanTurn(true); // Pass foul=true
            return;
        }

        // Check if AI pocketed any of its own balls
        let aiContinues = false;

        if (!aiGroup || this.game.tableState === 'open') {
            // Open table - AI continues if pocketed any non-8-ball
            const legalPockets = pocketedBalls.filter(b => b.id !== 0 && b.id !== 8);
            if (legalPockets.length > 0) {
                // Assign group based on what was pocketed
                const pocketedBall = legalPockets[0];
                this.game.playerTypes[aiPlayerNum] = pocketedBall.type;
                const humanPlayerNum = this.myPlayerNumber;
                this.game.playerTypes[humanPlayerNum] = pocketedBall.type === 'solid' ? 'stripe' : 'solid';
                this.game.tableState = 'closed';
                console.log(`🤖 AI assigned to ${pocketedBall.type}s, continues turn!`);
                aiContinues = true;
            }
        } else {
            // Closed table - AI continues if pocketed its own group
            const ownBallsPocketed = pocketedBalls.filter(b => b.type === aiGroup);
            if (ownBallsPocketed.length > 0) {
                console.log(`🤖 AI pocketed ${ownBallsPocketed.length} ${aiGroup}(s), continues turn!`);
                aiContinues = true;
            }
        }

        if (aiContinues) {
            // AI continues - trigger another AI turn
            console.log('🤖 AI continues its turn...');
            setTimeout(() => {
                this.executeAiTurn({});
            }, 500);
        } else {
            // AI didn't pocket anything, switch to human
            console.log(`🤖 AI didn't pocket. Your turn!`);
            this.switchToHumanTurn();
        }
    }

    // Helper to switch to human player's turn by notifying server
    switchToHumanTurn(isFoul = false) {
        console.log(`🤖 Sending AI shot result to server (foul=${isFoul})...`);

        // Tell server that AI's shot is done
        if (this.socket && this.roomId) {
            this.socket.emit('shot_result', {
                roomId: this.roomId,
                foul: isFoul,
                continueTurn: false,
                pocketedBalls: this.game.shotPocketedBalls || [],
                tableOpen: this.game.tableState === 'open',
                playerTypes: this.game.playerTypes,
                isBreakShot: false,
                isAiShot: true,
                ballInHand: isFoul // Opponent gets ball-in-hand if foul
            });
            console.log('🤖 AI shot_result sent to server');
        }

        // If foul, set up ball-in-hand for human immediately
        if (isFoul) {
            this.game.ballInHand = true;
            this.game.currentPlayer = this.myPlayerNumber;
            this.game.isMyTurn = true;
            this.game.gameState = 'aiming';
            this.game.updateTurnIndicator();
            this.game.startShotTimer();
            console.log('🎱 Ball-in-hand granted! Drag cue ball to position.');
        } else {
            // Normal turn switch - wait for server confirmation
            this.game.gameState = 'waiting';
            console.log('⏳ Waiting for server to confirm turn switch...');
        }
    }

    // Helper: Find the best ball for AI to target (for ball-in-hand positioning)
    findBestBallForAi(balls) {
        const aiPlayerNum = this.myPlayerNumber === 1 ? 2 : 1;
        const aiGroup = this.game.playerTypes ? this.game.playerTypes[aiPlayerNum] : null;

        let targetBalls = balls.filter(b => b.id > 0 && b.active);

        if (!aiGroup || this.game.tableState === 'open') {
            // Open table - target any non-8-ball
            targetBalls = targetBalls.filter(b => b.id !== 8);
        } else {
            // Closed table
            const ownBalls = targetBalls.filter(b => b.type === aiGroup);
            if (ownBalls.length > 0) {
                targetBalls = ownBalls;
            } else {
                // Go for 8-ball
                const eightBall = targetBalls.find(b => b.id === 8);
                return eightBall || targetBalls[0];
            }
        }

        // Find ball closest to any pocket
        const pockets = this.game.physics?.pockets || [
            { x: 40, y: 40 }, { x: 460, y: 40 }, { x: 880, y: 40 },
            { x: 40, y: 460 }, { x: 460, y: 460 }, { x: 880, y: 460 }
        ];

        let bestBall = null;
        let bestDist = Infinity;

        for (const ball of targetBalls) {
            for (const pocket of pockets) {
                const dist = Math.sqrt((pocket.x - ball.x) ** 2 + (pocket.y - ball.y) ** 2);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestBall = ball;
                }
            }
        }

        return bestBall || targetBalls[0];
    }

    // Check if current player is shooting at 8-ball (all own balls cleared)
    isShootingAtEightBall() {
        if (!this.game || !this.game.balls) return false;

        const myGroup = this.game.playerTypes ? this.game.playerTypes[this.myPlayerNumber] : null;
        if (!myGroup) return false;

        // Check if all balls of my group are pocketed
        const myBallsRemaining = this.game.balls.filter(b =>
            b.id > 0 && b.id !== 8 && b.type === myGroup && b.active
        ).length;

        return myBallsRemaining === 0;
    }

    // Create pocket call overlay UI - just show message, use existing table pockets
    createPocketCallOverlay() {
        if (this.pocketCallOverlay) return;

        // Get table container for positioning
        const tableContainer = document.getElementById('table-container');
        if (!tableContainer) {
            console.log('Table container not found');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'pocket-call-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.2);
            z-index: 100;
            cursor: pointer;
        `;

        // Title message at center
        const title = document.createElement('div');
        title.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ffd700;
            font-size: 22px;
            font-weight: bold;
            text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(255,215,0,0.5);
            pointer-events: none;
            white-space: nowrap;
        `;
        title.textContent = '🎱 TAP A POCKET';
        overlay.appendChild(title);

        // Handle click on overlay - detect which pocket based on click position
        overlay.addEventListener('click', (e) => {
            const rect = overlay.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            // Determine pocket by position (6 pockets)
            // Top row: left <20%, center 40-60%, right >80%
            // Bottom row: left <20%, center 40-60%, right >80%
            let pocketId = null;

            if (y < 0.25) {
                // Top row
                if (x < 0.2) pocketId = 0;       // Top left
                else if (x > 0.4 && x < 0.6) pocketId = 1;  // Top center
                else if (x > 0.8) pocketId = 2;  // Top right
            } else if (y > 0.75) {
                // Bottom row
                if (x < 0.2) pocketId = 3;       // Bottom left
                else if (x > 0.4 && x < 0.6) pocketId = 4;  // Bottom center
                else if (x > 0.8) pocketId = 5;  // Bottom right
            }

            if (pocketId !== null) {
                this.selectPocket(pocketId);
            }
        });

        tableContainer.appendChild(overlay);
        this.pocketCallOverlay = overlay;
    }

    // Show pocket call overlay for human player
    showPocketCallOverlay() {
        console.log('🎱 Showing pocket call overlay');
        this.createPocketCallOverlay();
        this.pocketCallOverlay.style.display = 'block';
        this.needsPocketCall = true;
    }

    // Hide pocket call overlay
    hidePocketCallOverlay() {
        if (this.pocketCallOverlay) {
            this.pocketCallOverlay.style.display = 'none';
        }
        this.needsPocketCall = false;
    }

    // Human selects a pocket
    selectPocket(pocketId) {
        console.log(`🎯 Pocket ${pocketId} selected`);
        this.calledPocket = pocketId;
        this.hidePocketCallOverlay();

        // Resume game - player can now aim and shoot
        if (this.game) {
            this.game.needsCallPocket = false;
            this.game.gameState = 'aiming';
            this.game.startShotTimer();
            console.log('🎱 Pocket called - you can now shoot at the 8-ball!');
        }
    }

    // AI selects the best pocket for 8-ball
    aiSelectPocket(eightBall) {
        const pockets = this.game.physics?.pockets || [
            { x: 40, y: 40 }, { x: 460, y: 40 }, { x: 880, y: 40 },
            { x: 40, y: 460 }, { x: 460, y: 460 }, { x: 880, y: 460 }
        ];

        // Find closest pocket to 8-ball
        let closestPocket = 0;
        let minDist = Infinity;
        for (let i = 0; i < pockets.length; i++) {
            const dist = Math.sqrt(
                (pockets[i].x - eightBall.x) ** 2 +
                (pockets[i].y - eightBall.y) ** 2
            );
            if (dist < minDist) {
                minDist = dist;
                closestPocket = i;
            }
        }

        this.calledPocket = closestPocket;
        console.log(`🤖 AI calls pocket ${closestPocket}`);
        return closestPocket;
    }
}

// Make available globally
window.NetworkManager = NetworkManager;

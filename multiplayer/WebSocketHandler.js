/**
 * WebSocket Handler for 8-Ball Pool Multiplayer
 * Handles all real-time game communication
 */

const { RoomManager } = require('./RoomManager');
const { MatchmakingQueue, EloCalculator } = require('./MatchmakingQueue');
const { MatchHistory } = require('./MatchHistory');
const { AchievementManager } = require('./Achievements');

class MultiplayerServer {
    constructor(io, users, saveUsersCallback = null) {
        this.io = io;
        this.users = users; // Reference to user database
        this.saveUsersCallback = saveUsersCallback; // Callback to persist user data
        this.roomManager = new RoomManager();
        this.matchmaking = new MatchmakingQueue(this.roomManager);
        this.matchmaking.setUsersData(Array.from(this.users.values()));
        this.matchHistory = new MatchHistory();
        this.achievements = new AchievementManager();
        this.connectedPlayers = new Map(); // socketId -> playerData
        this.disconnectedPlayers = new Map(); // oderId -> { playerData, roomId, timeout, disconnectTime }
        this.RECONNECT_TIMEOUT = 30000; // 30 seconds to reconnect

        this.setupSocketHandlers();
        this.startBackgroundTasks();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🎱 Player connected: ${socket.id}`);

            // Auth events
            socket.on('authenticate', (data) => this.handleAuthenticate(socket, data));

            // Room events
            socket.on('create_room', (data) => this.handleCreateRoom(socket, data));
            socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
            socket.on('leave_room', () => this.handleLeaveRoom(socket));
            socket.on('spectate_room', (data) => this.handleSpectate(socket, data));
            socket.on('get_rooms', () => this.handleGetRooms(socket));
            socket.on('get_active_games', () => this.handleGetActiveGames(socket));

            // Matchmaking events
            socket.on('find_match', (data) => this.handleFindMatch(socket, data));
            socket.on('cancel_matchmaking', () => this.handleCancelMatchmaking(socket));
            socket.on('get_queue_status', () => this.handleGetQueueStatus(socket));

            // Game events
            socket.on('ready', () => this.handleReady(socket));
            socket.on('aim_update', (data) => this.handleAimUpdate(socket, data));
            socket.on('take_shot', (data) => this.handleTakeShot(socket, data));
            socket.on('shot_result', (data) => this.handleShotResult(socket, data));
            socket.on('cue_ball_placed', (data) => this.handleCueBallPlaced(socket, data));
            socket.on('request_rematch', () => this.handleRematchRequest(socket));
            socket.on('accept_rematch', () => this.handleRematchAccept(socket));

            // Chat events
            socket.on('chat_message', (data) => this.handleChatMessage(socket, data));
            socket.on('quick_chat', (data) => this.handleQuickChat(socket, data));

            // Social events
            socket.on('get_leaderboard', (data) => this.handleGetLeaderboard(socket, data));
            socket.on('get_match_history', (data) => this.handleGetMatchHistory(socket, data));
            socket.on('get_achievements', () => this.handleGetAchievements(socket));

            // Disconnect
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
    }

    // === Authentication ===
    handleAuthenticate(socket, data) {
        const { token, user } = data;
        if (!user) {
            socket.emit('auth_error', { error: 'Invalid authentication' });
            return;
        }

        // Store player data (include profile info for opponent display)
        const playerData = {
            id: socket.id,
            oderId: user.id,
            username: user.username,
            email: user.email,
            walletAddress: user.walletAddress,  // CRITICAL for balance updates!
            elo: user.elo || 1200,
            coins: user.coins || 1000,
            tainBalance: user.tainBalance || 0,
            profilePicture: user.profilePicture || null,
            nationality: user.nationality || null
        };

        this.connectedPlayers.set(socket.id, playerData);
        console.log(`🔐 Auth: ${user.username} profilePicture: ${user.profilePicture || 'NONE'}`);

        // Check for reconnection to ongoing game
        const disconnectData = this.disconnectedPlayers.get(user.id || user.email);
        if (disconnectData) {
            console.log(`🔄 Player ${user.username} reconnecting to game in room ${disconnectData.roomId}`);

            // Clear the forfeit timeout
            if (disconnectData.timeout) {
                clearTimeout(disconnectData.timeout);
            }

            // Remove from disconnected list
            this.disconnectedPlayers.delete(user.id || user.email);

            // Get the room
            const room = this.roomManager.getRoom(disconnectData.roomId);
            if (room && room.status === 'playing') {
                // Rejoin the room
                socket.join(room.id);

                // Update room with new socket ID
                if (disconnectData.playerNumber === 1) {
                    room.host.id = socket.id;
                } else {
                    room.guest.id = socket.id;
                }

                // Notify reconnection
                this.io.to(room.id).emit('opponent_reconnected', {
                    reconnectedPlayer: user.username,
                    playerNumber: disconnectData.playerNumber
                });

                // Send game state to reconnected player
                socket.emit('game_rejoin', {
                    roomId: room.id,
                    gameState: room.gameState,
                    host: room.host,
                    guest: room.guest,
                    wager: room.wager,
                    myPlayerNumber: disconnectData.playerNumber
                });

                socket.emit('authenticated', {
                    success: true,
                    playerId: socket.id,
                    reconnected: true,
                    roomId: room.id,
                    stats: this.roomManager.getStats(),
                    queueStats: this.matchmaking.getQueueStats()
                });

                console.log(`✅ Player ${user.username} successfully reconnected to room ${room.id}`);
                return;
            }
        }

        socket.emit('authenticated', {
            success: true,
            playerId: socket.id,
            stats: this.roomManager.getStats(),
            queueStats: this.matchmaking.getQueueStats()
        });

        console.log(`🔐 Player authenticated: ${user.username}`);
    }

    // === Room Management ===
    handleCreateRoom(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const wager = data?.wager || 50;
        const currency = data?.currency || 'coins';

        // Check if player has enough balance
        const balance = currency === 'coins' ? player.coins : player.tainBalance;
        if (balance < wager) {
            socket.emit('room_error', { error: `Insufficient ${currency}` });
            return;
        }

        const room = this.roomManager.createRoom(player, wager, currency);
        socket.emit('room_created', {
            roomId: room.id,
            room: room.toJSON()
        });

        console.log(`🏠 Room created: ${room.id} by ${player.username}`);
    }

    handleJoinRoom(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const { roomId } = data;
        const result = this.roomManager.joinRoom(roomId, player);

        if (result.error) {
            socket.emit('room_error', { error: result.error });
            return;
        }

        const room = result.room;
        socket.join(room.id);

        // Handle rejoin - player was already in this room
        if (result.rejoin && room.status === 'playing') {
            console.log(`🔄 ${player.username} rejoined active game in room ${roomId}`);
            socket.emit('game_start', {
                roomId: room.id,
                gameState: room.gameState,
                currentPlayer: room.gameState?.currentPlayer || 1,
                host: room.host,
                guest: room.guest,
                wager: room.wager
            });
            return;
        }

        // Check if player has enough coins/tain (only for new joins)
        if (!result.rejoin) {
            const balance = room.currency === 'coins' ? player.coins : player.tainBalance;
            if (balance < room.wager) {
                this.roomManager.leaveRoom(player.id);
                socket.emit('room_error', { error: `Insufficient ${room.currency}` });
                return;
            }
        }

        // Notify both players
        this.io.to(room.id).emit('player_joined', {
            roomId: room.id,
            room: room.toJSON()
        });

        console.log(`👤 ${player.username} joined room ${roomId}`);
    }

    handleSpectate(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const { roomId } = data;
        const result = this.roomManager.spectateRoom(roomId, player);

        if (result.error) {
            socket.emit('spectate_error', { error: result.error });
            return;
        }

        socket.join(roomId);
        socket.emit('spectating', {
            roomId,
            room: result.room.toJSON()
        });

        // Notify room
        this.io.to(roomId).emit('spectator_joined', {
            username: player.username,
            count: result.room.spectators.length
        });
    }

    handleLeaveRoom(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.leaveRoom(player.id);
        if (room) {
            socket.leave(room.id);

            // Notify remaining players
            if (room.status === 'finished') {
                this.io.to(room.id).emit('opponent_disconnected', {
                    winner: room.winner,
                    reason: 'forfeit'
                });
            } else {
                this.io.to(room.id).emit('player_left', {
                    playerId: player.id,
                    room: room.toJSON()
                });
            }
        }
    }

    handleGetRooms(socket) {
        const rooms = this.roomManager.getAvailableRooms();
        socket.emit('rooms_list', { rooms });
    }

    handleGetActiveGames(socket) {
        const games = this.roomManager.getActiveGames();
        socket.emit('active_games', { games });
    }

    // === Matchmaking ===
    handleFindMatch(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const tier = data?.tier || 'casual';
        const currency = data?.currency || 'coins';
        const stake = data?.stake || 0;

        // Update player data with latest request info
        player.currency = currency;
        player.stake = stake;

        const result = this.matchmaking.addPlayer(player, tier, currency, stake);

        if (result.error) {
            socket.emit('matchmaking_error', { error: result.error });
            return;
        }

        if (result.matched) {
            // Match found!
            const room = this.roomManager.getRoom(result.roomId);

            // Join both players to room
            socket.join(result.roomId);
            console.log(`📌 Socket ${socket.id} (${player.username}) joined room ${result.roomId}`);

            // Find opponent socket
            const opponentSocketId = result.opponent.id;
            const opponentSocket = this.io.sockets.sockets.get(opponentSocketId);
            if (opponentSocket) {
                opponentSocket.join(result.roomId);
                console.log(`📌 Socket ${opponentSocketId} (${result.opponent.username}) joined room ${result.roomId}`);
            } else {
                console.error(`❌ Could not find opponent socket: ${opponentSocketId}`);
            }

            // Verify room members
            const roomSockets = this.io.sockets.adapter.rooms.get(result.roomId);
            console.log(`📊 Room ${result.roomId} has ${roomSockets ? roomSockets.size : 0} members:`, roomSockets ? [...roomSockets] : []);

            // Notify both players
            this.io.to(result.roomId).emit('match_found', {
                roomId: result.roomId,
                room: room.toJSON(),
                room: room.toJSON(),
                wager: result.wager,
                currency: result.currency,
                tier: result.tier
            });

            console.log(`⚡ Match found: ${player.username} vs ${result.opponent.username}`);

            // AUTO-START: Start game automatically after 2 seconds
            setTimeout(() => {
                const currentRoom = this.roomManager.getRoom(result.roomId);
                if (currentRoom && (currentRoom.status === 'ready' || currentRoom.status === 'waiting')) {
                    const gameState = currentRoom.startGame();

                    this.io.to(result.roomId).emit('game_start', {
                        roomId: currentRoom.id,
                        gameState,
                        currentPlayer: 1,
                        host: currentRoom.host,
                        guest: currentRoom.guest,
                        wager: currentRoom.wager
                    });

                    console.log(`🎮 Game auto-started in room ${currentRoom.id}`);
                }
            }, 2000);
        } else {
            socket.emit('matchmaking_started', {
                position: result.position,
                tier: result.tier,
                estimatedWait: result.estimatedWait
            });

            console.log(`🔍 ${player.username} searching for match...`);
        }
    }

    handleCancelMatchmaking(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const removed = this.matchmaking.removePlayer(player.id);
        socket.emit('matchmaking_cancelled', { success: removed });
    }

    handleGetQueueStatus(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const status = this.matchmaking.getPlayerStatus(player.id);
        socket.emit('queue_status', status || { inQueue: false });
    }

    // === Game Events ===
    handleReady(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'ready') return;

        // Start the game
        const gameState = room.startGame();

        this.io.to(room.id).emit('game_start', {
            roomId: room.id,
            gameState,
            currentPlayer: 1,
            host: room.host,
            guest: room.guest,
            wager: room.wager
        });

        console.log(`🎮 Game started in room ${room.id}`);
    }

    handleAimUpdate(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'playing') return;

        // Broadcast aim to opponent and spectators
        socket.to(room.id).emit('opponent_aim', {
            angle: data.angle,
            power: data.power,
            spinX: data.spinX,
            spinY: data.spinY
        });
    }

    handleTakeShot(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            console.log(`❌ take_shot: No player found for socket ${socket.id}`);
            return;
        }

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'playing') {
            console.log(`❌ take_shot: No room or wrong status - room: ${room?.id}, status: ${room?.status}`);
            return;
        }

        console.log(`🎯 take_shot from ${player.username} in room ${room.id}`);
        const playerNum = room.getPlayerNumber(player.id);
        console.log(`   - Player Number: ${playerNum} (ID: ${player.id})`);

        const result = room.processShot(player.id, data);

        if (result.error) {
            console.log(`❌ Shot error: ${result.error}`);
            socket.emit('shot_error', { error: result.error });
            return;
        }

        // Broadcast shot to all in room
        const roomSockets = this.io.sockets.adapter.rooms.get(room.id);
        const socketsInRoom = roomSockets ? [...roomSockets] : [];
        console.log(`📊 Broadcasting shot to room ${room.id} (Individual Send)`);

        const shotData = {
            player: room.getPlayerNumber(player.id),
            shot: result.shot
        };

        // Send to each socket in room individually to ensure delivery
        for (const socketId of socketsInRoom) {
            const targetSocket = this.io.sockets.sockets.get(socketId);
            if (targetSocket) {
                console.log(`   📤 Sending shot_taken to socket ${socketId}`);
                targetSocket.emit('shot_taken', shotData);
            } else {
                console.log(`   ⚠️ Socket ${socketId} not found!`);
            }
        }
    }

    handleShotResult(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'playing') return;

        // Accept results from the player who just shot (current player)
        // Exception: Accept AI shot results from human player in AI matches
        const playerNum = room.getPlayerNumber(player.id);
        const isAiMatch = room.isAiMatch || false;
        const isAiShot = data.isAiShot || false;

        console.log(`🔍 Shot result check: playerNum=${playerNum}, currentPlayer=${room.gameState.currentPlayer}, isAiMatch=${isAiMatch}, isAiShot=${isAiShot}`);

        if (playerNum !== room.gameState.currentPlayer) {
            // In AI matches, allow human to send shot results on AI's behalf
            if (isAiMatch && isAiShot) {
                console.log(`🤖 Accepting AI shot_result from human player (AI match proxy)`);
            } else {
                console.log(`⚠️ Ignoring shot_result from player ${playerNum}, expected from ${room.gameState.currentPlayer}`);
                return;
            }
        }

        console.log(`📊 Processing shot result from Player ${playerNum}`);

        // Update ball positions
        if (data.balls) {
            room.updateBallPositions(data.balls);
        }

        // Process shot result (this will handle turn switching)
        const result = room.handleShotResult(data);

        if (result.gameOver) {
            // Broadcast game over to all players
            this.io.to(room.id).emit('game_state_update', {
                gameState: room.gameState,
                balls: data.balls,
                gameOver: true,
                winner: result.winner,
                reason: result.reason
            });
            this.handleGameOver(room, result);
        } else {
            // Broadcast game state update with ball positions
            console.log(`📤 Broadcasting game state: Current Player = ${room.gameState.currentPlayer}`);
            this.io.to(room.id).emit('game_state_update', {
                gameState: room.gameState,
                balls: data.balls,  // Send ball positions at top level for easy access
                lastResult: data
            });
        }
    }

    handleCueBallPlaced(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || !room.gameState.ballInHand) return;

        // Validate it's this player's turn
        if (room.getPlayerNumber(player.id) !== room.gameState.currentPlayer) return;

        room.placeCueBall(data.x, data.y);

        this.io.to(room.id).emit('cue_ball_placed', {
            x: data.x,
            y: data.y,
            player: room.getPlayerNumber(player.id)
        });
    }

    handleGameOver(room, result) {
        const winnerNum = result.winner;
        const winner = winnerNum === 1 ? room.host : room.guest;
        const loser = winnerNum === 1 ? room.guest : room.host;

        console.log(`🏁 Game Over: Room ${room.id}`);
        console.log(`   Wager: ${room.wager} ${room.currency}`);
        console.log(`   Winner: ${winner?.username} (email: ${winner?.email})`);
        console.log(`   Loser: ${loser?.username} (email: ${loser?.email})`);

        // Calculate ELO changes
        const eloResult = EloCalculator.calculateNewRatings(
            winner.elo || 1200,
            loser.elo || 1200
        );

        // Update player ELO and coins/tain in memory
        winner.elo = eloResult.winner.newElo;
        loser.elo = eloResult.loser.newElo;

        if (room.currency === 'coins') {
            winner.coins = (winner.coins || 1000) + room.wager;
            loser.coins = Math.max(0, (loser.coins || 1000) - room.wager);
        } else {
            winner.tainBalance = (winner.tainBalance || 0) + room.wager;
            loser.tainBalance = Math.max(0, (loser.tainBalance || 0) - room.wager);
        }

        // Update in user database
        this.updateUserStats(winner, loser, room.wager, eloResult, room.currency);

        // Save match history
        const matchRecord = this.matchHistory.recordMatch({
            roomId: room.id,
            host: room.host,
            guest: room.guest,
            winner: winnerNum,
            reason: result.reason || '8ball',
            wager: room.wager,
            currency: room.currency || 'coins',
            eloChanges: eloResult,
            shotHistory: room.gameState.shotHistory,
            duration: Date.now() - room.createdAt
        });

        // Check achievements
        const winnerAchievements = this.achievements.checkAchievements(winner, matchRecord, true);
        const loserAchievements = this.achievements.checkAchievements(loser, matchRecord, false);

        // Emit game over
        this.io.to(room.id).emit('game_over', {
            winner: winnerNum,
            winnerName: winner.username,
            reason: result.reason,
            wager: room.wager,
            currency: room.currency || 'coins',
            eloChanges: eloResult,
            matchId: matchRecord.id,
            achievements: {
                winner: winnerAchievements,
                loser: loserAchievements
            }
        });

        console.log(`🏆 Game over in room ${room.id}: ${winner.username} wins!`);
    }

    updateUserStats(winner, loser, wager, eloResult, currency = 'coins') {
        console.log(`\n💰 ========== BALANCE UPDATE ==========`);
        console.log(`   Wager: ${wager} ${currency}`);
        console.log(`   Winner: ${winner?.username}`);
        console.log(`   Winner email: ${winner?.email}`);
        console.log(`   Winner wallet: ${winner?.walletAddress}`);
        console.log(`   Winner oderId: ${winner?.oderId}`);
        console.log(`   Winner isBot: ${winner?.isBot}`);
        console.log(`   Loser: ${loser?.username}`);
        console.log(`   Loser email: ${loser?.email}`);
        console.log(`   Loser isBot: ${loser?.isBot}`);
        console.log(`   Total users in database: ${this.users.size}`);

        // FIX: Better AI detection - only AI if isBot=true or (no oderId AND username starts with AI_)
        // A player with oderId is ALWAYS a real user from the database
        const isAiWinner = winner?.isBot === true ||
            (!winner?.oderId && !winner?.email && winner?.username?.startsWith('AI_'));
        const isAiLoser = loser?.isBot === true ||
            (!loser?.oderId && !loser?.email && loser?.username?.startsWith('AI_'));

        console.log(`   Is AI winner: ${isAiWinner}, Is AI loser: ${isAiLoser}`);

        // Comprehensive user finder with multiple fallbacks
        const findUser = (player) => {
            if (!player) {
                console.log(`   findUser: player is null`);
                return null;
            }

            console.log(`   findUser: Looking for ${player.username}...`);

            // Method 1: Direct email lookup
            if (player.email && this.users.has(player.email)) {
                console.log(`   findUser: ✓ Found by email: ${player.email}`);
                return this.users.get(player.email);
            }

            // Method 2: Wallet address search
            if (player.walletAddress) {
                for (const [email, user] of this.users) {
                    if (user.walletAddress === player.walletAddress) {
                        console.log(`   findUser: ✓ Found by wallet: ${player.walletAddress}`);
                        return user;
                    }
                }
            }

            // Method 3: User ID search
            if (player.oderId) {
                for (const [email, user] of this.users) {
                    if (user.id === player.oderId) {
                        console.log(`   findUser: ✓ Found by oderId: ${player.oderId}`);
                        return user;
                    }
                }
            }

            // Method 4: Username search (last resort)
            if (player.username) {
                for (const [email, user] of this.users) {
                    if (user.username === player.username) {
                        console.log(`   findUser: ✓ Found by username: ${player.username}`);
                        return user;
                    }
                }
            }

            console.log(`   findUser: ✗ NOT FOUND for ${player.username}`);
            console.log(`   Searched with: email=${player.email}, wallet=${player.walletAddress}, oderId=${player.oderId}`);
            return null;
        };

        // Update winner stats
        if (!isAiWinner) {
            const user = findUser(winner);
            if (user) {
                const oldBalance = currency === 'coins' ? (user.coins || 0) : (user.tainBalance || 0);
                user.elo = eloResult.winner.newElo;
                if (currency === 'coins') {
                    user.coins = (user.coins || 0) + wager;
                    console.log(`   ✅ WINNER ${winner.username}: coins ${oldBalance} → ${user.coins} (+${wager})`);
                } else {
                    user.tainBalance = (user.tainBalance || 0) + wager;
                    console.log(`   ✅ WINNER ${winner.username}: TAIN ${oldBalance} → ${user.tainBalance} (+${wager})`);
                }
                user.gamesPlayed = (user.gamesPlayed || 0) + 1;
                user.gamesWon = (user.gamesWon || 0) + 1;
            } else {
                console.log(`   ❌ FAILED: Winner ${winner.username} NOT FOUND in database!`);
            }
        } else {
            console.log(`   🤖 AI won - no balance update needed`);
        }

        // Update loser stats
        if (!isAiLoser) {
            const user = findUser(loser);
            if (user) {
                const oldBalance = currency === 'coins' ? (user.coins || 0) : (user.tainBalance || 0);
                user.elo = eloResult.loser.newElo;
                if (currency === 'coins') {
                    user.coins = Math.max(0, (user.coins || 0) - wager);
                    console.log(`   ❌ LOSER ${loser.username}: coins ${oldBalance} → ${user.coins} (-${wager})`);
                } else {
                    user.tainBalance = Math.max(0, (user.tainBalance || 0) - wager);
                    console.log(`   ❌ LOSER ${loser.username}: TAIN ${oldBalance} → ${user.tainBalance} (-${wager})`);
                }
                user.gamesPlayed = (user.gamesPlayed || 0) + 1;
            } else {
                console.log(`   ❌ FAILED: Loser ${loser?.username} NOT FOUND in database!`);
            }
        } else {
            console.log(`   🤖 AI lost - no balance deduction needed`);
        }

        // Persist changes
        if (this.saveUsersCallback) {
            this.saveUsersCallback();
            console.log(`   💾 Changes saved to disk`);
        } else {
            console.log(`   ⚠️ WARNING: No saveUsersCallback - changes NOT persisted!`);
        }
        console.log(`💰 ======================================\n`);
    }

    // === Chat ===
    handleChatMessage(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room) return;

        // Sanitize message
        const message = String(data.message || '').slice(0, 200);
        if (!message.trim()) return;

        // Broadcast to all players in the room (including sender)
        // The server will send it once to each socket in the room
        const chatData = {
            username: player.username,
            playerId: socket.id,
            message,
            timestamp: Date.now()
        };

        // Send to all sockets in room individually to ensure single delivery
        const roomSockets = this.io.sockets.adapter.rooms.get(room.id);
        if (roomSockets) {
            roomSockets.forEach(socketId => {
                const targetSocket = this.io.sockets.sockets.get(socketId);
                if (targetSocket) {
                    targetSocket.emit('chat_message', chatData);
                }
            });
        }
    }

    handleQuickChat(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room) return;

        const quickMessages = [
            'Good luck!', 'Nice shot!', 'Oops!', 'Well played!',
            'Your turn!', 'GG', 'Wow!', 'Thanks!'
        ];

        const message = quickMessages[data.messageId] || data.message;
        if (!message) return;

        this.io.to(room.id).emit('quick_chat', {
            from: player.username,
            playerId: socket.id,
            message,
            messageId: data.messageId
        });
    }

    // === Rematch ===
    handleRematchRequest(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'finished') return;

        socket.to(room.id).emit('rematch_requested', {
            from: player.username
        });
    }

    handleRematchAccept(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'finished') return;

        // Start new game
        const gameState = room.startGame();

        this.io.to(room.id).emit('game_start', {
            roomId: room.id,
            gameState,
            currentPlayer: 1,
            host: room.host,
            guest: room.guest,
            wager: room.wager,
            rematch: true
        });
    }

    // === Social ===
    handleGetLeaderboard(socket, data) {
        const type = data?.type || 'elo';
        const limit = Math.min(data?.limit || 20, 100);

        // Get leaderboard from users
        const players = Array.from(this.users.values())
            .filter(u => u.gamesPlayed > 0)
            .sort((a, b) => {
                if (type === 'wins') return (b.gamesWon || 0) - (a.gamesWon || 0);
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
                rankInfo: EloCalculator.getRankFromElo(u.elo || 1200)
            }));

        socket.emit('leaderboard', { type, players });
    }

    handleGetMatchHistory(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const history = this.matchHistory.getPlayerHistory(player.userId || player.email, data?.limit);
        socket.emit('match_history', { matches: history });
    }

    handleGetAchievements(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const achievements = this.achievements.getPlayerAchievements(player.userId || player.email);
        socket.emit('achievements', achievements);
    }

    // === Disconnect ===
    handleDisconnect(socket) {
        const player = this.connectedPlayers.get(socket.id);

        if (player) {
            // Remove from matchmaking
            this.matchmaking.removePlayer(player.id);

            // Check if player was in a game
            const room = this.roomManager.getPlayerRoom(player.id);

            if (room && room.status === 'playing') {
                // Start reconnection timer
                console.log(`⏱️ Player ${player.username} disconnected during game. Starting 30s reconnection timer...`);

                const disconnectData = {
                    playerData: { ...player },
                    roomId: room.id,
                    disconnectTime: Date.now(),
                    playerNumber: room.getPlayerNumber(player.id)
                };

                // Store for potential reconnection
                this.disconnectedPlayers.set(player.oderId || player.email, disconnectData);

                // Notify remaining player about disconnect and timer
                this.io.to(room.id).emit('opponent_disconnecting', {
                    disconnectedPlayer: player.username,
                    playerNumber: disconnectData.playerNumber,
                    timeout: this.RECONNECT_TIMEOUT / 1000 // in seconds
                });

                // Set timeout for forfeit
                disconnectData.timeout = setTimeout(() => {
                    // Check if still disconnected
                    const stillDisconnected = this.disconnectedPlayers.get(player.oderId || player.email);
                    if (stillDisconnected && stillDisconnected.roomId === room.id) {
                        console.log(`❌ Player ${player.username} failed to reconnect. Opponent wins.`);

                        // Remove from disconnected list
                        this.disconnectedPlayers.delete(player.oderId || player.email);

                        // Determine winner (the player who stayed connected)
                        const winnerNum = disconnectData.playerNumber === 1 ? 2 : 1;

                        // End the game with forfeit
                        room.status = 'finished';
                        room.winner = winnerNum;

                        this.io.to(room.id).emit('opponent_disconnected', {
                            winner: winnerNum,
                            reason: 'disconnect_timeout',
                            disconnectedPlayer: player.username
                        });

                        // Process as game over
                        this.handleGameOver(room, { winner: winnerNum, reason: 'disconnect' });
                    }
                }, this.RECONNECT_TIMEOUT);

            } else {
                // Not in a game, just remove from room normally
                this.handleLeaveRoom(socket);
            }

            // Remove from connected players
            this.connectedPlayers.delete(socket.id);

            console.log(`👋 Player disconnected: ${player.username}`);
        } else {
            console.log(`👋 Unknown socket disconnected: ${socket.id}`);
        }
    }

    // === Background Tasks ===
    startBackgroundTasks() {
        // Process matchmaking queues every 2 seconds (with AI fallback)
        setInterval(() => {
            const allTiers = ['casual', 'competitive', 'highStakes', 'bronze', 'silver', 'gold', 'diamond', 'ruby', 'crown'];
            allTiers.forEach(tier => {
                const result = this.matchmaking.processQueueWithAI(tier);
                if (result?.matched) {
                    const room = this.roomManager.getRoom(result.roomId);
                    if (room) {
                        const matchData = {
                            roomId: result.roomId,
                            room: room.toJSON(),
                            isAiMatch: result.isAiMatch || false,
                            opponent: result.opponent
                        };

                        // Find player's socket and emit directly + join room
                        for (const [socketId, player] of this.connectedPlayers) {
                            if (room.host && player.id === room.host.id) {
                                const socket = this.io.sockets.sockets.get(socketId);
                                if (socket) {
                                    socket.join(result.roomId);
                                    socket.emit('match_found', matchData);
                                    console.log(`📤 Sent match_found to ${player.username}`);
                                }
                            }
                        }

                        // Auto-start AI matches after 2 seconds
                        if (result.isAiMatch) {
                            console.log(`🤖 AI match in room ${result.roomId}`);
                            setTimeout(() => {
                                const r = this.roomManager.getRoom(result.roomId);
                                if (r && (r.status === 'ready' || r.status === 'waiting')) {
                                    r.isAiMatch = true;  // Mark room as AI match for shot_result handling
                                    const gameState = r.startGame();
                                    this.io.to(result.roomId).emit('game_start', {
                                        roomId: r.id,
                                        gameState,
                                        currentPlayer: 1,
                                        host: r.host,
                                        guest: r.guest,
                                        wager: r.wager,
                                        isAiMatch: true
                                    });
                                    console.log(`🤖 AI Game started in ${r.id}`);
                                }
                            }, 2000);
                        }
                    }
                } else if (result?.timeout) {
                    // Notify player of timeout
                    const socket = this.io.sockets.sockets.get(result.playerId);
                    if (socket) {
                        socket.emit('matchmaking_timeout', {
                            message: 'No match found. Please try again.'
                        });
                    }
                }
            });
        }, 2000);

        // Cleanup old rooms every 5 minutes
        setInterval(() => {
            this.roomManager.cleanupOldRooms();
        }, 5 * 60 * 1000);

        // Broadcast stats every 10 seconds
        setInterval(() => {
            this.io.emit('server_stats', {
                rooms: this.roomManager.getStats(),
                queue: this.matchmaking.getQueueStats(),
                online: this.connectedPlayers.size
            });
        }, 10000);
    }

    getStats() {
        return {
            connectedPlayers: this.connectedPlayers.size,
            rooms: this.roomManager.getStats(),
            matchmaking: this.matchmaking.getQueueStats()
        };
    }
}

module.exports = { MultiplayerServer };

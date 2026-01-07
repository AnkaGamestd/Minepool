# 🎱 MULTIPLAYER IMPLEMENTATION PLAN
## 8-Ball Pool Online Multiplayer

---

## 📋 Executive Summary

Transform the current local 2-player game into a **real-time online multiplayer** experience where players can compete against each other over the internet.

### Key Features
- ✅ Real-time game synchronization
- ✅ Player matchmaking system
- ✅ Room-based multiplayer
- ✅ Chat functionality
- ✅ Player profiles & statistics
- ✅ Spectator mode
- ✅ Anti-cheat measures

---

## 🏗️ Architecture Overview

### Current Architecture (Local)
```
[Browser]
    │
    ├── game.js (Game Logic + Rendering)
    ├── physics.js (Physics Engine + Sound)
    ├── settings.js (Configuration)
    └── server.js (Simple Static Server)
```

### New Architecture (Multiplayer)
```
[Client 1]                    [Server]                    [Client 2]
    │                            │                            │
    ├── game.js ◄───────────►  WebSocket  ◄───────────► game.js
    ├── physics.js              Server                   physics.js
    ├── network.js (NEW)          │                      network.js
    │                             │
    │                    ┌───────┴───────┐
    │                    │   Room Manager   │
    │                    │   Game State     │
    │                    │   Matchmaking    │
    │                    │   Database       │
    │                    └─────────────────┘
```

---

## 📁 New Project Structure

```
8ball-pool/
├── client/                         # Frontend
│   ├── index.html
│   ├── styles.css
│   ├── js/
│   │   ├── game.js                 # Modified game logic
│   │   ├── physics.js              # Physics (unchanged)
│   │   ├── network.js              # NEW: WebSocket client
│   │   ├── matchmaking.js          # NEW: Matchmaking UI
│   │   ├── chat.js                 # NEW: In-game chat
│   │   └── settings.js
│   ├── Sounds/
│   └── assets/
│
├── server/                         # Backend
│   ├── index.js                    # Main server entry
│   ├── websocket.js                # WebSocket handler
│   ├── game/
│   │   ├── GameRoom.js             # Game room logic
│   │   ├── GameState.js            # State synchronization
│   │   └── Physics.js              # Server-side physics (validation)
│   ├── matchmaking/
│   │   ├── MatchmakingQueue.js     # Player queue
│   │   └── RoomManager.js          # Room creation/management
│   ├── database/
│   │   ├── models/
│   │   │   ├── Player.js           # Player model
│   │   │   ├── Match.js            # Match history
│   │   │   └── Stats.js            # Statistics
│   │   └── connection.js           # DB connection
│   └── utils/
│       ├── validation.js           # Input validation
│       └── anticheat.js            # Anti-cheat logic
│
├── shared/                         # Shared code
│   ├── constants.js                # Game constants
│   ├── messages.js                 # Message types
│   └── physics-core.js             # Core physics (shared)
│
└── package.json
```

---

## 🔧 Phase 1: Server Foundation
**Estimated Time: 2-3 days**

### 1.1 WebSocket Server Setup

```javascript
// server/index.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('../client'));

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
    });
});

httpServer.listen(3000, () => {
    console.log('🎱 Server running on port 3000');
});
```

### 1.2 Room Manager

```javascript
// server/matchmaking/RoomManager.js
class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.playerRooms = new Map();
    }

    createRoom(hostPlayer) {
        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            host: hostPlayer,
            guest: null,
            spectators: [],
            gameState: null,
            status: 'waiting' // waiting, playing, finished
        };
        this.rooms.set(roomId, room);
        this.playerRooms.set(hostPlayer.id, roomId);
        return room;
    }

    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room || room.guest) return null;
        
        room.guest = player;
        room.status = 'ready';
        this.playerRooms.set(player.id, roomId);
        return room;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}
```

### 1.3 Dependencies

```json
// package.json
{
    "name": "8ball-pool-multiplayer",
    "version": "1.0.0",
    "scripts": {
        "start": "node server/index.js",
        "dev": "nodemon server/index.js"
    },
    "dependencies": {
        "express": "^4.18.2",
        "socket.io": "^4.7.2",
        "uuid": "^9.0.0"
    },
    "devDependencies": {
        "nodemon": "^3.0.1"
    }
}
```

---

## 🔧 Phase 2: Client Networking
**Estimated Time: 2-3 days**

### 2.1 Network Manager

```javascript
// client/js/network.js
class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomId = null;
        this.playerId = null;
        this.isHost = false;
    }

    connect(serverUrl = 'ws://localhost:3000') {
        this.socket = io(serverUrl);
        
        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
            console.log('Connected to server:', this.playerId);
        });

        this.socket.on('room_joined', (data) => {
            this.roomId = data.roomId;
            this.isHost = data.isHost;
            this.game.onRoomJoined(data);
        });

        this.socket.on('game_start', (data) => {
            this.game.onGameStart(data);
        });

        this.socket.on('opponent_aim', (data) => {
            this.game.onOpponentAim(data);
        });

        this.socket.on('shot_taken', (data) => {
            this.game.onShotTaken(data);
        });

        this.socket.on('game_state_update', (data) => {
            this.game.onGameStateUpdate(data);
        });

        this.socket.on('turn_change', (data) => {
            this.game.onTurnChange(data);
        });

        this.socket.on('game_over', (data) => {
            this.game.onGameOver(data);
        });

        this.socket.on('opponent_disconnected', () => {
            this.game.onOpponentDisconnected();
        });
    }

    // Outgoing messages
    createRoom() {
        this.socket.emit('create_room');
    }

    joinRoom(roomId) {
        this.socket.emit('join_room', { roomId });
    }

    findMatch() {
        this.socket.emit('find_match');
    }

    sendAim(angle, power, spinX, spinY) {
        this.socket.emit('aim_update', {
            angle, power, spinX, spinY
        });
    }

    sendShot(angle, power, spinX, spinY) {
        this.socket.emit('take_shot', {
            angle, power, spinX, spinY
        });
    }

    sendCueBallPosition(x, y) {
        this.socket.emit('cue_ball_placed', { x, y });
    }

    sendMessage(message) {
        this.socket.emit('chat_message', { message });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

window.NetworkManager = NetworkManager;
```

### 2.2 Game.js Modifications

```javascript
// Add these methods to PoolGame class

// Called when room is joined
onRoomJoined(data) {
    this.roomId = data.roomId;
    this.playerNumber = data.playerNumber; // 1 or 2
    this.isMyTurn = data.isHost; // Host goes first
    this.updateUI();
}

// Called when game starts
onGameStart(data) {
    this.balls = data.balls;
    this.currentPlayer = data.currentPlayer;
    this.isMyTurn = (this.playerNumber === this.currentPlayer);
    this.gameState = 'aiming';
    this.startShotTimer();
}

// Called when opponent aims (show ghost cue)
onOpponentAim(data) {
    if (!this.isMyTurn) {
        this.opponentAimAngle = data.angle;
        this.opponentPower = data.power;
        this.opponentSpinX = data.spinX;
        this.opponentSpinY = data.spinY;
    }
}

// Called when opponent takes a shot
onShotTaken(data) {
    // Replay the shot locally with received parameters
    this.aimAngle = data.angle;
    this.power = data.power;
    this.spinX = data.spinX;
    this.spinY = data.spinY;
    this.shoot();
}

// Called when ball positions are synced
onGameStateUpdate(data) {
    // Sync ball positions (authoritative from server)
    this.balls = data.balls;
}

// Called when turn changes
onTurnChange(data) {
    this.currentPlayer = data.currentPlayer;
    this.isMyTurn = (this.playerNumber === this.currentPlayer);
    this.updateTurnIndicator();
    if (this.isMyTurn) {
        this.startShotTimer();
    }
}

// Called when game ends
onGameOver(data) {
    this.winner = data.winner;
    this.showWinner(data.winner, data.reason);
}

// Called when opponent disconnects
onOpponentDisconnected() {
    this.showMessage('OPPONENT LEFT', 'You win by forfeit!', 5000);
    this.showWinner(this.playerNumber, 'forfeit');
}
```

---

## 🔧 Phase 3: Game State Synchronization
**Estimated Time: 3-4 days**

### 3.1 Message Protocol

```javascript
// shared/messages.js
const MessageTypes = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    
    // Matchmaking
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    FIND_MATCH: 'find_match',
    CANCEL_MATCHMAKING: 'cancel_matchmaking',
    
    // Room events
    ROOM_CREATED: 'room_created',
    ROOM_JOINED: 'room_joined',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    
    // Game events
    GAME_START: 'game_start',
    AIM_UPDATE: 'aim_update',
    TAKE_SHOT: 'take_shot',
    SHOT_RESULT: 'shot_result',
    BALL_POCKETED: 'ball_pocketed',
    TURN_CHANGE: 'turn_change',
    FOUL: 'foul',
    GAME_OVER: 'game_over',
    
    // Ball in hand
    CUE_BALL_PLACED: 'cue_ball_placed',
    
    // Chat
    CHAT_MESSAGE: 'chat_message',
    
    // Sync
    REQUEST_STATE: 'request_state',
    GAME_STATE_UPDATE: 'game_state_update',
    FULL_SYNC: 'full_sync'
};

module.exports = MessageTypes;
```

### 3.2 Game Room Server Logic

```javascript
// server/game/GameRoom.js
class GameRoom {
    constructor(roomId, host) {
        this.id = roomId;
        this.host = host;
        this.guest = null;
        this.spectators = [];
        
        this.gameState = {
            balls: [],
            currentPlayer: 1,
            playerTypes: { 1: null, 2: null },
            isBreakShot: true,
            tableState: 'open',
            ballInHand: false,
            pocketedBalls: [],
            fouls: []
        };
        
        this.status = 'waiting';
        this.lastAction = Date.now();
    }

    addGuest(player) {
        if (this.guest) return false;
        this.guest = player;
        this.status = 'ready';
        return true;
    }

    startGame() {
        this.status = 'playing';
        this.gameState.balls = this.initializeBalls();
        this.gameState.currentPlayer = 1;
        this.gameState.isBreakShot = true;
        return this.gameState;
    }

    initializeBalls() {
        // Same as client initialization
        const balls = [];
        const startX = 750;
        const startY = 250;
        const radius = 12;
        const gap = 0.5;
        
        // Cue ball
        balls.push({
            id: 0, x: 250, y: 250,
            vx: 0, vy: 0, active: true
        });
        
        // Rack balls (simplified)
        const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
        let ballIndex = 0;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                const x = startX + row * (radius * 2 + gap) * 0.866;
                const y = startY + (col - row / 2) * (radius * 2 + gap);
                const id = rackOrder[ballIndex];
                balls.push({
                    id, x, y,
                    vx: 0, vy: 0, active: true
                });
                ballIndex++;
            }
        }
        
        return balls;
    }

    processShot(playerId, shotData) {
        // Validate it's this player's turn
        const playerNum = this.getPlayerNumber(playerId);
        if (playerNum !== this.gameState.currentPlayer) {
            return { error: 'Not your turn' };
        }
        
        // Record shot for replay
        this.lastShot = {
            player: playerNum,
            angle: shotData.angle,
            power: shotData.power,
            spinX: shotData.spinX,
            spinY: shotData.spinY,
            timestamp: Date.now()
        };
        
        return { success: true, shot: this.lastShot };
    }

    updateBallPositions(balls) {
        this.gameState.balls = balls;
    }

    getPlayerNumber(playerId) {
        if (this.host.id === playerId) return 1;
        if (this.guest?.id === playerId) return 2;
        return 0;
    }

    handleShotResult(result) {
        // Process pocketed balls, fouls, turn changes, win conditions
        if (result.pocketedBalls.length > 0) {
            this.gameState.pocketedBalls.push(...result.pocketedBalls);
        }
        
        if (result.foul) {
            this.gameState.ballInHand = true;
            this.switchTurn();
        } else if (result.continueTurn) {
            // Player keeps shooting
        } else {
            this.switchTurn();
        }
        
        if (result.winner) {
            this.status = 'finished';
            return { gameOver: true, winner: result.winner };
        }
        
        return { gameOver: false };
    }

    switchTurn() {
        this.gameState.currentPlayer = 
            this.gameState.currentPlayer === 1 ? 2 : 1;
    }

    toJSON() {
        return {
            id: this.id,
            host: { id: this.host.id, name: this.host.name },
            guest: this.guest ? { id: this.guest.id, name: this.guest.name } : null,
            status: this.status,
            gameState: this.gameState
        };
    }
}

module.exports = GameRoom;
```

### 3.3 Synchronization Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYNCHRONIZATION STRATEGY                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SHOT INPUT (Client → Server)                                │
│     ────────────────────────────                                │
│     ┌──────────┐    Shot Params     ┌──────────┐                │
│     │ Shooter  │ ────────────────►  │  Server  │                │
│     │  Client  │  angle, power,     │          │                │
│     └──────────┘  spin              └──────────┘                │
│                                                                  │
│  2. BROADCAST (Server → All Clients)                            │
│     ─────────────────────────────────                           │
│     ┌──────────┐    Shot Params     ┌──────────┐                │
│     │  Server  │ ────────────────►  │   All    │                │
│     │          │                    │ Clients  │                │
│     └──────────┘                    └──────────┘                │
│                                                                  │
│  3. LOCAL SIMULATION (Each Client)                              │
│     ──────────────────────────────                              │
│     Each client runs physics locally with same parameters       │
│     Results should be identical (deterministic physics)         │
│                                                                  │
│  4. VALIDATION (Client → Server)                                │
│     ─────────────────────────────                               │
│     Active player sends final ball positions                    │
│     Server validates and broadcasts authoritative state         │
│                                                                  │
│  5. RECONCILIATION (if needed)                                  │
│     ───────────────────────────                                 │
│     If states differ, server state is authoritative             │
│     Clients snap to server state                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Phase 4: Matchmaking System
**Estimated Time: 2 days**

### 4.1 Matchmaking Queue

```javascript
// server/matchmaking/MatchmakingQueue.js
class MatchmakingQueue {
    constructor(roomManager) {
        this.queue = [];
        this.roomManager = roomManager;
    }

    addPlayer(player) {
        // Check if already in queue
        if (this.queue.find(p => p.id === player.id)) {
            return { error: 'Already in queue' };
        }
        
        this.queue.push({
            ...player,
            joinedAt: Date.now(),
            skill: player.skill || 1000 // ELO rating
        });
        
        // Try to find a match
        return this.tryMatch(player);
    }

    removePlayer(playerId) {
        this.queue = this.queue.filter(p => p.id !== playerId);
    }

    tryMatch(player) {
        // Simple matching: first available opponent
        // Can be enhanced with skill-based matching
        
        for (let i = 0; i < this.queue.length; i++) {
            const opponent = this.queue[i];
            if (opponent.id !== player.id) {
                // Match found!
                this.queue = this.queue.filter(
                    p => p.id !== player.id && p.id !== opponent.id
                );
                
                const room = this.roomManager.createRoom(player);
                this.roomManager.joinRoom(room.id, opponent);
                
                return {
                    matched: true,
                    roomId: room.id,
                    opponent: opponent
                };
            }
        }
        
        return { matched: false, position: this.queue.length };
    }

    getQueueStats() {
        return {
            playersInQueue: this.queue.length,
            averageWaitTime: this.calculateAverageWait()
        };
    }

    calculateAverageWait() {
        if (this.queue.length === 0) return 0;
        const now = Date.now();
        const totalWait = this.queue.reduce(
            (sum, p) => sum + (now - p.joinedAt), 0
        );
        return Math.round(totalWait / this.queue.length / 1000);
    }
}

module.exports = MatchmakingQueue;
```

### 4.2 Matchmaking UI

```javascript
// client/js/matchmaking.js
class MatchmakingUI {
    constructor(network) {
        this.network = network;
        this.isSearching = false;
        this.searchStartTime = null;
        this.timerInterval = null;
    }

    showMatchmaking() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('matchmaking-screen').classList.remove('hidden');
    }

    startSearch() {
        this.isSearching = true;
        this.searchStartTime = Date.now();
        this.network.findMatch();
        this.updateUI();
        this.startTimer();
    }

    cancelSearch() {
        this.isSearching = false;
        this.network.cancelMatchmaking();
        this.stopTimer();
        this.updateUI();
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.searchStartTime) / 1000);
            document.getElementById('search-time').textContent = 
                this.formatTime(elapsed);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    onMatchFound(data) {
        this.isSearching = false;
        this.stopTimer();
        // Transition to game
        document.getElementById('matchmaking-screen').classList.add('hidden');
    }

    updateUI() {
        const searchBtn = document.getElementById('search-btn');
        const cancelBtn = document.getElementById('cancel-btn');
        const statusText = document.getElementById('matchmaking-status');

        if (this.isSearching) {
            searchBtn.classList.add('hidden');
            cancelBtn.classList.remove('hidden');
            statusText.textContent = 'Searching for opponent...';
        } else {
            searchBtn.classList.remove('hidden');
            cancelBtn.classList.add('hidden');
            statusText.textContent = 'Ready to play';
        }
    }
}

window.MatchmakingUI = MatchmakingUI;
```

---

## 🔧 Phase 5: UI Updates
**Estimated Time: 2 days**

### 5.1 New HTML Elements

```html
<!-- Add to index.html -->

<!-- Matchmaking Screen -->
<div id="matchmaking-screen" class="hidden">
    <div class="matchmaking-content">
        <h1>🎱 FIND MATCH</h1>
        
        <div class="matchmaking-options">
            <button id="btn-quick-match" class="btn-mode">
                <span class="mode-icon">⚡</span>
                <span class="mode-text">QUICK MATCH</span>
            </button>
            <button id="btn-create-room" class="btn-mode">
                <span class="mode-icon">🏠</span>
                <span class="mode-text">CREATE ROOM</span>
            </button>
            <button id="btn-join-room" class="btn-mode">
                <span class="mode-icon">🚪</span>
                <span class="mode-text">JOIN ROOM</span>
            </button>
        </div>

        <div id="search-status" class="hidden">
            <div class="spinner"></div>
            <p id="matchmaking-status">Searching for opponent...</p>
            <p>Time: <span id="search-time">0:00</span></p>
            <button id="cancel-search" class="btn-secondary">CANCEL</button>
        </div>

        <div id="room-code-input" class="hidden">
            <input type="text" id="room-code" placeholder="Enter Room Code" maxlength="6">
            <button id="btn-join" class="btn-primary">JOIN</button>
        </div>

        <div id="room-created" class="hidden">
            <p>Room Code:</p>
            <h2 id="display-room-code">ABC123</h2>
            <p>Share this code with your friend!</p>
            <p>Waiting for opponent...</p>
        </div>

        <button id="btn-back" class="btn-secondary">BACK</button>
    </div>
</div>

<!-- In-Game Chat -->
<div id="chat-container" class="hidden">
    <div id="chat-messages"></div>
    <div class="chat-input">
        <input type="text" id="chat-input" placeholder="Type a message...">
        <button id="chat-send">Send</button>
    </div>
</div>

<!-- Connection Status -->
<div id="connection-status">
    <span id="connection-indicator" class="connected"></span>
    <span id="ping-display">-- ms</span>
</div>
```

### 5.2 Updated Styles

```css
/* Add to styles.css */

/* Matchmaking Screen */
#matchmaking-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
}

.matchmaking-content {
    text-align: center;
    padding: 40px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 20px;
    border: 2px solid rgba(100, 255, 218, 0.3);
}

.matchmaking-options {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin: 30px 0;
}

/* Spinner */
.spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(100, 255, 218, 0.2);
    border-top-color: #64ffda;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 20px auto;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Room Code Display */
#display-room-code {
    font-family: 'Orbitron', monospace;
    font-size: 48px;
    color: #64ffda;
    letter-spacing: 8px;
    text-shadow: 0 0 20px rgba(100, 255, 218, 0.5);
}

/* Chat */
#chat-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    height: 200px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 10px;
    border: 1px solid rgba(100, 255, 218, 0.3);
    display: flex;
    flex-direction: column;
}

#chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    font-size: 12px;
}

.chat-input {
    display: flex;
    padding: 10px;
    border-top: 1px solid rgba(100, 255, 218, 0.2);
}

#chat-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    padding: 8px;
    color: white;
    border-radius: 5px;
}

/* Connection Status */
#connection-status {
    position: fixed;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 20px;
    font-size: 12px;
}

#connection-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

#connection-indicator.connected {
    background: #4caf50;
    box-shadow: 0 0 10px #4caf50;
}

#connection-indicator.disconnected {
    background: #f44336;
    box-shadow: 0 0 10px #f44336;
}
```

---

## 🔧 Phase 6: Database & Persistence
**Estimated Time: 2-3 days**

### 6.1 Player Profile Schema

```javascript
// server/database/models/Player.js
const playerSchema = {
    id: String,           // Unique ID
    username: String,     // Display name
    email: String,        // For login
    passwordHash: String, // Hashed password
    
    stats: {
        gamesPlayed: Number,
        gamesWon: Number,
        gamesLost: Number,
        winStreak: Number,
        maxWinStreak: Number,
        totalBallsPocketed: Number,
        eightBallWins: Number,
        breakAndRuns: Number
    },
    
    elo: {
        rating: Number,    // Default 1000
        rank: String,      // Bronze, Silver, Gold, etc.
        history: Array     // Rating changes
    },
    
    preferences: {
        cue: String,       // Selected cue
        avatar: String,    // Profile picture
        soundEnabled: Boolean
    },
    
    social: {
        friends: Array,    // Friend IDs
        blocked: Array     // Blocked player IDs
    },
    
    timestamps: {
        createdAt: Date,
        lastSeen: Date,
        lastMatch: Date
    }
};
```

### 6.2 Match History Schema

```javascript
// server/database/models/Match.js
const matchSchema = {
    id: String,
    
    players: {
        player1: {
            id: String,
            username: String,
            eloAtMatch: Number
        },
        player2: {
            id: String,
            username: String,
            eloAtMatch: Number
        }
    },
    
    result: {
        winner: Number,    // 1 or 2
        reason: String,    // '8ball', 'forfeit', 'timeout'
        score: Object      // Balls pocketed by each
    },
    
    gameData: {
        duration: Number,  // Match duration in seconds
        totalShots: Number,
        shotHistory: Array // All shots taken
    },
    
    eloChanges: {
        player1: Number,   // +/- ELO
        player2: Number
    },
    
    timestamp: Date
};
```

---

## 🔧 Phase 7: Anti-Cheat & Security
**Estimated Time: 2 days**

### 7.1 Validation Layer

```javascript
// server/utils/validation.js
class ValidationService {
    validateShot(shotData, gameState) {
        // Check if shot parameters are within valid ranges
        if (shotData.power < 0 || shotData.power > 100) {
            return { valid: false, error: 'Invalid power value' };
        }
        
        if (shotData.spinX < -1 || shotData.spinX > 1) {
            return { valid: false, error: 'Invalid spin X value' };
        }
        
        if (shotData.spinY < -1 || shotData.spinY > 1) {
            return { valid: false, error: 'Invalid spin Y value' };
        }
        
        // Validate angle is a number
        if (isNaN(shotData.angle)) {
            return { valid: false, error: 'Invalid angle' };
        }
        
        return { valid: true };
    }

    validateCueBallPlacement(x, y, balls, isKitchen) {
        // Check bounds
        const cushion = 25;
        const radius = 12;
        const tableWidth = 1000;
        const tableHeight = 500;
        
        if (x < cushion + radius || x > tableWidth - cushion - radius) {
            return { valid: false, error: 'Out of bounds' };
        }
        
        if (y < cushion + radius || y > tableHeight - cushion - radius) {
            return { valid: false, error: 'Out of bounds' };
        }
        
        // Kitchen rule (behind head string)
        if (isKitchen && x > tableWidth / 4) {
            return { valid: false, error: 'Must place behind head string' };
        }
        
        // Check collision with other balls
        for (const ball of balls) {
            if (!ball.active || ball.id === 0) continue;
            const dx = x - ball.x;
            const dy = y - ball.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius * 2) {
                return { valid: false, error: 'Overlapping with ball' };
            }
        }
        
        return { valid: true };
    }

    validateTimestamp(clientTime, tolerance = 5000) {
        const serverTime = Date.now();
        const diff = Math.abs(serverTime - clientTime);
        return diff < tolerance;
    }
}

module.exports = ValidationService;
```

### 7.2 Rate Limiting

```javascript
// server/utils/rateLimiter.js
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.maxRequests = 60;  // Per minute
        this.windowMs = 60000;  // 1 minute
    }

    checkLimit(playerId) {
        const now = Date.now();
        const playerRequests = this.requests.get(playerId) || [];
        
        // Filter old requests
        const validRequests = playerRequests.filter(
            time => now - time < this.windowMs
        );
        
        if (validRequests.length >= this.maxRequests) {
            return false;  // Rate limited
        }
        
        validRequests.push(now);
        this.requests.set(playerId, validRequests);
        return true;
    }
}

module.exports = RateLimiter;
```

---

## 📊 Implementation Timeline

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| **Phase 1** | Server Foundation | 2-3 days | None |
| **Phase 2** | Client Networking | 2-3 days | Phase 1 |
| **Phase 3** | State Sync | 3-4 days | Phase 1, 2 |
| **Phase 4** | Matchmaking | 2 days | Phase 1, 2 |
| **Phase 5** | UI Updates | 2 days | Phase 2 |
| **Phase 6** | Database | 2-3 days | Phase 1 |
| **Phase 7** | Security | 2 days | Phase 3 |

**Total Estimated Time: 15-20 days**

---

## 🎯 MVP Features (First Release)

### Must Have
- [x] WebSocket connection
- [x] Room creation/joining
- [x] Real-time shot synchronization
- [x] Turn management
- [x] Basic matchmaking
- [x] Win/lose detection

### Nice to Have
- [ ] Skill-based matchmaking
- [ ] Player profiles
- [ ] Chat system
- [ ] Spectator mode
- [ ] Match history

### Future Updates
- [ ] Tournaments
- [ ] Leaderboards
- [ ] Achievements
- [ ] Multiple game modes
- [ ] Mobile optimization

---

## 🚀 Quick Start Commands

```bash
# Initialize project
npm init -y

# Install dependencies
npm install express socket.io uuid

# Install dev dependencies
npm install -D nodemon

# Start development server
npm run dev
```

---

## 📝 Next Steps

1. **Set up the server project structure**
2. **Implement basic WebSocket server**
3. **Create NetworkManager on client**
4. **Test basic connection and messaging**
5. **Implement room creation/joining**
6. **Add shot synchronization**
7. **Test full game flow**
8. **Add matchmaking**
9. **Polish UI**
10. **Deploy!**

---

## 🎱 Summary

This plan transforms your local 8-Ball Pool game into a fully-featured online multiplayer experience. The architecture uses:

- **WebSockets** for real-time communication
- **Room-based** multiplayer for private games
- **Matchmaking queue** for public games
- **Authoritative server** for anti-cheat
- **Database** for persistent player data

The implementation is modular and can be done incrementally, with a playable MVP possible in about 1-2 weeks!

---

Good luck with your multiplayer implementation! 🎱🌐✨

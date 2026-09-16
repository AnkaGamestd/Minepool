const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { GameRoom, RoomManager } = require('../multiplayer/RoomManager.js');
const { MultiplayerServer } = require('../multiplayer/WebSocketHandler.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'www', 'network.js'), 'utf8');
const timers = [];
const context = {
    console,
    window: {},
    Math,
    Date,
    setTimeout(callback) {
        timers.push(callback);
        return timers.length;
    },
    clearTimeout() {}
};
context.window.setTimeout = context.setTimeout;
vm.runInNewContext(source, context);
const NetworkManager = context.window.NetworkManager;

const cueBall = { id: 0, x: 250, y: 250, vx: 0, vy: 0, active: false, spinX: 0, spinY: 0 };
const objectBall = { id: 1, type: 'solid', x: 650, y: 250, vx: 0, vy: 0, active: true };
let appliedShot = null;
const emitted = [];
const game = {
    balls: [cueBall, objectBall],
    tableWidth: 1000,
    tableHeight: 500,
    currentPlayer: 2,
    myPlayerNumber: 1,
    gameState: 'waiting',
    tableState: 'open',
    playerTypes: { 1: null, 2: null },
    ballInHand: true,
    ballInHandKitchen: false,
    shotPocketedBalls: [],
    physics: {
        pockets: [
            { x: 35, y: 35 }, { x: 500, y: 35 }, { x: 965, y: 35 },
            { x: 35, y: 465 }, { x: 500, y: 465 }, { x: 965, y: 465 }
        ],
        applyShot(ball, angle, power, spinX, spinY) {
            appliedShot = { ball, angle, power, spinX, spinY };
        },
        allBallsStopped() { return true; }
    },
    sound: { playCueHit() {} },
    updateTurnIndicator() {},
    startShotTimer() {},
    onGameOver() {}
};

const network = new NetworkManager(game);
network.isAiMatch = true;
network.myPlayerNumber = 1;
network.roomId = 'room-test';
network.socket = { emit(event, payload) { emitted.push({ event, payload }); } };

network.executeAiTurn({ gameState: { currentPlayer: 2, ballInHand: true } });
assert.equal(network.aiShotPending, true, 'AI thinking state must be armed');
assert.equal(cueBall.active, true, 'A foul must reactivate the cue ball for the AI');
assert.equal(game.ballInHand, false, 'AI ball-in-hand must be consumed after legal placement');
const scheduledBeforeDuplicate = timers.length;
network.executeAiTurn({ gameState: { currentPlayer: 2, ballInHand: false } });
assert.equal(timers.length, scheduledBeforeDuplicate, 'Duplicate state updates must not schedule a second AI shot');

while (timers.length) timers.shift()();

assert.ok(appliedShot, 'AI must take a shot after receiving ball-in-hand');
assert.ok(Number.isFinite(appliedShot.angle), 'AI shot angle must be finite');
assert.ok(appliedShot.power >= 0 && appliedShot.power <= 100, 'AI shot power must be valid');
const resultEvent = emitted.find(entry => entry.event === 'shot_result');
assert.ok(resultEvent, 'AI proxy must report the completed turn to the server');
assert.equal(resultEvent.payload.isAiShot, true);
assert.equal(resultEvent.payload.balls.length, 2, 'AI result must synchronize ball positions');

const recoveryEvents = [];
const missingCueGame = {
    ...game,
    balls: [],
    currentPlayer: 2,
    gameState: 'waiting',
    ballInHand: true,
    shotPocketedBalls: []
};
const recoveringNetwork = new NetworkManager(missingCueGame);
recoveringNetwork.isAiMatch = true;
recoveringNetwork.myPlayerNumber = 1;
recoveringNetwork.roomId = 'recovery-room';
recoveringNetwork.socket = { emit(event, payload) { recoveryEvents.push({ event, payload }); } };
recoveringNetwork.executeAiTurn({ gameState: { currentPlayer: 2, ballInHand: true } });
while (timers.length) timers.shift()();
const recoveredResult = recoveryEvents.find(entry => entry.event === 'shot_result');
assert.ok(recoveredResult, 'An unrecoverable AI setup must not leave the match waiting forever');
assert.equal(recoveredResult.payload.foul, true, 'A safely forfeited AI turn grants ball-in-hand to the human');

const room = new GameRoom('foul-room', { id: 'human', username: 'Human' });
room.addGuest({ id: 'bot', username: 'AI_Test', isBot: true });
room.startGame();
room.handleShotResult({ foul: true, continueTurn: false, pocketedBalls: [] });
assert.equal(room.gameState.currentPlayer, 2, 'A human foul must pass the turn to the bot');
assert.equal(room.gameState.ballInHand, true, 'The bot must receive authoritative ball-in-hand');

const idempotentRoom = new GameRoom('idempotent-room', { id: 'human', username: 'Human' });
idempotentRoom.addGuest({ id: 'bot', username: 'AI_Test', isBot: true });
idempotentRoom.startGame();
idempotentRoom.gameState.currentPlayer = 2;
idempotentRoom.isAiMatch = true;
const server = Object.create(MultiplayerServer.prototype);
server.connectedPlayers = new Map([['human-socket', { id: 'human' }]]);
server.roomManager = { getPlayerRoom: () => idempotentRoom };
server.io = { to: () => ({ emit() {} }) };
server.handleGameOver = () => {};
const socket = { id: 'human-socket', emit() {} };
const aiResult = { resultId: 'ai-result-once', isAiShot: true, foul: false, continueTurn: false, pocketedBalls: [] };
let firstAcknowledgement;
server.handleShotResult(socket, aiResult, response => { firstAcknowledgement = response; });
assert.equal(firstAcknowledgement.success, true, 'The server must acknowledge an AI result');
assert.equal(idempotentRoom.gameState.currentPlayer, 1, 'The first AI result must return the turn to the human');
let duplicateAcknowledgement;
server.handleShotResult(socket, aiResult, response => { duplicateAcknowledgement = response; });
assert.equal(duplicateAcknowledgement.duplicate, true, 'A retried AI result must be detected as a duplicate');
assert.equal(idempotentRoom.gameState.currentPlayer, 1, 'A duplicate result must never switch the turn back to the bot');

const syncGame = {
    ...game,
    currentPlayer: 2,
    gameState: 'waiting',
    onGameStateUpdate(data) { this.currentPlayer = data.gameState.currentPlayer; }
};
const syncNetwork = new NetworkManager(syncGame);
syncNetwork.isAiMatch = true;
syncNetwork.myPlayerNumber = 1;
syncNetwork.roomId = 'sync-room';
const syncEvents = [];
syncNetwork.socket = {
    connected: true,
    timeout() { return this; },
    emit(event, payload, callback) {
        syncEvents.push({ event, payload });
        if (event === 'request_game_state') callback(null, {
            success: true,
            gameState: { currentPlayer: 2, ballInHand: false, balls: syncGame.balls }
        });
    }
};
syncNetwork.lastAiResultPayload = { resultId: 'lost-ai-result', isAiShot: true };
syncNetwork.aiAwaitingResultSince = Date.now() - 5000;
syncNetwork.ensureAiTurnProgress();
assert.equal(syncEvents.filter(event => event.event === 'request_game_state').length, 1, 'A missing result acknowledgement must request authoritative state');
assert.equal(syncEvents.filter(event => event.event === 'shot_result').length, 1, 'An unapplied AI result must be resent');
assert.equal(syncEvents.find(event => event.event === 'shot_result').payload.resultId, 'lost-ai-result', 'A retry must preserve the idempotency id');

const reconnectRooms = new RoomManager();
const reconnectRoom = reconnectRooms.createRoom({ id: 'old-socket', username: 'Human' });
reconnectRooms.joinRoom(reconnectRoom.id, { id: 'bot-reconnect', username: 'AI_Test', isBot: true });
reconnectRoom.startGame();
reconnectRoom.host.id = 'new-socket';
assert.equal(reconnectRooms.rebindPlayerConnection(reconnectRoom.id, 'old-socket', 'new-socket'), true);
assert.equal(reconnectRooms.getPlayerRoom('old-socket'), null, 'The stale socket must be removed after reconnect');
assert.equal(reconnectRooms.getPlayerRoom('new-socket'), reconnectRoom, 'The reconnected socket must remain bound to its active game');
assert.equal(reconnectRoom.gameState.balls.find(ball => ball.id === 1).type, 'solid', 'Server snapshots must carry ball groups');
reconnectRoom.updateBallPositions([{ id: 1, x: 123, y: 234, active: true }]);
assert.equal(reconnectRoom.gameState.balls[0].type, 'solid', 'Position updates must restore missing ball types by number');

const socketHandlers = {};
const reconnectingGame = {
    ...game,
    currentPlayer: 2,
    gameState: 'shooting',
    isMultiplayer: true,
    hideReconnectionTimer() { this.reconnectTimerHidden = true; },
    onGameRejoin() { this.rejoinSnapshotApplied = true; }
};
const reconnectingNetwork = new NetworkManager(reconnectingGame);
reconnectingNetwork.isAiMatch = true;
reconnectingNetwork.myPlayerNumber = 1;
reconnectingNetwork.roomId = 'in-flight-room';
reconnectingNetwork.aiShotPending = true;
reconnectingNetwork.aiShotPollTimeout = 99;
reconnectingNetwork.startAiTurnWatchdog = () => {};
reconnectingNetwork.socket = {
    connected: true,
    on(event, handler) { socketHandlers[event] = handler; },
    emit() {}
};
reconnectingNetwork.setupEventListeners();
socketHandlers.disconnect();
assert.equal(reconnectingNetwork.aiShotPending, true, 'Disconnecting during moving balls must not cancel the AI shot');
assert.equal(reconnectingNetwork.aiShotInFlightAtDisconnect, true);
socketHandlers.game_rejoin({
    roomId: 'in-flight-room',
    myPlayerNumber: 1,
    host: { id: 'human' },
    guest: { id: 'bot', isBot: true },
    gameState: { currentPlayer: 2, balls: [] }
});
assert.equal(reconnectingGame.rejoinSnapshotApplied, undefined, 'A stale reconnect snapshot must not replace moving balls');
assert.equal(reconnectingGame.gameState, 'shooting');
assert.equal(reconnectingNetwork.aiShotPending, true, 'The original AI shot must remain the only active shot after reconnect');

const offlineTurnGame = {
    ...game,
    currentPlayer: 2,
    gameState: 'shooting',
    ballInHand: false,
    updateTurnIndicator() { this.turnUpdated = true; },
    startShotTimer() { this.timerStarted = true; }
};
const offlineTurnNetwork = new NetworkManager(offlineTurnGame);
offlineTurnNetwork.isAiMatch = true;
offlineTurnNetwork.myPlayerNumber = 1;
offlineTurnNetwork.roomId = 'offline-result-room';
offlineTurnNetwork.socket = { connected: false, emit() {} };
offlineTurnNetwork.switchToHumanTurn(false);
assert.equal(offlineTurnGame.currentPlayer, 1, 'A bot shot completed offline must restore the human turn');
assert.equal(offlineTurnGame.gameState, 'aiming');
assert.equal(offlineTurnGame.ballInHand, false);
offlineTurnNetwork.executeAiTurn = () => { offlineTurnGame.duplicateShotStarted = true; };
offlineTurnNetwork.applyAuthoritativeGameState({
    gameState: { currentPlayer: 2, ballInHand: false }
});
assert.equal(offlineTurnGame.currentPlayer, 1, 'A pre-shot reconnect snapshot must not overwrite a completed offline turn');
assert.equal(offlineTurnGame.duplicateShotStarted, undefined, 'A stale reconnect snapshot must not start a duplicate AI shot');
assert.ok(offlineTurnNetwork.lastAiResultPayload, 'The completed result must remain queued until acknowledged');
offlineTurnNetwork.applyAuthoritativeGameState({
    gameState: { currentPlayer: 1, ballInHand: false }
}, { aiResultAcknowledged: true });
assert.equal(offlineTurnNetwork.lastAiResultPayload, null, 'Acknowledgement must retire the queued AI result');

const recoveryRooms = new RoomManager();
const recoveryRoom = recoveryRooms.createRoom({ id: 'human-timeout', username: 'Human' });
recoveryRooms.joinRoom(recoveryRoom.id, { id: 'bot-timeout', username: 'AI_Test', isBot: true });
recoveryRoom.isAiMatch = true;
recoveryRoom.startGame();
recoveryRoom.gameState.currentPlayer = 2;
recoveryRoom.lastAction = 1000;
const livenessEvents = [];
const livenessServer = Object.create(MultiplayerServer.prototype);
livenessServer.roomManager = recoveryRooms;
livenessServer.connectedPlayers = new Map([['human-timeout', { id: 'human-timeout' }]]);
livenessServer.io = { to: roomId => ({ emit(event, payload) { livenessEvents.push({ roomId, event, payload }); } }) };
livenessServer.recoverStalledAiMatches(14000);
assert.equal(recoveryRoom.gameState.currentPlayer, 2, 'A recovery request must not steal an active AI turn');
assert.equal(livenessEvents.at(-1).event, 'ai_turn_recovery_requested', 'The server must request recovery before timing out the bot');
const actionBeforeHeartbeat = recoveryRoom.lastAction;
livenessServer.handleAiTurnStarted({ id: 'human-timeout' }, { roomId: recoveryRoom.id });
assert.ok(recoveryRoom.lastAction > actionBeforeHeartbeat, 'Starting a real AI shot must refresh the server deadline');
recoveryRoom.lastAction = 1000;
livenessServer.recoverStalledAiMatches(32000);
assert.equal(recoveryRoom.gameState.currentPlayer, 1, 'A hard AI timeout must return the turn to the human');
assert.equal(recoveryRoom.gameState.ballInHand, true, 'A timed-out AI turn must grant ball-in-hand');
assert.equal(livenessEvents.at(-1).payload.aiRecovered, true, 'The authoritative recovery update must be broadcast');

const fallbackGame = {
    ...game,
    balls: [{ ...cueBall, active: true }, { ...objectBall }],
    currentPlayer: 2,
    gameState: 'shooting',
    isMultiplayer: true,
    gameMode: 'multiplayer',
    startLocalAIWatchdog() { this.watchdogStarted = true; },
    scheduleAITurn() { this.aiScheduled = true; this.gameState = 'waiting'; },
    updateTurnIndicator() {},
    showMessage() {}
};
const fallbackNetwork = new NetworkManager(fallbackGame);
fallbackNetwork.isAiMatch = true;
fallbackNetwork.roomId = 'lost-server-room';
fallbackNetwork.recoverAiMatchLocally('test server restart');
assert.equal(fallbackGame.isMultiplayer, false, 'A lost online AI room must fall back to a local AI match');
assert.equal(fallbackGame.gameMode, 'ai');
assert.equal(fallbackGame.watchdogStarted, true, 'The local AI watchdog must take ownership after fallback');
assert.equal(fallbackGame.aiScheduled, true, 'An interrupted bot turn must be rescheduled locally');
assert.equal(fallbackGame.gameState, 'waiting');

timers.splice(0);
context.AIPlayer = class {};
let comboShotApplied = false;
const comboGame = {
    ...game,
    balls: [
        { ...cueBall, active: true, x: 200, y: 250 },
        { ...objectBall, id: 9, type: 'stripe', x: 500, y: 250, active: true },
        { ...objectBall, id: 10, type: 'stripe', x: 650, y: 250, active: true }
    ],
    currentPlayer: 2,
    gameState: 'waiting',
    tableState: 'closed',
    playerTypes: { 1: 'solid', 2: 'stripe' },
    ballInHand: false,
    shotPocketedBalls: [],
    physics: {
        ...game.physics,
        applyShot() { comboShotApplied = true; }
    }
};
const comboNetwork = new NetworkManager(comboGame);
comboNetwork.isAiMatch = true;
comboNetwork.myPlayerNumber = 1;
comboNetwork.roomId = 'combo-room';
comboNetwork.socket = { connected: true, emit() {} };
comboGame.tableState = 'open';
const inferredSolidTarget = comboNetwork.findBestBallForAi([
    { id: 0, x: 100, y: 100, active: true },
    { id: 3, x: 300, y: 200, active: true },
    { id: 8, x: 500, y: 200, active: true },
    { id: 11, x: 600, y: 200, active: true }
]);
comboGame.tableState = 'closed';
comboGame.playerTypes[2] = 'solid';
const groupSafeTarget = comboNetwork.findBestBallForAi([
    { id: 0, x: 100, y: 100, active: true },
    { id: 3, x: 300, y: 200, active: true },
    { id: 8, x: 500, y: 200, active: true },
    { id: 11, x: 600, y: 200, active: true }
]);
assert.notEqual(inferredSolidTarget?.id, 8, 'An open table must never target the 8-ball');
assert.equal(groupSafeTarget?.id, 3, 'Missing type fields must not make the AI skip a remaining group ball for the 8-ball');
comboGame.playerTypes[2] = 'stripe';
comboNetwork.aiPlanner = {
    calculateShot() {
        return {
            type: 'combo',
            targetBall: 9,
            comboBall: 10,
            angle: 0,
            power: 0.65,
            score: 100
        };
    }
};
comboNetwork.executeAiTurn({ gameState: { currentPlayer: 2, ballInHand: false } });
timers.shift()();
assert.equal(comboShotApplied, true, 'A planned combo shot must execute instead of crashing while its target is logged');

const continuingGame = {
    ...game,
    balls: [{ ...cueBall, active: true }, { ...objectBall, active: false }],
    currentPlayer: 2,
    gameState: 'shooting',
    tableState: 'closed',
    playerTypes: { 1: 'stripe', 2: 'solid' },
    shotPocketedBalls: [{ id: 1, type: 'solid' }]
};
const continuingNetwork = new NetworkManager(continuingGame);
continuingNetwork.isAiMatch = true;
continuingNetwork.myPlayerNumber = 1;
continuingNetwork.roomId = 'continue-room';
continuingNetwork.aiShotPending = true;
continuingNetwork.socket = { connected: true, emit() {} };
continuingNetwork.waitForAiShotComplete();
assert.equal(continuingGame.gameState, 'waiting', 'Consecutive AI turns must leave the completed shooting state');
assert.equal(continuingNetwork.aiShotPending, false, 'The next AI shot must be allowed to schedule');

console.log('PASS: AI recovers from stalls and server acknowledgements are idempotent');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { GameRoom } = require('../multiplayer/RoomManager.js');

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

console.log('PASS: AI recovers from foul ball-in-hand and reports a synchronized turn result');

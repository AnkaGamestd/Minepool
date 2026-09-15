const assert = require('node:assert/strict');
const { AIPlayer } = require('../www/ai-player.js');

const cue = { id: 0, x: 250, y: 250, active: true };
const solid = { id: 1, type: 'solid', x: 500, y: 250, active: true };
const stripe = { id: 9, type: 'stripe', x: 500, y: 370, active: true };
const eight = { id: 8, type: 'eight', x: 800, y: 400, active: true };
const pockets = [{ x: 950, y: 250, isCenter: false }];

Math.random = () => 0.5;
const ai = new AIPlayer('hard');
const shot = ai.calculateShot({}, [cue, solid, stripe, eight], cue, pockets, 'solids');

assert.equal(shot.targetBall, 1, 'AI must target its assigned group');
assert.equal(shot.type, 'direct', 'AI must recognize an unobstructed direct pot');
assert.ok(Math.abs(shot.angle) < 0.04, 'AI must aim along the direct line');
assert.ok(shot.power >= 0.35 && shot.power <= 1, 'AI power must remain valid');

const blockedTarget = { id: 2, type: 'solid', x: 500, y: 250, active: true };
const blocker = { id: 10, type: 'stripe', x: 375, y: 250, active: true };
const alternateTarget = { id: 3, type: 'solid', x: 470, y: 390, active: true };
const alternatePocket = { x: 964, y: 464, isCenter: false };
const selectedAroundBlocker = ai.calculateShot(
    {},
    [cue, blockedTarget, blocker, alternateTarget, eight],
    cue,
    [pockets[0], alternatePocket],
    'solids'
);
assert.notEqual(selectedAroundBlocker.targetBall, 2, 'AI must not shoot through an obstructing ball');

const railBall = { id: 4, type: 'solid', x: 40, y: 250, active: true };
const impossibleRailPocket = { x: 36, y: 36, isCenter: false };
assert.equal(
    ai.evaluateShot(cue, railBall, impossibleRailPocket, [cue, railBall], [railBall]),
    null,
    'AI must reject shots whose ghost-ball contact point is outside the playable bed'
);

console.log('PASS: hard AI selects legal, unobstructed and physically reachable shots');

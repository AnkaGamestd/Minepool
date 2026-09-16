const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'www', 'game.js'), 'utf8');
const context = {
    module: { exports: {} },
    console,
    document: { addEventListener() {} },
    window: { addEventListener() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
};
vm.runInNewContext(`${source}\nmodule.exports = PoolGame;`, context);

const PoolGame = context.module.exports;
const game = Object.create(PoolGame.prototype);
game.playerTypes = { 1: null, 2: null };
game.tableState = 'open';
game.updateTurnIndicator = () => {};

assert.equal(game.setPlayerGroups(1, 'stripe'), true);
assert.equal(game.playerTypes[1], 'stripe');
assert.equal(game.playerTypes[2], 'solid');
assert.equal(game.tableState, 'closed');
assert.equal(game.formatGroupLabel(game.playerTypes[1]), 'STRIPES');
assert.equal(game.formatGroupLabel(game.playerTypes[2]), 'SOLIDS');

assert.equal(
    game.getFirstPocketedGroup([{ id: 9, type: 'stripe' }, { id: 2, type: 'solid' }]),
    'stripe',
    'The first legally pocketed group must own the table'
);

assert.equal(game.setPlayerGroups(1, 'invalid'), false);
assert.equal(game.playerTypes[1], 'stripe', 'Invalid assignments must not alter player groups');

game.mobileSettings = {
    directAimMinRadius: 34
};
const cueBall = { x: 250, y: 250 };
assert.equal(game.calculateDirectTouchAim(500, 250, cueBall, 1), 0, 'Touching right must aim right');
assert.equal(game.calculateDirectTouchAim(250, 500, cueBall, 1), Math.PI / 2, 'Touching below must aim down');
assert.equal(game.calculateDirectTouchAim(250, 0, cueBall, 1), -Math.PI / 2, 'Touching above must aim up');
assert.equal(game.calculateDirectTouchAim(0, 250, cueBall, 1), Math.PI, 'Touching left must aim left');
assert.equal(game.calculateDirectTouchAim(260, 250, cueBall, 1.2), 1.2, 'Touches on the cue ball must preserve aim');

function makeRack(ids) {
    const balls = new Map(ids.map(id => [id, {
        className: 'rack-ball empty',
        textContent: '',
        attributes: {},
        style: {
            values: {},
            setProperty(name, value) { this.values[name] = value; },
            removeProperty(name) { delete this.values[name]; }
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; }
    }]));
    return {
        balls,
        querySelectorAll() { return [...balls.values()]; },
        querySelector(selector) {
            const id = Number(selector.match(/data-number="(\d+)"/)?.[1]);
            return balls.get(id) || null;
        }
    };
}

game.solidsRack = makeRack([1, 2, 3, 4, 5, 6, 7]);
game.stripesRack = makeRack([9, 10, 11, 12, 13, 14, 15]);
game.balls = [
    { id: 1, type: 'solid', active: false },
    { id: 9, type: 'stripe', active: false },
    { id: 10, type: 'stripe', active: true }
];
game.getBallColor = id => `color-${id}`;
game.rebuildBallRacksFromState();
assert.equal(game.solidsRack.balls.get(1).className, 'rack-ball pocketed solid');
assert.equal(game.stripesRack.balls.get(9).className, 'rack-ball pocketed stripe');
assert.equal(game.stripesRack.balls.get(10).className, 'rack-ball empty');
assert.equal(game.stripesRack.balls.get(9).style.values['--ball-color'], 'color-9');

game.balls = [
    { id: 0, active: true },
    { id: 2, active: true },
    { id: 10, active: false },
    { id: 8, active: true }
];
assert.equal(game.isGroupCleared('solid'), false, 'A reconnect payload without type must still see remaining solids by number');
assert.equal(game.isGroupCleared('stripe'), true, 'A group is cleared only when all numbered balls are inactive');
const mergedBalls = game.mergeAuthoritativeBalls([
    { id: 0, x: 100, y: 100, active: true },
    { id: 2, x: 300, y: 200, active: true },
    { id: 10, x: 400, y: 200, active: false },
    { id: 8, x: 500, y: 200, active: true }
]);
assert.equal(mergedBalls.find(ball => ball.id === 2).type, 'solid');
assert.equal(mergedBalls.find(ball => ball.id === 10).type, 'stripe');
assert.equal(mergedBalls.find(ball => ball.id === 8).type, 'eight');

console.log('PASS: group ownership, pocketed-ball HUD and direct 360-degree touch aiming stay consistent');

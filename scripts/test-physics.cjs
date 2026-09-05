const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('www/physics.js', 'utf8');
function engine(mobile) {
  return vm.runInNewContext(source + '\nnew PhysicsEngine()', {
    window: { matchMedia: () => ({ matches: mobile }) },
    navigator: { maxTouchPoints: mobile ? 1 : 0 }, console
  });
}
function roll(mobile) {
  const p = engine(mobile);
  const ball = { x: 0, y: 0, vx: 100, vy: 0, topspin: 1, sidespin: 1 };
  for (let i = 0; i < 240; i++) p.updateBallPhysics(ball, 1 / 240);
  assert(Math.abs(ball.vx - 76.48) < 1e-8);
  assert(ball.topspin > 0 && ball.topspin < 1);
  return ball.x;
}
assert.equal(roll(true), roll(false));
const p = engine(false);
p.playCollisionSound = () => {};
const balls = [
  { id: 1, x: 0, y: 0, vx: 100, vy: 0, active: true },
  { id: 2, x: 27, y: 0, vx: 0, vy: 0, active: true }
];
p.handleBallCollisions(balls);
assert(Math.abs(balls[0].vx + balls[1].vx - 100) < 1e-9);
assert(Math.abs(balls[1].vx - balls[0].vx - 98) < 1e-9);
balls[1].x = balls[0].x; balls[1].y = balls[0].y;
p.handleBallCollisions(balls);
assert(balls.every(b => Number.isFinite(b.x) && Number.isFinite(b.vx)));
const gameSource = fs.readFileSync('www/game.js', 'utf8');
const Game = vm.runInNewContext(gameSource.slice(0, gameSource.indexOf('    pauseForPlatform()')) + '\n}\nPoolGame', {
  performance: { now: () => 0 }, requestAnimationFrame: () => 1
});
for (const hz of [30, 60, 120]) {
  let steps = 0;
  const game = { gameState: 'shooting', balls: [], physics: { dt: 1 / 60, update: () => { steps++; return []; } }, render() {} };
  Game.prototype.animate.call(game);
  for (let frame = 1; frame <= hz * 2; frame++) Game.prototype.animate.call(game, frame * 1000 / hz);
  assert.equal(steps, 120, `${hz}Hz must simulate two seconds`);
}
console.log('PASS: mobile/desktop rolling, spin decay, collision momentum, overlap safety, 30/60/120Hz timing');

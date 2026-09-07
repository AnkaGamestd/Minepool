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
  const ball = { x: 0, y: 0, vx: 100, vy: 0, w: { x: 0, y: 100 / 14, z: 5 } };
  for (let i = 0; i < 240; i++) p.updateBallPhysics(ball, 1 / 240);
  assert(Math.abs(ball.vx - 76.48) < 1e-8);
  assert(Math.abs(ball.w.y * 14 - ball.vx) < 1e-8);
  assert(ball.w.z > 0 && ball.w.z < 5);
  return ball.x;
}
assert.equal(roll(true), roll(false));
const p = engine(false);
assert.equal(p.getShotSpeed(0), 0);
assert.equal(p.getShotSpeed(10), 110, 'low power remains proportional');
assert(p.getShotSpeed(50) > 650, 'medium shot is stronger');
assert.equal(p.getShotSpeed(100), 1650);
assert.equal(p.getShotSpeed(1000), 1650);
assert.equal(p.getShotSpeed(NaN), 0);
for (let power = 1; power <= 100; power++) assert(p.getShotSpeed(power) > p.getShotSpeed(power - 1));
const hard = engine(false); hard.initTable(10000,10000,25); hard.pockets=[];
const striker = {id:0,x:1000,y:1000,active:true,vx:0,vy:0};
const object = {id:1,x:1200,y:1000,active:true,vx:0,vy:0};
hard.applyShot(striker,0,100,0,0);
for(let i=0;i<20;i++) hard.update([striker,object]);
assert.equal(hard.shotFirstContact,1,'full power cannot skip the target');
assert(object.vx>1200,'full power transfers momentum to the target');
console.log('POWER:', [10,50,75,100].map(power=>({power,speed:p.getShotSpeed(power)})));
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
// Spin must produce follow/draw regardless of ball ordering in a received state.
function spinShot(spinY, reverse = false, distance = 95) {
  const p = engine(false); p.initTable(10000, 10000, 25); p.pockets = [];
  const cue = { id: 0, x: 1000, y: 1000, vx: 0, vy: 0, active: true };
  const target = { id: 1, x: 1000 + distance, y: 1000, vx: 0, vy: 0, active: true };
  const set = reverse ? [target, cue] : [cue, target];
  p.applyShot(cue, 0, 45, 0, spinY);
  for (let i = 0; i < 90; i++) p.update(set);
  assert.equal(p.shotFirstContact, 1);
  return cue.x;
}
const draw = spinShot(.85), centre = spinShot(0), follow = spinShot(-.85);
assert(draw < 1040, `draw must reverse: ${draw}`);
assert(follow > centre + 30, `follow must run beyond centre: ${follow}/${centre}`);
assert(centre > draw + 30);
assert(Math.abs(draw - spinShot(.85, true)) < 1e-7, 'draw independent of array order');
assert(Math.abs(follow - spinShot(-.85, true)) < 1e-7, 'follow independent of array order');
function rail(spin) {
  const p = engine(false); p.initTable(1000, 500, 25);
  const ball = { id: 0, x: 962, y: 200, active: true };
  p.applyShot(ball, 0, 40, spin, 0);
  const energy = b => b.vx*b.vx + b.vy*b.vy + .4*14*14*(b.w.x*b.w.x+b.w.y*b.w.y+b.w.z*b.w.z);
  const before = energy(ball);
  p.handleCushionCollisions([ball]);
  assert(energy(ball) <= before + 1e-7, 'rail cannot create energy');
  assert(ball.vx < 0);
  return ball.vy;
}
assert(rail(1) < -10 && rail(-1) > 10 && Math.abs(rail(0)) < 1e-7, 'opposite english changes rail angle');
const stopEngine = engine(false); stopEngine.initTable(1000,500,25);
const stopBall = { id:0, x:400, y:250, active:true };
stopEngine.applyShot(stopBall, .7, 50, .6, .6);
for(let i=0;i<2400;i++) stopEngine.update([stopBall]);
assert(stopEngine.allBallsStopped([stopBall]), 'spin shot settles');
const rotating = {active:true,vx:0,vy:0,w:{x:0,y:-5,z:0}};
assert(!stopEngine.allBallsStopped([rotating]), 'draw must not end at momentary zero translational speed');
const pocketEngine = engine(false); pocketEngine.initTable(1000,500,25);
const pocketBall = {id:1,x:500,y:44,vx:0,vy:-750,active:true};
let fastPocketCount=0;
for(let i=0;i<3;i++) fastPocketCount+=pocketEngine.update([pocketBall]).length;
assert.equal(fastPocketCount,1,'fast centre-pocket entry captured before rebound');
console.log('SPIN:', {draw, centre, follow, rightEnglish:rail(1), leftEnglish:rail(-1)});
// Middle pockets must not collect balls that run along the long rail.
for (const top of [true, false]) {
  const p = engine(false); p.initTable(1000,500,25);
  const line = top ? 39 : 461;
  const inward = top ? -1 : 1;
  const centre = p.pockets[top?1:4];
  assert.equal(centre.y,top?13:487,'visual and physical centres are recessed');
  for (const speed of [0, .2, 1, 80, 1650]) for (const direction of [-1,1]) {
    for (let x=478;x<=522;x++) {
      const ball = {id:1,x,y:line,vx:speed*direction,vy:0,active:true};
      assert.equal(p.checkPockets([ball]).length,0,`parallel pass at ${speed}: ${top}`);
    }
  }
  for (const direction of [-1,1]) {
    const ball = {id:1,x:500-direction*45,y:line,vx:direction*1650,vy:0,active:true};
    for(let i=0;i<5;i++) assert.equal(p.update([ball]).length,0,'full-speed rail pass must survive substeps');
    assert(ball.active && (ball.x-500)*direction>40);
  }
  for(const speed of [.1,1,300,1650]) for(const vx of [-speed,0,speed]) {
    const ball={id:1,x:500,y:centre.y-inward*(p.centerPocketRadius-.001),vx,vy:inward*speed,active:true};
    assert.equal(p.checkPockets([ball]).length,1,'slow, direct and diagonal pocket entries work');
    assert.equal(ball.pocket,top?1:4);
  }
  const away={id:1,x:500,y:centre.y-inward*10,vx:40,vy:-inward*30,active:true};
  assert.equal(p.checkPockets([away]).length,0,'outgoing ball is not collected');
  const approach={id:1,x:500,y:line-inward*1,vx:0,vy:inward*60,active:true};
  let count=0;for(let i=0;i<30;i++)count+=p.update([approach]).length;
  assert.equal(count,1,'approach crosses mouth and is reported only once');
  const aim=p.calculateAimLine({id:0,x:500,y:250},top?-Math.PI/2:Math.PI/2,[],50);
  assert(aim.points.some(point=>point.type==='pocket'),'aim guide ends in recessed side pocket');
  assert(!aim.points.some(point=>point.type==='reflection'),'no phantom bounce across pocket mouth');
}
console.log('PASS: both middle pockets, parallel rail passes, slow/fast/diagonal entry and outgoing balls');
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

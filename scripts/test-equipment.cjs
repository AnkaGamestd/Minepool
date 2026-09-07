// Run with Playwright available on NODE_PATH. Exercises the packaged www app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

(async () => {
    const app = express();
    app.use(express.static(path.resolve(__dirname, '../www')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const output = path.resolve(__dirname, '../test-results/equipment');
    fs.mkdirSync(output, { recursive: true });
    try {
        for (const [name, viewport, density, touch] of [
            ['desktop', { width: 1440, height: 900 }, 1, false],
            ['phone', { width: 844, height: 390 }, 3, true],
            ['tablet', { width: 1280, height: 800 }, 2, true]
        ]) {
            const context = await browser.newContext({ viewport, deviceScaleFactor: density, hasTouch: touch });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(`http://127.0.0.1:${server.address().port}/`);
            await page.waitForFunction(() => window.MinePoolApp && window.gameInstance);
            await page.locator('#open-cues').click();
            const modalBounds = await page.locator('#cue-modal .modal-card').boundingBox();
            assert(modalBounds.y >= 0 && modalBounds.y + modalBounds.height <= viewport.height, `${name}: cue modal fits`);
            await page.screenshot({ path: path.join(output, `${name}-cues.png`) });
            await page.locator('[data-cue="legendary"].cue-option').click();
            await page.locator('#play-two').click();
            await page.waitForFunction(() => window.gameInstance.gameState === 'aiming');
            await page.waitForTimeout(600);
            const geometry = await page.evaluate(() => {
                const g = window.gameInstance;
                const rect = g.canvas.getBoundingClientRect();
                const expected = Math.round(1000 * Math.min(3, Math.max(1, rect.width * Math.min(devicePixelRatio, 3) / 1000)));
                return { actual: g.canvas.width, expected, radius: g.physics.BALL_RADIUS,
                    count: g.balls.length, finite: g.balls.every(b => Number.isFinite(b.x) && Number.isFinite(b.y)) };
            });
            assert.equal(geometry.actual, geometry.expected, `${name}: density`);
            assert.equal(geometry.count, 16); assert.equal(geometry.radius, 14); assert(geometry.finite);
            // High-DPI input must aim in logical table coordinates, not backing pixels.
            const input = await page.evaluate(() => {
                const g = window.gameInstance, b = g.balls[0], rect = g.canvas.getBoundingClientRect();
                const event = { clientX: rect.left + (b.x + 150) / 1000 * rect.width,
                    clientY: rect.top + (b.y + 75) / 500 * rect.height };
                g.ballInHand = false; g.isMobile = false; g.handleMouseMove(event);
                const angle = g.aimAngle;
                g.ballInHand = true;
                g.handleTouchStart({ preventDefault() {}, touches: [{ ...event, identifier: 1 }] });
                g.handleTouchMove({ preventDefault() {}, touches: [{ ...event, identifier: 1 }] });
                const placed = { x: g.balls[0].x, y: g.balls[0].y };
                g.handleTouchEnd({ preventDefault() {}, touches: [], changedTouches: [{ ...event, identifier: 1 }] });
                g.ballInHand = false;
                return { angle, placed };
            });
            assert(Math.abs(input.angle - Math.atan2(75, 150)) < .001, `${name}: mouse aim`);
            assert(Math.abs(input.placed.x - 236) < .001 && Math.abs(input.placed.y - 325) < .001, `${name}: touch kitchen placement`);
            await page.evaluate(() => {
                const g = window.gameInstance;
                // An unobscured, repeatable frame for visual review, then a real shot below.
                g.balls[0].x = 670; g.balls[0].y = 355; g.aimAngle = -.14; g.power = 0;
                document.getElementById('game-message').classList.add('hidden'); g.render();
            });
            await page.screenshot({ path: path.join(output, `${name}-table.png`) });
            const spin = await page.locator('.spin-ball').boundingBox();
            await page.mouse.move(spin.x + spin.width / 2, spin.y + spin.height / 2);
            await page.mouse.down();
            await page.mouse.move(spin.x + spin.width * 1.5, spin.y + spin.height * 1.5);
            await page.mouse.up();
            const selected = await page.evaluate(() => ({x:gameInstance.spinX,y:gameInstance.spinY}));
            assert(Math.abs(Math.hypot(selected.x, selected.y) - 1) < .001, 'spin stays inside circle');
            await page.locator('#reset-spin').click();
            await page.locator('.spin-ball').click({position:{x:spin.width/2,y:spin.height*.9}});
            assert(await page.evaluate(() => gameInstance.spinY > .7), 'draw selected');
            const gauge = await page.locator('#power-gauge').boundingBox();
            const gx=gauge.x+gauge.width/2, gy=gauge.y+gauge.height-2;
            await page.mouse.move(gx,gy); await page.mouse.down();
            assert.equal(await page.evaluate(() => gameInstance.power),0,'touching gauge does not jump to full power');
            await page.mouse.move(gx,gy-gauge.height*.4);
            assert(Math.abs(await page.evaluate(() => gameInstance.power)-50)<1,'upwards pull increases power');
            await page.keyboard.press('Escape'); await page.mouse.up();
            assert.equal(await page.evaluate(() => gameInstance.gameState),'aiming','Escape cancels without shooting');
            if (touch) {
                const cdp=await context.newCDPSession(page);
                await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gx,y:gy}]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:gx,y:gy-gauge.height*.4}]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
                assert.equal(await page.evaluate(() => gameInstance.gameState),'aiming','touch cancel cannot shoot');
                await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gx,y:gy}]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:gx,y:gy-gauge.height*.4}]});
                await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
                await cdp.detach();
            } else {
                await page.mouse.move(gx,gy);await page.mouse.down();
                await page.mouse.move(gx,gy-gauge.height*.4);await page.mouse.up();
            }
            const shot = await page.evaluate(() => ({state:gameInstance.gameState,speed:Math.hypot(gameInstance.balls[0].vx,gameInstance.balls[0].vy),spin:gameInstance.balls[0].w.y}));
            assert(shot.spin<0,'selected draw reaches physical angular velocity');
            assert(shot.speed > 0, `${name}: shot launches`);
            await page.waitForTimeout(400);
            assert.deepEqual(errors, [], `${name}: runtime errors`);
            console.log(name, JSON.stringify({ geometry, input, shot }));
            if (name === 'desktop') {
                // Equipment contact sheet rendered by the same production functions.
                await page.evaluate(() => {
                    const c = document.createElement('canvas'); c.id = 'equipment-review'; c.width = 1200; c.height = 620;
                    c.style.cssText = 'position:fixed;inset:0;z-index:9999;width:1200px;height:620px'; document.body.append(c);
                    const ctx = c.getContext('2d'); ctx.fillStyle = '#102e2c'; ctx.fillRect(0,0,1200,620);
                    ctx.fillStyle = '#eee7d7'; ctx.font = '600 22px Arial'; ctx.fillText('MINE POOL / EQUIPMENT', 48,48);
                    for(let id=0;id<16;id++) PoolArt.drawBall(ctx,{ id, x:95+(id%8)*144, y:120+Math.floor(id/8)*120 },40);
                    for(const [i,style] of ['standard','premium','legendary'].entries()) {
                        ctx.fillStyle='#c6d1cb'; ctx.font='14px Arial'; ctx.fillText(style.toUpperCase(),48,350+i*90);
                        ctx.save();ctx.translate(1110,355+i*90);ctx.scale(1.65,1.65);PoolArt.drawCue(ctx,style);ctx.restore();
                    }
                });
                await page.locator('#equipment-review').screenshot({ path: path.join(output, 'equipment-detail.png') });
            }
            await context.close();
        }
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

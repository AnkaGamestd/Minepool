const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { chromium } = require('playwright');

(async () => {
    const app = express();
    app.use(express.static(path.resolve(__dirname, '../www')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    let browser;
    try {
        browser = await chromium.launch(process.env.CHROMIUM_PATH
            ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' });
        const output = path.resolve(__dirname, '../test-results/mobile-layout');
        fs.mkdirSync(output, { recursive: true });

        for (const [width, height] of [[568, 320], [640, 360], [740, 320], [844, 390], [915, 412], [1024, 768], [390, 844]]) {
            const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
            const page = await context.newPage();
            page.setDefaultTimeout(8000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            const visible = async selector => {
                const locator = page.locator(selector);
                await locator.scrollIntoViewIfNeeded();
                const result = await locator.evaluate(element => {
                    const box = element.getBoundingClientRect();
                    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                    return { inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + .5 && box.bottom <= innerHeight + .5,
                        reachable: hit === element || element.contains(hit) };
                });
                assert(result.inside && result.reachable, `${width}x${height}: ${selector} must be visible and reachable`);
            };

            await page.goto(`http://127.0.0.1:${server.address().port}/`);
            await page.waitForFunction(() => window.MinePoolApp && window.gameInstance);
            await visible('#play-practice');
            await page.locator('#open-cues').tap();
            await visible('.cue-option[data-cue="legendary"]');
            await visible('#close-cues');
            await page.locator('#close-cues').tap();

            await page.locator('#open-profile').tap();
            await visible('#account-open');
            await page.locator('#account-open').tap();
            await visible('#account-google');
            await visible('#account-close');
            await page.locator('#account-close').tap();
            await visible('#profile-edit');
            await page.locator('#profile-edit').tap();
            await visible('#account-close');
            await page.locator('#account-close').tap();
            await visible('#profile-home');
            await page.locator('#profile-home').tap();

            await page.locator('#play-tournament').tap();
            await visible('.tournament-tier.diamond');
            await visible('.tournament-back');
            await page.locator('.tournament-back').tap();
            await page.locator('#play-practice').tap();
            await page.waitForFunction(() => gameInstance.gameState === 'aiming');
            await page.evaluate(() => {
                document.getElementById('p1-name').textContent = 'LongPlayerName12345678';
                document.getElementById('p2-name').textContent = 'AnotherLongPlayer12345';
            });

            const verifyMatch = async () => {
                const layout = await page.evaluate(() => {
                    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
                    const targets = ['#power-gauge', '.spin-ball', '#reset-spin', '#aim-left', '#aim-right'];
                    return { table: box('#pool-table'), timer: box('#timer-text'), turn: box('#turn-indicator'),
                        controls: box('.match-controls'), targets: targets.map(selector => [selector, box(selector)]),
                        names: [1, 2].map(i => ({ name: box(`#p${i}-name`), rack: box(`#p${i}-panel .ball-rack`),
                            balls: [...document.querySelectorAll(`#p${i}-panel .rack-ball`)].map(ball => ball.getBoundingClientRect().toJSON()),
                            rackVisible: getComputedStyle(document.querySelector(`#p${i}-panel .ball-rack`)).display !== 'none' })) };
                });
                const viewport = page.viewportSize();
                for (const rect of [layout.table, layout.controls, layout.timer]) {
                    assert(rect.x >= 0 && rect.y >= 0 && rect.right <= viewport.width + .5 && rect.bottom <= viewport.height + .5, 'match fits viewport');
                }
                assert(layout.table.bottom <= layout.controls.top, 'controls stay below the cloth');
                assert(layout.timer.top >= layout.turn.top && layout.timer.bottom <= layout.turn.bottom, 'timer is not clipped');
                for (const [selector, rect] of layout.targets) {
                    assert(rect.width >= 44 && rect.height >= 44, `${selector}: 44px touch target`);
                }
                for (const { name, rack, rackVisible, balls } of layout.names) {
                    if (!rackVisible) continue;
                    assert(name.right <= rack.left + .5 || rack.right <= name.left + .5 ||
                        name.bottom <= rack.top + .5 || rack.bottom <= name.top + .5, 'names do not overlap balls');
                    for (const ball of balls) assert(ball.left >= rack.left - .5 && ball.right <= rack.right + .5, 'every ball fits inside its rack');
                }
            };
            await verifyMatch();
            await page.screenshot({ path: path.join(output, `${width}x${height}-match.png`), scale: 'css' });
            const table = await page.locator('#pool-table').boundingBox();
            await page.touchscreen.tap(table.x + table.width * .2, table.y + table.height / 2);
            await page.waitForFunction(() => !gameInstance.ballInHand);
            await page.locator('#aim-right').tap();
            const angle = await page.evaluate(() => gameInstance.aimAngle);
            await page.locator('#aim-right').tap();
            assert(await page.evaluate(() => gameInstance.aimAngle) > angle, 'fine aim remains usable');
            await page.locator('.spin-ball').tap();
            await page.locator('#reset-spin').tap();

            if (width === 844) {
                await page.setViewportSize({ width: 390, height: 844 });
                await verifyMatch();
                await page.setViewportSize({ width, height });
                await verifyMatch();
                assert.equal(await page.evaluate(() => gameInstance.gameState), 'aiming', 'rotation preserves the match');
            }
            assert.deepEqual(errors, [], 'no browser runtime errors');
            console.log(`PASS ${width}x${height}: menu, scrollable panels, tournament, match and touch controls`);
            await context.close();
        }
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

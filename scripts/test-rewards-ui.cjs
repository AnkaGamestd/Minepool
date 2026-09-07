const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

const rewardPayload = state => ({
    success: true, coins: state.coins, serverTime: Date.now(),
    daily: { amount: 100, claimed: state.claimed, nextReset: Date.now() + 3600000, streak: state.claimed ? 1 : 0 },
    referral: { amount: 500, code: 'MINE8BALL', count: 2, redeemed: false, canRedeem: true }
});

(async () => {
    const app = express();
    const state = { coins: 1000, claimed: false };
    app.use(express.json());
    app.get('/api/auth/me', (_req, res) => res.json({ success: true, user: { id: 7, username: 'RewardPlayer', email: 'reward@example.com', provider: 'email', coins: state.coins, elo: 1200 } }));
    app.get('/api/rewards', (_req, res) => res.json(rewardPayload(state)));
    app.post('/api/rewards/daily', (_req, res) => { const awarded = state.claimed ? 0 : 100; state.claimed = true; state.coins += awarded; res.json({ ...rewardPayload(state), awarded }); });
    app.post('/api/rewards/referral', (_req, res) => res.json({ ...rewardPayload(state), inviterAwarded: 500 }));
    app.use(express.static(path.resolve(__dirname, '../www')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const output = path.resolve(__dirname, '../test-results/rewards');
    fs.mkdirSync(output, { recursive: true });
    try {
        for (const [name, viewport, authenticated] of [
            ['android-landscape', { width: 844, height: 390 }, true],
            ['phone-portrait', { width: 390, height: 844 }, true],
            ['guest-landscape', { width: 844, height: 390 }, false]
        ]) {
            console.log(`Checking ${name}…`);
            state.coins = 1000; state.claimed = false;
            const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
            if (authenticated) await context.addInitScript(() => localStorage.setItem('minepool.auth.token.v1', 'test-token'));
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForFunction(() => window.MinePoolApp && document.querySelector('#loading-screen')?.classList.contains('is-ready'), null, { timeout: 15000 });
            console.log(`${name}: app ready`);

            await page.locator('#open-profile').click();
            console.log(`${name}: profile opened`);
            assert(await page.locator('#profile-view').isVisible(), `${name}: top-left profile opens`);
            await page.locator('#profile-home').click();
            await page.locator('#open-rewards').click();
            console.log(`${name}: rewards opened`);
            assert(await page.locator('#rewards-view').isVisible(), `${name}: rewards opens`);
            if (authenticated) {
                await page.waitForFunction(() => document.querySelector('#invite-code')?.value === 'MINE8BALL');
                console.log(`${name}: rewards loaded`);
                await page.locator('#claim-daily').click();
                await page.waitForFunction(() => Number(document.querySelector('#rewards-coins')?.textContent.replace(/[^0-9]/g, '')) === 1100);
                console.log(`${name}: daily claimed`);
                assert.equal(await page.locator('#claim-daily').textContent(), '✓ COLLECTED TODAY');
            } else {
                assert.equal(await page.locator('#claim-daily').textContent(), 'SIGN IN TO CLAIM');
                await page.locator('#claim-daily').click();
                assert(await page.locator('#account-modal').isVisible(), `${name}: guest claim opens account`);
                await page.locator('#account-close').click();
            }
            const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, rewardWidth: document.querySelector('#rewards-view').scrollWidth }));
            assert(layout.scrollWidth <= layout.width, `${name}: page has horizontal overflow`);
            assert(layout.rewardWidth <= layout.width, `${name}: rewards view has horizontal overflow`);
            await page.locator('#rewards-view').evaluate(element => element.scrollTo(0, 0));
            await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
            console.log(`${name}: screenshot saved`);
            assert.deepEqual(errors, [], `${name}: runtime errors`);
            await context.close();
        }
        console.log('Rewards navigation, authenticated claim, guest sign-in and responsive layout tests passed.');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

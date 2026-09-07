const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const port = 8132;
const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minepool-friends-ui-'));
const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), MINEPOOL_DATA_DIR: dataDir, JWT_SECRET: 'friends-ui-test-secret' },
    stdio: ['ignore', 'ignore', 'inherit']
});
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const auth = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

async function request(url, options = {}) {
    const response = await fetch(base + url, options);
    return { status: response.status, data: await response.json() };
}
async function register(username, email) {
    const result = await request('/api/auth/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, email, password: 'correct-horse-42' })
    });
    assert.equal(result.status, 200);
    return result.data;
}

(async () => {
    let browser;
    try {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
            await wait(250);
            try { ready = (await fetch(base + '/')).ok; } catch (error) { /* Starting. */ }
        }
        assert(ready, 'Friends UI test server did not start');
        const alice = await register('AliceBreak', 'alice-ui@example.com');
        const bob = await register('BobCue', 'bob-ui@example.com');
        assert.equal((await request('/api/friends/requests', {
            method: 'POST', headers: auth(alice.token), body: JSON.stringify({ targetUserId: bob.user.id })
        })).status, 200);
        assert.equal((await request('/api/friends/requests/respond', {
            method: 'POST', headers: auth(bob.token), body: JSON.stringify({ requesterId: alice.user.id, action: 'accept' })
        })).status, 200);

        browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
        const output = path.join(root, 'test-results', 'friends');
        fs.mkdirSync(output, { recursive: true });
        const makePage = async account => {
            const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
            await context.addInitScript(token => localStorage.setItem('minepool.auth.token.v1', token), account.token);
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.MinePoolApp && window.networkManager?.isConnected() && document.querySelector('#loading-screen')?.classList.contains('is-ready'));
            return { context, page, errors };
        };
        const alicePage = await makePage(alice);
        const bobPage = await makePage(bob);

        const menuButtonLayout = await alicePage.page.locator('#play-friend').evaluate(button => {
            const box = button.getBoundingClientRect();
            const icon = button.querySelector('svg').getBoundingClientRect();
            const label = button.querySelector('span').getBoundingClientRect();
            return { left: box.left, right: box.right, iconLeft: icon.left, labelRight: label.right };
        });
        assert(menuButtonLayout.iconLeft >= menuButtonLayout.left && menuButtonLayout.labelRight <= menuButtonLayout.right, 'Play With Friend content fits its menu button');
        await alicePage.page.locator('#play-friend').click();
        await alicePage.page.waitForFunction(() => document.querySelector('#friend-list')?.textContent.includes('BobCue'));
        const aliceLayout = await alicePage.page.evaluate(() => ({
            viewport: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            card: document.querySelector('.friends-card').getBoundingClientRect().toJSON(),
            playDisabled: document.querySelector('#friend-list .friend-play')?.disabled
        }));
        assert.equal(aliceLayout.playDisabled, false, 'Online friend can be invited');
        assert(aliceLayout.documentWidth <= aliceLayout.viewport, 'Friends screen has no horizontal overflow');
        assert(aliceLayout.card.top >= 0 && aliceLayout.card.bottom <= 390, 'Friends card fits Android landscape');
        await alicePage.page.screenshot({ path: path.join(output, 'friends-list-landscape.png') });

        await alicePage.page.locator('#friend-list .friend-play').click();
        await bobPage.page.locator('.friend-invite-overlay:not(.hidden)').waitFor();
        assert.match(await bobPage.page.locator('.friend-invite-card').textContent(), /AliceBreak/);
        await bobPage.page.screenshot({ path: path.join(output, 'friend-match-invitation.png') });
        await bobPage.page.locator('#friend-invite-accept').click();
        await Promise.all([
            alicePage.page.locator('#game-view:not(.hidden)').waitFor(),
            bobPage.page.locator('#game-view:not(.hidden)').waitFor()
        ]);
        assert.equal(await alicePage.page.evaluate(() => window.networkManager.myPlayerNumber), 1);
        assert.equal(await bobPage.page.evaluate(() => window.networkManager.myPlayerNumber), 2);
        assert.deepEqual(alicePage.errors, [], 'Inviter page has no runtime errors');
        assert.deepEqual(bobPage.errors, [], 'Invitee page has no runtime errors');
        await alicePage.context.close();
        await bobPage.context.close();
        console.log('Android landscape friends list and invite-accept-to-game UI flow passed.');
    } finally {
        await browser?.close();
        server.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

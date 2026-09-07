const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

(async () => {
    const app = express();
    let username = 'MobilePlayer';
    let profilePicture = '/google-avatar.png';
    const user = () => ({ id: 10, username, email: 'mobile@example.com', provider: 'google', profilePicture, coins: 1000, elo: 1200, gamesPlayed: 0, gamesWon: 0 });
    app.use(express.json());
    app.get('/api/auth/me', (_req, res) => res.json({ success: true, user: user() }));
    app.post('/api/profile/change-username', (req, res) => { username = req.body.username; res.json({ success: true, user: user() }); });
    app.post('/api/profile/avatar', (_req, res) => { profilePicture = '/uploaded-avatar.png'; res.json({ success: true, user: user() }); });
    app.delete('/api/profile/avatar', (_req, res) => { profilePicture = '/google-avatar.png'; res.json({ success: true, user: user() }); });
    app.get(['/google-avatar.png', '/uploaded-avatar.png'], (_req, res) => res.type('png').send(png));
    app.use(express.static(path.resolve(__dirname, '../www')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const output = path.resolve(__dirname, '../test-results/profile');
    fs.mkdirSync(output, { recursive: true });
    try {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
        await context.addInitScript(() => localStorage.setItem('minepool.auth.token.v1', 'test-token'));
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.MinePoolApp && document.querySelector('#loading-screen')?.classList.contains('is-ready'));
        await page.locator('#open-profile').click();
        assert(await page.locator('#profile-avatar img').isVisible(), 'Connected account photo is shown');
        await page.locator('#profile-edit').click();
        assert(await page.locator('#profile-editor-modal').isVisible(), 'Profile editor opens');
        await page.locator('#profile-nick').fill('CueArtist');
        await page.locator('#profile-nick-form button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelector('#profile-name')?.textContent === 'CueArtist');

        await page.locator('#profile-photo-input').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: png });
        await page.waitForFunction(() => document.querySelector('#profile-photo-preview img')?.src.endsWith('/uploaded-avatar.png'));
        assert((await page.locator('#profile-avatar img').getAttribute('src')).endsWith('/uploaded-avatar.png'));
        assert((await page.locator('#p1-panel .avatar img').getAttribute('src')).endsWith('/uploaded-avatar.png'));
        await page.screenshot({ path: path.join(output, 'android-landscape-editor.png') });

        await page.locator('#profile-photo-remove').click();
        await page.waitForFunction(() => document.querySelector('#profile-photo-preview img')?.src.endsWith('/google-avatar.png'));
        assert.equal(await page.locator('#profile-nick-count').textContent(), '9 / 20');
        const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, card: document.querySelector('.profile-editor-card').getBoundingClientRect() }));
        assert(layout.scrollWidth <= layout.width, 'Profile editor has no horizontal overflow');
        assert(layout.card.top >= 0 && layout.card.bottom <= layout.height, 'Profile editor fits landscape screen');
        assert.deepEqual(errors, [], 'Profile editor has no runtime errors');
        await context.close();
        console.log('Mobile profile editor, nickname, account-photo override, restore and responsive layout tests passed.');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

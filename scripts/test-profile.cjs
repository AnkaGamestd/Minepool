const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 8129;
const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minepool-profile-'));
const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), MINEPOOL_DATA_DIR: dataDir, JWT_SECRET: 'profile-integration-test-secret' },
    stdio: ['ignore', 'ignore', 'inherit']
});
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const auth = token => ({ authorization: `Bearer ${token}` });

async function json(url, options = {}) {
    const response = await fetch(base + url, options);
    return { status: response.status, data: await response.json() };
}
async function register(username, email) {
    const response = await json('/api/auth/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, email, password: 'correct-horse-42' })
    });
    assert.equal(response.status, 200);
    return response.data;
}

(async () => {
    try {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
            await wait(250);
            try { ready = (await fetch(base + '/')).ok; } catch (error) { /* Starting. */ }
        }
        assert(ready, 'Profile test server did not start');
        const first = await register('FirstPlayer', 'first@example.com');
        const second = await register('SecondPlayer', 'second@example.com');

        const nickname = await json('/api/profile/change-username', {
            method: 'POST', headers: { ...auth(first.token), 'content-type': 'application/json' }, body: JSON.stringify({ username: 'BreakMaster' })
        });
        assert.equal(nickname.status, 200);
        assert.equal(nickname.data.user.username, 'BreakMaster');
        const duplicate = await json('/api/profile/change-username', {
            method: 'POST', headers: { ...auth(second.token), 'content-type': 'application/json' }, body: JSON.stringify({ username: 'breakmaster' })
        });
        assert.equal(duplicate.status, 400);

        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
        const form = new FormData();
        form.append('avatar', new Blob([png], { type: 'image/png' }), 'unsafe-name.html');
        const uploadResponse = await fetch(base + '/api/profile/avatar', { method: 'POST', headers: auth(first.token), body: form });
        const upload = await uploadResponse.json();
        assert.equal(uploadResponse.status, 200);
        assert.match(upload.user.profilePicture, /^\/uploads\/avatars\/avatar_\d+_[a-f0-9-]+\.png$/);
        const imageResponse = await fetch(base + upload.user.profilePicture);
        assert.equal(imageResponse.status, 200);
        assert.equal(imageResponse.headers.get('content-type'), 'image/png');

        const invalid = new FormData();
        invalid.append('avatar', new Blob(['not an image'], { type: 'text/html' }), 'avatar.html');
        assert.equal((await fetch(base + '/api/profile/avatar', { method: 'POST', headers: auth(first.token), body: invalid })).status, 400);
        const removed = await json('/api/profile/avatar', { method: 'DELETE', headers: auth(first.token) });
        assert.equal(removed.status, 200);
        assert.equal(removed.data.user.profilePicture, null);
        assert.equal((await fetch(base + upload.user.profilePicture)).status, 404);

        const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')).find(user => user.email === 'first@example.com');
        assert.equal(stored.username, 'BreakMaster');
        assert.equal(stored.profilePicture, null);
        console.log('Unique nickname, safe avatar upload, static delivery, replacement and removal tests passed.');
    } finally { server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

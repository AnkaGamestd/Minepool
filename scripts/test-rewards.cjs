const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 8128;
const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minepool-rewards-'));
const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), MINEPOOL_DATA_DIR: dataDir, JWT_SECRET: 'rewards-integration-test-secret' },
    stdio: ['ignore', 'ignore', 'inherit']
});
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, { token, method = 'GET', body } = {}) {
    const response = await fetch(base + url, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
}
async function register(username, email) {
    const result = await request('/api/auth/register', { method: 'POST', body: { username, email, password: 'correct-horse-42' } });
    assert.equal(result.status, 200);
    assert(result.data.token);
    return result.data;
}

(async () => {
    try {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
            await wait(250);
            try { ready = (await fetch(base + '/')).ok; } catch (error) { /* Starting. */ }
        }
        assert(ready, 'Rewards test server did not start');

        const inviter = await register('Inviter', 'inviter@example.com');
        const initial = await request('/api/rewards', { token: inviter.token });
        assert.equal(initial.status, 200);
        assert.equal(initial.data.coins, 1000);
        assert.match(initial.data.referral.code, /^[A-Z0-9]{6,16}$/);

        const concurrent = await Promise.all([
            request('/api/rewards/daily', { token: inviter.token, method: 'POST' }),
            request('/api/rewards/daily', { token: inviter.token, method: 'POST' })
        ]);
        assert.equal(concurrent.reduce((sum, item) => sum + item.data.awarded, 0), 100, 'Daily reward was awarded more than once');
        assert.equal(concurrent[1].data.coins, 1100);

        const friend = await register('Friend', 'friend@example.com');
        const friendStatus = await request('/api/rewards', { token: friend.token });
        assert.equal(friendStatus.data.referral.canRedeem, true);
        const redemption = await request('/api/rewards/referral', {
            token: friend.token, method: 'POST', body: { code: initial.data.referral.code.toLowerCase() }
        });
        assert.equal(redemption.status, 200);
        assert.equal(redemption.data.inviterAwarded, 500);
        assert.equal(redemption.data.referral.redeemed, true);

        const inviterAfter = await request('/api/rewards', { token: inviter.token });
        assert.equal(inviterAfter.data.coins, 1600);
        assert.equal(inviterAfter.data.referral.count, 1);
        const duplicate = await request('/api/rewards/referral', { token: friend.token, method: 'POST', body: { code: initial.data.referral.code } });
        assert.equal(duplicate.status, 409);
        const self = await request('/api/rewards/referral', { token: inviter.token, method: 'POST', body: { code: initial.data.referral.code } });
        assert.equal(self.status, 400);

        const guest = await request('/api/auth/guest-login', { method: 'POST', body: { username: 'Guest' } });
        const guestReward = await request('/api/rewards', { token: guest.data.token });
        assert.equal(guestReward.status, 403);
        assert.equal((await request('/api/rewards/claim', { token: inviter.token, method: 'POST', body: { reward: 5000 } })).status, 410);
        assert.equal((await request('/api/tasks/claim', { token: inviter.token, method: 'POST', body: { taskId: 'invite_friend', reward: 2000 } })).status, 410);

        const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
        assert.equal(saved.find(user => user.email === 'inviter@example.com').coins, 1600);
        console.log('Daily claim, duplicate protection, referral award, guest restriction and persistence tests passed.');
    } finally {
        server.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

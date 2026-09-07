const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');

const port = 8131;
const root = path.join(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minepool-friends-'));
const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), MINEPOOL_DATA_DIR: dataDir, JWT_SECRET: 'friends-integration-test-secret' },
    stdio: ['ignore', 'ignore', 'inherit']
});
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const headers = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

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
function event(socket, name, timeout = 4000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), timeout);
        socket.once(name, data => { clearTimeout(timer); resolve(data); });
    });
}
async function connect(account) {
    const socket = io(base, { transports: ['websocket'], reconnection: false });
    await event(socket, 'connect');
    const authenticated = event(socket, 'authenticated');
    socket.emit('authenticate', { token: account.token, user: account.user });
    await authenticated;
    return socket;
}

(async () => {
    let aliceSocket;
    let bobSocket;
    try {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
            await wait(250);
            try { ready = (await fetch(base + '/')).ok; } catch (error) { /* Server is starting. */ }
        }
        assert(ready, 'Friends test server did not start');

        const alice = await register('AliceBreak', 'alice@example.com');
        const bob = await register('BobCue', 'bob@example.com');
        const charlie = await register('CharlieRack', 'charlie@example.com');

        const search = await request('/api/friends/search?q=Bob', { headers: headers(alice.token) });
        assert.equal(search.status, 200);
        assert.equal(search.data.players[0].username, 'BobCue');
        assert.equal(search.data.players[0].relation, 'none');

        assert.equal((await request('/api/friends/requests', {
            method: 'POST', headers: headers(alice.token), body: JSON.stringify({ targetUserId: bob.user.id })
        })).status, 200);
        assert.equal((await request('/api/friends/requests', {
            method: 'POST', headers: headers(alice.token), body: JSON.stringify({ targetUserId: bob.user.id })
        })).status, 409);

        let bobFriends = await request('/api/friends', { headers: headers(bob.token) });
        assert.equal(bobFriends.data.incoming[0].id, alice.user.id);
        assert.equal((await request('/api/friends/requests/respond', {
            method: 'POST', headers: headers(bob.token), body: JSON.stringify({ requesterId: alice.user.id, action: 'accept' })
        })).status, 200);

        aliceSocket = await connect(alice);
        bobSocket = await connect(bob);
        const aliceFriends = await request('/api/friends', { headers: headers(alice.token) });
        assert.equal(aliceFriends.data.friends[0].id, bob.user.id);
        assert.equal(aliceFriends.data.friends[0].online, true);

        const nonFriendError = event(aliceSocket, 'friend_match_error');
        aliceSocket.emit('invite_friend_match', { targetUserId: charlie.user.id });
        assert.match((await nonFriendError).error, /not in your friends list/i);

        const sentPromise = event(aliceSocket, 'friend_match_sent');
        const invitationPromise = event(bobSocket, 'friend_match_invite');
        aliceSocket.emit('invite_friend_match', { targetUserId: bob.user.id });
        const [sent, invitation] = await Promise.all([sentPromise, invitationPromise]);
        assert.equal(sent.inviteId, invitation.inviteId);
        assert.equal(invitation.from.username, 'AliceBreak');

        const aliceStart = event(aliceSocket, 'game_start');
        const bobStart = event(bobSocket, 'game_start');
        bobSocket.emit('respond_friend_match', { inviteId: invitation.inviteId, accept: true });
        const [aliceGame, bobGame] = await Promise.all([aliceStart, bobStart]);
        for (const game of [aliceGame, bobGame]) {
            assert.equal(game.friendMatch, true);
            assert.equal(game.wager, 0);
            assert.equal(game.host.username, 'AliceBreak');
            assert.equal(game.guest.username, 'BobCue');
            assert.equal(game.gameState.balls.length, 16);
        }

        const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
        assert(stored.find(user => user.email === 'alice@example.com').friends.map(String).includes(String(bob.user.id)));
        assert(stored.find(user => user.email === 'bob@example.com').friends.map(String).includes(String(alice.user.id)));
        console.log('Friend search, requests, presence, authorization and accepted match invitation tests passed.');
    } finally {
        aliceSocket?.close();
        bobSocket?.close();
        server.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

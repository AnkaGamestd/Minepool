const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 8127;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minepool-auth-'));
const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), MINEPOOL_DATA_DIR: dataDir, JWT_SECRET: 'integration-test-secret' },
    stdio: ['ignore', 'ignore', 'inherit']
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const socketResult = (token, user) => new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    const timer = setTimeout(() => { socket.close(); reject(new Error('Socket authentication timed out')); }, 4000);
    socket.on('connect', () => socket.emit('authenticate', { token, user }));
    socket.on('authenticated', (data) => { clearTimeout(timer); socket.close(); resolve({ type: 'authenticated', data }); });
    socket.on('auth_error', (data) => { clearTimeout(timer); socket.close(); resolve({ type: 'auth_error', data }); });
});

(async () => {
    try {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
            await wait(250);
            try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch (error) { /* Server is still starting. */ }
        }
        if (!ready) throw new Error('Test server did not start');
        const body = { username: 'AuthTester', email: 'auth-test@example.com', password: 'correct-horse-42' };
        const registrationResponse = await fetch(`http://127.0.0.1:${port}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const registration = await registrationResponse.json();
        if (!registration.success || !registration.token) throw new Error('Registration failed');
        const accepted = await socketResult(registration.token, registration.user);
        if (accepted.type !== 'authenticated') throw new Error('Valid WebSocket account was rejected');
        const rejected = await socketResult(null, registration.user);
        if (rejected.type !== 'auth_error') throw new Error('Unsigned WebSocket account was accepted');
        const wrongDeletionResponse = await fetch(`http://127.0.0.1:${port}/api/auth/account`, { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: `Bearer ${registration.token}` }, body: JSON.stringify({ confirmation: 'DELETE', password: 'wrong-password' }) });
        if (wrongDeletionResponse.status !== 401) throw new Error('Account deletion accepted an invalid password');
        const requestResponse = await fetch(`http://127.0.0.1:${port}/api/account-deletion-requests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: body.email, username: body.username }) });
        if (!(await requestResponse.json()).success) throw new Error('External deletion request failed');
        const deletionResponse = await fetch(`http://127.0.0.1:${port}/api/auth/account`, { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: `Bearer ${registration.token}` }, body: JSON.stringify({ confirmation: 'DELETE', password: body.password }) });
        if (!(await deletionResponse.json()).success) throw new Error('Authenticated account deletion failed');
        const loginAfterDeletion = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: body.email, password: body.password }) });
        if (loginAfterDeletion.status !== 401) throw new Error('Deleted account can still sign in');
        console.log('Email auth, WebSocket auth, deletion request and permanent deletion tests passed.');
    } finally {
        server.kill();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });

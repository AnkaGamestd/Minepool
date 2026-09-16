const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'www', 'js', 'mobile-platform.js'), 'utf8');

const storage = new Map([
    ['minepool.auth.token.v1', 'saved-token'],
    ['minepool.mobile.player.v1', JSON.stringify({ id: 'offline-player', displayName: 'Offline Player' })]
]);
const listeners = {};
const document = {
    addEventListener() {},
    dispatchEvent(event) { listeners[event.type]?.forEach((listener) => listener(event)); }
};
const context = {
    console,
    document,
    location: { hostname: 'localhost', origin: 'https://localhost', search: '' },
    navigator: { language: 'en-US' },
    localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key)
    },
    fetch: () => new Promise(() => {}),
    AbortController,
    URL,
    URLSearchParams,
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    crypto: { randomUUID: () => 'generated-id' },
    setTimeout,
    clearTimeout,
    addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
    Capacitor: { Plugins: { GoogleAuth: { autoSignIn: () => new Promise(() => {}) } } }
};
context.globalThis = context;
context.window = context;
vm.runInNewContext(source, context, { filename: 'mobile-platform.js' });

(async () => {
    const startedAt = Date.now();
    const player = await context.MinePoolPlatform.init();
    const elapsed = Date.now() - startedAt;
    assert.equal(player.id, 'offline-player');
    assert.equal(player.displayName, 'Offline Player');
    assert.ok(elapsed < 250, `Startup waited ${elapsed}ms for an unreachable service`);
    console.log(`Mobile startup passed: local profile ready in ${elapsed}ms with an unreachable server.`);
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

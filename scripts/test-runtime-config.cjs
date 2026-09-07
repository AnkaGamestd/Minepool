const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const runtime = fs.readFileSync('www/js/runtime-config.js', 'utf8');
function config(url, native, override = {}) {
    const window = { location: new URL(url), ...override };
    if (native !== undefined) window.Capacitor = { isNativePlatform: () => native };
    vm.runInNewContext(runtime, { window });
    return window;
}
for (const url of ['https://localhost', 'capacitor://localhost']) {
    const result = config(url, true);
    assert.equal(result.MINEPOOL_SERVER_URL, 'https://api.taingames.com');
    assert.equal(result.MINEPOOL_API_URL, 'https://api.taingames.com/api');
}
for (const native of [undefined, false]) {
    for (const url of ['http://localhost:8000', 'http://127.0.0.1:8010'])
        assert.equal(config(url, native).MINEPOOL_SERVER_URL, url);
}
assert.equal(config('https://api.taingames.com').MINEPOOL_SERVER_URL, 'https://api.taingames.com');
assert.equal(config('https://localhost', true, { MINEPOOL_SERVER_URL: 'https://staging.example', MINEPOOL_API_URL: 'https://staging.example/api' }).MINEPOOL_API_URL, 'https://staging.example/api');
const networkSource = fs.readFileSync('www/network.js', 'utf8');
const sockets = [];
const window = config('https://localhost', true);
const Network = vm.runInNewContext(networkSource + '\nNetworkManager', {
    window, console,
    io(url) {
        const listeners = {};
        const socket = { url, connected: false, id: 'test',
            on(name, fn) { listeners[name] = fn; },
            removeAllListeners() { this.removed = true; },
            disconnect() { this.retired = true; },
            listeners };
        sockets.push(socket);
        return socket;
    }
});
(async () => {
    const network = new Network({});
    const first = network.connect();
    sockets[0].listeners.connect_error(new Error('simulated offline'));
    await assert.rejects(first);
    const second = network.connect();
    assert(sockets[0].retired && sockets[0].removed);
    assert.equal(sockets[1].url, 'https://api.taingames.com');
    sockets[1].connected = true; sockets[1].listeners.connect();
    await second;
    await network.connect();
    assert.equal(sockets.length, 2, 'connected socket is reused');
    console.log('PASS: native Android/iOS backend, browser preview, overrides, retry and socket reuse');
})().catch(error => { console.error(error); process.exitCode = 1; });

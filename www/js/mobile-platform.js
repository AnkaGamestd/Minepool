(function () {
    'use strict';

    const STORAGE_KEY = 'minepool.mobile.player.v1';
    const DEFAULT_PLAYER = Object.freeze({
        id: '',
        displayName: '',
        coins: 25680,
        elo: 1450,
        gamesPlayed: 2,
        gamesWon: 0,
        winStreak: 0,
        bestScore: 0,
        selectedCue: 'legendary',
        cues: ['standard', 'premium', 'legendary'],
        dailyProgress: { games: 2, balls: 6, wins: 0 }
    });

    let player = null;
    let audioEnabled = true;

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const isLocalPreview = () => {
        const local = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        return local && new URLSearchParams(location.search).has('playerId');
    };
    const makeId = () => {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    };

    function normalize(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        const previewParams = localPreview ? new URLSearchParams(location.search) : null;
        const previewId = previewParams?.get('playerId');
        const previewName = previewParams?.get('player');
        const id = String(previewId || source.id || DEFAULT_PLAYER.id || makeId());
        const suffix = id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || '0001';
        return {
            ...DEFAULT_PLAYER,
            ...source,
            id,
            displayName: String(previewName || source.displayName || `Player ${suffix}`),
            coins: Math.max(0, Number(source.coins) || DEFAULT_PLAYER.coins),
            elo: Math.max(100, Number(source.elo) || DEFAULT_PLAYER.elo),
            gamesPlayed: Math.max(0, Number(source.gamesPlayed) || DEFAULT_PLAYER.gamesPlayed),
            gamesWon: Math.max(0, Number(source.gamesWon) || 0),
            dailyProgress: { ...DEFAULT_PLAYER.dailyProgress, ...(source.dailyProgress || {}) }
        };
    }

    function read() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
        catch (error) { return null; }
    }

    function persist() {
        if (isLocalPreview()) return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(player)); }
        catch (error) { console.warn('Mobile profile could not be saved.', error); }
    }

    async function init() {
        player = normalize(read());
        persist();
        return clone(player);
    }

    function getIdentity() {
        if (!player) player = normalize(read());
        const previewId = isLocalPreview() ? new URLSearchParams(location.search).get('playerId') : null;
        return Object.freeze({
            id: player.id,
            displayName: player.displayName,
            avatarText: player.displayName.charAt(0).toUpperCase(),
            provider: previewId ? 'local-test' : 'mobile-local'
        });
    }

    async function updatePlayer(patch) {
        if (!player) await init();
        player = normalize({
            ...player,
            ...(patch || {}),
            dailyProgress: { ...player.dailyProgress, ...((patch && patch.dailyProgress) || {}) }
        });
        persist();
        document.dispatchEvent(new CustomEvent('minepool:player-updated', { detail: { player: clone(player) } }));
        return clone(player);
    }

    async function recordGame(won, pocketedBalls) {
        const reward = won ? 75 : 15;
        const previousBest = player.bestScore || 0;
        const nextWins = player.gamesWon + (won ? 1 : 0);
        const updated = await updatePlayer({
            coins: player.coins + reward,
            gamesPlayed: player.gamesPlayed + 1,
            gamesWon: nextWins,
            winStreak: won ? (player.winStreak || 0) + 1 : 0,
            bestScore: Math.max(previousBest, nextWins * 100 + Math.max(0, pocketedBalls || 0) * 10),
            dailyProgress: {
                games: (player.dailyProgress.games || 0) + 1,
                balls: (player.dailyProgress.balls || 0) + Math.max(0, pocketedBalls || 0),
                wins: (player.dailyProgress.wins || 0) + (won ? 1 : 0)
            }
        });
        return { player: updated, reward };
    }

    document.addEventListener('visibilitychange', () => {
        document.dispatchEvent(new CustomEvent(document.hidden ? 'minepool:pause' : 'minepool:resume'));
    });

    window.MinePoolPlatform = Object.freeze({
        init,
        markReady: () => undefined,
        getPlayer: () => clone(player || normalize(read())),
        getIdentity,
        getLocale: () => navigator.language || 'en-US',
        isInPlayables: () => false,
        isAudioEnabled: () => audioEnabled,
        setAudioEnabled: (enabled) => {
            audioEnabled = Boolean(enabled);
            document.dispatchEvent(new CustomEvent('minepool:audio', { detail: { enabled: audioEnabled } }));
        },
        updatePlayer,
        recordGame,
        flush: () => Promise.resolve()
    });
})();

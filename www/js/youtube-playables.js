(function () {
    'use strict';

    const STORAGE_KEY = 'minepool.playable.v3';
    const SAVE_VERSION = 3;
    const DEFAULT_PLAYER = Object.freeze({
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

    let player = normalize(null);
    let locale = 'en-US';
    let initialized = false;
    let initPromise = null;
    let firstFrameSent = false;
    let readySent = false;
    let audioEnabled = true;
    let saveQueue = Promise.resolve();

    const hasSdk = () => typeof window.ytgame !== 'undefined';
    const inPlayables = () => hasSdk() && window.ytgame.IN_PLAYABLES_ENV === true;
    const clone = (value) => JSON.parse(JSON.stringify(value));

    function normalize(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const saved = source.player && typeof source.player === 'object' ? source.player : source;
        return {
            ...DEFAULT_PLAYER,
            coins: Math.max(0, Number(saved.coins) || DEFAULT_PLAYER.coins),
            elo: Math.max(100, Number(saved.elo) || DEFAULT_PLAYER.elo),
            gamesPlayed: Math.max(0, Number(saved.gamesPlayed) || DEFAULT_PLAYER.gamesPlayed),
            gamesWon: Math.max(0, Number(saved.gamesWon) || 0),
            winStreak: Math.max(0, Number(saved.winStreak) || 0),
            bestScore: Math.max(0, Number(saved.bestScore) || 0),
            selectedCue: String(saved.selectedCue || DEFAULT_PLAYER.selectedCue),
            cues: Array.isArray(saved.cues) && saved.cues.length ? saved.cues.map(String) : [...DEFAULT_PLAYER.cues],
            dailyProgress: {
                ...DEFAULT_PLAYER.dailyProgress,
                ...(saved.dailyProgress || {})
            }
        };
    }

    function getIdentity() {
        return Object.freeze({
            displayName: inPlayables() ? 'YouTube Player' : 'Preview Player',
            avatarText: inPlayables() ? 'Y' : 'P',
            provider: inPlayables() ? 'youtube-playables' : 'local-preview'
        });
    }

    function serialize() {
        const payload = JSON.stringify({ version: SAVE_VERSION, player, updatedAt: Date.now() });
        if (String.prototype.isWellFormed && !payload.isWellFormed()) {
            throw new Error('Save data is not well-formed UTF-16.');
        }
        return payload;
    }

    function notifyFirstFrame() {
        if (firstFrameSent || !hasSdk()) return;
        try {
            window.ytgame.game.firstFrameReady();
            firstFrameSent = true;
        } catch (error) {
            console.warn('Playables first frame notification failed', error);
        }
    }

    async function loadPlayer() {
        if (inPlayables()) {
            const saved = await window.ytgame.game.loadData();
            player = normalize(saved ? JSON.parse(saved) : null);
            return;
        }
        player = normalize(null);
    }

    function queueSave() {
        const payload = serialize();
        saveQueue = saveQueue.catch(() => undefined).then(async () => {
            if (inPlayables()) await window.ytgame.game.saveData(payload);
        });
        return saveQueue;
    }

    async function initialize() {
        notifyFirstFrame();
        try {
            await loadPlayer();
        } catch (error) {
            player = normalize(null);
            window.ytgame?.health?.logWarning?.();
        }

        if (inPlayables()) {
            try { locale = await window.ytgame.system.getLanguage(); }
            catch (error) { locale = 'en-US'; }

            audioEnabled = window.ytgame.system.isAudioEnabled();
            window.ytgame.system.onAudioEnabledChange((enabled) => {
                audioEnabled = enabled;
                document.dispatchEvent(new CustomEvent('minepool:audio', { detail: { enabled } }));
            });
            window.ytgame.system.onPause(() => {
                document.dispatchEvent(new CustomEvent('minepool:pause'));
                queueSave();
            });
            window.ytgame.system.onResume(() => {
                document.dispatchEvent(new CustomEvent('minepool:resume'));
            });
        }

        initialized = true;
        document.dispatchEvent(new CustomEvent('minepool:platform-ready', {
            detail: { player: clone(player), identity: getIdentity(), locale, inPlayables: inPlayables() }
        }));
        return clone(player);
    }

    function init() {
        if (initialized) return Promise.resolve(clone(player));
        if (!initPromise) initPromise = initialize();
        return initPromise;
    }

    function markReady() {
        notifyFirstFrame();
        if (readySent || !hasSdk()) return;
        try {
            window.ytgame.game.gameReady();
            readySent = true;
        } catch (error) {
            console.warn('Playables ready notification failed', error);
        }
    }

    async function updatePlayer(patch) {
        if (!initialized) await init();
        player = normalize({
            ...player,
            ...(patch || {}),
            dailyProgress: { ...player.dailyProgress, ...((patch && patch.dailyProgress) || {}) }
        });
        await queueSave();
        document.dispatchEvent(new CustomEvent('minepool:player-updated', { detail: { player: clone(player) } }));
        return clone(player);
    }

    async function recordGame(won, pocketedBalls) {
        const reward = won ? 75 : 15;
        const previousBest = player.bestScore || 0;
        const nextWins = player.gamesWon + (won ? 1 : 0);
        const nextScore = Math.max(previousBest, nextWins * 100 + Math.max(0, pocketedBalls || 0) * 10);
        const updated = await updatePlayer({
            coins: player.coins + reward,
            gamesPlayed: player.gamesPlayed + 1,
            gamesWon: nextWins,
            winStreak: won ? (player.winStreak || 0) + 1 : 0,
            bestScore: nextScore,
            dailyProgress: {
                games: (player.dailyProgress.games || 0) + 1,
                balls: (player.dailyProgress.balls || 0) + Math.max(0, pocketedBalls || 0),
                wins: (player.dailyProgress.wins || 0) + (won ? 1 : 0)
            }
        });
        if (inPlayables() && nextScore > previousBest) {
            try { await window.ytgame.engagement.sendScore({ value: nextScore }); }
            catch (error) { console.warn('Score submission failed', error); }
        }
        return { player: updated, reward };
    }

    window.MinePoolPlatform = Object.freeze({
        init,
        markReady,
        getPlayer: () => clone(player),
        getIdentity,
        getLocale: () => locale,
        isInPlayables: inPlayables,
        isAudioEnabled: () => audioEnabled,
        updatePlayer,
        recordGame,
        flush: () => saveQueue
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', notifyFirstFrame, { once: true });
    else notifyFirstFrame();
})();

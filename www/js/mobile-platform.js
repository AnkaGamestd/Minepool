(function () {
    'use strict';

    const STORAGE_KEY = 'minepool.mobile.player.v1';
    const AUTH_TOKEN_KEY = 'minepool.auth.token.v1';
    const AUTO_GOOGLE_DISABLED_KEY = 'minepool.auth.google-auto-disabled.v1';
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
    let authToken = '';

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
            coins: Math.max(0, Number.isFinite(Number(source.coins)) ? Number(source.coins) : DEFAULT_PLAYER.coins),
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

    function getNativeGoogle() {
        return globalThis.Capacitor?.Plugins?.GoogleAuth || null;
    }

    function apiUrl(path) {
        return `${String(globalThis.MINEPOOL_API_URL || '').replace(/\/$/, '')}${path}`;
    }

    function resolveAvatarUrl(value) {
        if (!value) return null;
        try {
            const url = new URL(String(value), String(globalThis.MINEPOOL_SERVER_URL || location.origin));
            return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
        } catch (error) { return null; }
    }

    async function request(path, options = {}) {
        const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const response = await fetch(apiUrl(path), {
            method: options.method || 'GET',
            headers: {
                ...(!multipart && options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
            },
            body: options.body ? (multipart ? options.body : JSON.stringify(options.body)) : undefined
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'The server could not complete this request.');
        return data;
    }

    function applyAccount(data) {
        if (!data?.user) throw new Error('The server returned an invalid account.');
        authToken = String(data.token || authToken || '');
        if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        const user = data.user;
        player = normalize({
            ...player,
            id: `account-${user.id}`,
            accountId: user.id,
            email: user.email,
            displayName: user.username,
            provider: user.provider || 'email',
            coins: user.coins,
            elo: user.elo,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            cues: user.cues || player.cues,
            avatarUrl: resolveAvatarUrl(user.profilePicture)
        });
        persist();
        document.dispatchEvent(new CustomEvent('minepool:player-updated', { detail: { player: clone(player) } }));
        document.dispatchEvent(new CustomEvent('minepool:account-changed', { detail: { player: clone(player) } }));
        return clone(player);
    }

    async function init() {
        player = normalize(read());
        authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
        if (authToken) {
            try { applyAccount(await request('/auth/me')); }
            catch (error) { authToken = ''; localStorage.removeItem(AUTH_TOKEN_KEY); }
        }
        persist();
        if (!authToken && getNativeGoogle() && localStorage.getItem(AUTO_GOOGLE_DISABLED_KEY) !== '1') {
            try {
                const google = await getNativeGoogle().autoSignIn();
                if (google?.authenticated && google.idToken) applyAccount(await request('/auth/google', { method: 'POST', body: { idToken: google.idToken } }));
            } catch (error) {
                console.info('Automatic Google sign-in is not available.', error?.message || error);
            }
        }
        return clone(player);
    }

    function getIdentity() {
        if (!player) player = normalize(read());
        const previewId = isLocalPreview() ? new URLSearchParams(location.search).get('playerId') : null;
        return Object.freeze({
            id: player.id,
            displayName: player.displayName,
            avatarText: player.displayName.charAt(0).toUpperCase(),
            provider: previewId ? 'local-test' : (player.provider || 'mobile-local'),
            email: player.email || null,
            authenticated: Boolean(authToken)
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

    async function register(credentials) {
        return applyAccount(await request('/auth/register', { method: 'POST', body: credentials }));
    }

    async function login(credentials) {
        return applyAccount(await request('/auth/login', { method: 'POST', body: credentials }));
    }

    async function signInWithGoogle() {
        const nativeGoogle = getNativeGoogle();
        if (!nativeGoogle) throw new Error('Google sign-in is available in the Android app.');
        const google = await nativeGoogle.signIn();
        if (!google?.idToken) throw new Error('Google did not return an identity token.');
        localStorage.removeItem(AUTO_GOOGLE_DISABLED_KEY);
        return applyAccount(await request('/auth/google', { method: 'POST', body: { idToken: google.idToken } }));
    }

    async function updateProfile({ username }) {
        if (!authToken) throw new Error('Sign in before editing your profile.');
        return applyAccount(await request('/profile/change-username', { method: 'POST', body: { username } }));
    }

    async function uploadAvatar(file) {
        if (!authToken) throw new Error('Sign in before changing your profile photo.');
        const body = new FormData();
        body.append('avatar', file, file.name || 'profile.jpg');
        return applyAccount(await request('/profile/avatar', { method: 'POST', body }));
    }

    async function removeAvatar() {
        if (!authToken) throw new Error('Sign in before changing your profile photo.');
        return applyAccount(await request('/profile/avatar', { method: 'DELETE' }));
    }

    async function getFriends() {
        if (!authToken) throw new Error('Sign in to use friends.');
        return request('/friends');
    }

    async function searchFriends(query) {
        if (!authToken) throw new Error('Sign in to find players.');
        return request(`/friends/search?q=${encodeURIComponent(query)}`);
    }

    async function sendFriendRequest(targetUserId) {
        return request('/friends/requests', { method: 'POST', body: { targetUserId } });
    }

    async function respondFriendRequest(requesterId, action) {
        return request('/friends/requests/respond', { method: 'POST', body: { requesterId, action } });
    }

    async function removeFriend(friendId) {
        return request(`/friends/${encodeURIComponent(friendId)}`, { method: 'DELETE' });
    }

    async function logout() {
        try { if (authToken) await request('/auth/logout', { method: 'POST' }); } catch (error) { /* Local logout must still work offline. */ }
        return clearAccountState();
    }

    async function clearAccountState() {
        try { await getNativeGoogle()?.signOut(); } catch (error) { console.info('Google credential state was not cleared.', error); }
        authToken = '';
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.setItem(AUTO_GOOGLE_DISABLED_KEY, '1');
        player = normalize({ ...player, id: makeId(), accountId: null, email: null, provider: 'mobile-local', avatarUrl: null });
        persist();
        document.dispatchEvent(new CustomEvent('minepool:player-updated', { detail: { player: clone(player) } }));
        document.dispatchEvent(new CustomEvent('minepool:account-changed', { detail: { player: clone(player) } }));
        return clone(player);
    }

    async function deleteAccount({ password = '', confirmation = '' } = {}) {
        if (!authToken) throw new Error('Sign in before deleting an account.');
        const identity = getIdentity();
        let idToken = '';
        if (identity.provider.includes('google')) {
            const nativeGoogle = getNativeGoogle();
            if (!nativeGoogle) throw new Error('Open the Android app to verify your Google account.');
            const google = await nativeGoogle.signIn();
            idToken = google?.idToken || '';
        }
        await request('/auth/account', {
            method: 'DELETE',
            body: { password, confirmation, idToken }
        });
        return clearAccountState();
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
        register,
        login,
        signInWithGoogle,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        getFriends,
        searchFriends,
        sendFriendRequest,
        respondFriendRequest,
        removeFriend,
        logout,
        deleteAccount,
        isAuthenticated: () => Boolean(authToken),
        getAuthToken: () => authToken || null,
        rewards: async (action = '', body) => {
            const data = await request('/rewards' + action, { method: action ? 'POST' : 'GET', body });
            await updatePlayer({ coins: data.coins });
            return data;
        },
        flush: () => Promise.resolve()
    });
})();

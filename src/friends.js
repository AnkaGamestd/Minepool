'use strict';

module.exports = function installFriends(app, { users, authenticateToken, saveUsers, multiplayer }) {
    const isMember = user => ['email', 'google', 'email+google'].includes(user?.provider);
    const byId = id => [...users.values()].find(user => String(user.id) === String(id));
    const ids = value => [...new Set((Array.isArray(value) ? value : []).map(String))];
    const has = (list, id) => ids(list).includes(String(id));
    const add = (list, id) => [...new Set([...(Array.isArray(list) ? list : []), id])];
    const remove = (list, id) => (Array.isArray(list) ? list : []).filter(value => String(value) !== String(id));
    const relation = (viewer, candidate) => {
        if (has(viewer.friends, candidate.id)) return 'friend';
        if (has(viewer.friendRequestsIncoming, candidate.id)) return 'incoming';
        if (has(viewer.friendRequestsOutgoing, candidate.id)) return 'outgoing';
        return 'none';
    };
    const publicPlayer = (user, viewer) => ({
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture || null,
        elo: Number(user.elo) || 1200,
        online: multiplayer.isAccountOnline(user.id),
        relation: viewer ? relation(viewer, user) : undefined
    });
    const account = (req, res, next) => {
        const user = users.get(req.user.email);
        if (!user || String(user.id) !== String(req.user.id)) return res.status(401).json({ success: false, error: 'Please sign in again.' });
        if (!isMember(user)) return res.status(403).json({ success: false, error: 'Sign in with a player account to use friends.' });
        req.friendUser = user;
        next();
    };
    const persist = (records, mutate) => {
        const snapshots = records.map(user => JSON.parse(JSON.stringify(user)));
        mutate();
        if (saveUsers()) return true;
        records.forEach((user, index) => {
            Object.keys(user).forEach(key => delete user[key]);
            Object.assign(user, snapshots[index]);
        });
        return false;
    };
    const notify = (...records) => multiplayer.notifyFriendsChanged(records.map(user => user.id));

    app.get('/api/friends', authenticateToken, account, (req, res) => {
        const user = req.friendUser;
        const map = list => ids(list).map(byId).filter(isMember).map(friend => publicPlayer(friend, user));
        res.json({
            success: true,
            friends: map(user.friends),
            incoming: map(user.friendRequestsIncoming),
            outgoing: map(user.friendRequestsOutgoing)
        });
    });

    app.get('/api/friends/search', authenticateToken, account, (req, res) => {
        const query = String(req.query.q || '').trim().toLowerCase();
        if (query.length < 3 || query.length > 20) return res.status(400).json({ success: false, error: 'Enter at least 3 characters.' });
        const matches = [...users.values()]
            .filter(candidate => isMember(candidate) && candidate.id !== req.friendUser.id && String(candidate.username).toLowerCase().includes(query))
            .sort((a, b) => Number(String(a.username).toLowerCase() !== query) - Number(String(b.username).toLowerCase() !== query))
            .slice(0, 10)
            .map(candidate => publicPlayer(candidate, req.friendUser));
        res.json({ success: true, players: matches });
    });

    app.post('/api/friends/requests', authenticateToken, account, (req, res) => {
        const user = req.friendUser;
        const target = byId(req.body?.targetUserId);
        if (!isMember(target)) return res.status(404).json({ success: false, error: 'Player not found.' });
        if (String(target.id) === String(user.id)) return res.status(400).json({ success: false, error: 'You cannot add yourself.' });
        if (has(user.friends, target.id)) return res.status(409).json({ success: false, error: 'This player is already your friend.' });
        if (has(user.friendRequestsOutgoing, target.id)) return res.status(409).json({ success: false, error: 'Friend request already sent.' });
        if (has(user.friendRequestsIncoming, target.id)) return res.status(409).json({ success: false, error: 'This player has already sent you a request.' });
        if (!persist([user, target], () => {
            user.friendRequestsOutgoing = add(user.friendRequestsOutgoing, target.id);
            target.friendRequestsIncoming = add(target.friendRequestsIncoming, user.id);
        })) return res.status(503).json({ success: false, error: 'Friend request could not be saved.' });
        notify(user, target);
        res.json({ success: true, message: 'Friend request sent.' });
    });

    app.post('/api/friends/requests/respond', authenticateToken, account, (req, res) => {
        const user = req.friendUser;
        const requester = byId(req.body?.requesterId);
        const action = String(req.body?.action || '');
        if (!isMember(requester) || !has(user.friendRequestsIncoming, requester.id)) return res.status(404).json({ success: false, error: 'Friend request not found.' });
        if (!['accept', 'decline'].includes(action)) return res.status(400).json({ success: false, error: 'Choose accept or decline.' });
        if (!persist([user, requester], () => {
            user.friendRequestsIncoming = remove(user.friendRequestsIncoming, requester.id);
            requester.friendRequestsOutgoing = remove(requester.friendRequestsOutgoing, user.id);
            if (action === 'accept') {
                user.friends = add(user.friends, requester.id);
                requester.friends = add(requester.friends, user.id);
            }
        })) return res.status(503).json({ success: false, error: 'Friend request could not be updated.' });
        notify(user, requester);
        res.json({ success: true, accepted: action === 'accept' });
    });

    app.delete('/api/friends/:id', authenticateToken, account, (req, res) => {
        const user = req.friendUser;
        const friend = byId(req.params.id);
        if (!isMember(friend) || !has(user.friends, friend.id)) return res.status(404).json({ success: false, error: 'Friend not found.' });
        if (!persist([user, friend], () => {
            user.friends = remove(user.friends, friend.id);
            friend.friends = remove(friend.friends, user.id);
        })) return res.status(503).json({ success: false, error: 'Friend could not be removed.' });
        notify(user, friend);
        res.json({ success: true });
    });

    return {
        removeAccount(userId) {
            const changed = [];
            for (const user of users.values()) {
                const before = JSON.stringify([user.friends, user.friendRequestsIncoming, user.friendRequestsOutgoing]);
                user.friends = remove(user.friends, userId);
                user.friendRequestsIncoming = remove(user.friendRequestsIncoming, userId);
                user.friendRequestsOutgoing = remove(user.friendRequestsOutgoing, userId);
                if (before !== JSON.stringify([user.friends, user.friendRequestsIncoming, user.friendRequestsOutgoing])) changed.push(user);
            }
            if (changed.length) notify(...changed);
        }
    };
};

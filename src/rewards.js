'use strict';
const { randomBytes } = require('node:crypto');
const DAY = 86400000;

module.exports = function installRewards(app, { users, authenticateToken, saveUsers, now = Date.now }) {
    const day = time => new Date(time).toISOString().slice(0, 10);
    const isMember = user => ['email', 'google', 'email+google'].includes(user.provider);
    const codeFor = user => {
        if (!user.referralCode) {
            const legacy = String(user.inviteCode || '').trim().toUpperCase();
            if (/^[A-Z0-9]{6,16}$/.test(legacy) && ![...users.values()].some(other => other !== user && other.referralCode === legacy)) {
                user.referralCode = legacy;
                return user.referralCode;
            }
            let code;
            do { code = randomBytes(5).toString('hex').toUpperCase(); }
            while ([...users.values()].some(other => other.referralCode === code));
            user.referralCode = code;
        }
        return user.referralCode;
    };
    const referralCount = user => Math.max((user.referrals || []).length, Number(user.invitedFriends) || 0);
    const eligible = user => !user.referredBy && !user.usedReferral && now() - Date.parse(user.createdAt) >= 0 && now() - Date.parse(user.createdAt) <= 7 * DAY;
    const status = user => ({
        success: true, coins: user.coins, serverTime: now(),
        daily: { amount: 100, claimed: user.rewards?.lastDailyDay === day(now()),
            nextReset: Date.parse(day(now())) + DAY, streak: user.rewards?.streak || 0 },
        referral: { amount: 500, code: user.referralCode, count: referralCount(user),
            redeemed: !!(user.referredBy || user.usedReferral), canRedeem: eligible(user) }
    });
    // All mutations and persistence run synchronously in the existing single
    // server process, so simultaneous requests cannot both award the same claim.
    const transaction = (records, mutate) => {
        const snapshots = records.map(user => JSON.parse(JSON.stringify(user)));
        try {
            mutate();
            if (saveUsers() === false) throw new Error('Rewards could not be saved. Please retry.');
        } catch (error) {
            records.forEach((user, i) => { Object.keys(user).forEach(key => delete user[key]); Object.assign(user, snapshots[i]); });
            throw error;
        }
    };
    const account = (req, res, next) => {
        const user = users.get(req.user.email);
        if (!user || user.id !== req.user.id) return res.status(401).json({ error: 'Please sign in again.' });
        if (!isMember(user)) return res.status(403).json({ error: 'Create an account or sign in with Google to earn rewards.' });
        req.rewardUser = user; next();
    };
    const route = fn => (req, res) => {
        try { fn(req, res); } catch (error) { res.status(503).json({ error: 'Rewards could not be saved. Please retry.' }); }
    };
    app.get('/api/rewards', authenticateToken, account, route((req, res) => {
        const user = req.rewardUser;
        if (!user.referralCode) transaction([user], () => codeFor(user));
        res.json(status(user));
    }));
    app.post('/api/rewards/daily', authenticateToken, account, route((req, res) => {
        const user = req.rewardUser;
        if (user.rewards?.lastDailyDay === day(now())) return res.json({ ...status(user), awarded: 0 });
        transaction([user], () => {
            const previous = user.rewards || {};
            user.rewards = { ...previous, lastDailyDay: day(now()),
                streak: previous.lastDailyDay === day(now() - DAY) ? (previous.streak || 0) + 1 : 1 };
            user.coins = Math.max(0, Number(user.coins) || 0) + 100;
            codeFor(user);
        });
        res.json({ ...status(user), awarded: 100 });
    }));
    app.post('/api/rewards/referral', authenticateToken, account, route((req, res) => {
        const user = req.rewardUser;
        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{6,16}$/.test(code)) return res.status(400).json({ error: 'Enter a valid invite code.' });
        const inviter = [...users.values()].find(other => other.referralCode === code);
        if (!inviter || !isMember(inviter)) return res.status(404).json({ error: 'Invite code not found.' });
        if (inviter.id === user.id) return res.status(400).json({ error: 'You cannot use your own invite code.' });
        if (!eligible(user)) return res.status(409).json({ error: user.referredBy ? 'An invite code has already been used on this account.' : 'Invite codes can be used within 7 days of creating an account.' });
        transaction([user, inviter], () => {
            user.referredBy = inviter.id;
            user.referralRedeemedAt = new Date(now()).toISOString();
            inviter.coins = Math.max(0, Number(inviter.coins) || 0) + 500;
            inviter.referrals = [...(inviter.referrals || []), { id: user.id, username: user.username, joinedAt: user.referralRedeemedAt }];
            inviter.invitedFriends = (Number(inviter.invitedFriends) || 0) + 1;
            codeFor(user);
        });
        res.json({ ...status(user), awarded: 0, inviterAwarded: 500 });
    }));
};

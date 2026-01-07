/**
 * User Management Routes for Admin Panel
 */

const express = require('express');
const router = express.Router();
const { logActivity, requireRole } = require('../middleware/auth');

// In-memory user database (replace with real database)
let users = [
    { id: 1, username: 'Player1', email: 'player1@test.com', status: 'active', elo: 1250, gamesPlayed: 45, wins: 28, losses: 17, coins: 5000, createdAt: new Date('2024-01-15'), lastLogin: new Date() },
    { id: 2, username: 'PoolKing', email: 'poolking@test.com', status: 'active', elo: 1450, gamesPlayed: 120, wins: 85, losses: 35, coins: 15000, createdAt: new Date('2024-01-10'), lastLogin: new Date() },
    { id: 3, username: 'Striker', email: 'striker@test.com', status: 'away', elo: 1100, gamesPlayed: 30, wins: 12, losses: 18, coins: 2500, createdAt: new Date('2024-02-01'), lastLogin: new Date(Date.now() - 86400000) },
    { id: 4, username: 'Champion99', email: 'champ@test.com', status: 'active', elo: 1800, gamesPlayed: 250, wins: 180, losses: 70, coins: 50000, createdAt: new Date('2023-12-01'), lastLogin: new Date() },
    { id: 5, username: 'Rookie2024', email: 'rookie@test.com', status: 'active', elo: 950, gamesPlayed: 10, wins: 3, losses: 7, coins: 1000, createdAt: new Date('2024-02-15'), lastLogin: new Date() },
    { id: 6, username: 'BannedUser', email: 'banned@test.com', status: 'banned', elo: 1000, gamesPlayed: 50, wins: 20, losses: 30, coins: 0, createdAt: new Date('2024-01-20'), lastLogin: new Date('2024-02-01'), banReason: 'Cheating' }
];

let bans = [
    { id: 1, oderId: 6, reason: 'Cheating', bannedBy: 1, bannedAt: new Date('2024-02-01'), expiresAt: null, type: 'permanent' }
];

/**
 * GET /api/admin/users
 * Get all users with pagination and filters
 */
router.get('/', (req, res) => {
    try {
        const { page = 1, limit = 20, search, status, sortBy = 'createdAt', order = 'desc' } = req.query;

        let filtered = [...users];

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(u =>
                u.username.toLowerCase().includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower)
            );
        }

        // Status filter
        if (status && status !== 'all') {
            filtered = filtered.filter(u => u.status === status);
        }

        // Sort
        filtered.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            if (order === 'asc') return aVal > bVal ? 1 : -1;
            return aVal < bVal ? 1 : -1;
        });

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginated = filtered.slice(startIndex, endIndex);

        res.json({
            success: true,
            users: paginated,
            total: filtered.length,
            page: parseInt(page),
            totalPages: Math.ceil(filtered.length / limit)
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/admin/users/stats
 * Get user statistics
 */
router.get('/stats', (req, res) => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const bannedUsers = users.filter(u => u.status === 'banned').length;
    const newUsersToday = users.filter(u => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(u.createdAt) >= today;
    }).length;

    const totalGames = users.reduce((sum, u) => sum + u.gamesPlayed, 0);
    const avgElo = Math.round(users.reduce((sum, u) => sum + u.elo, 0) / users.length);

    res.json({
        success: true,
        stats: {
            totalUsers,
            activeUsers,
            bannedUsers,
            newUsersToday,
            totalGames,
            avgElo
        }
    });
});

/**
 * GET /api/admin/users/:id
 * Get single user details
 */
router.get('/:id', (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Get user's ban history
    const userBans = bans.filter(b => b.userId === user.id);

    res.json({
        success: true,
        user: {
            ...user,
            winRate: user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0,
            bans: userBans
        }
    });
});

/**
 * PUT /api/admin/users/:id
 * Update user
 */
router.put('/:id', requireRole(['admin', 'super_admin']), (req, res) => {
    const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { username, email, coins, elo } = req.body;

    if (username) users[userIndex].username = username;
    if (email) users[userIndex].email = email;
    if (coins !== undefined) users[userIndex].coins = coins;
    if (elo !== undefined) users[userIndex].elo = elo;

    logActivity(req.user.id, 'update_user', 'user', req.params.id, req.body);

    res.json({
        success: true,
        user: users[userIndex]
    });
});

/**
 * POST /api/admin/users/:id/ban
 * Ban a user
 */
router.post('/:id/ban', requireRole(['moderator', 'admin', 'super_admin']), (req, res) => {
    const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { reason, duration, type = 'temporary' } = req.body;

    if (!reason) {
        return res.status(400).json({ error: 'Ban reason required' });
    }

    users[userIndex].status = 'banned';
    users[userIndex].banReason = reason;

    const ban = {
        id: bans.length + 1,
        oderId: users[userIndex].id,
        reason,
        bannedBy: req.user.id,
        bannedAt: new Date(),
        expiresAt: type === 'temporary' && duration ? new Date(Date.now() + duration * 86400000) : null,
        type
    };

    bans.push(ban);
    logActivity(req.user.id, 'ban_user', 'user', req.params.id, { reason, duration, type });

    res.json({
        success: true,
        message: `User ${users[userIndex].username} has been banned`,
        ban
    });
});

/**
 * POST /api/admin/users/:id/unban
 * Unban a user
 */
router.post('/:id/unban', requireRole(['moderator', 'admin', 'super_admin']), (req, res) => {
    const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    users[userIndex].status = 'active';
    delete users[userIndex].banReason;

    logActivity(req.user.id, 'unban_user', 'user', req.params.id, {});

    res.json({
        success: true,
        message: `User ${users[userIndex].username} has been unbanned`
    });
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete('/:id', requireRole(['super_admin']), (req, res) => {
    const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = users.splice(userIndex, 1)[0];
    logActivity(req.user.id, 'delete_user', 'user', req.params.id, { username: deletedUser.username });

    res.json({
        success: true,
        message: `User ${deletedUser.username} has been deleted`
    });
});

module.exports = router;

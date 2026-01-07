/**
 * Game Management Routes for Admin Panel
 */

const express = require('express');
const router = express.Router();
const { logActivity, requireRole } = require('../middleware/auth');

// In-memory games database
let liveGames = [
    { id: 'ABC123', player1: { id: 1, username: 'Player1', score: 3 }, player2: { id: 2, username: 'PoolKing', score: 2 }, status: 'in_progress', currentTurn: 1, startedAt: new Date(Date.now() - 300000), bet: 100 },
    { id: 'XYZ789', player1: { id: 3, username: 'Striker', score: 0 }, player2: { id: 4, username: 'Champion99', score: 1 }, status: 'in_progress', currentTurn: 2, startedAt: new Date(Date.now() - 120000), bet: 500 },
    { id: 'DEF456', player1: { id: 5, username: 'Rookie2024', score: 1 }, player2: { id: 1, username: 'Player1', score: 4 }, status: 'in_progress', currentTurn: 1, startedAt: new Date(Date.now() - 600000), bet: 50 }
];

let gameHistory = [
    { id: 'HIST001', player1: { id: 1, username: 'Player1' }, player2: { id: 2, username: 'PoolKing' }, winner: 1, score: '7-5', duration: 420, bet: 100, playedAt: new Date(Date.now() - 3600000) },
    { id: 'HIST002', player1: { id: 3, username: 'Striker' }, player2: { id: 4, username: 'Champion99' }, winner: 2, score: '7-3', duration: 380, bet: 200, playedAt: new Date(Date.now() - 7200000) },
    { id: 'HIST003', player1: { id: 5, username: 'Rookie2024' }, player2: { id: 1, username: 'Player1' }, winner: 2, score: '7-2', duration: 300, bet: 50, playedAt: new Date(Date.now() - 10800000) },
    { id: 'HIST004', player1: { id: 2, username: 'PoolKing' }, player2: { id: 4, username: 'Champion99' }, winner: 2, score: '7-6', duration: 650, bet: 1000, playedAt: new Date(Date.now() - 14400000) },
    { id: 'HIST005', player1: { id: 1, username: 'Player1' }, player2: { id: 3, username: 'Striker' }, winner: 1, score: '7-4', duration: 400, bet: 100, playedAt: new Date(Date.now() - 86400000) }
];

/**
 * GET /api/admin/games/live
 * Get all live games
 */
router.get('/live', (req, res) => {
    res.json({
        success: true,
        games: liveGames,
        count: liveGames.length
    });
});

/**
 * GET /api/admin/games/stats
 * Get game statistics
 */
router.get('/stats', (req, res) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now - 7 * 86400000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const gamesToday = gameHistory.filter(g => new Date(g.playedAt) >= today).length;
    const gamesThisWeek = gameHistory.filter(g => new Date(g.playedAt) >= thisWeek).length;
    const gamesThisMonth = gameHistory.filter(g => new Date(g.playedAt) >= thisMonth).length;

    const avgDuration = Math.round(gameHistory.reduce((sum, g) => sum + g.duration, 0) / gameHistory.length);
    const totalBets = gameHistory.reduce((sum, g) => sum + g.bet, 0);
    const avgBet = Math.round(totalBets / gameHistory.length);

    res.json({
        success: true,
        stats: {
            liveGames: liveGames.length,
            gamesToday,
            gamesThisWeek,
            gamesThisMonth,
            totalGames: gameHistory.length,
            avgDuration,
            totalBets,
            avgBet
        }
    });
});

/**
 * GET /api/admin/games/history
 * Get game history with pagination
 */
router.get('/history', (req, res) => {
    const { page = 1, limit = 20, playerId, search } = req.query;

    let filtered = [...gameHistory];

    // Filter by player
    if (playerId) {
        const pid = parseInt(playerId);
        filtered = filtered.filter(g =>
            g.player1.id === pid || g.player2.id === pid
        );
    }

    // Search by room ID or player name
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(g =>
            g.id.toLowerCase().includes(searchLower) ||
            g.player1.username.toLowerCase().includes(searchLower) ||
            g.player2.username.toLowerCase().includes(searchLower)
        );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginated = filtered.slice(startIndex, endIndex);

    res.json({
        success: true,
        games: paginated,
        total: filtered.length,
        page: parseInt(page),
        totalPages: Math.ceil(filtered.length / limit)
    });
});

/**
 * GET /api/admin/games/:id
 * Get single game details
 */
router.get('/:id', (req, res) => {
    const gameId = req.params.id;

    // Check live games first
    let game = liveGames.find(g => g.id === gameId);
    if (game) {
        return res.json({
            success: true,
            game: { ...game, isLive: true }
        });
    }

    // Check history
    game = gameHistory.find(g => g.id === gameId);
    if (game) {
        return res.json({
            success: true,
            game: { ...game, isLive: false }
        });
    }

    res.status(404).json({ error: 'Game not found' });
});

/**
 * POST /api/admin/games/:id/end
 * Force end a live game
 */
router.post('/:id/end', requireRole(['admin', 'super_admin']), (req, res) => {
    const gameIndex = liveGames.findIndex(g => g.id === req.params.id);

    if (gameIndex === -1) {
        return res.status(404).json({ error: 'Live game not found' });
    }

    const game = liveGames[gameIndex];
    const { winner, reason } = req.body;

    // Move to history
    gameHistory.unshift({
        ...game,
        winner: winner || null,
        score: `${game.player1.score}-${game.player2.score}`,
        duration: Math.round((new Date() - new Date(game.startedAt)) / 1000),
        playedAt: new Date(),
        endedByAdmin: true,
        endReason: reason || 'Ended by admin'
    });

    // Remove from live games
    liveGames.splice(gameIndex, 1);

    logActivity(req.user.id, 'end_game', 'game', req.params.id, { winner, reason });

    res.json({
        success: true,
        message: `Game ${req.params.id} has been ended`
    });
});

/**
 * GET /api/admin/games/:id/replay
 * Get game replay data (placeholder)
 */
router.get('/:id/replay', (req, res) => {
    // In production, this would fetch actual replay data
    res.json({
        success: true,
        replay: {
            gameId: req.params.id,
            frames: [],
            message: 'Replay data not available in demo mode'
        }
    });
});

module.exports = router;

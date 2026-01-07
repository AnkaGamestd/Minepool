/**
 * Leaderboard & Achievements API
 * Handles player rankings, match results, and achievement tracking
 */

const express = require('express');
const router = express.Router();

// Simple in-memory store for demo purposes
// In production, replace with a real database
let users = [];

// Helper to ensure a user exists
function getUser(username) {
    let user = users.find(u => u.username === username);
    if (!user) {
        user = {
            username,
            coins: 0,
            wins: 0,
            losses: 0,
            achievements: [],
            gamesPlayed: 0,
            winStreak: 0,
            bestStreak: 0
        };
        users.push(user);
    }
    return user;
}

// Get full leaderboard (sorted by wins descending)
router.get('/', (req, res) => {
    const sorted = [...users].sort((a, b) => b.wins - a.wins);
    res.json({ success: true, leaderboard: sorted });
});

// Get user rank
router.get('/rank/:username', (req, res) => {
    const { username } = req.params;
    const sorted = [...users].sort((a, b) => b.wins - a.wins);
    const rank = sorted.findIndex(u => u.username === username) + 1;
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, rank, user });
});

// Record a match result
// Expected body: { winner: 'username', loser: 'username' }
router.post('/record-match', (req, res) => {
    const { winner, loser } = req.body;
    if (!winner || !loser) {
        return res.json({ success: false, error: 'Missing winner/loser' });
    }

    const wUser = getUser(winner);
    const lUser = getUser(loser);

    // Update stats
    wUser.wins += 1;
    wUser.gamesPlayed += 1;
    wUser.winStreak += 1;
    wUser.bestStreak = Math.max(wUser.bestStreak, wUser.winStreak);

    lUser.losses += 1;
    lUser.gamesPlayed += 1;
    lUser.winStreak = 0;

    // Reward coins
    wUser.coins += 100;
    lUser.coins += 20; // participation reward

    // Check for achievements
    const newAchievements = [];

    // First Win
    if (wUser.wins === 1 && !wUser.achievements.includes('First Win')) {
        wUser.achievements.push('First Win');
        newAchievements.push('First Win');
    }

    // Win Streak achievements
    if (wUser.winStreak === 3 && !wUser.achievements.includes('Hot Streak')) {
        wUser.achievements.push('Hot Streak');
        newAchievements.push('Hot Streak');
    }

    if (wUser.winStreak === 5 && !wUser.achievements.includes('On Fire')) {
        wUser.achievements.push('On Fire');
        newAchievements.push('On Fire');
    }

    // Coin milestones
    if (wUser.coins >= 1000 && !wUser.achievements.includes('Coin Collector')) {
        wUser.achievements.push('Coin Collector');
        newAchievements.push('Coin Collector');
    }

    if (wUser.coins >= 5000 && !wUser.achievements.includes('Wealthy')) {
        wUser.achievements.push('Wealthy');
        newAchievements.push('Wealthy');
    }

    // Win milestones
    if (wUser.wins === 10 && !wUser.achievements.includes('Veteran')) {
        wUser.achievements.push('Veteran');
        newAchievements.push('Veteran');
    }

    if (wUser.wins === 50 && !wUser.achievements.includes('Champion')) {
        wUser.achievements.push('Champion');
        newAchievements.push('Champion');
    }

    res.json({
        success: true,
        winner: wUser,
        loser: lUser,
        newAchievements
    });
});

// Add achievement to a user manually
// Expected body: { username: 'name', achievement: 'First Win' }
router.post('/achievement', (req, res) => {
    const { username, achievement } = req.body;
    if (!username || !achievement) {
        return res.json({ success: false, error: 'Missing data' });
    }

    const user = getUser(username);
    if (!user.achievements.includes(achievement)) {
        user.achievements.push(achievement);
    }

    res.json({ success: true, user });
});

// Get user achievements
router.get('/achievements/:username', (req, res) => {
    const { username } = req.params;
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, achievements: user.achievements });
});

module.exports = router;

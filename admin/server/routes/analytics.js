/**
 * Analytics Routes for Admin Panel
 */

const express = require('express');
const router = express.Router();

// Generate mock data for charts
function generateTimeSeriesData(days, min, max, trend = 0) {
    const data = [];
    const now = new Date();
    let value = Math.floor(Math.random() * (max - min) + min);

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * 86400000);
        value = Math.max(min, Math.min(max, value + Math.floor(Math.random() * 20 - 10 + trend)));
        data.push({
            date: date.toISOString().split('T')[0],
            value
        });
    }
    return data;
}

/**
 * GET /api/admin/analytics/overview
 * Get analytics overview
 */
router.get('/overview', (req, res) => {
    const now = new Date();
    const yesterday = new Date(now - 86400000);

    res.json({
        success: true,
        overview: {
            // Today's metrics
            today: {
                newUsers: 47,
                activeUsers: 847,
                gamesPlayed: 1243,
                revenue: 450.00
            },
            // Yesterday's comparison
            yesterday: {
                newUsers: 42,
                activeUsers: 812,
                gamesPlayed: 1156,
                revenue: 380.00
            },
            // Growth percentages
            growth: {
                newUsers: 11.9,
                activeUsers: 4.3,
                gamesPlayed: 7.5,
                revenue: 18.4
            },
            // All-time totals
            totals: {
                users: 12543,
                games: 458920,
                revenue: 24500.00
            }
        }
    });
});

/**
 * GET /api/admin/analytics/users
 * Get user analytics
 */
router.get('/users', (req, res) => {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    res.json({
        success: true,
        data: {
            newUsers: generateTimeSeriesData(days, 30, 80, 1),
            activeUsers: generateTimeSeriesData(days, 500, 1200, 2),
            retention: {
                day1: 65,
                day7: 42,
                day30: 28
            },
            demographics: {
                countries: [
                    { name: 'United States', users: 3245, percent: 25.9 },
                    { name: 'United Kingdom', users: 1823, percent: 14.5 },
                    { name: 'Germany', users: 1456, percent: 11.6 },
                    { name: 'Turkey', users: 1234, percent: 9.8 },
                    { name: 'Brazil', users: 987, percent: 7.9 },
                    { name: 'Other', users: 3798, percent: 30.3 }
                ]
            }
        }
    });
});

/**
 * GET /api/admin/analytics/games
 * Get game analytics
 */
router.get('/games', (req, res) => {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    res.json({
        success: true,
        data: {
            gamesPerDay: generateTimeSeriesData(days, 800, 1500, 3),
            avgDuration: 385, // seconds
            completionRate: 94.5,
            peakHours: [
                { hour: 0, games: 320 },
                { hour: 1, games: 180 },
                { hour: 2, games: 120 },
                { hour: 3, games: 80 },
                { hour: 4, games: 60 },
                { hour: 5, games: 70 },
                { hour: 6, games: 150 },
                { hour: 7, games: 280 },
                { hour: 8, games: 420 },
                { hour: 9, games: 580 },
                { hour: 10, games: 720 },
                { hour: 11, games: 850 },
                { hour: 12, games: 920 },
                { hour: 13, games: 880 },
                { hour: 14, games: 950 },
                { hour: 15, games: 1020 },
                { hour: 16, games: 1150 },
                { hour: 17, games: 1280 },
                { hour: 18, games: 1450 },
                { hour: 19, games: 1520 },
                { hour: 20, games: 1480 },
                { hour: 21, games: 1320 },
                { hour: 22, games: 980 },
                { hour: 23, games: 620 }
            ]
        }
    });
});

/**
 * GET /api/admin/analytics/revenue
 * Get revenue analytics
 */
router.get('/revenue', (req, res) => {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    res.json({
        success: true,
        data: {
            dailyRevenue: generateTimeSeriesData(days, 300, 600, 2),
            totalRevenue: 14580.00,
            arpu: 1.16, // Average Revenue Per User
            topSpenders: [
                { username: 'Champion99', spent: 850.00, purchases: 45 },
                { username: 'PoolKing', spent: 520.00, purchases: 32 },
                { username: 'ProPlayer1', spent: 380.00, purchases: 28 },
                { username: 'MasterCue', spent: 290.00, purchases: 21 },
                { username: 'LegendPool', spent: 245.00, purchases: 18 }
            ],
            revenueBySource: [
                { source: 'Coin Purchases', amount: 8500.00, percent: 58.3 },
                { source: 'Cue Shop', amount: 3200.00, percent: 21.9 },
                { source: 'Premium Pass', amount: 2100.00, percent: 14.4 },
                { source: 'Other', amount: 780.00, percent: 5.4 }
            ]
        }
    });
});

/**
 * GET /api/admin/analytics/performance
 * Get system performance metrics
 */
router.get('/performance', (req, res) => {
    res.json({
        success: true,
        data: {
            serverHealth: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: 23.5,
            responseTime: {
                avg: 45,
                p95: 120,
                p99: 250
            },
            websocket: {
                connections: 847,
                messagesPerSecond: 1250
            },
            errors: {
                today: 12,
                rate: 0.02
            }
        }
    });
});

module.exports = router;

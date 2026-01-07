/**
 * 8-Ball Pool Admin Panel Server
 * Main entry point for the admin API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const leaderboardRoutes = require('./routes/leaderboard');
const usersRoutes = require('./routes/users');
const gamesRoutes = require('./routes/games');
const analyticsRoutes = require('./routes/analytics');
const moderationRoutes = require('./routes/moderation');
const settingsRoutes = require('./routes/settings');

// Import middleware
const { authenticateToken, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.ADMIN_PORT || 4000;

// Middleware
app.use(cors({
    origin: ['http://localhost:8000', 'http://localhost:3000', 'http://localhost:4000'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/users', authenticateToken, usersRoutes);
app.use('/api/admin/games', authenticateToken, gamesRoutes);
app.use('/api/admin/analytics', authenticateToken, analyticsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin/moderation', authenticateToken, moderationRoutes);
app.use('/api/admin/settings', authenticateToken, requireRole(['admin', 'super_admin']), settingsRoutes);

// Health check
app.get('/api/admin/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Admin API Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

app.listen(PORT, () => {
    console.log(`🎱 Admin Panel Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
});

module.exports = app;

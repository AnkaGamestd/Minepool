/**
 * Moderation Routes for Admin Panel
 */

const express = require('express');
const router = express.Router();
const { logActivity, requireRole } = require('../middleware/auth');

// In-memory reports database
let reports = [
    { id: 1, reporterId: 1, reporterName: 'Player1', reportedId: 6, reportedName: 'BannedUser', reason: 'cheating', description: 'Using speed hack to pocket balls instantly', status: 'resolved', assignedTo: 1, createdAt: new Date(Date.now() - 86400000), resolvedAt: new Date(Date.now() - 43200000) },
    { id: 2, reporterId: 2, reporterName: 'PoolKing', reportedId: 3, reportedName: 'Striker', reason: 'harassment', description: 'Sending offensive messages in chat', status: 'open', assignedTo: null, createdAt: new Date(Date.now() - 3600000), resolvedAt: null },
    { id: 3, reporterId: 4, reporterName: 'Champion99', reportedId: 5, reportedName: 'Rookie2024', reason: 'inappropriate_name', description: 'Offensive username', status: 'reviewing', assignedTo: 2, createdAt: new Date(Date.now() - 7200000), resolvedAt: null },
    { id: 4, reporterId: 1, reporterName: 'Player1', reportedId: 2, reportedName: 'PoolKing', reason: 'spam', description: 'Spamming chat with advertisements', status: 'open', assignedTo: null, createdAt: new Date(Date.now() - 1800000), resolvedAt: null },
    { id: 5, reporterId: 3, reporterName: 'Striker', reportedId: 4, reportedName: 'Champion99', reason: 'bug_abuse', description: 'Exploiting pocket glitch to win unfairly', status: 'open', assignedTo: null, createdAt: new Date(Date.now() - 900000), resolvedAt: null }
];

// Chat logs (mock)
let chatLogs = [
    { id: 1, oderId: 1, username: 'Player1', message: 'Good game!', roomId: 'ABC123', timestamp: new Date(Date.now() - 60000) },
    { id: 2, oderId: 2, username: 'PoolKing', message: 'Thanks, you played well', roomId: 'ABC123', timestamp: new Date(Date.now() - 55000) },
    { id: 3, oderId: 3, username: 'Striker', message: 'Nice shot!', roomId: 'XYZ789', timestamp: new Date(Date.now() - 30000) },
    { id: 4, oderId: 4, username: 'Champion99', message: 'Lucky...', roomId: 'XYZ789', timestamp: new Date(Date.now() - 25000) }
];

/**
 * GET /api/admin/moderation/reports
 * Get all reports
 */
router.get('/reports', (req, res) => {
    const { page = 1, limit = 20, status, reason } = req.query;

    let filtered = [...reports];

    if (status && status !== 'all') {
        filtered = filtered.filter(r => r.status === status);
    }

    if (reason && reason !== 'all') {
        filtered = filtered.filter(r => r.reason === reason);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginated = filtered.slice(startIndex, endIndex);

    res.json({
        success: true,
        reports: paginated,
        total: filtered.length,
        pending: reports.filter(r => r.status === 'open').length,
        page: parseInt(page),
        totalPages: Math.ceil(filtered.length / limit)
    });
});

/**
 * GET /api/admin/moderation/reports/stats
 * Get report statistics
 */
router.get('/reports/stats', (req, res) => {
    const openReports = reports.filter(r => r.status === 'open').length;
    const reviewingReports = reports.filter(r => r.status === 'reviewing').length;
    const resolvedReports = reports.filter(r => r.status === 'resolved').length;

    const byReason = {};
    reports.forEach(r => {
        byReason[r.reason] = (byReason[r.reason] || 0) + 1;
    });

    res.json({
        success: true,
        stats: {
            total: reports.length,
            open: openReports,
            reviewing: reviewingReports,
            resolved: resolvedReports,
            byReason
        }
    });
});

/**
 * GET /api/admin/moderation/reports/:id
 * Get single report details
 */
router.get('/reports/:id', (req, res) => {
    const report = reports.find(r => r.id === parseInt(req.params.id));

    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
        success: true,
        report
    });
});

/**
 * PUT /api/admin/moderation/reports/:id
 * Update report (assign, change status, resolve)
 */
router.put('/reports/:id', (req, res) => {
    const reportIndex = reports.findIndex(r => r.id === parseInt(req.params.id));

    if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
    }

    const { status, assignedTo, resolution } = req.body;

    if (status) reports[reportIndex].status = status;
    if (assignedTo !== undefined) reports[reportIndex].assignedTo = assignedTo;
    if (resolution) reports[reportIndex].resolution = resolution;
    if (status === 'resolved') reports[reportIndex].resolvedAt = new Date();

    logActivity(req.user.id, 'update_report', 'report', req.params.id, req.body);

    res.json({
        success: true,
        report: reports[reportIndex]
    });
});

/**
 * POST /api/admin/moderation/reports/:id/action
 * Take action on a report
 */
router.post('/reports/:id/action', (req, res) => {
    const reportIndex = reports.findIndex(r => r.id === parseInt(req.params.id));

    if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
    }

    const { action, details } = req.body;

    // Record the action
    reports[reportIndex].action = action;
    reports[reportIndex].actionDetails = details;
    reports[reportIndex].status = 'resolved';
    reports[reportIndex].resolvedAt = new Date();
    reports[reportIndex].resolvedBy = req.user.id;

    logActivity(req.user.id, `report_action_${action}`, 'report', req.params.id, { action, details });

    res.json({
        success: true,
        message: `Action '${action}' taken on report #${req.params.id}`,
        report: reports[reportIndex]
    });
});

/**
 * GET /api/admin/moderation/chat-logs
 * Get chat logs
 */
router.get('/chat-logs', (req, res) => {
    const { roomId, userId, search, limit = 50 } = req.query;

    let filtered = [...chatLogs];

    if (roomId) {
        filtered = filtered.filter(c => c.roomId === roomId);
    }

    if (userId) {
        filtered = filtered.filter(c => c.userId === parseInt(userId));
    }

    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(c =>
            c.message.toLowerCase().includes(searchLower) ||
            c.username.toLowerCase().includes(searchLower)
        );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
        success: true,
        logs: filtered.slice(0, parseInt(limit)),
        total: filtered.length
    });
});

/**
 * GET /api/admin/moderation/bans
 * Get all active bans
 */
router.get('/bans', (req, res) => {
    // Mock ban data
    const bans = [
        { id: 1, oderId: 6, username: 'BannedUser', reason: 'Cheating', type: 'permanent', bannedBy: 'admin', bannedAt: new Date(Date.now() - 86400000), expiresAt: null },
        { id: 2, oderId: 10, username: 'ToxicPlayer', reason: 'Harassment', type: 'temporary', bannedBy: 'moderator', bannedAt: new Date(Date.now() - 43200000), expiresAt: new Date(Date.now() + 604800000) }
    ];

    res.json({
        success: true,
        bans,
        total: bans.length
    });
});

module.exports = router;

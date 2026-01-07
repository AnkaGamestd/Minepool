/**
 * Settings Routes for Admin Panel
 */

const express = require('express');
const router = express.Router();
const { logActivity } = require('../middleware/auth');

// Game settings (in-memory) - Synced with physics.js
let gameSettings = {
    physics: {
        // Ball & Table
        ballRadius: 12,
        pocketRadius: 22,
        cushionWidth: 25,

        // Speed & Power
        maxCueSpeed: 750,

        // Friction coefficients
        gravity: 980,
        muRoll: 0.018,        // Rolling friction
        muSlide: 0.10,        // Sliding friction
        muSpin: 0.12,         // Spin friction

        // Elasticity / Restitution
        eBall: 0.98,          // Ball-to-ball collision
        eCushion: 0.80        // Ball-to-cushion collision
    },
    gameplay: {
        shotTimeLimit: 30,
        breakTimeLimit: 60,
        maxPower: 100,
        enableSpin: true,
        callPocket: true
    },
    matchmaking: {
        eloRange: 200,
        maxWaitTime: 60,
        skillBasedMatching: true
    },
    economy: {
        startingCoins: 1000,
        minBet: 50,
        maxBet: 10000,
        winReward: 100
    }
};

// Feature flags
let featureFlags = {
    maintenance: false,
    newUserRegistration: true,
    chatEnabled: true,
    tournamentMode: false,
    premiumFeatures: true,
    betaFeatures: false
};

// Server settings
let serverSettings = {
    maxConnections: 10000,
    rateLimitPerMinute: 60,
    sessionTimeout: 3600,
    maintenanceMessage: 'Server is under maintenance. Please try again later.'
};

/**
 * GET /api/admin/settings
 * Get all settings
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        settings: {
            game: gameSettings,
            features: featureFlags,
            server: serverSettings
        }
    });
});

/**
 * GET /api/admin/settings/game
 * Get game settings
 */
router.get('/game', (req, res) => {
    res.json({
        success: true,
        settings: gameSettings
    });
});

/**
 * PUT /api/admin/settings/game
 * Update game settings
 */
router.put('/game', (req, res) => {
    const { physics, gameplay, matchmaking, economy } = req.body;

    if (physics) {
        gameSettings.physics = { ...gameSettings.physics, ...physics };
    }
    if (gameplay) {
        gameSettings.gameplay = { ...gameSettings.gameplay, ...gameplay };
    }
    if (matchmaking) {
        gameSettings.matchmaking = { ...gameSettings.matchmaking, ...matchmaking };
    }
    if (economy) {
        gameSettings.economy = { ...gameSettings.economy, ...economy };
    }

    logActivity(req.user.id, 'update_game_settings', 'settings', 'game', req.body);

    res.json({
        success: true,
        settings: gameSettings,
        message: 'Game settings updated successfully'
    });
});

/**
 * GET /api/admin/settings/features
 * Get feature flags
 */
router.get('/features', (req, res) => {
    res.json({
        success: true,
        features: featureFlags
    });
});

/**
 * PUT /api/admin/settings/features
 * Update feature flags
 */
router.put('/features', (req, res) => {
    featureFlags = { ...featureFlags, ...req.body };

    logActivity(req.user.id, 'update_feature_flags', 'settings', 'features', req.body);

    res.json({
        success: true,
        features: featureFlags,
        message: 'Feature flags updated successfully'
    });
});

/**
 * PUT /api/admin/settings/features/:flag
 * Toggle a single feature flag
 */
router.put('/features/:flag', (req, res) => {
    const { flag } = req.params;
    const { value } = req.body;

    if (featureFlags[flag] === undefined) {
        return res.status(404).json({ error: 'Feature flag not found' });
    }

    featureFlags[flag] = value !== undefined ? value : !featureFlags[flag];

    logActivity(req.user.id, 'toggle_feature', 'settings', flag, { value: featureFlags[flag] });

    res.json({
        success: true,
        flag,
        value: featureFlags[flag],
        message: `Feature '${flag}' ${featureFlags[flag] ? 'enabled' : 'disabled'}`
    });
});

/**
 * POST /api/admin/settings/maintenance
 * Toggle maintenance mode
 */
router.post('/maintenance', (req, res) => {
    const { enabled, message } = req.body;

    featureFlags.maintenance = enabled !== undefined ? enabled : !featureFlags.maintenance;

    if (message) {
        serverSettings.maintenanceMessage = message;
    }

    logActivity(req.user.id, 'toggle_maintenance', 'settings', 'maintenance', { enabled: featureFlags.maintenance, message });

    res.json({
        success: true,
        maintenance: featureFlags.maintenance,
        message: featureFlags.maintenance ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
    });
});

/**
 * GET /api/admin/settings/server
 * Get server settings
 */
router.get('/server', (req, res) => {
    res.json({
        success: true,
        settings: serverSettings
    });
});

/**
 * PUT /api/admin/settings/server
 * Update server settings
 */
router.put('/server', (req, res) => {
    serverSettings = { ...serverSettings, ...req.body };

    logActivity(req.user.id, 'update_server_settings', 'settings', 'server', req.body);

    res.json({
        success: true,
        settings: serverSettings,
        message: 'Server settings updated successfully'
    });
});

/**
 * GET /api/admin/settings/activity
 * Get admin activity logs
 */
router.get('/activity', (req, res) => {
    const { getActivityLogs } = require('../middleware/auth');
    const logs = getActivityLogs(100);

    res.json({
        success: true,
        logs
    });
});

module.exports = router;

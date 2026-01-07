/**
 * Authentication Routes for Admin Panel
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const {
    JWT_SECRET,
    findAdminByUsername,
    logActivity,
    authenticateToken
} = require('../middleware/auth');

// Token expiry
const TOKEN_EXPIRY = '24h';
const REFRESH_EXPIRY = '7d';

/**
 * POST /api/admin/auth/login
 * Admin login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find admin user
        const admin = findAdminByUsername(username);

        // For demo: allow "admin" / "admin123" login
        if (!admin) {
            // Demo mode - check hardcoded credentials
            if (username === 'admin' && password === 'admin123') {
                const token = jwt.sign(
                    { id: 1, username: 'admin', role: 'super_admin' },
                    JWT_SECRET,
                    { expiresIn: TOKEN_EXPIRY }
                );

                const refreshToken = jwt.sign(
                    { id: 1, type: 'refresh' },
                    JWT_SECRET,
                    { expiresIn: REFRESH_EXPIRY }
                );

                logActivity(1, 'login', 'auth', null, { ip: req.ip });

                return res.json({
                    success: true,
                    token,
                    refreshToken,
                    user: {
                        id: 1,
                        username: 'admin',
                        email: 'admin@8ballpool.com',
                        role: 'super_admin'
                    }
                });
            }

            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password (in production, use proper bcrypt compare)
        // const validPassword = await bcrypt.compare(password, admin.passwordHash);
        const validPassword = password === 'admin123'; // Demo mode

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate tokens
        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: admin.role },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { id: admin.id, type: 'refresh' },
            JWT_SECRET,
            { expiresIn: REFRESH_EXPIRY }
        );

        logActivity(admin.id, 'login', 'auth', null, { ip: req.ip });

        res.json({
            success: true,
            token,
            refreshToken,
            user: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/admin/auth/logout
 * Admin logout
 */
router.post('/logout', authenticateToken, (req, res) => {
    logActivity(req.user.id, 'logout', 'auth', null, {});
    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/admin/auth/refresh
 * Refresh access token
 */
router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        if (decoded.type !== 'refresh') {
            return res.status(400).json({ error: 'Invalid refresh token' });
        }

        const newToken = jwt.sign(
            { id: decoded.id, username: decoded.username, role: decoded.role },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({ success: true, token: newToken });

    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
});

/**
 * GET /api/admin/auth/me
 * Get current admin info
 */
router.get('/me', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        }
    });
});

module.exports = router;

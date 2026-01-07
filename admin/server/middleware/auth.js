/**
 * Authentication Middleware for Admin Panel
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'admin-secret-key-change-in-production';

// In-memory admin users (replace with database in production)
const adminUsers = [
    {
        id: 1,
        username: 'admin',
        email: 'admin@8ballpool.com',
        // Password: admin123 (hashed with bcrypt)
        passwordHash: '$2a$10$rQEY9JZ4kL5X6v8b3h1OxO8GqX5Q8Z5Y6Z5Y6Z5Y6Z5Y6Z5Y6Z5Y6',
        role: 'super_admin',
        createdAt: new Date()
    },
    {
        id: 2,
        username: 'moderator',
        email: 'mod@8ballpool.com',
        passwordHash: '$2a$10$rQEY9JZ4kL5X6v8b3h1OxO8GqX5Q8Z5Y6Z5Y6Z5Y6Z5Y6Z5Y6Z5Y6',
        role: 'moderator',
        createdAt: new Date()
    }
];

// Activity log (in-memory, replace with database)
const activityLog = [];

/**
 * Authenticate JWT token
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

/**
 * Require specific role(s)
 */
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        // Super admin has access to everything
        if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({ error: 'Insufficient permissions' });
    };
}

/**
 * Log admin activity
 */
function logActivity(adminId, action, resourceType, resourceId, details) {
    activityLog.push({
        id: activityLog.length + 1,
        adminId,
        action,
        resourceType,
        resourceId,
        details,
        timestamp: new Date()
    });

    // Keep only last 1000 entries
    if (activityLog.length > 1000) {
        activityLog.shift();
    }
}

/**
 * Get activity logs
 */
function getActivityLogs(limit = 50) {
    return activityLog.slice(-limit).reverse();
}

/**
 * Get admin users
 */
function getAdminUsers() {
    return adminUsers;
}

/**
 * Find admin by username
 */
function findAdminByUsername(username) {
    return adminUsers.find(u => u.username === username);
}

/**
 * Find admin by ID
 */
function findAdminById(id) {
    return adminUsers.find(u => u.id === id);
}

module.exports = {
    authenticateToken,
    requireRole,
    logActivity,
    getActivityLogs,
    getAdminUsers,
    findAdminByUsername,
    findAdminById,
    JWT_SECRET,
    adminUsers
};

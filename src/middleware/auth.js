const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');

/**
 * Replace your existing src/middleware/auth.js with this file.
 * Added: suspended user check.
 */

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, address, avatar_url, role,
              is_suspended, suspend_reason
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    const user = rows[0];

    // Block suspended users from all protected routes
    if (user.is_suspended) {
      return res.status(403).json({
        message: 'Your account has been suspended.',
        reason:  user.suspend_reason || 'Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Optional auth — attaches user if token present, does NOT block
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_suspended FROM users WHERE id=$1',
      [decoded.id]
    );
    if (rows.length && !rows[0].is_suspended) req.user = rows[0];
  } catch { /* ignore */ }
  next();
};

// Admin only
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

module.exports = { protect, optionalAuth, adminOnly };

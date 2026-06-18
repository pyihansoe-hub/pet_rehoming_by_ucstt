const crypto = require('crypto');
const pool = require('../db/pool');

// POST /api/auth/refresh-token
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    // Find the refresh token in database
    const { rows } = await pool.query(
      `SELECT rt.user_id, u.email, u.name, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const { user_id, email, name, role } = rows[0];

    // Generate new access token
    const jwt = require('jsonwebtoken');
    const newAccessToken = jwt.sign(
      { id: user_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Optionally generate a new refresh token and revoke the old one
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await pool.query('BEGIN');
    
    // Revoke old token
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
    
    // Insert new refresh token
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user_id, newRefreshToken, expiresAt]
    );
    
    await pool.query('COMMIT');

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user_id, email, name, role }
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/logout - revoke refresh token
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { refreshToken, logout };

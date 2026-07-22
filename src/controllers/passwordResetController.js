const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const speakeasy = require('speakeasy');

// POST /api/auth/reset/check
const checkReset2FA = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, two_factor_enabled FROM users WHERE email=$1', [email.toLowerCase().trim()]
    );

    // Always return ok: true to prevent email enumeration
    if (!rows.length) {
      return res.json({ ok: true });
    }

    const user = rows[0];

    if (user.two_factor_enabled) {
      // Send requires2FA at the top level so frontend can read it easily
      return res.json({ ok: true, requires2FA: true });
    } else {
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error('ERROR in checkReset2FA:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/auth/reset/verify-2fa
const verifyReset2FA = async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) return res.status(400).json({ message: 'Email and code are required.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, two_factor_secret FROM users WHERE email=$1 AND two_factor_enabled=TRUE', 
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(400).json({ message: 'Account not found or 2FA not enabled.' });
    }

    const user = rows[0];

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid or expired 2FA code.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('ERROR in verifyReset2FA:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/auth/reset/complete
const completeReset2FA = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, two_factor_secret, two_factor_enabled FROM users WHERE email=$1', 
      [email.toLowerCase().trim()]
    );

    if (!rows.length || !rows[0].two_factor_enabled) {
      return res.status(400).json({ message: 'Account not found or 2FA not enabled.' });
    }

    const user = rows[0];

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid or expired 2FA code.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashedPassword, user.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('ERROR in completeReset2FA:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { checkReset2FA, verifyReset2FA, completeReset2FA };
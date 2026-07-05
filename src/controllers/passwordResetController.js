const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { send } = require('../services/email');

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM users WHERE email=$1', [email.toLowerCase().trim()]
    );

    // always return success — don't reveal if email exists
    if (!rows.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user  = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // invalidate any existing unused tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1 AND used=FALSE',
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expires]
    );

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await send(email, 'Reset your password — Pet Rehoming', `
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below — it expires in 1 hour.</p>
      
      <p>If you didn't request this, ignore this email.</p>
    `);

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  try {
    const { rows } = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token=$1 AND used=FALSE AND expires_at > NOW()`,
      [token]
    );

    if (!rows.length) return res.status(400).json({ message: 'Invalid or expired reset token.' });

    const resetToken = rows[0];
    const hashed = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashed, resetToken.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used=TRUE WHERE id=$1', [resetToken.id]);

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/auth/verify-reset-token?token=xxx
const verifyResetToken = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM password_reset_tokens
       WHERE token=$1 AND used=FALSE AND expires_at > NOW()`,
      [token]
    );
    res.json({ valid: rows.length > 0 });
  } catch (err) { res.status(500).json({ valid: false }); }
};

module.exports = { forgotPassword, resetPassword, verifyResetToken };

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Generate secure reset token
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email, and password are required.' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rows.length) return res.status(409).json({ message: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, phone, address)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, phone, address, role, created_at`,
      [name, email.toLowerCase().trim(), hashed, phone || null, address || null]
    );

    res.status(201).json({ message: 'Registration successful.', token: signToken(rows[0].id), user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, password, phone, address, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email or password.' });

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful.', token: signToken(user.id), user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!rows.length) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }
    const user = rows[0];

    // Invalidate any existing tokens
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id]);

    // Create new token
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Send email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const { send } = require('../services/email');
    await send(
      user.email,
      'Password Reset Request',
      `<p>Hi ${user.name},</p>
       <p>You requested to reset your password. Click the link below:</p>
       <p><a href="${resetLink}">${resetLink}</a></p>
       <p>This link expires in 1 hour.</p>
       <p>If you didn't request this, please ignore this email.</p>`
    );

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT prt.user_id, u.email 
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const { user_id, email } = rows[0];
    const hashed = await bcrypt.hash(newPassword, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update password
      await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user_id]);
      
      // Mark token as used
      await client.query('UPDATE password_reset_tokens SET used = TRUE WHERE token = $1', [token]);
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { register, login, forgotPassword, resetPassword };

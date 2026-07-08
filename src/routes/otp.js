const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/otp/send - Generate and send OTP
router.post('/send', async (req, res) => {
  try {
    const { email, purpose } = req.body; // purpose: 'payment', 'verify_email', etc.
    
    if (!email) {
      return res.status(400).json({ ok: false, message: 'Email is required' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await pool.query(`
      INSERT INTO otps (email, otp, purpose, expires_at, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (email, purpose) 
      DO UPDATE SET otp = $2, expires_at = $4, created_at = NOW(), verified = false
    `, [email, otp, purpose || 'payment', expiresAt]);

    // Send OTP via email
    const subject = purpose === 'payment' 
      ? 'Payment Verification Code - Pet Rehoming' 
      : 'Verification Code - Pet Rehoming';

    const html = `
      <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;">
        <div style="background:#4f46e5;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Pet Rehoming</h2>
        </div>
        <div style="background:#f9fafb;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
          <p style="color:#374151;font-size:16px;">Your verification code is:</p>
          <div style="background:#fff;border:2px dashed #4f46e5;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
            <span style="font-size:36px;font-weight:bold;color:#4f46e5;letter-spacing:8px;">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:14px;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color:#6b7280;font-size:14px;">If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: subject,
      html: html,
    });

    // Don't return OTP in response for security
    res.json({ ok: true, message: 'OTP sent to your email' });
    
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ ok: false, message: 'Failed to send OTP' });
  }
});

// POST /api/otp/verify - Verify OTP
router.post('/verify', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ ok: false, message: 'Email and OTP are required' });
    }

    const result = await pool.query(`
      SELECT * FROM otps 
      WHERE email = $1 AND purpose = $2 AND verified = false
      ORDER BY created_at DESC LIMIT 1
    `, [email, purpose || 'payment']);

    if (result.rows.length === 0) {
      return res.status(400).json({ ok: false, message: 'No OTP found. Please request a new one.' });
    }

    const otpRecord = result.rows[0];

    // Check if expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({ ok: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ ok: false, message: 'Invalid OTP. Please try again.' });
    }

    // Mark as verified
    await pool.query(`
      UPDATE otps SET verified = true WHERE id = $1
    `, [otpRecord.id]);

    res.json({ ok: true, message: 'OTP verified successfully' });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ ok: false, message: 'Failed to verify OTP' });
  }
});

module.exports = router;
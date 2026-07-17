const nodemailer = require('nodemailer');

// If SMTP_HOST is missing, we just log to console (perfect for quick localhost testing)
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = isSmtpConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null;

async function sendVerificationEmail(toEmail, token) {
  // Change this to your actual frontend URL when deployed
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/pages/verify-email.html?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Pet Rehoming" <no-reply@petrehoming.test>',
    to: toEmail,
    subject: 'Verify your email — Pet Rehoming',
    html: `
      <h2>Welcome to Pet Rehoming!</h2>
      <p>Please verify your email by clicking the button below:</p>
      <p>
        <a href="${verifyUrl}" 
           style="display:inline-block;background:#2a9d8f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Verify Email
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link will expire in 24 hours.</p>`
  };

  if (!transporter) {
    // LOCALHOST FALLBACK: Just log it so you can click it during dev
    console.log('\n========================================');
    console.log('📧 EMAIL DEV MODE (Not actually sent)');
    console.log('To:', toEmail);
    console.log('Verify URL:', verifyUrl);
    console.log('========================================\n');
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${toEmail}`);
  } catch (err) {
    console.error('❌ Error sending email:', err);
    throw new Error('Failed to send verification email');
  }
}

module.exports = { sendVerificationEmail };
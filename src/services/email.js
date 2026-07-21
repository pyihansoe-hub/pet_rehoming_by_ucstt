const { Resend } = require('resend');

// Initialize Resend with your API key
const resend = new Resend(process.env.SMTP_PASS || 're_PASTE_YOUR_RESEND_KEY_HERE');

async function send(toEmail, subject, html) {
  try {
    // Note: The "from" email MUST be the email you verified in Resend
    const fromEmail = process.env.SMTP_FROM || 'Pet Rehoming <bbo77352@gmail.com>';
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      throw new Error('Failed to send email');
    }

    console.log(`✅ Email sent successfully to ${toEmail}! ID: ${data.id}`);
  } catch (err) {
    console.error('❌ Error sending email:', err);
    throw new Error('Failed to send email');
  }
}

async function sendVerificationEmail(toEmail, token) {
  const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/pages/verify-email.html?token=${token}`;
  
  const html = `
    <h2>Welcome to Pet Rehoming!</h2>
    <p>Please verify your email by clicking the button below:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;background:#2a9d8f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify Email</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link will expire in 24 hours.</p>`;
    
  await send(toEmail, 'Verify your email — Pet Rehoming', html);
}

module.exports = { send, sendVerificationEmail };
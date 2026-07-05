require('dotenv').config();

console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***HIDDEN***' : '❌ EMPTY');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: process.env.EMAIL_FROM,
  to: process.env.SMTP_USER,
  subject: 'Test - Pet Rehoming',
  html: '<h1>It works!</h1>'
})
.then(() => console.log('\n✅ EMAIL SENT SUCCESSFULLY'))
.catch(err => console.log('\n❌ ERROR:', err.message));
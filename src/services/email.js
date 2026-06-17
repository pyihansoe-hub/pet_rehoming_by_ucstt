const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   +process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const send = (to, subject, html) =>
  transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });

// ── Templates ────────────────────────────────────────────────

const emails = {
  adoptionRequestReceived: (ownerName, petName, requesterName) => ({
    subject: `New adoption request for ${petName}`,
    html: `<p>Hi ${ownerName},</p>
           <p><strong>${requesterName}</strong> has requested to adopt your pet <strong>${petName}</strong>.</p>
           <p>Log in to review and approve or reject the request.</p>`,
  }),

  adoptionApproved: (requesterName, petName, isFree) => ({
    subject: `Your adoption request for ${petName} was approved!`,
    html: `<p>Hi ${requesterName},</p>
           <p>Great news! Your request to adopt <strong>${petName}</strong> has been approved.</p>
           ${isFree
             ? '<p>The adoption is free — contact the owner to arrange pickup.</p>'
             : '<p>Please complete your payment to finalize the adoption.</p>'
           }`,
  }),

  adoptionRejected: (requesterName, petName) => ({
    subject: `Update on your adoption request for ${petName}`,
    html: `<p>Hi ${requesterName},</p>
           <p>Unfortunately your request to adopt <strong>${petName}</strong> was not approved this time.</p>
           <p>Browse other available pets on our platform.</p>`,
  }),

  paymentConfirmed: (userName, petName, amount, currency) => ({
    subject: `Payment confirmed — ${petName} adoption`,
    html: `<p>Hi ${userName},</p>
           <p>Your payment of <strong>${amount} ${currency}</strong> for adopting <strong>${petName}</strong> has been confirmed.</p>
           <p>The owner will be in touch to arrange the handover.</p>`,
  }),
};

module.exports = { send, emails };
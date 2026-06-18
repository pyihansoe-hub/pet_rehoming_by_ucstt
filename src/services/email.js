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

  followUpReminder: (adopterName, petName, period) => ({
    subject: `Follow-up: How's ${petName} doing after ${period}?`,
    html: `<p>Hi ${adopterName},</p>
           <p>It's been <strong>${period}</strong> since you adopted <strong>${petName}</strong>. We'd love to hear how things are going!</p>
           <p>Please consider submitting a follow-up report with any updates on ${petName}'s health and well-being.</p>
           <p>Your feedback helps us improve our adoption process and ensures pets are going to loving homes.</p>
           <p>Thank you for being a wonderful pet parent!</p>`,
  }),

  healthReminder: (ownerName, petName, type, description, daysUntilDue, dueDate) => ({
    subject: `Health reminder for ${petName}`,
    html: `<p>Hi ${ownerName},</p>
           <p>This is a friendly reminder that <strong>${petName}</strong> has an upcoming health event:</p>
           <p><strong>Type:</strong> ${type}</p>
           ${description ? `<p><strong>Details:</strong> ${description}</p>` : ''}
           <p><strong>Due date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
           <p><strong>Time remaining:</strong> ${daysUntilDue} day(s)</p>
           <p>Please make sure to schedule or complete this health activity on time.</p>`,
  }),
};

module.exports = { send, emails };
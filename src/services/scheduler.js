const cron = require('node-cron');
const pool = require('../db/pool');
const { send, emails } = require('./email');

// Run every day at 9 AM
const scheduleReminders = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('Running scheduled reminder jobs...');
    
    try {
      // 1. Adoption follow-up reminders (1 week, 1 month, 3 months)
      await processAdoptionReminders();
      
      // 2. Health log reminders (3 days before due date)
      await processHealthReminders();
      
      console.log('Scheduled reminder jobs completed.');
    } catch (err) {
      console.error('Error running scheduled reminders:', err.message);
    }
  });
};

// Process adoption follow-up reminders
const processAdoptionReminders = async () => {
  const now = new Date();
  
  // Find reminders that are due today and haven't been sent yet
  const { rows } = await pool.query(
    `SELECT ar.id AS adoption_request_id, ar.requester_id, ar.pet_id,
            r.reminder_type, r.due_at, r.sent_at,
            p.name AS pet_name,
            u.name AS adopter_name, u.email AS adopter_email
     FROM adoption_reminders r
     JOIN adoption_requests ar ON ar.id = r.adoption_request_id
     JOIN pets p ON p.id = ar.pet_id
     JOIN users u ON u.id = ar.requester_id
     WHERE r.due_at <= $1 AND r.sent_at IS NULL`,
    [now]
  );

  for (const reminder of rows) {
    try {
      let emailTemplate;
      let subject;
      
      switch (reminder.reminder_type) {
        case '1_week':
          emailTemplate = emails.followUpReminder(reminder.adopter_name, reminder.pet_name, '1 week');
          break;
        case '1_month':
          emailTemplate = emails.followUpReminder(reminder.adopter_name, reminder.pet_name, '1 month');
          break;
        case '3_months':
          emailTemplate = emails.followUpReminder(reminder.adopter_name, reminder.pet_name, '3 months');
          break;
        default:
          continue;
      }
      
      await send(reminder.adopter_email, emailTemplate.subject, emailTemplate.html);
      
      // Mark reminder as sent
      await pool.query(
        'UPDATE adoption_reminders SET sent_at = NOW() WHERE id = (SELECT id FROM adoption_reminders WHERE adoption_request_id = $1 AND reminder_type = $2)',
        [reminder.adoption_request_id, reminder.reminder_type]
      );
      
      console.log(`Sent ${reminder.reminder_type} follow-up reminder to ${reminder.adopter_email}`);
    } catch (err) {
      console.error(`Failed to send reminder to ${reminder.adopter_email}:`, err.message);
    }
  }
};

// Process health log reminders (3 days before due date)
const processHealthReminders = async () => {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  
  // Find health logs with next_due in 3 days
  const { rows } = await pool.query(
    `SELECT h.id AS health_log_id, h.pet_id, h.type, h.description, h.next_due,
            h.logged_by,
            p.name AS pet_name,
            u.name AS owner_name, u.email AS owner_email
     FROM pet_health_logs h
     JOIN pets p ON p.id = h.pet_id
     JOIN users u ON u.id = p.owner_id
     WHERE h.next_due IS NOT NULL
       AND h.next_due <= $1
       AND h.next_due > NOW()
       AND NOT EXISTS (
         SELECT 1 FROM pet_health_logs h2 
         WHERE h2.pet_id = h.pet_id 
           AND h2.next_due = h.next_due 
           AND h2.created_at > h.created_at
       )`,
    [threeDaysFromNow]
  );

  for (const log of rows) {
    try {
      const daysUntilDue = Math.ceil((log.next_due - new Date()) / (1000 * 60 * 60 * 24));
      const emailTemplate = emails.healthReminder(
        log.owner_name,
        log.pet_name,
        log.type,
        log.description || '',
        daysUntilDue,
        log.next_due
      );
      
      await send(log.owner_email, emailTemplate.subject, emailTemplate.html);
      
      console.log(`Sent health reminder for ${log.pet_name} (${log.type}) to ${log.owner_email}`);
    } catch (err) {
      console.error(`Failed to send health reminder for pet ${log.pet_id}:`, err.message);
    }
  }
};

module.exports = { scheduleReminders };

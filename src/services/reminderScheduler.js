const pool = require('../db/pool');
const { send } = require('./email');

/**
 * Call this after an adoption is completed (free or paid).
 * Schedules follow-up reminders at 1 week, 1 month, 3 months.
 */
const scheduleFollowupReminders = async (adoptionRequestId) => {
  const now = new Date();
  const reminders = [
    new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000),  // 1 week
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),  // 1 month
    new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),  // 3 months
  ];

  try {
    for (const remindAt of reminders) {
      await pool.query(
        `INSERT INTO followup_reminders (adoption_request_id, remind_at)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [adoptionRequestId, remindAt]
      );
    }
  } catch (err) {
    console.error('Failed to schedule reminders (non-fatal):', err.message);
  }
};

/**
 * Run this on a schedule — e.g. every hour via setInterval.
 * Sends reminder emails for any due reminders.
 */
const processDueReminders = async () => {
  try {
    const { rows: due } = await pool.query(
      `SELECT fr.id, fr.adoption_request_id,
              adopter.name  AS adopter_name,
              adopter.email AS adopter_email,
              p.name        AS pet_name
       FROM followup_reminders fr
       JOIN adoption_requests ar ON ar.id=fr.adoption_request_id
       JOIN users adopter ON adopter.id=ar.requester_id
       JOIN pets  p       ON p.id=ar.pet_id
       WHERE fr.remind_at <= NOW() AND fr.sent=FALSE
       LIMIT 50`
    );

    for (const reminder of due) {
      try {
        await send(
          reminder.adopter_email,
          `How is ${reminder.pet_name} doing? — Pet Rehoming`,
          `
            <p>Hi ${reminder.adopter_name},</p>
            <p>It's been a while since you adopted <strong>${reminder.pet_name}</strong>!</p>
            <p>We'd love to know how things are going. Please log in and submit a follow-up update — it only takes a minute and helps the original owner know their pet is in good hands.</p>
            <p><a href="${process.env.CLIENT_URL}/adoption-requests/mine" style="background:#2A9D8F;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Submit Follow-up</a></p>
          `
        );

        await pool.query(
          'UPDATE followup_reminders SET sent=TRUE, sent_at=NOW() WHERE id=$1',
          [reminder.id]
        );
      } catch (emailErr) {
        console.error(`Reminder email failed for id=${reminder.id}:`, emailErr.message);
      }
    }

    if (due.length) console.log(`📧 Sent ${due.length} follow-up reminder(s).`);
  } catch (err) {
    console.error('processDueReminders error:', err.message);
  }
};

/**
 * Health log reminders — check for logs with next_due within 3 days
 * Run once daily.
 */
const processHealthLogReminders = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT hl.id, hl.type, hl.next_due, hl.vet_name,
              p.name   AS pet_name,
              u.name   AS owner_name,
              u.email  AS owner_email
       FROM pet_health_logs hl
       JOIN pets p ON p.id=hl.pet_id
       JOIN users u ON u.id=p.owner_id
       WHERE hl.next_due IS NOT NULL
         AND hl.next_due BETWEEN NOW() AND NOW() + INTERVAL '3 days'`
    );

    for (const log of rows) {
      try {
        const dueDate = new Date(log.next_due).toLocaleDateString('en-GB');
        await send(
          log.owner_email,
          `Reminder: ${log.type} due for ${log.pet_name}`,
          `
            <p>Hi ${log.owner_name},</p>
            <p>This is a reminder that <strong>${log.pet_name}</strong>'s <strong>${log.type}</strong>
            is due on <strong>${dueDate}</strong>${log.vet_name ? ` at ${log.vet_name}` : ''}.</p>
            <p><a href="${process.env.CLIENT_URL}/pets/my" style="background:#2A9D8F;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">View Pet</a></p>
          `
        );
      } catch (emailErr) {
        console.error(`Health log reminder failed for log id=${log.id}:`, emailErr.message);
      }
    }

    if (rows.length) console.log(`📧 Sent ${rows.length} health log reminder(s).`);
  } catch (err) {
    console.error('processHealthLogReminders error:', err.message);
  }
};

module.exports = { scheduleFollowupReminders, processDueReminders, processHealthLogReminders };

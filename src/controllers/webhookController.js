const pool   = require('../db/pool');
const notify = require('../services/notify');
const { send, emails } = require('../services/email');
const { scheduleFollowupReminders } = require('../services/reminderScheduler');
const { logStatusChange } = require('../services/petStatusHistory');

/**
 * POST /api/payments/webhook
 *
 * Aya Pay calls this endpoint when a payment status changes.
 * No auth middleware — Aya Pay sends its own signature header.
 * Map the body fields to match Aya Pay's actual webhook payload.
 */
const handleWebhook = async (req, res) => {
  // ── Signature verification ───────────────────────────────────
  // Uncomment and implement once you have Aya Pay docs
  //
  // const signature = req.headers['x-ayapay-signature'];
  // const expected  = crypto
  //   .createHmac('sha256', process.env.AYAPAY_WEBHOOK_SECRET)
  //   .update(JSON.stringify(req.body))
  //   .digest('hex');
  // if (signature !== expected) return res.status(401).json({ message: 'Invalid signature.' });

  const {
    transactionId,   // Aya Pay's reference — matches ayapay_reference in payments table
    status,          // Aya Pay's status string e.g. SUCCESS / FAILED
    amount,
  } = req.body;

  // Map Aya Pay status → our enum
  const statusMap = { SUCCESS: 'completed', FAILED: 'failed', PENDING: 'pending', REFUNDED: 'refunded' };
  const mappedStatus = statusMap[status];

  if (!mappedStatus || !transactionId) {
    return res.status(400).json({ message: 'Invalid webhook payload.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE ayapay_reference=$1', [transactionId]
    );

    if (!rows.length) {
      console.warn(`Webhook: no payment found for reference ${transactionId}`);
      return res.status(200).json({ received: true }); // always 200 to Aya Pay
    }

    const payment = rows[0];

    // skip if status hasn't changed
    if (payment.status === mappedStatus) return res.status(200).json({ received: true });

    await pool.query(
      `UPDATE payments SET status=$1, metadata=metadata || $2 WHERE id=$3`,
      [mappedStatus, JSON.stringify({ webhook: req.body }), payment.id]
    );

    if (mappedStatus === 'completed' && payment.adoption_request_id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: arRows } = await client.query(
          'SELECT pet_id, requester_id FROM adoption_requests WHERE id=$1',
          [payment.adoption_request_id]
        );

        if (arRows.length) {
          const { pet_id, requester_id } = arRows[0];

          // get old status for history log
          const { rows: petRows } = await client.query('SELECT status, name FROM pets WHERE id=$1', [pet_id]);
          const oldStatus = petRows[0]?.status;

          await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [pet_id]);

          await logStatusChange(pet_id, oldStatus, 'adopted', requester_id, 'Payment completed via webhook');

          await client.query(
            `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
             WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
            [pet_id, payment.adoption_request_id]
          );

          await scheduleFollowupReminders(payment.adoption_request_id);

          // notifications + email
          const { rows: userRows } = await client.query(
            'SELECT name, email FROM users WHERE id=$1', [requester_id]
          );
          if (userRows.length && petRows.length) {
            const tmpl = emails.paymentConfirmed(userRows[0].name, petRows[0].name, payment.amount, payment.currency);
            send(userRows[0].email, tmpl.subject, tmpl.html).catch(() => {});

            notify(requester_id, {
              type:  'payment_completed',
              title: `Payment confirmed for ${petRows[0].name}`,
              body:  'Your adoption payment was received. Contact the owner to arrange pickup.',
              link:  `/adoption-requests/mine`,
            });
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Webhook adoption finalization failed:', err.message);
      } finally { client.release(); }
    }

    // always return 200 so Aya Pay doesn't retry
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).json({ received: true }); // still 200 — log internally
  }
};

module.exports = { handleWebhook };

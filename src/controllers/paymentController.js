const pool   = require('../db/pool');
const ayapay = require('../services/ayapay');

// POST /api/payments/initiate
const initiatePayment = async (req, res) => {
  const { amount, currency = 'MMK', description, adoption_request_id } = req.body;
  if (!amount || isNaN(amount) || +amount <= 0)
    return res.status(400).json({ message: 'A valid amount is required.' });

  // Validate adoption request belongs to this user if provided
  if (adoption_request_id) {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.status, p.adoption_fee, p.fee_type
       FROM adoption_requests ar JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1 AND ar.requester_id=$2`,
      [adoption_request_id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Adoption request not found.' });
    if (rows[0].status !== 'approved') return res.status(400).json({ message: 'Request is not approved yet.' });
    if (rows[0].fee_type === 'free')   return res.status(400).json({ message: 'This adoption is free.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO payments (user_id, adoption_request_id, amount, currency, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, adoption_request_id || null, amount, currency, description || null]
    );
    const payment = rows[0];
    const { reference, paymentUrl, rawResponse } = await ayapay.initiatePayment({
      amount, currency, description, orderId: payment.id,
    });
    const { rows: updated } = await client.query(
      `UPDATE payments SET ayapay_reference=$1, metadata=$2 WHERE id=$3 RETURNING *`,
      [reference, JSON.stringify(rawResponse), payment.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Payment initiated.', payment: updated[0], paymentUrl });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Payment failed.', error: err.message });
  } finally { client.release(); }
};

// POST /api/payments/:id/verify
const verifyPayment = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Payment not found.' });
    const payment = rows[0];
    if (!payment.ayapay_reference) return res.status(400).json({ message: 'No Aya Pay reference.' });

    const { status, rawResponse } = await ayapay.verifyPayment(payment.ayapay_reference);
    const { rows: updated } = await pool.query(
      `UPDATE payments SET status=$1, metadata=$2 WHERE id=$3 RETURNING *`,
      [status, JSON.stringify(rawResponse), payment.id]
    );

    // If paid + linked to adoption → mark pet as adopted
    if (status === 'completed' && payment.adoption_request_id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: req_ } = await client.query(
          'SELECT pet_id FROM adoption_requests WHERE id=$1', [payment.adoption_request_id]
        );
        if (req_.length) {
          await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [req_[0].pet_id]);
          await client.query(
            `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
             WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
            [req_[0].pet_id, payment.adoption_request_id]
          );
        }
        await client.query('COMMIT');
        const { send, emails } = require('../services/email');
pool.query('SELECT name, email FROM users WHERE id=$1', [pet.owner_id])
  .then(({ rows }) => {
    const tmpl = emails.adoptionRequestReceived(rows[0].name, pet.name, req.user.name);
    return send(rows[0].email, tmpl.subject, tmpl.html);
  })
  .catch(err => console.error('Email failed:', err.message));
      } catch { await client.query('ROLLBACK'); }
      finally { client.release(); }
    }

    res.json({ message: 'Payment status synced.', payment: updated[0] });
  } catch (err) { res.status(500).json({ message: 'Verification failed.', error: err.message }); }
};

// POST /api/payments/webhook/aya — Aya Pay webhook endpoint (called by Aya Pay directly)
const ayaWebhook = async (req, res) => {
  const { reference, status, amount, currency, orderId } = req.body;
  
  // Basic validation
  if (!reference || !status) {
    return res.status(400).json({ message: 'Invalid webhook payload.' });
  }

  try {
    // Find payment by Aya Pay reference
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE ayapay_reference = $1',
      [reference]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    const payment = rows[0];

    // Don't process if already completed
    if (payment.status === 'completed') {
      return res.json({ message: 'Payment already processed.' });
    }

    // Update payment status
    const { rows: updated } = await pool.query(
      `UPDATE payments SET status=$1, metadata=jsonb_set(metadata, '{webhook_received}', 'true') 
       WHERE id=$2 RETURNING *`,
      [status, payment.id]
    );

    // If paid + linked to adoption → mark pet as adopted
    if (status === 'completed' && payment.adoption_request_id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: req_ } = await client.query(
          'SELECT pet_id, requester_id FROM adoption_requests WHERE id=$1',
          [payment.adoption_request_id]
        );
        
        if (req_.length) {
          const petId = req_[0].pet_id;
          
          // Mark pet as adopted
          await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [petId]);
          
          // Reject other pending requests
          await client.query(
            `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
             WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
            [petId, payment.adoption_request_id]
          );
          
          // Create follow-up reminders
          const now = new Date();
          await client.query(
            `INSERT INTO adoption_reminders (adoption_request_id, reminder_type, due_at) 
             VALUES ($1, '1_week', $2), ($1, '1_month', $3), ($1, '3_months', $4)`,
            [payment.adoption_request_id,
             new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
             new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
             new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)]
          );
          
          // Send notification to adopter
          const notify = require('../services/notify');
          await notify(req_[0].requester_id, {
            type: 'adoption_completed',
            title: 'Adoption Completed!',
            body: 'Your adoption has been completed after successful payment.',
            link: `/adoption-requests/${payment.adoption_request_id}`
          });
        }
        
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Webhook adoption processing error:', err);
      } finally {
        client.release();
      }
    }

    res.json({ message: 'Webhook processed successfully.', payment: updated[0] });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ message: 'Webhook processing failed.', error: err.message });
  }
};

// POST /api/payments/simulate/:id — Sandbox payment simulation for demo\nconst simulatePayment = async (req, res) => {\n  try {\n    const { rows } = await pool.query(\n      'SELECT * FROM payments WHERE id=$1 AND user_id=$2',\n      [req.params.id, req.user.id]\n    );\n    if (!rows.length) return res.status(404).json({ message: 'Payment not found.' });\n    \n    const payment = rows[0];\n    if (!payment.ayapay_reference) {\n      return res.status(400).json({ message: 'Payment not initiated yet.' });\n    }\n\n    // Simulate successful payment\n    const { rows: updated } = await pool.query(\n      `UPDATE payments SET status='completed', metadata=jsonb_set(metadata, '{simulated}', 'true') \n       WHERE id=$1 RETURNING *`,\n      [payment.id]\n    );\n\n    // If linked to adoption → mark pet as adopted (same as webhook)\n    if (payment.adoption_request_id) {\n      const client = await pool.connect();\n      try {\n        await client.query('BEGIN');\n        const { rows: req_ } = await client.query(\n          'SELECT pet_id, requester_id FROM adoption_requests WHERE id=$1',\n          [payment.adoption_request_id]\n        );\n        \n        if (req_.length) {\n          const petId = req_[0].pet_id;\n          await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [petId]);\n          await client.query(\n            `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()\n             WHERE pet_id=$1 AND id<>$2 AND status='pending'`,\n            [petId, payment.adoption_request_id]\n          );\n          \n          // Create follow-up reminders\n          const now = new Date();\n          await client.query(\n            `INSERT INTO adoption_reminders (adoption_request_id, reminder_type, due_at) \n             VALUES ($1, '1_week', $2), ($1, '1_month', $3), ($1, '3_months', $4)`,\n            [payment.adoption_request_id,\n             new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),\n             new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),\n             new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)]\n          );\n        }\n        await client.query('COMMIT');\n      } catch (err) {\n        await client.query('ROLLBACK');\n        console.error('Simulated payment adoption processing error:', err);\n      } finally {\n        client.release();\n      }\n    }\n\n    res.json({ message: 'Payment simulated successfully.', payment: updated[0] });\n  } catch (err) {\n    res.status(500).json({ message: 'Simulation failed.', error: err.message });\n  }\n};\n\nconst listPayments = async (req, res) => {
  try {
    const { rows } = await pool.query(\n      `SELECT p.*, ar.pet_id FROM payments p
       LEFT JOIN adoption_requests ar ON ar.id=p.adoption_request_id
       WHERE p.user_id=$1 ORDER BY p.created_at DESC`,
      [req.user.id]\n    );
    res.json({ payments: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const getPayment = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Payment not found.' });
    res.json({ payment: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { initiatePayment, verifyPayment, ayaWebhook, simulatePayment, listPayments, getPayment };

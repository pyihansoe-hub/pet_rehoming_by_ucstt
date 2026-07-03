const pool   = require('../db/pool');
const ayapay = require('../services/ayapay');

const { scheduleFollowupReminders } = require('../services/reminderScheduler');
const { logStatusChange } = require('../services/petStatusHistory');

// POST /api/payments/initiate
const initiatePayment = async (req, res) => {
  const { amount, currency = 'MMK', description, adoption_request_id } = req.body;
  if (!amount || isNaN(amount) || +amount <= 0)
    return res.status(400).json({ message: 'A valid amount is required.' });

  if (adoption_request_id) {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.status, p.adoption_fee, p.fee_type
       FROM adoption_requests ar JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1 AND ar.requester_id=$2`,
      [adoption_request_id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Adoption request not found.' });
    if (rows[0].status !== 'approved') return res.status(400).json({ message: 'Request is not approved yet.' });
    if (rows[0].fee_type === 'free') return res.status(400).json({ message: 'This adoption is free.' });
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
      amount,
      currency,
      description,
      orderId: payment.id,
    });

    const { rows: updated } = await client.query(
      `UPDATE payments SET ayapay_reference=$1, metadata=$2 WHERE id=$3 RETURNING *`,
      [reference, JSON.stringify(rawResponse), payment.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Payment initiated.',
      payment: updated[0],
      paymentUrl,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Payment failed.', error: err.message });
  } finally {
    client.release();
  }
};

// POST /api/payments/:id/verify
const verifyPayment = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ message: 'Payment not found.' });

    const payment = rows[0];
    if (!payment.ayapay_reference)
      return res.status(400).json({ message: 'No Aya Pay reference.' });

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

        const { rows: reqRows } = await client.query(
          'SELECT pet_id FROM adoption_requests WHERE id=$1',
          [payment.adoption_request_id]
        );

        if (reqRows.length) {
          const pet_id = reqRows[0].pet_id;

          const { rows: petRows } = await client.query(
            'SELECT status FROM pets WHERE id=$1',
            [pet_id]
          );

          const old_status = petRows[0]?.status || 'available';

          await client.query(
            `UPDATE pets SET status='adopted' WHERE id=$1`,
            [pet_id]
          );

          await client.query(
            `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
             WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
            [pet_id, payment.adoption_request_id]
          );

          // REQUIRED ADDITIONS
          await scheduleFollowupReminders(payment.adoption_request_id);
          await logStatusChange(
            pet_id,
            old_status,
            'adopted',
            req.user.id,
            'Payment verified'
          );
        }

        await client.query('COMMIT');

      } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
      } finally {
        client.release();
      }
    }

    res.json({ message: 'Payment status synced.', payment: updated[0] });

  } catch (err) {
    res.status(500).json({ message: 'Verification failed.', error: err.message });
  }
};

const listPayments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, ar.pet_id FROM payments p
       LEFT JOIN adoption_requests ar ON ar.id=p.adoption_request_id
       WHERE p.user_id=$1 ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

const getPayment = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Payment not found.' });
    res.json({ payment: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
// POST /api/payments/simulate — Demo payment flow (PAYS AT REQUEST TIME)
const simulatePayment = async (req, res) => {
  const { adoption_request_id } = req.body;
  if (!adoption_request_id) return res.status(400).json({ message: 'Adoption request ID is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify request is PENDING (not approved yet) and is a paid type
    const { rows: reqRows } = await client.query(
      `SELECT ar.id, ar.requester_id, ar.pet_id, ar.payment_id, p.adoption_fee, p.name as pet_name, p.owner_id
       FROM adoption_requests ar 
       JOIN pets p ON p.id = ar.pet_id
       WHERE ar.id = $1 AND ar.status = 'pending' AND p.fee_type = 'paid'`,
      [adoption_request_id]
    );
    
    if (!reqRows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid request. Must be pending and a paid adoption.' });
    }

    const reqData = reqRows[0];

    // Check if already paid
    if (reqData.payment_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Payment already made for this request.' });
    }

    // 2. Create the payment record as 'completed'
    const { rows: payRows } = await client.query(
      `INSERT INTO payments (user_id, adoption_request_id, amount, currency, description, status, metadata)
       VALUES ($1, $2, $3, 'MMK', $4, 'completed', $5) RETURNING *`,
      [
        reqData.requester_id, 
        adoption_request_id, 
        reqData.adoption_fee, 
        'Adoption fee for ' + reqData.pet_name,
        JSON.stringify({ simulated: true })
      ]
    );

    const payment = payRows[0];

    // 3. Link payment to the adoption request
    await client.query(
      `UPDATE adoption_requests SET payment_id = $1, updated_at = NOW() WHERE id = $2`,
      [payment.id, adoption_request_id]
    );

    // 4. Notify the OWNER that payment is done (fix: use owner_id, not requester_id)
    // Make sure you have a notify function imported/defined
    if (typeof notify === 'function') {
      await notify(reqData.owner_id, {
        type: 'payment_received',
        title: 'Payment Received!',
        body: 'An adopter has paid ' + reqData.adoption_fee + ' MMK for ' + reqData.pet_name + '. Please review and approve.',
        link: '/pages/adoption-requests.html?tab=received',
      });
    }

    // NOTE: We do NOT mark pet as adopted here!
    // That happens when the OWNER clicks "Approve"

    await client.query('COMMIT');
    
    res.json({ 
      message: 'Payment successful!', 
      payment: payment 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Simulation failed.', error: err.message });
  } finally {
    client.release();
  }
};
module.exports = {
  initiatePayment,
  verifyPayment,
  listPayments,
  getPayment,
  simulatePayment
};
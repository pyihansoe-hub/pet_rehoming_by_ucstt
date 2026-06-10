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
      } catch { await client.query('ROLLBACK'); }
      finally { client.release(); }
    }

    res.json({ message: 'Payment status synced.', payment: updated[0] });
  } catch (err) { res.status(500).json({ message: 'Verification failed.', error: err.message }); }
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

module.exports = { initiatePayment, verifyPayment, listPayments, getPayment };

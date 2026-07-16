const pool = require('../db/pool');
const notify = require('../services/notify');

const { createAgreement } = require('./agreementController');
const { scheduleFollowupReminders } = require('../services/reminderScheduler');
const { logStatusChange } = require('../services/petStatusHistory');

// POST /api/pets/:id/adopt  — submit adoption request
const requestAdoption = async (req, res) => {
  const petId = req.params.id;
  const { message } = req.body;

  try {
    // FIX: Added 'name' to the SELECT query so it isn't undefined in the notification
    const { rows: pets } = await pool.query(
      'SELECT id, name, owner_id, status, fee_type, adoption_fee FROM pets WHERE id=$1', 
      [petId]
    );
    
    if (!pets.length) return res.status(404).json({ message: 'Pet not found.' });
    const pet = pets[0];
    
    if (pet.status !== 'available') return res.status(400).json({ message: 'Pet is not available for adoption.' });
    if (pet.owner_id === req.user.id) return res.status(400).json({ message: 'You cannot adopt your own pet.' });

    // 1. Check if user already has an ACTIVE request for this pet
    const { rows: activeReqs } = await pool.query(
      `SELECT id FROM adoption_requests 
       WHERE pet_id=$1 AND requester_id=$2 AND status IN ('pending', 'approved')`,
      [petId, req.user.id]
    );

    if (activeReqs.length > 0) {
      return res.status(409).json({ message: 'You already have an active request for this pet.' });
    }

    // 2. Check if user has a CANCELLED or REJECTED request we can reuse
    const { rows: oldReqs } = await pool.query(
      `SELECT id FROM adoption_requests 
       WHERE pet_id=$1 AND requester_id=$2 AND status IN ('cancelled', 'rejected')
       ORDER BY created_at DESC LIMIT 1`,
      [petId, req.user.id]
    );

    let requestRow;

    if (oldReqs.length > 0) {
      // Update the existing cancelled/rejected request back to pending
      const upd = await pool.query(
        `UPDATE adoption_requests 
         SET status='pending', message=$2, reviewed_at=NULL, created_at=NOW(), updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [oldReqs[0].id, message || null]
      );
      requestRow = upd.rows[0];
    } else {
      // Insert a brand new request
      const ins = await pool.query(
        `INSERT INTO adoption_requests (pet_id, requester_id, message)
         VALUES ($1,$2,$3) RETURNING *`,
        [petId, req.user.id, message || null]
      );
      requestRow = ins.rows[0];
    }

    res.status(201).json({
      message: 'Adoption request submitted.',
      request: requestRow,
      paymentRequired: pet.fee_type === 'paid',
      adoptionFee: pet.fee_type === 'paid' ? pet.adoption_fee : 0,
    });

    notify(pet.owner_id, {
      type: 'new_adoption_request',
      title: `New adoption request for ${pet.name}`,
      body: `${req.user.name} wants to adopt your pet.`,
      link: `/pages/adoption-requests.html?tab=received`,
    });

    const { send, emails } = require('../services/email');
    pool.query('SELECT name, email FROM users WHERE id=$1', [pet.owner_id])
      .then(({ rows }) => {
        const tmpl = emails.adoptionRequestReceived(rows[0].name, pet.name, req.user.name);
        return send(rows[0].email, tmpl.subject, tmpl.html);
      })
      .catch(err => console.error('Email failed:', err.message));

  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'You already have an active request for this pet.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
// GET /api/adoption-requests/mine
const myRequests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.*, p.name AS pet_name, pt.name AS pet_type, p.fee_type, p.adoption_fee
       FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id
       JOIN pet_types pt ON pt.id=p.pet_type_id
       WHERE ar.requester_id=$1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/adoption-requests/received
const receivedRequests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.*, p.name AS pet_name, u.name AS requester_name, u.email AS requester_email, u.phone AS requester_phone
       FROM adoption_requests ar
       JOIN pets p  ON p.id=ar.pet_id
       JOIN users u ON u.id=ar.requester_id
       WHERE p.owner_id=$1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH approve/reject
const reviewRequest = async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ message: 'Status must be approved or rejected.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT ar.*, p.owner_id, p.fee_type FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    const req_ = rows[0];

    if (req_.owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    await client.query(
      `UPDATE adoption_requests SET status=$1, reviewed_at=NOW() WHERE id=$2`,
      [status, req.params.id]
    );

    // Mark pet as adopted for BOTH free and paid when approved
    if (status === 'approved') {
      await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [req_.pet_id]);

      // Auto-reject any other pending requests for this pet
      await client.query(
        `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
         WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
        [req_.pet_id, req.params.id]
      );
    }

    await client.query('COMMIT');

    // Run post-approval tasks for both free and paid
    if (status === 'approved') {
      await createAgreement(req.params.id);
      await scheduleFollowupReminders(req.params.id);
      await logStatusChange(
        req_.pet_id,
        'available',
        'adopted',
        req.user.id,
        'Adoption approved by owner'
      );
    }

    const { send, emails } = require('../services/email');

    notify(req_.requester_id, {
      type: 'adoption_reviewed',
      title: status === 'approved'
        ? `Your adoption request was approved!`
        : `Adoption request update`,
      body: status === 'approved'
        ? `Your request has been approved. ${req_.fee_type === 'paid' ? 'Please complete the payment to finalize adoption.' : 'Please connect in Messages to chat with the owner and arrange pickup!'}`
        : `Your adoption request was not approved this time.`,
      link: `/pages/messages.html?conv=recent`,
    });

    try {
      const { rows: userRows } = await pool.query(
        'SELECT name, email FROM users WHERE id=$1', [req_.requester_id]
      );
      const { rows: petRows } = await pool.query(
        'SELECT name FROM pets WHERE id=$1', [req_.pet_id]
      );

      const requester = userRows[0];
      const pet = petRows[0];

      if (status === 'approved') {
        const tmpl = emails.adoptionApproved(
          requester.name,
          pet.name,
          req_.fee_type === 'free'
        );
        await send(requester.email, tmpl.subject, tmpl.html);
      } else {
        const tmpl = emails.adoptionRejected(requester.name, pet.name);
        await send(requester.email, tmpl.subject, tmpl.html);
      }
    } catch (emailErr) {
      console.error('Email failed (non-fatal):', emailErr.message);
    }

    // Auto-create chat room when approved so they can message each other
    if (status === 'approved') {
      try {
        await pool.query(
          `INSERT INTO conversations (adoption_request_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [req.params.id]
        );
      } catch(e) { console.error('Chat creation skipped:', e.message); }
    }

    res.json({
      message: `Request ${status}.`,
      requiresPayment: status === 'approved' && req_.fee_type === 'paid'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally {
    client.release();
  }
};

// PATCH cancel
const cancelRequest = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT requester_id, status FROM adoption_requests WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    if (rows[0].requester_id !== req.user.id)
      return res.status(403).json({ message: 'Not authorized.' });
    if (rows[0].status !== 'pending')
      return res.status(400).json({ message: 'Only pending requests can be cancelled.' });

    await pool.query(
      `UPDATE adoption_requests SET status='cancelled' WHERE id=$1`,
      [req.params.id]
    );

    res.json({ message: 'Request cancelled.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// Link payment to an adoption request
const linkPayment = async (req, res) => {
  try {
    const { payment_id } = req.body;
    const requestId = req.params.id;
    const userId = req.user.id;

    if (!payment_id) {
      return res.status(400).json({ ok: false, message: 'Payment ID is required' });
    }

    const check = await pool.query(
      'SELECT id FROM adoption_requests WHERE id = $1 AND requester_id = $2',
      [requestId, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Request not found' });
    }

    const result = await pool.query(
      'UPDATE adoption_requests SET payment_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [payment_id, requestId]
    );

    res.json({ 
      ok: true, 
      request: result.rows[0] 
    });

  } catch (err) {
    console.error('linkPayment error:', err);
    res.status(500).json({ ok: false, message: 'Failed to link payment' });
  }
};

module.exports = {
  requestAdoption,
  myRequests,
  receivedRequests,
  reviewRequest,
  cancelRequest,
  linkPayment
};
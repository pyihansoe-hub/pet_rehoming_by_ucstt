const pool = require('../db/pool');

// POST /api/pets/:id/adopt  — submit adoption request
const requestAdoption = async (req, res) => {
  const petId = req.params.id;
  const { message } = req.body;

  try {
    const { rows: pets } = await pool.query(
      'SELECT id, owner_id, status, fee_type, adoption_fee FROM pets WHERE id=$1', [petId]
    );
    if (!pets.length) return res.status(404).json({ message: 'Pet not found.' });
    const pet = pets[0];
    if (pet.status !== 'available') return res.status(400).json({ message: 'Pet is not available for adoption.' });
    if (pet.owner_id === req.user.id) return res.status(400).json({ message: 'You cannot adopt your own pet.' });

    const { rows } = await pool.query(
      `INSERT INTO adoption_requests (pet_id, requester_id, message)
       VALUES ($1,$2,$3) RETURNING *`,
      [petId, req.user.id, message || null]
    );

    res.status(201).json({
      message: 'Adoption request submitted.',
      request: rows[0],
      paymentRequired: pet.fee_type === 'paid',
      adoptionFee: pet.fee_type === 'paid' ? pet.adoption_fee : 0,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'You already have a pending request for this pet.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/adoption-requests/mine  — requester's own requests
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
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/adoption-requests/received  — requests on owner's pets
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
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/adoption-requests/:id  — approve / reject (owner)
const reviewRequest = async (req, res) => {
  const { status } = req.body; // approved | rejected
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

    // If approved + free → mark pet as adopted immediately
    if (status === 'approved' && req_.fee_type === 'free') {
      await client.query(`UPDATE pets SET status='adopted' WHERE id=$1`, [req_.pet_id]);
      // Reject all other pending requests for this pet
      await client.query(
        `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW()
         WHERE pet_id=$1 AND id<>$2 AND status='pending'`,
        [req_.pet_id, req.params.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Request ${status}.`, requiresPayment: status === 'approved' && req_.fee_type === 'paid' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};

// PATCH /api/adoption-requests/:id/cancel  — requester cancels
const cancelRequest = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT requester_id, status FROM adoption_requests WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Request not found.' });
    if (rows[0].requester_id !== req.user.id) return res.status(403).json({ message: 'Not authorized.' });
    if (rows[0].status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be cancelled.' });

    await pool.query(`UPDATE adoption_requests SET status='cancelled' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Request cancelled.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { requestAdoption, myRequests, receivedRequests, reviewRequest, cancelRequest };

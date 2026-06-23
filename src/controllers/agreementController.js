const pool = require('../db/pool');

// POST /api/adoption-requests/:id/agreement
// Creates agreement when owner approves — called internally from adoptionController
const createAgreement = async (adoptionRequestId, terms = null) => {
  try {
    await pool.query(
      `INSERT INTO adoption_agreements (adoption_request_id, terms)
       VALUES ($1, $2) ON CONFLICT (adoption_request_id) DO NOTHING`,
      [adoptionRequestId, terms]
    );
  } catch (err) {
    console.error('Agreement creation failed (non-fatal):', err.message);
  }
};

// PATCH /api/adoption-requests/:id/agreement/agree
// Owner or adopter signs the agreement
const agreeToAdoption = async (req, res) => {
  const adoptionRequestId = req.params.id;
  try {
    // check user is owner or adopter
    const { rows: arRows } = await pool.query(
      `SELECT ar.requester_id, p.owner_id
       FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1 AND ar.status='approved'`,
      [adoptionRequestId]
    );
    if (!arRows.length) return res.status(404).json({ message: 'Approved adoption request not found.' });

    const ar = arRows[0];
    const isOwner   = ar.owner_id    === req.user.id;
    const isAdopter = ar.requester_id === req.user.id;

    if (!isOwner && !isAdopter) return res.status(403).json({ message: 'Not authorized.' });

    const field     = isOwner ? 'owner_agreed'   : 'adopter_agreed';
    const timeField = isOwner ? 'owner_agreed_at' : 'adopter_agreed_at';

    const { rows } = await pool.query(
      `UPDATE adoption_agreements
       SET ${field}=TRUE, ${timeField}=NOW()
       WHERE adoption_request_id=$1
       RETURNING *`,
      [adoptionRequestId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agreement not found.' });

    const agreement = rows[0];
    const bothAgreed = agreement.owner_agreed && agreement.adopter_agreed;

    res.json({
      message: bothAgreed ? 'Both parties agreed. Adoption finalised.' : 'Your agreement recorded.',
      agreement,
      bothAgreed,
    });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/adoption-requests/:id/agreement
const getAgreement = async (req, res) => {
  try {
    const { rows: arRows } = await pool.query(
      `SELECT ar.requester_id, p.owner_id FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [req.params.id]
    );
    if (!arRows.length) return res.status(404).json({ message: 'Not found.' });

    const ar = arRows[0];
    if (ar.owner_id !== req.user.id && ar.requester_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      'SELECT * FROM adoption_agreements WHERE adoption_request_id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'No agreement found yet.' });
    res.json({ agreement: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { createAgreement, agreeToAdoption, getAgreement };

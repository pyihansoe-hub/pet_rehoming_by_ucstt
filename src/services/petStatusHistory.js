const pool = require('../db/pool');

/**
 * Call this whenever a pet's status changes.
 * Already wired into petController and adminController below.
 */
const logStatusChange = async (petId, oldStatus, newStatus, changedBy = null, reason = null) => {
  try {
    await pool.query(
      `INSERT INTO pet_status_history (pet_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [petId, oldStatus, newStatus, changedBy, reason]
    );
  } catch (err) {
    console.error('Status history log failed (non-fatal):', err.message);
  }
};

// GET /api/pets/:id/status-history
const getPetStatusHistory = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT psh.*, u.name AS changed_by_name
       FROM pet_status_history psh
       LEFT JOIN users u ON u.id=psh.changed_by
       WHERE psh.pet_id=$1
       ORDER BY psh.created_at DESC`,
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { logStatusChange, getPetStatusHistory };

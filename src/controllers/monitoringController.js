const pool = require('../db/pool');

// ── Helper: check if user can access this adoption's follow-ups ──
const canAccessAdoption = async (adoptionRequestId, userId, role) => {
  if (role === 'admin') return true;

  const { rows } = await pool.query(
    `SELECT ar.requester_id, p.owner_id
     FROM adoption_requests ar
     JOIN pets p ON p.id=ar.pet_id
     WHERE ar.id=$1`,
    [adoptionRequestId]
  );
  if (!rows.length) return false;
  return rows[0].requester_id === userId || rows[0].owner_id === userId;
};

// POST /api/monitoring/followups/:adoptionRequestId
const submitFollowup = async (req, res) => {
  const { health_status = 'good', weight_kg, notes } = req.body;
  const image_url = req.file ? `/uploads/followups/${req.file.filename}` : null;

  if (!['good', 'fair', 'poor'].includes(health_status))
    return res.status(400).json({ message: 'health_status must be good, fair, or poor.' });

  try {
    const ok = await canAccessAdoption(req.params.adoptionRequestId, req.user.id, req.user.role);
    if (!ok) return res.status(403).json({ message: 'Not authorized.' });

    const { rows: reqRows } = await pool.query(
      `SELECT id FROM adoption_requests WHERE id=$1 AND status='approved'`,
      [req.params.adoptionRequestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: 'Approved adoption request not found.' });

    const { rows } = await pool.query(
      `INSERT INTO adoption_followups
         (adoption_request_id, submitted_by, health_status, weight_kg, notes, image_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.adoptionRequestId, req.user.id, health_status, weight_kg || null, notes || null, image_url]
    );
    res.status(201).json({ message: 'Follow-up submitted.', followup: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/monitoring/followups/:adoptionRequestId
// Private: only owner, adopter, or admin
const getFollowups = async (req, res) => {
  try {
    const ok = await canAccessAdoption(req.params.adoptionRequestId, req.user?.id, req.user?.role);
    if (!ok) return res.status(403).json({ message: 'Not authorized. Follow-ups are private.' });

    const { rows } = await pool.query(
      `SELECT af.*, u.name AS submitted_by_name, u.avatar_url AS submitted_by_avatar
       FROM adoption_followups af
       JOIN users u ON u.id=af.submitted_by
       WHERE af.adoption_request_id=$1
       ORDER BY af.created_at DESC`,
      [req.params.adoptionRequestId]
    );
    res.json({ followups: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Pet health logs ───────────────────────────────────────────

// POST /api/monitoring/pets/:petId/health-logs
const addHealthLog = async (req, res) => {
  const { type, description, vet_name, weight_kg, next_due } = req.body;
  if (!type) return res.status(400).json({ message: 'Log type is required.' });

  try {
    const { rows: petRows } = await pool.query('SELECT owner_id FROM pets WHERE id=$1', [req.params.petId]);
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found.' });

    // owner or admin can add health logs
    if (petRows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      `INSERT INTO pet_health_logs
         (pet_id, logged_by, type, description, vet_name, weight_kg, next_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.petId, req.user.id, type, description || null, vet_name || null, weight_kg || null, next_due || null]
    );
    res.status(201).json({ log: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/monitoring/pets/:petId/health-logs
// Private: owner + admin only
const getHealthLogs = async (req, res) => {
  try {
    const { rows: petRows } = await pool.query('SELECT owner_id FROM pets WHERE id=$1', [req.params.petId]);
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found.' });

    if (petRows[0].owner_id !== req.user?.id && req.user?.role !== 'admin')
      return res.status(403).json({ message: 'Health logs are private to the pet owner.' });

    const { rows } = await pool.query(
      `SELECT hl.*, u.name AS logged_by_name
       FROM pet_health_logs hl
       JOIN users u ON u.id=hl.logged_by
       WHERE hl.pet_id=$1
       ORDER BY hl.created_at DESC`,
      [req.params.petId]
    );
    res.json({ logs: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/monitoring/pets/:petId/health-logs/:logId
const deleteHealthLog = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT hl.logged_by, p.owner_id FROM pet_health_logs hl JOIN pets p ON p.id=hl.pet_id WHERE hl.id=$1',
      [req.params.logId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Log not found.' });

    const r = rows[0];
    if (r.logged_by !== req.user.id && r.owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    await pool.query('DELETE FROM pet_health_logs WHERE id=$1', [req.params.logId]);
    res.json({ message: 'Log deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { submitFollowup, getFollowups, addHealthLog, getHealthLogs, deleteHealthLog };

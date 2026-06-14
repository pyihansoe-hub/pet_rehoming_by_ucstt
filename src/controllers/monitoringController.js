const path = require('path');
const fs   = require('fs');
const pool = require('../db/pool');

// ── Post-adoption follow-ups ──────────────────────────────────

// POST /api/followups/:adoptionRequestId
const submitFollowup = async (req, res) => {
  const { health_status = 'good', weight_kg, notes } = req.body;
  const image_url = req.file ? `/uploads/followups/${req.file.filename}` : null;

  if (!['good', 'fair', 'poor'].includes(health_status))
    return res.status(400).json({ message: 'health_status must be good, fair, or poor.' });

  try {
    const { rows: reqRows } = await pool.query(
      `SELECT ar.*, p.owner_id FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1 AND ar.status='approved'`,
      [req.params.adoptionRequestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: 'Approved adoption request not found.' });

    const adoption = reqRows[0];
    // only the adopter or original owner can submit follow-ups
    if (adoption.requester_id !== req.user.id && adoption.owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      `INSERT INTO adoption_followups (adoption_request_id, submitted_by, health_status, weight_kg, notes, image_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.adoptionRequestId, req.user.id, health_status, weight_kg || null, notes || null, image_url]
    );
    res.status(201).json({ message: 'Follow-up submitted.', followup: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/followups/:adoptionRequestId
const getFollowups = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT af.*, u.name AS submitted_by_name
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

// POST /api/pets/:petId/health-logs
const addHealthLog = async (req, res) => {
  const { type, description, vet_name, weight_kg, next_due } = req.body;
  if (!type) return res.status(400).json({ message: 'Log type is required.' });

  try {
    const { rows: petRows } = await pool.query('SELECT owner_id FROM pets WHERE id=$1', [req.params.petId]);
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found.' });
    if (petRows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      `INSERT INTO pet_health_logs (pet_id, logged_by, type, description, vet_name, weight_kg, next_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.petId, req.user.id, type, description || null, vet_name || null, weight_kg || null, next_due || null]
    );
    res.status(201).json({ log: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/pets/:petId/health-logs
const getHealthLogs = async (req, res) => {
  try {
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

// DELETE /api/pets/:petId/health-logs/:logId
const deleteHealthLog = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT logged_by FROM pet_health_logs WHERE id=$1', [req.params.logId]);
    if (!rows.length) return res.status(404).json({ message: 'Log not found.' });
    if (rows[0].logged_by !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM pet_health_logs WHERE id=$1', [req.params.logId]);
    res.json({ message: 'Log deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { submitFollowup, getFollowups, addHealthLog, getHealthLogs, deleteHealthLog };
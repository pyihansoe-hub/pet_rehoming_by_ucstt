const pool = require('../db/pool');

// GET /api/pet-types
const listPetTypes = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pet_types ORDER BY name');
    res.json({ petTypes: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/pet-types  (admin)
const createPetType = async (req, res) => {
  const { name, description, icon_url } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO pet_types (name, description, icon_url) VALUES ($1,$2,$3) RETURNING *',
      [name, description || null, icon_url || null]
    );
    res.status(201).json({ petType: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Pet type already exists.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// DELETE /api/pet-types/:id  (admin)
const deletePetType = async (req, res) => {
  try {
    await pool.query('DELETE FROM pet_types WHERE id=$1', [req.params.id]);
    res.json({ message: 'Pet type deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { listPetTypes, createPetType, deletePetType };

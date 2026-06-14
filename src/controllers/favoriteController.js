const pool = require('../db/pool');

// POST /api/favorites/:petId
const addFavorite = async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO favorites (user_id, pet_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.petId]
    );
    res.status(201).json({ message: 'Added to favorites.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/favorites/:petId
const removeFavorite = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM favorites WHERE user_id=$1 AND pet_id=$2',
      [req.user.id, req.params.petId]
    );
    res.json({ message: 'Removed from favorites.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/favorites
const listFavorites = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.fee_type, p.adoption_fee, p.status, p.location,
              pt.name AS pet_type_name,
              (SELECT url FROM pet_images WHERE pet_id=p.id AND is_primary=TRUE LIMIT 1) AS primary_image,
              f.created_at AS saved_at
       FROM favorites f
       JOIN pets p  ON p.id=f.pet_id
       JOIN pet_types pt ON pt.id=p.pet_type_id
       WHERE f.user_id=$1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ favorites: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { addFavorite, removeFavorite, listFavorites };
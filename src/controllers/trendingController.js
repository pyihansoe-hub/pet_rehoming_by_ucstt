const pool = require('../db/pool');

// GET /api/pets/trending
// Top pets by views in last 7 days, available only
const getTrendingPets = async (req, res) => {
  const { limit = 8 } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.fee_type, p.adoption_fee, p.status, p.location, p.city, p.views,
              pt.name AS pet_type_name,
              u.name  AS owner_name,
              (SELECT url FROM pet_images WHERE pet_id=p.id AND is_primary=TRUE LIMIT 1) AS primary_image
       FROM pets p
       JOIN pet_types pt ON pt.id=p.pet_type_id
       JOIN users     u  ON u.id=p.owner_id
       WHERE p.status='available'
         AND p.created_at > NOW() - INTERVAL '30 days'
       ORDER BY p.views DESC, p.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ pets: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/pets/cities
// Distinct cities for filter dropdown
const getCities = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT city FROM pets
       WHERE city IS NOT NULL AND city <> '' AND status='available'
       ORDER BY city`
    );
    res.json({ cities: rows.map(r => r.city) });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { getTrendingPets, getCities };

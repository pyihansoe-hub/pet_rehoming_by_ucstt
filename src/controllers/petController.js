const pool = require('../db/pool');
const path = require('path');
const fs   = require('fs');
// ── helpers ──────────────────────────────────────────────────────────────────

const PET_SELECT = `SELECT
  p.*,
  pt.name  AS pet_type_name,
  u.name   AS owner_name,
  u.phone  AS owner_phone,
  COALESCE(
    json_agg(to_jsonb(pi) ORDER BY pi.is_primary DESC, pi.id) FILTER (WHERE pi.id IS NOT NULL),
    '[]'::json
  ) AS images
FROM pets p
JOIN pet_types pt ON pt.id = p.pet_type_id
JOIN users     u  ON u.id  = p.owner_id
LEFT JOIN pet_images pi ON pi.pet_id = p.id
`;

// GET /api/pets  — list with filters
const listPets = async (req, res) => {
  const {
    type,        // pet_type_id
    status = 'available',
    fee_type,
    gender,
    city,
    page = 1,
    limit = 20,
    search,
  } = req.query;

  const conditions = [];
  const values     = [];
  let   i          = 1;

  if (status)   { conditions.push(`p.status = $${i++}`);       values.push(status); }
  if (type)     { conditions.push(`p.pet_type_id = $${i++}`);  values.push(type); }
  if (fee_type) { conditions.push(`p.fee_type = $${i++}`);     values.push(fee_type); }
  if (gender)   { conditions.push(`p.gender = $${i++}`);       values.push(gender); }
  if (city)     { conditions.push(`p.city = $${i++}`);         values.push(city); }
  if (search)   {
    conditions.push(`(p.name ILIKE $${i} OR p.breed ILIKE $${i} OR p.description ILIKE $${i})`);
    values.push(`%${search}%`); i++;
  }

  const WHERE  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  try {
    const { rows } = await pool.query(
      `${PET_SELECT} ${WHERE} GROUP BY p.id, pt.name, u.name, u.phone
       ORDER BY p.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(
      `SELECT COUNT(*) FROM pets p ${WHERE}`, values
    );
    res.json({ pets: rows, total: parseInt(count.rows[0].count), page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/pets/:id
const getPet = async (req, res) => {
  try {
    await pool.query('UPDATE pets SET views = COALESCE(views,0)+1 WHERE id=$1', [req.params.id]).catch(() => {});
    const { rows } = await pool.query(
      `${PET_SELECT} WHERE p.id=$1 GROUP BY p.id, pt.name, u.name, u.phone`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Pet not found.' });
    res.json({ pet: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/pets
const createPet = async (req, res) => {
  const {
    pet_type_id, name, breed, birth_date, is_sure,
    gender, color, weight_kg, description, health_notes,
    is_vaccinated = false, is_neutered = false,
    fee_type = 'free', adoption_fee = 0, city, location,
    images = [],
  } = req.body;

  if (!pet_type_id || !name) return res.status(400).json({ message: 'pet_type_id and name are required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO pets
         (owner_id, pet_type_id, name, breed, birth_date, is_sure,
          gender, color, weight_kg, description, health_notes,
          is_vaccinated, is_neutered, fee_type, adoption_fee, city, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [req.user.id, pet_type_id, name, breed || null, birth_date || null, is_sure || null,
       gender || null, color || null, weight_kg || null, description || null,
       health_notes || null, is_vaccinated, is_neutered,
       fee_type, fee_type === 'free' ? 0 : adoption_fee, city || null, location || null]
    );
    const pet = rows[0];

    if (images.length) {
      for (const img of images) {
        await client.query(
          'INSERT INTO pet_images (pet_id, url, is_primary) VALUES ($1,$2,$3)',
          [pet.id, img.url, img.is_primary || false]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Pet listed successfully.', pet });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};

// PATCH /api/pets/:id
const updatePet = async (req, res) => {
  const allowed = ['name','breed','birth_date','is_sure','gender','color','weight_kg',
                   'description','health_notes','is_vaccinated','is_neutered',
                   'fee_type','adoption_fee','status','city','location'];
  const fields = []; const values = []; let i = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) { fields.push(`${key}=$${i++}`); values.push(req.body[key]); }
  }
  if (!fields.length) return res.status(400).json({ message: 'No fields to update.' });

  try {
    const check = await pool.query('SELECT owner_id FROM pets WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ message: 'Pet not found.' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE pets SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, values
    );
    res.json({ message: 'Pet updated.', pet: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/pets/:id
const deletePet = async (req, res) => {
  try {
    const check = await pool.query('SELECT owner_id FROM pets WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ message: 'Pet not found.' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM pets WHERE id=$1', [req.params.id]);
    res.json({ message: 'Pet listing deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// POST /api/pets/:id/images
const addPetImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image file is required.' });

  const url        = `/uploads/pets/${req.file.filename}`;
  const is_primary = req.body.is_primary === 'true';

  try {
    const check = await pool.query('SELECT owner_id FROM pets WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ message: 'Pet not found.' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    if (is_primary) {
      await pool.query('UPDATE pet_images SET is_primary=FALSE WHERE pet_id=$1', [req.params.id]);
    }
    const { rows } = await pool.query(
      'INSERT INTO pet_images (pet_id, url, is_primary) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, url, is_primary]
    );
    res.status(201).json({ image: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/pets/:id/images/:imageId
const deletePetImage = async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT pi.url, p.owner_id FROM pet_images pi JOIN pets p ON p.id=pi.pet_id WHERE pi.id=$1',
      [req.params.imageId]
    );
    if (!check.rows.length) return res.status(404).json({ message: 'Image not found.' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const filePath = path.join(__dirname, '../../', check.rows[0].url);
    fs.unlink(filePath, () => {});

    await pool.query('DELETE FROM pet_images WHERE id=$1', [req.params.imageId]);
    res.json({ message: 'Image deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/pets/my  — owner's own listings
const myPets = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${PET_SELECT} WHERE p.owner_id=$1 GROUP BY p.id, pt.name, u.name, u.phone ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ pets: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const getTrendingPets = async (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 8, 50));
  try {
    const { rows } = await pool.query(
      `${PET_SELECT}
       WHERE p.status='available'
       GROUP BY p.id, pt.name, u.name, u.phone
       ORDER BY COALESCE(p.views, 0) DESC, p.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ pets: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const getCities = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT city FROM pets
       WHERE city IS NOT NULL AND city <> '' AND status='available'
       ORDER BY city`
    );
    res.json({ cities: rows.map(r => r.city) });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = {
  listPets, getPet, createPet, updatePet, deletePet,
  addPetImage, deletePetImage, myPets, getTrendingPets, getCities
};

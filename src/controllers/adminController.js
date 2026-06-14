const pool = require('../db/pool');

// GET /api/admin/stats
const getDashboardStats = async (req, res) => {
  try {
    const [users, pets, adoptions, payments, reports, blogs] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query(`SELECT status, COUNT(*) FROM pets GROUP BY status`),
      pool.query(`SELECT status, COUNT(*) FROM adoption_requests GROUP BY status`),
      pool.query(`SELECT status, COALESCE(SUM(amount),0) AS total FROM payments GROUP BY status`),
      pool.query(`SELECT COUNT(*) FROM reports WHERE status='pending'`),
      pool.query('SELECT COUNT(*) FROM blogs WHERE status=$1', ['published']),
    ]);

    const petsByStatus = {};
    pets.rows.forEach(r => petsByStatus[r.status] = +r.count);

    const adoptionsByStatus = {};
    adoptions.rows.forEach(r => adoptionsByStatus[r.status] = +r.count);

    const paymentStats = {};
    payments.rows.forEach(r => { paymentStats[r.status] = { count: +r.count, total: +r.total }; });

    res.json({
      users:           +users.rows[0].count,
      pets:            petsByStatus,
      adoptions:       adoptionsByStatus,
      payments:        paymentStats,
      pendingReports:  +reports.rows[0].count,
      publishedBlogs:  +blogs.rows[0].count,
    });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/admin/users
const listUsers = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (search) { conditions.push(`(name ILIKE $${i} OR email ILIKE $${i})`); values.push(`%${search}%`); i++; }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, created_at FROM users ${WHERE}
       ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM users ${WHERE}`, values);
    res.json({ users: rows, total: +count.rows[0].count });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Role must be user or admin.' });
  try {
    await pool.query('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.id]);
    res.json({ message: `User role updated to ${role}.` });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { getDashboardStats, listUsers, updateUserRole };
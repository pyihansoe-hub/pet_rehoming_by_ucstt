const pool  = require('../db/pool');
const audit = require('../services/audit');

const getIp = (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;

// ── Dashboard Stats ───────────────────────────────────────────

// GET /api/admin/stats
const getDashboardStats = async (req, res) => {
  try {
    const [users, pets, adoptions, payments, reports, blogs, followups] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (WHERE role='admin')            AS admins,
        COUNT(*) FILTER (WHERE is_suspended=TRUE)       AS suspended,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '7 days') AS new_this_week
        FROM users`),

      pool.query(`SELECT status, COUNT(*) FROM pets GROUP BY status`),

      pool.query(`SELECT status, COUNT(*) FROM adoption_requests GROUP BY status`),

      // ✅ UPDATED: Added SUM(service_fee) as profit and SUM(owner_amount) as owner_payout
      pool.query(`SELECT status, 
                         COALESCE(SUM(amount),0) AS total, 
                         COALESCE(SUM(service_fee),0) AS profit, 
                         COALESCE(SUM(owner_amount),0) AS owner_payout,
                         COUNT(*) AS count
                  FROM payments GROUP BY status`),

      pool.query(`SELECT status, COUNT(*) FROM reports GROUP BY status`),

      pool.query(`SELECT COUNT(*) FILTER (WHERE status='published') AS published,
                         COUNT(*) FILTER (WHERE status='draft')     AS draft
                  FROM blogs`),

      pool.query(`SELECT COUNT(*) FROM adoption_followups`),
    ]);

    const petsByStatus      = {};
    const adoptionsByStatus = {};
    const paymentStats      = {};
    const reportsByStatus   = {};

    pets.rows.forEach(r      => { petsByStatus[r.status]      = +r.count; });
    adoptions.rows.forEach(r => { adoptionsByStatus[r.status] = +r.count; });
    
    // ✅ UPDATED: Mapping the new profit and owner_payout fields
    payments.rows.forEach(r  => {
      paymentStats[r.status] = { 
        count: +r.count, 
        total: +r.total,
        profit: +r.profit,
        ownerPayout: +r.owner_payout
      };
    });

    reports.rows.forEach(r   => { reportsByStatus[r.status]   = +r.count; });

    res.json({
      users: {
        total:       +users.rows[0].total,
        admins:      +users.rows[0].admins,
        suspended:   +users.rows[0].suspended,
        newThisWeek: +users.rows[0].new_this_week,
      },
      pets:        petsByStatus,
      adoptions:   adoptionsByStatus,
      payments:    paymentStats,
      reports:     reportsByStatus,
      blogs:       { published: +blogs.rows[0].published, draft: +blogs.rows[0].draft },
      followups:   +followups.rows[0].count,
    });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── User Management ───────────────────────────────────────────

// GET /api/admin/users
const listUsers = async (req, res) => {
  const { page = 1, limit = 20, search, role, suspended } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;

  if (search)    { conditions.push(`(name ILIKE $${i} OR email ILIKE $${i})`); values.push(`%${search}%`); i++; }
  if (role)      { conditions.push(`role=$${i++}`);         values.push(role); }
  if (suspended === 'true')  { conditions.push(`is_suspended=TRUE`); }
  if (suspended === 'false') { conditions.push(`is_suspended=FALSE`); }

  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, is_suspended, suspend_reason, created_at
       FROM users ${WHERE} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM users ${WHERE}`, values);
    res.json({ users: rows, total: +count.rows[0].count, page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/admin/users/:id
const getUser = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.address, u.role,
              u.is_suspended, u.suspend_reason, u.created_at,
              (SELECT COUNT(*) FROM pets WHERE owner_id=u.id)                AS pet_count,
              (SELECT COUNT(*) FROM adoption_requests WHERE requester_id=u.id) AS request_count,
              (SELECT COUNT(*) FROM payments WHERE user_id=u.id AND status='completed') AS payment_count
       FROM users u WHERE u.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Role must be user or admin.' });

  // prevent admin from demoting themselves
  if (+req.params.id === req.user.id && role !== 'admin')
    return res.status(400).json({ message: 'You cannot demote yourself.' });

  try {
    const { rows } = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await audit({ adminId: req.user.id, action: 'change_role', targetType: 'user', targetId: +req.params.id,
      detail: `Changed role to ${role} for ${rows[0].email}`, ip: getIp(req) });

    res.json({ message: `User role updated to ${role}.`, user: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/users/:id/suspend
const suspendUser = async (req, res) => {
  const { reason } = req.body;
  if (+req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot suspend yourself.' });

  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_suspended=TRUE, suspended_at=NOW(), suspend_reason=$1
       WHERE id=$2 RETURNING id, name, email`,
      [reason || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await audit({ adminId: req.user.id, action: 'suspend_user', targetType: 'user', targetId: +req.params.id,
      detail: `Suspended ${rows[0].email}. Reason: ${reason || 'none'}`, ip: getIp(req) });

    res.json({ message: `User ${rows[0].name} suspended.` });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/users/:id/unsuspend
const unsuspendUser = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_suspended=FALSE, suspended_at=NULL, suspend_reason=NULL
       WHERE id=$1 RETURNING id, name, email`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await audit({ adminId: req.user.id, action: 'unsuspend_user', targetType: 'user', targetId: +req.params.id,
      detail: `Unsuspended ${rows[0].email}`, ip: getIp(req) });

    res.json({ message: `User ${rows[0].name} unsuspended.` });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete yourself.' });
  try {
    const { rows } = await pool.query('SELECT name, email FROM users WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);

    await audit({ adminId: req.user.id, action: 'delete_user', targetType: 'user', targetId: +req.params.id,
      detail: `Deleted user ${rows[0].email}`, ip: getIp(req) });

    res.json({ message: 'User deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Pet Management ────────────────────────────────────────────

// GET /api/admin/pets
const listAllPets = async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (status) { conditions.push(`p.status=$${i++}`); values.push(status); }
  if (search) { conditions.push(`(p.name ILIKE $${i} OR u.name ILIKE $${i})`); values.push(`%${search}%`); i++; }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.status, p.fee_type, p.adoption_fee, p.created_at,
              pt.name AS type, u.name AS owner_name, u.email AS owner_email,
              (SELECT url FROM pet_images WHERE pet_id=p.id AND is_primary=TRUE LIMIT 1) AS primary_image
       FROM pets p
       JOIN pet_types pt ON pt.id=p.pet_type_id
       JOIN users u ON u.id=p.owner_id
       ${WHERE}
       ORDER BY p.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(
      `SELECT COUNT(*) FROM pets p JOIN users u ON u.id=p.owner_id ${WHERE}`, values
    );
    res.json({ pets: rows, total: +count.rows[0].count, page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/admin/pets/:id
const deletePet = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT name FROM pets WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Pet not found.' });

    await pool.query('DELETE FROM pets WHERE id=$1', [req.params.id]);

    await audit({ adminId: req.user.id, action: 'delete_pet', targetType: 'pet', targetId: +req.params.id,
      detail: `Deleted pet: ${rows[0].name}`, ip: getIp(req) });

    res.json({ message: 'Pet deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/pets/:id/status
const updatePetStatus = async (req, res) => {
  const { status } = req.body;
  const valid = ['available', 'pending', 'adopted', 'withdrawn'];
  if (!valid.includes(status)) return res.status(400).json({ message: `Status must be: ${valid.join(', ')}` });

  try {
    const { rows } = await pool.query(
      'UPDATE pets SET status=$1 WHERE id=$2 RETURNING id, name, status',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Pet not found.' });

    await audit({ adminId: req.user.id, action: 'update_pet_status', targetType: 'pet', targetId: +req.params.id,
      detail: `Set pet "${rows[0].name}" status to ${status}`, ip: getIp(req) });

    res.json({ message: 'Pet status updated.', pet: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Blog Management ───────────────────────────────────────────

// GET /api/admin/blogs
const listAllBlogs = async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (status) { conditions.push(`b.status=$${i++}`); values.push(status); }
  if (search) { conditions.push(`b.title ILIKE $${i++}`); values.push(`%${search}%`); }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, b.slug, b.status, b.views, b.created_at,
              u.name AS author_name, bc.name AS category_name
       FROM blogs b
       JOIN users u ON u.id=b.author_id
       LEFT JOIN blog_categories bc ON bc.id=b.category_id
       ${WHERE}
       ORDER BY b.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM blogs b ${WHERE}`, values);
    res.json({ blogs: rows, total: +count.rows[0].count, page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/admin/blogs/:id
const deleteBlog = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT title FROM blogs WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Blog not found.' });

    await pool.query('DELETE FROM blogs WHERE id=$1', [req.params.id]);

    await audit({ adminId: req.user.id, action: 'delete_blog', targetType: 'blog', targetId: +req.params.id,
      detail: `Deleted blog: "${rows[0].title}"`, ip: getIp(req) });

    res.json({ message: 'Blog deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/blogs/:id/status
const updateBlogStatus = async (req, res) => {
  const { status } = req.body;
  if (!['draft','published','archived'].includes(status))
    return res.status(400).json({ message: 'Status must be draft, published, or archived.' });
  try {
    const { rows } = await pool.query(
      `UPDATE blogs SET status=$1 ${status==='published'?', published_at=NOW()':''} WHERE id=$2 RETURNING id, title, status`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Blog not found.' });

    await audit({ adminId: req.user.id, action: 'update_blog_status', targetType: 'blog', targetId: +req.params.id,
      detail: `Set blog "${rows[0].title}" status to ${status}`, ip: getIp(req) });

    res.json({ message: 'Blog status updated.', blog: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Adoption Management ───────────────────────────────────────

// GET /api/admin/adoptions
const listAllAdoptions = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (status) { conditions.push(`ar.status=$${i++}`); values.push(status); }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.status, ar.created_at, ar.reviewed_at,
              p.name AS pet_name, p.fee_type,
              owner.name AS owner_name, owner.email AS owner_email,
              req.name   AS requester_name, req.email AS requester_email
       FROM adoption_requests ar
       JOIN pets  p     ON p.id=ar.pet_id
       JOIN users owner ON owner.id=p.owner_id
       JOIN users req   ON req.id=ar.requester_id
       ${WHERE}
       ORDER BY ar.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM adoption_requests ar ${WHERE}`, values);
    res.json({ adoptions: rows, total: +count.rows[0].count });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/adoptions/:id/close
const closeAdoption = async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT ar.*, p.fee_type FROM adoption_requests ar
       JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Adoption request not found.' });
    const adoption = rows[0];

    await client.query(
      `UPDATE adoption_requests SET status='rejected', reviewed_at=NOW() WHERE id=$1`,
      [req.params.id]
    );

    // if pet has no other approved requests, set back to available
    const others = await client.query(
      `SELECT id FROM adoption_requests WHERE pet_id=$1 AND status='approved' AND id<>$2`,
      [adoption.pet_id, req.params.id]
    );
    if (!others.rows.length) {
      await client.query(`UPDATE pets SET status='available' WHERE id=$1 AND status='pending'`, [adoption.pet_id]);
    }

    await client.query('COMMIT');

    await audit({ adminId: req.user.id, action: 'force_close_adoption', targetType: 'adoption', targetId: +req.params.id,
      detail: reason || 'Admin force-closed adoption request', ip: getIp(req) });

    res.json({ message: 'Adoption request force-closed.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};

// ── Monitoring Overview ───────────────────────────────────────

// GET /api/admin/followups  — all follow-ups across platform
const listAllFollowups = async (req, res) => {
  const { page = 1, limit = 20, health_status } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (health_status) { conditions.push(`af.health_status=$${i++}`); values.push(health_status); }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT af.*, u.name AS submitted_by_name, p.name AS pet_name,
              owner.name AS owner_name, adopter.name AS adopter_name
       FROM adoption_followups af
       JOIN adoption_requests ar ON ar.id=af.adoption_request_id
       JOIN pets  p      ON p.id=ar.pet_id
       JOIN users owner  ON owner.id=p.owner_id
       JOIN users adopter ON adopter.id=ar.requester_id
       JOIN users u ON u.id=af.submitted_by
       ${WHERE}
       ORDER BY af.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM adoption_followups af ${WHERE}`, values);
    res.json({ followups: rows, total: +count.rows[0].count });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// GET /api/admin/health-logs  — all health logs across platform
const listAllHealthLogs = async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (type) { conditions.push(`hl.type=$${i++}`); values.push(type); }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT hl.*, p.name AS pet_name, u.name AS logged_by_name
       FROM pet_health_logs hl
       JOIN pets p ON p.id=hl.pet_id
       JOIN users u ON u.id=hl.logged_by
       ${WHERE}
       ORDER BY hl.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM pet_health_logs hl ${WHERE}`, values);
    res.json({ logs: rows, total: +count.rows[0].count });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Audit Log ─────────────────────────────────────────────────

// GET /api/admin/audit-log
const getAuditLog = async (req, res) => {
  const { page = 1, limit = 30, admin_id, action, target_type } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  const conditions = []; const values = []; let i = 1;
  if (admin_id)    { conditions.push(`al.admin_id=$${i++}`);    values.push(admin_id); }
  if (action)      { conditions.push(`al.action ILIKE $${i++}`); values.push(`%${action}%`); }
  if (target_type) { conditions.push(`al.target_type=$${i++}`); values.push(target_type); }
  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT al.*, u.name AS admin_name, u.email AS admin_email
       FROM admin_audit_log al
       JOIN users u ON u.id=al.admin_id
       ${WHERE}
       ORDER BY al.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...values, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM admin_audit_log al ${WHERE}`, values);
    res.json({ logs: rows, total: +count.rows[0].count, page: +page, limit: +limit });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Reports (enhanced) ────────────────────────────────────────

// GET /api/admin/reports
const listReports = async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS reporter_name, u.email AS reporter_email,
              p.name AS pet_name, b.title AS blog_title,
              reviewer.name AS reviewed_by_name
       FROM reports r
       JOIN users u ON u.id=r.reporter_id
       LEFT JOIN pets  p    ON p.id=r.pet_id
       LEFT JOIN blogs b    ON b.id=r.blog_id
       LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by
       WHERE r.status=$1
       ORDER BY r.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM reports WHERE status=$1`, [status]);
    res.json({ reports: rows, total: +count.rows[0].count });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/reports/:id/resolve
const resolveReport = async (req, res) => {
  const { status, action } = req.body;
  if (!['reviewed', 'dismissed'].includes(status))
    return res.status(400).json({ message: 'Status must be reviewed or dismissed.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM reports WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Report not found.' });
    const report = rows[0];

    await client.query(
      `UPDATE reports SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3`,
      [status, req.user.id, req.params.id]
    );

    if (action === 'remove_pet'  && report.pet_id)  await client.query(`UPDATE pets  SET status='withdrawn' WHERE id=$1`, [report.pet_id]);
    if (action === 'remove_blog' && report.blog_id) await client.query(`UPDATE blogs SET status='archived'  WHERE id=$1`, [report.blog_id]);
    if (action === 'suspend_reporter') {
      await client.query(
        `UPDATE users SET is_suspended=TRUE, suspended_at=NOW(), suspend_reason='Reported content violation'
         WHERE id=$1`,
        [report.reporter_id]
      );
    }

    await client.query('COMMIT');

    await audit({ adminId: req.user.id, action: 'resolve_report', targetType: 'report', targetId: +req.params.id,
      detail: `${status}. Action: ${action || 'none'}`, ip: getIp(req) });

    res.json({ message: 'Report resolved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};
// PATCH /api/admin/users/:id/trust
const trustUser = async (req, res) => {
  const { note } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET is_trusted=TRUE, trusted_at=NOW(), trusted_note=$1
       WHERE id=$2
       RETURNING id, name, email, is_trusted`,
      [note || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await audit({
      adminId: req.user.id, action: 'trust_user',
      targetType: 'user', targetId: +req.params.id,
      detail: `Marked ${rows[0].email} as trusted owner. Note: ${note || 'none'}`,
      ip: getIp(req),
    });

    res.json({ message: 'User marked as trusted owner.', user: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/admin/users/:id/untrust
const untrustUser = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET is_trusted=FALSE, trusted_at=NULL, trusted_note=NULL
       WHERE id=$1
       RETURNING id, name, email`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await audit({
      adminId: req.user.id, action: 'untrust_user',
      targetType: 'user', targetId: +req.params.id,
      detail: `Removed trusted status from ${rows[0].email}`,
      ip: getIp(req),
    });

    res.json({ message: 'Trusted status removed.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = {
  getDashboardStats,
  listUsers, getUser, updateUserRole, suspendUser, unsuspendUser, deleteUser,
  listAllPets, deletePet, updatePetStatus,
  listAllBlogs, deleteBlog, updateBlogStatus,
  listAllAdoptions, closeAdoption,
  listAllFollowups, listAllHealthLogs,
  getAuditLog,
  listReports, resolveReport,
  trustUser, untrustUser,
};
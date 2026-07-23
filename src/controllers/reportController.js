const pool = require('../db/pool');

const REASONS = ['spam', 'abuse', 'misleading', 'inappropriate', 'animal_welfare', 'harassment', 'other'];

// POST /api/reports
const submitReport = async (req, res) => {
  const { pet_id, blog_id, reported_user_id, reason, details } = req.body;

  const targets = [pet_id, blog_id, reported_user_id].filter(Boolean);
  if (targets.length === 0) return res.status(400).json({ message: 'A target (pet, blog, or user) is required.' });
  if (targets.length > 1) return res.status(400).json({ message: 'Report only one target at a time.' });
  if (!REASONS.includes(reason)) return res.status(400).json({ message: `Reason must be one of: ${REASONS.join(', ')}` });

  try {
    const existing = await pool.query(
      `SELECT id FROM reports WHERE reporter_id=$1 AND (pet_id=$2 OR blog_id=$3 OR reported_user_id=$4) AND status='pending'`,
      [req.user.id, pet_id || null, blog_id || null, reported_user_id || null]
    );
    if (existing.rows.length) return res.status(409).json({ message: 'You already have a pending report for this.' });

    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_id, pet_id, blog_id, reported_user_id, reason, details)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, pet_id || null, blog_id || null, reported_user_id || null, reason, details || null]
    );

    res.status(201).json({ message: 'Report submitted. Our team will review it.', report: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};
// GET /api/reports  — admin: view all pending reports
const listReports = async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT r.*, 
              u.name AS reporter_name,
              p.name AS pet_name, 
              b.title AS blog_title,
              ru.name AS reported_user_name
       FROM reports r
       JOIN users u ON u.id=r.reporter_id
       LEFT JOIN pets p  ON p.id=r.pet_id
       LEFT JOIN blogs b ON b.id=r.blog_id
       LEFT JOIN users ru ON ru.id=r.reported_user_id
       WHERE r.status=$1
       ORDER BY r.created_at ASC`,
      [status]
    );
    res.json({ reports: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};
// PATCH /api/reports/:id — admin: resolve report
const resolveReport = async (req, res) => {
  const { status, action, admin_message } = req.body;
  // action: 'remove_pet' | 'remove_blog' | 'suspend_user' | 'warn_user' | null
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

    if (action === 'remove_pet' && report.pet_id) {
      await client.query(`UPDATE pets SET status='withdrawn' WHERE id=$1`, [report.pet_id]);
    }
    if (action === 'remove_blog' && report.blog_id) {
      await client.query(`UPDATE blogs SET status='archived' WHERE id=$1`, [report.blog_id]);
    }
    
    // Action: Warn User Only (No Ban)
    if (action === 'warn_user' && report.reported_user_id) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1, 'account_warning', 'အကောင့် သတိပေးချက်', $2)`,
        [report.reported_user_id, admin_message || 'ကျေးဇူးပြု၍ စည်းမျဉ်းများကို လိုက်နာပါ။']
      );
    }

    // Action: Suspend User (Ban + Notify)
    if (action === 'suspend_user' && report.reported_user_id) {
      await client.query(
        `UPDATE users SET is_suspended=TRUE, suspended_at=NOW(), suspend_reason=$1 WHERE id=$2`,
        [admin_message || 'Suspended due to community guideline violation.', report.reported_user_id]
      );

      await client.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1, 'account_suspended', 'အကောင့် ဆိုင်းငံ့ထားခြင်း', $2)`,
        [report.reported_user_id, admin_message || 'သင်၏ အကောင့်ကို စည်းမျဉ်းချိုးဖောက်မှုကြောင့် ဆိုင်းငံ့ထားပါသည်။']
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Report resolved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error.', error: err.message });
  } finally { client.release(); }
};
module.exports = { submitReport, listReports, resolveReport };
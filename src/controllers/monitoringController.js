const pool    = require('../db/pool');
const welfare = require('../services/welfare');
const notify  = require('../services/notify'); // Make sure to import notify at the top

// ── ADOPTER: My adopted pets with monitoring status ───────────
// GET /api/monitoring/my-adoptions
const myAdoptions = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ar.id AS adoption_request_id,
         ar.status,
         ar.monitoring_status,
         ar.monitoring_started_at,
         ar.monitoring_completed_at,
         ar.welfare_score,
         ar.reviewed_at AS adopted_at,
         p.id AS pet_id,
         p.name AS pet_name,
         p.birth_date,
         p.is_sure,
         p.breed,
         p.color,
         p.fee_type,
         pt.name AS pet_type_name,
         owner.name AS owner_name,
         owner.phone AS owner_phone,
         (SELECT url FROM pet_images WHERE pet_id=p.id AND is_primary=TRUE LIMIT 1) AS primary_image,
         -- check-ins
         (SELECT json_agg(mc ORDER BY mc.due_at)
          FROM monitoring_checkins mc
          WHERE mc.adoption_request_id = ar.id) AS checkins,
         -- latest followup
         (SELECT row_to_json(f) FROM (
           SELECT id, health_status, weight_kg, notes, image_url, created_at
           FROM adoption_followups
           WHERE adoption_request_id = ar.id
           ORDER BY created_at DESC LIMIT 1
         ) f) AS latest_followup,
         -- unresolved flags
         (SELECT COUNT(*) FROM welfare_flags
          WHERE adoption_request_id = ar.id AND resolved = FALSE) AS open_flags
       FROM adoption_requests ar
       JOIN pets p  ON p.id  = ar.pet_id
       JOIN pet_types pt ON pt.id = p.pet_type_id
       JOIN users owner ON owner.id = p.owner_id
       WHERE ar.requester_id = $1
         AND ar.status = 'approved'
       ORDER BY ar.reviewed_at DESC`,
      [req.user.id]
    );
    res.json({ adoptions: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── OWNER: Pets I rehomed with their monitoring status ────────
// GET /api/monitoring/rehomed
const myRehomed = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ar.id AS adoption_request_id,
         ar.status,
         ar.monitoring_status,
         ar.welfare_score,
         ar.reviewed_at AS adopted_at,
         ar.monitoring_started_at,
         ar.monitoring_completed_at,
         p.id AS pet_id,
         p.name AS pet_name,
         p.breed,
         pt.name AS pet_type_name,
         adopter.name AS adopter_name,
         adopter.email AS adopter_email,
         adopter.phone AS adopter_phone,
         (SELECT url FROM pet_images WHERE pet_id=p.id AND is_primary=TRUE LIMIT 1) AS primary_image,
         -- followup count
         (SELECT COUNT(*) FROM adoption_followups
          WHERE adoption_request_id = ar.id) AS followup_count,
         -- latest followup
         (SELECT row_to_json(f) FROM (
           SELECT id, health_status, weight_kg, notes, image_url, created_at
           FROM adoption_followups
           WHERE adoption_request_id = ar.id
           ORDER BY created_at DESC LIMIT 1
         ) f) AS latest_followup,
         -- check-ins
         (SELECT json_agg(mc ORDER BY mc.due_at)
          FROM monitoring_checkins mc
          WHERE mc.adoption_request_id = ar.id) AS checkins,
         -- open flags
         (SELECT COUNT(*) FROM welfare_flags
          WHERE adoption_request_id = ar.id AND resolved = FALSE) AS open_flags
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       JOIN pet_types pt ON pt.id = p.pet_type_id
       JOIN users adopter ON adopter.id = ar.requester_id
       WHERE p.owner_id = $1
         AND ar.status = 'approved'
       ORDER BY ar.reviewed_at DESC`,
      [req.user.id]
    );
    res.json({ rehomed: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── GET: Full timeline for an adoption ───────────────────────
// GET /api/monitoring/timeline/:adoptionRequestId
const getTimeline = async (req, res) => {
  const arId = req.params.adoptionRequestId;
  try {
    // verify access
    const { rows: ar } = await pool.query(
      `SELECT ar.requester_id, p.owner_id, ar.status,
              ar.monitoring_status, ar.welfare_score,
              ar.monitoring_started_at, ar.monitoring_completed_at,
              ar.reviewed_at AS adopted_at,
              p.id AS pet_id, p.name AS pet_name,
              p.birth_date, p.is_sure, p.breed, p.color,
              pt.name AS pet_type_name,
              owner.name   AS owner_name,
              adopter.name AS adopter_name
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       JOIN pet_types pt ON pt.id = p.pet_type_id
       JOIN users owner   ON owner.id = p.owner_id
       JOIN users adopter ON adopter.id = ar.requester_id
       WHERE ar.id = $1`,
      [arId]
    );
    if (!ar.length) return res.status(404).json({ message: 'Not found.' });

    const adoption = ar[0];
    const isOwner   = adoption.owner_id    === req.user.id;
    const isAdopter = adoption.requester_id === req.user.id;
    const isAdmin   = req.user.role === 'admin';
    if (!isOwner && !isAdopter && !isAdmin)
      return res.status(403).json({ message: 'Not authorized.' });

    // check-ins
    const { rows: checkins } = await pool.query(
      `SELECT mc.*, af.health_status, af.notes, af.image_url, af.created_at AS submitted_at_detail
       FROM monitoring_checkins mc
       LEFT JOIN adoption_followups af ON af.id = mc.followup_id
       WHERE mc.adoption_request_id = $1
       ORDER BY mc.due_at ASC`,
      [arId]
    );

    // all follow-ups
    const { rows: followups } = await pool.query(
      `SELECT af.*, u.name AS submitted_by_name
       FROM adoption_followups af
       JOIN users u ON u.id = af.submitted_by
       WHERE af.adoption_request_id = $1
       ORDER BY af.created_at ASC`,
      [arId]
    );

    // health logs for this pet
    const { rows: healthLogs } = await pool.query(
      `SELECT hl.*, u.name AS logged_by_name
       FROM pet_health_logs hl
       JOIN users u ON u.id = hl.logged_by
       WHERE hl.pet_id = $1
       ORDER BY hl.created_at ASC`,
      [adoption.pet_id]
    );

    // welfare flags
    const { rows: flags } = await pool.query(
      `SELECT wf.*, u.name AS resolved_by_name
       FROM welfare_flags wf
       LEFT JOIN users u ON u.id = wf.resolved_by
       WHERE wf.adoption_request_id = $1
       ORDER BY wf.created_at ASC`,
      [arId]
    );

    res.json({
      adoption,
      checkins,
      followups,
      healthLogs,
      flags,
    });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── POST: Submit follow-up (links to check-in) ───────────────
// POST /api/monitoring/followups/:adoptionRequestId
const submitFollowup = async (req, res) => {
  const { health_status = 'good', weight_kg, notes, checkin_type } = req.body;
  const image_url = req.file ? `/uploads/pets/${req.file.filename}` : null;

  if (!['good', 'fair', 'poor'].includes(health_status))
    return res.status(400).json({ message: 'health_status must be good, fair, or poor.' });

  const arId = req.params.adoptionRequestId;

  try {
    // verify access (Added p.name AS pet_name to the query)
    const { rows: ar } = await pool.query(
      `SELECT ar.requester_id, p.owner_id, ar.monitoring_status, ar.pet_id, p.name AS pet_name
       FROM adoption_requests ar JOIN pets p ON p.id=ar.pet_id
       WHERE ar.id=$1 AND ar.status='approved'`,
      [arId]
    );
    if (!ar.length) return res.status(404).json({ message: 'Approved adoption not found.' });

    const adoption = ar[0];
    const isOwner   = adoption.owner_id    === req.user.id;
    const isAdopter = adoption.requester_id === req.user.id;
    const isAdmin   = req.user.role === 'admin';
    if (!isOwner && !isAdopter && !isAdmin)
      return res.status(403).json({ message: 'Not authorized.' });

    // insert follow-up
    const { rows: fu } = await pool.query(
      `INSERT INTO adoption_followups
         (adoption_request_id, submitted_by, health_status, weight_kg, notes, image_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [arId, req.user.id, health_status, weight_kg || null, notes || null, image_url]
    );
    const followup = fu[0];

    // link to check-in if checkin_type provided or auto-detect next due
    let linkedCheckin = null;
    if (checkin_type) {
      const { rows: ci } = await pool.query(
        `UPDATE monitoring_checkins
         SET submitted_at=NOW(), followup_id=$1
         WHERE adoption_request_id=$2 AND checkin_type=$3 AND submitted_at IS NULL
         RETURNING *`,
        [followup.id, arId, checkin_type]
      );
      linkedCheckin = ci[0] || null;
    } else {
      // auto-link to next overdue or upcoming check-in
      const { rows: ci } = await pool.query(
        `UPDATE monitoring_checkins
         SET submitted_at=NOW(), followup_id=$1
         WHERE id = (
           SELECT id FROM monitoring_checkins
           WHERE adoption_request_id=$2 AND submitted_at IS NULL
           ORDER BY due_at ASC LIMIT 1
         )
         RETURNING *`,
        [followup.id, arId]
      );
      linkedCheckin = ci[0] || null;
    }

    // update welfare score
    const score = await welfare.updateWelfareScore(arId);

    // raise flag if poor
    if (health_status === 'poor') {
      await welfare.raiseFlag(arId, adoption.pet_id, 'poor_health',
        `သင့်အိမ်မွေးတိရစ္ဆာန် ကျန်းမာရေး အခြေအနေ ညံ့ဖျင်းနေသည်ကို ကြားရသဖြင့် အလွန်စိတ်မကောင်းပါ။ ကျေးဇူးပြု၍ မွေးစားသူနှင့် စကားပြောဆိုပြီး အကြံပြုချက်များပေးရန် (သို့မဟုတ်) ငွေပြန်လည်ပေးချေရန် ဆွေးနွေးကြည့်ပါ။ (မှတ်စု - ${notes || 'မရှိပါ'})`
      );
    }

    // check if monitoring is now complete
    const completed = await welfare.checkMonitoringComplete(arId);

    // ───────────────────────────────────────────────────────────
    // SEND NOTIFICATION & EMAIL TO OWNER
    // ───────────────────────────────────────────────────────────
    try {
      const ownerId = adoption.owner_id;
      const petName = adoption.pet_name;

      // 1. In-App Notification
      notify(ownerId, {
        type: 'followup_submitted',
        title: 'မွေးစားပြီးနောက် နောက်ဆက်တွဲ တင်သွင်းထားသည်',
        body: `${petName} အတွက် မွေးစားသူမှ နောက်ဆက်တွဲ တင်သွင်းထားပါသည်။ ကျန်းမာရေးအခြေအနေ: ${health_status || 'မှတ်ပါထားခြင်းမရှိပါ'}`,
        link: `/pages/adoption-requests.html?tab=received`,
      });

      // 2. Email Notification
      // const { send } = require('../services/email');
      const { rows: ownerRows } = await pool.query('SELECT name, email FROM users WHERE id=$1', [ownerId]);
      
      // if (ownerRows.length > 0) {
      //   const subject = `${petName} အတွက် နောက်ဆက်တွဲ တင်သွင်းထားပါသည်`;
      //   const html = `
      //     <p>မင်္ဂလာပါ ${ownerRows[0].name}၊</p>
      //     <p>${petName} ကို မွေးစားထားသူမှ နောက်ဆက်တွဲ အသစ် တင်သွင်းထားပါသည်။</p>
      //     <p><strong>ကျန်းမာရေးအခြေအနေ:</strong> ${health_status || '-'}</p>
      //     <p><strong>ကိုယ်အလေးချိန်:</strong> ${weight_kg || '-'} kg</p>
      //     <p><strong>မှတ်စုများ:</strong> ${notes || '-'}</p>
      //     ${image_url ? `<p><img src="${req.protocol}://${req.get('host')}${image_url}" style="max-width:300px;border-radius:8px;"></p>` : ''}
      //     <p>အသေးစိတ်ကြည့်ရန် ဝက်ဘ်ဆိုက်တွင် ဝင်ရောက်ကြည့်ရှုပါ။</p>
      //   `;
      //   await send(ownerRows[0].email, subject, html);
      // }
    } catch (notifErr) {
      console.error('Owner notification failed (non-fatal):', notifErr.message);
    }
    // ───────────────────────────────────────────────────────────

    res.status(201).json({
      message: 'Follow-up submitted.',
      followup,
      linkedCheckin,
      welfareScore: score,
      monitoringComplete: completed,
    });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── GET: Follow-ups for an adoption ──────────────────────────
// GET /api/monitoring/followups/:adoptionRequestId
const getFollowups = async (req, res) => {
  const arId = req.params.adoptionRequestId;
  try {
    const { rows: ar } = await pool.query(
      `SELECT ar.requester_id, p.owner_id
       FROM adoption_requests ar JOIN pets p ON p.id=ar.pet_id WHERE ar.id=$1`,
      [arId]
    );
    if (!ar.length) return res.status(404).json({ message: 'Not found.' });

    const isOwner   = ar[0].owner_id    === req.user?.id;
    const isAdopter = ar[0].requester_id === req.user?.id;
    const isAdmin   = req.user?.role === 'admin';
    if (!isOwner && !isAdopter && !isAdmin)
      return res.status(403).json({ message: 'Follow-ups are private.' });

    const { rows } = await pool.query(
      `SELECT af.*, u.name AS submitted_by_name, u.avatar_url AS submitted_by_avatar
       FROM adoption_followups af
       JOIN users u ON u.id=af.submitted_by
       WHERE af.adoption_request_id=$1
       ORDER BY af.created_at DESC`,
      [arId]
    );
    res.json({ followups: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Health logs ───────────────────────────────────────────────
const addHealthLog = async (req, res) => {
  const { type, description, vet_name, weight_kg, next_due } = req.body;
  if (!type) return res.status(400).json({ message: 'Type is required.' });
  try {
    const { rows: petRows } = await pool.query(
      'SELECT owner_id FROM pets WHERE id=$1', [req.params.petId]
    );
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found.' });
    if (petRows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });

    const { rows } = await pool.query(
      `INSERT INTO pet_health_logs
         (pet_id, logged_by, type, description, vet_name, weight_kg, next_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.petId, req.user.id, type,
       description || null, vet_name || null, weight_kg || null, next_due || null]
    );
    res.status(201).json({ log: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// const getHealthLogs = async (req, res) => {
//   try {
//     const { rows: petRows } = await pool.query(
//       'SELECT owner_id FROM pets WHERE id=$1', [req.params.petId]
//     );
//     if (!petRows.length) return res.status(404).json({ message: 'Pet not found.' });
//     if (petRows[0].owner_id !== req.user?.id && req.user?.role !== 'admin')
//       return res.status(403).json({ message: 'Health logs are private.' });

//     const { rows } = await pool.query(
//       `SELECT hl.*, u.name AS logged_by_name
//        FROM pet_health_logs hl JOIN users u ON u.id=hl.logged_by
//        WHERE hl.pet_id=$1 ORDER BY hl.created_at DESC`,
//       [req.params.petId]
//     );
//     res.json({ logs: rows });
//   } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
// };

// ── Health logs ───────────────────────────────────────────────
const getHealthLogs = async (req, res) => {
  try {
    // Update the query to also check if the current user is an approved adopter
    const { rows: petRows } = await pool.query(
      `SELECT p.owner_id, 
              (SELECT COUNT(*) FROM adoption_requests ar 
               WHERE ar.pet_id = p.id 
                 AND ar.requester_id = $2 
                 AND ar.status = 'approved') AS approved_adopter_count
       FROM pets p WHERE p.id = $1`, 
      [req.params.petId, req.user.id]
    );

    if (!petRows.length) return res.status(404).json({ message: 'Pet not found.' });

    const isOwner = petRows[0].owner_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isApprovedAdopter = parseInt(petRows[0].approved_adopter_count) > 0;

    // If they are none of the above, block access
    if (!isOwner && !isAdmin && !isApprovedAdopter)
      return res.status(403).json({ message: 'Health logs are private.' });

    // Fetch the logs
    const { rows } = await pool.query(
      `SELECT hl.*, u.name AS logged_by_name
       FROM pet_health_logs hl 
       JOIN users u ON u.id = hl.logged_by
       WHERE hl.pet_id = $1 
       ORDER BY hl.created_at DESC`,
      [req.params.petId]
    );
    res.json({ logs: rows });
  } catch (err) { 
    res.status(500).json({ message: 'Server error.', error: err.message }); 
  }
};

const deleteHealthLog = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT hl.logged_by, p.owner_id
       FROM pet_health_logs hl JOIN pets p ON p.id=hl.pet_id WHERE hl.id=$1`,
      [req.params.logId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Log not found.' });
    if (rows[0].logged_by !== req.user.id && rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized.' });
    await pool.query('DELETE FROM pet_health_logs WHERE id=$1', [req.params.logId]);
    res.json({ message: 'Log deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Admin: resolve welfare flag ───────────────────────────────
// PATCH /api/monitoring/flags/:flagId/resolve
const resolveFlag = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE welfare_flags
       SET resolved=TRUE, resolved_by=$1, resolved_at=NOW()
       WHERE id=$2
       RETURNING *`,
      [req.user.id, req.params.flagId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Flag not found.' });

    // check if any flags still open — if not, restore monitoring status
    const { rows: open } = await pool.query(
      `SELECT COUNT(*) FROM welfare_flags
       WHERE adoption_request_id=$1 AND resolved=FALSE`,
      [rows[0].adoption_request_id]
    );
    if (parseInt(open[0].count) === 0) {
      await pool.query(
        `UPDATE adoption_requests SET monitoring_status='active'
         WHERE id=$1 AND monitoring_status='flagged'`,
        [rows[0].adoption_request_id]
      );
    }

    res.json({ message: 'Flag resolved.', flag: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// ── Admin: all active flags ───────────────────────────────────
// GET /api/monitoring/flags
const listFlags = async (req, res) => {
  const { resolved = 'false' } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT wf.*, p.name AS pet_name,
              adopter.name AS adopter_name, adopter.email AS adopter_email,
              owner.name AS owner_name
       FROM welfare_flags wf
       JOIN pets p ON p.id = wf.pet_id
       JOIN adoption_requests ar ON ar.id = wf.adoption_request_id
       JOIN users adopter ON adopter.id = ar.requester_id
       JOIN users owner   ON owner.id   = p.owner_id
       WHERE wf.resolved = $1
       ORDER BY wf.created_at DESC`,
      [resolved === 'true']
    );
    res.json({ flags: rows });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = {
  myAdoptions,
  myRehomed,
  getTimeline,
  submitFollowup,
  getFollowups,
  addHealthLog,
  getHealthLogs,
  deleteHealthLog,
  resolveFlag,
  listFlags,
};
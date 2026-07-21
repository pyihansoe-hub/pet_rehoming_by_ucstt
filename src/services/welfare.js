/**
 * Welfare scoring and flag management.
 * Import and call these from monitoringController and adoptionController.
 */

const pool = require('../db/pool');
const notify = require('./notify');
// REMOVED: const { send } = require('./email');

// ── Welfare score calculator ──────────────────────────────────
/**
 * Calculates welfare score from follow-ups for an adoption request.
 * Returns: 'excellent' | 'good' | 'fair' | 'needs_attention' | 'no_updates'
 */
const calcWelfareScore = async (adoptionRequestId) => {
  const { rows } = await pool.query(
    `SELECT health_status, created_at
     FROM adoption_followups
     WHERE adoption_request_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [adoptionRequestId]
  );

  if (!rows.length) return 'no_updates';

  const latest = rows[0].health_status;
  if (latest === 'poor') return 'needs_attention';

  const hasAnypoor = rows.some(r => r.health_status === 'poor');
  if (hasAnypoor) return 'fair';

  const allGood = rows.every(r => r.health_status === 'good');
  if (allGood && rows.length >= 2) return 'excellent';

  const anyFair = rows.some(r => r.health_status === 'fair');
  if (anyFair) return 'fair';

  return 'good';
};

// ── Update welfare score in DB ────────────────────────────────
const updateWelfareScore = async (adoptionRequestId) => {
  const score = await calcWelfareScore(adoptionRequestId);
  await pool.query(
    'UPDATE adoption_requests SET welfare_score=$1 WHERE id=$2',
    [score, adoptionRequestId]
  );
  return score;
};

// ── Seed check-in schedule after adoption completes ──────────
const seedCheckins = async (adoptionRequestId, startDate) => {
  const start = startDate || new Date();
  const schedule = [
    { type: 'week1',  days: 7  },
    { type: 'month1', days: 30 },
    { type: 'month3', days: 90 },
  ];

  for (const s of schedule) {
    const dueAt = new Date(start.getTime() + s.days * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO monitoring_checkins (adoption_request_id, checkin_type, due_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (adoption_request_id, checkin_type) DO NOTHING`,
      [adoptionRequestId, s.type, dueAt]
    );
  }

  // set monitoring to active
  await pool.query(
    `UPDATE adoption_requests
     SET monitoring_status='active', monitoring_started_at=NOW()
     WHERE id=$1`,
    [adoptionRequestId]
  );
};

// ── Raise a welfare flag ──────────────────────────────────────
const raiseFlag = async (adoptionRequestId, petId, flagType, detail) => {
  
  // 1. Notify owner FIRST (so it always sends, even if flag already exists)
  try {
    const { rows } = await pool.query(
      `SELECT p.name AS pet_name, p.owner_id
       FROM adoption_requests ar
       JOIN pets p ON p.id = ar.pet_id
       WHERE ar.id = $1`,
      [adoptionRequestId]
    );
    if (rows.length) {
      const d = rows[0];
      notify(d.owner_id, {
        type:  'welfare_flag',
        title: `⚠️ ${d.pet_name} အတွက် သတိပြုဖွယ် အခြေအနေရှိပါသည်`,
        body:  `အကြောင်းပြချက်: ${flagType.replace(/_/g, ' ')}`,
        link:  `/pages/rehomed-pets.html`,
      });
    }
  } catch(e) {
    console.error('Flag notification failed (non-fatal):', e.message);
  }

  // 2. Check if same flag already open
  const existing = await pool.query(
    `SELECT id FROM welfare_flags
     WHERE adoption_request_id=$1 AND flag_type=$2 AND resolved=FALSE`,
    [adoptionRequestId, flagType]
  );
  if (existing.rows.length) return; // already flagged, don't insert duplicate in DB

  // 3. Insert flag into DB
  await pool.query(
    `INSERT INTO welfare_flags (adoption_request_id, pet_id, flag_type, detail)
     VALUES ($1,$2,$3,$4)`,
    [adoptionRequestId, petId, flagType, detail || null]
  );

  // 4. mark adoption as flagged
  await pool.query(
    `UPDATE adoption_requests SET monitoring_status='flagged' WHERE id=$1`,
    [adoptionRequestId]
  );
};

// ── Check if monitoring is complete ──────────────────────────
const checkMonitoringComplete = async (adoptionRequestId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(submitted_at) AS submitted
     FROM monitoring_checkins
     WHERE adoption_request_id = $1`,
    [adoptionRequestId]
  );
  if (!rows.length) return false;
  const { total, submitted } = rows[0];
  if (parseInt(submitted) >= parseInt(total) && parseInt(total) > 0) {
    await pool.query(
      `UPDATE adoption_requests
       SET monitoring_status='completed', monitoring_completed_at=NOW()
       WHERE id=$1 AND monitoring_status != 'flagged'`,
      [adoptionRequestId]
    );
    return true;
  }
  return false;
};

// ── Process overdue check-ins (run on scheduler) ──────────────
const processOverdueCheckins = async () => {
  try {
    const { rows: overdue } = await pool.query(
      `SELECT mc.*, ar.pet_id,
              p.name AS pet_name,
              adopter.name AS adopter_name
       FROM monitoring_checkins mc
       JOIN adoption_requests ar ON ar.id = mc.adoption_request_id
       JOIN pets p ON p.id = ar.pet_id
       JOIN users adopter ON adopter.id = ar.requester_id
       WHERE mc.submitted_at IS NULL
         AND mc.due_at < NOW()
         AND mc.is_overdue = FALSE
         AND ar.monitoring_status = 'active'`
    );

    for (const c of overdue) {
      // mark overdue
      await pool.query(
        'UPDATE monitoring_checkins SET is_overdue=TRUE WHERE id=$1',
        [c.id]
      );

      // raise welfare flag (this will now send the in-app notification automatically)
      await raiseFlag(
        c.adoption_request_id,
        c.pet_id,
        'missed_checkin',
        `${c.checkin_type} check-in was due on ${new Date(c.due_at).toLocaleDateString()}`
      );

      // REMOVED: email sending code block from here

      console.log(`⚠️ Overdue flag raised: ${c.pet_name} — ${c.checkin_type}`);
    }

    if (overdue.length) console.log(`Processed ${overdue.length} overdue check-in(s).`);
  } catch(e) {
    console.error('processOverdueCheckins error:', e.message);
  }
};

module.exports = {
  calcWelfareScore,
  updateWelfareScore,
  seedCheckins,
  raiseFlag,
  checkMonitoringComplete,
  processOverdueCheckins,
};
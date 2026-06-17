const pool = require('../db/pool');

/**
 * Log an admin action to the audit trail.
 * Call this after any significant admin operation.
 *
 * @param {object} opts
 * @param {number}  opts.adminId     - ID of the admin performing the action
 * @param {string}  opts.action      - e.g. 'suspend_user', 'delete_pet', 'close_adoption'
 * @param {string}  [opts.targetType] - 'user' | 'pet' | 'blog' | 'adoption' | 'report' | 'payment'
 * @param {number}  [opts.targetId]  - ID of the affected record
 * @param {string}  [opts.detail]    - human-readable description
 * @param {string}  [opts.ip]        - request IP address
 */
const audit = async ({ adminId, action, targetType = null, targetId = null, detail = null, ip = null }) => {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, detail, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, action, targetType, targetId, detail, ip]
    );
  } catch (err) {
    // never let audit failure break the actual operation
    console.error('Audit log failed (non-fatal):', err.message);
  }
};

module.exports = audit;

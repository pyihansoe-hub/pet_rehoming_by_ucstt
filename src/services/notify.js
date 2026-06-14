const pool = require('../db/pool');

const notify = async (userId, { type, title, body = null, link = null }) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, type, title, body, link]
    );
  } catch (err) {
    console.error('Notification failed (non-fatal):', err.message);
  }
};

module.exports = notify;
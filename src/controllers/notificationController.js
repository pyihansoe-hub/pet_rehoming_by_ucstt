const pool = require('../db/pool');

// GET /api/notifications
const listNotifications = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unread });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1`, [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    await pool.query(`DELETE FROM notifications WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ message: 'Notification deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { listNotifications, markAllRead, markRead, deleteNotification };
const bcrypt = require('bcryptjs');
const path   = require('path');
const pool   = require('../db/pool');

const getProfile = (req, res) => res.json({ user: req.user });

const updateProfile = async (req, res) => {
  const { name, phone, address } = req.body;
  const avatar_url = req.file
    ? "/uploads/avatars/" + req.file.filename
    : undefined;

  const fields = [];
  const values = [];
  let i = 1;

  if (name)                  { fields.push(name + "=$" + i++);       values.push(name); }
  if (phone)                 { fields.push(phone + "=$" + i++);      values.push(phone); }
  if (address)               { fields.push(address + "=$" + i++);    values.push(address); }
  if (avatar_url !== undefined) { fields.push(avatar_url + "=$" + i++); values.push(avatar_url); }

  if (!fields.length) return res.status(400).json({ message: 'No fields to update.' });
  values.push(req.user.id);

  try {
    const { rows } = await pool.query(
      'UPDATE users SET ' + fields.join(',') + ' WHERE id=$' + i + ' RETURNING id, name, email, phone, address, avatar_url, updated_at',
      values
    );
    res.json({ message: 'Profile updated.', user: rows[0] });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required.' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password min 6 chars.' });
  try {
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, rows[0].password)))
      return res.status(401).json({ message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { res.status(500).json({ message: 'Server error.', error: err.message }); }
};

module.exports = { getProfile, updateProfile, changePassword };
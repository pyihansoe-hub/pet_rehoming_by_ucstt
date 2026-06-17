const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');

/**
 * Runs once on server start.
 * Creates the admin account from .env if it hasn't been seeded yet.
 * Tracks seeding in system_config so it never runs twice.
 */
const seedAdmin = async () => {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.log('ℹ️  No ADMIN_EMAIL/ADMIN_PASSWORD in .env — skipping admin seed.');
    return;
  }

  try {
    // check if already seeded
    const check = await pool.query(
      "SELECT value FROM system_config WHERE key='admin_seeded'"
    );
    if (check.rows.length && check.rows[0].value === 'true') {
      console.log('ℹ️  Admin already seeded — skipping.');
      return;
    }

    // check if user with that email already exists
    const existing = await pool.query(
      'SELECT id, role FROM users WHERE email=$1',
      [email.toLowerCase()]
    );

    if (existing.rows.length) {
      // user exists — just make them admin
      await pool.query(
        "UPDATE users SET role='admin' WHERE email=$1",
        [email.toLowerCase()]
      );
      console.log(`✅ Existing user ${email} promoted to admin.`);
    } else {
      // create fresh admin user
      const hashed = await bcrypt.hash(password, 12);
      await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'admin')`,
        [name, email.toLowerCase(), hashed]
      );
      console.log(`✅ Admin account created: ${email}`);
    }

    // mark as seeded so it never runs again
    await pool.query(
      `INSERT INTO system_config (key, value)
       VALUES ('admin_seeded', 'true')
       ON CONFLICT (key) DO UPDATE SET value='true', updated_at=NOW()`
    );
  } catch (err) {
    console.error('❌ Admin seed failed:', err.message);
  }
};

module.exports = seedAdmin;

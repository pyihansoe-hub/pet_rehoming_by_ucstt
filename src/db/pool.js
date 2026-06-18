const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

if (process.env.NODE_ENV !== 'test') {
  pool.on('connect', () => console.log('✅ PostgreSQL connected'));
  pool.on('error',   (err) => console.error('PostgreSQL error:', err.message));
}

module.exports = pool;

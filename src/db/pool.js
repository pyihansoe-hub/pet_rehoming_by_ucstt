const dns = require('dns');
// Force Node.js to use IPv4 instead of IPv6 (fixes local Myanmar ISP routing issues)
dns.setDefaultResultOrder('ipv4first');

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL 
    ? process.env.DATABASE_URL 
    : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error',   (err) => console.error('PostgreSQL error:', err.message));

module.exports = pool;
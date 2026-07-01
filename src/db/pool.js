// require('dotenv').config();
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});
const { Pool } = require('pg');

console.log({
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error',   (err) => console.error('PostgreSQL error:', err.message));

module.exports = pool;

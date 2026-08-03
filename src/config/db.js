// src/config/db.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env')});
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});


module.exports = {
  query: (text, params) => pool.query(text, params),
  getTransactionClient: async () => {
    const client = await pool.connect();
    return client;
  },
  pool,
};

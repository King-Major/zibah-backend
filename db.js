const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        // If DATABASE_URL exists (which it does on Render), use this:
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // CRITICAL: Render requires SSL for cloud connections
        }
      }
    : {
        // Otherwise, fall back to your local development variables:
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
require('dotenv').config();
const { pool, runMigrations } = require('../db');

(async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    await runMigrations();
  } catch (error) {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

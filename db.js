require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'lockhang-clinic',
});
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('lockhang-clinic-migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'))
      .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
      .sort();
    for (const file of migrationFiles) {
      const version = file.slice(0, -4);
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount > 0) continue;
      const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      console.log(`Applied database migration ${version}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email && !password && process.env.NODE_ENV !== 'production') {
    console.warn('Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first administrator.');
    return;
  }
  if (!email || !password) throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD before starting the application.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL is not a valid email address.');
  if (password.length < 12 || password.length > 128) throw new Error('ADMIN_PASSWORD must contain 12–128 characters.');

  const existing = await pool.query('SELECT id, role FROM clinic_accounts WHERE email = $1', [email]);
  if (existing.rowCount) {
    if (existing.rows[0].role !== 'admin') throw new Error('ADMIN_EMAIL belongs to a non-admin account. Choose a separate admin email.');
    return;
  }

  const bcrypt = require('bcryptjs');
  const id = require('crypto').randomUUID();
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO clinic_accounts (id, email, full_name, password_hash, role)
     VALUES ($1, $2, $3, $4, 'admin') ON CONFLICT (email) DO NOTHING`,
    [id, email, 'Quản trị viên Lộc Khang', hash],
  );
  console.log(`Created initial administrator account for ${email}`);
}

module.exports = { pool, runMigrations, bootstrapAdmin };

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const client = new Client({
    host: process.env.PG_HOST?.trim(),
    port: Number(process.env.PG_PORT ?? 5432),
    database: process.env.PG_DB?.trim(),
    user: process.env.PG_USER?.trim(),
    password: process.env.PG_PASSWORD?.trim(),
  });

  console.log(`[init-db] Connecting to ${process.env.PG_HOST?.trim()}:${process.env.PG_PORT ?? 5432}/${process.env.PG_DB?.trim()}...`);
  await client.connect();
  console.log('[init-db] Connected.');

  // ── users table ─────────────────────────────────────────────────────────────
  // CREATE TABLE is safe on existing table (IF NOT EXISTS).
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      uid           VARCHAR(100) UNIQUE NOT NULL,
      full_name     VARCHAR(255),
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns that may not exist on older installations.
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await client.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  );

  console.log('[init-db] users table ready.');

  // ── password_resets table ────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reset_token VARCHAR(255) UNIQUE NOT NULL,
      expires_at  TIMESTAMP NOT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('[init-db] password_resets table ready.');

  // ── seed default admin user ──────────────────────────────────────────────────
  const hash = bcrypt.hashSync('srim@2026', 10);
  const result = await client.query(
    `INSERT INTO users (uid, full_name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ['admin', 'SRIM Admin', 'admin@digibull.ai', hash],
  );

  if (result.rowCount > 0) {
    console.log('[init-db] Default admin user created.');
  } else {
    console.log('[init-db] Admin user already exists — skipped.');
  }

  console.log('\n✅ DB ready.\n   UID:      admin\n   Password: srim@2026\n');
  await client.end();
}

main().catch((e) => {
  console.error('[init-db] Failed:', e.message);
  process.exit(1);
});

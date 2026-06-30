import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { log } from '../logger.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PG_HOST ?? 'localhost',
      port: Number(process.env.PG_PORT ?? 5432),
      database: process.env.PG_DB ?? 'srim',
      user: process.env.PG_USER ?? 'postgres',
      password: process.env.PG_PASSWORD,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (err: Error) => {
      log.warn(`[PgAuth] Pool error: ${err.message}`);
    });
  }
  return pool;
}

interface PgUser {
  id: string;
  name: string;
  email: string;
}

type DbRow = {
  id: number;
  uid?: string;
  full_name?: string;
  email: string;
  password_hash: string;
  is_active?: boolean;
};

async function verifyRow(row: DbRow | undefined, password: string): Promise<PgUser | null> {
  if (!row) return null;
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;
  if (row.is_active === false) { throw new Error('Account inactive or disabled'); }
  return {
    id: String(row.id),
    name: row.full_name ?? row.uid ?? row.email,
    email: row.email,
  };
}

export async function pgLoginByUid(uid: string, password: string): Promise<PgUser | null> {
  const result = await getPool().query<DbRow>(
    'SELECT id, uid, full_name, email, password_hash, is_active FROM users WHERE uid = $1 LIMIT 1',
    [uid],
  );
  return verifyRow(result.rows[0], password);
}

export async function pgLoginByEmail(email: string, password: string): Promise<PgUser | null> {
  const result = await getPool().query<DbRow>(
    'SELECT id, uid, full_name, email, password_hash, is_active FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()],
  );
  return verifyRow(result.rows[0], password);
}

/**
 * Auto-detects whether `identifier` is an email (contains @) or a UID and
 * queries the appropriate column. Returns null if not found or wrong password.
 */
export async function pgLogin(identifier: string, password: string): Promise<PgUser | null> {
  if (!process.env.PG_HOST && !process.env.PG_DB) {
    log.warn('[PgAuth] PostgreSQL not configured (PG_HOST/PG_DB missing) — skipping pg auth');
    return null;
  }
  const isEmail = identifier.includes('@');
  return isEmail ? pgLoginByEmail(identifier, password) : pgLoginByUid(identifier, password);
}

export async function pgRegister(
  username: string,
  email: string,
  password: string,
): Promise<PgUser> {
  if (!process.env.PG_HOST && !process.env.PG_DB) {
    throw new Error('PostgreSQL not configured');
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await getPool().query<DbRow>(
      `INSERT INTO users (uid, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, uid, full_name, email`,
      [username, username, email, hash],
    );
    const row = result.rows[0]!;
    return {
      id: String(row.id),
      name: row.full_name ?? row.uid ?? row.email,
      email: row.email,
    };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === '23505') {
      const detail = (e as { detail?: string }).detail ?? '';
      if (/\(uid\)|\(username\)/i.test(detail)) { throw new Error('Username already taken'); }
      if (/\(email\)/i.test(detail)) { throw new Error('Email already registered'); }
      throw new Error('An account with this username or email already exists');
    }
    throw e;
  }
}

export async function pgForgotPassword(email: string): Promise<string | null> {
  if (!process.env.PG_HOST && !process.env.PG_DB) {
    throw new Error('PostgreSQL not configured');
  }
  // Look up user — return null silently if email not found (no enumeration)
  const userResult = await getPool().query<{ id: number }>(
    'SELECT id FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1',
    [email.toLowerCase()],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Remove any existing tokens for this user before inserting new one
  await getPool().query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
  await getPool().query(
    'INSERT INTO password_resets (user_id, reset_token, expires_at) VALUES ($1, $2, $3)',
    [user.id, token, expiresAt],
  );

  return token;
}

export async function pgResetPassword(token: string, newPassword: string): Promise<void> {
  if (!process.env.PG_HOST && !process.env.PG_DB) {
    throw new Error('PostgreSQL not configured');
  }
  const result = await getPool().query<{ user_id: number }>(
    'SELECT user_id FROM password_resets WHERE reset_token = $1 AND expires_at > NOW() LIMIT 1',
    [token],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Reset link is invalid or has expired');
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await getPool().query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    hash,
    row.user_id,
  ]);

  // One-time use — delete the token
  await getPool().query('DELETE FROM password_resets WHERE reset_token = $1', [token]);
}

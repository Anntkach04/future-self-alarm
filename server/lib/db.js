const fs = require('fs');
const path = require('path');

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const FILE_PATH = path.join(__dirname, '..', 'data', 'users.json');

/** @typedef {{ id: string, email: string|null, voiceId: string|null, profile: object, createdAt: string, updatedAt: string }} UserRow */

let pool = null;
let ready = false;

function nowIso() {
  return new Date().toISOString();
}

function ensureFileStore() {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({ users: {} }, null, 2));
  }
}

function readFileStore() {
  ensureFileStore();
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch {
    return { users: {} };
  }
}

function writeFileStore(data) {
  ensureFileStore();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

async function initDb() {
  if (ready) return;
  if (!DATABASE_URL) {
    ensureFileStore();
    ready = true;
    console.log('DB: file store (set DATABASE_URL for Postgres)');
    return;
  }

  const { Pool } = require('pg');
  const attempts = 5;
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      pool = new Pool({
        connectionString: DATABASE_URL,
        connectionTimeoutMillis: 5000,
        ssl:
          process.env.PGSSL === 'false'
            ? false
            : { rejectUnauthorized: false },
      });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT,
          voice_id TEXT,
          profile JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS contact_messages (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          topic TEXT,
          message TEXT NOT NULL
        );
      `);
      ready = true;
      console.log('DB: Postgres ready');
      return;
    } catch (error) {
      lastError = error;
      console.warn(`DB: Postgres attempt ${i}/${attempts} failed`);
      try {
        await pool?.end?.();
      } catch {
        // ignore
      }
      pool = null;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  }

  console.error(
    'DB: Postgres unavailable, falling back to file store',
    lastError?.message || lastError
  );
  ensureFileStore();
  ready = true;
}

function mapPg(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || null,
    voiceId: row.voice_id || null,
    profile: row.profile || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

/**
 * @param {string} appleSub
 * @param {{ email?: string|null }} [extras]
 * @returns {Promise<UserRow>}
 */
async function upsertUser(appleSub, extras = {}) {
  await initDb();
  const id = String(appleSub || '').trim();
  if (!id) throw Object.assign(new Error('Missing user id'), { status: 400 });

  if (!pool) {
    const store = readFileStore();
    const prev = store.users[id];
    const stamp = nowIso();
    const next = {
      id,
      email: extras.email ?? prev?.email ?? null,
      voiceId: prev?.voiceId ?? null,
      profile: prev?.profile || {},
      createdAt: prev?.createdAt || stamp,
      updatedAt: stamp,
    };
    store.users[id] = next;
    writeFileStore(store);
    return next;
  }

  const result = await pool.query(
    `
    INSERT INTO users (id, email)
    VALUES ($1, $2)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      updated_at = NOW()
    RETURNING *
    `,
    [id, extras.email || null]
  );
  return mapPg(result.rows[0]);
}

/** @param {string} id */
async function getUser(id) {
  await initDb();
  const key = String(id || '').trim();
  if (!key) return null;

  if (!pool) {
    return readFileStore().users[key] || null;
  }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [key]);
  return mapPg(result.rows[0]);
}

/**
 * @param {string} id
 * @param {{ voiceId?: string|null, profile?: object, email?: string|null }} patch
 */
async function updateUser(id, patch) {
  await initDb();
  const key = String(id || '').trim();
  if (!key) throw Object.assign(new Error('Missing user id'), { status: 400 });

  if (!pool) {
    const store = readFileStore();
    const prev = store.users[key];
    if (!prev) throw Object.assign(new Error('User not found'), { status: 404 });
    const next = {
      ...prev,
      voiceId:
        patch.voiceId !== undefined ? patch.voiceId : prev.voiceId,
      email: patch.email !== undefined ? patch.email : prev.email,
      profile:
        patch.profile !== undefined
          ? { ...prev.profile, ...patch.profile }
          : prev.profile,
      updatedAt: nowIso(),
    };
    store.users[key] = next;
    writeFileStore(store);
    return next;
  }

  const current = await getUser(key);
  if (!current) throw Object.assign(new Error('User not found'), { status: 404 });

  const voiceId =
    patch.voiceId !== undefined ? patch.voiceId : current.voiceId;
  const email = patch.email !== undefined ? patch.email : current.email;
  const profile =
    patch.profile !== undefined
      ? { ...current.profile, ...patch.profile }
      : current.profile;

  const result = await pool.query(
    `
    UPDATE users
    SET voice_id = $2, email = $3, profile = $4::jsonb, updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [key, voiceId, email, JSON.stringify(profile)]
  );
  return mapPg(result.rows[0]);
}

/** Permanently remove a user row (App Store account-deletion). */
async function deleteUser(id) {
  await initDb();
  const key = String(id || '').trim();
  if (!key) throw Object.assign(new Error('Missing user id'), { status: 400 });

  if (!pool) {
    const store = readFileStore();
    if (!store.users[key]) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const removed = store.users[key];
    delete store.users[key];
    writeFileStore(store);
    return removed;
  }

  const result = await pool.query(
    'DELETE FROM users WHERE id = $1 RETURNING *',
    [key]
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  return mapPg(result.rows[0]);
}

/**
 * Contact form rows. Postgres when available (Railway disk is wiped on every
 * deploy); file store only for local dev.
 * @param {{ id: string, createdAt: string, name: string, email: string, topic: string, message: string }} row
 */
async function insertContactMessage(row) {
  await initDb();
  if (!pool) {
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'contact-messages.jsonl'),
      `${JSON.stringify(row)}\n`,
      'utf8'
    );
    return row;
  }
  await pool.query(
    `INSERT INTO contact_messages (id, created_at, name, email, topic, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [row.id, row.createdAt, row.name, row.email, row.topic, row.message]
  );
  return row;
}

/**
 * Guest sessions older than `olderThanMs` (onboarding abandoned or replaced by
 * Sign in with Apple before voice adoption existed).
 * @returns {Promise<UserRow[]>}
 */
async function listStaleGuests(olderThanMs, limit = 200) {
  await initDb();
  const cutoff = new Date(Date.now() - olderThanMs);
  if (!pool) {
    return Object.values(readFileStore().users)
      .filter(
        (u) =>
          String(u.id).startsWith('guest_') &&
          new Date(u.updatedAt || u.createdAt) < cutoff
      )
      .slice(0, limit);
  }
  const result = await pool.query(
    `SELECT * FROM users WHERE id LIKE 'guest\\_%' AND updated_at < $1
     ORDER BY updated_at ASC LIMIT $2`,
    [cutoff.toISOString(), limit]
  );
  return result.rows.map(mapPg);
}

function dbMode() {
  return DATABASE_URL ? 'postgres' : 'file';
}

module.exports = {
  initDb,
  upsertUser,
  getUser,
  updateUser,
  deleteUser,
  insertContactMessage,
  listStaleGuests,
  dbMode,
};

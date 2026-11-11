// Работа с базой D1 (SQLite).

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    tg_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_participant INTEGER NOT NULL DEFAULT 0,
    registered INTEGER NOT NULL DEFAULT 0,
    wishlist TEXT NOT NULL DEFAULT '',
    wishlist_updated_at INTEGER NOT NULL DEFAULT 0,
    notify_mode TEXT NOT NULL DEFAULT 'sound',
    pending TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS exclusions (
    giver INTEGER NOT NULL,
    receiver INTEGER NOT NULL,
    PRIMARY KEY (giver, receiver)
  )`,
  `CREATE TABLE IF NOT EXISTS pairs (
    santa INTEGER PRIMARY KEY,
    ward INTEGER NOT NULL UNIQUE,
    seen_text TEXT,
    notified_at INTEGER NOT NULL DEFAULT 0,
    gift_ready INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS history (
    santa INTEGER NOT NULL,
    ward INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santa INTEGER NOT NULL,
    ward INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS messages_pair ON messages (santa, ward, id)`,
  `CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
];

let schemaReady = false;

export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}

// ---------- settings ----------

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const r of results) s[r.key] = r.value;
  return s;
}

export function setSettingStmt(db, key, value) {
  return db
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value ?? ''));
}

export async function setSettings(db, obj) {
  const stmts = Object.entries(obj).map(([k, v]) => setSettingStmt(db, k, v));
  if (stmts.length) await db.batch(stmts);
}

// ---------- users ----------

export async function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE tg_id = ?').bind(id).first();
}

export async function allUsers(db) {
  const { results } = await db.prepare('SELECT * FROM users ORDER BY created_at').all();
  return results;
}

export async function createUser(db, id, username, fields = {}) {
  await db
    .prepare(
      `INSERT INTO users (tg_id, username, created_at, is_admin, pending)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tg_id) DO NOTHING`
    )
    .bind(id, username || '', Date.now(), fields.is_admin ? 1 : 0, fields.pending || '')
    .run();
}

const USER_FIELDS = new Set([
  'name', 'username', 'is_admin', 'is_participant', 'registered', 'wishlist',
  'wishlist_updated_at', 'notify_mode', 'pending',
]);

export function updateUserStmt(db, id, fields) {
  const keys = Object.keys(fields).filter((k) => USER_FIELDS.has(k));
  const sql = `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE tg_id = ?`;
  return db.prepare(sql).bind(...keys.map((k) => fields[k]), id);
}

export async function updateUser(db, id, fields) {
  await updateUserStmt(db, id, fields).run();
}

// ---------- pairs ----------

export async function getPairs(db) {
  const { results } = await db.prepare('SELECT * FROM pairs').all();
  return results;
}

export async function pairOfSanta(db, santa) {
  return db.prepare('SELECT * FROM pairs WHERE santa = ?').bind(santa).first();
}

export async function pairOfWard(db, ward) {
  return db.prepare('SELECT * FROM pairs WHERE ward = ?').bind(ward).first();
}

// ---------- exclusions ----------

export async function getExclusions(db) {
  const { results } = await db.prepare('SELECT giver, receiver FROM exclusions').all();
  return results;
}

export async function getHistory(db) {
  const { results } = await db.prepare('SELECT santa, ward FROM history').all();
  return results;
}

// ---------- outbox (очередь сообщений) ----------

export function enqueueStmt(db, chatId, payload) {
  return db
    .prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)')
    .bind(chatId, JSON.stringify(payload), Date.now());
}

// Работа с базой D1 (SQLite). Схема 005: несколько эвентов с историей.

const SCHEMA_VERSION = '5';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  // Человек: имя, роли и настройки — общие для всех эвентов
  `CREATE TABLE IF NOT EXISTS users (
    tg_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    is_admin INTEGER NOT NULL DEFAULT 0,
    registered INTEGER NOT NULL DEFAULT 0,
    notify_mode TEXT NOT NULL DEFAULT 'sound',
    pending TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 0,
    finished_at INTEGER NOT NULL DEFAULT 0,
    invite_code TEXT NOT NULL UNIQUE,
    registration_open INTEGER NOT NULL DEFAULT 1,
    draw_done INTEGER NOT NULL DEFAULT 0,
    draw_at INTEGER NOT NULL DEFAULT 0,
    revealed INTEGER NOT NULL DEFAULT 0,
    ring INTEGER NOT NULL DEFAULT 1,
    avoid_previous INTEGER NOT NULL DEFAULT 1,
    budget TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    last_daily TEXT NOT NULL DEFAULT ''
  )`,
  // Участие человека в эвенте и его письмо Санте в этом эвенте
  `CREATE TABLE IF NOT EXISTS members (
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    wishlist TEXT NOT NULL DEFAULT '',
    wishlist_updated_at INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS members_user ON members (user_id)`,
  `CREATE TABLE IF NOT EXISTS exclusions (
    event_id INTEGER NOT NULL,
    giver INTEGER NOT NULL,
    receiver INTEGER NOT NULL,
    PRIMARY KEY (event_id, giver, receiver)
  )`,
  `CREATE TABLE IF NOT EXISTS pairs (
    event_id INTEGER NOT NULL,
    santa INTEGER NOT NULL,
    ward INTEGER NOT NULL,
    seen_text TEXT,
    notified_at INTEGER NOT NULL DEFAULT 0,
    gift_ready INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, santa),
    UNIQUE (event_id, ward)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    santa INTEGER NOT NULL,
    ward INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS messages_pair ON messages (event_id, santa, ward, id)`,
  `CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
];

// Таблицы схемы 001–004 (до эвентов). Признак старой схемы — таблица history.
const LEGACY_TABLES = ['history', 'users', 'exclusions', 'pairs', 'messages', 'outbox'];

let schemaReady = false;

export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.prepare(SCHEMA[0]).run();
  const version = await db.prepare("SELECT value FROM settings WHERE key = 'schema'").first('value');
  if (version !== SCHEMA_VERSION) {
    const legacy = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'history'").first('name');
    if (legacy) {
      // Бот ещё не разворачивался с эвентами: старые таблицы пересоздаём, настройки бота сохраняем
      await db.batch([
        ...LEGACY_TABLES.map((t) => db.prepare(`DROP TABLE IF EXISTS ${t}`)),
        db.prepare("DELETE FROM settings WHERE key NOT IN ('bot_username', 'base_url')"),
      ]);
    }
    await db.batch([
      ...SCHEMA.slice(1).map((s) => db.prepare(s)),
      db.prepare("INSERT INTO settings (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(SCHEMA_VERSION),
    ]);
  }
  schemaReady = true;
}

// ---------- settings (общие настройки бота) ----------

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

const USER_FIELDS = new Set(['name', 'username', 'is_admin', 'registered', 'notify_mode', 'pending']);

export function updateUserStmt(db, id, fields) {
  const keys = Object.keys(fields).filter((k) => USER_FIELDS.has(k));
  const sql = `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE tg_id = ?`;
  return db.prepare(sql).bind(...keys.map((k) => fields[k]), id);
}

export async function updateUser(db, id, fields) {
  await updateUserStmt(db, id, fields).run();
}

// ---------- events ----------

export async function getEvent(db, id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').bind(Number(id) || 0).first();
}

export async function getEventByInvite(db, code) {
  return db.prepare('SELECT * FROM events WHERE invite_code = ?').bind(code).first();
}

export async function allEvents(db) {
  const { results } = await db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
  return results;
}

const EVENT_FIELDS = new Set([
  'title', 'status', 'finished_at', 'invite_code', 'registration_open', 'draw_done', 'draw_at', 'revealed', 'ring',
  'avoid_previous', 'budget', 'event_date', 'place', 'deadline', 'notes', 'last_daily',
]);

export function updateEventStmt(db, id, fields) {
  const keys = Object.keys(fields).filter((k) => EVENT_FIELDS.has(k));
  return db.prepare(`UPDATE events SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id);
}

export async function updateEvent(db, id, fields) {
  await updateEventStmt(db, id, fields).run();
}

// ---------- members ----------

export async function getMember(db, eventId, userId) {
  return db.prepare('SELECT * FROM members WHERE event_id = ? AND user_id = ?').bind(eventId, userId).first();
}

// Участники эвента вместе с данными человека
export async function eventMembers(db, eventId) {
  const { results } = await db
    .prepare(
      `SELECT m.*, u.name, u.username, u.is_admin, u.registered, u.notify_mode, u.created_at
         FROM members m JOIN users u ON u.tg_id = m.user_id
        WHERE m.event_id = ? ORDER BY m.joined_at`
    )
    .bind(eventId)
    .all();
  return results;
}

export function addMemberStmt(db, eventId, userId) {
  return db
    .prepare('INSERT INTO members (event_id, user_id, joined_at) VALUES (?, ?, ?) ON CONFLICT(event_id, user_id) DO NOTHING')
    .bind(eventId, userId, Date.now());
}

// ---------- pairs / exclusions ----------

export async function getPairs(db, eventId) {
  const { results } = await db.prepare('SELECT * FROM pairs WHERE event_id = ?').bind(eventId).all();
  return results;
}

export async function pairOfSanta(db, eventId, santa) {
  return db.prepare('SELECT * FROM pairs WHERE event_id = ? AND santa = ?').bind(eventId, santa).first();
}

export async function pairOfWard(db, eventId, ward) {
  return db.prepare('SELECT * FROM pairs WHERE event_id = ? AND ward = ?').bind(eventId, ward).first();
}

export async function getExclusions(db, eventId) {
  const { results } = await db.prepare('SELECT giver, receiver FROM exclusions WHERE event_id = ?').bind(eventId).all();
  return results;
}

// ---------- outbox (очередь сообщений) ----------

export function enqueueStmt(db, chatId, payload) {
  return db
    .prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)')
    .bind(chatId, JSON.stringify(payload), Date.now());
}

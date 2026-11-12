// Работа с базой D1 (SQLite). Схема 6: эвенты с историей (005) + поля 006 (см. migrations/).

// Схема базы создаётся и меняется только миграциями (папка migrations/, 006).
// Код лишь проверяет, что миграции применены, и никогда не создаёт и не удаляет таблицы.
export const REQUIRED_SCHEMA = 6;

export class SchemaError extends Error {
  constructor(found) {
    super('База не подготовлена: примени миграции (см. README).');
    this.name = 'SchemaError';
    this.found = found;
  }
}

let schemaReady = false;

export async function checkSchema(db) {
  if (schemaReady) return;
  let version = null;
  try {
    version = await db.prepare("SELECT value FROM settings WHERE key = 'schema'").first('value');
  } catch {
    throw new SchemaError(null); // таблиц ещё нет
  }
  if (!(Number(version) >= REQUIRED_SCHEMA)) throw new SchemaError(version);
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

const USER_FIELDS = new Set(['name', 'username', 'is_admin', 'registered', 'notify_mode', 'pending', 'blocked_at']);

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
  'avoid_previous', 'draw_token', 'budget', 'event_date', 'place', 'deadline', 'notes', 'last_daily',
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
      `SELECT m.*, u.name, u.username, u.is_admin, u.registered, u.notify_mode, u.created_at, u.blocked_at
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

// Поставить сообщение в очередь, только если выполняется условие guard (SQL-выражение с параметрами args) — 006
export function enqueueIfStmt(db, chatId, payload, guard, ...args) {
  return db
    .prepare(`INSERT INTO outbox (chat_id, payload, created_at) SELECT ?, ?, ? WHERE ${guard}`)
    .bind(chatId, JSON.stringify(payload), Date.now(), ...args);
}

export function enqueueStmt(db, chatId, payload) {
  return db
    .prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)')
    .bind(chatId, JSON.stringify(payload), Date.now());
}

// Работа с базой D1 (SQLite). Схема 8: эвенты с историей (005) + поля 006–008 (см. migrations/).

// Схема базы создаётся и меняется только миграциями (папка migrations/, 006).
// Код лишь проверяет, что миграции применены, и никогда не создаёт и не удаляет таблицы.
export const REQUIRED_SCHEMA = 8;

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
  'draw_auto_date', 'reveal_auto', 'finish_auto', 'delivery_on', 'families_on', 'approval',
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

// Участники, которые завершили регистрацию (они и попадают в жеребьёвку и рассылки эвента)
export async function drawParticipants(db, eventId) {
  return (await eventMembers(db, eventId)).filter((m) => m.registered);
}

// Добавить участника — единственное место вставки (вход по ссылке, «Я участвую», решение по заявке).
// Новое участие предзаполняет адрес доставки последним указанным адресом человека (008, FR-802).
// guard — необязательное SQL-условие с параметрами args (вставка только при нём, для атомарных действий).
export function addMemberStmt(db, ev, userId, guard = '1', ...args) {
  return db
    .prepare(
      `INSERT INTO members (event_id, user_id, joined_at, delivery)
       SELECT ?, ?, ?, COALESCE((SELECT delivery FROM members WHERE user_id = ? AND delivery != '' ORDER BY joined_at DESC LIMIT 1), '')
        WHERE ${guard}
       ON CONFLICT(event_id, user_id) DO NOTHING`
    )
    .bind(ev.id, userId, Date.now(), userId, ...args);
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

// Семьи (008): пары «не дарят друг другу» между членами одной семьи среди ids — если в эвенте включено правило семей
export async function familyExclusions(db, ev, ids) {
  if (!ev.families_on || ids.length < 2) return [];
  const { results } = await db.prepare('SELECT user_id, family_id FROM family_members').all();
  const set = new Set(ids);
  const byFamily = new Map();
  for (const r of results) {
    if (!set.has(r.user_id)) continue;
    if (!byFamily.has(r.family_id)) byFamily.set(r.family_id, []);
    byFamily.get(r.family_id).push(r.user_id);
  }
  const out = [];
  for (const list of byFamily.values()) {
    for (const a of list) for (const b of list) if (a !== b) out.push({ giver: a, receiver: b });
  }
  return out;
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

// ---------- журнал действий (007) ----------

// Запись журнала — в том же batch, что и само действие. actor = 0 — бот. details — без пар и текстов писем.
export function auditStmt(db, eventId, actor, action, details = '') {
  return db
    .prepare('INSERT INTO audit (event_id, actor, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(eventId || 0, actor || 0, action, String(details).slice(0, 500), Date.now());
}

// Последние записи: по эвенту или общие (eventId = 0)
export async function getAudit(db, eventId, limit = 100) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.event_id, a.action, a.details, a.created_at,
              CASE WHEN a.actor = 0 THEN 'бот' ELSE COALESCE(NULLIF(u.name, ''), 'кто-то') END AS actor_name
         FROM audit a LEFT JOIN users u ON u.tg_id = a.actor
        WHERE a.event_id = ? ORDER BY a.id DESC LIMIT ?`
    )
    .bind(eventId || 0, limit)
    .all();
  return results;
}

// ---------- объявления (007) ----------

export async function getAnnouncements(db, eventId, limit = 20) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.text, a.created_at, COALESCE(NULLIF(u.name, ''), 'Организатор') AS author_name
         FROM announcements a LEFT JOIN users u ON u.tg_id = a.author
        WHERE a.event_id = ? ORDER BY a.id DESC LIMIT ?`
    )
    .bind(eventId, limit)
    .all();
  return results;
}

// Запись журнала только при условии guard (как enqueueIfStmt) — для атомарных действий 006/007
export function auditIfStmt(db, eventId, actor, action, details, guard, ...args) {
  return db
    .prepare(`INSERT INTO audit (event_id, actor, action, details, created_at) SELECT ?, ?, ?, ?, ? WHERE ${guard}`)
    .bind(eventId || 0, actor || 0, action, String(details).slice(0, 500), Date.now(), ...args);
}

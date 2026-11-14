// Работа с базой D1 (SQLite). Схема 11: эвенты с историей (005) + поля 006–008, 010, обращения 012, закреплённые пары 014
// (см. migrations/). Какие таблицы хранят событие и человека — один список REGISTRY в конце файла (018).

// Схема базы создаётся и меняется только миграциями (папка migrations/, 006).
// Код лишь проверяет, что миграции применены, и никогда не создаёт и не удаляет таблицы.
export const REQUIRED_SCHEMA = 11;

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
  'draw_auto_date', 'reveal_auto', 'finish_auto', 'delivery_on', 'families_on', 'approval', 'rejoin',
]);

export function updateEventStmt(db, id, fields) {
  const keys = Object.keys(fields).filter((k) => EVENT_FIELDS.has(k));
  return db.prepare(`UPDATE events SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => fields[k]), id);
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
// Новое участие предзаполняет адрес доставки последним указанным адресом человека (008, FR-802) — только если
// в эвенте адрес нужен: иначе адрес лежал бы там, где его не ждут (009, FR-905).
// guard — необязательное SQL-условие с параметрами args (вставка только при нём, для атомарных действий).
export function addMemberStmt(db, ev, userId, guard = '1', ...args) {
  const copy = !!ev.delivery_on;
  const delivery = copy
    ? "COALESCE((SELECT delivery FROM members WHERE user_id = ? AND delivery != '' ORDER BY joined_at DESC LIMIT 1), '')"
    : "''";
  return db
    .prepare(
      `INSERT INTO members (event_id, user_id, joined_at, delivery)
       SELECT ?, ?, ?, ${delivery}
        WHERE ${guard}
       ON CONFLICT(event_id, user_id) DO NOTHING`
    )
    .bind(ev.id, userId, Date.now(), ...(copy ? [userId] : []), ...args);
}

// ---------- отметки «удалён организатором» (010) ----------

// Отметка пишется при удалении участника организатором (admin.remove) — по тому же условию guard, что и само удаление
export function markRemovedStmt(db, eventId, userId, actor, guard = '1', ...args) {
  return db
    .prepare(
      `INSERT INTO removed_members (event_id, user_id, removed_by, removed_at) SELECT ?, ?, ?, ? WHERE ${guard}
       ON CONFLICT(event_id, user_id) DO UPDATE SET removed_by = excluded.removed_by, removed_at = excluded.removed_at`
    )
    .bind(eventId, userId, actor || 0, Date.now(), ...args);
}

// Снять отметку: человек снова вступил или ему разрешили вернуться
export function clearRemovedStmt(db, eventId, userId, guard = '1', ...args) {
  return db.prepare(`DELETE FROM removed_members WHERE event_id = ? AND user_id = ? AND ${guard}`).bind(eventId, userId, ...args);
}

export async function isRemoved(db, eventId, userId) {
  return !!(await db.prepare('SELECT 1 FROM removed_members WHERE event_id = ? AND user_id = ?').bind(eventId, userId).first());
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

// Семьи (008): строки «человек — семья» (все; фильтр по участникам — в функциях ниже)
export async function familyRows(db) {
  const { results } = await db.prepare('SELECT user_id, family_id FROM family_members').all();
  return results;
}

// Семьи (008): пары «не дарят друг другу» между членами одной семьи среди ids — если в эвенте включено правило семей.
// rows — уже прочитанные строки familyRows (необязательно).
export async function familyExclusions(db, ev, ids, rows = null) {
  if (!ev.families_on || ids.length < 2) return [];
  const set = new Set(ids);
  const byFamily = new Map();
  for (const r of rows || (await familyRows(db))) {
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

// Снимок семей участников (010, FR-1019): «число:Σ(человек×семья):Σ(семья)» по строкам семей людей ids.
// То же выражение считает SQL в условии записи жеребьёвки (FAMILY_SNAPSHOT_SQL) — пары пишутся, только если семьи те же.
export function familySnapshot(rows, ids) {
  const set = new Set(ids);
  let count = 0;
  let mixed = 0;
  let fams = 0;
  for (const r of rows) {
    if (!set.has(r.user_id)) continue;
    count += 1;
    mixed += r.user_id * r.family_id;
    fams += r.family_id;
  }
  return `${count}:${mixed}:${fams}`;
}

// Параметр — id эвента; учитываются зарегистрированные участники (как в жеребьёвке)
export const FAMILY_SNAPSHOT_SQL = `(SELECT COUNT(*) || ':' || COALESCE(SUM(fm.user_id * fm.family_id), 0) || ':' || COALESCE(SUM(fm.family_id), 0)
   FROM family_members fm
  WHERE fm.user_id IN (SELECT m.user_id FROM members m JOIN users u ON u.tg_id = m.user_id WHERE m.event_id = ? AND u.registered = 1))`;

export async function getExclusions(db, eventId) {
  const { results } = await db.prepare('SELECT giver, receiver FROM exclusions WHERE event_id = ?').bind(eventId).all();
  return results;
}

// Закреплённые пары владельца (014): «giver обязательно дарит receiver». Наружу — только владельцу.
export async function getFixedPairs(db, eventId) {
  const { results } = await db.prepare('SELECT giver, receiver FROM fixed_pairs WHERE event_id = ?').bind(eventId).all();
  return results;
}

// Снимок закреплённых пар (014, research R6): в отличие от сумм различает перестановку партнёров ({А→Б, В→Г} и
// {А→Г, В→Б}). Числа меньше 2^53 — одинаково точны в JS и в целых SQLite. Параметр SQL — id эвента.
const FIXED_MOD = 1000003;
export function fixedSnapshot(rows) {
  let g = 0;
  let r = 0;
  let mixed = 0;
  for (const p of rows) {
    g += p.giver;
    r += p.receiver;
    mixed += (p.giver % FIXED_MOD) * (p.receiver % FIXED_MOD);
  }
  return `${rows.length}:${g}:${r}:${mixed}`;
}
export const FIXED_SNAPSHOT_SQL = `(SELECT COUNT(*) || ':' || COALESCE(SUM(giver), 0) || ':' || COALESCE(SUM(receiver), 0) || ':' ||
     COALESCE(SUM((giver % ${FIXED_MOD}) * (receiver % ${FIXED_MOD})), 0) FROM fixed_pairs WHERE event_id = ?)`;

// ---------- outbox (очередь сообщений) ----------

// Сообщения другим людям только ставятся в очередь; отправляет её index.js один раз в конце вызова (009).
// Отметка на счётчике (budget.js) говорит, что в этом вызове очередь пополнялась.
const markEnqueued = (db) => {
  if (db.meter) db.meter.enqueued = true;
};

// Поставить сообщение в очередь, только если выполняется условие guard (SQL-выражение с параметрами args) — 006
export function enqueueIfStmt(db, chatId, payload, guard, ...args) {
  markEnqueued(db);
  return db
    .prepare(`INSERT INTO outbox (chat_id, payload, created_at) SELECT ?, ?, ? WHERE ${guard}`)
    .bind(chatId, JSON.stringify(payload), Date.now(), ...args);
}

export function enqueueStmt(db, chatId, payload) {
  markEnqueued(db);
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

// ---------- данные события и человека (018) ----------

// Роли колонок человека в REGISTRY
export const MEMBER = 'member'; // участник: данные человека в событии — уходят с ним (onLeave), переходят при переносе
export const ACTOR = 'actor'; // кто сделал: ссылка на действовавшего — перенос её не трогает (решение владельца)
export const ACTOR_MOVED = 'actor-moved'; // кто сделал, но перенос переносит: текущее состояние обращения (012)
export const RECIPIENT = 'recipient'; // получатель сообщения очереди — перенос не трогает: оно уходит старому аккаунту
export const SELF = 'self'; // сама запись человека
export const NOT_PERSON = 'not-person'; // имя похоже на человека, но это не человек

// Один список данных события и человека: все таблицы схемы (тест схемы — tests/data-registry.test.mjs — падает, пока
// новая таблица или колонка с событием или человеком здесь не описана). Внешних ключей в схеме нет: удаление события,
// сброс, удаление участника, выход админа из участия и перенос участия строятся только из этого списка (построители
// ниже). Порядок ключей — порядок операторов: дочерняя таблица (via) раньше родителя; якорь действия — последним.
//   event — колонка события; via — строки принадлежат событию или человеку через родителя (по его id);
//   people — колонки человека и их роли; anchor — строка-опора действия ('event', 'member', 'person');
//   onEventDelete — удаление события и сброс: 'delete' | 'keep';
//   onLeave — уход участника из события: 'delete' | 'keep' | 'rebuild' (пары перестраивает applyPairsChange);
//   onTransfer — перенос: 'update' (конфликтов нет), 'dedupe' (UPDATE OR IGNORE, остатки старого — удалить),
//     'merge' (участия: одно на событие); noSelf — строка «сам себе» недопустима;
//   transferBefore/transferAfter — свои правила таблицы до и после переноса колонок (sql оканчивается условием WHERE).
// Спецификация — specs/018-data-registry/ (data-model.md, contracts/data-registry.md).
export const REGISTRY = {
  settings: { note: 'владелец — значение owner_id: его запись не переносится, на его аккаунт перенос запрещён' },
  users: {
    people: { tg_id: SELF },
    anchor: 'person',
    // Права администратора у нового аккаунта объединяются
    transferBefore: [{
      sql: 'UPDATE users SET is_admin = MAX(is_admin, COALESCE((SELECT is_admin FROM users WHERE tg_id = ?), 0)) WHERE tg_id = ?',
      args: (from, to) => [from, to],
    }],
  },
  events: { event: 'id', people: { created_by: ACTOR }, anchor: 'event' },
  members: {
    event: 'event_id',
    people: { user_id: MEMBER },
    anchor: 'member',
    onEventDelete: 'delete',
    onTransfer: 'merge',
    // Личные поля участия (значение и время изменения): их стирает сброс у оставшегося владельца; при слиянии двух
    // участий берутся у нового аккаунта, если не пусты (009, FR-938)
    personal: [['wishlist', 'wishlist_updated_at'], ['delivery', 'delivery_updated_at']],
  },
  exclusions: { event: 'event_id', people: { giver: MEMBER, receiver: MEMBER }, onEventDelete: 'delete', onLeave: 'delete', onTransfer: 'dedupe', noSelf: true },
  // 014: если у нового аккаунта в событии уже своя закреплённая пара — остаётся она
  fixed_pairs: { event: 'event_id', people: { giver: MEMBER, receiver: MEMBER }, onEventDelete: 'delete', onLeave: 'delete', onTransfer: 'dedupe', noSelf: true },
  pairs: { event: 'event_id', people: { santa: MEMBER, ward: MEMBER }, onEventDelete: 'delete', onLeave: 'rebuild', onTransfer: 'update' },
  // sender — сторона переписки ('santa'/'ward'), а не человек
  messages: { event: 'event_id', people: { santa: MEMBER, ward: MEMBER, sender: NOT_PERSON }, onEventDelete: 'delete', onLeave: 'delete', onTransfer: 'update' },
  announcements: { event: 'event_id', people: { author: ACTOR }, onEventDelete: 'delete' },
  // Журнал события остаётся и после удаления события (007); event_id = 0 — общий журнал
  audit: { event: 'event_id', people: { actor: ACTOR }, onEventDelete: 'keep' },
  // Заявки — история: остаются, когда участник уходит (008)
  join_requests: { event: 'event_id', people: { user_id: MEMBER, decided_by: ACTOR }, onEventDelete: 'delete', onLeave: 'keep', onTransfer: 'dedupe' },
  removed_members: {
    event: 'event_id',
    people: { user_id: MEMBER, removed_by: ACTOR },
    onEventDelete: 'delete',
    onLeave: 'keep', // отметку ставит само удаление организатором (markRemovedStmt, 010)
    onTransfer: 'dedupe', // перенос не открывает путь назад…
    // …кроме событий, где новый аккаунт теперь участник: участник не может быть «удалённым»
    transferAfter: [{
      sql: 'DELETE FROM removed_members WHERE user_id = ? AND event_id IN (SELECT event_id FROM members WHERE user_id = ?)',
      args: (from, to) => [to, to],
    }],
  },
  // 012: сообщения обращения — через обращение; отправитель (участник или админ) переходит при переносе
  support_messages: { via: { column: 'thread_id', parent: 'support_threads' }, people: { sender: ACTOR_MOVED }, onTransfer: 'update' },
  support_threads: {
    event: 'event_id',
    people: { user_id: MEMBER, assignee: ACTOR_MOVED, closed_by: ACTOR },
    onEventDelete: 'delete',
    onLeave: 'delete',
    onTransfer: 'update',
    // Одно открытое обращение на событие (012, FR-1221): открытое старого закрывается, если у нового в том же событии
    // уже есть открытое
    transferBefore: [{
      sql: `UPDATE support_threads SET status = 'closed', closed_at = ?, closed_by = 0
             WHERE user_id = ? AND status = 'open'
               AND event_id IN (SELECT event_id FROM support_threads WHERE user_id = ? AND status = 'open')`,
      args: (from, to) => [Date.now(), from, to],
    }],
    // Сам себе не отвечает: такое обращение снова ничьё
    transferAfter: [{ sql: 'UPDATE support_threads SET assignee = 0, taken_at = 0 WHERE assignee = user_id', args: () => [] }],
  },
  families: { people: { created_by: ACTOR } },
  // 008: семьи — общие для бота; если новый аккаунт уже в семье — остаётся его семья
  family_members: { via: { column: 'family_id', parent: 'families' }, people: { user_id: MEMBER }, onTransfer: 'dedupe' },
  outbox: { people: { chat_id: RECIPIENT } },
};

// Колонки таблицы с одной из ролей
export const columnsWith = (spec, ...roles) => Object.entries(spec.people || {}).filter(([, r]) => roles.includes(r)).map(([c]) => c);
const anyOf = (cols) => (cols.length === 1 ? `${cols[0]} = ?` : `(${cols.map((c) => `${c} = ?`).join(' OR ')})`);
// Таблицы в порядке списка, якорь действия — последним
const inOrder = (anchor) => {
  const all = Object.entries(REGISTRY);
  return [...all.filter(([, s]) => s.anchor !== anchor), ...all.filter(([, s]) => s.anchor === anchor)];
};
// Сборщик операторов построителя: условие guard (в скобках) — у каждого, его параметры — в конце
const collector = (db, guard, args) => {
  const out = [];
  const add = (sql, ...params) => out.push(db.prepare(`${sql} AND (${guard})`).bind(...params, ...args));
  return { out, add };
};

// Удалить данные события (удаление события, полный сброс). keepMember — участие этого человека остаётся (сброс:
// владелец), его личные поля стираются; keepEvent — строка события остаётся (сброс меняет её сам), иначе она удаляется
// последней. Журнал события остаётся. guard и args — как в enqueueIfStmt.
export function eventDataDeleteStmts(db, eventId, { keepMember = 0, keepEvent = false } = {}, guard = '1', ...args) {
  const { out, add } = collector(db, guard, args);
  for (const [table, spec] of inOrder('event')) {
    if (spec.anchor === 'event') {
      if (!keepEvent) add(`DELETE FROM ${table} WHERE ${spec.event} = ?`, eventId);
      continue;
    }
    const parent = spec.via && REGISTRY[spec.via.parent];
    if (parent) {
      if (parent.event && parent.onEventDelete === 'delete') {
        add(`DELETE FROM ${table} WHERE ${spec.via.column} IN (SELECT id FROM ${spec.via.parent} WHERE ${parent.event} = ?)`, eventId);
      }
      continue;
    }
    if (!spec.event || spec.onEventDelete !== 'delete') continue;
    if (spec.anchor === 'member' && keepMember) {
      const [who] = columnsWith(spec, MEMBER);
      const fields = spec.personal.flatMap(([value, time]) => [[value, ''], [time, 0]]);
      add(`DELETE FROM ${table} WHERE ${spec.event} = ? AND ${who} != ?`, eventId, keepMember);
      add(`UPDATE ${table} SET ${fields.map(([f]) => `${f} = ?`).join(', ')} WHERE ${spec.event} = ?`, ...fields.map(([, v]) => v), eventId);
    } else {
      add(`DELETE FROM ${table} WHERE ${spec.event} = ?`, eventId);
    }
  }
  return out;
}

// Удалить данные участника в событии (удаление участника, выход админа из участия): таблицы с onLeave 'delete' и их
// дочерние; строка участника — последней. Пары ('rebuild') перестраивает applyPairsChange, отметку «удалён» ставит
// markRemovedStmt, заявки остаются. guard и args — как в enqueueIfStmt.
export function memberDataDeleteStmts(db, eventId, userId, guard = '1', ...args) {
  const { out, add } = collector(db, guard, args);
  for (const [table, spec] of inOrder('member')) {
    const parent = spec.via && REGISTRY[spec.via.parent];
    if (parent) {
      const who = columnsWith(parent, MEMBER);
      if (parent.event && parent.onLeave === 'delete' && who.length) {
        add(`DELETE FROM ${table} WHERE ${spec.via.column} IN (SELECT id FROM ${spec.via.parent} WHERE ${parent.event} = ? AND ${anyOf(who)})`,
          eventId, ...who.map(() => userId));
      }
      continue;
    }
    const who = columnsWith(spec, MEMBER);
    if (!spec.event || !who.length) continue;
    if (spec.anchor === 'member' || spec.onLeave === 'delete') {
      add(`DELETE FROM ${table} WHERE ${spec.event} = ? AND ${anyOf(who)}`, eventId, ...who.map(() => userId));
    }
  }
  return out;
}

// Слияние двух участий одного события при переносе (009, FR-938): строка остаётся старого (его время вступления),
// личные поля — нового, если не пусты, каждое со своим временем изменения.
export function mergeMembership(from, to) {
  const set = {};
  for (const [value, time] of REGISTRY.members.personal) {
    const src = String(to[value] || '').trim() ? to : from;
    set[value] = src[value];
    set[time] = src[time];
  }
  return { event_id: from.event_id, set };
}

// Перенести человека fromId на аккаунт toId (перенос участия, 004 → 005: во всех событиях). merge — решения
// mergeMembership для событий, где участвуют оба. Колонки «кто сделал» и получатель очереди не трогаются; запись
// старого аккаунта удаляется последней. guard и args — как в enqueueIfStmt.
export function personTransferStmts(db, fromId, toId, { merge = [] } = {}, guard = '1', ...args) {
  const { out, add } = collector(db, guard, args);
  const fix = (list = []) => {
    for (const f of list) add(f.sql, ...f.args(fromId, toId));
  };
  for (const [table, spec] of inOrder('person')) {
    if (spec.anchor === 'person') {
      fix(spec.transferBefore);
      add(`DELETE FROM ${table} WHERE ${columnsWith(spec, SELF)[0]} = ?`, fromId);
      continue;
    }
    const moved = columnsWith(spec, MEMBER, ACTOR_MOVED);
    if (!moved.length) continue;
    fix(spec.transferBefore);
    if (spec.onTransfer === 'merge') {
      const [who] = moved;
      const fields = spec.personal.flat();
      for (const m of merge) {
        add(`DELETE FROM ${table} WHERE ${spec.event} = ? AND ${who} = ?`, m.event_id, toId);
        add(`UPDATE ${table} SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE ${spec.event} = ? AND ${who} = ?`,
          ...fields.map((f) => m.set[f]), m.event_id, fromId);
      }
      add(`UPDATE ${table} SET ${who} = ? WHERE ${who} = ?`, toId, fromId);
    } else if (spec.onTransfer === 'update' || spec.onTransfer === 'dedupe') {
      const dedupe = spec.onTransfer === 'dedupe';
      for (const c of moved) add(`UPDATE${dedupe ? ' OR IGNORE' : ''} ${table} SET ${c} = ? WHERE ${c} = ?`, toId, fromId);
      if (dedupe) {
        const left = moved.map((c) => `${c} = ?`);
        if (spec.noSelf) left.push(`${moved[0]} = ${moved[1]}`);
        add(`DELETE FROM ${table} WHERE (${left.join(' OR ')})`, ...moved.map(() => fromId));
      }
    } else {
      throw new Error(`REGISTRY.${table}: не задан перенос (onTransfer)`);
    }
    fix(spec.transferAfter);
  }
  return out;
}

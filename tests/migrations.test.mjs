// 031: миграция 0008 — только индексы непрочитанных сообщений переписки. На базе с данными не меняет ни одной строки (и
// при повторе), версию схемы не трогает (код от индексов не зависит), подсчёт непрочитанных для «мои события» ищет по
// индексам вместо просмотра таблицы (specs/031-pins-audit-index/, research R4, R5).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { createMigratedD1, createD1 } from './support/d1-sqlite.mjs';
import { unreadByEventQuery } from '../src/chat.js';
import { addCompany, invariants } from './support/companies.mjs';

after(restoreFetch);

const SQL = readFileSync(new URL('../migrations/0008_unread_index.sql', import.meta.url), 'utf8');
const INDEXES = ['messages_unread_santa', 'messages_unread_ward'];
const statements = SQL.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

// Текст запроса «мои события» — через подставной prepare (запрос в коде не меняется)
const UNREAD_ME = unreadByEventQuery({ prepare: (sql) => ({ bind: () => sql }) }, 0);
const plan = (sqlite) => sqlite.prepare('EXPLAIN QUERY PLAN ' + UNREAD_ME).all(1).map((r) => r.detail);

test('0008: только CREATE INDEX IF NOT EXISTS по messages — без данных и версии схемы', () => {
  assert.equal(statements.length, 2, statements.join('\n'));
  const names = statements.map((s) => /^CREATE INDEX IF NOT EXISTS (\w+) ON messages \(\w+, read_at\)$/.exec(s)?.[1]);
  assert.deepEqual(names, INDEXES, 'только два индекса');
  assert.doesNotMatch(SQL.replace(/--[^\n]*/g, ''), /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TABLE|settings)\b/i);
});

test('«мои события»: непрочитанные — поиском по двум индексам; без них — просмотр таблицы', () => {
  const db = createMigratedD1();
  const withIndexes = plan(db.sqlite);
  assert.ok(!withIndexes.some((d) => /^SCAN m\b/.test(d)), withIndexes.join('\n'));
  for (const name of INDEXES) assert.ok(withIndexes.some((d) => d.includes(name)), `${name}: ${withIndexes.join(' | ')}`);
  // От противного: база «до 0008» просматривает всю таблицу
  for (const name of INDEXES) db.sqlite.exec(`DROP INDEX ${name}`);
  assert.ok(plan(db.sqlite).some((d) => /^SCAN m\b/.test(d)), 'без индексов — SCAN');
});

// Мир с данными: участники, письма, исключение, закреплённая пара, семья, объявление, жеребьёвка, переписка (прочитанная
// и нет), обращение с ответом, журнал
async function filledWorld() {
  const w = await startWorld();
  const boss = { id: 9001, name: 'Владелец', username: 'boss' };
  const adm = { id: 9002, name: 'Админ', username: 'adm' };
  const p = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const E = (await w.api(boss, 'admin.events.create', { title: 'Миграция' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: E })).settings.invite_link)[1];
  for (const u of [adm, ...p]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  for (const u of p) await w.api(u, 'wishlist.save', { event: E, text: 'Хочу книгу' });
  await w.api(adm, 'admin.ring', { event: E, on: false });
  await w.api(adm, 'admin.exclusion.add', { event: E, giver: p[0].id, receiver: p[1].id });
  await w.api(boss, 'admin.fixed.add', { event: E, giver: p[2].id, receiver: p[3].id });
  await w.api(boss, 'admin.family.save', { name: 'Ивановы', members: [p[4].id, p[5].id] });
  await w.api(adm, 'admin.announce', { event: E, text: 'Всем привет' });
  await w.api(adm, 'admin.draw', { event: E });
  for (const u of p) await w.api(u, 'ward.get', { event: E });
  await w.api(p[2], 'message.send', { event: E, to: 'ward', text: 'Привет!' });
  await w.api(p[3], 'chat.get', { event: E, with: 'santa' });
  await w.api(p[3], 'message.send', { event: E, to: 'santa', text: 'Спасибо!' });
  await w.api(p[3], 'message.send', { event: E, to: 'santa', text: 'Жду' });
  await w.api(p[0], 'support.send', { event: E, text: 'Помогите' });
  const th = w.query('SELECT id FROM support_threads')[0].id;
  await w.api(adm, 'admin.support.send', { event: E, thread: th, text: 'Сейчас' });
  return { w, readers: [p[2], p[3], adm] };
}

const snapshot = (w) => Object.fromEntries(
  w.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map(({ name }) => [name, w.query(`SELECT * FROM ${name}`).map((r) => JSON.stringify(r)).sort()])
);
const indexNames = (w) => w.query("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messages' ORDER BY name").map((r) => r.name);

test('база с данными «до 0008»: применение не меняет ни одной строки, повтор — тоже; числа непрочитанных прежние', async () => {
  const { w, readers } = await filledWorld();
  for (const t of ['users', 'events', 'members', 'pairs', 'messages', 'exclusions', 'fixed_pairs', 'families', 'announcements', 'audit', 'support_messages']) {
    assert.ok(w.query(`SELECT COUNT(*) AS n FROM ${t}`)[0].n > 0, `в ${t} есть строки`);
  }
  assert.ok(w.query('SELECT COUNT(*) AS n FROM messages WHERE read_at = 0')[0].n > 0, 'есть непрочитанные');
  for (const name of INDEXES) w.sql(`DROP INDEX ${name}`); // база, к которой 0008 ещё не применена
  const me = async () => Promise.all(readers.map((u) => w.api(u, 'me')));
  const meBefore = await me();
  assert.ok(meBefore.some((r) => r.events.some((e) => e.unread > 0)), 'непрочитанные видны');
  const before = snapshot(w);

  w.sql(SQL);
  assert.deepEqual(snapshot(w), before, 'данные не изменились');
  for (const name of INDEXES) assert.ok(indexNames(w).includes(name), name);
  assert.deepEqual(await me(), meBefore, '«мои события» — те же числа');
  w.sql(SQL);
  assert.deepEqual(snapshot(w), before, 'повтор безопасен');
});

// 037: миграция 0009 — параметр события contacts_on (у всех событий — выключено) и версия схемы 12; строки не меняются
const SQL9 = readFileSync(new URL('../migrations/0009_contacts.sql', import.meta.url), 'utf8');
const statements9 = SQL9.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

test('0009: только колонка events.contacts_on с умолчанием 0 и версия схемы 12', () => {
  assert.deepEqual(statements9, [
    'ALTER TABLE events ADD COLUMN contacts_on INTEGER NOT NULL DEFAULT 0',
    "INSERT INTO settings (key, value) VALUES ('schema', '12') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ]);
});

test('база с данными «до 0009»: у всех событий contacts_on = 0, остальные строки прежние, версия 12', async () => {
  const { w } = await filledWorld();
  w.sql("ALTER TABLE events DROP COLUMN contacts_on; UPDATE settings SET value = '11' WHERE key = 'schema'");
  const before = snapshot(w);
  w.sql(SQL9);
  const after = snapshot(w);
  const events = w.query('SELECT * FROM events');
  assert.ok(events.length > 0 && events.every((e) => e.contacts_on === 0), 'выключено у всех');
  const withoutContacts = after.events.map((r) => { const { contacts_on, ...rest } = JSON.parse(r); return JSON.stringify(rest); }).sort();
  assert.deepEqual(withoutContacts, before.events, 'события — те же значения');
  const schema = (snap) => snap.settings.map((r) => JSON.parse(r)).find((r) => r.key === 'schema').value;
  assert.equal(schema(before), '11');
  assert.equal(schema(after), '12');
  for (const t of Object.keys(before).filter((t) => t !== 'events' && t !== 'settings')) assert.deepEqual(after[t], before[t], t);
  assert.deepEqual(after.settings.filter((r) => !r.includes('"schema"')), before.settings.filter((r) => !r.includes('"schema"')));
});

// 038: миграция 0010 — значок у имени (users.emoji) и открытка письма (members.card), у всех пусто; версия схемы 13
const SQL10 = readFileSync(new URL('../migrations/0010_looks.sql', import.meta.url), 'utf8');
const statements10 = SQL10.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

test('0010: только колонки users.emoji и members.card с умолчанием пусто и версия схемы 13', () => {
  assert.deepEqual(statements10, [
    "ALTER TABLE users ADD COLUMN emoji TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE members ADD COLUMN card TEXT NOT NULL DEFAULT ''",
    "INSERT INTO settings (key, value) VALUES ('schema', '13') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ]);
});

test('база с данными «до 0010»: значки и открытки пусты, остальные строки прежние, версия 13', async () => {
  const { w } = await filledWorld();
  w.sql("ALTER TABLE users DROP COLUMN emoji; ALTER TABLE members DROP COLUMN card; UPDATE settings SET value = '12' WHERE key = 'schema'");
  const before = snapshot(w);
  w.sql(SQL10);
  const after = snapshot(w);
  const without = (rows, col) => rows.map((r) => { const { [col]: _, ...rest } = JSON.parse(r); return JSON.stringify(rest); }).sort();
  assert.ok(w.query('SELECT emoji FROM users').every((u) => u.emoji === ''), 'значки пусты');
  assert.ok(w.query('SELECT card FROM members').every((m) => m.card === ''), 'открытки пусты');
  assert.deepEqual(without(after.users, 'emoji'), before.users, 'люди — те же значения');
  assert.deepEqual(without(after.members, 'card'), before.members, 'участия — те же значения');
  const schema = (snap) => snap.settings.map((r) => JSON.parse(r)).find((r) => r.key === 'schema').value;
  assert.equal(schema(before), '12');
  assert.equal(schema(after), '13');
  for (const t of Object.keys(before).filter((t) => !['users', 'members', 'settings'].includes(t))) assert.deepEqual(after[t], before[t], t);
});

// 040: миграция 0011 — маска Санты в переписке (pairs.mask), у всех пар пусто; версия схемы 14
const SQL11 = readFileSync(new URL('../migrations/0011_santa_mask.sql', import.meta.url), 'utf8');
const statements11 = SQL11.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

test('0011: только колонка pairs.mask с умолчанием пусто и версия схемы 14', () => {
  assert.deepEqual(statements11, [
    "ALTER TABLE pairs ADD COLUMN mask TEXT NOT NULL DEFAULT ''",
    "INSERT INTO settings (key, value) VALUES ('schema', '14') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ]);
});

test('база с данными «до 0011»: маски пар пусты, остальные строки прежние, версия 14', async () => {
  const { w } = await filledWorld();
  w.sql("ALTER TABLE pairs DROP COLUMN mask; UPDATE settings SET value = '13' WHERE key = 'schema'");
  const before = snapshot(w);
  w.sql(SQL11);
  const after = snapshot(w);
  const without = (rows, col) => rows.map((r) => { const { [col]: _, ...rest } = JSON.parse(r); return JSON.stringify(rest); }).sort();
  const pairs = w.query('SELECT mask FROM pairs');
  assert.ok(pairs.length > 0 && pairs.every((p) => p.mask === ''), 'маски пусты');
  assert.deepEqual(without(after.pairs, 'mask'), before.pairs, 'пары — те же значения');
  const schema = (snap) => snap.settings.map((r) => JSON.parse(r)).find((r) => r.key === 'schema').value;
  assert.equal(schema(before), '13');
  assert.equal(schema(after), '14');
  for (const t of Object.keys(before).filter((t) => !['pairs', 'settings'].includes(t))) assert.deepEqual(after[t], before[t], t);
});

test('0014 очищает отдельные значки у всех пользователей и сохраняет остальные данные', async () => {
  const { w } = await filledWorld();
  w.sql("UPDATE users SET name = 'Игрок1 🦊', emoji = '🦊' WHERE tg_id = 100");
  w.sql("UPDATE users SET emoji = '🎅' WHERE is_admin = 1");
  w.sql("UPDATE members SET card = 'night' WHERE user_id = 100");
  w.sql("UPDATE pairs SET mask = 'dragon' WHERE santa = 100");
  const before = snapshot(w);
  const sql = readFileSync(new URL('../migrations/0014_remove_profile_badges.sql', import.meta.url), 'utf8');
  const expected = {
    ...before,
    users: before.users.map((row) => JSON.stringify({ ...JSON.parse(row), emoji: '' })).sort(),
  };
  w.sql(sql);
  assert.deepEqual(snapshot(w), expected);
  w.sql(sql);
  assert.deepEqual(snapshot(w), expected);
});

// 050: миграция 0015 — компании. База схемы 16 (миграции 0001–0014) с данными прежнего кода: события, люди (в т.ч. без
// имени), админы, семьи, журнал (события и общий). После 0015 строки прежних таблиц те же (новая колонка company_id = 1),
// всё — в компании №1 «Основная», права админов перенесены в строки компании, версия 17.
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);
const OLD_MIGRATIONS = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && f < '0015').sort()
  .map((f) => readFileSync(new URL(f, MIGRATIONS_DIR), 'utf8'));
const SQL15 = readFileSync(new URL('0015_companies.sql', MIGRATIONS_DIR), 'utf8');
const rowsOf = (sqlite, sql, ...args) => sqlite.prepare(sql).all(...args).map((r) => ({ ...r }));
const tablesOf = (sqlite) => rowsOf(sqlite, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((r) => r.name);
const dump = (sqlite, table) => rowsOf(sqlite, `SELECT * FROM ${table}`).map((r) => JSON.stringify(r)).sort();

// База схемы 16 с данными «мира» (данные те же, что пишет код; колонки — только прежние)
async function schema16() {
  const { w } = await filledWorld();
  // Человек, начавший регистрацию по ссылке, но без имени
  w.sql("INSERT INTO users (tg_id, username, created_at, pending) VALUES (555, 'noname', 5, 'name:1:x')");
  const db = createD1();
  for (const sql of OLD_MIGRATIONS) db.sqlite.exec(sql);
  for (const t of tablesOf(db.sqlite)) {
    const cols = rowsOf(db.sqlite, `PRAGMA table_info(${t})`).map((c) => c.name);
    for (const r of w.query(`SELECT ${cols.join(', ')} FROM ${t}`)) {
      if (t === 'settings' && r.key === 'schema') continue;
      db.sqlite.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => r[c]));
    }
  }
  return db.sqlite;
}

test('0015: база схемы 16 с данными — строки прежние, всё в компании 1, права админов перенесены, версия 17', async () => {
  const sqlite = await schema16();
  const tables = tablesOf(sqlite);
  assert.ok(!tables.includes('companies') && !tables.includes('company_members'));
  for (const t of ['users', 'events', 'members', 'families', 'family_members', 'audit']) {
    assert.ok(rowsOf(sqlite, `SELECT COUNT(*) AS n FROM ${t}`)[0].n > 0, `в ${t} есть строки`);
  }
  assert.ok(rowsOf(sqlite, 'SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')[0].n >= 2, 'есть админы');
  assert.ok(rowsOf(sqlite, "SELECT COUNT(*) AS n FROM users WHERE name = '' AND registered = 0")[0].n > 0, 'есть человек без имени');
  assert.ok(rowsOf(sqlite, 'SELECT COUNT(*) AS n FROM audit WHERE event_id = 0')[0].n > 0, 'есть общий журнал');
  const before = Object.fromEntries(tables.map((t) => [t, dump(sqlite, t)]));

  sqlite.exec(SQL15);

  const withCompany = ['events', 'families', 'family_members', 'audit'];
  for (const t of tables) {
    if (t === 'settings') continue;
    const now = dump(sqlite, t);
    assert.equal(now.length, before[t].length, `${t}: число строк`);
    if (!withCompany.includes(t)) {
      assert.deepEqual(now, before[t], t);
      continue;
    }
    const rows = now.map((r) => JSON.parse(r));
    assert.ok(rows.every((r) => r.company_id === 1), `${t}: компания 1`);
    assert.deepEqual(rows.map(({ company_id, ...rest }) => JSON.stringify(rest)).sort(), before[t], t);
  }
  const settings = rowsOf(sqlite, 'SELECT key, value FROM settings ORDER BY key');
  assert.equal(settings.find((r) => r.key === 'schema').value, '17');
  assert.deepEqual(settings.filter((r) => r.key !== 'schema').map((r) => JSON.stringify(r)).sort(),
    before.settings.filter((r) => !r.includes('"schema"')));

  const companies = rowsOf(sqlite, 'SELECT id, name, owner_id, owner_code, created_by FROM companies');
  assert.deepEqual(companies, [{ id: 1, name: 'Основная', owner_id: 0, owner_code: '', created_by: 0 }]);
  assert.ok(rowsOf(sqlite, 'SELECT created_at FROM companies')[0].created_at > 1e12, 'время создания — мс');
  assert.deepEqual(rowsOf(sqlite, 'SELECT company_id, user_id, is_admin, label, joined_at FROM company_members ORDER BY user_id'),
    rowsOf(sqlite, "SELECT 1 AS company_id, tg_id AS user_id, is_admin, '' AS label, created_at AS joined_at FROM users ORDER BY tg_id"));

  const indexes = rowsOf(sqlite, "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
  for (const i of ['companies_owner_code', 'company_members_user', 'events_company', 'audit_company', 'family_members_family']) {
    assert.ok(indexes.includes(i), i);
  }
  // Ключ семей — (компания, человек): по строке в двух компаниях можно, вторую в той же — нельзя (текст ошибки — прежний)
  const { user_id: uid, family_id: fam } = rowsOf(sqlite, 'SELECT user_id, family_id FROM family_members LIMIT 1')[0];
  sqlite.prepare('INSERT INTO family_members (company_id, user_id, family_id) VALUES (2, ?, ?)').run(uid, fam);
  assert.throws(() => sqlite.prepare('INSERT INTO family_members (user_id, family_id) VALUES (?, ?)').run(uid, fam),
    /^Error: UNIQUE constraint failed: family_members\./);
  // Код ссылки владельца компании — уникален среди непустых
  sqlite.exec("INSERT INTO companies (name) VALUES ('Б'), ('В')");
  sqlite.exec("UPDATE companies SET owner_code = 'x' WHERE id = 2");
  assert.throws(() => sqlite.exec("UPDATE companies SET owner_code = 'x' WHERE id = 3"), /UNIQUE constraint failed: companies\.owner_code/);
});

test('0015 на пустой базе: компания 1 без людей, версия 17', () => {
  const db = createD1();
  for (const sql of OLD_MIGRATIONS) db.sqlite.exec(sql);
  db.sqlite.exec(SQL15);
  assert.equal(rowsOf(db.sqlite, 'SELECT COUNT(*) AS n FROM companies')[0].n, 1);
  assert.equal(rowsOf(db.sqlite, 'SELECT COUNT(*) AS n FROM company_members')[0].n, 0);
  assert.equal(rowsOf(db.sqlite, "SELECT value FROM settings WHERE key = 'schema'")[0].value, '17');
});

// 052: миграция 0016 — признак «название общее» у компаний (companies.shared), у прежних 0; версия схемы 18
const SQL16 = readFileSync(new URL('0016_open_bot.sql', MIGRATIONS_DIR), 'utf8');
const statements16 = SQL16.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

test('0016: только колонка companies.shared с умолчанием 0 и версия схемы 18', () => {
  assert.deepEqual(statements16, [
    'ALTER TABLE companies ADD COLUMN shared INTEGER NOT NULL DEFAULT 0',
    "INSERT INTO settings (key, value) VALUES ('schema', '18') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ]);
});

test('база с данными «до 0016»: у всех компаний shared = 0, остальные строки прежние, версия 18', async () => {
  const { w } = await filledWorld();
  addCompany(w, 'Вторая');
  w.sql("ALTER TABLE companies DROP COLUMN shared; UPDATE settings SET value = '17' WHERE key = 'schema'");
  const before = snapshot(w);
  w.sql(SQL16);
  const after = snapshot(w);
  const companies = w.query('SELECT shared FROM companies');
  assert.ok(companies.length === 2 && companies.every((c) => c.shared === 0), 'признак у всех — 0');
  const without = (rows) => rows.map((r) => { const { shared: _, ...rest } = JSON.parse(r); return JSON.stringify(rest); }).sort();
  assert.deepEqual(without(after.companies), before.companies, 'компании — те же значения');
  const schema = (snap) => snap.settings.map((r) => JSON.parse(r)).find((r) => r.key === 'schema').value;
  assert.equal(schema(before), '17');
  assert.equal(schema(after), '18');
  for (const t of Object.keys(before).filter((t) => !['companies', 'settings'].includes(t))) assert.deepEqual(after[t], before[t], t);
  // от противного: колонка уже есть — повтор миграции падает (Wrangler применяет её один раз)
  assert.throws(() => w.sql(SQL16), /duplicate column name: shared/);
});

// 054: миграция 0017 — только частичный индекс идущих событий для минутной проверки (tests/cron-reads.test.mjs)
const SQL17 = readFileSync(new URL('0017_active_events_index.sql', MIGRATIONS_DIR), 'utf8');

test('0017: только CREATE INDEX IF NOT EXISTS events_active по идущим событиям — без данных и версии схемы', () => {
  const statements17 = SQL17.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  assert.deepEqual(statements17, ["CREATE INDEX IF NOT EXISTS events_active ON events (id) WHERE status = 'active'"]);
  assert.doesNotMatch(SQL17.replace(/--[^\n]*/g, ''), /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TABLE|settings)\b/i);
});

test('база с данными «до 0017»: применение и повтор не меняют ни одной строки', async () => {
  const { w } = await filledWorld();
  w.sql('DROP INDEX events_active');
  const before = snapshot(w);
  w.sql(SQL17);
  assert.deepEqual(snapshot(w), before);
  w.sql(SQL17);
  assert.deepEqual(snapshot(w), before, 'повтор');
  assert.equal(w.query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'events_active'")[0].n, 1);
});

// ---------- сверка компаний (050, tools/companies-reconcile.sql) ----------

const RECONCILE = readFileSync(new URL('../tools/companies-reconcile.sql', import.meta.url), 'utf8');
const reconcileStatements = RECONCILE.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
const rights = (w) => w.query('SELECT company_id, user_id, is_admin FROM company_members ORDER BY company_id, user_id')
  .map((r) => `${r.company_id}:${r.user_id}:${r.is_admin}`);

test('сверка: четыре оператора, без версии схемы и без DELETE', () => {
  assert.equal(reconcileStatements.length, 4);
  assert.ok(reconcileStatements.every((s) => /^(INSERT|UPDATE)\b/.test(s)), 'только вставка и обновление');
  assert.ok(!/schema/.test(RECONCILE.replace(/--[^\n]*/g, '')), 'версию схемы не трогает');
});

test('сверка: нарушенные I2, I5 и права, изменённые «прежним кодом», — исправлены; повтор ничего не меняет', async () => {
  const { w } = await filledWorld();
  assert.deepEqual(invariants(w), [], 'до нарушения');
  // Прежний код: новый участник без строки компании (I5), ждущий имени по ссылке, заявка; владелец бота без строки (I2);
  // назначение и снятие админа — только общим признаком
  const E = w.query('SELECT id FROM events')[0].id;
  w.sql(`DELETE FROM company_members WHERE user_id IN (100, 9001);
    INSERT INTO users (tg_id, username, created_at, pending) VALUES (501, 'n', 1, 'name:${E}:inv_x'), (502, 'r', 1, '');
    INSERT INTO join_requests (event_id, user_id, created_at) VALUES (${E}, 502, 1);
    UPDATE users SET is_admin = 1 WHERE tg_id = 101;
    UPDATE users SET is_admin = 0 WHERE tg_id = 9002;`);
  const broken = invariants(w);
  for (const code of ['I2', 'I4', 'I5']) assert.ok(broken.some((v) => v.startsWith(code + ':')), 'нарушено ' + code);
  w.sql(RECONCILE);
  assert.deepEqual(invariants(w), []);
  const row = (id) => w.query('SELECT is_admin FROM company_members WHERE company_id = 1 AND user_id = ?', id)[0]?.is_admin;
  assert.deepEqual([row(100), row(501), row(502), row(9001), row(101), row(9002)], [0, 0, 0, 1, 1, 0]);
  const once = snapshot(w);
  w.sql(RECONCILE);
  assert.deepEqual(snapshot(w), once, 'повтор ничего не меняет');
});

test('сверка при двух компаниях: оператор 3 ничего не меняет — признак пересчитывается по строкам', async () => {
  const { w } = await filledWorld();
  addCompany(w, 'Вторая');
  w.sql(`INSERT INTO company_members (company_id, user_id, is_admin) VALUES (2, 9001, 1);
    UPDATE users SET is_admin = 1 WHERE tg_id = 101;`);
  const before = rights(w);
  w.sql(RECONCILE);
  assert.deepEqual(rights(w), before, 'строки компаний прежние');
  assert.equal(w.query('SELECT is_admin FROM users WHERE tg_id = 101')[0].is_admin, 0, 'признак — по строкам');
  assert.deepEqual(invariants(w), []);
});

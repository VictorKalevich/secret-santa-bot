// 031: миграция 0008 — только индексы непрочитанных сообщений переписки. На базе с данными не меняет ни одной строки (и
// при повторе), версию схемы не трогает (код от индексов не зависит), подсчёт непрочитанных для «мои события» ищет по
// индексам вместо просмотра таблицы (specs/031-pins-audit-index/, research R4, R5).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { createMigratedD1 } from './support/d1-sqlite.mjs';
import { unreadByEventQuery } from '../src/chat.js';

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

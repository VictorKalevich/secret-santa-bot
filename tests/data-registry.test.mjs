// Один список данных события и человека (018, specs/018-data-registry/): тест схемы — REGISTRY сверяется со схемой из
// миграций в обе стороны (новая таблица или колонка с событием или человеком роняет тест, пока её не описали), и
// построители операторов. Тест «после действия не остаётся строк» — ниже, на «мире» (US3).
import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { createMigratedD1 } from './support/d1-sqlite.mjs';
import {
  REGISTRY, MEMBER, ACTOR, ACTOR_MOVED, RECIPIENT, SELF, NOT_PERSON, columnsWith,
  eventDataDeleteStmts, memberDataDeleteStmts, personTransferStmts, mergeMembership,
} from '../src/db.js';

const ROLES = new Set([MEMBER, ACTOR, ACTOR_MOVED, RECIPIENT, SELF, NOT_PERSON]);

// Схема базы: таблица → имена колонок
function schemaOf(sqlite) {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return new Map(tables.map(({ name }) => [name, sqlite.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name)]));
}

// Колонки, которые описаны в списке: событие, родитель (via), колонки человека любой роли
const described = (spec) => [spec.event, spec.via?.column, ...Object.keys(spec.people || {})].filter(Boolean);

// Расхождения списка со схемой (пустой массив — всё описано)
function registryGaps(sqlite, registry = REGISTRY) {
  const schema = schemaOf(sqlite);
  const gaps = [];
  // Имена колонок человека из списка: такая колонка в любой таблице должна быть описана
  const personNames = new Set(Object.values(registry).flatMap((s) => Object.keys(s.people || {})));
  const suspicious = (c) => ['event_id', 'user_id', 'tg_id', 'chat_id'].includes(c) || /_(id|by)$/.test(c) || personNames.has(c);
  for (const [table, cols] of schema) {
    const spec = registry[table];
    if (!spec) {
      gaps.push(`таблицы ${table} нет в списке`);
      continue;
    }
    const known = new Set(described(spec));
    for (const c of cols) if (suspicious(c) && !known.has(c)) gaps.push(`${table}.${c} не описана в списке`);
  }
  for (const [table, spec] of Object.entries(registry)) {
    const cols = schema.get(table);
    if (!cols) {
      gaps.push(`таблицы ${table} нет в схеме`);
      continue;
    }
    for (const c of described(spec)) if (!cols.includes(c)) gaps.push(`${table}.${c} — в списке, но нет в схеме`);
    for (const [c, role] of Object.entries(spec.people || {})) if (!ROLES.has(role)) gaps.push(`${table}.${c}: неизвестная роль ${role}`);
    if (spec.via && !registry[spec.via.parent]) gaps.push(`${table}: родителя ${spec.via.parent} нет в списке`);
    // Обязательные решения для каждой таблицы с данными события или человека
    const member = columnsWith(spec, MEMBER).length > 0;
    if (spec.event && !spec.anchor && !['delete', 'keep'].includes(spec.onEventDelete)) gaps.push(`${table}: не задано onEventDelete`);
    if (spec.event && member && spec.anchor !== 'member' && !['delete', 'keep', 'rebuild'].includes(spec.onLeave)) {
      gaps.push(`${table}: не задано onLeave`);
    }
    if (columnsWith(spec, MEMBER, ACTOR_MOVED).length && !['update', 'dedupe', 'merge'].includes(spec.onTransfer)) {
      gaps.push(`${table}: не задано onTransfer`);
    }
  }
  return gaps;
}

describe('список данных события и человека (тест схемы)', () => {
  it('схема из миграций полностью описана: 17 таблиц, ни одного расхождения', () => {
    const db = createMigratedD1();
    assert.deepEqual(registryGaps(db.sqlite), []);
    assert.equal(schemaOf(db.sqlite).size, 17);
    assert.equal(Object.keys(REGISTRY).length, 17);
  });

  it('от противного: новая колонка event_id в существующей таблице', () => {
    const db = createMigratedD1();
    db.sqlite.exec('ALTER TABLE settings ADD COLUMN event_id INTEGER NOT NULL DEFAULT 0');
    assert.deepEqual(registryGaps(db.sqlite), ['settings.event_id не описана в списке']);
  });

  it('от противного: новая колонка человека под новым именем и под именем из списка', () => {
    const db = createMigratedD1();
    db.sqlite.exec('ALTER TABLE announcements ADD COLUMN approved_by INTEGER NOT NULL DEFAULT 0');
    db.sqlite.exec('ALTER TABLE events ADD COLUMN giver INTEGER NOT NULL DEFAULT 0');
    assert.deepEqual(registryGaps(db.sqlite).sort(), ['announcements.approved_by не описана в списке', 'events.giver не описана в списке']);
  });

  it('от противного: новая таблица с user_id', () => {
    const db = createMigratedD1();
    db.sqlite.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, text TEXT NOT NULL)');
    assert.deepEqual(registryGaps(db.sqlite), ['таблицы notes нет в списке']);
  });

  it('от противного: в списке колонка, которой нет в схеме, и таблица без решения', () => {
    const db = createMigratedD1();
    const copy = {
      ...REGISTRY,
      pairs: { ...REGISTRY.pairs, people: { ...REGISTRY.pairs.people, helper: MEMBER } },
      exclusions: { ...REGISTRY.exclusions, onLeave: undefined },
    };
    assert.deepEqual(registryGaps(db.sqlite, copy).sort(), ['exclusions: не задано onLeave', 'pairs.helper — в списке, но нет в схеме']);
  });
});

// ---------- построители ----------

const fakeDb = { prepare: (sql) => ({ sql, bind: (...args) => ({ sql, args }) }) };
const GUARD = 'EXISTS (SELECT 1 FROM t WHERE x = ?)';

// Каждый оператор — с условием в скобках в конце и параметром условия последним
function assertGuarded(stmts) {
  assert.ok(stmts.length > 0);
  for (const s of stmts) {
    assert.ok(s.sql.endsWith(` AND (${GUARD})`), s.sql);
    assert.equal(s.args.at(-1), 'g', s.sql);
  }
}

describe('построители операторов', () => {
  it('удаление события: все таблицы события кроме журнала, сообщения обращений раньше обращений, событие последним', () => {
    const stmts = eventDataDeleteStmts(fakeDb, 7, {}, GUARD, 'g');
    assertGuarded(stmts);
    const sql = stmts.map((s) => s.sql);
    assert.match(sql.at(-1), /^DELETE FROM events WHERE id = \?/);
    for (const t of ['members', 'exclusions', 'fixed_pairs', 'pairs', 'messages', 'announcements', 'join_requests', 'removed_members', 'support_threads']) {
      assert.equal(sql.filter((s) => s.startsWith(`DELETE FROM ${t} WHERE event_id = ?`)).length, 1, t);
    }
    assert.ok(sql.findIndex((s) => s.startsWith('DELETE FROM support_messages')) < sql.findIndex((s) => s.startsWith('DELETE FROM support_threads')));
    assert.ok(!sql.some((s) => /audit|users|families|outbox/.test(s.split(' WHERE ')[0])), 'журнал, люди, семьи, очередь не трогаются');
  });

  it('сброс: участие владельца остаётся с пустыми письмом и адресом, строка события остаётся', () => {
    const stmts = eventDataDeleteStmts(fakeDb, 7, { keepMember: 9001, keepEvent: true });
    const sql = stmts.map((s) => s.sql);
    assert.ok(!sql.some((s) => s.startsWith('DELETE FROM events')));
    const del = stmts.find((s) => s.sql.startsWith('DELETE FROM members'));
    assert.match(del.sql, /user_id != \?/);
    assert.deepEqual(del.args, [7, 9001]);
    const clear = stmts.find((s) => s.sql.startsWith('UPDATE members'));
    assert.match(clear.sql, /SET wishlist = \?, wishlist_updated_at = \?, delivery = \?, delivery_updated_at = \? WHERE event_id = \? AND \(1\)$/);
    assert.deepEqual(clear.args, ['', 0, '', 0, 7]);
  });

  it('удаление участника: исключения, закреплённые пары, переписка, обращения; строка участника последней', () => {
    const stmts = memberDataDeleteStmts(fakeDb, 7, 100, GUARD, 'g');
    assertGuarded(stmts);
    assert.deepEqual(stmts.map((s) => s.sql.split(' WHERE ')[0]), [
      'DELETE FROM exclusions', 'DELETE FROM fixed_pairs', 'DELETE FROM messages', 'DELETE FROM support_messages',
      'DELETE FROM support_threads', 'DELETE FROM members',
    ]);
    // Подстрока, на которую опирается beforeWrite в tests/atomic.test.mjs
    assert.ok(stmts.at(-1).sql.startsWith('DELETE FROM members WHERE event_id = ? AND user_id = ?'));
    assert.match(stmts[0].sql, /event_id = \? AND \(giver = \? OR receiver = \?\) AND/);
  });

  it('перенос: колонки «кто сделал» и получатель очереди не трогаются, запись человека — последней', () => {
    const merge = [{ event_id: 7, set: { wishlist: 'н', wishlist_updated_at: 2, delivery: 'с', delivery_updated_at: 1 } }];
    const stmts = personTransferStmts(fakeDb, 100, 200, { merge }, GUARD, 'g');
    assertGuarded(stmts);
    const sql = stmts.map((s) => s.sql);
    assert.match(sql.at(-1), /^DELETE FROM users WHERE tg_id = \?/);
    assert.deepEqual(stmts.at(-1).args, [100, 'g']);
    for (const c of ['actor', 'author', 'created_by', 'decided_by', 'removed_by', 'closed_by', 'chat_id']) {
      assert.ok(!sql.some((s) => new RegExp(`SET ${c} = `).test(s)), c);
    }
    for (const c of ['santa', 'ward', 'giver', 'receiver', 'sender', 'assignee']) assert.ok(sql.some((s) => s.includes(`SET ${c} = ?`)), c);
    // Слияние: участие нового удаляется, в участие старого — письмо и адрес по решению, затем все участия старого — новому
    const iDel = sql.indexOf('DELETE FROM members WHERE event_id = ? AND user_id = ? AND (' + GUARD + ')');
    assert.deepEqual(stmts[iDel].args, [7, 200, 'g']);
    assert.deepEqual(stmts[iDel + 1].args, ['н', 2, 'с', 1, 7, 100, 'g']);
    assert.ok(sql[iDel + 2].startsWith('UPDATE members SET user_id = ? WHERE user_id = ?'));
    assert.ok(sql.includes(`DELETE FROM exclusions WHERE (giver = ? OR receiver = ? OR giver = receiver) AND (${GUARD})`));
    assert.ok(sql.includes(`DELETE FROM family_members WHERE (user_id = ?) AND (${GUARD})`));
    // Свои правила обращений: закрыть до переноса, «сам себе ответственный» — после
    const close = sql.findIndex((s) => s.startsWith("UPDATE support_threads SET status = 'closed'"));
    const self = sql.findIndex((s) => s.startsWith('UPDATE support_threads SET assignee = 0'));
    assert.ok(close < sql.indexOf(`UPDATE support_threads SET user_id = ? WHERE user_id = ? AND (${GUARD})`) && self > close);
    // Отметки «удалён» снимаются после переноса участий
    assert.ok(sql.findIndex((s) => s.includes('FROM removed_members WHERE user_id = ? AND event_id IN')) > iDel + 2);
  });

  it('слияние участий: письмо и адрес — нового, если не пусты, каждое со своим временем', () => {
    const from = { event_id: 3, wishlist: 'старое', wishlist_updated_at: 1, delivery: 'адрес старого', delivery_updated_at: 2 };
    assert.deepEqual(mergeMembership(from, { event_id: 3, wishlist: '  новое ', wishlist_updated_at: 5, delivery: ' \n', delivery_updated_at: 6 }),
      { event_id: 3, set: { wishlist: '  новое ', wishlist_updated_at: 5, delivery: 'адрес старого', delivery_updated_at: 2 } });
    assert.deepEqual(mergeMembership(from, { event_id: 3, wishlist: ' ', wishlist_updated_at: 5, delivery: 'новый', delivery_updated_at: 6 }).set,
      { wishlist: 'старое', wishlist_updated_at: 1, delivery: 'новый', delivery_updated_at: 6 });
  });
});

test('построители работают на настоящей схеме (операторы выполняются без ошибок)', async () => {
  const db = createMigratedD1();
  db.sqlite.exec("INSERT INTO users (tg_id, name, registered) VALUES (100, 'А', 1), (200, 'Б', 1)");
  db.sqlite.exec("INSERT INTO events (id, title, invite_code) VALUES (7, 'Е', 'x')");
  db.sqlite.exec("INSERT INTO members (event_id, user_id, wishlist) VALUES (7, 100, 'а'), (7, 200, '')");
  const ex = 'EXISTS (SELECT 1 FROM users WHERE tg_id = ?)';
  const merge = [mergeMembership({ event_id: 7, wishlist: 'а', wishlist_updated_at: 0, delivery: '', delivery_updated_at: 0 },
    { event_id: 7, wishlist: '', wishlist_updated_at: 0, delivery: '', delivery_updated_at: 0 })];
  await db.batch(personTransferStmts(db, 100, 200, { merge }, ex, 100));
  assert.deepEqual(db.sqlite.prepare('SELECT user_id, wishlist FROM members').all().map((r) => ({ ...r })), [{ user_id: 200, wishlist: 'а' }]);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  // Второй раз — старой записи нет: ничего не меняется
  const again = await db.batch(personTransferStmts(db, 100, 200, { merge }, ex, 100));
  assert.ok(again.every((r) => r.meta.changes === 0));
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM members').get().n, 1);
  await db.batch(memberDataDeleteStmts(db, 7, 200));
  await db.batch(eventDataDeleteStmts(db, 7));
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
});

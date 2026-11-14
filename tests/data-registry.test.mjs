// Один список данных события и человека (018, specs/018-data-registry/): тест схемы — REGISTRY сверяется со схемой из
// миграций в обе стороны (новая таблица или колонка с событием или человеком роняет тест, пока её не описали), и
// построители операторов. Тест «после действия не остаётся строк» — ниже, на «мире» (US3).
import { describe, it, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createMigratedD1 } from './support/d1-sqlite.mjs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { seeded } from './support/draw-cases.mjs';
import {
  REGISTRY, MEMBER, ACTOR, RECIPIENT, SELF, NOT_PERSON, columnsWith,
  eventDataDeleteStmts, memberDataDeleteStmts, personTransferStmts, mergeMembership,
} from '../src/db.js';

const ROLES = new Set([MEMBER, ACTOR, RECIPIENT, SELF, NOT_PERSON]);

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
    if (columnsWith(spec, MEMBER, ACTOR).length && !['update', 'dedupe', 'merge'].includes(spec.onTransfer)) {
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

  it('перенос: колонки «кто сделал» переносятся (025), получатель очереди — нет, запись человека — последней', () => {
    const merge = [{ event_id: 7, set: { wishlist: 'н', wishlist_updated_at: 2, delivery: 'с', delivery_updated_at: 1 } }];
    const stmts = personTransferStmts(fakeDb, 100, 200, { merge }, GUARD, 'g');
    assertGuarded(stmts);
    const sql = stmts.map((s) => s.sql);
    assert.match(sql.at(-1), /^DELETE FROM users WHERE tg_id = \?/);
    assert.deepEqual(stmts.at(-1).args, [100, 'g']);
    assert.ok(!sql.some((s) => /SET chat_id = /.test(s)), 'chat_id');
    for (const c of ['santa', 'ward', 'giver', 'receiver', 'sender', 'assignee', 'actor', 'author', 'created_by', 'decided_by', 'removed_by', 'closed_by']) {
      assert.ok(sql.some((s) => s.includes(`SET ${c} = ?`)), c);
    }
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

// ---------- после действия не остаётся строк (US3) ----------
// «Богатый мир»: событие A (адрес нужен, владелец участвует, жеребьёвка проведена), событие B (с одобрением заявок),
// событие C (p1 удалён организатором). Поиск строк идёт по REGISTRY — все колонки события и человека (полноту списка
// проверяет тест схемы выше); что может остаться — по таблице «что делает сейчас» файла шага (data-model.md).

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const fresh = { id: 777, name: 'Новый аккаунт', username: 'fresh' };
const P = Array.from({ length: 6 }, (_, i) => ({ id: 101 + i, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));
const [p1, p2, p3, p4, p5, p6] = P;
// Что остаётся у старого аккаунта после переноса — явно (не по ролям списка, чтобы тест не доверял самому списку):
// только получатель сообщения в очереди (до 025 — и ссылки «кто сделал»)
const STAYS = ['outbox.chat_id'];
// Ссылки «кто сделал» — с 025 переносятся вместе с человеком
const ACTOR_COLUMNS = [
  'announcements.author', 'audit.actor', 'events.created_by', 'families.created_by', 'join_requests.decided_by',
  'removed_members.removed_by', 'support_messages.sender', 'support_threads.assignee', 'support_threads.closed_by',
];

test('остатки после переноса — только получатель очереди; «кто сделал» — роль ACTOR', () => {
  const recipients = Object.entries(REGISTRY).flatMap(([t, s]) => columnsWith(s, RECIPIENT).map((c) => `${t}.${c}`));
  assert.deepEqual(recipients.sort(), [...STAYS].sort());
  const actors = Object.entries(REGISTRY).flatMap(([t, s]) => columnsWith(s, ACTOR).map((c) => `${t}.${c}`));
  assert.deepEqual(actors.sort(), [...ACTOR_COLUMNS].sort());
});

// Случайные числа — с зерном: удаление после жеребьёвки перестраивает пары случайно, тест не должен зависеть от удачи
async function seededRun(fn) {
  const real = Math.random;
  Math.random = seeded(18);
  try {
    return await fn();
  } finally {
    Math.random = real;
  }
}

async function rich() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const create = async (title) => (await w.api(boss, 'admin.events.create', { title })).event.id;
  const codeOf = async (id) => /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
  const [A, B, C] = [await create('Альфа'), await create('Бета'), await create('Гамма')];

  // A: адрес доставки, владелец участвует, админ и 6 игроков по ссылке
  await w.api(boss, 'admin.game', { event: A, delivery_on: true });
  await w.api(boss, 'admin.participate', { event: A, on: true });
  const codeA = await codeOf(A);
  for (const u of [adm, ...P]) {
    await w.say(u, '/start ' + codeA);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { id: adm.id });

  // B: с одобрением — новый аккаунт, p1 и p2 приняты, заявка p3 ждёт
  await w.api(boss, 'admin.game', { event: B, approval: true });
  const codeB = await codeOf(B);
  await w.say(fresh, '/start ' + codeB);
  await w.say(fresh, fresh.name);
  for (const u of [p1, p2, p3]) await w.say(u, '/start ' + codeB);
  for (const r of w.query('SELECT id, user_id FROM join_requests WHERE event_id = ?', B)) {
    if (r.user_id !== p3.id) await w.api(adm, 'admin.request.decide', { event: B, id: r.id, approve: true });
  }

  // C: p1 вступил и удалён организатором
  await w.say(p1, '/start ' + (await codeOf(C)));
  await w.api(adm, 'admin.remove', { event: C, id: p1.id });

  // Письма и адреса
  for (const u of [boss, p1, p2]) {
    await w.api(u, 'wishlist.save', { event: A, text: 'письмо ' + u.name });
    await w.api(u, 'delivery.save', { event: A, text: 'адрес ' + u.name });
  }
  await w.api(p1, 'wishlist.save', { event: B, text: 'письмо в Бете' });
  // Исключения, закреплённая пара, семья
  await w.api(adm, 'admin.exclusion.add', { event: A, giver: p1.id, receiver: p2.id });
  await w.api(adm, 'admin.exclusion.add', { event: B, giver: p2.id, receiver: p1.id });
  await w.api(boss, 'admin.fixed.add', { event: A, giver: p3.id, receiver: p1.id });
  await w.api(boss, 'admin.fixed.add', { event: A, giver: p2.id, receiver: p5.id });
  await w.api(boss, 'admin.family.save', { name: 'Семья', members: [p1.id, p4.id] });
  // Обращения: у p1 — закрытое им самим (с ответом админа) и новое открытое; у p2 — в A и в B
  await w.api(p1, 'support.send', { event: A, text: 'вопрос' });
  const th = w.query('SELECT id FROM support_threads WHERE user_id = ?', p1.id)[0].id;
  await w.api(adm, 'admin.support.take', { event: A, thread: th });
  await w.api(adm, 'admin.support.send', { event: A, thread: th, text: 'ответ' });
  await w.api(p1, 'support.close', { event: A });
  await w.api(p1, 'support.send', { event: A, text: 'ещё вопрос' });
  await w.api(p2, 'support.send', { event: A, text: 'вопрос p2' });
  await w.api(p2, 'support.send', { event: B, text: 'вопрос p2 в Бете' });
  // Объявление, удалённый организатором, жеребьёвка, переписка пар
  await w.api(adm, 'admin.announce', { event: A, text: 'Всем привет' });
  await w.api(adm, 'admin.remove', { event: A, id: p6.id });
  await w.api(adm, 'admin.draw', { event: A });
  for (const u of [p1, p2]) {
    await w.api(u, 'ward.get', { event: A });
    await w.api(u, 'message.send', { event: A, to: 'ward', text: 'привет подопечному' });
  }
  const santaOfP1 = w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', A, p1.id)[0].santa;
  await w.api([boss, adm, ...P].find((u) => u.id === santaOfP1), 'message.send', { event: A, to: 'ward', text: 'привет, p1' });
  return { w, A, B, C };
}

// Строки события: таблица → число (по колонке события или через родителя)
function eventRows(w, id) {
  const out = {};
  for (const [t, s] of Object.entries(REGISTRY)) {
    const parent = s.via && REGISTRY[s.via.parent];
    const where = s.event ? `${s.event} = ?` : parent?.event ? `${s.via.column} IN (SELECT id FROM ${s.via.parent} WHERE ${parent.event} = ?)` : '';
    if (!where) continue;
    const n = w.query(`SELECT COUNT(*) AS n FROM ${t} WHERE ${where}`, id)[0].n;
    if (n) out[t] = n;
  }
  return out;
}

// Строки, чей родитель (via) исчез
function orphans(w) {
  const out = {};
  for (const [t, s] of Object.entries(REGISTRY)) {
    if (!s.via) continue;
    const n = w.query(`SELECT COUNT(*) AS n FROM ${t} WHERE ${s.via.column} NOT IN (SELECT id FROM ${s.via.parent})`)[0].n;
    if (n) out[t] = n;
  }
  return out;
}

// Где встречается человек: «таблица.колонка» → роль; event — только строки этого события
function personRows(w, id, event = 0) {
  const out = {};
  for (const [t, s] of Object.entries(REGISTRY)) {
    const parent = s.via && REGISTRY[s.via.parent];
    let scope = '';
    if (event) {
      if (s.event) scope = ` AND ${s.event} = ${Number(event)}`;
      else if (parent?.event) scope = ` AND ${s.via.column} IN (SELECT id FROM ${s.via.parent} WHERE ${parent.event} = ${Number(event)})`;
      else continue;
    }
    for (const [c, role] of Object.entries(s.people || {})) {
      if (role !== NOT_PERSON && w.query(`SELECT COUNT(*) AS n FROM ${t} WHERE ${c} = ?${scope}`, id)[0].n) out[`${t}.${c}`] = role;
    }
  }
  return out;
}
// Удаление участника и выход не трогают ссылки «кто сделал»; перенос — переносит (025): там stays = STAYS
const kept = (rows, stays = [...STAYS, ...ACTOR_COLUMNS]) => Object.keys(rows).filter((k) => !stays.includes(k)).sort();

describe('после действия не остаётся строк события и человека', () => {
  after(restoreFetch);

  it('удаление события: остаётся только журнал события; другие события не затронуты', () => seededRun(async () => {
    const { w, A, B, C } = await rich();
    const others = [eventRows(w, A), eventRows(w, C)];
    assert.ok(Object.keys(eventRows(w, B)).length >= 5, 'в B были данные');
    await w.api(boss, 'admin.event.delete', { event: B, confirm: 'УДАЛИТЬ' });
    assert.deepEqual(Object.keys(eventRows(w, B)), ['audit']);
    assert.deepEqual(orphans(w), {});
    assert.deepEqual([eventRows(w, A), eventRows(w, C)], others);
    assert.equal(w.query("SELECT COUNT(*) AS n FROM audit WHERE event_id = 0 AND action = 'event.delete'")[0].n, 1);
  }));

  it('полный сброс: строка события по умолчанию, участие владельца без письма и адреса, журнал', () => seededRun(async () => {
    const { w, A, B, C } = await rich();
    const others = [eventRows(w, B), eventRows(w, C)];
    const code = w.query('SELECT invite_code FROM events WHERE id = ?', A)[0].invite_code;
    await w.api(boss, 'admin.reset.full', { event: A, confirm: 'СБРОС' });
    assert.deepEqual(Object.keys(eventRows(w, A)).sort(), ['audit', 'events', 'members']);
    assert.deepEqual(w.query('SELECT user_id, wishlist, wishlist_updated_at, delivery, delivery_updated_at FROM members WHERE event_id = ?', A),
      [{ user_id: boss.id, wishlist: '', wishlist_updated_at: 0, delivery: '', delivery_updated_at: 0 }]);
    const ev = w.query('SELECT * FROM events WHERE id = ?', A)[0];
    assert.equal(ev.draw_done, 0);
    assert.equal(ev.delivery_on, 0);
    assert.equal(ev.registration_open, 1);
    assert.notEqual(ev.invite_code, code);
    assert.deepEqual(orphans(w), {});
    assert.deepEqual([eventRows(w, B), eventRows(w, C)], others);
  }));

  it('удаление участника после жеребьёвки: в событии — только отметка «удалён»; пары остальных целы', () => seededRun(async () => {
    const { w, A, B } = await rich();
    assert.ok(kept(personRows(w, p2.id, A)).length >= 6, 'у p2 в A были данные');
    await w.api(adm, 'admin.remove', { event: A, id: p2.id });
    assert.deepEqual(kept(personRows(w, p2.id, A)), ['removed_members.user_id']);
    assert.deepEqual(orphans(w), {});
    // Каждый участник A дарит и получает ровно один раз
    const ids = w.query('SELECT user_id FROM members WHERE event_id = ? ORDER BY user_id', A).map((r) => r.user_id);
    assert.deepEqual(w.query('SELECT santa FROM pairs WHERE event_id = ? ORDER BY santa', A).map((r) => r.santa), ids);
    assert.deepEqual(w.query('SELECT ward FROM pairs WHERE event_id = ? ORDER BY ward', A).map((r) => r.ward), ids);
    assert.ok(personRows(w, p2.id, B)['members.user_id'], 'участие в B осталось');
  }));

  it('удаление участника до жеребьёвки: в событии — только отметка «удалён» и прошлая заявка', () => seededRun(async () => {
    const { w, A, B } = await rich();
    assert.ok(kept(personRows(w, p2.id, B)).length >= 4, 'у p2 в B были данные');
    await w.api(adm, 'admin.remove', { event: B, id: p2.id });
    assert.deepEqual(kept(personRows(w, p2.id, B)), ['join_requests.user_id', 'removed_members.user_id']);
    assert.deepEqual(orphans(w), {});
    assert.ok(personRows(w, p2.id, A)['members.user_id'], 'участие в A осталось');
  }));

  it('перенос: старый аккаунт остаётся только в очереди; данные и ссылки «кто сделал» — у нового (025)', () => seededRun(async () => {
    const { w, A, B, C } = await rich();
    const before = kept(personRows(w, p1.id), STAYS);
    assert.ok(before.length >= 12, 'у p1 были данные почти во всех таблицах');
    await w.api(boss, 'admin.transfer', { from: p1.id, to: fresh.id });
    const left = personRows(w, p1.id);
    assert.deepEqual(kept(left, STAYS), [], 'у старого аккаунта — только очередь');
    assert.ok(!left['support_threads.closed_by'], 'закрытое им обращение подписано уже не старым аккаунтом');
    assert.ok(personRows(w, fresh.id)['support_threads.closed_by'], '…а новым');
    // Всё, что было у старого как у участника, теперь у нового
    const now = kept(personRows(w, fresh.id), STAYS);
    for (const k of before) if (k !== 'users.tg_id') assert.ok(now.includes(k), k);
    // B: одно участие, письмо старого (у нового пустое); A: письмо и адрес старого; C: отметка «удалён» перешла
    assert.deepEqual(w.query('SELECT user_id, wishlist FROM members WHERE event_id = ? AND user_id IN (?, ?)', B, p1.id, fresh.id),
      [{ user_id: fresh.id, wishlist: 'письмо в Бете' }]);
    assert.deepEqual(w.query('SELECT wishlist, delivery FROM members WHERE event_id = ? AND user_id = ?', A, fresh.id),
      [{ wishlist: 'письмо ' + p1.name, delivery: 'адрес ' + p1.name }]);
    assert.equal(w.query('SELECT COUNT(*) AS n FROM removed_members WHERE event_id = ? AND user_id = ?', C, fresh.id)[0].n, 1);
    assert.deepEqual(orphans(w), {});
  }));
});

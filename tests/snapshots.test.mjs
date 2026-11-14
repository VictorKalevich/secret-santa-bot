// Снимки жеребьёвки (020, src/snapshots.js): жеребьёвка записывается, только если участники, исключения, семьи и
// закреплённые пары те же, что при расчёте пар. Формула каждого снимка — в коде и в запросе; здесь они сверяются на
// случайных данных (паритет), а перестановка партнёров в исключениях должна менять снимок (FR-2013, FR-2014).
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { createMigratedD1 } from './support/d1-sqlite.mjs';
import { drawMembersQuery, exclusionsQuery, familyRowsQuery, fixedPairsQuery } from '../src/db.js';
import { SNAPSHOTS, drawSnapshot, snapshotGuard } from '../src/snapshots.js';

after(restoreFetch);

// Детерминированные случайные числа (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Идентификатор Telegram: маленький, обычный (~2^33) или почти 2^52 — числа снимков проверяются и на переполнение
function telegramId(r) {
  const kind = r();
  if (kind < 0.2) return 100 + Math.floor(r() * 900);
  if (kind < 0.6) return 5e9 + Math.floor(r() * 3e9);
  return Math.floor(r() * 2 ** 20) * 2 ** 32 + Math.floor(r() * 2 ** 32);
}

// Тестовая база: событие 1 (проверяемое) и событие 2 (его строки не должны влиять)
function randomBase(seed) {
  const r = rng(seed);
  const db = createMigratedD1();
  const ids = new Set();
  while (ids.size < 40 + Math.floor(r() * 41)) ids.add(telegramId(r));
  const people = [...ids];
  const sql = [
    "INSERT INTO events (id, title, invite_code, families_on) VALUES (1, 'Проверяемое', 'a', 1), (2, 'Другое', 'b', 1)",
  ];
  const pick = (list) => list[Math.floor(r() * list.length)];
  const inEvent = [];
  people.forEach((id, i) => {
    sql.push(`INSERT INTO users (tg_id, name, registered) VALUES (${id}, 'u${i}', ${r() < 0.85 ? 1 : 0})`);
    const where = r();
    if (where < 0.7) {
      sql.push(`INSERT INTO members (event_id, user_id, joined_at) VALUES (1, ${id}, ${i})`);
      inEvent.push(id);
    } else if (where < 0.9) {
      sql.push(`INSERT INTO members (event_id, user_id, joined_at) VALUES (2, ${id}, ${i})`);
    }
  });
  // Семьи с большими номерами — и с людьми вне события
  const families = Array.from({ length: 6 }, () => 1 + Math.floor(r() * 2 ** 40));
  for (const f of families) sql.push(`INSERT INTO families (id, name, created_at) VALUES (${f}, 'f', 0)`);
  for (const id of people) if (r() < 0.5) sql.push(`INSERT INTO family_members (user_id, family_id) VALUES (${id}, ${pick(families)})`);
  const links = (table, event, n, unique) => {
    const used = new Set();
    for (let k = 0; k < n; k++) {
      const g = pick(inEvent);
      const rc = pick(inEvent);
      if (g === rc || used.has(unique(g, rc))) continue;
      used.add(unique(g, rc));
      sql.push(`INSERT INTO ${table} (event_id, giver, receiver) VALUES (${event}, ${g}, ${rc})`);
    }
  };
  links('exclusions', 1, 30, (g, rc) => `${g}:${rc}`);
  links('exclusions', 2, 10, (g, rc) => `${g}:${rc}`);
  // Закреплённые: один подопечный у дарящего и один Санта у получателя
  links('fixed_pairs', 1, 12, (g, rc) => `g${g}`);
  db.sqlite.exec(sql.join(';\n').replace(/INSERT INTO fixed_pairs/g, 'INSERT OR IGNORE INTO fixed_pairs'));
  return db;
}

// Те же чтения, что у checkDraw
async function readLikeCheckDraw(db, eventId) {
  const rows = async (stmt) => (await stmt.all()).results;
  const members = await rows(drawMembersQuery(db, eventId));
  return {
    ids: members.filter((m) => m.registered).map((m) => m.user_id),
    exclusions: await rows(exclusionsQuery(db, eventId)),
    families: await rows(familyRowsQuery(db)),
    fixed: await rows(fixedPairsQuery(db, eventId)),
  };
}

const inBase = (db, sql, eventId) => db.sqlite.prepare(`SELECT ${sql} AS v`).get(eventId).v;

describe('снимки: формула в коде = выражение в базе', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`случайные данные, зерно ${seed}: все четыре снимка совпадают`, async () => {
      const db = randomBase(seed);
      const data = await readLikeCheckDraw(db, 1);
      assert.ok(data.ids.length > 10 && data.exclusions.length > 5 && data.fixed.length > 2, 'данные не вырождены');
      for (const [name, s] of Object.entries(SNAPSHOTS)) assert.equal(s.js(data), inBase(db, s.sql, 1), name);
      // Условие захвата жеребьёвки целиком — истинно на тех же данных
      const g = snapshotGuard(1, drawSnapshot({ families_on: 1 }, data));
      assert.equal(db.sqlite.prepare(`SELECT ${g.sql} AS ok`).get(...g.args).ok, 1);
    });
  }

  it('числа меньше 2^53: суммы по модулю 2^52 и при идентификаторах около 2^52', async () => {
    const db = randomBase(11);
    const data = await readLikeCheckDraw(db, 1);
    for (const s of Object.values(SNAPSHOTS)) {
      for (const part of s.js(data).split(':')) assert.ok(Number(part) < 2 ** 52, part);
    }
    assert.ok(data.ids.some((id) => id > 2 ** 50), 'есть большие идентификаторы');
  });

  it('пустые данные — нули; семьи выключены — снимок семей пустой и не сравнивается', async () => {
    const db = createMigratedD1();
    db.sqlite.exec("INSERT INTO events (id, title, invite_code, families_on) VALUES (1, 'Пустое', 'a', 0)");
    const data = await readLikeCheckDraw(db, 1);
    for (const [name, s] of Object.entries(SNAPSHOTS)) assert.equal(s.js(data), inBase(db, s.sql, 1), name);
    assert.equal(SNAPSHOTS.members.js(data), '0:0');
    assert.equal(SNAPSHOTS.exclusions.js(data), '0:0:0:0');
    const snap = drawSnapshot({ families_on: 0 }, data);
    assert.equal(snap.families, '');
    const g = snapshotGuard(1, { ...snap, families: '' });
    assert.equal(db.sqlite.prepare(`SELECT ${g.sql} AS ok`).get(...g.args).ok, 1);
  });

  it('от противного: перестановка партнёров в исключениях меняет снимок — в коде и в базе', async () => {
    const db = randomBase(3);
    const [a, b, c, d] = (await readLikeCheckDraw(db, 1)).ids;
    db.sqlite.exec(`DELETE FROM exclusions WHERE event_id = 1;
      INSERT INTO exclusions (event_id, giver, receiver) VALUES (1, ${a}, ${b}), (1, ${c}, ${d})`);
    const before = await readLikeCheckDraw(db, 1);
    const was = SNAPSHOTS.exclusions.js(before);
    db.sqlite.exec(`DELETE FROM exclusions WHERE event_id = 1;
      INSERT INTO exclusions (event_id, giver, receiver) VALUES (1, ${a}, ${d}), (1, ${c}, ${b})`);
    const after = await readLikeCheckDraw(db, 1);
    const now = SNAPSHOTS.exclusions.js(after);
    assert.notEqual(now, was);
    assert.equal(was.split(':').slice(0, 3).join(':'), now.split(':').slice(0, 3).join(':'), 'число и суммы те же');
    assert.equal(inBase(db, SNAPSHOTS.exclusions.sql, 1), now);
    // То же у закреплённых пар
    db.sqlite.exec(`DELETE FROM fixed_pairs WHERE event_id = 1;
      INSERT INTO fixed_pairs (event_id, giver, receiver) VALUES (1, ${a}, ${b}), (1, ${c}, ${d})`);
    const fixedWas = SNAPSHOTS.fixed.js(await readLikeCheckDraw(db, 1));
    db.sqlite.exec(`DELETE FROM fixed_pairs WHERE event_id = 1;
      INSERT INTO fixed_pairs (event_id, giver, receiver) VALUES (1, ${a}, ${d}), (1, ${c}, ${b})`);
    assert.notEqual(SNAPSHOTS.fixed.js(await readLikeCheckDraw(db, 1)), fixedWas);
  });

  it('снимок участников и семей меняется от регистрации, выхода и смены семьи; исключения другого события не влияют', async () => {
    const db = randomBase(5);
    const base = drawSnapshot({ families_on: 1 }, await readLikeCheckDraw(db, 1));
    const [x, y] = (await readLikeCheckDraw(db, 1)).ids;
    db.sqlite.exec('INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) VALUES (2, 1, 2)');
    assert.deepEqual(drawSnapshot({ families_on: 1 }, await readLikeCheckDraw(db, 1)), base, 'чужое событие');
    db.sqlite.exec(`UPDATE users SET registered = 0 WHERE tg_id = ${x}`);
    const unreg = drawSnapshot({ families_on: 1 }, await readLikeCheckDraw(db, 1));
    assert.notEqual(unreg.members, base.members);
    db.sqlite.exec(`UPDATE users SET registered = 1 WHERE tg_id = ${x};
      DELETE FROM family_members WHERE user_id IN (${x}, ${y});
      INSERT INTO family_members (user_id, family_id) VALUES (${x}, 777), (${y}, 778)`);
    const fam = drawSnapshot({ families_on: 1 }, await readLikeCheckDraw(db, 1));
    assert.equal(fam.members, base.members);
    assert.notEqual(fam.families, base.families);
    assert.equal(fam.families, inBase(db, SNAPSHOTS.families.sql, 1));
  });
});

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));

describe('снимок исключений в гонке', () => {
  it('исключения переставлены между расчётом и записью пар — жеребьёвка не записывается', async () => {
    const w = await startWorld();
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    const ev = (await w.api(boss, 'admin.events.create', { title: 'Снимок' })).event;
    const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev.id })).settings.invite_link)[1];
    const [a, b, c, d, ...rest] = mk(8);
    for (const u of [a, b, c, d, ...rest]) {
      await w.say(u, '/start ' + code);
      await w.say(u, u.name);
    }
    await w.api(boss, 'admin.exclusion.add', { event: ev.id, giver: a.id, receiver: b.id });
    await w.api(boss, 'admin.exclusion.add', { event: ev.id, giver: c.id, receiver: d.id });
    // {А→Б, В→Г} → {А→Г, В→Б}: число и суммы дарящих и получателей те же
    w.beforeWrite('UPDATE events SET draw_done = 1', async () => {
      w.sql(`DELETE FROM exclusions WHERE event_id = ${ev.id};
             INSERT INTO exclusions (event_id, giver, receiver) VALUES (${ev.id}, ${a.id}, ${d.id}), (${ev.id}, ${c.id}, ${b.id});`);
    });
    const r = await w.api(boss, 'admin.draw', { event: ev.id }, true);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, 'Участники, исключения или семьи изменились во время жеребьёвки — попробуй ещё раз.');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', ev.id)[0].n, 0, 'пар нет');
    assert.equal(w.query('SELECT draw_done FROM events WHERE id = ?', ev.id)[0].draw_done, 0);
  });
});

// Подмена D1 на node:sqlite (016): каждое свойство настоящей D1, на которое опирается src/
// (docs/refactoring/prototypes/README.md, «Что учтено в подмене D1»; specs/016-fast-tests/research.md, R2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1, createMigratedD1 } from './support/d1-sqlite.mjs';
import { REQUIRED_SCHEMA } from '../src/db.js';

function table() {
  const db = createD1();
  db.sqlite.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, s TEXT)');
  return db;
}

test('D1: first() — строка или null; first(колонка) — значение или null', async () => {
  const db = table();
  await db.prepare('INSERT INTO t (id, n, s) VALUES (1, 5, NULL)').run();
  assert.deepEqual(await db.prepare('SELECT id, n FROM t WHERE id = ?').bind(1).first(), { id: 1, n: 5 });
  assert.equal(await db.prepare('SELECT id FROM t WHERE id = ?').bind(2).first(), null, 'нет строки — null');
  assert.equal(await db.prepare('SELECT n FROM t WHERE id = ?').bind(1).first('n'), 5);
  assert.equal(await db.prepare('SELECT s FROM t WHERE id = ?').bind(1).first('s'), null, 'значение NULL — null');
  assert.equal(await db.prepare('SELECT n FROM t WHERE id = ?').bind(2).first('n'), null, 'нет строки — null');
});

test('D1: meta.changes — строки этого оператора, у SELECT после записи — 0', async () => {
  const db = table();
  const ins = await db.prepare('INSERT INTO t (id) VALUES (1), (2), (3)').run();
  assert.equal(ins.meta.changes, 3);
  const sel = await db.prepare('SELECT * FROM t').all();
  assert.equal(sel.meta.changes, 0, 'SQLite changes() вернул бы 3 от предыдущего оператора');
  const upd = await db.prepare('UPDATE t SET n = 1 WHERE id >= ?').bind(2).run();
  assert.equal(upd.meta.changes, 2);
  const none = await db.prepare('UPDATE t SET n = 1 WHERE id = ?').bind(99).run();
  assert.equal(none.meta.changes, 0, 'условие захвата не выполнено — 0');
  assert.equal((await db.prepare('DELETE FROM t WHERE id = 1').run()).meta.changes, 1);
});

test('D1: batch — одна транзакция, результат на оператор, RETURNING — в results', async () => {
  const db = table();
  const out = await db.batch([
    db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind(1, 10),
    db.prepare('UPDATE t SET n = n + 1 WHERE id = ? RETURNING id, n').bind(1),
    db.prepare('UPDATE t SET n = 0 WHERE id = ?').bind(42),
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[0].meta.changes, 1);
  assert.deepEqual(out[1].results, [{ id: 1, n: 11 }]);
  assert.equal(out[2].meta.changes, 0);

  // Ошибка любого оператора откатывает все
  await assert.rejects(db.batch([
    db.prepare('UPDATE t SET n = 100 WHERE id = 1'),
    db.prepare('INSERT INTO t (id) VALUES (2)'),
    db.prepare('INSERT INTO t (id) VALUES (1)'), // повтор первичного ключа
  ]), /UNIQUE|constraint/i);
  assert.deepEqual(db.sqlite.prepare('SELECT id, n FROM t').all().map((r) => ({ ...r })), [{ id: 1, n: 11 }]);
  assert.equal(db.sqlite.isTransaction, false, 'транзакция закрыта');
});

test('D1: нумерованные параметры ?1, ?2 с повтором', async () => {
  const db = table();
  await db.prepare('INSERT INTO t (id, n, s) VALUES (?1, ?2, ?3 || \'-\' || ?3)').bind(7, 3, 'ab').run();
  assert.deepEqual(await db.prepare('SELECT n, s FROM t WHERE id = ?1 AND n < ?1').bind(7).first(), { n: 3, s: 'ab-ab' });
});

test('D1: числа привязываются как REAL, колонка INTEGER хранит целое', async () => {
  const db = table();
  assert.equal(await db.prepare('SELECT typeof(?) AS t').bind(5).first('t'), 'real');
  await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind(1, 1731600000000).run();
  const row = await db.prepare('SELECT typeof(n) AS t, n FROM t WHERE id = 1').first();
  assert.deepEqual(row, { t: 'integer', n: 1731600000000 });
});

test('D1: boolean → 0/1, undefined — ошибка D1_TYPE_ERROR', async () => {
  const db = table();
  await db.prepare('INSERT INTO t (id, n) VALUES (?, ?), (?, ?)').bind(1, true, 2, false).run();
  assert.deepEqual(db.sqlite.prepare('SELECT n FROM t ORDER BY id').all().map((r) => r.n), [1, 0]);
  await assert.rejects(db.prepare('SELECT ?').bind(undefined).first(), /D1_TYPE_ERROR/);
  await assert.rejects(db.batch([db.prepare('INSERT INTO t (id) VALUES (?)').bind(undefined)]), /D1_TYPE_ERROR/);
});

test('D1: raw() — массивы значений', async () => {
  const db = table();
  await db.prepare('INSERT INTO t (id, n, s) VALUES (1, 2, \'x\')').run();
  assert.deepEqual(await db.prepare('SELECT id, n, s FROM t').raw(), [[1, 2, 'x']]);
});

test('D1: счётчик — как у metered: batch и exec — один запрос', async () => {
  const db = table();
  await db.prepare('SELECT 1').first();
  await db.prepare('SELECT 1').all();
  await db.batch([db.prepare('SELECT 1'), db.prepare('SELECT 2')]);
  await db.exec('SELECT 1');
  assert.equal(db.stats.queries, 4);
  assert.equal(db.stats.statements, 4, 'операторов: 1 + 1 + 2 (exec — мимо подсчёта операторов)');
  assert.deepEqual(db.stats.log, ['SELECT 1', 'SELECT 1', 'batch(2)', 'exec']);
});

test('D1: схема из migrations/ — версия, которую требует код', async () => {
  const db = createMigratedD1();
  assert.equal(Number(await db.prepare("SELECT value FROM settings WHERE key = 'schema'").first('value')), REQUIRED_SCHEMA);
});

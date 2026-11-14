// Юнит-тесты серверных модулей без Worker (009): счётчик запросов, отправка очереди в пределах бюджета, cron.
// База — подмена D1 на node:sqlite со схемой из миграций (016): запросы не узнаются по подстроке SQL.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { metered, budgetLeft, SUBREQUEST_LIMIT } from '../src/budget.js';
import { flushOutbox } from '../src/outbox.js';
import { createD1, createMigratedD1 } from './support/d1-sqlite.mjs';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// Подменённый Telegram: считает запросы и всегда отвечает «ок»
function mockTelegram() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

// Очередь из count настоящих сообщений разным людям — «бесконечная» для одного вызова (лимит 25)
function queued(count = 100) {
  const db = createMigratedD1();
  const ins = db.sqlite.prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)');
  for (let i = 1; i <= count; i++) ins.run(1000 + i, '{"text":"x"}', Date.now());
  return db;
}
const left = (db) => db.sqlite.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;

test('бюджет: обёртка считает каждый запрос к базе, batch — как один; в batch уходят исходные операторы', async () => {
  const inner = createD1();
  inner.sqlite.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER)');
  const batched = [];
  const realBatch = inner.batch;
  inner.batch = (list) => {
    batched.push(...list);
    return realBatch(list);
  };
  const env = metered({ DB: inner });
  assert.equal(env.meter.used, 0);
  const s = env.DB.prepare('SELECT ? AS v').bind(1);
  assert.equal(await s.first('v'), 1);
  await s.all();
  await s.run();
  const out = await env.DB.batch([
    env.DB.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind(1, 1),
    env.DB.prepare('INSERT INTO t (id, n) VALUES (2, 2)'),
    env.DB.prepare('UPDATE t SET n = ? WHERE id = ? RETURNING n').bind(5, 2),
  ]);
  assert.deepEqual(out[2].results, [{ n: 5 }]);
  assert.equal(env.meter.used, 4);
  assert.equal(budgetLeft(env), SUBREQUEST_LIMIT - 4);
  assert.equal(batched.length, 3);
  for (const st of batched) {
    assert.ok(typeof st.sql === 'string' && !('raw_stmt' in st), 'в batch уходят исходные операторы, а не обёртки');
  }
  assert.equal(metered(env), env, 'повторная обёртка не создаёт второй счётчик');
});

test('бюджет: отправка очереди при 40 уже потраченных запросах не выходит за 50', async () => {
  const calls = mockTelegram();
  const db = queued();
  const env = metered({ DB: db, BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  env.meter.used = 40;
  const sent = await flushOutbox(env, 25);
  assert.ok(env.meter.used <= SUBREQUEST_LIMIT, `потрачено ${env.meter.used}`);
  assert.equal(sent, calls.length);
  assert.ok(sent > 0 && sent <= 8, `отправлено ${sent}`);
  assert.equal(left(db), 100 - sent, 'отправленные удалены, остальные ждут');
});

test('бюджет: без трат отправка берёт запрошенное, а при исчерпанном бюджете не начинается', async () => {
  const calls = mockTelegram();
  const env = metered({ DB: queued(), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  assert.equal(await flushOutbox(env, 25), 25);
  assert.equal(calls.length, 25);
  assert.ok(env.meter.used <= SUBREQUEST_LIMIT);
  const spent = metered({ DB: queued(), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  spent.meter.used = 49;
  assert.equal(await flushOutbox(spent, 25), 0);
  assert.equal(spent.meter.used, 49, 'ни одного запроса');
});

test('cron: падающий шаг не мешает отправке очереди', async () => {
  const calls = mockTelegram();
  const { runScheduled } = await import('../src/cron.js');
  const db = createMigratedD1();
  db.sqlite.prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)').run(42, '{"text":"привет"}', Date.now());
  // «D1 упала на выборке событий»: таблицы нет — шаги notify и daily падают, очередь от событий не зависит
  db.sqlite.exec('ALTER TABLE events RENAME TO events_gone');
  const env = metered({ DB: db, BOT_TOKEN: 't', TG_API: 'http://tg.test', REMINDER_HOUR: '0' });
  const logged = [];
  const realLog = console.log;
  console.log = (...a) => logged.push(a.join(' '));
  try {
    await runScheduled(env);
  } finally {
    console.log = realLog;
  }
  assert.ok(logged.some((l) => l.includes('cron step failed daily')), 'ошибка шага записана в журнал');
  assert.equal(calls.filter((c) => c.url.endsWith('/sendMessage')).length, 1, 'очередь всё равно отправлена');
  assert.equal(calls[0].body.chat_id, 42);
  assert.equal(left(db), 0);
});

test('бюджет: запросы к Telegram учитываются, постановка в очередь отмечается', async () => {
  mockTelegram();
  const { tgApi } = await import('../src/telegram.js');
  const { enqueueStmt } = await import('../src/db.js');
  const env = metered({ DB: createMigratedD1(), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  await tgApi(env)('sendMessage', { chat_id: 1, text: 'x' });
  assert.equal(env.meter.used, 1);
  assert.equal(env.meter.enqueued, false);
  enqueueStmt(env.DB, 1, { text: 'x' });
  assert.equal(env.meter.enqueued, true);
});

// 010, FR-1019: снимок семей — то же выражение считает SQL в условии записи жеребьёвки
test('снимок семей: порядок не важен, смена семьи меняет снимок, не-участники не влияют', async () => {
  const { familySnapshot } = await import('../src/db.js');
  const ids = [101, 102, 103, 104];
  const rows = [{ user_id: 101, family_id: 1 }, { user_id: 102, family_id: 1 }, { user_id: 103, family_id: 2 }, { user_id: 900, family_id: 2 }];
  const base = familySnapshot(rows, ids);
  assert.equal(base, `3:${101 + 102 + 103 * 2}:4`);
  assert.equal(familySnapshot([...rows].reverse(), ids), base, 'порядок строк не важен');
  assert.equal(familySnapshot([...rows, { user_id: 901, family_id: 3 }], ids), base, 'семьи не-участников не влияют');
  // 102 и 103 поменялись семьями — исключения другие, снимок тоже
  const swapped = [{ user_id: 101, family_id: 1 }, { user_id: 102, family_id: 2 }, { user_id: 103, family_id: 1 }];
  assert.notEqual(familySnapshot(swapped, ids), base);
  assert.notEqual(familySnapshot(rows.filter((r) => r.user_id !== 102), ids), base, 'выход из семьи');
  assert.equal(familySnapshot([], ids), '0:0:0');
});

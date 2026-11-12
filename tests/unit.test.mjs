// Юнит-тесты серверных модулей без Worker (009): счётчик запросов, отправка очереди в пределах бюджета, cron.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { metered, budgetLeft, SUBREQUEST_LIMIT } from '../src/budget.js';
import { flushOutbox } from '../src/outbox.js';

// Поддельная D1: handler(sql, args, method) возвращает результат запроса
function fakeD1(handler) {
  const stmt = (sql, args = []) => ({
    sql,
    args,
    bind: (...a) => stmt(sql, a),
    first: async () => handler(sql, args, 'first'),
    all: async () => handler(sql, args, 'all'),
    run: async () => handler(sql, args, 'run'),
    raw: async () => handler(sql, args, 'raw'),
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => list.map((s) => {
      assert.ok(typeof s.sql === 'string', 'в batch уходят исходные операторы, а не обёртки');
      return handler(s.sql, s.args, 'batch') || { results: [], meta: { changes: 0 } };
    }),
  };
}

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

// Бесконечная очередь: захват отдаёт ровно столько сообщений, сколько попросили
function endlessOutbox() {
  let id = 0;
  return fakeD1((sql, args, method) => {
    if (sql.includes('UPDATE outbox SET locked_until = ?1')) {
      const limit = args[2];
      return { results: Array.from({ length: limit }, () => ({ id: ++id, chat_id: 1000 + id, payload: '{"text":"x"}', created_at: Date.now() })) };
    }
    return { results: [], meta: { changes: 1 } };
  });
}

test('бюджет: обёртка считает каждый запрос к базе, batch — как один', async () => {
  const env = metered({ DB: fakeD1(() => ({ results: [] })) });
  assert.equal(env.meter.used, 0);
  const s = env.DB.prepare('SELECT 1').bind(1);
  await s.first();
  await s.all();
  await s.run();
  await env.DB.batch([env.DB.prepare('A').bind(1), env.DB.prepare('B'), env.DB.prepare('C').bind(2, 3)]);
  assert.equal(env.meter.used, 4);
  assert.equal(budgetLeft(env), SUBREQUEST_LIMIT - 4);
  assert.equal(metered(env), env, 'повторная обёртка не создаёт второй счётчик');
});

test('бюджет: отправка очереди при 40 уже потраченных запросах не выходит за 50', async () => {
  const calls = mockTelegram();
  const env = metered({ DB: endlessOutbox(), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  env.meter.used = 40;
  const sent = await flushOutbox(env, 25);
  assert.ok(env.meter.used <= SUBREQUEST_LIMIT, `потрачено ${env.meter.used}`);
  assert.equal(sent, calls.length);
  assert.ok(sent > 0 && sent <= 8, `отправлено ${sent}`);
});

test('бюджет: без трат отправка берёт запрошенное, а при исчерпанном бюджете не начинается', async () => {
  const calls = mockTelegram();
  const env = metered({ DB: endlessOutbox(), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  assert.equal(await flushOutbox(env, 25), 25);
  assert.equal(calls.length, 25);
  assert.ok(env.meter.used <= SUBREQUEST_LIMIT);
  const spent = metered({ DB: endlessOutbox(), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  spent.meter.used = 49;
  assert.equal(await flushOutbox(spent, 25), 0);
  assert.equal(spent.meter.used, 49, 'ни одного запроса');
});

test('бюджет: запросы к Telegram учитываются, постановка в очередь отмечается', async () => {
  mockTelegram();
  const { tgApi } = await import('../src/telegram.js');
  const { enqueueStmt } = await import('../src/db.js');
  const env = metered({ DB: fakeD1(() => ({ results: [] })), BOT_TOKEN: 't', TG_API: 'http://tg.test' });
  await tgApi(env)('sendMessage', { chat_id: 1, text: 'x' });
  assert.equal(env.meter.used, 1);
  assert.equal(env.meter.enqueued, false);
  enqueueStmt(env.DB, 1, { text: 'x' });
  assert.equal(env.meter.enqueued, true);
});

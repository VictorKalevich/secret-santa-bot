// Юнит-тесты серверных модулей без Worker (009): счётчик запросов, отправка очереди в пределах бюджета, cron.
// База — подмена D1 на node:sqlite со схемой из миграций (016): запросы не узнаются по подстроке SQL.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { metered, budgetLeft, SUBREQUEST_LIMIT } from '../src/budget.js';
import { flushOutbox } from '../src/outbox.js';
import { createD1, createMigratedD1 } from './support/d1-sqlite.mjs';
import { BLANK_SQL } from '../src/db.js';

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

// 019: «письмо пустое» считается в базе вместо `!wishlist.trim()` — для каждого символа результат должен совпасть
test('пустота письма: BLANK_SQL в базе = !String.prototype.trim() для каждого символа (кроме суррогатов)', () => {
  const db = createMigratedD1();
  const one = db.sqlite.prepare(`SELECT ${BLANK_SQL('char(?)')} AS b`);
  const wrong = [];
  for (let n = 1; n <= 0xffff; n++) {
    if (n >= 0xd800 && n <= 0xdfff) continue;
    if (!!one.get(n).b !== !String.fromCharCode(n).trim()) wrong.push(n);
  }
  assert.deepEqual(wrong, []);
  const text = db.sqlite.prepare(`SELECT ${BLANK_SQL('?')} AS blank, NOT ${BLANK_SQL('?')} AS has`);
  for (const t of ['', ' ', '\t\n\r \u00a0\u2028\u3000\ufeff', ' а ', '\u200b', '\u0085']) {
    const r = text.get(t, t);
    assert.equal(!!r.blank, !t.trim(), JSON.stringify(t));
    assert.equal(!!r.has, !!t.trim(), JSON.stringify(t));
  }
  // NULL — «нет» и для «письмо есть», и для «адрес указан» (колонки NOT NULL — это страховка)
  assert.equal(!!text.get(null, null).has, false);
});

// 060: очередь собирает отложенный текст на языке получателя (users.lang) в момент отправки; готовая строка — как есть
test('очередь: отложенный текст — на языке получателя, прежний готовый текст — как есть', async () => {
  const { DICTIONARIES, tx, tdate } = await import('../src/i18n/index.js');
  DICTIONARIES.zz = { server: { 'common.date': '{month} {day}', 'common.monthsGen': Array.from({ length: 12 }, (_, i) => 'M' + (i + 1)) }, app: {} };
  try {
    const calls = mockTelegram();
    const db = createMigratedD1();
    db.sqlite.exec("INSERT INTO users (tg_id, name, lang) VALUES (1, 'a', ''), (2, 'b', 'zz'), (3, 'c', 'неизвестный')");
    const payload = JSON.stringify({
      text: tx('common.date', { day: 8, month: 'марта' }),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: tdate('2026-03-08'), web_app: { url: 'u' } }]] },
    });
    const ins = db.sqlite.prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)');
    for (const chat of [1, 2, 3, 4]) ins.run(chat, payload, Date.now());
    ins.run(2, '{"text":"готовый текст прежней версии"}', Date.now());
    await flushOutbox(metered({ DB: db, BOT_TOKEN: 't', TG_API: 'http://tg.test' }), 25);
    const sent = calls.map((c) => [c.body.chat_id, c.body.text, c.body.reply_markup?.inline_keyboard[0][0].text]);
    assert.deepEqual(sent, [
      [1, '8 марта', '8 марта'],
      [2, 'марта 8', 'M3 8'],
      [3, '8 марта', '8 марта'], // неизвестный язык — по умолчанию
      [4, '8 марта', '8 марта'], // человека нет в базе — по умолчанию
      [2, 'готовый текст прежней версии', undefined],
    ]);
  } finally {
    delete DICTIONARIES.zz;
  }
});

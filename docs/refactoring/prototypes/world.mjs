// ПРОТОТИП. «Мир» в одном процессе: весь Worker (src/index.js) на node:sqlite, Telegram подменён через fetch.
// Интерфейс повторяет tests/harness.mjs (api, setup, say, press, cron, query, texts), поэтому сценарии e2e
// переносятся почти дословно. Добавлено: world.last (запросы последнего вызова), together(), beforeWrite().
import './text-hooks.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createD1 } from './d1-shim.mjs';
import { initData, TOKEN, ADMIN_SECRET } from '../../../tests/harness.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const worker = (await import('../../../src/index.js')).default;

export async function startWorld({ notifyDelay = 0, reminderHour = 0 } = {}) {
  const DB = createD1();
  const dir = path.join(ROOT, 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) DB.sqlite.exec(readFileSync(path.join(dir, f), 'utf8'));

  // Поддельный Telegram: все вызовы бота записываются. В шаге 1 сюда переносятся правила tests/mock-telegram.mjs
  // (403 заблокировавшему, 400 при длине > 4096 и при разорванном эмодзи).
  const calls = [];
  let messageId = 1;
  globalThis.fetch = async (url, init) => {
    const m = /\/bot([^/]+)\/(\w+)$/.exec(String(url));
    const method = m ? m[2] : 'unknown';
    const params = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, params });
    let result = true;
    if (method === 'getMe') result = { id: 1, is_bot: true, first_name: 'Santa', username: 'test_santa_bot' };
    if (method === 'sendMessage') result = { message_id: messageId++, chat: { id: params.chat_id }, text: params.text };
    return new Response(JSON.stringify({ ok: true, result }), { headers: { 'content-type': 'application/json' } });
  };

  const env = {
    DB, BOT_TOKEN: TOKEN, ADMIN_SECRET, TG_API: 'http://tg.test',
    TIMEZONE_OFFSET_HOURS: '3', REMINDER_HOUR: String(reminderHour), NOTIFY_DELAY_MINUTES: String(notifyDelay),
  };

  // Один вызов Worker: ждём и ответ, и всё, что ушло в waitUntil (отправка очереди). Без sleep.
  const invoke = async (fn) => {
    const waits = [];
    const q0 = DB.stats.queries;
    const t0 = calls.length;
    const l0 = DB.stats.log.length;
    const out = await fn({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    world.last = { db: DB.stats.queries - q0, tg: calls.length - t0, sql: DB.stats.log.slice(l0) };
    return out;
  };

  let updateId = 1;
  let webhookSecret = '';
  const world = {
    DB,
    calls,
    last: null,
    async api(user, action, body = {}, raw = false) {
      const res = await invoke((ctx) => worker.fetch(new Request('http://w.test/api/' + action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-init-data': typeof user === 'string' ? user : initData(user) },
        body: JSON.stringify(body),
      }), env, ctx));
      const data = await res.json();
      if (raw) return { status: res.status, data };
      if (!data.ok) throw new Error(`${action}: ${data.error}`);
      return data;
    },
    async setup(key = ADMIN_SECRET) {
      const res = await invoke((ctx) => worker.fetch(new Request('http://w.test/setup', { method: 'POST', body: new URLSearchParams({ key }) }), env, ctx));
      const html = await res.text();
      webhookSecret = calls.find((c) => c.method === 'setWebhook')?.params.secret_token || '';
      return { status: res.status, headers: res.headers, html, adminCode: /start=(adm_[a-f0-9]+)/.exec(html)?.[1] };
    },
    async update(payload, secret = webhookSecret) {
      const res = await invoke((ctx) => worker.fetch(new Request('http://w.test/tg', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
        body: JSON.stringify({ update_id: updateId++, ...payload }),
      }), env, ctx));
      return res.status;
    },
    from: (u) => ({ id: u.id, is_bot: false, first_name: u.name, username: u.username }),
    say: (u, text) => world.update({ message: { message_id: updateId, date: 1, from: world.from(u), chat: { id: u.id, type: 'private' }, text } }),
    press: (u, data) => world.update({ callback_query: { id: 'cq' + updateId, from: world.from(u), data, chat_instance: 'x' } }),
    cron: () => invoke(() => worker.scheduled({}, env)),
    page: () => worker.fetch(new Request('http://w.test/app'), env, { waitUntil() {} }).then((r) => r.text()),
    sql: (command) => DB.sqlite.exec(command),
    query: (command) => DB.sqlite.prepare(command).all().map((r) => ({ ...r })),
    texts: (u) => calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === u.id).map((c) => c.params.text),
    lastText: (u) => world.texts(u).at(-1) || '',

    // Одновременные вызовы с навязанным чередованием «все читают, затем все пишут». Вызовы запускаются по одному:
    // каждый идёт до своей первой записи и встаёт на барьер; когда на барьере все, они пишут по очереди в порядке
    // writeOrder (по умолчанию — порядок thunks; [1, 0] — обратный: исходы разные, проверять нужно оба).
    // Без этого вызовы из Promise.all фактически идут по очереди и гонку не проверяют (подпись initData —
    // настоящая асинхронная операция, первый вызов успевает закончиться раньше, чем второй дойдёт до базы).
    // sameMoment: часы стоят на месте, пока идут вызовы, — как у одновременных запросов в Workers, где время
    // совпадает до миллисекунды. Так проверяются захваты, которые узнают «свой» вызов по метке времени.
    async together(thunks, { writeOrder = thunks.map((_, i) => i), sameMoment = false } = {}) {
      const parked = [];
      const done = [];
      let current = -1;
      let reached = null;
      const realNow = Date.now;
      if (sameMoment) {
        const fixed = realNow();
        Date.now = () => fixed;
      }
      DB.gate = () => new Promise((res) => { parked[current] = res; reached(); });
      try {
        for (let i = 0; i < thunks.length; i++) {
          current = i;
          const atBarrier = new Promise((r) => { reached = r; });
          done[i] = thunks[i]();
          await Promise.race([atBarrier, done[i].catch(() => {})]); // дошёл до записи или закончил без неё
        }
        DB.gate = null;
        for (const i of writeOrder) {
          if (parked[i]) parked[i]();
          await done[i].catch(() => {}); // следующий пишет после того, как этот закончил
        }
        return await Promise.all(done);
      } finally {
        DB.gate = null;
        Date.now = realNow;
      }
    },

    // Выполнить inject() прямо перед первым batch, где есть оператор с подстрокой marker: чужой вызов встаёт точно
    // между чтением и записью проверяемого действия (порядок записи, обратный together()).
    beforeWrite(marker, inject) {
      const orig = DB.batch;
      DB.batch = async (list) => {
        if (list.some((s) => s.sql.includes(marker))) {
          DB.batch = orig;
          await inject();
        }
        return orig(list);
      };
    },
  };
  return world;
}

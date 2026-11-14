// «Мир» в одном процессе (016): весь Worker (src/index.js) на подмене D1 поверх node:sqlite, Telegram подменён через
// fetch. Интерфейс повторяет tests/harness.mjs (api, setup, say, press, cron, query, texts), поэтому сценарии e2e
// переносятся почти дословно. Добавлено: last (запросы последнего вызова), log(), together(), beforeWrite().
// Контракт — specs/016-fast-tests/contracts/test-harness.md.
import './text-hooks.mjs'; // до импорта Worker: .html и .css — как текст
import { createMigratedD1 } from './d1-sqlite.mjs';
import { initData, TOKEN, ADMIN_SECRET } from './auth.mjs';
import { telegramReply } from './telegram-rules.mjs';

// Динамический импорт: статический загрузил бы app.html раньше, чем зарегистрирован перехватчик text-hooks
const worker = (await import('../../src/index.js')).default;

const BASE = 'http://w.test';

// ---------- сеть: один перехватчик fetch на процесс, запрос уходит «миру» по хосту TG_API ----------
const REAL_FETCH = globalThis.fetch;
const routes = new Map();
async function dispatch(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  const route = routes.get(url.host);
  if (!route) throw new Error('сеть в быстрых тестах недоступна: ' + url.href);
  return route(url, init);
}
// Вернуть настоящий fetch — в after() каждого файла
export function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

// ---------- журнал Worker: console.log на время вызовов собирается, а не печатается (WORLD_LOG=1 — печатать) ----------
const LOG = [];
const realLog = console.log;
let active = 0;
const collect = (...a) => {
  LOG.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' '));
  if (process.env.WORLD_LOG) realLog(...a);
};
const enter = () => {
  if (active++ === 0) console.log = collect;
};
const leave = () => {
  if (--active === 0) console.log = realLog;
};

let worldNo = 0;

export async function startWorld({ notifyDelay = 0, reminderHour = 0 } = {}) {
  const DB = createMigratedD1();
  const host = `tg${++worldNo}.test`;
  const logStart = LOG.length;

  // Поддельный Telegram: все вызовы бота записываются (и отвергнутые); ответы — общие правила с e2e
  const calls = [];
  let messageId = 1;
  routes.set(host, async (url, init) => {
    const m = /\/bot([^/]+)\/(\w+)$/.exec(url.pathname);
    const method = m ? m[2] : 'unknown';
    const params = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, params });
    const reply = telegramReply(method, params, () => messageId++);
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  });
  if (globalThis.fetch !== dispatch) globalThis.fetch = dispatch;

  const env = {
    DB, BOT_TOKEN: TOKEN, ADMIN_SECRET, TG_API: 'http://' + host,
    TIMEZONE_OFFSET_HOURS: '3', REMINDER_HOUR: String(reminderHour), NOTIFY_DELAY_MINUTES: String(notifyDelay),
  };

  // Один вызов Worker: ждём и ответ, и всё, что ушло в waitUntil (отправка очереди). Без sleep.
  const invoke = async (fn) => {
    const waits = [];
    const q0 = DB.stats.queries;
    const t0 = calls.length;
    const l0 = DB.stats.log.length;
    enter();
    try {
      const out = await fn({ waitUntil: (p) => waits.push(p), passThroughOnException() {} });
      await Promise.all(waits);
      return out;
    } finally {
      leave();
      world.last = { db: DB.stats.queries - q0, tg: calls.length - t0, sql: DB.stats.log.slice(l0) };
    }
  };
  const request = (path, init) => invoke((ctx) => worker.fetch(new Request(BASE + path, init), env, ctx));

  let updateId = 1;
  let webhookSecret = '';
  const world = {
    DB,
    env,
    calls,
    last: null,
    request,
    async api(user, action, body = {}, raw = false) {
      const res = await request('/api/' + action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-init-data': typeof user === 'string' ? user : initData(user) },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const data = JSON.parse(text);
      if (raw) return { status: res.status, data, text };
      if (!data.ok) throw new Error(`${action}: ${data.error}`);
      return data;
    },
    // Ключ — только формой (010, FR-1002)
    async setup(key = ADMIN_SECRET) {
      const res = await request('/setup', { method: 'POST', body: new URLSearchParams({ key }) });
      const html = await res.text();
      webhookSecret = calls.find((c) => c.method === 'setWebhook')?.params.secret_token || '';
      return {
        status: res.status,
        headers: res.headers,
        html,
        adminCode: /start=(adm_[a-f0-9]+)/.exec(html)?.[1],
        inviteCode: /start=(inv_[a-z0-9]+)/.exec(html)?.[1],
      };
    },
    async update(payload, secret = webhookSecret) {
      const res = await request('/tg', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
        body: JSON.stringify({ update_id: updateId++, ...payload }),
      });
      return res.status;
    },
    from: (u) => ({ id: u.id, is_bot: false, first_name: u.name, username: u.username }),
    say: (u, text) => world.update({ message: { message_id: updateId, date: 1, from: world.from(u), chat: { id: u.id, type: 'private' }, text } }),
    press: (u, data) => world.update({ callback_query: { id: 'cq' + updateId, from: world.from(u), data, chat_instance: 'x' } }),
    cron: () => invoke(() => worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, env)),
    async page() {
      const res = await request('/app');
      return { status: res.status, headers: res.headers, text: await res.text() };
    },
    // Прямой SQL к базе (для «перемотки времени» в тестах — правкой полей, как в e2e)
    sql: (command) => DB.sqlite.exec(command),
    query: (command, ...params) => DB.sqlite.prepare(command).all(...params).map((r) => ({ ...r })),
    texts: (u) => calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === u.id).map((c) => c.params.text),
    lastText: (u) => world.texts(u).at(-1) || '',
    // Строки console.log Worker с начала этого мира
    log: () => LOG.slice(logStart),

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

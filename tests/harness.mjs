// Общая обвязка для локальных тестов: имитация Telegram + `wrangler dev` + помощники.
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockTelegram } from './mock-telegram.mjs';

export const TOKEN = '123456TESTTOKEN';
export const ADMIN_SECRET = 'super-secret-admin';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn, what, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(60);
  }
  throw new Error('Не дождались: ' + what);
}

// Подпись initData так же, как это делает Telegram.
export function initData(user, { authDate = Math.floor(Date.now() / 1000), token = TOKEN } = {}) {
  const p = new URLSearchParams();
  p.set('auth_date', String(authDate));
  p.set('query_id', 'AAQ' + user.id);
  p.set('user', JSON.stringify({ id: user.id, first_name: user.name, username: user.username }));
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}

// Для локального Worker: обращения к 127.0.0.1 не должны идти через HTTP-прокси (если он задан в системе).
function localEnv() {
  const env = { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost', WRANGLER_SEND_METRICS: 'false' };
  delete env.HTTP_PROXY;
  delete env.http_proxy;
  return env;
}

// Применить миграции D1 к локальной базе (006: схема только миграциями).
function applyMigrations(persistDir) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistDir], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), env: localEnv(), shell: process.platform === 'win32', encoding: 'utf8', input: '',
  });
  if (r.status !== 0) throw new Error('d1 migrations apply: ' + r.stderr + r.stdout);
}

// SQL к локальной базе. Всегда через файл: на Windows аргументы идут через cmd.exe без кавычек.
let sqlFileNo = 0;
function execSql(persistDir, command, json = false) {
  const file = join(persistDir, `santa-sql-${++sqlFileNo}.sql`); // удаляется вместе с базой в stop()
  writeFileSync(file, command);
  const run = () => spawnSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', persistDir, '--file', file, ...(json ? ['--json'] : [])], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), env: localEnv(), shell: process.platform === 'win32', encoding: 'utf8',
  });
  let r = run();
  // Изредка локальный wrangler не успевает поднять базу («fetch failed») — повторяем
  for (let i = 0; i < 2 && r.status !== 0 && /fetch failed/.test(r.stderr + r.stdout); i++) r = run();
  if (r.status !== 0) throw new Error('d1 execute: ' + r.stderr + r.stdout);
  return json ? JSON.parse(r.stdout)[0].results : r.stdout;
}

// sqlBefore — SQL до миграций (например, база «как у 005»); migrate: false — база без миграций.
export async function startWorld({ notifyDelay = 0, reminderHour = 0, migrate = true, sqlBefore = '' } = {}) {
  const port = 8787 + Math.floor(Math.random() * 400);
  const tgPort = 9300 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  const mock = await startMockTelegram(tgPort);
  const persistDir = mkdtempSync(join(tmpdir(), 'santa-test-'));
  if (sqlBefore) execSql(persistDir, sqlBefore);
  if (migrate) applyMigrations(persistDir);
  const isWin = process.platform === 'win32';
  const worker = spawn('npx', [
    'wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', '--test-scheduled',
    '--persist-to', persistDir, '--log-level', 'log',
    '--var', `TG_API:http://127.0.0.1:${tgPort}`,
    '--var', `BOT_TOKEN:${TOKEN}`,
    '--var', `ADMIN_SECRET:${ADMIN_SECRET}`,
    '--var', `NOTIFY_DELAY_MINUTES:${notifyDelay}`,
    '--var', `REMINDER_HOUR:${reminderHour}`,
  ], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: localEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    detached: !isWin,
  });
  let log = '';
  worker.stdout.on('data', (d) => (log += d));
  worker.stderr.on('data', (d) => (log += d));

  const stop = async () => {
    if (worker.pid) {
      if (isWin) spawnSync('taskkill', ['/pid', String(worker.pid), '/T', '/F']);
      else try { process.kill(-worker.pid, 'SIGTERM'); } catch { /* уже остановлен */ }
    }
    await mock.close();
    // На Windows файлы базы освобождаются не сразу после остановки wrangler
    try { rmSync(persistDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch (e) { console.log('не удалось удалить', persistDir, e.code); }
  };

  try {
    await waitFor(async () => {
      try { return (await fetch(base + '/')).status > 0; } catch { return false; } // 500 «база не подготовлена» — тоже ответ
    }, 'запуск wrangler dev', 90000);
  } catch (e) {
    await stop();
    throw new Error(e.message + '\n' + log);
  }

  let updateId = 1;
  let webhookSecret = '';
  const world = {
    base,
    mock,
    stop,
    // Прямой SQL к локальной базе (для «перемотки времени» в тестах)
    sql: (command) => execSql(persistDir, command),
    // Прямой SQL-запрос с результатом (строки первого оператора)
    query: (command) => execSql(persistDir, command, true),
    migrate: () => applyMigrations(persistDir),
    async api(user, action, body = {}, raw = false) {
      const res = await fetch(`${base}/api/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-init-data': typeof user === 'string' ? user : initData(user) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (raw) return { status: res.status, data };
      if (!data.ok) throw new Error(`${action}: ${data.error}`);
      return data;
    },
    async setup() {
      const html = await (await fetch(`${base}/setup?key=${ADMIN_SECRET}`)).text();
      webhookSecret = mock.calls.find((c) => c.method === 'setWebhook')?.params.secret_token || '';
      return {
        html,
        adminCode: /start=(adm_[a-f0-9]+)/.exec(html)?.[1],
        inviteCode: /start=(inv_[a-z0-9]+)/.exec(html)?.[1],
        webhookSecret,
      };
    },
    async update(payload, secret = webhookSecret) {
      const res = await fetch(`${base}/tg`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
        body: JSON.stringify({ update_id: updateId++, ...payload }),
      });
      return res.status;
    },
    from: (u) => ({ id: u.id, is_bot: false, first_name: u.name, username: u.username }),
    say(u, text) {
      return world.update({ message: { message_id: updateId, date: 1, from: world.from(u), chat: { id: u.id, type: 'private' }, text } });
    },
    press(u, data) {
      return world.update({ callback_query: { id: 'cq' + updateId, from: world.from(u), data, chat_instance: 'x' } });
    },
    cron: () => fetch(`${base}/__scheduled?cron=*+*+*+*+*`).then((r) => r.text()),
    // Журнал Worker (console.log) — для проверки, что вызовы укладываются в бюджет запросов (009)
    log: () => log,
    texts: (u) => mock.messagesTo(u.id).map((c) => c.params.text),
    lastText: (u) => mock.messagesTo(u.id).map((c) => c.params.text).at(-1) || '',
  };
  return world;
}

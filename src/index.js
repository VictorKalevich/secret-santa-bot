// Точка входа Cloudflare Worker: webhook бота, мини-приложение, API, настройка, cron.

import APP_HTML from './app.html';
import TOKENS_CSS from '../design-system/tokens.css';
import COMPONENTS_CSS from '../design-system/components.css';
import { checkSchema, getSettings, setSettings, SchemaError } from './db.js';
import { tgApi, derivedSecret } from './telegram.js';
import { handleUpdate } from './bot.js';
import { handleApi } from './api.js';
import { runScheduled } from './cron.js';
import { escapeHtml } from './format.js';
import { flushOutbox } from './outbox.js';
import { metered, reportBudget } from './budget.js';
import { ownerLinkCode, ownerLinkUsed } from './roles.js';

// Страница мини-приложения со встроенной дизайн-системой (без сборщика).
const APP_PAGE = APP_HTML.replace('/*@design-system*/', () => TOKENS_CSS + '\n' + COMPONENTS_CSS);

// Единственная точка отправки очереди после запроса (009): если обработчик ставил сообщения в очередь —
// отправить их уже после ответа, в пределах оставшегося бюджета вызова; остаток уйдёт в cron.
function afterRequest(env, ctx, where) {
  if (!env.meter.enqueued) return reportBudget(env, where);
  ctx.waitUntil(
    flushOutbox(env, 25)
      .catch((e) => console.log('flush failed', where, e && e.stack ? e.stack : String(e)))
      .finally(() => reportBudget(env, where))
  );
}

export default {
  async fetch(request, rawEnv, ctx) {
    const url = new URL(request.url);
    if (!rawEnv.BOT_TOKEN) return new Response('Не задан секрет BOT_TOKEN (см. инструкцию).', { status: 500 });
    const env = metered(rawEnv);
    try {
      await checkSchema(env.DB);
    } catch (e) {
      if (!(e instanceof SchemaError)) throw e;
      // Миграции не применены: ничего не трогаем, объясняем (006). Telegram повторит webhook позже.
      console.log('schema not ready', e.found);
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      return new Response(e.message, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (url.pathname === '/tg' && request.method === 'POST') {
      const expected = await derivedSecret(env, 'webhook');
      if (request.headers.get('x-telegram-bot-api-secret-token') !== expected) {
        return new Response('forbidden', { status: 403 });
      }
      try {
        const update = await request.json();
        await handleUpdate(update, env);
      } catch (e) {
        console.log('update failed', e && e.stack ? e.stack : String(e));
      }
      afterRequest(env, ctx, 'tg');
      return new Response('ok');
    }

    if (url.pathname === '/app') {
      return new Response(APP_PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      const action = url.pathname.slice(5);
      try {
        return await handleApi(request, env, action);
      } catch (e) {
        console.log('api failed', e && e.stack ? e.stack : String(e));
        return new Response(JSON.stringify({ ok: false, error: 'Ошибка сервера. Попробуй ещё раз.' }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      } finally {
        afterRequest(env, ctx, 'api ' + action);
      }
    }

    if (url.pathname === '/setup') {
      const res = await setup(request, url, env);
      reportBudget(env, 'setup');
      return res;
    }

    return new Response('🎄 Бот Тайного Санты работает.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },

  async scheduled(event, rawEnv) {
    if (!rawEnv.BOT_TOKEN) return;
    const env = metered(rawEnv);
    try {
      await checkSchema(env.DB);
    } catch (e) {
      if (e instanceof SchemaError) return console.log('scheduled skipped: schema not ready', e.found);
      throw e;
    }
    await runScheduled(env);
    reportBudget(env, 'cron');
  },
};

// Страница настройки (010): ключ — только из формы (POST), не из адреса; ссылка владельца одноразовая, после неё
// страница заблокирована до смены ADMIN_SECRET. Адрес страницы не уходит другим сайтам, страница не кэшируется.
const SETUP_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "frame-ancestors 'none'",
  'x-robots-tag': 'noindex',
};

const SETUP_FORM = `<form method="post" action="/setup" autocomplete="off">
<label for="key">Ключ настройки (значение секрета ADMIN_SECRET)</label>
<input id="key" name="key" type="password" required minlength="8" autofocus>
<button type="submit">Настроить бота</button>
</form>`;

async function setup(request, url, env) {
  const page = (title, body, status = 200) =>
    new Response(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">
<title>${title}</title><style>
body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1d1d1f}
h1{font-size:24px}code,.link{background:#f4f4f6;border-radius:8px;padding:2px 6px;word-break:break-all}
.link{display:block;padding:12px;margin:8px 0 16px;font-family:ui-monospace,monospace;font-size:14px}
.ok{color:#1a7f37}.bad{color:#c62828}.warn{background:#fff6e5;border-radius:10px;padding:12px}
form{display:grid;gap:10px;margin:16px 0}input{font:inherit;padding:10px;border:1px solid #c7c7cc;border-radius:10px}
button{font:inherit;padding:10px 16px;border:0;border-radius:10px;background:#2481cc;color:#fff;cursor:pointer}
</style></head><body>${body}</body></html>`,
      { status, headers: SETUP_HEADERS }
    );

  if (!env.ADMIN_SECRET || String(env.ADMIN_SECRET).length < 8) {
    return page('Настройка', '<h1>Нужен ADMIN_SECRET</h1><p>Задай секрет ADMIN_SECRET длиной от 8 символов (см. инструкцию).</p>', 500);
  }
  // Ключ в адресе не читается: он остался бы в истории браузера и журналах (FR-1002)
  if (request.method !== 'POST') {
    return page('Настройка', `<h1>🎄 Настройка бота</h1><p>Введи ключ настройки — тот, что ты задал командой
<code>npx wrangler secret put ADMIN_SECRET</code>.</p>${SETUP_FORM}`);
  }
  const form = await request.formData().catch(() => null);
  const key = String(form?.get('key') || '');
  // Сравнение HMAC-ов, а не самих строк: время сравнения не зависит от совпавшего префикса ключа
  if ((await derivedSecret(env, 'setup-key:' + key)) !== (await derivedSecret(env, 'setup-key:' + env.ADMIN_SECRET))) {
    return page('Настройка', `<h1>Неверный ключ</h1><p class="bad">Ключ не подошёл. Проверь значение ADMIN_SECRET.</p>${SETUP_FORM}`, 403);
  }
  // Ссылкой владельца уже воспользовались — до смены секрета ни настройки, ни новой ссылки (FR-1005)
  if (await ownerLinkUsed(env, await getSettings(env.DB))) {
    return page('Настройка', `<h1>🔒 Страница заблокирована</h1>
<p>Ссылкой владельца уже воспользовались, поэтому страница настройки больше не выдаёт её и не меняет настройки бота.</p>
<p>Чтобы разблокировать (например, если ссылка утекла или нужно забрать права владельца), смени ключ:</p>
<p><code>npx wrangler secret put ADMIN_SECRET</code></p>
<p>Затем открой эту страницу снова и введи новый ключ — появится новая ссылка владельца, старая перестанет работать.</p>`, 423);
  }

  const call = tgApi(env);
  const origin = url.origin;
  const steps = [];
  const me = await call('getMe');
  steps.push(['Токен бота', me.ok, me.ok ? '@' + me.result.username : me.description]);
  if (!me.ok) return page('Настройка', '<h1>Не получилось</h1>' + renderSteps(steps), 500);

  const wh = await call('setWebhook', {
    url: origin + '/tg',
    secret_token: await derivedSecret(env, 'webhook'),
    allowed_updates: ['message', 'callback_query'],
  });
  steps.push(['Webhook', wh.ok, wh.description || '']);

  const cmds = await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Главное меню и мои эвенты' },
      { command: 'cancel', description: 'Отменить ввод' },
    ],
  });
  steps.push(['Команды', cmds.ok, '']);

  const menu = await call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: '🎁 Санта', web_app: { url: origin + '/app' } },
  });
  steps.push(['Кнопка приложения', menu.ok, menu.description || '']);

  await call('setMyDescription', {
    description: '🎄 Закрытый бот для игры в Тайного Санту: письма Санте, жеребьёвка с исключениями, анонимные вопросы. Вход только по приглашению организатора.',
  });
  await call('setMyShortDescription', { short_description: '🎄 Тайный Санта для своей компании' });

  await setSettings(env.DB, { base_url: origin, bot_username: me.result.username });

  const adminLink = `https://t.me/${me.result.username}?start=${await ownerLinkCode(env)}`;
  const allOk = steps.every((x) => x[1]);
  return page(
    'Настройка',
    `<h1>${allOk ? '✅ Бот настроен' : '⚠️ Есть проблемы'}</h1>${renderSteps(steps)}
<h2>1. Ссылка владельца</h2>
<p>Открой её в Telegram — бот сделает тебя <b>владельцем бота</b>. Владелец создаёт эвенты, назначает и снимает
администраторов в приложении (главный экран → «Администраторы») и может открыть служебный просмотр пар.</p>
<a class="link" href="${adminLink}" rel="noreferrer">${adminLink}</a>
<p class="warn">⚠️ Ссылка <b>срабатывает один раз</b>: после перехода по ней эта страница блокируется, пока ты не сменишь
ADMIN_SECRET. Никому её не пересылай — тот, кто перейдёт первым, станет владельцем. Если это случилось, смени ADMIN_SECRET,
открой страницу снова и перейди по новой ссылке. Пока ссылкой не воспользовались, страницу можно открыть повторно.</p>
<h2>2. Создай эвент</h2>
<p>В чате с ботом нажми «🎁 Санта» → «＋ Новый эвент». У каждого эвента своя пригласительная ссылка — её можно
скопировать или отправить в чат прямо из приложения (вкладка «Админ» эвента).</p>`
  );
}

function renderSteps(steps) {
  return (
    '<ul>' +
    steps.map(([name, ok, info]) => `<li class="${ok ? 'ok' : 'bad'}">${ok ? '✔' : '✘'} ${name}${info ? ' — ' + escapeHtml(info) : ''}</li>`).join('') +
    '</ul>'
  );
}

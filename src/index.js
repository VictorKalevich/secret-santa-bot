// Точка входа Cloudflare Worker: webhook бота, мини-приложение, API, настройка, cron.

import APP_HTML from './app.html';
import TOKENS_CSS from '../design-system/tokens.css';
import COMPONENTS_CSS from '../design-system/components.css';
import { ensureSchema, setSettings } from './db.js';
import { tgApi, derivedSecret } from './telegram.js';
import { handleUpdate } from './bot.js';
import { handleApi } from './api.js';
import { runScheduled } from './cron.js';
import { escapeHtml } from './game.js';

// Страница мини-приложения со встроенной дизайн-системой (без сборщика).
const APP_PAGE = APP_HTML.replace('/*@design-system*/', () => TOKENS_CSS + '\n' + COMPONENTS_CSS);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!env.BOT_TOKEN) return new Response('Не задан секрет BOT_TOKEN (см. инструкцию).', { status: 500 });
    await ensureSchema(env.DB);

    if (url.pathname === '/tg' && request.method === 'POST') {
      const expected = await derivedSecret(env, 'webhook');
      if (request.headers.get('x-telegram-bot-api-secret-token') !== expected) {
        return new Response('forbidden', { status: 403 });
      }
      try {
        const update = await request.json();
        await handleUpdate(update, env, ctx);
      } catch (e) {
        console.log('update failed', e && e.stack ? e.stack : String(e));
      }
      return new Response('ok');
    }

    if (url.pathname === '/app') {
      return new Response(APP_PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx, url.pathname.slice(5));
      } catch (e) {
        console.log('api failed', e && e.stack ? e.stack : String(e));
        return new Response(JSON.stringify({ ok: false, error: 'Ошибка сервера. Попробуй ещё раз.' }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
    }

    if (url.pathname === '/setup') return setup(url, env);

    return new Response('🎄 Бот Тайного Санты работает.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },

  async scheduled(event, env, ctx) {
    if (!env.BOT_TOKEN) return;
    await ensureSchema(env.DB);
    await runScheduled(env);
  },
};

async function setup(url, env) {
  const page = (title, body, status = 200) =>
    new Response(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1d1d1f}
h1{font-size:24px}code,.link{background:#f4f4f6;border-radius:8px;padding:2px 6px;word-break:break-all}
.link{display:block;padding:12px;margin:8px 0 16px;font-family:ui-monospace,monospace;font-size:14px}
.ok{color:#1a7f37}.bad{color:#c62828}.warn{background:#fff6e5;border-radius:10px;padding:12px}
</style></head><body>${body}</body></html>`,
      { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
    );

  if (!env.ADMIN_SECRET || String(env.ADMIN_SECRET).length < 8) {
    return page('Настройка', '<h1>Нужен ADMIN_SECRET</h1><p>Задай секрет ADMIN_SECRET длиной от 8 символов (см. инструкцию).</p>', 500);
  }
  if (url.searchParams.get('key') !== env.ADMIN_SECRET) {
    return page('Настройка', '<h1>Неверный ключ</h1><p>Открой адрес вида <code>/setup?key=ВАШ_ADMIN_SECRET</code>.</p>', 403);
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

  const adminLink = `https://t.me/${me.result.username}?start=adm_${await derivedSecret(env, 'admin:' + env.ADMIN_SECRET, 24)}`;
  const allOk = steps.every((x) => x[1]);
  return page(
    'Настройка',
    `<h1>${allOk ? '✅ Бот настроен' : '⚠️ Есть проблемы'}</h1>${renderSteps(steps)}
<h2>1. Ссылка владельца</h2>
<p>Открой её в Telegram — бот сделает тебя <b>владельцем бота</b>. Владелец создаёт эвенты и сам назначает и снимает
администраторов в приложении (главный экран → «Администраторы»).</p>
<a class="link" href="${adminLink}">${adminLink}</a>
<p class="warn">⚠️ Никому не пересылай эту ссылку: тот, кто по ней перейдёт, станет владельцем (прежний владелец получит
предупреждение). Чтобы сделать кого-то админом, назначь его в приложении. Если ссылка утекла — перейди по ней сам и смени
ADMIN_SECRET.</p>
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

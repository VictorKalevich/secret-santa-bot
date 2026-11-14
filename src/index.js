// Точка входа Cloudflare Worker: webhook бота, мини-приложение, API, настройка, cron.

import APP_HTML from './app.html';
import TOKENS_CSS from '../design-system/tokens.css';
import COMPONENTS_CSS from '../design-system/components.css';
import { checkSchema, SchemaError } from './db.js';
import { derivedSecret } from './telegram.js';
import { handleUpdate } from './bot.js';
import { handleApi } from './api.js';
import { runScheduled } from './cron.js';
import { flushOutbox } from './outbox.js';
import { metered, reportBudget } from './budget.js';
import { setup } from './setup.js';

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

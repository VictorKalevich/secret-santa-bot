// Страница настройки /setup (019: из src/index.js без правок текста и заголовков).

import { getSettings, setSettings } from './db.js';
import { tgApi, derivedSecret } from './telegram.js';
import { escapeHtml } from './format.js';
import { translator, DEFAULT_LANG } from './i18n/index.js';
import { ownerLinkCode, ownerLinkUsed } from './roles.js';
import TOKENS_CSS from '../design-system/tokens.css';
import COMPONENTS_CSS from '../design-system/components.css';
import CLEARABLE_INPUT from '../design-system/clearable-input.js.txt';

// У страницы нет языка человека — тексты на языке по умолчанию (060)
const t = translator(DEFAULT_LANG);

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
<label for="key">${t('setup.form.label')}</label>
<span class="ds-clearable"><input class="ds-input" id="key" name="key" type="password" required minlength="8" autofocus></span>
<button type="submit">${t('setup.form.submit')}</button>
</form>
<script>${CLEARABLE_INPUT}
bindClearableInput(document.querySelector('.ds-clearable'), '${t('setup.form.field')}');</script>`;

export async function setup(request, url, env) {
  const page = (body, status = 200) =>
    new Response(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">
<title>${t('setup.title')}</title><style>
${TOKENS_CSS}
${COMPONENTS_CSS}
:root{color-scheme:light}
body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1d1d1f}
h1{font-size:24px}code,.link{background:#f4f4f6;border-radius:8px;padding:2px 6px;word-break:break-all}
.link{display:block;padding:12px;margin:8px 0 16px;font-family:ui-monospace,monospace;font-size:14px}
.ok{color:#1a7f37}.bad{color:#c62828}.warn{background:#fff6e5;border-radius:10px;padding:12px}
form{display:grid;gap:10px;margin:16px 0}input{font:inherit}
button{font:inherit;padding:10px 16px;border:0;border-radius:10px;background:#2481cc;color:#fff;cursor:pointer}
</style></head><body>${body}</body></html>`,
      { status, headers: SETUP_HEADERS }
    );

  if (!env.ADMIN_SECRET || String(env.ADMIN_SECRET).length < 8) {
    return page(`<h1>${t('setup.noSecret.title')}</h1><p>${t('setup.noSecret.text')}</p>`, 500);
  }
  // Ключ в адресе не читается: он остался бы в истории браузера и журналах (FR-1002)
  if (request.method !== 'POST') {
    return page(`<h1>${t('setup.start.title')}</h1><p>${t('setup.start.text')}</p>${SETUP_FORM}`);
  }
  const form = await request.formData().catch(() => null);
  const key = String(form?.get('key') || '');
  // Сравнение HMAC-ов, а не самих строк: время сравнения не зависит от совпавшего префикса ключа
  if ((await derivedSecret(env, 'setup-key:' + key)) !== (await derivedSecret(env, 'setup-key:' + env.ADMIN_SECRET))) {
    return page(`<h1>${t('setup.badKey.title')}</h1><p class="bad">${t('setup.badKey.text')}</p>${SETUP_FORM}`, 403);
  }
  // Ссылкой владельца уже воспользовались — до смены секрета ни настройки, ни новой ссылки (FR-1005)
  if (await ownerLinkUsed(env, await getSettings(env.DB))) {
    return page(`<h1>${t('setup.locked.title')}</h1>
<p>${t('setup.locked.used')}</p>
<p>${t('setup.locked.unlock')}</p>
<p><code>npx wrangler secret put ADMIN_SECRET</code></p>
<p>${t('setup.locked.then')}</p>`, 423);
  }

  const call = tgApi(env);
  const origin = url.origin;
  const steps = [];
  const me = await call('getMe');
  steps.push([t('setup.step.token'), me.ok, me.ok ? '@' + me.result.username : me.description]);
  if (!me.ok) return page(`<h1>${t('setup.failed')}</h1>${renderSteps(steps)}`, 500);

  const wh = await call('setWebhook', {
    url: origin + '/tg',
    secret_token: await derivedSecret(env, 'webhook'),
    allowed_updates: ['message', 'callback_query'],
  });
  steps.push([t('setup.step.webhook'), wh.ok, wh.description || '']);

  const cmds = await call('setMyCommands', {
    commands: [
      { command: 'start', description: t('setup.command.start') },
      { command: 'cancel', description: t('setup.command.cancel') },
    ],
  });
  steps.push([t('setup.step.commands'), cmds.ok, '']);

  const menu = await call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: t('setup.menuButton'), web_app: { url: origin + '/app' } },
  });
  steps.push([t('setup.step.menuButton'), menu.ok, menu.description || '']);

  await call('setMyDescription', { description: t('setup.description') });
  await call('setMyShortDescription', { short_description: t('setup.shortDescription') });

  await setSettings(env.DB, { base_url: origin, bot_username: me.result.username });

  const adminLink = `https://t.me/${me.result.username}?start=${await ownerLinkCode(env)}`;
  const allOk = steps.every((x) => x[1]);
  return page(
    `<h1>${t(allOk ? 'setup.done.ok' : 'setup.done.problems')}</h1>${renderSteps(steps)}
<h2>${t('setup.done.linkTitle')}</h2>
<p>${t('setup.done.linkText')}</p>
<a class="link" href="${adminLink}" rel="noreferrer">${adminLink}</a>
<p class="warn">${t('setup.done.linkWarn')}</p>
<h2>${t('setup.done.eventTitle')}</h2>
<p>${t('setup.done.eventText')}</p>`
  );
}

function renderSteps(steps) {
  return (
    '<ul>' +
    steps.map(([name, ok, info]) => `<li class="${ok ? 'ok' : 'bad'}">${ok ? '✔' : '✘'} ${name}${info ? ' — ' + escapeHtml(info) : ''}</li>`).join('') +
    '</ul>'
  );
}

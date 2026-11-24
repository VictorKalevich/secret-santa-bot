// Язык человека (061, контракт specs/061-i18n-languages/contracts/language.md, разделы 2, 3 и 5): запоминание языка
// Telegram, выбор языка, кнопка меню и команды чата на его языке.
import { updateUser } from './db.js';
import { tgApi } from './telegram.js';
import { no } from './result.js';
import { LANGUAGES, DEFAULT_LANG, langOf, translator, t, tx } from './i18n/index.js';
import { LANGUAGE_NAMES } from './i18n/languages.js';
import { botCommands } from './bot-profile.js';

// Язык по Telegram (без выбора): для подписи «Как в Telegram (…)»
const autoLang = (ctx) => langOf({ tg_lang: ctx.me?.tg_lang }, ctx.telegramLang);

// Языки бота с названиями на самих языках — список выбора в приложении (поля me: lang_choice, lang_auto, languages)
export function languagesView(ctx) {
  return {
    lang_choice: ctx.me?.lang || '',
    lang_auto: autoLang(ctx),
    languages: LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES[code] })),
  };
}

// Кнопка меню чата на языке человека: русскому — общая кнопка бота (её ставит /setup), прочим — своя. Возвращает поля
// записи человека, которые надо сохранить (menu_lang), или пусто
async function menuButton(ctx) {
  const settings = await ctx.settings();
  const want = ctx.lang === DEFAULT_LANG ? '' : ctx.lang;
  if (!settings.base_url || (ctx.me.menu_lang || '') === want) return {};
  await tgApi(ctx.env, ctx.lang)('setChatMenuButton', {
    chat_id: ctx.me.tg_id,
    menu_button: want
      ? { type: 'web_app', text: t(want, 'setup.menuButton'), web_app: { url: settings.base_url + '/app' } }
      : { type: 'default' },
  });
  return { menu_lang: want };
}

// Каждое обращение человека: запомнить язык Telegram (только при изменении) и поправить кнопку меню. Ни одного запроса,
// если ничего не изменилось
export async function syncLanguage(ctx) {
  const me = ctx.me;
  if (!me) return;
  const fields = ctx.telegramLang && ctx.telegramLang !== me.tg_lang ? { tg_lang: ctx.telegramLang } : {};
  Object.assign(fields, await menuButton(ctx));
  if (!Object.keys(fields).length) return;
  await updateUser(ctx.db, me.tg_id, fields);
  Object.assign(me, fields);
}

// Выбор языка: '' — как в Telegram, иначе код языка бота. Язык вызова меняется сразу — ответ уже на новом языке
export async function setLanguage(ctx, choice) {
  const lang = String(choice ?? '');
  if (lang && !LANGUAGES.includes(lang)) return no(tx('api.lang.unknown'));
  const me = ctx.me;
  const changed = (me.lang || '') !== lang;
  me.lang = lang;
  ctx.lang = langOf(me, ctx.telegramLang);
  ctx.t = translator(ctx.lang);
  const fields = { ...(changed ? { lang } : {}), ...(await menuButton(ctx)) };
  if (Object.keys(fields).length) await updateUser(ctx.db, me.tg_id, fields);
  Object.assign(me, fields);
  if (changed) {
    // Команды чата: выбранный язык важнее языка Telegram; «как в Telegram» — команды бота по языку Telegram
    const scope = { type: 'chat', chat_id: me.tg_id };
    const call = tgApi(ctx.env, ctx.lang);
    await (lang ? call('setMyCommands', { commands: botCommands(lang), scope }) : call('deleteMyCommands', { scope }));
  }
  return { ok: true, lang: ctx.lang };
}

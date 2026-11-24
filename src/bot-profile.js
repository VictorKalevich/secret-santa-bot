// Профиль бота по языкам (061, контракт specs/061-i18n-languages/contracts/language.md, раздел 6): команды, описание и
// краткое описание для каждого кода языка Telegram. 60 вызовов не помещаются в бюджет одного вызова Worker — профиль
// уходит частями в конце обычных обращений (afterRequest) и на /setup; где остановились — settings.bot_profile
// ('<версия>:<следующий вызов>'), версия — отпечаток самих вызовов: поменялись тексты — профиль уходит заново.
import { setSettings } from './db.js';
import { tgApi } from './telegram.js';
import { budgetLeft } from './budget.js';
import { t, LANGUAGES, RUSSIAN_SPEAKING, FALLBACK_LANG, DEFAULT_LANG } from './i18n/index.js';

// [language_code Telegram, язык текстов]: '' — все прочие языки Telegram
export const PROFILE_TARGETS = [
  ['', FALLBACK_LANG],
  ...LANGUAGES.filter((lang) => lang !== FALLBACK_LANG).map((lang) => [lang, lang]),
  ...RUSSIAN_SPEAKING.map((code) => [code, DEFAULT_LANG]),
];
// Запас бюджета вызова: профиль не отнимает его у ответа и очереди
const RESERVE = 4;

export const botCommands = (lang) =>
  ['start', 'language', 'cancel'].map((command) => ({ command, description: t(lang, 'setup.command.' + command) }));

let calls = null;
// Все вызовы профиля по порядку: [метод, параметры]
export function profileCalls() {
  if (!calls) {
    calls = PROFILE_TARGETS.flatMap(([code, lang]) => {
      const where = code ? { language_code: code } : {};
      return [
        ['setMyCommands', { commands: botCommands(lang), ...where }],
        ['setMyDescription', { description: t(lang, 'setup.description'), ...where }],
        ['setMyShortDescription', { short_description: t(lang, 'setup.shortDescription'), ...where }],
      ];
    });
  }
  return calls;
}

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
let version = null;
export const profileVersion = () => (version ??= fnv1a(JSON.stringify(profileCalls())));

// С какого вызова продолжить по настройкам; null — профиль не нужен (бот не настроен или всё отправлено)
export function profileFrom(settings) {
  if (!settings.base_url) return null;
  const [v, next] = String(settings.bot_profile || '').split(':');
  if (v !== profileVersion()) return 0;
  const n = Number(next) || 0;
  return n >= profileCalls().length ? null : n;
}

// Отправить вызовы профиля, начиная с from, пока хватает бюджета; ошибка вызова — журнал Worker (его пишет tgApi) и
// следующий вызов. Возвращает, сколько вызовов прошло успешно
export async function sendProfile(env, from) {
  const list = profileCalls();
  const call = tgApi(env);
  let next = from;
  let ok = 0;
  while (next < list.length && budgetLeft(env) > RESERVE + 1) {
    const [method, params] = list[next];
    const res = await call(method, params);
    if (res.ok) ok++;
    else console.log(`bot profile: ${method} ${params.language_code ?? '-'}: ${res.description ?? ''}`);
    next++;
  }
  if (next > from) await setSettings(env.DB, { bot_profile: `${profileVersion()}:${next}` });
  return { ok, next, done: next >= list.length };
}

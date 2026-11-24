// Тексты для людей — только из словаря (060, контракт specs/060-i18n-dictionary/contracts/i18n.md). Словарь языка —
// папка src/i18n/<язык>/: файл на область, ключ начинается с области (pairs.js → pairs.*, app-admin.js → app.admin.*).
// Строка собирается на языке того, кому она предназначена: ответ — вызывающему (ctx.t), сообщение очереди — получателю
// при отправке (tx → render в flushOutbox), подробность журнала — на языке по умолчанию при записи.

import RU from './ru/index.js';

export const DEFAULT_LANG = 'ru';
// Языки, у которых есть словари (шаг 2 добавит остальные). Тесты добавляют в DICTIONARIES служебный язык.
export const LANGUAGES = ['ru'];
// { [язык]: { server, app, plural? } } — plural: язык правил форм числа, если код языка не из Intl
export const DICTIONARIES = { ru: RU };

export function langOf(user) {
  const lang = user?.lang;
  return lang && Object.hasOwn(DICTIONARIES, lang) ? lang : DEFAULT_LANG;
}

// Ошибка словаря у людей — только журнал Worker; быстрые тесты превращают её в исключение
function report(problem) {
  console.error('i18n: ' + problem);
}

// [значение, язык значения]: свой язык, иначе язык по умолчанию
function lookup(lang, key) {
  const d = DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANG];
  if (Object.hasOwn(d.server, key)) return [d.server[key], lang];
  if (Object.hasOwn(d.app, key)) return [d.app[key], lang];
  if (lang !== DEFAULT_LANG) return lookup(DEFAULT_LANG, key);
  return [undefined, lang];
}

const pluralRules = new Map();
function pluralCategory(lang, n) {
  const locale = DICTIONARIES[lang]?.plural ?? lang;
  if (!pluralRules.has(locale)) pluralRules.set(locale, new Intl.PluralRules(locale));
  return pluralRules.get(locale).select(n);
}

const SLOT = /\{([A-Za-z0-9_]+)\}/g;

// Имена подстановок текста или набора форм
export function slotsOf(value) {
  const texts = typeof value === 'string' ? [value] : value && typeof value === 'object' && !Array.isArray(value) ? Object.values(value) : [];
  const names = new Set();
  for (const text of texts) for (const m of String(text).matchAll(SLOT)) names.add(m[1]);
  return names;
}

export function t(lang, key, params) {
  const [value, from] = lookup(lang, key);
  if (value === undefined) {
    report(`нет ключа ${key}`);
    return key;
  }
  let text = value;
  if (Array.isArray(value)) {
    report(`${key} — список, а не текст`);
    return value.join(', ');
  }
  if (typeof value === 'object') {
    const n = params?.n;
    if (typeof n !== 'number') report(`${key}: у набора форм нет числа n`);
    const category = typeof n === 'number' ? pluralCategory(from, n) : 'other';
    text = value[category] ?? value.other ?? Object.values(value)[0];
  }
  if (params) {
    const used = slotsOf(value);
    for (const name of Object.keys(params)) {
      if (!used.has(name) && !(name === 'n' && typeof value === 'object')) report(`${key}: лишняя подстановка ${name}`);
    }
  }
  return text.replace(SLOT, (m, name) => {
    if (params && Object.hasOwn(params, name)) return String(render(params[name], lang));
    report(`${key}: нет подстановки ${name}`);
    return m;
  });
}

export function tl(lang, key) {
  const [value] = lookup(lang, key);
  if (Array.isArray(value)) return value;
  report(`${key} — не список`);
  return [];
}

// Переводчик одного языка: ctx.t = translator(ctx.lang)
export function translator(lang) {
  const tr = (key, params) => t(lang, key, params);
  tr.lang = lang;
  tr.list = (key) => tl(lang, key);
  return tr;
}

// ---------- отложенный текст: собирается при отправке на языке получателя ----------

export const tx = (key, params) => (params ? { $t: key, $p: params } : { $t: key });
// Дата: 'YYYY-MM-DD' или миллисекунды с поясом в часах
export const tdate = (d, offsetHours) => (typeof d === 'number' ? { $d: d, $o: offsetHours } : { $d: d });
export const tjoin = (sep, parts) => ({ $j: parts, $s: sep });

export function render(value, lang) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => render(v, lang));
  if (typeof value.$t === 'string') return t(lang, value.$t, value.$p);
  if (value.$d !== undefined) return typeof value.$d === 'number' ? formatMs(value.$d, value.$o, lang) : formatDate(value.$d, lang);
  if (Array.isArray(value.$j)) return value.$j.map((v) => render(v, lang)).join(value.$s ?? '');
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = render(v, lang);
  return out;
}

// ---------- даты ----------

export function formatDate(iso, lang = DEFAULT_LANG) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return t(lang, 'common.date', { day: Number(m[3]), month: tl(lang, 'common.monthsGen')[Number(m[2]) - 1] });
}

export function formatMs(ms, offsetHours = 3, lang = DEFAULT_LANG) {
  const d = new Date(ms + (offsetHours ?? 3) * 3600 * 1000);
  return t(lang, 'common.date', { day: d.getUTCDate(), month: tl(lang, 'common.monthsGen')[d.getUTCMonth()] });
}

// ---------- словарь приложения ----------

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Словарь app.* языка (нет ключа у языка — русский) и его версия; раз на экземпляр
const appCache = new Map();
export function appTexts(lang) {
  if (!appCache.has(lang)) {
    const texts = { ...DICTIONARIES[DEFAULT_LANG].app, ...(DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANG]).app };
    appCache.set(lang, { version: `${lang}:${fnv1a(JSON.stringify(texts))}`, texts });
  }
  return appCache.get(lang);
}

// Набор до ответа сервера (app.boot.*) — сервер вставляет его в страницу
export function bootTexts(lang = DEFAULT_LANG) {
  return Object.fromEntries(Object.entries(appTexts(lang).texts).filter(([k]) => k.startsWith('app.boot.')));
}

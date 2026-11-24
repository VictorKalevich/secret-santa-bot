// Тексты для людей — только из словаря (060, контракт specs/060-i18n-dictionary/contracts/i18n.md). Словарь языка —
// папка src/i18n/<язык>/: файл на область, ключ начинается с области (pairs.js → pairs.*, app-admin.js → app.admin.*).
// Строка собирается на языке того, кому она предназначена: ответ — вызывающему (ctx.t), сообщение очереди — получателю
// при отправке (tx → render в flushOutbox), подробность журнала — на языке смотрящего (061: запись хранит и отложенный
// текст; русская строка — для прежних записей и запасная).

import RU from './ru/index.js';
import EN from './en/index.js';
import ES from './es/index.js';
import PT from './pt/index.js';
import FR from './fr/index.js';
import DE from './de/index.js';
import ZH from './zh/index.js';
import IT from './it/index.js';
import TR from './tr/index.js';
import ID from './id/index.js';
import PL from './pl/index.js';

export const DEFAULT_LANG = 'ru';
// { [язык]: { server, app, plural? } } — plural: язык правил форм числа, если код языка не из Intl. Тесты добавляют
// служебный язык (и в LANGUAGES)
export const DICTIONARIES = { ru: RU, en: EN, es: ES, pt: PT, fr: FR, de: DE, zh: ZH, it: IT, tr: TR, id: ID, pl: PL };
// Языки бота в порядке списка выбора (061)
export const LANGUAGES = Object.keys(DICTIONARIES);
// Язык Telegram, которого нет в боте: этим — русский, остальным — FALLBACK_LANG (решение владельца 2026-11-25)
export const RUSSIAN_SPEAKING = ['be', 'uk', 'kk', 'ky', 'tg', 'uz', 'hy', 'az', 'tk'];
export const FALLBACK_LANG = 'en';

// Язык бота по коду языка Telegram (IETF: en-US, pt-br, zh-hant): основной код; нет кода — '' (язык неизвестен)
export function telegramLanguage(code) {
  const base = String(code ?? '').toLowerCase().split(/[-_]/)[0];
  if (!base) return '';
  if (LANGUAGES.includes(base)) return base;
  return RUSSIAN_SPEAKING.includes(base) ? DEFAULT_LANG : FALLBACK_LANG;
}

const known = (lang) => !!lang && Object.hasOwn(DICTIONARIES, lang);
// Язык человека (061): выбранный им → язык Telegram этого обращения (уже приведённый) → запомненный язык Telegram → русский
export function langOf(user, telegram = '') {
  for (const lang of [user?.lang, telegram, user?.tg_lang]) if (known(lang)) return lang;
  return DEFAULT_LANG;
}

// Слово подтверждения без регистра, пробелов по краям и диакритики (061): так сравниваются набранное и слово словаря
export function foldWord(s, lang = DEFAULT_LANG) {
  const text = String(s ?? '').trim();
  let up;
  try { up = text.toLocaleUpperCase(lang); } catch { up = text.toUpperCase(); }
  return up.normalize('NFD').replace(/\p{M}/gu, '');
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

// {имя} — значение подстановки; {имя.форма} — форма из набора форм подстановки (ownerWord: nom, gen, dat, ins, nomCap)
const SLOT = /\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g;

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
  return text.replace(SLOT, (m, name, form) => {
    let v = params && Object.hasOwn(params, name) ? params[name] : undefined;
    if (form !== undefined && v !== undefined) v = v && typeof v === 'object' && Object.hasOwn(v, form) ? v[form] : undefined;
    if (v !== undefined) return String(render(v, lang));
    report(`${key}: нет подстановки ${form ? name + '.' + form : name}`);
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
// HTML сообщения бота: экранирование текста; у отложенного — после сборки ({ $h: текст }, escapeHtml в format.js)
export const escapeText = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Текст: строка или отложенный текст (а не объект сообщения)
export const isText = (v) => typeof v === 'string' || (!!v && typeof v === 'object' && (typeof v.$t === 'string' || v.$d !== undefined || Array.isArray(v.$j) || v.$h !== undefined));

export function render(value, lang) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => render(v, lang));
  if (typeof value.$t === 'string') return t(lang, value.$t, value.$p);
  if (value.$d !== undefined) return typeof value.$d === 'number' ? formatMs(value.$d, value.$o, lang) : formatDate(value.$d, lang);
  if (Array.isArray(value.$j)) return value.$j.map((v) => render(v, lang)).join(value.$s ?? '');
  if (value.$h !== undefined) return escapeText(render(value.$h, lang));
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

// Тексты до ответа сервера (061): наборы app.boot.* всех языков и правило языка Telegram — сервер вставляет их в
// страницу, приложение выбирает язык по Telegram (тем же правилом, что telegramLanguage)
export function bootTexts() {
  const boot = (lang) => Object.fromEntries(Object.entries(appTexts(lang).texts).filter(([k]) => k.startsWith('app.boot.')));
  return {
    texts: Object.fromEntries(LANGUAGES.map((lang) => [lang, boot(lang)])),
    rule: { languages: LANGUAGES, russian: RUSSIAN_SPEAKING, fallback: FALLBACK_LANG },
  };
}

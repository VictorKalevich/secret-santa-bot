// Правила словаря языка (061, контракт specs/061-i18n-languages/contracts/translation.md): словарь src/i18n/<язык>/ — те же
// области, файлы и ключи, что у русского, значения того же вида, те же подстановки, формы числа по правилам языка, без
// кириллицы, те же теги разметки, слова подтверждения и пределы Telegram. Чистые функции — для теста i18n и для проверки
// одного языка во время перевода: node tests/support/i18n-lang-check.mjs en
import { readFileSync, existsSync } from 'node:fs';
import { slotsOf } from '../../src/i18n/index.js';

const ROOT = new URL('../../', import.meta.url);
const CYRILLIC = /[Ѐ-ӿ]/;
// Формы подстановки {owner.<форма>} (ownerWord, src/format.js)
export const OWNER_FORMS = ['nom', 'gen', 'dat', 'ins', 'nomCap'];
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
// Пределы Telegram: описание команды, описание и краткое описание бота, подпись кнопки меню
export const LIMITS = { 'setup.description': 512, 'setup.shortDescription': 120, 'setup.menuButton': 20 };
const COMMAND = 'setup.command.';

const kind = (v) => (typeof v === 'string' ? 'string' : Array.isArray(v) ? 'list' : v && typeof v === 'object' ? 'forms' : typeof v);

// Категории форм числа языка для целых 0…1000 (у нового языка — и other: на неё падает всё прочее)
export function pluralCategories(lang) {
  const rules = new Intl.PluralRules(lang);
  const set = new Set();
  for (let n = 0; n <= 1000; n++) set.add(rules.select(n));
  if (lang !== 'ru') set.add('other');
  return set;
}

// Подстановки с формой: {owner.gen} → ['owner', 'gen']
const formSlots = (text) => [...String(text).matchAll(/\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}/g)].map((m) => [m[1], m[2]]);
// Теги разметки (имя, в порядке появления — сравниваются как мультимножество)
const tagsOf = (text) => [...String(text).matchAll(/<\/?([a-zA-Z]+)(?:\s[^>]*)?>/g)].map((m) => m[0].startsWith('</') ? '/' + m[1] : m[1]).sort().join(',');
// Символы < > и & вне тегов и сущностей
const bareMarkup = (text) => {
  const s = String(text).replace(/<\/?[a-zA-Z]+(?:\s[^>]*)?>/g, '').replace(/&(?:[a-z]+|#\d+);/g, '');
  return /[<>&]/.test(s);
};
const texts = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v));
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Нарушения одного значения: ключ, русское значение, значение языка
export function valueProblems(lang, key, ruValue, value) {
  const out = [];
  const at = (msg) => out.push(`${lang} ${key}: ${msg}`);
  if (value === undefined) return [`${lang} ${key}: нет перевода`];
  const k = kind(ruValue);
  if (kind(value) !== k) return [`${lang} ${key}: вид значения ${kind(value)}, у русского — ${k}`];
  if (k === 'list') {
    if (value.length !== ruValue.length) at(`список из ${value.length}, у русского — ${ruValue.length}`);
    if (value.some((x) => typeof x !== 'string' || !x.trim())) at('пустой или не текстовый элемент списка');
  }
  if (k === 'forms') {
    const need = pluralCategories(lang);
    const have = new Set(Object.keys(value));
    for (const c of need) if (!have.has(c)) at(`нет формы ${c}`);
    for (const c of have) if (!need.has(c)) at(`лишняя форма ${c} (у языка формы: ${[...need].join(', ')})`);
    for (const c of have) if (!PLURAL_CATEGORIES.includes(c)) at(`неизвестная форма ${c}`);
    const ruHasN = Object.values(ruValue).every((f) => f.includes('{n}'));
    if (ruHasN) for (const [c, f] of Object.entries(value)) if (!String(f).includes('{n}')) at(`в форме ${c} нет {n}`);
  }
  if (k === 'string' && ruValue.trim() && !value.trim()) at('пустой перевод');
  if (k !== 'list') {
    const ruSlots = slotsOf(ruValue);
    const slots = slotsOf(value);
    if (k === 'forms') ruSlots.delete('n'), slots.delete('n');
    if (!sameSet(ruSlots, slots)) at(`подстановки {${[...slots].join('}, {')}}, у русского — {${[...ruSlots].join('}, {')}}`);
    for (const text of texts(value)) {
      for (const [name, form] of formSlots(text)) {
        if (name !== 'owner' || !OWNER_FORMS.includes(form)) at(`подстановка {${name}.${form}} — формы есть только у owner: ${OWNER_FORMS.join(', ')}`);
      }
    }
  }
  for (const [i, text] of texts(value).entries()) {
    const ruText = texts(ruValue)[Math.min(i, texts(ruValue).length - 1)];
    if (CYRILLIC.test(text)) at('кириллица');
    if (tagsOf(text) !== tagsOf(ruText)) at(`теги разметки «${tagsOf(text)}», у русского — «${tagsOf(ruText)}»`);
    if (bareMarkup(text) && !bareMarkup(ruText)) at('символ < > или & вне разметки');
  }
  if (k === 'string') {
    if (key.startsWith(COMMAND) && (value.length < 1 || value.length > 256)) at(`описание команды — ${value.length} символов (1…256)`);
    if (LIMITS[key] && value.length > LIMITS[key]) at(`${value.length} символов (предел ${LIMITS[key]})`);
    if (key.startsWith('app.core.word.')) {
      if (!/^\S+$/u.test(value)) at('слово подтверждения — одно слово без пробелов');
      if (value.toLocaleUpperCase(lang) !== value) at('слово подтверждения — заглавными');
    }
    if (key === 'app.core.locale' && value !== lang) at(`код языка — «${lang}»`);
  }
  return out;
}

// Все нарушения словаря языка: ruAreas и areas — AREAS русского и языка ([область, файл, тексты]); source(файл) — текст
// файла словаря языка (кириллица и в комментариях)
export function languageProblems(lang, ruAreas, areas, source = (f) => readFileSync(new URL(`src/i18n/${lang}/${f}`, ROOT), 'utf8')) {
  const out = [];
  const shape = (list) => list.map(([area, file]) => `${area}:${file}`).join(' ');
  if (shape(ruAreas) !== shape(areas)) out.push(`${lang}: области и файлы index.js не как у русского`);
  const mine = new Map(areas.map(([area, file, texts]) => [area, { file, texts }]));
  for (const [area, file, ruTexts] of ruAreas) {
    const own = mine.get(area);
    if (!own) continue;
    const text = source(file);
    text.split('\n').forEach((line, i) => { if (CYRILLIC.test(line)) out.push(`src/i18n/${lang}/${file}:${i + 1}: кириллица`); });
    for (const key of Object.keys(ruTexts)) out.push(...valueProblems(lang, key, ruTexts[key], own.texts[key]));
    for (const key of Object.keys(own.texts)) if (!Object.hasOwn(ruTexts, key)) out.push(`${lang} ${key}: лишний ключ (у русского нет)`);
  }
  return out;
}

// Словарь языка с диска: [AREAS] или текст ошибки загрузки
export async function loadLanguage(lang) {
  const url = new URL(`src/i18n/${lang}/index.js`, ROOT);
  if (!existsSync(url)) return { error: `${lang}: нет src/i18n/${lang}/index.js` };
  try {
    return { areas: (await import(url.href)).AREAS };
  } catch (e) {
    return { error: `${lang}: словарь не загружается — ${e.message}` };
  }
}

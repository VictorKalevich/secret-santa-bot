// Правила словаря по исходникам (060, контракт specs/060-i18n-dictionary/contracts/i18n.md, раздел 8): кириллица — только
// в словарях, ключи в коде есть в словаре, ключи словаря используются, ключ начинается с области своего файла.
// Чистые функции — для теста i18n и для проверки отдельных файлов во время переноса:
//   node tests/support/i18n-check.mjs src/pairs.js src/app/06-admin.js.txt
import { readFileSync, readdirSync } from 'node:fs';
import { AREAS } from '../../src/i18n/ru/index.js';

const ROOT = new URL('../../', import.meta.url);
export const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// Области словаря: 'pairs', 'app.admin', … (первая часть ключа; у приложения — две)
export const AREA_NAMES = AREAS.map(([area]) => area);
const areaOfKey = (key) => AREA_NAMES.find((a) => key.startsWith(a + '.')) || null;

// Файлы кода с текстами для людей: модули сервера, части приложения и модуль словаря (словари и тесты — нет)
export function codeFiles() {
  return [
    ...readdirSync(new URL('src/', ROOT)).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f),
    ...readdirSync(new URL('src/app/', ROOT)).map((f) => 'src/app/' + f),
    'src/i18n/index.js',
  ];
}

// Строка без комментариев (номера строк сохраняются): /* … */, <!-- … -->, «//» после пробела, скобки или в начале
const blank = (m) => m.replace(/[^\n]/g, ' ');
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .split('\n')
    .map((line) => line.replace(/(^|[\s;,{}()])\/\/.*$/, '$1'))
    .join('\n');
}

// Кириллица вне словаря: строки кода с буквами кириллицы. Не в счёт: сообщения для разработчика — new Error(…),
// console.*, i18nError(…) (ядро словаря приложения), report(…) (модуль словаря)
const DEVELOPER = /\bnew Error\(|\bconsole\.\w+\(|\bi18nError\(|\breport\(/;
export function cyrillicLines(file, text = read(file)) {
  const found = [];
  stripComments(text).split('\n').forEach((line, i) => {
    if (/[А-Яа-яЁё]/.test(line) && !DEVELOPER.test(line)) found.push(`${file}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
  return found;
}

// Ключи в коде. Вызов t('ключ' / tx('ключ' / tl('ключ' (и ctx.t, tr.list) — ключ должен быть в словаре; семейство —
// t('pairs.reason.' + тип): ключи берутся по имени из данных (тип причины, код журнала, id открытки). Любой литерал вида
// 'область.имя' (поля таблиц: finished, owner, confirm) — использование ключа, если он есть в словаре
const KEY = String.raw`(?:app\.)?[a-z][A-Za-z]*(?:\.[A-Za-z0-9_]+)+`;
const CALL = new RegExp(String.raw`\b(?:t|tx|tl|list)\(\s*(['"])(${KEY})\1\s*([,)+])`, 'g');
const FAMILY = new RegExp(String.raw`\b(?:t|tx|tl|list)\(\s*(['"])(${KEY}\.)\1\s*\+`, 'g');
const LITERAL = new RegExp(String.raw`(['"` + '`' + String.raw`])(${KEY}\.?)\1`, 'g');
export function keysIn(text) {
  const code = stripComments(text);
  const called = new Set();
  const families = new Set();
  const literals = new Set();
  for (const m of code.matchAll(CALL)) if (m[3] !== '+') called.add(m[2]);
  for (const m of code.matchAll(FAMILY)) families.add(m[2]);
  for (const m of code.matchAll(LITERAL)) {
    if (!areaOfKey(m[2])) continue;
    if (m[2].endsWith('.')) families.add(m[2]);
    else literals.add(m[2]);
  }
  return { called, families, literals };
}

// Русский словарь: ключ → { area, file, value }
export function dictionary() {
  const out = new Map();
  for (const [area, file, texts] of AREAS) {
    for (const [k, v] of Object.entries(texts)) out.set(k, { area, file: 'src/i18n/ru/' + file, value: v });
  }
  return out;
}

// Ключ начинается с области своего файла
export function prefixProblems() {
  const found = [];
  for (const [area, file, texts] of AREAS) {
    for (const k of Object.keys(texts)) {
      if (!k.startsWith(area + '.')) found.push(`src/i18n/ru/${file}: ключ ${k} — не из области ${area}`);
    }
  }
  return found;
}

// Ключи вызовов, которых нет в словаре, и семейства без ключей
export function missingKeys(files, dict = dictionary()) {
  const found = [];
  for (const f of files) {
    const { called, families } = keysIn(read(f));
    for (const k of called) if (!dict.has(k)) found.push(`${f}: нет ключа ${k} в словаре`);
    for (const fam of families) if (![...dict.keys()].some((k) => k.startsWith(fam))) found.push(`${f}: нет ключей семейства ${fam}`);
  }
  return found;
}

// Ключи словаря, которых нет в коде (ни вызовом, ни литералом, ни семейством)
export function unusedKeys(files = codeFiles(), dict = dictionary()) {
  const keys = new Set();
  const families = new Set();
  for (const f of files) {
    const r = keysIn(read(f));
    for (const k of [...r.called, ...r.literals]) keys.add(k);
    for (const fam of r.families) families.add(fam);
  }
  return [...dict.keys()].filter((k) => !keys.has(k) && ![...families].some((fam) => k.startsWith(fam)))
    .map((k) => `${dict.get(k).file}: ключ ${k} нигде не используется`);
}

// Склейка мини-приложения для тестов (021): та же, что отдаёт Worker, — из src/app-page.js через перехватчик загрузки
// текста, без своего списка файлов. PARTS и where() переводят номер строки склейки в часть и строку в ней.
import './text-hooks.mjs'; // до импорта частей: .html и .txt — как текст

// Динамический импорт: статический загрузил бы части раньше, чем зарегистрирован перехватчик text-hooks
const page = await import('../../src/app-page.js');

export const APP = page.default;

// [{ name, text, start }] — start: номер первой строки части в склейке (с 1)
export const PARTS = [];
let line = 1;
for (const [name, text] of page.APP_PARTS) {
  PARTS.push({ name, text, start: line });
  line += text.split('\n').length - 1;
}

// Номер строки склейки (с 1) → «src/app/<часть>:<строка в части>»
export function where(n) {
  let part = PARTS[0];
  for (const p of PARTS) if (p.start <= n) part = p;
  return `src/app/${part.name}:${n - part.start + 1}`;
}

// Строки части в склейке: [первая, последняя] — номера с 0 (последняя строка части — её завершающий перевод строки)
export function partLines(name) {
  const p = PARTS.find((x) => x.name === name);
  if (!p) throw new Error(`нет части ${name}`);
  return [p.start - 1, p.start - 1 + p.text.split('\n').length - 2];
}

// ---------- разбор текста частей (026, 030) ----------
export const indent = (line) => /^ */.exec(line)[0].length;
// Комментарий до конца строки: целая строка «// …» или « // …» после кода (у адресов «://» пробела перед нет)
export const code = (line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\s\/\/\s.*$/, ''));

// Блок по отступам (стиль частей): строка start и следующие — до первой строки с тем же отступом, которая начинается
// с } или ) (включительно); если скобки строки start закрылись на ней же — одна строка. → номера строк (с 0)
export function blockAt(lines, start) {
  const line = code(lines[start]);
  const open = (line.match(/[({[]/g) || []).length - (line.match(/[)}\]]/g) || []).length;
  if (open <= 0) return [start, start];
  for (let i = start + 1; i < lines.length; i++) {
    if (indent(lines[i]) === indent(lines[start]) && /^\s*[)}]/.test(lines[i])) return [start, i];
  }
  return [start, lines.length - 1];
}
// Объявление верхнего уровня (отступ 2): function name / async function name / const name = / let name =
export const TOP = (name) => new RegExp(`^  (?:(?:async )?function ${name}\\b|(?:const|let) ${name} = )`);
export function topBlock(lines, name) {
  const i = lines.findIndex((l) => TOP(name).test(l));
  return i < 0 ? null : blockAt(lines, i);
}
// Имя объявления верхнего уровня, в котором стоит строка i (или текст самой строки, если это не объявление)
export function ownerOf(lines, i) {
  for (let j = i; j >= 0; j--) {
    const l = lines[j];
    if (indent(l) !== 2 || !l.trim() || /^\s*(\/\/|[)}\]])/.test(l)) continue;
    const m = /^  (?:(?:async )?function (\w+)|(?:const|let) (\w+))/.exec(l);
    return { name: m ? m[1] || m[2] : null, line: j };
  }
  return { name: null, line: 0 };
}

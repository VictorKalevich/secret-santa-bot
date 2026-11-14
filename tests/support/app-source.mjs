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

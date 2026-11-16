// 030: панель организатора по секциям — правила по склейке мини-приложения, по образцу app-ui (026). Панель — часть
// src/app/05-admin.js.txt: renderAdmin собирает объект панели p, секции adminXxx(p) — функции верхнего уровня.
// Контракт — specs/030-admin-panel-parts/contracts/admin-panel.md. Переключатель регистрации в браузере проверяет
// checkRegistration в tests/screenshots.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, where, partLines, indent, blockAt } from './support/app-source.mjs';

const PANEL = partLines('05-admin.js.txt');
const PANEL_MAX = 100;

// ---------- 1. Функции панели не длиннее предела ----------
// [from, to] — строки части (с 0); → [номер строки, что не так]
export function longPanelFunctions(text, [from, to] = PANEL, max = PANEL_MAX) {
  const lines = text.split('\n');
  const found = [];
  for (let i = from; i <= to; i++) {
    const m = /^  (?:(?:async )?function (\w+)|(?:const|let) (\w+) = )/.exec(lines[i]);
    if (!m || indent(lines[i]) !== 2) continue;
    const [a, b] = blockAt(lines, i);
    if (b - a + 1 > max) found.push([i + 1, `${m[1] || m[2]} — ${b - a + 1} строк, предел ${max}: раздели на секции`]);
    i = b;
  }
  return found;
}

// ---------- тесты ----------
const RULES = [
  [`1. функции панели не длиннее ${PANEL_MAX} строк`, longPanelFunctions],
];
for (const [name, rule] of RULES) {
  test(name, () => {
    assert.deepEqual(rule(APP).map(([n, why]) => `${where(n)}: ${why}`), []);
  });
}

const lines = (...l) => l.join('\n');
const at = (found) => found.map(([n]) => n);

test('от противного 1: длинная функция панели находится, короткая и вне части — нет', () => {
  const body = (n) => Array.from({ length: n }, () => '    x++;');
  const text = lines(
    '  const renderAdmin = screen(async () => {', ...body(2), '  });',
    '  function adminBig(p) {', ...body(4), '  }',
    '  const short = (p) => p.x;',
    '  function elsewhere() {', ...body(4), '  }');
  // Часть панели — строки 1–11; adminBig — 6 строк
  assert.deepEqual(at(longPanelFunctions(text, [0, 10], 5)), [5]);
  assert.deepEqual(longPanelFunctions(text, [0, 10], 6), []);
  assert.deepEqual(at(longPanelFunctions(text, [0, 16], 5)), [5, 12]);
});

// 030: панель организатора по секциям — правила по склейке мини-приложения, по образцу app-ui (026). Панель — часть
// src/app/06-admin.js.txt: renderAdmin собирает объект панели p, секции adminXxx(p) — функции верхнего уровня.
// Контракт — specs/030-admin-panel-parts/contracts/admin-panel.md. Переключатель регистрации в браузере проверяет
// checkRegistration в tests/screenshots.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, where, partLines, indent, code, blockAt, ownerOf } from './support/app-source.mjs';

const PANEL = partLines('06-admin.js.txt');
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

// ---------- 2. Переключатель, от значения которого зависит другая часть панели, обновляет её ----------
// Переключатель: const имя = h('input', { … checked: s.ключ | d.ключ … }) и bindToggle(имя, …). Если s.ключ (d.ключ)
// читается в панели где-то ещё, обработчик перестраивает панель (again/refresh) или сообщает set('ключ', …)
export function togglesUpdate(text, [from, to] = PANEL) {
  const lines = text.split('\n');
  const found = [];
  for (let i = from; i <= to; i++) {
    const m = /\bbindToggle\((\w+),/.exec(code(lines[i]));
    if (!m) continue;
    let decl = i;
    while (decl >= from && !new RegExp(`\\bconst ${m[1]} = h\\('input'`).test(lines[decl])) decl--;
    const key = decl >= from && /\bchecked: ([sd])\.(\w+)/.exec(code(lines[decl]));
    if (!key) continue;
    const [a, b] = blockAt(lines, i);
    const use = new RegExp(`\\b${key[1]}\\.${key[2]}\\b`);
    let other = -1;
    for (let j = from; j <= to && other < 0; j++) {
      if (j !== decl && (j < a || j > b) && use.test(code(lines[j]))) other = j;
    }
    if (other < 0) continue;
    const body = lines.slice(a, b + 1).map(code).join('\n');
    if (!/\b(again|refresh)\(/.test(body) && !body.includes(`set('${key[2]}'`)) {
      found.push([i + 1, `переключатель ${key[1]}.${key[2]}: от него зависит ${where(other + 1)}, а обработчик не перестраивает панель (again/refresh) и не сообщает set('${key[2]}', …)`]);
    }
  }
  return found;
}

// ---------- 3. Без копий ----------
// [что, образец строки, единственное объявление верхнего уровня, где он может стоять]
const ONCE = [
  ['заголовок строки «имя  @username»', /'  @' \+/, 'personTitle'],
  ['возврат к событию после шторки', /\brenderWard\(\{ cached: true \}\)/, 'backToEvent'],
];
export function copies(text) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((l, i) => {
    for (const [what, re, home] of ONCE) {
      const owner = ownerOf(lines, i).name;
      if (re.test(code(l)) && owner !== home) found.push([i + 1, `${what} в ${owner || 'коде верхнего уровня'} — только в ${home}`]);
    }
  });
  return found;
}

// ---------- тесты ----------
const RULES = [
  [`1. функции панели не длиннее ${PANEL_MAX} строк`, longPanelFunctions],
  ['2. переключатель, от которого зависит другая часть панели, обновляет её', togglesUpdate],
  ['3. без копий: заголовок «имя  @username» и возврат к событию после шторки — по одному помощнику', copies],
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

test('от противного 2: переключатель без обновления зависимой части находится', () => {
  const text = lines(
    '  function adminA(p) {',
    "    const reg = h('input', { type: 'checkbox', checked: s.registration_open });",
    '    bindToggle(reg, async (on) => {',
    "      await xapi('admin.registration', { open: on }); // again() в комментарии не считается",
    '    });',
    "    const appr = h('input', { type: 'checkbox', checked: s.approval });",
    "    bindToggle(appr, async (on) => { await xapi('admin.game', { approval: on }); });",
    "    const part = h('input', { type: 'checkbox', checked: d.me_member });",
    '    bindToggle(part, async (on) => { await refresh(); });',
    '  }',
    '  function adminB(p) {',
    '    inv.disabled = !s.registration_open;',
    '    vault(d.me_member);',
    '  }');
  assert.deepEqual(at(togglesUpdate(text, [0, 13])), [3]);
  assert.deepEqual(togglesUpdate(text.replace('{ open: on });', "{ open: on }); p.set('registration_open', on);"), [0, 13]), []);
  assert.deepEqual(togglesUpdate(text.replace('{ open: on });', '{ open: on }); await again();'), [0, 13]), []);
  // Зависимой части нет — обновлять нечего
  assert.deepEqual(togglesUpdate(text, [0, 9]), []);
});

test('от противного 3: копия вне своего помощника находится, в помощнике и в комментарии — нет', () => {
  const text = lines(
    "  const personTitle = (u) => h('div', {}, u.name, u.username ? h('span', {}, '  @' + u.username) : null);",
    '  function adminRemoved(p) {',
    "    remList.append(h('div', {}, r.name, r.username ? h('span', {}, '  @' + r.username) : null));",
    "    // раньше: '  @' + r.username",
    '  }',
    '  async function backToEvent(evId) {',
    '    renderWard({ cached: true });',
    '  }',
    '  function openSupport() {',
    '    const own = openSheet(t, [], { onClose: async () => { renderWard({ cached: true }); } });',
    '  }');
  assert.deepEqual(at(copies(text)), [3, 10]);
});

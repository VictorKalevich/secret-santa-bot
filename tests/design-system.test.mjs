// Проверка Конституции, принцип IV «Только дизайн-система».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP, where, code, topBlock } from './support/app-source.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tokens = read('design-system/tokens.css');
const components = read('design-system/components.css');
const app = APP; // склейка частей src/app/ — та же страница, что отдаёт Worker (021)
const preview = read('design-system/preview.html');

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const RAW_PX = /\d(\.\d+)?px\b/;

test('компоненты используют только токены: нет сырых цветов и px', () => {
  const css = stripComments(components);
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    assert.ok(!RAW_COLOR.test(line), `components.css:${i + 1} — сырой цвет: ${line.trim()}`);
    assert.ok(!RAW_PX.test(line), `components.css:${i + 1} — сырые px: ${line.trim()}`);
  });
});

test('базовые стили элементов не перебивают компоненты (только через :where)', () => {
  const css = stripComments(components);
  // Запрещено: «.ds-root button {…}» и т.п. — такой селектор сильнее «.ds-btn--secondary» и ломает цвета (002, US4)
  const bad = css.match(/(^|[,}])\s*\.ds-root\s+(button|input|textarea|select|a|label|span|div)\b[^{]*\{/gm);
  assert.equal(bad, null, `базовый селектор без :where(): ${bad && bad[0].trim()}`);
  assert.match(css, /:where\(\.ds-root\)\s*:where\(button, input, textarea, select\)/);
});

test('все var(--ds-*) в компонентах определены в токенах', () => {
  const defined = new Set([...tokens.matchAll(/(--ds-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...components.matchAll(/var\((--ds-[a-z0-9-]+)/g)].map((m) => m[1]));
  for (const v of used) assert.ok(defined.has(v), `токен ${v} не определён в tokens.css`);
});

test('приложение не содержит своих стилей: только встраиваемая дизайн-система', () => {
  const styles = [...app.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1].trim());
  assert.deepEqual(styles, ['/*@design-system*/'], 'в приложении допускается только плейсхолдер дизайн-системы');
  assert.ok(!/\sstyle=/.test(app), 'атрибуты style= запрещены');
  assert.ok(!/[{,]\s*['"]?style['"]?\s*:/.test(app), 'style в h()-атрибутах запрещён');
  assert.ok(!RAW_COLOR.test(app.replace(/<script src=[^>]+><\/script>/, '')), 'сырые цвета в приложении запрещены');
  assert.ok(!RAW_PX.test(app), 'сырые px в приложении запрещены');
});

test('все классы ds-* из приложения существуют в компонентах', () => {
  const definedClasses = new Set([...components.matchAll(/\.(ds-[a-z0-9_-]+)/g)].map((m) => m[1]));
  const usedClasses = new Set([...app.matchAll(/\b(ds-[a-z0-9_-]+)/g)].map((m) => m[1]).filter((c) => !c.endsWith('-') && !c.endsWith('--')));
  for (const c of usedClasses) assert.ok(definedClasses.has(c), `класс .${c} используется, но не описан в components.css`);
});

test('в приложении нет классов вне дизайн-системы', () => {
  const classAttrs = [...app.matchAll(/class(?:Name)?\s*[:=]\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  for (const value of classAttrs) {
    for (const cls of value.split(/\s+/).filter(Boolean)) {
      if (cls.includes('$') || cls.includes('+')) continue;
      assert.ok(cls.startsWith('ds-'), `класс «${cls}» не из дизайн-системы`);
    }
  }
});

test('превью показывает все компоненты', () => {
  const blocks = new Set([...components.matchAll(/\.(ds-[a-z0-9-]+)(?=[\s{.:,>[])/g)].map((m) => m[1].split('__')[0].split('--')[0]));
  const skip = new Set(['ds-root']);
  for (const b of blocks) {
    if (skip.has(b)) continue;
    assert.ok(preview.includes(b), `превью не показывает компонент .${b}`);
  }
});

test('системные элементы в схеме темы Telegram (011)', () => {
  assert.match(tokens, /--ds-color-scheme:\s*var\(--tg-color-scheme,\s*light dark\)/);
  const css = stripComments(components);
  assert.match(css, /:where\(:root, \.ds-theme\)\s*\{\s*color-scheme:\s*var\(--ds-color-scheme\)/);
  assert.match(css, /:where\(\.ds-root\)\s*:where\(option, optgroup\)\s*\{[^}]*background-color:\s*var\(--ds-color-surface\)[^}]*color:\s*var\(--ds-color-text\)/);
});

test('открытая шторка блокирует прокрутку страницы (011)', () => {
  const css = stripComments(components);
  assert.match(css, /\.ds-root--locked\s*\{\s*overflow:\s*hidden/);
  for (const [sel, re] of [['.ds-sheet', /\.ds-sheet\s*\{([^}]*)\}/], ['.ds-chat', /\.ds-chat\s*\{([^}]*)\}/]]) {
    const block = css.match(re);
    assert.ok(block && /overscroll-behavior:\s*contain/.test(block[1]), `${sel}: нет overscroll-behavior: contain`);
  }
  const open = app.match(/function openSheet\([\s\S]*?\n {2}\}/)[0];
  const close = app.match(/function closeSheet\([\s\S]*?\n {2}\}/)[0];
  assert.match(open, /document\.body\.classList\.add\('ds-root--locked'\)/);
  assert.match(close, /document\.body\.classList\.remove\('ds-root--locked'\)/);
  assert.equal((app.match(/ds-root--locked/g) || []).length, 2, 'блокировка ставится и снимается только в openSheet/closeSheet');
});

test('стрелка выпадающего списка с отступом справа как у текста слева (011)', () => {
  const css = stripComments(components);
  const block = css.match(/select\.ds-input\s*\{([^}]*)\}/);
  assert.ok(block, 'нет правила select.ds-input');
  assert.match(block[1], /appearance:\s*none/);
  assert.match(block[1], /background-position:[^;]*right var\(--ds-space-3\) center/);
  assert.match(block[1], /padding-right:\s*calc\(var\(--ds-space-3\)/);
  assert.match(css, /\.ds-input\s*\{[^}]*padding:\s*var\(--ds-space-3\)/, 'отступ текста слева — --ds-space-3');
});

test('поле даты: значок на отступе поля, «Сбросить» закрывает календарь (011)', () => {
  const css = stripComments(components);
  const block = css.match(/\.ds-input\[type="date"\]\s*\{([^}]*)\}/);
  assert.ok(block, 'нет правила .ds-input[type="date"]');
  assert.match(block[1], /appearance:\s*none/);
  assert.match(block[1], /text-align:\s*start/);
  assert.match(block[1], /min-height:\s*calc\(2 \* var\(--ds-space-3\) \+ var\(--ds-leading-base\) \* 1em\)/);
  const icon = css.match(/\.ds-input::-webkit-calendar-picker-indicator\s*\{([^}]*)\}/);
  assert.ok(icon, 'нет правила значка календаря');
  assert.match(icon[1], /padding:\s*0/);
  assert.match(icon[1], /margin:\s*0 calc\(-1 \* var\(--ds-date-icon-bleed\)\) 0 var\(--ds-space-2\)/);
  assert.match(css, /\.ds-input::-webkit-date-and-time-value\s*\{[^}]*margin:\s*0[^}]*text-align:\s*start/);
  // все поля даты приложения — через ui.date (закрытие календаря по «Сбросить»)
  assert.equal((app.match(/type: 'date'/g) || []).length, 1, 'поле даты создаётся только в ui.date');
  assert.match(app, /date: \(value\) => closeOnReset\(h\('input', \{ class: 'ds-input', type: 'date', value \}\)\)/);
  const fn = app.match(/function closeOnReset\([\s\S]*?\n {2}\}/)[0];
  assert.match(fn, /addEventListener\('keydown'/);
  assert.match(fn, /addEventListener\('input', onClear\)/);
  assert.match(fn, /addEventListener\('change', onClear\)/);
  assert.match(fn, /el\.blur\(\)/);
});

// 033: у каждой шторки драгер. Шторку собирает только openSheet, драгер ставит только он (sheetHandle) — новая шторка
// получает полосу сама; в витрине у каждой шторки полоса первой; полоса прилипает к верху прокрученной шторки.
// → [номер строки склейки или 0 — вне склейки, что не так]
export function sheetHandleRule(text, html, css) {
  const lines = text.split('\n');
  const open = topBlock(lines, 'openSheet');
  const drag = topBlock(lines, 'sheetHandle');
  if (!open) return [[1, 'нет function openSheet(']];
  const found = [];
  const inside = (b, i) => !!b && i >= b[0] && i <= b[1];
  let placed = false;
  lines.forEach((raw, i) => {
    const l = code(raw);
    if (/['" ]ds-sheet(?:-backdrop)?['" ]/.test(l) && !inside(open, i)) found.push([i + 1, 'шторка собрана в обход openSheet — у неё не будет драгера']);
    if (/ds-sheet__handle/.test(l) && !inside(drag, i)) found.push([i + 1, 'полоса драгера вне sheetHandle — свой или второй драгер']);
    if (/\bsheetHandle\(/.test(l) && !/^ {2}function sheetHandle\(/.test(l)) {
      if (inside(open, i) && /\bsheetHandle\(sheetEl\);/.test(l)) placed = true;
      else found.push([i + 1, 'sheetHandle вне openSheet — драгер ставит только openSheet, у каждой шторки он один']);
    }
  });
  if (!drag) found.push([1, 'нет function sheetHandle(']);
  if (!placed) found.push([open[0] + 1, 'openSheet не ставит драгер (sheetHandle(sheetEl);) — у шторок не будет полосы']);
  for (const m of html.matchAll(/<div class="ds-sheet((?: [^"]*)?)">\s*(<[^>]*>)?/g)) {
    const cls = 'ds-sheet' + m[1];
    if (!m[1].includes('ds-sheet--handle') || !/^<div class="ds-sheet__handle"/.test(m[2] || '')) {
      found.push([0, `preview.html: шторка «${cls}» без драгера (ds-sheet--handle и полоса ds-sheet__handle первой)`]);
    }
  }
  const handle = /\.ds-sheet__handle\s*\{([^}]*)\}/.exec(css);
  if (!handle) found.push([0, 'components.css: нет .ds-sheet__handle']);
  else {
    for (const [re, what] of [[/position:\s*sticky/, 'position: sticky'], [/(?:^|[;\s])top:\s*0/, 'top: 0'],
      [/background:\s*var\(--ds-color-bg\)/, 'background: var(--ds-color-bg)'], [/z-index:\s*var\(--ds-z-sticky\)/, 'z-index: var(--ds-z-sticky)']]) {
      if (!re.test(handle[1])) found.push([0, `components.css: у .ds-sheet__handle нет ${what} — у прокрученной шторки полоса уедет вверх`]);
    }
  }
  const full = [...css.matchAll(/\.ds-sheet--full\s*\{([^}]*)\}/g)];
  if (full.some((m) => /padding-top/.test(m[1]))) found.push([0, 'components.css: .ds-sheet--full задаёт padding-top — перебивает .ds-sheet--handle, полоса не у верхнего края']);
  return found;
}
const report = (found) => found.map(([n, why]) => (n ? `${where(n)}: ${why}` : why)).join('\n');

test('у каждой шторки драгер: шторку строит openSheet, драгер — только он; витрина и стиль полосы (033)', () => {
  const found = sheetHandleRule(app, preview, stripComments(components));
  assert.equal(found.length, 0, report(found));
});

test('от противного (033): шторка в обход, второй драгер, шторка без полосы и полоса без прилипания находятся', () => {
  const good = [
    '  function openSheet(title, content) {',
    "    sheetEl = h('div', { class: 'ds-sheet-backdrop' }, h('div', { class: 'ds-sheet ds-stack' }, header));",
    '    sheetHandle(sheetEl);',
    '  }',
    '  function sheetHandle(own) {',
    "    const handle = h('div', { class: 'ds-sheet__handle' });",
    '  }',
  ].join('\n');
  const html = '<div class="ds-sheet ds-sheet--handle ds-stack">\n  <div class="ds-sheet__handle"></div>\n</div>';
  const css = '.ds-sheet__handle { position: sticky; top: 0; z-index: var(--ds-z-sticky); background: var(--ds-color-bg); }\n.ds-sheet--full { height: 100%; }';
  assert.deepEqual(sheetHandleRule(good, html, css), [], 'верный образец — без нарушений');
  const has = (found, part) => found.some(([, why]) => why.includes(part));
  const own = good + "\n  function letter() {\n    const box = h('div', { class: 'ds-sheet-backdrop' }, h('div', { class: 'ds-sheet' }));\n  }";
  assert.ok(has(sheetHandleRule(own, html, css), 'в обход openSheet'), 'шторка в обход openSheet не найдена');
  const second = good + "\n  function letter() {\n    const own = openSheet('Письмо', []);\n    sheetHandle(own);\n  }";
  assert.ok(has(sheetHandleRule(second, html, css), 'sheetHandle вне openSheet'), 'второй вызов sheetHandle не найден');
  const strip = good + "\n  function calendar() {\n    own.prepend(h('div', { class: 'ds-sheet__handle' }));\n  }";
  assert.ok(has(sheetHandleRule(strip, html, css), 'вне sheetHandle'), 'своя полоса не найдена');
  assert.ok(has(sheetHandleRule(good.replace('    sheetHandle(sheetEl);\n', ''), html, css), 'openSheet не ставит'), 'openSheet без драгера не найден');
  const bare = html + '\n<div class="ds-sheet ds-sheet--full">\n  <div class="ds-row"></div>\n</div>';
  assert.ok(has(sheetHandleRule(good, bare, css), '«ds-sheet ds-sheet--full» без драгера'), 'шторка витрины без полосы не найдена');
  assert.ok(has(sheetHandleRule(good, html, css.replace('position: sticky; ', '')), 'position: sticky'), 'полоса без sticky не найдена');
  assert.ok(has(sheetHandleRule(good, html, css + '\n.ds-sheet--full { padding-top: var(--ds-space-3); }'), 'перебивает'), 'padding-top у --full не найден');
  assert.deepEqual(sheetHandleRule('  function other() {\n  }', html, css).map(([, w]) => w), ['нет function openSheet(']);
});

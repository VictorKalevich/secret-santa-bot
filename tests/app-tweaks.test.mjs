// 027: мелкие правки мини-приложения — правила по склейке, по образцу app-ui (026). Каждое правило — функция, которая
// находит нарушения ([номер строки склейки или 0 — вне склейки, что не так]); тест — «нарушений нет» и «от противного».
// Контракт — specs/027-ui-tweaks/contracts/app-calendar.md. Поведение в браузере — checkTweaks в tests/screenshots.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP, where } from './support/app-source.mjs';
import { appTexts, DEFAULT_LANG } from '../src/i18n/index.js';

const APP_DICT = appTexts(DEFAULT_LANG).texts;
const CSS = readFileSync(new URL('../design-system/components.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Верхнеуровневая функция name (отступ 2) до её закрывающей строки «  }» → { start (номер строки с 0), text }; null — нет
function fnText(text, name) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => new RegExp(`^  (?:async )?function ${name}\\(`).test(l));
  if (i < 0) return null;
  const j = lines.findIndex((l, k) => k > i && l === '  }');
  return { start: i, text: lines.slice(i, j < 0 ? lines.length : j + 1).join('\n') };
}
// Номер (с 1) первой строки, подходящей под re; 1 — если такой нет
const lineOf = (text, re) => Math.max(0, text.split('\n').findIndex((l) => re.test(l))) + 1;
const report = (found) => found.map(([n, why]) => (n ? `${where(n)}: ${why}` : why)).join('\n');

// ---------- 1. «Автожеребьёвка» — свой календарь, остальные даты — системный ----------
export function autoDrawField(text) {
  const found = [];
  if (!/\bf\.draw_auto_date = ui\.datePick\(/.test(text)) {
    found.push([lineOf(text, /draw_auto_date = /), '«Автожеребьёвка» — не ui.datePick: системный календарь сам выделяет сегодня и подставляет его по «Готово»']);
  }
  for (const k of ['event_date', 'deadline']) {
    if (!new RegExp(`\\b${k}: ui\\.date\\(`).test(text)) found.push([lineOf(text, new RegExp(`\\b${k}:`)), `${k} — не ui.date: эти даты остаются на системном календаре`]);
  }
  if (!/\bdatePick: \(value, opts\) => datePick\(value, opts\)/.test(text)) found.push([lineOf(text, /\bdate: \(value\)/), 'нет ui.datePick в ui']);
  return found;
}

// ---------- 2. Клетки месяца: неделя с понедельника, дни без пропусков ----------
// calendarCells из склейки (с isoDay — она ему нужна); null — нет
export function loadCells(text) {
  const iso = /^ {2}const isoDay = .*$/m.exec(text);
  const fn = fnText(text, 'calendarCells');
  if (!iso || !fn) return null;
  return Function(`${iso[0]}\n${fn.text}\nreturn calendarCells;`)();
}
const pad = (n) => String(n).padStart(2, '0');
// Месяцы, в которых клетки не те: 24 месяца подряд с ноября 2026
export function cellsProblems(calendarCells) {
  const bad = [];
  for (let k = 0; k < 24; k++) {
    const y = 2026 + Math.floor((10 + k) / 12), m = ((10 + k) % 12) + 1;
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const want = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ({ iso: `${y}-${pad(m)}-${pad(i + 1)}`, day: i + 1 }))];
    try { assert.deepEqual(calendarCells(y, m), want); } catch { bad.push(`${y}-${pad(m)}`); }
  }
  return bad;
}

// ---------- 3. «Готово» — только после выбора дня; без даты ничего не выделено ----------
export function doneGated(text) {
  const fn = fnText(text, 'openCalendar');
  if (!fn) return [[1, 'нет function openCalendar(']];
  const found = [];
  const head = fn.start + 1;
  if (!/\blet picked = value;/.test(fn.text)) found.push([head, 'выбранный при открытии день — не дата поля: без даты ничего не должно быть выделено']);
  if (!/\bconst done = ui\.btn\(t\('app\.core\.calendar\.done'\)/.test(fn.text)) found.push([head, 'нет кнопки «Готово»']);
  if (!/\bdone\.disabled = !picked;/.test(fn.text)) found.push([head, '«Готово» не недоступна без выбранного дня (нет done.disabled = !picked)']);
  fn.text.split('\n').forEach((l, i) => {
    if (/\bdone\.disabled = /.test(l) && !/\bdone\.disabled = !picked;/.test(l) && !/\bpicked = c\.iso;\s*done\.disabled = false;/.test(l)) {
      found.push([head + i, '«Готово» становится доступной не при выборе дня']);
    }
  });
  // 028: вторая кнопка — всегда: «Сбросить» при дате, «Закрыть» без неё
  if (!/\bconst reset = ui\.btn\(t\(value \? 'app\.core\.calendar\.reset' : 'app\.core\.calendar\.close'\), 'secondary'/.test(fn.text)) {
    found.push([head, 'вторая кнопка — не всегда: «Сбросить» при дате, «Закрыть» без неё']);
  }
  return found;
}

// ---------- 4. Подсказки без года числом; подсказка названия — следующий год ----------
// 060: подсказка из словаря (placeholder: t('ключ', …)) — год числом ищется в тексте словаря dict
export function literalYears(text, dict = APP_DICT) {
  const found = [];
  text.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/placeholder: (['"`])((?:\\.|(?!\1).)*)\1/g)) {
      if (/\b20\d\d\b/.test(m[2].replace(/\$\{[^}]*\}/g, ''))) found.push([i + 1, `год числом в подсказке: «${m[2]}» — через год она устареет`]);
    }
    for (const m of l.matchAll(/placeholder: t\('([\w.]+)'/g)) {
      const value = dict[m[1]];
      if (typeof value === 'string' && /\b20\d\d\b/.test(value)) found.push([i + 1, `год числом в подсказке ${m[1]}: «${value}» — через год она устареет`]);
    }
  });
  return found;
}
// Подсказка названия нового события, вычисленная из склейки на «телефоне» с годом year: текст — из словаря dict, {year} —
// выражение из склейки; null — не шаблон с годом
export function titleHint(text, year, dict = APP_DICT) {
  const m = /placeholder: t\('(app\.home\.create\.placeholder)', \{ year: ([^}]*) \}\)/.exec(text);
  if (!m || typeof dict[m[1]] !== 'string' || !dict[m[1]].includes('{year}')) return null;
  class PhoneDate extends Date { constructor(...a) { super(...(a.length ? a : [year, 5, 15])); } }
  return dict[m[1]].replace('{year}', Function('Date', `return ${m[2]};`)(PhoneDate));
}

// ---------- 5. Отступ над «Вопрос решён» — как в обычной шторке ----------
export function resolveSpaced(text, css) {
  const lines = text.split('\n');
  // 060: подпись — из словаря (app.sheet.support.resolve — «✅ Вопрос решён»)
  const i = lines.findIndex((l) => l.includes("ui.btn(t('app.sheet.support.resolve')"));
  if (i < 0) return [[1, 'нет кнопки «✅ Вопрос решён»']];
  const found = [];
  if (!lines[i].includes('ds-sheet__action')) found.push([i + 1, '«Вопрос решён» без ds-sheet__action — стоит вплотную к полю ввода']);
  const action = /\.ds-sheet__action\s*\{[^}]*margin-top:\s*([^;}]+)/.exec(css);
  const stack = /\.ds-stack > \* \+ \*\s*\{\s*margin-top:\s*([^;}]+)/.exec(css);
  if (!action) found.push([0, 'components.css: нет .ds-sheet__action с margin-top']);
  else if (!stack || action[1].trim() !== stack[1].trim()) found.push([0, `components.css: отступ .ds-sheet__action (${action[1].trim()}) — не как у ds-stack (${stack && stack[1].trim()})`]);
  return found;
}

// ---------- 6. Шторка календаря одной высоты: сетка всегда на 6 недель (028) ----------
export function sixWeeks(css) {
  const grid = /\.ds-calendar__grid\s*\{([^}]*)\}/.exec(css);
  if (!grid) return [[0, 'components.css: нет .ds-calendar__grid']];
  return /grid-template-rows:\s*auto repeat\(6, var\(--ds-size-control\)\)/.test(grid[1]) ? []
    : [[0, 'components.css: .ds-calendar__grid без grid-template-rows: auto repeat(6, var(--ds-size-control)) — высота шторки зависит от месяца']];
}

// ---------- 7. Драгер и жест Telegram — в ядре шторки (028; у каждой шторки — 033) ----------
// Что у каждой шторки драгер (его ставит только openSheet) — правило дизайн-системы, tests/design-system.test.mjs
export function handleRule(text) {
  const found = [];
  const cal = fnText(text, 'openCalendar');
  const drag = fnText(text, 'sheetHandle');
  const open = fnText(text, 'openSheet');
  const close = fnText(text, 'closeSheet');
  const request = fnText(text, 'requestCloseSheet');
  if (!cal) found.push([1, 'нет function openCalendar(']);
  else if (/sheetHandle|VerticalSwipes/.test(cal.text)) {
    found.push([cal.start + 1, 'календарь ставит драгер или жест Telegram сам — это делает openSheet для каждой шторки']);
  }
  if (!open || !/\bdisableVerticalSwipes\(\)/.test(open.text)) {
    found.push([open ? open.start + 1 : 1, 'openSheet не выключает жест Telegram «свайп вниз» — свайп за полосу свернёт всё приложение']);
  }
  if (!close || !/\benableVerticalSwipes\(\)/.test(close.text)) {
    found.push([close ? close.start + 1 : 1, 'closeSheet не возвращает жест Telegram «свайп вниз»']);
  }
  if (!request || !/\bif \(await mayCloseSheet\(\)\) closeSheet\(\);/.test(request.text)) {
    found.push([request ? request.start + 1 : 1, 'requestCloseSheet — не через mayCloseSheet(): ✕ и драгер спрашивали бы по-разному']);
  }
  if (!drag) found.push([1, 'нет function sheetHandle(']);
  else {
    for (const [re, why] of [[/ds-sheet__handle/, 'полоса ds-sheet__handle'], [/setPointerCapture\(/, 'захват указателя'],
      [/'pointerup'/, 'pointerup'], [/'pointercancel'/, 'pointercancel'],
      [/!\(await mayCloseSheet\(\)\)\) return shift\(0\);/, 'отказ в вопросе перед закрытием возвращает шторку на место (mayCloseSheet → shift(0))'],
      [/if \(sheetEl === own\) closeSheet\(\);/, 'закрывается только своя шторка (sheetEl === own → closeSheet())']]) {
      if (!re.test(drag.text)) found.push([drag.start + 1, `в sheetHandle нет: ${why}`]);
    }
    if (/requestCloseSheet\(\)/.test(drag.text)) found.push([drag.start + 1, 'sheetHandle закрывает через requestCloseSheet() после ухода вниз — вопрос пришёл бы, когда шторки уже не видно']);
  }
  return found;
}

// ---------- тесты ----------
test('1. «Автожеребьёвка» — свой календарь (ui.datePick), «Дата вручения» и «Письмо до» — системный (ui.date)', () => {
  const found = autoDrawField(APP);
  assert.equal(found.length, 0, report(found));
});

test('2. клетки календаря: неделя с понедельника, дни месяца по порядку', () => {
  const cells = loadCells(APP);
  assert.ok(cells, 'в склейке нет const isoDay и function calendarCells(');
  const nov = cells(2026, 11);
  assert.equal(nov.filter((c) => c === null).length, 6, '1 ноября 2026 — воскресенье: 6 пустых клеток');
  assert.equal(nov.filter(Boolean).length, 30);
  assert.deepEqual(cells(2027, 2).slice(0, 1), [{ iso: '2027-02-01', day: 1 }], '1 февраля 2027 — понедельник');
  assert.equal(cells(2027, 2).length, 28);
  assert.deepEqual(cellsProblems(cells), []);
});

test('3. «Готово» недоступна, пока не выбран день; без даты ничего не выделено; вторая кнопка — «Сбросить» или «Закрыть»', () => {
  const found = doneGated(APP);
  assert.equal(found.length, 0, report(found));
});

test('4. подсказки без года числом; подсказка названия — текущий год + 1', () => {
  const found = literalYears(APP);
  assert.equal(found.length, 0, report(found));
  assert.equal(titleHint(APP, 2026), 'Новый год 2027 — семья');
  assert.equal(titleHint(APP, 2027), 'Новый год 2028 — семья');
});

test('5. над «Вопрос решён» — отступ, как между элементами обычной шторки', () => {
  const found = resolveSpaced(APP, CSS);
  assert.equal(found.length, 0, report(found));
});

test('6. шторка календаря одной высоты: сетка на 6 недель', () => {
  const found = sixWeeks(CSS);
  assert.equal(found.length, 0, report(found));
});

test('7. драгер и жест Telegram — в ядре шторки: свайп закрывает, как ✕, отказ — шторка на месте (033)', () => {
  const found = handleRule(APP);
  assert.equal(found.length, 0, report(found));
});

// ---------- от противного ----------
test('от противного 1: «Автожеребьёвка» на системном календаре находится', () => {
  const bad = [
    "    date: (value) => closeOnReset(h('input', { class: 'ds-input', type: 'date', value })),",
    '        event_date: ui.date(val(\'event_date\')),',
    '        deadline: ui.date(val(\'deadline\')),',
    "      if (!s.draw_done) f.draw_auto_date = ui.date(val('draw_auto_date'));",
  ].join('\n');
  const found = autoDrawField(bad);
  assert.ok(found.some(([, why]) => why.includes('«Автожеребьёвка»')), 'поле через ui.date не найдено');
  assert.ok(found.some(([, why]) => why.includes('нет ui.datePick')), 'нет ui.datePick — не найдено');
});

test('от противного 2: неделя с воскресенья и пропуск дня находятся', () => {
  const month = (shift) => (y, m) => {
    const out = Array((new Date(y, m - 1, 1).getDay() + shift) % 7).fill(null);
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) out.push({ iso: `${y}-${pad(m)}-${pad(d)}`, day: d });
    return out;
  };
  assert.deepEqual(cellsProblems(month(6)), [], 'верный месяц с понедельника — без нарушений');
  assert.ok(cellsProblems(month(0)).length > 0, 'неделя с воскресенья не найдена');
  const gap = (y, m) => month(6)(y, m).filter((c) => !c || c.day !== 31);
  assert.ok(cellsProblems(gap).length > 0, 'пропущенный день не найден');
});

test('от противного 3: «Готово» без выбора, выделение сегодня и «Сбросить» всегда находятся', () => {
  const bad = [
    '  function openCalendar(value, onPick, { title, hint } = {}) {',
    '    let picked = value || today;',
    "    const done = ui.btn(t('app.core.calendar.done'), '', 'ds-btn--block');",
    '    done.disabled = false;',
    "    const reset = ui.btn(t('app.core.calendar.reset'), 'secondary', 'ds-btn--block');",
    '  }',
  ].join('\n');
  const found = doneGated(bad).map(([, why]) => why);
  assert.ok(found.some((w) => w.includes('без даты ничего')), 'выделение сегодня не найдено');
  assert.ok(found.some((w) => w.includes('done.disabled = !picked')), '«Готово» без недоступности не найдена');
  assert.ok(found.some((w) => w.includes('не при выборе дня')), 'включение «Готово» вне выбора не найдено');
  assert.ok(found.some((w) => w.includes('«Закрыть»')), 'вторая кнопка без «Закрыть» не найдена');
  const onlyWithDate = "    const reset = value ? ui.btn(t('app.core.calendar.reset'), 'secondary', 'ds-btn--block') : null;";
  assert.ok(doneGated(bad.replace(/^.*const reset.*$/m, onlyWithDate)).some(([, w]) => w.includes('«Закрыть»')), '«Сбросить» только при дате не найден');
  assert.deepEqual(doneGated('  function other() {\n  }').map(([, w]) => w), ['нет function openCalendar(']);
});

test('от противного 4: год числом в подсказке находится, подсказка без года не вычисляется', () => {
  const bad = "        const title = h('input', { class: 'ds-input', type: 'text', maxlength: 80, placeholder: 'Например: Новый год 2026 — семья' });";
  assert.equal(literalYears(bad).length, 1);
  assert.equal(titleHint(bad, 2026), null);
  assert.equal(literalYears('placeholder: `Например: Новый год ${new Date().getFullYear() + 1} — семья`').length, 0);
  // 060: год числом в тексте словаря находится, подсказка словаря без {year} не вычисляется
  const call = "placeholder: t('app.home.create.placeholder', { year: new Date().getFullYear() + 1 })";
  const stale = { 'app.home.create.placeholder': 'Например: Новый год 2026 — семья' };
  assert.equal(literalYears(call).length, 0);
  assert.equal(literalYears(call, stale).length, 1);
  assert.equal(titleHint(call, 2026, stale), null);
});

test('от противного 5: кнопка без отступа и отступ не как у ds-stack находятся', () => {
  const btn = "    const resolve = ui.btn(t('app.sheet.support.resolve'), 'secondary', 'ds-btn--block');";
  assert.ok(resolveSpaced(btn, CSS).some(([, why]) => why.includes('вплотную')));
  const btnOk = "    const resolve = ui.btn(t('app.sheet.support.resolve'), 'secondary', 'ds-btn--block ds-sheet__action');";
  const cssBad = '.ds-stack > * + * { margin-top: var(--ds-space-3); }\n.ds-sheet__action { margin-top: var(--ds-space-1); }';
  assert.ok(resolveSpaced(btnOk, cssBad).some(([, why]) => why.includes('не как у ds-stack')));
  assert.ok(resolveSpaced(btnOk, '.ds-stack > * + * { margin-top: var(--ds-space-3); }').some(([, why]) => why.includes('нет .ds-sheet__action')));
});

test('от противного 6: сетка без строк фиксированной высоты находится', () => {
  assert.equal(sixWeeks('.ds-calendar__grid { display: grid; grid-template-columns: repeat(7, 1fr); }').length, 1);
  assert.equal(sixWeeks('.ds-x {}').length, 1);
});

test('от противного 7: драгер и жест у календаря, жест без возврата, закрытие мимо вопроса находятся', () => {
  // как было в 028: драгер и жест — только в календаре, sheetHandle закрывает через requestCloseSheet() после ухода
  const old = [
    '  function openSheet(title, content) {',
    '  }',
    '  async function requestCloseSheet() {',
    '    if (sheetBeforeClose && !(await sheetBeforeClose())) return;',
    '    closeSheet();',
    '  }',
    '  function closeSheet() {',
    '  }',
    '  function openCalendar(value, onPick) {',
    '    try { if (tg && tg.isVerticalSwipesEnabled) { tg.disableVerticalSwipes(); swipes = true; } } catch (e) {}',
    '    const own = openSheet(title, [], { onClose: () => { try { if (swipes) tg.enableVerticalSwipes(); } catch (e) {} } });',
    '    sheetHandle(own);',
    '  }',
    '  function sheetHandle(own) {',
    "    const handle = h('div', { class: 'ds-sheet__handle', 'aria-hidden': 'true' });",
    '    handle.setPointerCapture(e.pointerId);',
    "    const close = () => { if (!gone) { gone = true; requestCloseSheet(); } };",
    "    handle.addEventListener('pointerup', release);",
    "    handle.addEventListener('pointercancel', release);",
    '  }',
  ].join('\n');
  const found = handleRule(old).map(([, w]) => w);
  assert.ok(found.some((w) => w.includes('календарь ставит')), 'драгер и жест в календаре не найдены');
  assert.ok(found.some((w) => w.includes('openSheet не выключает')), 'невыключенный жест у шторок не найден');
  assert.ok(found.some((w) => w.includes('closeSheet не возвращает')), 'невозвращённый жест не найден');
  assert.ok(found.some((w) => w.includes('не через mayCloseSheet')), 'requestCloseSheet мимо mayCloseSheet не найден');
  assert.ok(found.some((w) => w.includes('отказ в вопросе')), 'закрытие без возврата при отказе не найдено');
  assert.ok(found.some((w) => w.includes('только своя шторка')), 'закрытие чужой шторки не найдено');
  assert.ok(found.some((w) => w.includes('вопрос пришёл бы')), 'requestCloseSheet после ухода не найден');
  assert.ok(handleRule('  function other() {\n  }').some(([, w]) => w.includes('нет function sheetHandle')), 'нет sheetHandle — не найдено');
});

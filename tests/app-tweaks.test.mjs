// 027: мелкие правки мини-приложения — правила по склейке, по образцу app-ui (026). Каждое правило — функция, которая
// находит нарушения ([номер строки склейки или 0 — вне склейки, что не так]); тест — «нарушений нет» и «от противного».
// Контракт — specs/027-ui-tweaks/contracts/app-calendar.md. Поведение в браузере — checkTweaks в tests/screenshots.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP, where } from './support/app-source.mjs';

const CSS = readFileSync(new URL('../design-system/components.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Верхнеуровневая функция name (отступ 2) до её закрывающей строки «  }» → { start (номер строки с 0), text }; null — нет
function fnText(text, name) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => new RegExp(`^  function ${name}\\(`).test(l));
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
  if (!/\bconst done = ui\.btn\('Готово'/.test(fn.text)) found.push([head, 'нет кнопки «Готово»']);
  if (!/\bdone\.disabled = !picked;/.test(fn.text)) found.push([head, '«Готово» не недоступна без выбранного дня (нет done.disabled = !picked)']);
  fn.text.split('\n').forEach((l, i) => {
    if (/\bdone\.disabled = /.test(l) && !/\bdone\.disabled = !picked;/.test(l) && !/\bpicked = c\.iso;\s*done\.disabled = false;/.test(l)) {
      found.push([head + i, '«Готово» становится доступной не при выборе дня']);
    }
  });
  // 028: вторая кнопка — всегда: «Сбросить» при дате, «Закрыть» без неё
  if (!/\bconst reset = ui\.btn\(value \? 'Сбросить' : 'Закрыть', 'secondary'/.test(fn.text)) {
    found.push([head, 'вторая кнопка — не всегда: «Сбросить» при дате, «Закрыть» без неё']);
  }
  return found;
}

// ---------- 4. Подсказки без года числом; подсказка названия — следующий год ----------
export function literalYears(text) {
  const found = [];
  text.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/placeholder: (['"`])((?:\\.|(?!\1).)*)\1/g)) {
      if (/\b20\d\d\b/.test(m[2].replace(/\$\{[^}]*\}/g, ''))) found.push([i + 1, `год числом в подсказке: «${m[2]}» — через год она устареет`]);
    }
  });
  return found;
}
// Подсказка названия нового события, вычисленная из склейки на «телефоне» с годом year; null — не шаблон с годом
export function titleHint(text, year) {
  const m = /placeholder: (`Например: Новый год \$\{[^`]*\} — семья`)/.exec(text);
  if (!m) return null;
  class PhoneDate extends Date { constructor(...a) { super(...(a.length ? a : [year, 5, 15])); } }
  return Function('Date', `return ${m[1]};`)(PhoneDate);
}

// ---------- 5. Отступ над «Вопрос решён» — как в обычной шторке ----------
export function resolveSpaced(text, css) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.includes("ui.btn('✅ Вопрос решён'"));
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

// ---------- 7. Драгер — только у шторки календаря; на время календаря жест Telegram выключен (028) ----------
export function handleRule(text) {
  const found = [];
  const cal = fnText(text, 'openCalendar');
  const drag = fnText(text, 'sheetHandle');
  const open = fnText(text, 'openSheet');
  if (!cal) return [[1, 'нет function openCalendar(']];
  const head = cal.start + 1;
  if (!/\bconst own = openSheet\(/.test(cal.text) || !/\bsheetHandle\(own\);/.test(cal.text)) {
    found.push([head, 'у шторки календаря нет драгера (const own = openSheet(…); sheetHandle(own);)']);
  }
  if (!/\bdisableVerticalSwipes\(\)/.test(cal.text) || !/onClose[\s\S]*enableVerticalSwipes\(\)/.test(cal.text)) {
    found.push([head, 'жест Telegram «свайп вниз» не выключен на время календаря (disableVerticalSwipes, enableVerticalSwipes в onClose)']);
  }
  if (!drag) found.push([1, 'нет function sheetHandle(']);
  else {
    for (const [re, why] of [[/ds-sheet__handle/, 'полоса ds-sheet__handle'], [/setPointerCapture\(/, 'захват указателя'],
      [/'pointerup'/, 'pointerup'], [/'pointercancel'/, 'pointercancel'], [/requestCloseSheet\(\)/, 'закрытие requestCloseSheet()']]) {
      if (!re.test(drag.text)) found.push([drag.start + 1, `в sheetHandle нет: ${why}`]);
    }
  }
  if (open && /ds-sheet__handle|sheetHandle/.test(open.text)) found.push([open.start + 1, 'драгер в openSheet — он появился бы у всех шторок']);
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
  assert.equal(titleHint(APP, 2026), 'Например: Новый год 2027 — семья');
  assert.equal(titleHint(APP, 2027), 'Например: Новый год 2028 — семья');
});

test('5. над «Вопрос решён» — отступ, как между элементами обычной шторки', () => {
  const found = resolveSpaced(APP, CSS);
  assert.equal(found.length, 0, report(found));
});

test('6. шторка календаря одной высоты: сетка на 6 недель', () => {
  const found = sixWeeks(CSS);
  assert.equal(found.length, 0, report(found));
});

test('7. драгер только у шторки календаря, жест Telegram выключен на время календаря', () => {
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
    "    const done = ui.btn('Готово', '', 'ds-btn--block');",
    '    done.disabled = false;',
    "    const reset = ui.btn('Сбросить', 'secondary', 'ds-btn--block');",
    '  }',
  ].join('\n');
  const found = doneGated(bad).map(([, why]) => why);
  assert.ok(found.some((w) => w.includes('без даты ничего')), 'выделение сегодня не найдено');
  assert.ok(found.some((w) => w.includes('done.disabled = !picked')), '«Готово» без недоступности не найдена');
  assert.ok(found.some((w) => w.includes('не при выборе дня')), 'включение «Готово» вне выбора не найдено');
  assert.ok(found.some((w) => w.includes('«Закрыть»')), 'вторая кнопка без «Закрыть» не найдена');
  const onlyWithDate = "    const reset = value ? ui.btn('Сбросить', 'secondary', 'ds-btn--block') : null;";
  assert.ok(doneGated(bad.replace(/^.*const reset.*$/m, onlyWithDate)).some(([, w]) => w.includes('«Закрыть»')), '«Сбросить» только при дате не найден');
  assert.deepEqual(doneGated('  function other() {\n  }').map(([, w]) => w), ['нет function openCalendar(']);
});

test('от противного 4: год числом в подсказке находится, подсказка без года не вычисляется', () => {
  const bad = "        const title = h('input', { class: 'ds-input', type: 'text', maxlength: 80, placeholder: 'Например: Новый год 2026 — семья' });";
  assert.equal(literalYears(bad).length, 1);
  assert.equal(titleHint(bad, 2026), null);
  assert.equal(literalYears('placeholder: `Например: Новый год ${new Date().getFullYear() + 1} — семья`').length, 0);
});

test('от противного 5: кнопка без отступа и отступ не как у ds-stack находятся', () => {
  const btn = "    const resolve = ui.btn('✅ Вопрос решён', 'secondary', 'ds-btn--block');";
  assert.ok(resolveSpaced(btn, CSS).some(([, why]) => why.includes('вплотную')));
  const btnOk = "    const resolve = ui.btn('✅ Вопрос решён', 'secondary', 'ds-btn--block ds-sheet__action');";
  const cssBad = '.ds-stack > * + * { margin-top: var(--ds-space-3); }\n.ds-sheet__action { margin-top: var(--ds-space-1); }';
  assert.ok(resolveSpaced(btnOk, cssBad).some(([, why]) => why.includes('не как у ds-stack')));
  assert.ok(resolveSpaced(btnOk, '.ds-stack > * + * { margin-top: var(--ds-space-3); }').some(([, why]) => why.includes('нет .ds-sheet__action')));
});

test('от противного 6: сетка без строк фиксированной высоты находится', () => {
  assert.equal(sixWeeks('.ds-calendar__grid { display: grid; grid-template-columns: repeat(7, 1fr); }').length, 1);
  assert.equal(sixWeeks('.ds-x {}').length, 1);
});

test('от противного 7: календарь без драгера и драгер во всех шторках находятся', () => {
  const bad = [
    '  function openSheet(title, content) {',
    "    const handle = h('div', { class: 'ds-sheet__handle' });",
    '  }',
    '  function openCalendar(value, onPick) {',
    '    openSheet(title, []);',
    '  }',
  ].join('\n');
  const found = handleRule(bad).map(([, w]) => w);
  assert.ok(found.some((w) => w.includes('нет драгера')), 'календарь без драгера не найден');
  assert.ok(found.some((w) => w.includes('жест Telegram')), 'невыключенный жест Telegram не найден');
  assert.ok(found.some((w) => w.includes('нет function sheetHandle')), 'нет sheetHandle — не найдено');
  assert.ok(found.some((w) => w.includes('у всех шторок')), 'драгер в openSheet не найден');
});

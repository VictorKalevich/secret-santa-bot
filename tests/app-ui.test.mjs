// 026: недочёты интерфейса (docs/todo.md) — правила по склейке мини-приложения, по образцу app-buttons (024).
// Каждое правило — функция, которая находит нарушения в тексте склейки ([номер строки, что не так]); тест —
// «нарушений нет» и «от противного» (пример с нарушениями находится). Контракт — specs/026-ui-fixes/contracts/app-ui.md.
// Поведение, которое видно только в браузере, проверяет checkUiFixes в tests/screenshots.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, where } from './support/app-source.mjs';

// ---------- разбор текста ----------
const indent = (line) => /^ */.exec(line)[0].length;
// Комментарий до конца строки: целая строка «// …» или « // …» после кода (у адресов «://» пробела перед нет)
const code = (line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\s\/\/\s.*$/, ''));

// Блок по отступам (стиль частей): строка start и следующие — до первой строки с тем же отступом, которая начинается
// с } или ) (включительно); если скобки строки start закрылись на ней же — одна строка. → номера строк (с 0)
function blockAt(lines, start) {
  const line = code(lines[start]);
  const open = (line.match(/[({[]/g) || []).length - (line.match(/[)}\]]/g) || []).length;
  if (open <= 0) return [start, start];
  for (let i = start + 1; i < lines.length; i++) {
    if (indent(lines[i]) === indent(lines[start]) && /^\s*[)}]/.test(lines[i])) return [start, i];
  }
  return [start, lines.length - 1];
}
// Объявление верхнего уровня (отступ 2): function name / async function name / const name = / let name =
const TOP = (name) => new RegExp(`^  (?:(?:async )?function ${name}\\b|(?:const|let) ${name} = )`);
function topBlock(lines, name) {
  const i = lines.findIndex((l) => TOP(name).test(l));
  return i < 0 ? null : blockAt(lines, i);
}
// Имя объявления верхнего уровня, в котором стоит строка i (или текст самой строки, если это не объявление)
function ownerOf(lines, i) {
  for (let j = i; j >= 0; j--) {
    const l = lines[j];
    if (indent(l) !== 2 || !l.trim() || /^\s*(\/\/|[)}\]])/.test(l)) continue;
    const m = /^  (?:(?:async )?function (\w+)|(?:const|let) (\w+))/.exec(l);
    return { name: m ? m[1] || m[2] : null, line: j };
  }
  return { name: null, line: 0 };
}

// ---------- 1. «Сохранить» в «Параметрах» перестраивает панель ----------
// Обработчик, в котором уходит admin.game со значениями формы, вызывает refresh() или again()
export function saveRebuilds(text) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((line, i) => {
    if (!line.includes("xapi('admin.game', values())")) return;
    let h = i;
    while (h >= 0 && !(lines[h].includes('addEventListener(') && indent(lines[h]) < indent(line))) h--;
    if (h < 0) return found.push([i + 1, 'сохранение параметров вне обработчика кнопки']);
    const [a, b] = blockAt(lines, h);
    if (!lines.slice(a, b + 1).some((l) => /\b(refresh|again)\(/.test(code(l)))) {
      found.push([h + 1, 'после сохранения параметров панель не перестраивается (нет refresh/again)']);
    }
  });
  return found;
}

// ---------- 2. Панель берёт событие только из своего ответа ----------
const PANEL_FORBIDDEN = [
  [/\bstate\.ev\b/, 'state.ev — прежние данные события; в панели — её ответ (s, done)'],
  [/\bstate\.can\b/, 'state.can — данные экрана события; в панели — её ответ'],
  [/(?<![\w.])finished\(\)/, 'finished() смотрит на state.ev; в панели — done'],
  [/\beapi\(/, 'eapi() берёт state.evId; в панели — xapi (захваченный evId)'],
  [/\bfinishedNotice\(\)/, 'finishedNotice() без события берёт state.ev; в панели — finishedNotice(s)'],
];
export function panelOwnData(text) {
  const lines = text.split('\n');
  const found = [];
  const block = topBlock(lines, 'renderAdmin');
  if (!block) return [[1, 'нет renderAdmin']];
  for (let i = block[0]; i <= block[1]; i++) {
    const l = code(lines[i]);
    for (const [re, why] of PANEL_FORBIDDEN) if (re.test(l)) found.push([i + 1, why]);
    if (/\bstate\.evId\b/.test(l) && !/\bevId = state\.evId\b/.test(l)) {
      found.push([i + 1, 'state.evId — событие экрана; в панели — захваченный evId']);
    }
  }
  return found;
}

// ---------- 3. Заголовок и опрос — только своей шторки ----------
const SHEET_CORE = new Set(['openSheet', 'requestCloseSheet', 'closeSheet', 'poll', 'syncBack', 'sheetEl']);
export function sheetOwners(text) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((raw, i) => {
    const l = code(raw);
    const owner = () => ownerOf(lines, i).name;
    if (/\bsheetEl\b/.test(l) && !l.includes('BackButton.onClick') && !SHEET_CORE.has(owner())) {
      found.push([i + 1, `sheetEl в ${owner() || 'коде верхнего уровня'}: открытую шторку знает только ядро шторки — работай со своей (openSheet() её возвращает)`]);
    }
    if (/\bsetInterval\(/.test(l) && owner() !== 'poll') {
      found.push([i + 1, `setInterval в ${owner() || 'коде верхнего уровня'}: опрос шторки — только poll(own, load)`]);
    }
  });
  return found;
}

// ---------- 4. Без вечного загрузчика ----------
export function screensGuarded(text) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((l, i) => {
    if (/^\s*async function render\w*\s*\(/.test(l)) {
      found.push([i + 1, 'асинхронный экран без screen(): отказ после показа загрузчика оставит его навсегда']);
    }
  });
  const body = (name) => {
    const b = topBlock(lines, name);
    return b ? lines.slice(b[0], b[1] + 1).map(code).join('\n') : null;
  };
  const render = body('render');
  if (render === null) found.push([1, 'нет render()']);
  else if (!/\bcatch\b[\s\S]*\bshowError\(/.test(render)) {
    found.push([topBlock(lines, 'render')[0] + 1, 'render() не показывает ошибку вкладки (нет catch → showError)']);
  }
  const close = body('closeSheet');
  if (close === null) found.push([1, 'нет closeSheet()']);
  else if (!/\.catch\(/.test(close)) {
    found.push([topBlock(lines, 'closeSheet')[0] + 1, 'closeSheet() не перехватывает отказ onClose (нет .catch)']);
  }
  return found;
}

// ---------- 5. Все поля состояния — в начальном состоянии ----------
export function stateDeclared(text) {
  const lines = text.split('\n');
  const decl = topBlock(lines, 'state');
  if (!decl) return [[1, 'нет const state = {…}']];
  const literal = lines.slice(decl[0], decl[1] + 1).map(code).join('\n');
  const keys = new Set([...literal.matchAll(/(\w+)\s*:/g)].map((m) => m[1]));
  const found = [];
  const seen = new Set();
  lines.forEach((l, i) => {
    for (const m of code(l).matchAll(/\bstate\.(\w+)/g)) {
      if (keys.has(m[1]) || seen.has(m[1])) continue;
      seen.add(m[1]);
      found.push([i + 1, `state.${m[1]} нет в начальном состоянии`]);
    }
  });
  return found;
}

// ---------- 6. Тексты подтверждений помещаются в окно ----------
// Наибольшая длина подставляемых значений: имя человека и название семьи — до 40 символов (бот, admin.rename,
// admin.family.save), название события — до 80 (создание и параметры события), числа участников — до трёх цифр
const NAME = 40, FAMILY = 40, TITLE = 80, COUNT = 3;
const LIMITS = { 'u.name': NAME, 't.name': NAME, 'f.name': FAMILY, 's.title': TITLE, 'c.count': COUNT, k: COUNT };

function skipString(s, i) {
  for (const q = s[i++]; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === q) return i;
  }
  return i;
}
function skipTemplate(s, i) {
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '`') return i;
    else if (s[i] === '$' && s[i + 1] === '{') i = closing(s, i + 2);
  }
  return i;
}
// Позиция закрывающей скобки (или первой позиции, где test(i) истинно) на нулевой глубине, вне строк; -1 — нет
function scan(s, i, test = () => false) {
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"') { i = skipString(s, i); continue; }
    if (c === '`') { i = skipTemplate(s, i); continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (depth === 0) return i; depth--; }
    else if (depth === 0 && test(i)) return i;
  }
  return -1;
}
const closing = (s, i) => scan(s, i);
const question = (s) => (i) => s[i] === '?' && s[i + 1] !== '.' && s[i + 1] !== '?' && s[i - 1] !== '?';

// Худший случай длины выражения; ctx.resolve(имя) — определение локального имени (выражение и добавки «+=»)
function worst(expr, ctx) {
  const e = expr.trim();
  const q = scan(e, 0, question(e));
  if (q >= 0) { // a ? b : c — длиннейшая ветвь
    const rest = e.slice(q + 1);
    let nest = 0;
    const colon = scan(rest, 0, (i) => {
      if (question(rest)(i)) nest++;
      else if (rest[i] === ':') { if (!nest) return true; nest--; }
      return false;
    });
    return Math.max(worst(rest.slice(0, colon), ctx), worst(rest.slice(colon + 1), ctx));
  }
  const or = scan(e, 0, (i) => e[i] === '|' && e[i + 1] === '|');
  if (or >= 0) return Math.max(worst(e.slice(0, or), ctx), worst(e.slice(or + 2), ctx));
  if (/^(['"])(?:\\.|(?!\1).)*\1$/.test(e)) return Function(`return ${e}`)().length;
  if (e.startsWith('`') && skipTemplate(e, 0) === e.length - 1) {
    let n = 0, raw = '';
    for (let i = 1; i < e.length - 1; i++) {
      if (e[i] === '\\') { raw += e[i] + e[i + 1]; i++; }
      else if (e[i] === '$' && e[i + 1] === '{') { const end = closing(e, i + 2); n += worst(e.slice(i + 2, end), ctx); i = end; }
      else raw += e[i];
    }
    return n + Function('return `' + raw + '`')().length;
  }
  if (/^plural\(/.test(e)) { // plural(n, одна, несколько, много) — длиннейшая форма
    const args = [];
    const inner = e.slice(7, -1);
    for (let i = 0, at; i <= inner.length; i = at + 1) {
      at = scan(inner, i, (j) => inner[j] === ',');
      if (at < 0) at = inner.length;
      args.push(inner.slice(i, at));
    }
    return Math.max(...args.slice(1).map((a) => worst(a, ctx)));
  }
  if (/^\d+$/.test(e)) return e.length;
  if (e in ctx.limits) return ctx.limits[e];
  const def = /^\w+$/.test(e) && ctx.resolve(e);
  if (def) return def.reduce((n, part) => n + worst(part, ctx), 0);
  throw new Error(`подстановка без известного предела: ${e}`);
}

export function confirmProblems(text) {
  const lines = text.split('\n');
  const lineOf = (pos) => text.slice(0, pos).split('\n').length;
  const found = [];
  const max = Number(/\bconst CONFIRM_MAX = (\d+);/.exec(text)?.[1]);
  if (!max) return [[1, 'нет const CONFIRM_MAX = …; — предел окна подтверждения']];
  const box = topBlock(lines, 'confirmBox');
  if (box) {
    const body = lines.slice(box[0], box[1] + 1).map(code).join('\n');
    if (!body.includes('CONFIRM_MAX') || !body.includes("'…'")) {
      found.push([box[0] + 1, 'confirmBox режет текст молча: длиннее CONFIRM_MAX — с «…» в конце']);
    }
  }
  // Параметр title у typed(): длиннейший из переданных заголовков
  const typedTitles = [...text.matchAll(/\btyped\('([^']*)'/g)].map((m) => m[1].length);
  const limits = { ...LIMITS, ...(typedTitles.length ? { title: Math.max(...typedTitles) } : {}) };
  for (const m of text.matchAll(/\bconfirmBox\(/g)) {
    if (/function\s+$/.test(text.slice(Math.max(0, m.index - 10), m.index))) continue;
    const start = m.index + m[0].length;
    const arg = text.slice(start, closing(text, start));
    const at = lineOf(m.index);
    // Локальное имя: последнее «const|let имя =» выше вызова в том же объявлении верхнего уровня, иначе — верхнего
    // уровня во всей склейке; добавки «имя += …» между определением и вызовом
    const resolve = (name) => {
      const from = ownerOf(lines, at - 1).line;
      const head = lines.slice(0, from).join('\n').length + (from ? 1 : 0);
      const scope = text.slice(head, m.index);
      const re = new RegExp(`\\b(?:const|let) ${name} = `, 'g');
      let found = null;
      for (const d of scope.matchAll(re)) found = head + d.index + d[0].length;
      if (found === null) {
        const top = new RegExp(`^  (?:const|let) ${name} = `, 'm').exec(text);
        if (!top) return null;
        found = top.index + top[0].length;
      }
      const end = scan(text, found, (i) => text[i] === ';');
      const parts = [text.slice(found, end)];
      for (const add of text.slice(end, m.index).matchAll(new RegExp(`\\b${name} \\+= `, 'g'))) {
        const from2 = end + add.index + add[0].length;
        parts.push(text.slice(from2, scan(text, from2, (i) => text[i] === ';')));
      }
      return parts;
    };
    try {
      const n = worst(arg, { limits, resolve });
      if (n > max) found.push([at, `текст подтверждения — до ${n} символов, окно вмещает ${max}`]);
    } catch (e) {
      found.push([at, e.message]);
    }
  }
  return found;
}

// ---------- 7. Без копий: одно поле ответа, один помощник правил пар ----------
const ONCE = [
  ['поле ответа (ds-composer__input) — только composerParts', /ds-composer__input/g],
  ['разбор взаимных пар правил — только rulePairs', /\.giver === \w+\.receiver && \w+\.receiver === \w+\.giver/g],
  ['флажок «и наоборот» — только ruleForm', /'и наоборот \(в обе стороны\)'/g],
  ['проверка «Выбери двух людей» — только ruleForm', /'Выбери двух людей'/g],
  ['проверка «Нужны два разных человека» — только ruleForm', /'Нужны два разных человека'/g],
];
export function copies(text) {
  const lineOf = (pos) => text.slice(0, pos).split('\n').length;
  const found = [];
  for (const [what, re] of ONCE) {
    const hits = [...text.matchAll(re)];
    for (const h of hits.slice(1)) found.push([lineOf(h.index), `вторая копия: ${what}`]);
  }
  return found;
}

// ---------- тесты ----------
const RULES = [
  ['1. «Сохранить» в «Параметрах» перестраивает панель: новое название во всех текстах', saveRebuilds],
  ['2. панель берёт событие только из своего ответа: журнал — её события, «Опасная зона» и плашка — по её статусу', panelOwnData],
  ['3. заголовок и опрос — только своей шторки', sheetOwners],
  ['4. без вечного загрузчика: асинхронные экраны через screen(), render и closeSheet ловят ошибки', screensGuarded],
  ['5. все поля состояния объявлены в начальном состоянии', stateDeclared],
  ['6. тексты подтверждений помещаются в окно при самых длинных данных, длиннее — с «…»', confirmProblems],
  ['7. одно поле ответа и один помощник правил пар', copies],
];
for (const [name, rule] of RULES) {
  test(name, () => {
    assert.deepEqual(rule(APP).map(([n, why]) => `${where(n)}: ${why}`), []);
  });
}

const lines = (...l) => l.join('\n');
const at = (found) => found.map(([n]) => n);

test('от противного 1: сохранение без перестройки находится', () => {
  const bad = lines(
    '  const renderAdmin = screen(async () => {',
    "      saveGame.addEventListener('click', () => busy(saveGame, async () => {",
    "        await xapi('admin.game', values());",
    '        renderHero();',
    '      }));',
    '  });');
  assert.deepEqual(at(saveRebuilds(bad)), [2]);
  assert.deepEqual(saveRebuilds(bad.replace('renderHero();', 'await refresh({ quiet: true });')), []);
});

test('от противного 2: прежние данные события в панели находятся', () => {
  const bad = lines(
    '  const renderAdmin = screen(async () => {',
    '    const nav = state.nav, evId = state.evId;',
    '    const nodes = [finishedNotice()];',
    '    logBtn.onclick = () => openAudit(state.evId);',
    '    if (finished()) x();',
    "    eapi('admin.x');",
    '    const w = state.can.chat_write, t = state.ev.title; // state.ev в комментарии не считается',
    '  });',
    '  function other() { return finished() && state.ev; }');
  assert.deepEqual(at(panelOwnData(bad)), [3, 4, 5, 6, 7, 7]);
  const good = lines(
    '  const renderAdmin = screen(async () => {',
    '    const nav = state.nav, evId = state.evId; // захват: state.evId',
    '    const nodes = [finishedNotice(s)];',
    '    if (done) openAudit(evId);',
    '  });');
  assert.deepEqual(panelOwnData(good), []);
});

test('от противного 3: чужая шторка и опрос вне poll находятся', () => {
  const bad = lines(
    '  let sheetEl = null;',
    '  function openSheet() { sheetEl = h(); return sheetEl; }',
    '  function closeSheet() { if (sheetEl) sheetEl.remove(); }',
    '  function poll(own, load) { const t = setInterval(() => { if (sheetEl !== own) clearInterval(t); }, 6000); }',
    '  try { tg.BackButton.onClick(() => (sheetEl ? requestCloseSheet() : null)); } catch (e) {}',
    '  function openSupportThread() {',
    "    const titleEl = sheetEl && sheetEl.querySelector('.ds-sheet__title');",
    '    timer = setInterval(() => { if (sheetEl) load(); }, 6000);',
    '  }');
  assert.deepEqual(at(sheetOwners(bad)), [7, 8, 8]);
});

test('от противного 4: экран без защиты находится', () => {
  const bad = lines(
    '  function render() {',
    '    renderAdmin();',
    '  }',
    '  async function renderAdmin() {',
    '    showLoader();',
    '  }',
    '  function closeSheet() {',
    '    if (cb) cb();',
    '  }');
  assert.deepEqual(at(screensGuarded(bad)), [4, 1, 7]);
  const good = lines(
    '  function render() {',
    '    try { renderAdmin(); } catch (e) { showError(e); }',
    '  }',
    '  const renderAdmin = screen(async () => {',
    '    showLoader();',
    '  });',
    '  function closeSheet() {',
    '    if (cb) new Promise((done) => done(cb())).catch((e) => toast(e.message));',
    '  }');
  assert.deepEqual(screensGuarded(good), []);
});

test('от противного 5: поле состояния без объявления находится', () => {
  const bad = lines(
    '  const state = {',
    '    me: null, limits: { chars: 4000 }, // state.ghost в комментарии не считается',
    '  };',
    '  state.me = 1; state.announcements = [];',
    '  if (state.announcements.length && state.limits.chars) state.me = 2;');
  assert.deepEqual(stateDeclared(bad), [[4, 'state.announcements нет в начальном состоянии']]);
});

test('от противного 6: длинный текст, подстановка без предела и молчаливая обрезка находятся', () => {
  const box = (cut) => lines(
    '  const CONFIRM_MAX = 250;',
    '  function confirmBox(text) {',
    `    return ${cut};`,
    '  }');
  const ok = box("text.length > CONFIRM_MAX ? text.slice(0, CONFIRM_MAX - 1) + '…' : text");
  const calls = (...c) => lines(ok, '  function f() {', ...c, '  }');
  // 40 + 80 + 130 = 250 — ровно в предел; ещё один символ — нарушение
  const tail = 'я'.repeat(130 - 'Удалить «» из события «»?'.length);
  assert.deepEqual(confirmProblems(calls(`    confirmBox(\`Удалить «\${u.name}» из события «\${s.title}»?${tail}\`);`)), []);
  assert.deepEqual(at(confirmProblems(calls(`    confirmBox(\`Удалить «\${u.name}» из события «\${s.title}»?${tail}я\`);`))), [6]);
  // локальные имена, ветви, plural, «+=», typed(title)
  const many = calls(
    "    const extra = cond ? ' ещё' : '';",
    "    let text = `Провести для ${c.count} ${plural(c.count, 'участника', 'участников', 'участников')}?${extra}`;",
    "    if (k) text += `\\n\\nПисем нет у ${k}.`;",
    '    confirmBox(text);',
    "    confirmBox(`Удалить «${u.name || 'без имени'}»?`);",
    "    typed('Полный сброс'); typed('Отменить жеребьёвку');",
    '    confirmBox(`${title}: точно?`);',
    '    confirmBox(`Секрет: ${u.secret}`);',
    "    confirmBox('x'.repeat(300));");
  assert.deepEqual(confirmProblems(many).map(([n, why]) => [n, why.split(':')[0]]), [
    [13, 'подстановка без известного предела'],
    [14, 'подстановка без известного предела'],
  ]);
  assert.deepEqual(at(confirmProblems(box('text.slice(0, 250)'))), [2]);
  assert.deepEqual(at(confirmProblems('  function confirmBox(text) { return text; }')), [1]);
});

test('от противного 7: вторая копия поля ответа и формы правил находится', () => {
  const bad = lines(
    "  const ta = ui.textarea({ class: 'ds-input ds-composer__input' });",
    "  const tb = ui.textarea({ class: 'ds-input ds-composer__input' });",
    "  const m1 = rows.some((x) => x.giver === e.receiver && x.receiver === e.giver);",
    "  const m2 = rows.some((x) => x.giver === f.receiver && x.receiver === f.giver);",
    "  h('label', {}, box, 'и наоборот (в обе стороны)'); toast('Выбери двух людей'); toast('Нужны два разных человека');",
    "  h('label', {}, box, 'и наоборот (в обе стороны)'); toast('Выбери двух людей'); toast('Нужны два разных человека');");
  assert.deepEqual(at(copies(bad)), [2, 4, 6, 6, 6]);
});

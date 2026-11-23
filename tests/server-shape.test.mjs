// 029: устройство сервера. Параметры события — один список (src/event-params.js): он сверяется со схемой в обе стороны,
// сброс и создание по образцу проверяются по каждой его строке. Статические правила: в боте нет запросов к базе и
// длинных функций, отказ модуля создаётся только помощником no (src/result.js). У каждого правила — «от противного».
// Спецификация — specs/029-server-cleanup/.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { EVENT_PARAMS, EVENT_SERVICE, EVENT_STATE_RESET, eventDefaults } from '../src/event-params.js';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };

// ---------- параметры события ↔ схема ----------

// DEFAULT колонки, как его хранит база: число или строка без кавычек (нет умолчания — undefined)
const schemaDefault = (v) => (v === null ? undefined : /^'.*'$/.test(v) ? v.slice(1, -1) : Number(v));

// columns — строки PRAGMA table_info(events); → список расхождений
function paramProblems(columns, params = EVENT_PARAMS, service = EVENT_SERVICE) {
  const out = [];
  const names = new Set(columns.map((c) => c.name));
  for (const c of columns) {
    const p = params[c.name];
    const s = service.includes(c.name);
    if (!p && !s) out.push(`колонка ${c.name} не описана: ни параметр, ни служебная`);
    if (p && s) out.push(`колонка ${c.name} описана дважды`);
    if (p && schemaDefault(c.dflt_value) !== p.default) out.push(`параметр ${c.name}: умолчание ${JSON.stringify(p.default)}, в схеме ${c.dflt_value}`);
  }
  for (const k of [...Object.keys(params), ...service]) if (!names.has(k)) out.push(`${k} описан, но колонки нет`);
  return out;
}

describe('029: параметры события', () => {
  let w, columns, A;
  // Значение каждого параметра, отличное от умолчания
  const changed = (p) => (p.kind === 'flag' ? !p.default : p.kind === 'date' ? '2099-01-05' : 'не пусто');
  const stored = (p, v) => (p.kind === 'flag' ? (v ? 1 : 0) : v);
  const row = (id) => w.query('SELECT * FROM events WHERE id = ?', id)[0];

  before(async () => {
    w = await startWorld();
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    columns = w.query('PRAGMA table_info(events)');
    A = (await w.api(boss, 'admin.events.create', { title: 'Образец' })).event.id;
    // Каждый параметр — не по умолчанию: общим сохранением, параметры со своим действием — своим
    const body = Object.fromEntries(Object.entries(EVENT_PARAMS).filter(([, p]) => !p.own).map(([k, p]) => [k, changed(p)]));
    await w.api(boss, 'admin.game', { event: A, ...body });
    await w.api(boss, 'admin.ring', { event: A, on: changed(EVENT_PARAMS.ring) });
    await w.api(boss, 'admin.avoid_previous', { event: A, on: changed(EVENT_PARAMS.avoid_previous) });
  });

  it('каждая колонка events — параметр или служебная; умолчания совпадают со схемой', () => {
    assert.deepEqual(paramProblems(columns), []);
    // 050: компания события — служебная (не копируется из образца, сброс её не трогает)
    assert.ok(EVENT_SERVICE.includes('company_id'));
    assert.ok(!('company_id' in EVENT_STATE_RESET));
    assert.deepEqual(paramProblems(columns, EVENT_PARAMS, EVENT_SERVICE.filter((c) => c !== 'company_id')),
      ['колонка company_id не описана: ни параметр, ни служебная']);
  });

  it('от противного: новая колонка, лишняя строка списка и другое умолчание — замечены', () => {
    assert.match(paramProblems([...columns, { name: 'gift_wrap', dflt_value: '0' }]).join('\n'), /gift_wrap не описана/);
    assert.match(paramProblems(columns, { ...EVENT_PARAMS, gift_wrap: { kind: 'flag', default: 0 } }).join('\n'), /gift_wrap описан, но колонки нет/);
    assert.match(paramProblems(columns, { ...EVENT_PARAMS, rejoin: { kind: 'flag', default: 0 } }).join('\n'), /параметр rejoin/);
    assert.match(paramProblems(columns, EVENT_PARAMS, [...EVENT_SERVICE, 'budget']).join('\n'), /budget описана дважды/);
  });

  it('подготовка: у образца каждый параметр отличается от умолчания', () => {
    const a = row(A);
    for (const [k, p] of Object.entries(EVENT_PARAMS)) {
      assert.equal(a[k], stored(p, changed(p)), k);
      assert.notEqual(a[k], p.default, k);
    }
  });

  it('панель организатора отдаёт каждый параметр', async () => {
    const { settings } = await w.api(boss, 'admin.state', { event: A });
    for (const k of Object.keys(EVENT_PARAMS)) assert.ok(k in settings, k);
  });

  it('событие по образцу: копируемые параметры — образца, остальные — по умолчанию', async () => {
    const B = (await w.api(boss, 'admin.events.create', { title: 'По образцу', from: A })).event.id;
    const a = row(A), b = row(B);
    for (const [k, p] of Object.entries(EVENT_PARAMS)) assert.equal(b[k], p.template ? a[k] : p.default, k);
    const C = (await w.api(boss, 'admin.events.create', { title: 'С чистого листа' })).event.id;
    const c = row(C);
    for (const [k, p] of Object.entries(EVENT_PARAMS)) assert.equal(c[k], p.default, k);
  });

  it('полный сброс: все параметры — по умолчанию, состояние — начальное, название прежнее', async () => {
    const was = row(A);
    await w.api(boss, 'admin.reset.full', { event: A, confirm: 'СБРОС' });
    const a = row(A);
    for (const [k, v] of Object.entries(eventDefaults())) assert.equal(a[k], v, k);
    for (const [k, v] of Object.entries(EVENT_STATE_RESET)) assert.equal(a[k], v, k);
    assert.equal(a.title, was.title);
    assert.notEqual(a.invite_code, was.invite_code);
  });
});

// ---------- статические правила ----------

const SRC = new URL('../src/', import.meta.url);
const source = (name) => readFileSync(new URL(name, SRC), 'utf8');
const modules = () => readdirSync(SRC).filter((f) => f.endsWith('.js'));
// Строка без комментария в конце (в строках кода «//» встречается только в адресах — у таких строк комментариев нет)
const code = (line) => (/https?:\/\//.test(line) ? line : line.replace(/\/\/.*$/, ''));

// Запросы к базе в тексте модуля: [строка, текст]
const sqlLines = (text) => text.split('\n').map((l, i) => [i + 1, code(l)]).filter(([, l]) => /\.prepare\(/.test(l));

// Функции верхнего уровня длиннее max строк: [имя, длина]
function longFunctions(text, max) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:export )?(?:async )?function\*? (\w+)/.exec(lines[i]) || /^(?:export )?const (\w+) = (?:async )?\(.*\) => \{$/.exec(lines[i]);
    if (!m) continue;
    let end = i;
    while (end < lines.length && lines[end] !== '}' && lines[end] !== '};') end++;
    if (end - i + 1 > max) out.push([m[1], end - i + 1]);
    i = end;
  }
  return out;
}

// Литералы отказа в тексте модуля: [строка, текст]
const refusalLiterals = (text) => text.split('\n').map((l, i) => [i + 1, code(l)]).filter(([, l]) => /\bok: false, error\b/.test(l));

// HTTP-ответы (а не отказы модулей) и сам помощник
const REFUSAL_EXEMPT = new Set(['result.js', 'index.js', 'api.js']);
const BOT_MAX = 60;

describe('029: бот', () => {
  it('в src/bot.js нет запросов к базе — чтения функциями модулей', () => {
    assert.deepEqual(sqlLines(source('bot.js')), []);
  });

  it(`в src/bot.js нет функций длиннее ${BOT_MAX} строк`, () => {
    assert.deepEqual(longFunctions(source('bot.js'), BOT_MAX), []);
  });

  it('от противного: запрос и длинная функция замечены, комментарий — нет', () => {
    assert.deepEqual(sqlLines("const a = 1;\n  const t = await db.prepare('SELECT 1').first();\n// db.prepare( — в комментарии\n").map(([n]) => n), [2]);
    const long = ['async function big(x) {', ...Array.from({ length: BOT_MAX }, () => '  x++;'), '}', 'function small() {', '}'].join('\n');
    assert.deepEqual(longFunctions(long, BOT_MAX), [['big', BOT_MAX + 2]]);
  });
});

describe('029: отказы модулей', () => {
  it('отказ создаётся помощником no (src/result.js) — литералов в модулях нет', () => {
    const found = modules().filter((f) => !REFUSAL_EXEMPT.has(f))
      .flatMap((f) => refusalLiterals(source(f)).map(([n, l]) => `src/${f}:${n}: ${l.trim()}`));
    assert.deepEqual(found, []);
  });

  it('от противного: литерал замечен, комментарий — нет', () => {
    const text = "  if (!x) return { ok: false, error: 'нет' };\n  // раньше: { ok: false, error }\n  return no('нет');\n";
    assert.deepEqual(refusalLiterals(text).map(([n]) => n), [1]);
  });
});

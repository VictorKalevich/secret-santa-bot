// 058 (specs/058-poll-drafts/, контракт — contracts/app-requests.md): меньше запросов приложения. Опрос шторок — пауза,
// пока приложение не на экране; в открытом боте без нового промежуток растёт и опрос засыпает; обновление после своей
// отправки — now(). Черновик письма — не чаще раза в 5 с, при уходе с экрана и с вкладки — сразу, по одному сохранению.
// По склейке: pollDelay и draftDelay вычисляются, poll исполняется на поддельных таймерах, правила кода — с «от противного».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, where, topBlock, code } from './support/app-source.mjs';

const lines = (...l) => l.join('\n');
const at = (found) => found.map(([n]) => n);
const report = (found) => found.map(([n, why]) => `${where(n)}: ${why}`).join('\n');
// Объявление верхнего уровня: текст и номер первой строки (с 1)
function block(text, name) {
  const all = text.split('\n');
  const r = topBlock(all, name);
  return r ? { text: all.slice(r[0], r[1] + 1).join('\n'), line: r[0] + 1 } : null;
}

// ---------- опрос шторки: poll из склейки на поддельных таймерах ----------

function pollFrom(text) {
  const parts = ['POLL_STEPS', 'POLL_IDLE', 'pollDelay', 'poll'].map((n) => block(text, n));
  if (parts.some((p) => !p)) return null;
  return Function('env', `const { setTimeout, clearTimeout, state, appVisible, onVisibility } = env;
let sheetEl = null;
${parts.map((p) => p.text).join('\n')}
return { poll, pollDelay, sheet: (el) => { sheetEl = el; } };`);
}
const make = pollFrom(APP);

// Мир опроса: часы, таймеры, видимость, шторка; calls — секунды каждого запроса load
function pollWorld({ open = true, factory = make } = {}) {
  let now = 0, seq = 0, visible = true, news = () => false, hold = null;
  const timers = new Map();
  const watchers = new Set();
  const m = factory({
    setTimeout: (fn, ms) => { timers.set(++seq, { at: now + ms, fn }); return seq; },
    clearTimeout: (id) => { timers.delete(id); },
    state: { open },
    appVisible: () => visible,
    onVisibility: (fn) => { watchers.add(fn); return () => watchers.delete(fn); },
  });
  const own = { down: [], addEventListener(type, fn) { if (type === 'pointerdown') this.down.push(fn); } };
  m.sheet(own);
  const calls = [];
  const settle = () => new Promise((r) => setImmediate(r));
  return {
    m, own, calls, timers, watchers,
    load: async () => {
      calls.push(now / 1000);
      const n = calls.length;
      if (hold) await hold;
      return news(n);
    },
    news: (f) => { news = f; },
    hold: (p) => { hold = p; },
    async run(seconds) {
      const end = now + seconds * 1000;
      for (;;) {
        await settle();
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      await settle();
      now = end;
    },
    async show(v) { visible = v; for (const fn of [...watchers]) fn(v); await settle(); },
    async touch() { for (const fn of own.down) fn(); await settle(); },
  };
}
async function started(opts) {
  const w = pollWorld(opts);
  const live = w.m.poll(w.own, w.load);
  await live.now();
  return { w, live };
}

test('pollDelay из склейки: открытый бот — 6, 10, 20, 30, 60… и сон после 5 минут тишины; закрытый — всегда 6', () => {
  assert.ok(make, 'в склейке нет POLL_STEPS, POLL_IDLE, pollDelay или poll');
  const { pollDelay } = make({});
  const seq = [];
  for (let empty = 0, quiet = 0; ; empty++) {
    const s = pollDelay(empty, quiet, true);
    if (s === null) break;
    seq.push(s);
    quiet += s;
  }
  assert.deepEqual(seq, [6, 10, 20, 30, 60, 60, 60, 60]);
  for (const [empty, quiet] of [[0, 0], [5, 120], [100, 3600]]) assert.equal(pollDelay(empty, quiet, false), 6);
});

test('poll, открытый бот: тишина — 9 запросов за 5 минут, потом сон; касание спящей — запрос и расписание с начала', async () => {
  const { w } = await started();
  await w.run(600);
  assert.deepEqual(w.calls, [0, 6, 16, 36, 66, 126, 186, 246, 306], 'за 10 минут — 9 запросов, вторые 5 минут — ни одного');
  assert.equal(w.timers.size, 0, 'спит без таймера');
  await w.touch();
  assert.deepEqual(w.calls.slice(9), [600], 'касание спящей шторки — запрос сразу');
  await w.touch();
  assert.equal(w.calls.length, 10, 'касание неспящей — без запроса');
  await w.run(20);
  assert.deepEqual(w.calls.slice(10), [606, 616], 'расписание с начала');
});

test('poll: новое сбрасывает расписание; now() — запрос сразу и с начала; ответ запроса до now() расписание не трогает', async () => {
  const { w, live } = await started();
  w.news((n) => n === 4); // четвёртый запрос (на 36 с) приносит новое
  await w.run(80);
  assert.deepEqual(w.calls, [0, 6, 16, 36, 42, 52, 72]);
  await w.run(10); // 90 с
  await live.now();
  assert.deepEqual(w.calls.slice(7), [90], 'своя отправка — сразу');
  await w.run(16);
  assert.deepEqual(w.calls.slice(8), [96, 106], 'и расписание с начала');
  // Запрос по таймеру ещё идёт, когда приходит now(): таймер после него — один, по новому расписанию
  let release;
  w.hold(new Promise((r) => { release = r; }));
  await w.run(20); // 126 с: запрос по таймеру висит
  assert.equal(w.calls.at(-1), 126);
  w.hold(null);
  await live.now();
  release();
  await w.run(0);
  assert.equal(w.timers.size, 1, 'один таймер');
  await w.run(6);
  assert.deepEqual(w.calls.slice(-3), [126, 126, 132], 'следующий — через 6 с после now()');
});

test('poll: пока приложение не на экране — ни одного запроса; возвращение — запрос сразу; будит и спящий опрос', async () => {
  for (const open of [true, false]) {
    const { w } = await started({ open });
    await w.run(10);
    const before = w.calls.length;
    await w.show(false);
    assert.equal(w.timers.size, 0, `${open}: таймер снят`);
    await w.run(120);
    assert.equal(w.calls.length, before, `${open}: скрыто — без запросов`);
    await w.show(true);
    assert.deepEqual(w.calls.slice(before), [130], `${open}: возвращение — сразу`);
    await w.run(6);
    assert.equal(w.calls.at(-1), 136, `${open}: дальше — с 6 с`);
  }
  const { w } = await started();
  await w.run(600);
  await w.show(false);
  await w.show(true);
  assert.equal(w.calls.at(-1), 600, 'спящий опрос будит возвращение');
});

test('poll, закрытый бот: раз в 6 с без сна — 10 запросов в минуту, касание лишнего не добавляет', async () => {
  const { w } = await started({ open: false });
  await w.run(60);
  assert.equal(w.calls.length, 11);
  await w.run(3600);
  assert.equal(w.calls.length, 11 + 600, 'час тишины — по-прежнему раз в 6 с');
  await w.touch();
  assert.equal(w.calls.length, 611);
});

test('poll: шторка закрыта или заменена — опрос останавливается и отписывается; stop() — сразу', async () => {
  const { w } = await started();
  await w.run(7);
  w.m.sheet({ other: true });
  await w.run(600);
  assert.deepEqual(w.calls, [0, 6], 'после смены шторки запросов нет');
  assert.equal(w.watchers.size, 0, 'отписан от видимости');
  const s = await started();
  s.live.stop();
  assert.equal(s.w.timers.size, 0);
  assert.equal(s.w.watchers.size, 0);
  await s.w.run(60);
  await s.w.show(false);
  await s.w.show(true);
  assert.equal(s.w.calls.length, 1, 'после stop() — ни таймера, ни возвращения');
});

test('от противного: опрос раз в 6 с без паузы и сна (до 058) в том же мире шлёт запросы и скрытым, и после тишины', async () => {
  const old = lines(
    '  const POLL_STEPS = [6];',
    '  const POLL_IDLE = 300;',
    '  function pollDelay() { return 6; }',
    '  function poll(own, load) {',
    '    let timer = null;',
    '    const tick = () => { if (sheetEl !== own) return; load().catch(() => {}); timer = setTimeout(tick, 6000); };',
    '    timer = setTimeout(tick, 6000);',
    '    return { now: () => load(), stop: () => clearTimeout(timer) };',
    '  }');
  const { w } = await started({ factory: pollFrom(old) });
  await w.run(600);
  assert.equal(w.calls.length, 101, 'десять минут тишины — сто запросов, сна нет');
  await w.show(false);
  await w.run(60);
  assert.equal(w.calls.length, 111, 'скрытое приложение — те же запросы');
});

// ---------- правила кода по склейке ----------

const SHEETS = ['openChat', 'openSupport', 'openSupportThread'];
// 1. Шторки с опросом: load — только через poll (первая загрузка и после отправки — now()), своих таймеров нет
export function sheetLoads(text) {
  const found = [];
  for (const name of SHEETS) {
    const b = block(text, name);
    if (!b) { found.push([1, `нет ${name}`]); continue; }
    const body = b.text.split('\n');
    if (!body.some((l) => /\bpoll\(own, load\)/.test(l))) found.push([b.line, `${name}: опрос не через poll(own, load)`]);
    body.forEach((raw, i) => {
      const l = code(raw);
      if (/\bload\(\)/.test(l)) found.push([b.line + i, `${name}: load() мимо poll — после отправки шторка обновляется через now(), иначе расписание не начнётся заново`]);
      if (/\bset(?:Timeout|Interval)\(/.test(l)) found.push([b.line + i, `${name}: свой таймер — опрос только в poll`]);
    });
  }
  return found;
}

// 2. Видимость: одна подписка ядра на visibilitychange, activated и deactivated; isActive в appVisible
export function visibilitySources(text) {
  const found = [];
  const all = text.split('\n');
  const want = [/addEventListener\('visibilitychange'/, /onEvent\('activated'/, /onEvent\('deactivated'/];
  for (const re of want) {
    const hits = all.map((l, i) => (re.test(code(l)) ? i : -1)).filter((i) => i >= 0);
    if (hits.length !== 1) found.push([hits[0] + 1 || 1, `${re.source}: ${hits.length} раз — подписка одна, в ядре (onVisibility)`]);
  }
  const vis = block(text, 'appVisible');
  if (!vis || !/document\.hidden/.test(vis.text) || !/isActive === false/.test(vis.text)) found.push([vis?.line || 1, 'appVisible — не по document.hidden и tg.isActive']);
  return found;
}

// 3. Черновик: таймер — только по draftDelay, сохранение — только в очереди letterQueue, скрытие и уход — saveLetterNow
export function draftRules(text) {
  const found = [];
  const ed = block(text, 'letterDraftEditor');
  if (!ed) return [[1, 'нет letterDraftEditor']];
  const body = ed.text.split('\n');
  body.forEach((raw, i) => {
    const l = code(raw);
    if (/\bsetTimeout\(/.test(l) && !/draftDelay\(/.test(l)) found.push([ed.line + i, 'таймер сохранения не по draftDelay']);
  });
  const queued = body.findIndex((l) => /letterQueue\.then\(/.test(l));
  const call = body.findIndex((l) => /api\(publishing \? 'wishlist\.publish' : 'wishlist\.draft'/.test(l));
  if (call < 0 || queued < 0 || queued > call || !body.some((l) => /letterQueue = turn/.test(l))) {
    found.push([ed.line + Math.max(0, call), 'сохранение черновика не в очереди letterQueue']);
  }
  if (!body.some((l) => /saveLetterNow = saveNow/.test(l))) found.push([ed.line, 'редактор не отдаёт saveNow в saveLetterNow']);
  const all = text.split('\n');
  const watch = all.findIndex((l) => /^ {2}onVisibility\(/.test(l));
  if (watch < 0 || !/saveLetterNow\(\)/.test(all[watch])) found.push([watch + 1 || 1, 'уход приложения с экрана не сохраняет черновик (onVisibility → saveLetterNow)']);
  return found;
}

// 4. Уход: вопрос о несохранённом (060: текст словаря app.home.unsaved) — только в mayLeave, после saveLetterNow и только
// при state.dirty === true; уходят через mayLeave
const ASK = "confirmBox(t('app.home.unsaved'))";
const ASK_RE = /confirmBox\(t\('app\.home\.unsaved'\)\)/;
export function leaveRules(text) {
  const found = [];
  const all = text.split('\n');
  const may = block(text, 'mayLeave');
  all.forEach((l, i) => {
    if (ASK_RE.test(code(l)) && !(may && i + 1 >= may.line && i + 1 < may.line + may.text.split('\n').length)) {
      found.push([i + 1, 'вопрос о несохранённом мимо mayLeave: черновик письма при уходе сохраняется сам']);
    }
  });
  if (!may) return [...found, [1, 'нет mayLeave']];
  const save = may.text.indexOf('saveLetterNow()'), ask = may.text.indexOf(ASK);
  if (save < 0 || ask < 0 || save > ask) found.push([may.line, 'mayLeave: сначала saveLetterNow(), потом вопрос']);
  if (!new RegExp(String.raw`state\.dirty === true && !\(await ${ASK_RE.source}\)`).test(may.text)) found.push([may.line, "mayLeave: спрашивать только при state.dirty === true ('draft' сохранится сам)"]);
  for (const name of ['leaveEvent', 'renderTabs']) {
    const b = block(text, name);
    if (!b || !/await mayLeave\(\)/.test(b.text)) found.push([b?.line || 1, `${name}: уход не через mayLeave`]);
  }
  return found;
}

test('склейка: шторки обновляются только через poll; видимость — одна подписка ядра', () => {
  assert.deepEqual(sheetLoads(APP), [], report(sheetLoads(APP)));
  assert.deepEqual(visibilitySources(APP), [], report(visibilitySources(APP)));
});

test('склейка: черновик — по draftDelay и в очереди, при скрытии — сразу; уход — через mayLeave', () => {
  assert.deepEqual(draftRules(APP), [], report(draftRules(APP)));
  assert.deepEqual(leaveRules(APP), [], report(leaveRules(APP)));
});

test('draftDelay из склейки: первое после паузы — 450 мс, дальше — не раньше 5 с от начала прошлого', () => {
  const fn = ['DRAFT_PAUSE', 'DRAFT_GAP', 'draftDelay'].map((n) => block(APP, n));
  assert.ok(fn.every(Boolean), 'в склейке нет DRAFT_PAUSE, DRAFT_GAP или draftDelay');
  const draftDelay = Function(`${fn.map((p) => p.text).join('\n')}\nreturn draftDelay;`)();
  const t = 1_800_000_000_000;
  assert.equal(draftDelay(t, 0), 450, 'ещё не сохраняли');
  assert.equal(draftDelay(t, t - 60_000), 450, 'давно сохраняли');
  assert.equal(draftDelay(t, t - 1000), 4000);
  assert.equal(draftDelay(t, t), 5000);
  // Непрерывный набор минуту: правка каждые 200 мс → сохранения не чаще раза в 5 с
  let last = 0, next = null, saves = 0;
  for (let now = t; now < t + 60_000; now += 200) {
    if (next !== null && now >= next) { last = now; saves++; next = null; }
    if (next === null) next = now + draftDelay(now, last);
  }
  assert.ok(saves <= 13, `сохранений за минуту набора: ${saves}`);
});

test('от противного: шторка с load() после отправки, свой таймер, вторая подписка на видимость находятся', () => {
  const bad = lines(
    '  function openChat() {',
    '    const own = openSheet();',
    "    c.send.addEventListener('click', async () => { await load().catch(() => {}); });",
    '    timer = setInterval(load, 6000);',
    '  }',
    '  function openSupport() {',
    '    live = poll(own, load);',
    '  }',
    '  function openSupportThread() {',
    '    live = poll(own, load);',
    '    load().catch((e) => toast(e.message));',
    '  }');
  assert.deepEqual(at(sheetLoads(bad)), [1, 3, 4, 11]);
  const vis = lines(
    '  const appVisible = () => !document.hidden;',
    "  document.addEventListener('visibilitychange', a);",
    "  document.addEventListener('visibilitychange', b);",
    "  tg.onEvent('activated', a);");
  assert.deepEqual(at(visibilitySources(vis)), [2, 1, 1]);
});

test('от противного: черновик по 450 мс мимо очереди и вопрос при уходе с одним черновиком находятся', () => {
  const draft = lines(
    '  function letterDraftEditor(m, markDirty) {',
    '    function edited() { clearTimeout(timer); timer = setTimeout(() => write(false), 450); }',
    '    async function write(publishing) {',
    "      const result = await api(publishing ? 'wishlist.publish' : 'wishlist.draft', {});",
    '    }',
    '  }');
  assert.deepEqual(at(draftRules(draft)), [2, 4, 1, 1]);
  const leave = lines(
    '  async function mayLeave() {',
    "    if (state.dirty && !(await confirmBox(t('app.home.unsaved')))) return false;",
    '    return true;',
    '  }',
    '  async function leaveEvent() {',
    "    if (state.dirty && !(await confirmBox(t('app.home.unsaved')))) return;",
    '  }',
    '  function renderTabs() {',
    '    onclick: async () => { if (!(await mayLeave())) return; }',
    '  }');
  assert.deepEqual(at(leaveRules(leave)), [6, 1, 1, 5]);
});

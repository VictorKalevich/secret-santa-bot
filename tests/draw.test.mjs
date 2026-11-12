// Юнит-тесты жеребьёвки (FR-010, FR-011, FR-013, FR-023, FR-024).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAssignment, planDraw, removeFromAssignment, insertIntoAssignment, diagnose, hasMutual } from '../src/draw.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function banned(list) {
  const set = new Set(list.map(([a, b]) => `${a}:${b}`));
  return (a, b) => !set.has(`${a}:${b}`);
}

function assertValid(ids, pairs, isAllowed) {
  assert.equal(pairs.size, ids.length, 'у каждого ровно один подопечный');
  const wards = new Set(pairs.values());
  assert.equal(wards.size, ids.length, 'каждый ровно один раз подопечный');
  for (const id of ids) {
    assert.ok(pairs.has(id), `${id} — Санта`);
    assert.ok(wards.has(id), `${id} — подопечный`);
  }
  for (const [a, b] of pairs) {
    assert.notEqual(a, b, 'нельзя дарить себе');
    assert.ok(isAllowed(a, b), `исключение ${a}→${b} нарушено`);
  }
}

function isSingleCycle(pairs) {
  const start = pairs.keys().next().value;
  let cur = pairs.get(start);
  let steps = 1;
  while (cur !== start) { cur = pairs.get(cur); steps++; if (steps > pairs.size) return false; }
  return steps === pairs.size;
}

test('без исключений: корректное распределение и единый круг', () => {
  for (let n = 3; n <= 40; n++) {
    const ids = Array.from({ length: n }, (_, i) => i + 1);
    const r = findAssignment(ids, () => true, seeded(n));
    assert.ok(r.ok);
    assertValid(ids, r.pairs, () => true);
    assert.ok(isSingleCycle(r.pairs), `n=${n}: единый круг`);
  }
});

test('взаимные исключения для пар соблюдаются', () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8];
  const rules = banned([[1, 2], [2, 1], [3, 4], [4, 3], [5, 6], [6, 5]]);
  for (let seed = 1; seed <= 200; seed++) {
    const r = findAssignment(ids, rules, seeded(seed));
    assert.ok(r.ok);
    assertValid(ids, r.pairs, rules);
  }
});

test('плотные исключения: единый круг невозможен, но распределение есть', () => {
  // 1,2 могут дарить только друг другу; 3,4 — только друг другу → два цикла
  const ids = [1, 2, 3, 4];
  const rules = banned([[1, 3], [1, 4], [2, 3], [2, 4], [3, 1], [3, 2], [4, 1], [4, 2]]);
  const r = findAssignment(ids, rules, seeded(7), { ring: false });
  assert.ok(r.ok);
  assert.equal(r.singleCycle, false);
  assertValid(ids, r.pairs, rules);
  // с кольцевой это возможно только взаимными парами → понятный отказ
  const rr = findAssignment(ids, rules, seeded(7), { ring: true });
  assert.equal(rr.ok, false);
  assert.ok(rr.problems.some((p) => p.type === 'ring_impossible'));
});

test('невозможная жеребьёвка объясняет причину', () => {
  const ids = [1, 2, 3];
  const rules = banned([[1, 2], [1, 3]]);
  const r = findAssignment(ids, rules, seeded(1));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.type === 'no_receivers' && p.id === 1));
  assert.deepEqual(diagnose([1], () => true)[0], { type: 'too_few' });
});

test('нарушение условия Холла без «пустых» людей → too_strict', () => {
  // 1 и 2 могут дарить только 3 → невозможно, хотя у каждого есть варианты
  const ids = [1, 2, 3, 4];
  const rules = banned([[1, 2], [1, 4], [2, 1], [2, 4]]);
  const r = findAssignment(ids, rules, seeded(3));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.type === 'too_strict'));
});

test('два участника без кольцевой: дарят друг другу', () => {
  const r = findAssignment([10, 20], () => true, seeded(1), { ring: false });
  assert.ok(r.ok);
  assert.equal(r.pairs.get(10), 20);
  assert.equal(r.pairs.get(20), 10);
});

test('удаление после жеребьёвки меняет минимум пар', () => {
  const ids = [1, 2, 3, 4, 5, 6];
  for (let seed = 1; seed <= 50; seed++) {
    const r = findAssignment(ids, () => true, seeded(seed));
    const x = ids[seed % ids.length];
    const res = removeFromAssignment(r.pairs, x, () => true, seeded(seed + 1));
    assert.ok(res);
    const rest = ids.filter((i) => i !== x);
    assertValid(rest, res.pairs, () => true);
    let changed = 0;
    for (const [a, b] of res.pairs) if (r.pairs.get(a) !== b) changed++;
    assert.ok(changed <= 2, `изменилось ${changed} пар`);
    assert.equal(changed, res.changed.length);
  }
});

test('удаление из взаимной пары встраивает оставшегося в чужую связку', () => {
  const pairs = new Map([[1, 2], [2, 1], [3, 4], [4, 5], [5, 3]]);
  const res = removeFromAssignment(pairs, 2, () => true, seeded(2), { ring: false });
  assert.ok(res);
  assertValid([1, 3, 4, 5], res.pairs, () => true);
  assert.ok(res.changed.includes(1));
});

test('удаление с исключением: обмен подопечными', () => {
  // 1→2→3→4→1; удаляем 2; 1 не может дарить 3 → обмен с другой парой
  const pairs = new Map([[1, 2], [2, 3], [3, 4], [4, 5], [5, 1]]);
  const rules = banned([[1, 3]]);
  const res = removeFromAssignment(pairs, 2, rules, seeded(5), { ring: false });
  assert.ok(res);
  assertValid([1, 3, 4, 5], res.pairs, rules);
  // с кольцевой обмена двух пар не хватает — срабатывает тройная перестановка без взаимных пар
  const rr = removeFromAssignment(pairs, 2, rules, seeded(5), { ring: true });
  assert.ok(rr);
  assertValid([1, 3, 4, 5], rr.pairs, rules);
  assert.equal(hasMutual(rr.pairs), false);
  assert.ok(rr.changed.length <= 3);
});

test('удаление невозможно без нарушения → null', () => {
  const pairs = new Map([[1, 2], [2, 3], [3, 1]]);
  const rules = banned([[1, 3]]);
  assert.equal(removeFromAssignment(pairs, 2, rules, seeded(1)), null);
});

test('вписывание нового участника: меняется подопечный у одного', () => {
  const ids = [1, 2, 3, 4, 5];
  const r = findAssignment(ids, () => true, seeded(9));
  const res = insertIntoAssignment(r.pairs, 99, () => true, seeded(10));
  assert.ok(res);
  assertValid([...ids, 99], res.pairs, () => true);
  let changed = 0;
  for (const [a, b] of r.pairs) if (res.pairs.get(a) !== b) changed++;
  assert.equal(changed, 1);
});

test('вписывание с исключениями учитывает правила', () => {
  const pairs = new Map([[1, 2], [2, 3], [3, 1]]);
  const rules = banned([[1, 9], [2, 9], [9, 2]]);
  const res = insertIntoAssignment(pairs, 9, rules, seeded(1));
  assert.ok(res);
  assertValid([1, 2, 3, 9], res.pairs, rules);
  assert.equal(res.pairs.get(3), 9);
});

test('производительность: 40 человек с исключениями — быстро', () => {
  const ids = Array.from({ length: 40 }, (_, i) => i + 1);
  const list = [];
  for (let i = 1; i < 40; i += 2) list.push([i, i + 1], [i + 1, i]);
  const rules = banned(list);
  const t0 = performance.now();
  const r = findAssignment(ids, rules, seeded(42));
  const ms = performance.now() - t0;
  assert.ok(r.ok);
  assertValid(ids, r.pairs, rules);
  assert.ok(ms < 50, `заняло ${ms.toFixed(1)} мс`);
});

// ---------- кольцевая жеребьёвка (005) ----------

test('кольцевая: ни одной взаимной пары в 500 жеребьёвках', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const n = 4 + (seed % 10);
    const ids = Array.from({ length: n }, (_, i) => i + 1);
    const rules = banned([[1, 2], [2, 1]]);
    const r = findAssignment(ids, rules, seeded(seed), { ring: true });
    assert.ok(r.ok, `n=${n}`);
    assertValid(ids, r.pairs, rules);
    assert.equal(hasMutual(r.pairs), false);
  }
});

test('кольцевая: два участника — понятный отказ', () => {
  const r = findAssignment([1, 2], () => true, seeded(1), { ring: true });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.type === 'ring_too_few'));
});

test('без кольцевой взаимные пары встречаются', () => {
  let mutual = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = findAssignment([1, 2, 3, 4], () => true, seeded(seed), { ring: false });
    assert.ok(r.ok);
    if (hasMutual(r.pairs)) mutual++;
  }
  assert.ok(mutual > 0, 'при выключенной кольцевой взаимные пары возможны');
});

test('кольцевая: удаление не создаёт взаимную пару', () => {
  // 1→2→3→1 и удаляем 3: 2→1 при 1→2 — взаимная; нужно отказать (других связок нет)
  assert.equal(removeFromAssignment(new Map([[1, 2], [2, 3], [3, 1]]), 3, () => true, seeded(1), { ring: true }), null);
  // без кольцевой — можно
  const r = removeFromAssignment(new Map([[1, 2], [2, 3], [3, 1]]), 3, () => true, seeded(1), { ring: false });
  assert.ok(r);
  for (let seed = 1; seed <= 100; seed++) {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    const a = findAssignment(ids, () => true, seeded(seed), { ring: true });
    const res = removeFromAssignment(a.pairs, ids[seed % 7], () => true, seeded(seed + 7), { ring: true });
    if (res) assert.equal(hasMutual(res.pairs), false);
  }
});

test('кольцевая: вписывание не создаёт взаимную пару', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const ids = [1, 2, 3, 4, 5];
    const a = findAssignment(ids, () => true, seeded(seed), { ring: true });
    const res = insertIntoAssignment(a.pairs, 99, () => true, seeded(seed + 3), { ring: true });
    assert.ok(res);
    assert.equal(hasMutual(res.pairs), false);
  }
});

// ---------- бюджет вычислений (006): лимит CPU бесплатного тарифа ----------

// Худший из нескольких запусков: замер CPU на один вызов findAssignment
function worstMs(ids, rules, opts, runs = 10) {
  let worst = 0;
  let last;
  for (let k = 0; k < runs; k++) {
    const t0 = performance.now();
    last = findAssignment(ids, rules, seeded(100 + k), opts);
    worst = Math.max(worst, performance.now() - t0);
  }
  return { worst, last };
}

const people = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('бюджет: 50 человек, только взаимные пары возможны (кольцевая) — быстрый понятный отказ', () => {
  const ids = people(50);
  const rules = (a, b) => ((a - 1) ^ 1) === b - 1; // каждый может дарить только «соседу по паре»
  const { worst, last } = worstMs(ids, rules, { ring: true });
  assert.equal(last.ok, false);
  assert.ok(last.problems.some((p) => p.type === 'search_exhausted' || p.type === 'ring_impossible'));
  assert.ok(worst < 10, `заняло ${worst.toFixed(1)} мс`);
});

test('бюджет: 50 человек, нарушение условия Холла — too_strict за миллисекунды', () => {
  const ids = people(50);
  const rules = (a) => a > 3 || false; // первые трое не могут дарить никому... кроме ограниченного набора ниже
  const hall = (a, b) => (a <= 3 ? b === 4 || b === 5 : rules(a, b));
  for (const ring of [true, false]) {
    const { worst, last } = worstMs(ids, hall, { ring });
    assert.equal(last.ok, false);
    assert.ok(last.problems.some((p) => p.type === 'too_strict'));
    assert.ok(worst < 10, `заняло ${worst.toFixed(1)} мс`);
  }
});

test('бюджет: 50 человек, «тройки» — единый круг невозможен, но кольцевое распределение находится', () => {
  const ids = people(48);
  const rules = (a, b) => Math.floor((a - 1) / 3) === Math.floor((b - 1) / 3);
  const { worst, last } = worstMs(ids, rules, { ring: true });
  assert.ok(last.ok);
  assertValid(ids, last.pairs, rules);
  assert.equal(hasMutual(last.pairs), false);
  assert.ok(worst < 10, `заняло ${worst.toFixed(1)} мс`);
});

test('бюджет: 50 человек, супруги + пары прошлого года — 100 кольцевых жеребьёвок успешны', () => {
  const ids = people(50);
  const list = [];
  for (let i = 1; i < 50; i += 2) list.push([i, i + 1], [i + 1, i]);
  for (let i = 1; i <= 50; i++) list.push([i, (i % 50) + 1]); // «прошлый год» — круг 1→2→…→50→1
  const rules = banned(list);
  let worst = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const t0 = performance.now();
    const r = findAssignment(ids, rules, seeded(seed), { ring: true });
    worst = Math.max(worst, performance.now() - t0);
    assert.ok(r.ok, 'seed ' + seed);
    assertValid(ids, r.pairs, rules);
    assert.equal(hasMutual(r.pairs), false);
  }
  assert.ok(worst < 10, `заняло ${worst.toFixed(1)} мс`);
});

test('бюджет: 50 человек без ограничений — 100 из 100 жеребьёвок успешны', () => {
  const ids = people(50);
  for (let seed = 1; seed <= 100; seed++) {
    for (const ring of [true, false]) {
      const r = findAssignment(ids, () => true, seeded(seed), { ring });
      assert.ok(r.ok);
      assertValid(ids, r.pairs, () => true);
    }
  }
});

test('бюджет: маленький бюджет даёт search_exhausted, а не зависание', () => {
  const ids = people(30);
  const rules = (a, b) => ((a - 1) ^ 1) === b - 1;
  const r = findAssignment(ids, rules, seeded(1), { ring: true, budget: 100 });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.type === 'search_exhausted'));
});

// ---------- 009: все попытки одной жеребьёвки делят один бюджет (planDraw) ----------

test('planDraw: 50 человек, кольцевая невозможна — все три попытки (история, без истории, семьи) вместе < 10 мс', () => {
  const ids = people(50);
  const own = [];
  for (const a of ids) for (const b of ids) if (a !== b && ((a - 1) ^ 1) !== b - 1) own.push({ giver: a, receiver: b });
  const families = [];
  for (let i = 1; i < 50; i += 4) families.push({ giver: i, receiver: i + 2 }, { giver: i + 2, receiver: i });
  const history = ids.map((a) => ({ giver: a, receiver: (a % 50) + 1 }));
  let worst = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const t0 = performance.now();
    const r = planDraw(ids, { own, families, history }, seeded(seed), { ring: true });
    worst = Math.max(worst, performance.now() - t0);
    assert.equal(r.ok, false);
    assert.equal(r.familiesBlock, false, 'мешают не семьи');
    assert.ok(r.problems.some((p) => p.type === 'ring_impossible' || p.type === 'search_exhausted'));
  }
  assert.ok(worst < 10, `заняло ${worst.toFixed(1)} мс`);
});

test('planDraw: 50 человек, супруги + прошлый год — находит, историю и семьи соблюдает, < 10 мс', () => {
  const ids = people(50);
  const families = [];
  for (let i = 1; i < 50; i += 2) families.push({ giver: i, receiver: i + 1 }, { giver: i + 1, receiver: i });
  const history = ids.map((a) => ({ giver: a, receiver: (a % 50) + 1 }));
  const rules = banned([...families, ...history].map((e) => [e.giver, e.receiver]));
  let worst = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const t0 = performance.now();
    const r = planDraw(ids, { families, history }, seeded(seed), { ring: true });
    worst = Math.max(worst, performance.now() - t0);
    assert.ok(r.ok, 'seed ' + seed);
    assertValid(ids, r.pairs, rules);
    assert.equal(hasMutual(r.pairs), false);
  }
  assert.ok(worst < 10, `заняло ${worst.toFixed(1)} мс`);
});

test('planDraw: если с историей нельзя — распределение без неё', () => {
  // 1 не дарит 3: остаётся единственный круг 1→2→3→1, и он же был в прошлый раз
  const r = planDraw([1, 2, 3], {
    own: [{ giver: 1, receiver: 3 }],
    history: [{ giver: 1, receiver: 2 }, { giver: 2, receiver: 3 }, { giver: 3, receiver: 1 }],
  }, seeded(7), { ring: true });
  assert.ok(r.ok);
  assert.deepEqual([...r.pairs].sort(), [[1, 2], [2, 3], [3, 1]]);
});

test('planDraw: мешают именно семьи — familiesBlock', () => {
  // трое, кольцевая: 1 и 2 — семья; без семьи круг есть, с семьёй — нет
  const families = [{ giver: 1, receiver: 2 }, { giver: 2, receiver: 1 }];
  const r = planDraw([1, 2, 3], { families }, seeded(3), { ring: true });
  assert.equal(r.ok, false);
  assert.equal(r.familiesBlock, true);
});

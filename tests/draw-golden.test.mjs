// Эталон жеребьёвки (016, FR-1611): при том же зерне planDraw, findAssignment, removeFromAssignment и
// insertIntoAssignment дают ровно те же результаты, что при создании эталона. Автоматическая проверка требования
// «порядок вызовов rng не меняется» для любой правки src/draw.js. Эталон не пересоздаётся
// (tests/fixtures/make-draw-golden.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as draw from '../src/draw.js';
import { drawCases, runCase } from './support/draw-cases.mjs';

const golden = JSON.parse(readFileSync(new URL('./fixtures/draw-golden.json', import.meta.url), 'utf8'));

test('эталон жеребьёвки: результаты при том же зерне совпадают побайтно', () => {
  assert.equal(golden.cases.length, golden.count);
  const cases = drawCases(golden.count);
  const diff = [];
  for (const [i, c] of cases.entries()) {
    const got = runCase(draw, c);
    const want = JSON.stringify(golden.cases[i]);
    if (got !== want) diff.push(`случай ${c.seed} (${c.ids.length} человек):\n  эталон: ${want.slice(0, 300)}\n  сейчас: ${got.slice(0, 300)}`);
  }
  assert.equal(diff.length, 0, `расхождений: ${diff.length}\n${diff.slice(0, 3).join('\n')}`);
});

test('эталон жеребьёвки: проверка не пустая — есть удачные и невозможные жеребьёвки, замены и отказы', () => {
  const plans = golden.cases.map((c) => c.plan);
  assert.ok(plans.filter((p) => p.ok).length > 100, 'удачных жеребьёвок');
  assert.ok(plans.filter((p) => !p.ok).length > 20, 'невозможных жеребьёвок');
  assert.ok(golden.cases.filter((c) => c.remove).length > 50, 'удалений после жеребьёвки');
  assert.ok(golden.cases.filter((c) => c.insertRanked).length > 50, 'вписываний с рангом');
  assert.ok(golden.cases.some((c) => c.plan.ok && c.plan.pairs.length > 40), 'большие группы');
  assert.ok(golden.cases.every((c) => c.findFnSame === true), 'правила pairRules и функция-обёртка — один результат');
});

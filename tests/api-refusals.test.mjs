// Эталон отказов API (019, FR-1910, SC-1902): коды и тексты ответов без прав, на несуществующем событии, без события и
// на завершённом событии — те же, что до перехода на таблицу действий. Эталон — tests/fixtures/api-refusals.json
// (снят tests/fixtures/make-api-refusals.mjs на прежнем коде, не пересоздаётся).
// Намеренные изменения эталона — только точечно, по решениям владельца, со списком:
//   025 (specs/025-behavior-fixes/research.md, R5): служебный просмотр владельцу без слова ОТКРЫТЬ — 6 ответов
//   (owner, finished-owner, finished-old-owner × vault.person, vault.pairs) → 400 «Для служебного просмотра введи слово
//   ОТКРЫТЬ.»; admin.request.decide без approve на завершённых событиях — 4 ответа (finished-owner, finished-admin,
//   finished-old-owner, finished-old-admin) → 400 «Заявка не найдена.» (отклонение разрешено); новые случаи extra
//   vault.pairs-word, vault.person-word-wrong, vault.pairs-word-admin, request.decide-approve-finished.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runRefusals } from './support/refusals-scenario.mjs';
import { restoreFetch } from './support/world.mjs';
import { ACTIONS } from '../src/api.js';

after(restoreFetch);

const golden = JSON.parse(readFileSync(new URL('./fixtures/api-refusals.json', import.meta.url), 'utf8'));

test('отказы API: каждый код и текст — как в эталоне', async () => {
  const now = await runRefusals();
  assert.deepEqual(now.actions, golden.actions);
  assert.deepEqual(Object.keys(ACTIONS), golden.actions, 'таблица действий — те же 59 действий в прежнем порядке');
  const diff = [];
  for (const key of new Set([...Object.keys(golden.cases), ...Object.keys(now.cases)])) {
    const a = JSON.stringify(golden.cases[key]);
    const b = JSON.stringify(now.cases[key]);
    if (a !== b) diff.push(`${key}: было ${a}, стало ${b}`);
  }
  assert.deepEqual(diff, []);
});

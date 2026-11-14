// Эталон отказов API (019, FR-1910, SC-1902): коды и тексты ответов без прав, на несуществующем событии, без события и
// на завершённом событии — те же, что до перехода на таблицу действий. Эталон — tests/fixtures/api-refusals.json
// (снят tests/fixtures/make-api-refusals.mjs на прежнем коде, не пересоздаётся).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runRefusals } from './support/refusals-scenario.mjs';
import { restoreFetch } from './support/world.mjs';

after(restoreFetch);

const golden = JSON.parse(readFileSync(new URL('./fixtures/api-refusals.json', import.meta.url), 'utf8'));

test('отказы API: каждый код и текст — как в эталоне', async () => {
  const now = await runRefusals();
  assert.deepEqual(now.actions, golden.actions);
  const diff = [];
  for (const key of new Set([...Object.keys(golden.cases), ...Object.keys(now.cases)])) {
    const a = JSON.stringify(golden.cases[key]);
    const b = JSON.stringify(now.cases[key]);
    if (a !== b) diff.push(`${key}: было ${a}, стало ${b}`);
  }
  assert.deepEqual(diff, []);
});

// Снять эталон отказов API (019, FR-1910): `node tests/fixtures/make-api-refusals.mjs`.
// Снимается один раз, на коде до перехода на таблицу действий; после — не пересоздаётся (иначе тест сравнивал бы
// новый код сам с собой). Список действий сверяется с прежним способом — регуляркой по `case` в src/api.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { runRefusals, ACTION_LIST } from '../support/refusals-scenario.mjs';
import { restoreFetch } from '../support/world.mjs';

const source = readFileSync(new URL('../../src/api.js', import.meta.url), 'utf8');
const fromCases = [...new Set([...source.matchAll(/case '(admin\.[a-z._]+)'/g)].map((m) => m[1]))];
const admins = ACTION_LIST.filter((a) => a.startsWith('admin.'));
if (JSON.stringify(fromCases) !== JSON.stringify(admins)) {
  throw new Error('список действий сценария не совпадает с case в src/api.js:\n' + fromCases.join(', '));
}

const out = await runRefusals();
restoreFetch();
const file = new URL('./api-refusals.json', import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`эталон: ${Object.keys(out.cases).length} ответов, ${out.actions.length} действий → tests/fixtures/api-refusals.json`);

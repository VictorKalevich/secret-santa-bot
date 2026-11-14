// Создаёт эталон жеребьёвки tests/fixtures/draw-golden.json от текущего src/draw.js (016, FR-1611).
// Запуск из корня проекта: node tests/fixtures/make-draw-golden.mjs
//
// ВНИМАНИЕ: эталон создан в шаге 1 плана рефакторинга (016) и НЕ пересоздаётся:
// он и есть проверка «при том же зерне жеребьёвка даёт те же пары». Падает tests/draw-golden.test.mjs — значит,
// поменялся порядок вызовов rng или результат; это изменение поведения, а не повод обновить эталон.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as draw from '../../src/draw.js';
import { drawCases, runCase } from '../support/draw-cases.mjs';

const COUNT = 400;
const cases = drawCases(COUNT).map((c) => runCase(draw, c));
const note = 'Эталон жеребьёвки (016): результаты src/draw.js для drawCases(400) из tests/support/draw-cases.mjs. '
  + 'Не пересоздавать в шагах плана рефакторинга — см. tests/fixtures/make-draw-golden.mjs.';
// По строке на случай: расхождение видно в git diff
const text = '{\n  "note": ' + JSON.stringify(note) + ',\n  "count": ' + COUNT + ',\n  "cases": [\n'
  + cases.map((c) => '    ' + c).join(',\n') + '\n  ]\n}\n';
const out = fileURLToPath(new URL('./draw-golden.json', import.meta.url));
writeFileSync(out, text);
console.log(`записано ${COUNT} случаев, ${(text.length / 1024).toFixed(0)} КБ: ${out}`);

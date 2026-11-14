// Замер жеребьёвки «до и после» (016; в npm test не входит). Запуск из корня проекта:
//   npm run bench:draw                         — текущий src/draw.js
//   npm run bench:draw -- <путь к draw.js>     — другой вариант файла
// «Холодный» — первый вызов в свежем процессе (так чаще всего и бывает в Worker), «прогретый» — после 60 вызовов.
// Базовые числа — docs/refactoring/baseline.md, раздел 2. Сравнивай медианы на той же машине и в том же режиме
// питания (ноутбук от батареи даёт числа в 1,5–2 раза хуже); запускай дважды и бери диапазон.
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { scenario, seeded } from './draw-scenario.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const drawPath = path.resolve(process.argv[2] || path.join(here, '../../src/draw.js'));
const { planDraw } = await import(pathToFileURL(drawPath).href);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const fmt = (x) => x.toFixed(2).padStart(6);

console.log('файл:', drawPath);
console.log('человек | холодный, мс: медиана / худший из 25 | прогретый, мс: медиана / p95 / худший из 400 | успех');
for (const n of [50, 100, 150, 200]) {
  const cold = [];
  let okCold = 0;
  for (let k = 0; k < 25; k++) {
    const out = JSON.parse(execFileSync(process.execPath, [path.join(here, 'bench-draw-cold.mjs'), drawPath, String(n), String(k + 1)], { encoding: 'utf8' }));
    cold.push(out.ms);
    okCold += out.ok ? 1 : 0;
  }
  cold.sort((a, b) => a - b);
  const { ids, families, history } = scenario(n);
  for (let k = 0; k < 60; k++) planDraw(ids, { families, history }, seeded(5000 + k), { ring: true });
  const warm = [];
  let ok = 0;
  for (let k = 0; k < 400; k++) {
    const rng = seeded(k + 1);
    const t0 = performance.now();
    const r = planDraw(ids, { families, history }, rng, { ring: true });
    warm.push(performance.now() - t0);
    ok += r.ok ? 1 : 0;
  }
  warm.sort((a, b) => a - b);
  console.log(`${String(n).padStart(7)} | ${fmt(q(cold, 0.5))} / ${fmt(cold.at(-1))}                       | ${fmt(q(warm, 0.5))} / ${fmt(q(warm, 0.95))} / ${fmt(warm.at(-1))}                      | ${okCold}/25, ${ok}/400`);
}

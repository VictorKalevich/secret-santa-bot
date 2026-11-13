// Один «холодный» вызов planDraw в свежем процессе (вызывается из bench-draw.mjs):
//   node bench-draw-cold.mjs <путь к draw.js> <n> <зерно>
import { pathToFileURL } from 'node:url';
import { scenario, seeded } from './draw-scenario.mjs';

const [, , drawPath, nArg, seedArg] = process.argv;
const { planDraw } = await import(pathToFileURL(drawPath).href);
const { ids, families, history } = scenario(Number(nArg));
const rng = seeded(Number(seedArg));
const t0 = performance.now();
const r = planDraw(ids, { families, history }, rng, { ring: true });
console.log(JSON.stringify({ ms: performance.now() - t0, ok: r.ok }));

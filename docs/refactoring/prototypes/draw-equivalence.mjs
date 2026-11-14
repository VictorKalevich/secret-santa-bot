// Сверка двух вариантов draw.js: при одном зерне результат обязан совпасть побайтно (пары, признаки, причины отказа).
// Запуск из корня проекта (исходный файл берётся из git, чтобы сравнивать с состоянием до правки):
//   git show main:src/draw.js > "$TEMP/draw-old.mjs"
//   node docs/refactoring/prototypes/draw-equivalence.mjs "$TEMP/draw-old.mjs" src/draw.js
// 6000 случайных случаев: размеры 2–60, исключения разной плотности, семьи, история, закреплённые пары (в том числе
// с людьми не из списка), кольцевая и обычная, малый бюджет поиска; плюс удаление и вписывание после жеребьёвки.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { seeded } from '../../../tests/support/draw-cases.mjs';

const [, , oldPath, newPath] = process.argv;
if (!oldPath || !newPath) {
  console.error('нужны два пути: <исходный draw.js> <новый draw.js>');
  process.exit(2);
}
const load = (p) => import(pathToFileURL(path.resolve(p)).href);
const base = await load(oldPath);
const next = await load(newPath);
const show = (r) => JSON.stringify({ ok: r.ok, single: r.singleCycle, fam: r.familiesBlock, problems: r.problems, pairs: r.pairs ? [...r.pairs] : null });

let bad = 0;
const stats = { ok: 0, fail: 0 };
const mismatch = (what, seed) => {
  if (bad++ < 5) console.error(`расхождение: ${what}, случай ${seed}`);
};
for (let seed = 1; seed <= 6000; seed++) {
  const g = seeded(seed * 7919);
  const pick = (k) => Math.floor(g() * k);
  const n = 2 + pick(seed % 5 === 0 ? 60 : 14);
  const ids = Array.from({ length: n }, (_, i) => 500 + i * 3);
  const rnd = () => ids[pick(n)];
  const list = (count, extra = 0) => Array.from({ length: count }, () => ({ giver: g() < extra ? 9999 : rnd(), receiver: g() < extra ? 8888 : rnd() }));
  const dens = [0, 0.3, 1, 2.5, 6][pick(5)];
  const own = list(Math.floor(n * dens * g()), 0.05);
  const families = g() < 0.5 ? list(Math.floor(n * g()), 0) : [];
  const history = g() < 0.5 ? ids.map((a, i) => ({ giver: a, receiver: ids[(i + 1 + pick(2)) % n] })) : [];
  // Закреплённые пары — как в базе: у дарителя одна, у получателя одна; иногда с человеком не из списка
  const fixed = [];
  if (g() < 0.5) {
    const gs = new Set();
    const rs = new Set();
    for (let k = pick(5); k > 0; k--) {
      const a = g() < 0.1 ? 7777 : rnd();
      const b = g() < 0.1 ? 6666 : rnd();
      if (a === b || gs.has(a) || rs.has(b)) continue;
      gs.add(a);
      rs.add(b);
      fixed.push({ giver: a, receiver: b });
    }
  }
  const ring = g() < 0.6;
  const budget = g() < 0.15 ? 400 + pick(3000) : undefined;
  const opts = budget ? { ring, budget } : { ring };

  const want = show(base.planDraw(ids, { own, families, history, fixed }, seeded(seed), opts));
  JSON.parse(want).ok ? stats.ok++ : stats.fail++;
  if (show(next.planDraw(ids, { own, families, history, fixed }, seeded(seed), opts)) !== want) mismatch('planDraw', seed);

  // findAssignment: с правилами pairRules и с произвольной функцией-обёрткой (путь без быстрых веток)
  const rules = base.pairRules([...own, ...families], fixed);
  const fa = show(base.findAssignment(ids, rules, seeded(seed + 1), opts));
  if (show(next.findAssignment(ids, next.pairRules([...own, ...families], fixed), seeded(seed + 1), opts)) !== fa) mismatch('findAssignment + pairRules', seed);
  if (show(next.findAssignment(ids, (a, b) => rules(a, b), seeded(seed + 1), opts)) !== fa) mismatch('findAssignment + функция', seed);

  // Замены после жеребьёвки
  const r0 = base.findAssignment(ids, rules, seeded(seed + 2), opts);
  if (r0.ok) {
    const x = ids[pick(n)];
    const rem = (m) => {
      const r = m.removeFromAssignment(r0.pairs, x, m.pairRules([...own, ...families], fixed), seeded(seed + 3), { ring });
      return r ? JSON.stringify([[...r.pairs], r.changed]) : 'null';
    };
    const ins = (m) => {
      const r = m.insertIntoAssignment(r0.pairs, 4242, m.pairRules([...own, ...families], fixed), seeded(seed + 4), { ring });
      return r ? JSON.stringify([[...r.pairs], r.changed, r.santa, r.ward]) : 'null';
    };
    if (rem(next) !== rem(base)) mismatch('removeFromAssignment', seed);
    if (ins(next) !== ins(base)) mismatch('insertIntoAssignment', seed);
  }
}
console.log(`случаев: 6000 (успешных жеребьёвок ${stats.ok}, отказов ${stats.fail}); расхождений: ${bad}`);
process.exit(bad ? 1 : 0);

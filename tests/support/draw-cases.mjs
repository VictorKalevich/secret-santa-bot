// Случаи эталона жеребьёвки (016, FR-1611): генератор из прототипа сверки draw-equivalence.mjs (удалён в 017, история в git).
// Размеры 2–15 и до 61 у каждого пятого, исключения разной плотности (в том числе с людьми не из списка), семьи,
// история, закреплённые пары, кольцевая и нет, малый бюджет поиска; плюс замены после жеребьёвки.
// Результат случая — строка: при том же зерне она обязана совпасть побайтно (порядок вызовов rng не меняется).

// Генератор с зерном — тот же, что в tests/draw.test.mjs
export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function drawCases(count = 400) {
  const cases = [];
  for (let seed = 1; seed <= count; seed++) {
    const g = seeded(seed * 7919);
    const pick = (k) => Math.floor(g() * k);
    const n = 2 + pick(seed % 5 === 0 ? 60 : 14);
    const ids = Array.from({ length: n }, (_, i) => 500 + i * 3);
    const rnd = () => ids[pick(n)];
    const list = (k, extra = 0) => Array.from({ length: k }, () => ({ giver: g() < extra ? 9999 : rnd(), receiver: g() < extra ? 8888 : rnd() }));
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
    cases.push({ seed, ids, own, families, history, fixed, ring, budget, remove: ids[pick(n)] });
  }
  return cases;
}

// Map и Set — массивами в порядке обхода
const serialize = (v) => JSON.stringify(v, (_, x) => (x instanceof Map || x instanceof Set ? [...x] : x));

// Все функции жеребьёвки, которые зависят от rng, на одном случае. draw — модуль src/draw.js (или его вариант).
export function runCase(draw, c) {
  const { seed, ids, own, families, history, fixed, ring, budget } = c;
  const opts = budget ? { ring, budget } : { ring };
  const plan = draw.planDraw(ids, { own, families, history, fixed }, seeded(seed), opts);
  const rules = draw.pairRules([...own, ...families], fixed);
  const find = draw.findAssignment(ids, rules, seeded(seed + 1), opts);
  // Обёртка-функция — путь без быстрых веток для правил pairRules: результат обязан совпасть с find побайтно
  const findFn = draw.findAssignment(ids, (a, b) => rules(a, b), seeded(seed + 1), opts);
  const findFnSame = serialize(findFn) === serialize(find);
  const base = draw.findAssignment(ids, rules, seeded(seed + 2), opts);
  let remove = null;
  let insert = null;
  let insertRanked = null;
  if (base.ok) {
    remove = draw.removeFromAssignment(new Map(base.pairs), c.remove, rules, seeded(seed + 3), { ring });
    insert = draw.insertIntoAssignment(new Map(base.pairs), 4242, rules, seeded(seed + 4), { ring });
    // Ранг Санты (012): 0 — лучше, 1 — хуже, null — нельзя
    const rank = (a) => (a % 3 === 0 ? null : a % 2);
    insertRanked = draw.insertIntoAssignment(new Map(base.pairs), 4242, rules, seeded(seed + 5), { ring, rank });
  }
  return serialize({ plan, find, findFnSame, remove, insert, insertRanked });
}

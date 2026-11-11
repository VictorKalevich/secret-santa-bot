// Жеребьёвка с исключениями.
// Чистые функции без зависимостей от Cloudflare, чтобы их можно было тестировать в Node.
//
// ids        — массив id участников
// isAllowed  — (giver, receiver) => boolean; самому себе дарить нельзя, это проверяется здесь же
// Результат  — Map<santaId, wardId>

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function allowedFn(isAllowed) {
  return (a, b) => a !== b && isAllowed(a, b);
}

// Попытка выстроить всех в один общий круг (A→B→C→…→A).
// Так не бывает взаимных пар и проще заменять выбывших.
function findCycle(ids, ok, rng, budget = 40000) {
  const n = ids.length;
  if (n < 2) return null;
  const order = shuffle(ids, rng);
  const start = order[0];
  const path = [start];
  const used = new Set([start]);
  let steps = 0;

  function options(from) {
    return order.filter((x) => !used.has(x) && ok(from, x));
  }

  function dfs() {
    if (++steps > budget) return false;
    const last = path[path.length - 1];
    if (path.length === n) return ok(last, start);
    // Эвристика Варнсдорфа: сначала идём к тем, у кого меньше всего вариантов
    const cand = shuffle(options(last), rng)
      .map((x) => {
        used.add(x);
        const deg = order.filter((y) => !used.has(y) && ok(x, y)).length + (ok(x, start) ? 0.5 : 0);
        used.delete(x);
        return [x, deg];
      })
      .sort((p, q) => p[1] - q[1]);
    for (const [x] of cand) {
      used.add(x);
      path.push(x);
      if (dfs()) return true;
      path.pop();
      used.delete(x);
      if (steps > budget) return false;
    }
    return false;
  }

  if (!dfs()) return null;
  const m = new Map();
  for (let i = 0; i < n; i++) m.set(path[i], path[(i + 1) % n]);
  return m;
}

// Случайное совершенное паросочетание (алгоритм Куна). Любая перестановка без «самому себе».
function findMatching(ids, ok, rng) {
  const givers = shuffle(ids, rng);
  const matchR = new Map(); // receiver -> giver
  function tryKuhn(g, seen) {
    for (const r of shuffle(ids, rng)) {
      if (!ok(g, r) || seen.has(r)) continue;
      seen.add(r);
      if (!matchR.has(r) || tryKuhn(matchR.get(r), seen)) {
        matchR.set(r, g);
        return true;
      }
    }
    return false;
  }
  for (const g of givers) {
    if (!tryKuhn(g, new Set())) return null;
  }
  const m = new Map();
  for (const [r, g] of matchR) m.set(g, r);
  return m;
}

function mutualCount(m) {
  let c = 0;
  for (const [a, b] of m) if (m.get(b) === a) c++;
  return c / 2;
}

// Объясняет, почему жеребьёвка невозможна (для сообщения организатору).
export function diagnose(ids, isAllowed) {
  const ok = allowedFn(isAllowed);
  const problems = [];
  if (ids.length < 2) problems.push({ type: 'too_few' });
  for (const a of ids) {
    if (!ids.some((b) => ok(a, b))) problems.push({ type: 'no_receivers', id: a });
    if (!ids.some((b) => ok(b, a))) problems.push({ type: 'no_givers', id: a });
  }
  return problems;
}

export function findAssignment(ids, isAllowed, rng = Math.random) {
  const ok = allowedFn(isAllowed);
  if (ids.length < 2) return { ok: false, problems: diagnose(ids, isAllowed) };
  // Сначала — общий круг (несколько попыток с разным случайным порядком)
  for (let attempt = 0; attempt < 5; attempt++) {
    const cyc = findCycle(ids, ok, rng);
    if (cyc) return { ok: true, pairs: cyc, singleCycle: true };
  }
  // Иначе — любое распределение, по возможности без взаимных пар
  let best = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const m = findMatching(ids, ok, rng);
    if (!m) break;
    const mc = mutualCount(m);
    if (!best || mc < best.mc) best = { m, mc };
    if (mc === 0) break;
  }
  if (best) return { ok: true, pairs: best.m, singleCycle: false };
  const problems = diagnose(ids, isAllowed);
  if (!problems.length) problems.push({ type: 'too_strict' });
  return { ok: false, problems };
}

// Убрать участника x из уже проведённой жеребьёвки, поменяв как можно меньше пар.
// Возвращает { pairs, changed: [id санты, у кого сменился подопечный] } или null.
export function removeFromAssignment(pairsIn, x, isAllowed, rng = Math.random) {
  const ok = allowedFn(isAllowed);
  const pairs = new Map(pairsIn);
  let s = null;
  for (const [a, b] of pairs) if (b === x) s = a;
  const w = pairs.get(x);
  if (s === null || w === undefined) {
    pairs.delete(x);
    return { pairs, changed: [] };
  }
  pairs.delete(x);
  pairs.delete(s);
  if (pairs.size + 1 < 2) return null; // остался один человек — играть не с кем

  if (s === w) {
    // Была взаимная пара s↔x: вставляем s в чужую связку a→b, получаем a→s→b
    const edges = shuffle([...pairs.entries()], rng);
    for (const [a, b] of edges) {
      if (ok(a, s) && ok(s, b)) {
        pairs.set(a, s);
        pairs.set(s, b);
        return { pairs, changed: [a, s] };
      }
    }
    return null;
  }
  if (ok(s, w)) {
    pairs.set(s, w);
    return { pairs, changed: [s] };
  }
  // s не может дарить w: меняемся подопечными с кем-то ещё
  const edges = shuffle([...pairs.entries()], rng);
  for (const [a, b] of edges) {
    if (ok(s, b) && ok(a, w)) {
      pairs.set(s, b);
      pairs.set(a, w);
      return { pairs, changed: [s, a] };
    }
  }
  return null;
}

// Вписать нового участника n в уже проведённую жеребьёвку: a→b превращается в a→n→b.
export function insertIntoAssignment(pairsIn, n, isAllowed, rng = Math.random) {
  const ok = allowedFn(isAllowed);
  const pairs = new Map(pairsIn);
  if (pairs.has(n)) return null;
  const edges = shuffle([...pairs.entries()], rng);
  for (const [a, b] of edges) {
    if (ok(a, n) && ok(n, b)) {
      pairs.set(a, n);
      pairs.set(n, b);
      return { pairs, changed: [a, n] };
    }
  }
  return null;
}

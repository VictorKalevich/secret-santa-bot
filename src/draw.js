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
export function diagnose(ids, isAllowed, { ring = false } = {}) {
  const ok = allowedFn(isAllowed);
  const problems = [];
  if (ids.length < 2) problems.push({ type: 'too_few' });
  else if (ring && ids.length < 3) problems.push({ type: 'ring_too_few' });
  for (const a of ids) {
    if (!ids.some((b) => ok(a, b))) problems.push({ type: 'no_receivers', id: a });
    if (!ids.some((b) => ok(b, a))) problems.push({ type: 'no_givers', id: a });
  }
  return problems;
}

// ring = true («кольцевая»): взаимных пар нет — если A дарит B, то B не дарит A (005).
// ring = false: любое корректное распределение, взаимные пары допустимы.
export function findAssignment(ids, isAllowed, rng = Math.random, { ring = true } = {}) {
  const ok = allowedFn(isAllowed);
  if (ids.length < 2 || (ring && ids.length < 3)) return { ok: false, problems: diagnose(ids, isAllowed, { ring }) };
  if (ring) {
    // Сначала — единый круг (несколько попыток с разным случайным порядком)
    for (let attempt = 0; attempt < 5; attempt++) {
      const cyc = findCycle(ids, ok, rng);
      if (cyc) return { ok: true, pairs: cyc, singleCycle: true };
    }
    // Иначе — несколько кругов, но без взаимных пар
    for (let attempt = 0; attempt < 60; attempt++) {
      const m = findMatching(ids, ok, rng);
      if (!m) break;
      if (mutualCount(m) === 0) return { ok: true, pairs: m, singleCycle: false };
    }
    const problems = diagnose(ids, isAllowed, { ring });
    if (!problems.length) {
      const anyMatching = findMatching(ids, ok, rng);
      problems.push({ type: anyMatching ? 'ring_impossible' : 'too_strict' });
    }
    return { ok: false, problems };
  }
  const m = findMatching(ids, ok, rng);
  if (m) return { ok: true, pairs: m, singleCycle: isSingleCycle(m) };
  const problems = diagnose(ids, isAllowed, { ring });
  if (!problems.length) problems.push({ type: 'too_strict' });
  return { ok: false, problems };
}

function isSingleCycle(m) {
  const start = m.keys().next().value;
  let cur = m.get(start);
  let steps = 1;
  while (cur !== start && steps <= m.size) { cur = m.get(cur); steps++; }
  return steps === m.size;
}

export function hasMutual(pairs) {
  return mutualCount(pairs) > 0;
}

// Убрать участника x из уже проведённой жеребьёвки, поменяв как можно меньше пар.
// Возвращает { pairs, changed: [id санты, у кого сменился подопечный] } или null.
export function removeFromAssignment(pairsIn, x, isAllowed, rng = Math.random, { ring = true } = {}) {
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

  // При кольцевой жеребьёвке новая связка u→v недопустима, если уже есть v→u
  const fine = (u, v) => ok(u, v) && !(ring && pairs.get(v) === u);
  if (s === w) {
    // Была взаимная пара s↔x: вставляем s в чужую связку a→b, получаем a→s→b
    const edges = shuffle([...pairs.entries()], rng);
    for (const [a, b] of edges) {
      if (fine(a, s) && fine(s, b) && !(ring && a === b)) {
        pairs.set(a, s);
        pairs.set(s, b);
        if (ring && hasMutual(pairs)) { pairs.set(a, b); pairs.delete(s); continue; }
        return { pairs, changed: [a, s] };
      }
    }
    return null;
  }
  if (fine(s, w)) {
    pairs.set(s, w);
    return { pairs, changed: [s] };
  }
  // s не может дарить w: меняемся подопечными с кем-то ещё (меняется 2 пары)
  const edges = shuffle([...pairs.entries()], rng);
  for (const [a, b] of edges) {
    if (ok(s, b) && ok(a, w)) {
      pairs.set(s, b);
      pairs.set(a, w);
      if (ring && hasMutual(pairs)) { pairs.set(a, b); pairs.delete(s); continue; }
      return { pairs, changed: [s, a] };
    }
  }
  // Ещё на шаг дальше — «тройная» перестановка (меняется 3 пары): s→b1, a1→b2, a2→w
  for (const [a1, b1] of edges) {
    for (const [a2, b2] of edges) {
      if (a1 === a2 || !ok(s, b1) || !ok(a1, b2) || !ok(a2, w)) continue;
      pairs.set(s, b1);
      pairs.set(a1, b2);
      pairs.set(a2, w);
      if (ring && hasMutual(pairs)) { pairs.set(a1, b1); pairs.set(a2, b2); pairs.delete(s); continue; }
      return { pairs, changed: [s, a1, a2] };
    }
  }
  return null;
}

// Вписать нового участника n в уже проведённую жеребьёвку: a→b превращается в a→n→b.
export function insertIntoAssignment(pairsIn, n, isAllowed, rng = Math.random, { ring = true } = {}) {
  const ok = allowedFn(isAllowed);
  const pairs = new Map(pairsIn);
  if (pairs.has(n)) return null;
  const edges = shuffle([...pairs.entries()], rng);
  for (const [a, b] of edges) {
    // a→n→b не создаёт взаимных пар, если a ≠ b (a→b — существующая связка, a ≠ b всегда)
    if (ok(a, n) && ok(n, b) && !(ring && a === b)) {
      pairs.set(a, n);
      pairs.set(n, b);
      return { pairs, changed: [a, n] };
    }
  }
  return null;
}

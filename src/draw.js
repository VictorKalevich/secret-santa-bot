// Жеребьёвка с исключениями.
// Чистые функции без зависимостей от Cloudflare, чтобы их можно было тестировать в Node.
//
// ids        — массив id участников (различных)
// isAllowed  — (giver, receiver) => boolean; самому себе дарить нельзя, это проверяется здесь же.
//              Необязательное свойство isAllowed.fillMatrix(ids, adj) (017) — та же матрица допустимости без
//              n² вызовов функции; есть у правил из pairRules, произвольная функция работает перебором.
// Результат  — Map<santaId, wardId>

// Перестановка через временную переменную, а не деструктуризацией (017): в непрогретом коде [a[i], a[j]] = [a[j], a[i]]
// создаёт массив на каждую перестановку, а первое паросочетание делает их ~n² — две трети холодного вызова.
// Вызовы rng и их порядок те же.
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function allowedFn(isAllowed) {
  return (a, b) => a !== b && isAllowed(a, b);
}

// ---------- бюджет вычислений (006) ----------
// Бесплатный тариф Cloudflare даёт ~10 мс CPU на запрос, а время в Workers во время вычислений не идёт.
// Поэтому поиск ограничен числом элементарных шагов: при исчерпании — понятный отказ «попробуй ещё раз».
// 150 000 шагов ≈ 1–3 мс в Node, первый (холодный) вызов — до ~8 мс на ноутбуке от батареи (см. tests/draw.test.mjs).
export const DEFAULT_BUDGET = 150000;
const EXHAUSTED = Symbol('budget exhausted');

function spend(counter, n) {
  counter.left -= n;
  if (counter.left < 0) throw EXHAUSTED;
}

// Простой цикл: Array.from с функцией в V8 в разы медленнее, а range вызывается в каждой попытке поиска (015)
function range(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  return a;
}

// Дальше участники — индексы 0..n−1, допустимость — матрица adj (adj[i*n+j] = 1, если i может дарить j).

// Попытка выстроить всех в один общий круг (A→B→C→…→A).
// Так не бывает взаимных пар и проще заменять выбывших. counter — бюджет шагов этой попытки.
function findCycle(n, adj, rng, counter) {
  const ok = (a, b) => adj[a * n + b] === 1;
  const order = shuffle(range(n), rng);
  const start = order[0];
  const path = [start];
  const used = new Uint8Array(n);
  used[start] = 1;

  function dfs() {
    const last = path[path.length - 1];
    if (path.length === n) return ok(last, start);
    const rest = order.filter((x) => !used[x]);
    const options = rest.filter((x) => ok(last, x));
    spend(counter, n + options.length * rest.length);
    // Эвристика Варнсдорфа: сначала идём к тем, у кого меньше всего вариантов
    const cand = shuffle(options, rng)
      .map((x) => {
        let deg = ok(x, start) ? 0.5 : 0;
        for (const y of rest) if (y !== x && ok(x, y)) deg++;
        return [x, deg];
      })
      .sort((p, q) => p[1] - q[1]);
    for (const [x] of cand) {
      used[x] = 1;
      path.push(x);
      if (dfs()) return true;
      path.pop();
      used[x] = 0;
    }
    return false;
  }

  if (!dfs()) return null;
  const to = new Array(n);
  for (let i = 0; i < n; i++) to[path[i]] = path[(i + 1) % n];
  return to;
}

// Случайное совершенное паросочетание (алгоритм Куна), O(n·E). Любая перестановка без «самому себе».
function findMatching(n, adj, rng, counter) {
  const lists = [];
  for (let g = 0; g < n; g++) {
    const list = [];
    for (let r = 0; r < n; r++) if (adj[g * n + r] === 1) list.push(r);
    lists.push(shuffle(list, rng));
  }
  spend(counter, n * n);
  const matchR = new Int32Array(n).fill(-1); // receiver -> giver
  function tryKuhn(g, seen) {
    const list = lists[g];
    spend(counter, list.length);
    for (const r of list) {
      if (seen[r]) continue;
      seen[r] = 1;
      if (matchR[r] < 0 || tryKuhn(matchR[r], seen)) {
        matchR[r] = g;
        return true;
      }
    }
    return false;
  }
  for (const g of shuffle(range(n), rng)) {
    if (!tryKuhn(g, new Uint8Array(n))) return null;
  }
  const to = new Array(n);
  for (let r = 0; r < n; r++) to[matchR[r]] = r;
  return to;
}

const hasMutualIdx = (to) => to.some((r, g) => to[r] === g);

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
// budget — предел шагов поиска (006): при исчерпании — проблема search_exhausted.
export function findAssignment(ids, isAllowed, rng = Math.random, { ring = true, budget = DEFAULT_BUDGET } = {}) {
  const n = ids.length;
  if (n < 2 || (ring && n < 3)) return { ok: false, problems: diagnose(ids, isAllowed, { ring }) };
  const problems = diagnose(ids, isAllowed, { ring });
  if (problems.length) return { ok: false, problems };

  const ok = allowedFn(isAllowed);
  const adj = new Uint8Array(n * n);
  // Правила из pairRules заполняют матрицу по своим спискам (017). Обёртка над ними (a, b) => rules(a, b) свойство
  // теряет и идёт перебором — медленнее, результат тот же; planDraw передаёт правила напрямую.
  if (typeof isAllowed.fillMatrix === 'function') isAllowed.fillMatrix(ids, adj);
  else for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) adj[i * n + j] = ok(ids[i], ids[j]) ? 1 : 0;
  const result = (to, singleCycle) => {
    const pairs = new Map(to.map((r, g) => [ids[g], ids[r]]));
    return { ok: true, pairs, singleCycle: singleCycle ?? isSingleCycle(pairs) };
  };

  // Точная и быстрая проверка (O(n³) в худшем случае, вне бюджета): распределение вообще существует?
  const first = findMatching(n, adj, rng, { left: Infinity });
  if (!first) return { ok: false, problems: [{ type: 'too_strict' }] };
  if (!ring) return result(first);

  // Сначала — единый круг. Самое дешёвое — случайный круг: при немногих исключениях почти всегда подходит
  for (let attempt = 0; attempt < 30; attempt++) {
    const order = shuffle(range(n), rng);
    if (order.every((g, i) => adj[g * n + order[(i + 1) % n]] === 1)) {
      const to = new Array(n);
      for (let i = 0; i < n; i++) to[order[i]] = order[(i + 1) % n];
      return result(to, true);
    }
  }
  // Затем — перебор (до 5 попыток с разным порядком; все вместе — не больше половины бюджета)
  const cycleTotal = { left: budget / 2 };
  const cap = Math.max(budget / 10, n ** 3 / 2);
  for (let attempt = 0; attempt < 5 && cycleTotal.left > 0; attempt++) {
    const c = { left: Math.min(cap, cycleTotal.left) };
    const given = c.left;
    try {
      const cyc = findCycle(n, adj, rng, c);
      if (cyc) return result(cyc, true);
    } catch (e) {
      if (e !== EXHAUSTED) throw e;
    }
    cycleTotal.left -= given - Math.max(c.left, 0);
  }
  // Иначе — несколько кругов, но без взаимных пар (оставшаяся половина бюджета)
  if (!hasMutualIdx(first)) return result(first, false);
  const counter = { left: budget / 2 };
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      const m = findMatching(n, adj, rng, counter);
      if (m && !hasMutualIdx(m)) return result(m, false);
    }
    return { ok: false, problems: [{ type: 'ring_impossible' }] };
  } catch (e) {
    if (e !== EXHAUSTED) throw e;
    return { ok: false, problems: [{ type: 'search_exhausted' }] };
  }
}

// Кто кому может дарить (014): bans — запреты { giver, receiver } (исключения, семьи, история), fixed — закреплённые пары
// владельца. Закреплённая пара важнее запретов: закреплённому Санте можно дарить только своему закреплённому подопечному,
// а закреплённого подопечного может получить только его закреплённый Санта. Остальное — по запретам.
export function pairRules(bans = [], fixed = []) {
  // Запреты — Map<кто, Set<кому>>, без строк-ключей на каждую проверку (015); id везде числа (из D1)
  const banned = new Map();
  for (const e of bans) {
    let to = banned.get(e.giver);
    if (!to) banned.set(e.giver, (to = new Set()));
    to.add(e.receiver);
  }
  const wardOf = new Map(fixed.map((f) => [f.giver, f.receiver]));
  const santaOf = new Map(fixed.map((f) => [f.receiver, f.giver]));
  const rule = (a, b) => {
    if (wardOf.has(a)) return wardOf.get(a) === b;
    if (santaOf.has(b)) return false; // его закреплённый Санта — не a (иначе сработала бы строка выше)
    const to = banned.get(a);
    return !(to && to.has(b));
  };
  // Та же матрица, что дал бы перебор ids[i] !== ids[j] && rule(ids[i], ids[j]), без n² вызовов (017). Шаги идут в
  // порядке проверок rule, поздний перекрывает ранний: запреты → столбцы закреплённых подопечных → строки закреплённых
  // Сант (закреплённая пара важнее запрета) → диагональ. Люди из правил, которых нет в ids, пропускаются.
  rule.fillMatrix = (ids, adj) => {
    const n = ids.length;
    const at = new Map();
    for (let i = 0; i < n; i++) at.set(ids[i], i);
    adj.fill(1, 0, n * n);
    for (const [g, to] of banned) {
      const i = at.get(g);
      if (i === undefined) continue;
      for (const r of to) {
        const j = at.get(r);
        if (j !== undefined) adj[i * n + j] = 0;
      }
    }
    for (const r of santaOf.keys()) {
      const j = at.get(r);
      if (j !== undefined) for (let i = 0; i < n; i++) adj[i * n + j] = 0;
    }
    for (const [g, r] of wardOf) {
      const i = at.get(g);
      if (i === undefined) continue;
      adj.fill(0, i * n, i * n + n);
      const j = at.get(r);
      if (j !== undefined) adj[i * n + j] = 1;
    }
    for (let i = 0; i < n; i++) adj[i * n + i] = 0;
  };
  return rule;
}

// Полная жеребьёвка эвента (009, FR-923): все попытки делят один бюджет, а не тратят по полному каждая.
// own — исключения эвента, families — пары «не дарят друг другу» из семей, history — пары прошлого эвента,
// fixed — закреплённые пары владельца (014; все — { giver, receiver }). Сначала с историей (половина основного
// бюджета), при неудаче — без неё (вторая половина). Если мешают закреплённые пары — проверка «без них» на четверти
// бюджета: тогда одна общая причина fixed_block без имён, иначе причины этой проверки (имена в них не намекают на
// закреплённых). Если мешают семьи — проверка «без семей» (и без закреплённых) на четверти бюджета.
// Возвращает результат findAssignment и familiesBlock.
export function planDraw(ids, { own = [], families = [], history = [], fixed = [] } = {}, rng = Math.random, { ring = true, budget = DEFAULT_BUDGET } = {}) {
  const set = new Set(ids);
  const pinned = fixed.filter((f) => set.has(f.giver) && set.has(f.receiver));
  const fixedBlock = { ok: false, problems: [{ type: 'fixed_block' }], familiesBlock: false };
  // Взаимная закреплённая пара при кольцевой заведомо невозможна — без поиска
  if (ring && pinned.some((f) => pinned.some((g) => g.giver === f.receiver && g.receiver === f.giver))) return fixedBlock;
  const run = (bans, pins, b) => findAssignment(ids, pairRules(bans, pins), rng, { ring, budget: b });
  const fixedBudget = pinned.length ? budget / 4 : 0;
  const familyBudget = families.length ? budget / 4 : 0;
  const main = budget - fixedBudget - familyBudget;
  let res;
  if (history.length) {
    res = run([...own, ...families, ...history], pinned, main / 2);
    if (!res.ok) res = run([...own, ...families], pinned, main / 2);
  } else {
    res = run([...own, ...families], pinned, main);
  }
  if (res.ok) return { ...res, familiesBlock: false };
  if (pinned.length) {
    const free = run([...own, ...families], [], fixedBudget);
    if (free.ok) return fixedBlock;
    res = free;
  }
  const familiesBlock = families.length > 0 && run(own, [], familyBudget).ok;
  return { ...res, familiesBlock };
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
// rank(a) (012) — группа Санты a, у которого сменится подопечный: 0 — лучше всего, 1 — хуже, null — нельзя.
// Выбор — случайный среди допустимых связок лучшей непустой группы. Без rank — все связки равны (как раньше).
export function insertIntoAssignment(pairsIn, n, isAllowed, rng = Math.random, { ring = true, rank = null } = {}) {
  const ok = allowedFn(isAllowed);
  const pairs = new Map(pairsIn);
  if (pairs.has(n)) return null;
  let best = null;
  for (const [a, b] of shuffle([...pairs.entries()], rng)) {
    const r = rank ? rank(a) : 0;
    if (r === null || r === undefined || (best && r >= best.rank)) continue;
    // a→n→b не создаёт взаимных пар, если a ≠ b (a→b — существующая связка, a ≠ b всегда)
    if (ok(a, n) && ok(n, b) && !(ring && a === b)) best = { a, b, rank: r };
  }
  if (!best) return null;
  pairs.set(best.a, n);
  pairs.set(n, best.b);
  return { pairs, changed: [best.a, n], santa: best.a, ward: best.b, rank: best.rank };
}

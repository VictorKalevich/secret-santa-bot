// Пары эвента: проверка и проведение жеребьёвки, отмена, удаление и вписывание участника после жеребьёвки.

import {
  getEvent, drawMembersQuery, pairsQuery, pairLinksQuery, exclusionsQuery, fixedPairsQuery,
  markRemovedStmt, memberDataDeleteStmts,
} from './db.js';
import { atomic, closedParens } from './claim.js';
import { drawSnapshot, snapshotGuard } from './snapshots.js';
import { planDraw, pairRules, removeFromAssignment, insertIntoAssignment } from './draw.js';
import { msg, q, appKeyboard, randomCode, displayName, NO_DRAW, PAIRS_RACE } from './format.js';
import { tx, tjoin } from './i18n/index.js';
import { isFinished } from './status.js';
import { no } from './result.js';

// Пары прошлого эвента с наибольшим числом пар среди этих людей; при равенстве — последнего
// (для «не повторять пары», FR-510). Так параллельный эвент другой группы не подменяет «свой». Только эвенты той же
// компании (050, R12): иначе пары соседней компании влияли бы на жеребьёвку и выдавали бы себя предупреждением обмена.
const previousPairsQuery = (db, ev) => db
  .prepare(
    `SELECT p.event_id, p.santa, p.ward FROM pairs p JOIN events e ON e.id = p.event_id
      WHERE e.company_id = ? AND p.event_id != ? AND e.created_at <= ? ORDER BY e.created_at DESC, e.id DESC`
  )
  .bind(ev.company_id, ev.id, ev.created_at);

function previousPairs(results, ids) {
  const set = new Set(ids);
  const byEvent = new Map();
  for (const r of results) {
    if (!set.has(r.santa) || !set.has(r.ward)) continue;
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }
  let best = [];
  for (const list of byEvent.values()) if (list.length > best.length) best = list; // Map хранит порядок «новые первыми»
  return best;
}

// ---------- жеребьёвка ----------

function describeProblem(p, byId, w) {
  const name = (id) => byId[id]?.name || tx('db.someone');
  switch (p.type) {
    case 'too_few': return tx('pairs.reason.too_few');
    case 'ring_too_few': return tx('pairs.reason.ring_too_few');
    // Это вывод по ограниченному поиску, а не доказательство (009, FR-924) — отсюда «похоже» и «попробуй ещё раз»
    case 'ring_impossible': return tx('pairs.reason.ring_impossible');
    case 'no_receivers': return tx('pairs.reason.no_receivers', { name: name(p.id) });
    case 'no_givers': return tx('pairs.reason.no_givers', { name: name(p.id) });
    case 'search_exhausted': return tx('pairs.reason.search_exhausted');
    // 014: без имён — причину видят и админы (и рассылка о неудаче автожеребьёвки), а закреплённые пары знает только владелец
    case 'fixed_block': return tx('pairs.reason.fixed_block', { owner: w });
    default: return tx('pairs.reason.too_strict');
  }
}

// Всё, по чему считаются пары, — одним пакетом чтений (019); тексты писем не читаются — только признак «пустое»
export async function checkDraw(ctx, ev) {
  const db = ctx.db;
  const r = await ctx.read({
    members: drawMembersQuery(db, ev.id),
    exclusions: exclusionsQuery(db, ev.id),
    previous: ev.avoid_previous && previousPairsQuery(db, ev),
    // 014: закреплённые пары владельца (planDraw сам берёт только пары участников жеребьёвки)
    fixed: fixedPairsQuery(db, ev.id),
  });
  const people = r.members.filter((u) => u.registered);
  const ids = people.map((u) => u.user_id);
  const allEx = r.exclusions;
  const own = allEx.filter((e) => ids.includes(e.giver) && ids.includes(e.receiver));
  const prev = ev.avoid_previous ? previousPairs(r.previous, ids) : [];
  const history = prev.map((p) => ({ giver: p.santa, receiver: p.ward }));
  const ring = !!ev.ring;
  const fixed = r.fixed;
  // 009, FR-923: попытки (с историей, без неё, «мешают ли закреплённые пары») делят один бюджет поиска
  const res = planDraw(ids, { own, history, fixed }, Math.random, { ring });
  const byId = Object.fromEntries(people.map((u) => [u.user_id, u]));
  return {
    people,
    byId,
    res,
    ring,
    // Снимок того, по чему считались пары (009, FR-922; закреплённые пары — 014): runDraw записывает пары, только если он
    // не изменился. По уже прочитанным строкам, без запросов (020: src/snapshots.js).
    snapshot: drawSnapshot({ ids, exclusions: allEx, fixed }),
    // Учтены ли прошлые пары, наружу не сообщается: по этому признаку можно вычислить пары прошлого (009, FR-904)
    emptyWishlists: people.filter((u) => u.wishlist_blank).map((u) => u.name),
    problems: res.ok ? [] : res.problems.map((p) => describeProblem(p, byId, ctx.ownerWord())),
  };
}

// actor — кто проводит (0 — бот), action — код для журнала: 'draw' или 'draw.auto' (007)
export async function runDraw(ctx, ev, { actor = 0, action = 'draw' } = {}) {
  const db = ctx.db;
  if (ev.draw_done) return no(tx('api.drawDone'));
  const settings = await ctx.settings();
  const check = await checkDraw(ctx, ev);
  if (!check.res.ok) return no(tjoin('\n', check.problems));
  // Атомарно (006, FR-607; 020 — src/claim.js): захват первым «занимает» жеребьёвку своим токеном; остальные записи
  // выполняются, только если токен в эвенте — наш. Вторая одновременная жеребьёвка ничего не запишет.
  // 009, FR-922: захват — только если участники, исключения и параметры те же, что при расчёте пар.
  // 057: checked_on = '' — ежедневный шаг проверит событие снова (после жеребьёвки может наступить автораскрытие).
  const token = randomCode(16);
  const same = snapshotGuard(ev.id, check.snapshot);
  const mine = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_token = ?)', ev.id, token);
  mine.claim(db.prepare(
    `UPDATE events SET draw_done = 1, draw_at = ?, draw_token = ?, registration_open = 0, revealed = 0, checked_on = ''
      WHERE id = ? AND draw_done = 0 AND status = 'active' AND ring = ? AND ${same.sql}`
  ).bind(Date.now(), token, ev.id, check.ring ? 1 : 0, ...same.args));
  mine.where('DELETE FROM pairs WHERE event_id = ?', ev.id);
  for (const [santa, ward] of check.res.pairs) {
    mine.select('INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) SELECT ?, ?, ?, NULL, ?, 0',
      ev.id, santa, ward, lastUpdate(check.byId[ward]));
  }
  for (const u of check.people) {
    mine.enqueue(u.user_id, msg(
      tx('pairs.drawn', { title: q(ev) }),
      appKeyboard(settings, tx('pairs.drawnButton'), { event: ev.id })
    ));
  }
  mine.audit(ev.id, actor, action, tx('pairs.auditText.members', { n: check.people.length }));
  if (!(await mine.run()).won) {
    const cur = await getEvent(db, ev.id);
    if (cur?.draw_done) return no(tx('api.drawDone'));
    if (isFinished(cur || ev)) return no(tx('pairs.drawFinished'));
    return no(tx('pairs.drawRace'));
  }
  return { ok: true, count: check.people.length, singleCycle: check.res.singleCycle };
}

// Последнее изменение письма или адреса подопечного (008) — с него Санте приходят уведомления
const lastUpdate = (m) => Math.max(m?.wishlist_updated_at || 0, m?.delivery_updated_at || 0);

function pairsToMap(rows) {
  return new Map(rows.map((p) => [p.santa, p.ward]));
}

// ---------- изменение пар после жеребьёвки ----------

// Версия пар (009, FR-921): изменение после жеребьёвки сначала «занимает» новую версию (draw_token) при условии, что
// версия та же, что была при чтении пар; остальные операторы выполняются только при новой версии. Два одновременных
// удаления/вписывания не перепишут пары друг друга: второе ничего не изменит и попросит повторить.
// До жеребьёвки версии нет: операторы выполняются, только пока жеребьёвка не проведена.
// cond — дополнительное условие захвата (SQL с параметрами condArgs), например «Санта ещё не открыл подопечного» (012).
// Возвращает построитель a (020, src/claim.js) и оператор версии version — он уже первый в пакете (до жеребьёвки — null).
function pairsVersion(db, ev, cond = '', ...condArgs) {
  if (!ev.draw_done) {
    return { a: atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0)', ev.id), version: null };
  }
  if (cond && !closedParens(cond)) throw new Error(`pairsVersion: условие с незакрытой скобкой: ${cond}`);
  const token = randomCode(16);
  const a = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_token = ?)', ev.id, token);
  const version = a.add(
    db.prepare(`UPDATE events SET draw_token = ? WHERE id = ? AND draw_done = 1 AND draw_token = ?${cond ? ` AND (${cond})` : ''}`)
      .bind(token, ev.id, ev.draw_token, ...condArgs)
  );
  return { a, version };
}

// Применяем изменённое распределение эвента: переписываем только изменившиеся пары (все операторы — в построитель a,
// при его условии — версии пар).
async function applyPairsChange(ctx, ev, a, oldRows, newMap, changed, members) {
  const settings = await ctx.settings();
  const oldMap = pairsToMap(oldRows);
  const byId = Object.fromEntries(members.map((u) => [u.user_id, u]));
  for (const santa of oldMap.keys()) {
    if (!newMap.has(santa)) a.where('DELETE FROM pairs WHERE event_id = ? AND santa = ?', ev.id, santa);
  }
  // Переписка исчезнувших пар удаляется: новая пара начинает разговор с чистого листа (003, FR-308)
  for (const [santa, ward] of oldMap) {
    if (newMap.get(santa) !== ward) a.where('DELETE FROM messages WHERE event_id = ? AND santa = ? AND ward = ?', ev.id, santa, ward);
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward && oldMap.has(santa)) a.where('DELETE FROM pairs WHERE event_id = ? AND santa = ?', ev.id, santa);
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward) {
      a.select('INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) SELECT ?, ?, ?, NULL, ?, 0',
        ev.id, santa, ward, lastUpdate(byId[ward]));
    }
  }
  for (const santa of changed) {
    const isNew = !oldMap.has(santa);
    a.enqueue(santa, msg(
      tx(isNew ? 'pairs.inserted' : 'pairs.newWard', { title: q(ev) }),
      appKeyboard(settings, tx('pairs.lookButton'), { event: ev.id })
    ));
  }
}

// Убрать человека из эвента (после жеребьёвки — с минимальной перестройкой пар).
// mark — удаляет организатор: запомнить «удалён» (010, FR-1021), при запрете возврата по ссылке он не вернётся.
export async function removeMember(ctx, ev, userId, { notify = true, actor = 0, mark = false } = {}) {
  const db = ctx.db;
  // Участники и (после жеребьёвки) всё для перестройки пар — одним пакетом чтений (019)
  const done = !!ev.draw_done;
  const read = await ctx.read({
    members: drawMembersQuery(db, ev.id),
    pairs: done && pairsQuery(db, ev.id),
    fixed: done && fixedPairsQuery(db, ev.id),
    exclusions: done && exclusionsQuery(db, ev.id),
  });
  const { members } = read;
  const target = members.find((m) => m.user_id === userId);
  if (!target) return no(tx('pairs.notMember'));
  const { a } = pairsVersion(db, ev);
  if (ev.draw_done) {
    const rows = read.pairs;
    if (rows.some((p) => p.santa === userId || p.ward === userId)) {
      // 014: закреплённые пары оставшихся не ломаются (пары с уходящим уже не действуют)
      const fixed = read.fixed.filter((f) => f.giver !== userId && f.receiver !== userId);
      const isAllowed = pairRules(read.exclusions, fixed);
      const r = removeFromAssignment(pairsToMap(rows), userId, isAllowed, Math.random, { ring: !!ev.ring });
      if (!r) {
        return no(tx('pairs.removeBlocked'));
      }
      await applyPairsChange(ctx, ev, a, rows, r.pairs, r.changed, members);
    }
  }
  // Остальное — только пока человек ещё участник (018): до жеребьёвки версии пар нет, и без этого второй из двух
  // одновременных вызовов повторил бы уведомление, запись журнала и отметку. Строка участника удаляется последней.
  const g = a.and('EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)', ev.id, userId);
  if (notify) g.enqueue(userId, msg(tx('pairs.removed', { title: q(ev) })));
  g.audit(ev.id, actor, 'member.remove', displayName(target));
  if (mark) g.add(markRemovedStmt(db, ev.id, userId, actor, ...g.guard));
  // Исключения, закреплённые пары, переписка и обращения участника — по списку REGISTRY (018); строка участника —
  // последней: по ней узнаём исход
  g.claim(g.add(...memberDataDeleteStmts(db, ev.id, userId, ...g.guard)));
  if (!(await g.run()).won) {
    const still = await db.prepare('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?').bind(ev.id, userId).first();
    return no(still ? PAIRS_RACE : tx('pairs.notMember'));
  }
  return { ok: true };
}

// Отказ вписывания — одна общая фраза (012, FR-1202): какая группа пуста и что именно помешало, наружу не сообщается
export const INSERT_BLOCKED = tx('pairs.insertBlocked');

// Группа Санты пары p при вписывании (012, FR-1202): 0 — не открыл подопечного и не переписывался с ним;
// 1 — подарок не готов и не получен; null — не трогать (подарок готов или уже получен).
export function insertRank(p, talked) {
  if (!p || p.gift_ready || p.gift_received) return null;
  return p.seen_text === null && !talked ? 0 : 1;
}

// Вписывает только владелец (012, FR-1201) — проверка прав в api.js
export async function insertMember(ctx, ev, userId, actor = 0) {
  const db = ctx.db;
  if (!ev.draw_done) return no(NO_DRAW);
  // Участники, пары (с отметкой «открыл» — для групп Сант), правила и переписка — одним пакетом чтений (019)
  const read = await ctx.read({
    members: drawMembersQuery(db, ev.id),
    rows: pairsQuery(db, ev.id),
    ownEx: exclusionsQuery(db, ev.id),
    chats: db.prepare('SELECT DISTINCT santa, ward FROM messages WHERE event_id = ?').bind(ev.id),
    fixed: fixedPairsQuery(db, ev.id), // 014: вписывание не разрывает закреплённых пар
  });
  const { members, rows, ownEx, chats, fixed } = read;
  const u = members.find((x) => x.user_id === userId);
  if (!u || !u.registered) return no(tx('membership.memberNotFound'));
  if (rows.some((p) => p.santa === userId)) return no(tx('pairs.alreadyInDraw'));
  const talked = new Set(chats.map((m) => `${m.santa}:${m.ward}`));
  const bySanta = new Map(rows.map((p) => [p.santa, p]));
  const rank = (a) => {
    const p = bySanta.get(a);
    return insertRank(p, p && talked.has(`${p.santa}:${p.ward}`));
  };
  const r = insertIntoAssignment(pairsToMap(rows), userId, pairRules(ownEx, fixed), Math.random, { ring: !!ev.ring, rank });
  if (!r) return no(INSERT_BLOCKED);
  // Группа выбранного Санты проверяется ещё раз в захвате (research R2): если он только что открыл подопечного или
  // отметил подарок, пары не меняются — «попробуй ещё раз»
  const fresh = r.rank === 0 ? ' AND seen_text IS NULL AND NOT EXISTS (SELECT 1 FROM messages WHERE event_id = ? AND santa = ? AND ward = ?)' : '';
  const { a, version } = pairsVersion(db, ev,
    `EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND santa = ? AND ward = ? AND gift_ready = 0 AND gift_received = 0${fresh})`,
    ev.id, r.santa, r.ward, ...(fresh ? [ev.id, r.santa, r.ward] : []));
  await applyPairsChange(ctx, ev, a, rows, r.pairs, r.changed, members);
  a.audit(ev.id, actor, 'member.insert', displayName(u));
  a.claim(version);
  if (!(await a.run()).won) return no(PAIRS_RACE);
  return { ok: true };
}

// ---------- обмен подопечных (048): только владелец — проверка прав в api.js ----------

// Тексты без имён (контракт specs/048-owner-ward-swap/contracts/draw-swap.md): видит только владелец, но людей они не
// называют — владелец, который сам играет, не хочет знать пары. Правило → ключ словаря (060)
export const SWAP_RULES = {
  self: 'pairs.swapRule.self',
  exclusion: 'pairs.swapRule.exclusion',
  ring: 'pairs.swapRule.ring',
  fixed: 'pairs.swapRule.fixed',
  history: 'pairs.swapRule.history',
};
const SWAP_REVEALED = tx('pairs.swapRevealed');

// Нарушения обмена подопечных a и b (pairs — Map Санта → подопечный): меняются только связки a → w(b) и b → w(a).
// self — кто-то дарил бы сам себе: обмен невозможен, остальное не считается. exclusions, history — пары { giver, receiver }.
export function swapRules(pairs, a, b, { exclusions = [], ring = false, fixed = [], history = [] } = {}) {
  const wa = pairs.get(a);
  const wb = pairs.get(b);
  if (wa === b || wb === a) return ['self'];
  const links = [[a, wb], [b, wa]];
  const hit = (rows) => links.some(([g, r]) => rows.some((e) => e.giver === g && e.receiver === r));
  const after = new Map(pairs).set(a, wb).set(b, wa);
  const rules = [];
  if (hit(exclusions)) rules.push('exclusion');
  if (ring && (pairs.get(wb) === a || pairs.get(wa) === b)) rules.push('ring');
  // Закреплённая пара, которая действовала, а после обмена — нет
  if (fixed.some((f) => pairs.get(f.giver) === f.receiver && after.get(f.giver) !== f.receiver)) rules.push('fixed');
  if (hit(history)) rules.push('history');
  return rules;
}

// Пары и правила — одним пакетом чтений (019); общие отказы — в порядке контракта
async function swapData(ctx, ev, a, b) {
  if (!ev.draw_done) return no(NO_DRAW);
  if (ev.revealed) return no(SWAP_REVEALED);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) return no(tx('pairs.swapTwo'));
  const db = ctx.db;
  const r = await ctx.read({
    members: drawMembersQuery(db, ev.id),
    rows: pairsQuery(db, ev.id),
    exclusions: exclusionsQuery(db, ev.id),
    fixed: fixedPairsQuery(db, ev.id),
    previous: ev.avoid_previous && previousPairsQuery(db, ev),
  });
  const pairs = pairsToMap(r.rows);
  if (!pairs.has(a) || !pairs.has(b)) return no(tx('pairs.notInDraw'));
  const ids = r.members.filter((m) => m.registered).map((m) => m.user_id);
  const history = ev.avoid_previous ? previousPairs(r.previous, ids).map((p) => ({ giver: p.santa, receiver: p.ward })) : [];
  const rules = swapRules(pairs, a, b, { exclusions: r.exclusions, ring: !!ev.ring, fixed: r.fixed, history });
  // Снимок правил — в условии записи, как у жеребьёвки: обмен не запишется по правилам, изменившимся во время вызова
  const snapshot = drawSnapshot({ ids, exclusions: r.exclusions, fixed: r.fixed });
  return { ok: true, members: r.members, rows: r.rows, pairs, rules, snapshot };
}

export async function checkSwap(ctx, ev, a, b) {
  const d = await swapData(ctx, ev, a, b);
  if (!d.ok) return d;
  return {
    ok: true,
    possible: !d.rules.includes('self'),
    rules: d.rules.map((rule) => ({ rule, text: tx(SWAP_RULES[rule]) })),
    // Версия пар: обмен с другой не пройдёт — повтор после успеха не вернёт пары обратно
    version: ev.draw_token,
  };
}

// agree — коды правил, на нарушение которых владелец согласился
export async function swapWards(ctx, ev, { a, b, version, agree }, actor) {
  const d = await swapData(ctx, ev, a, b);
  if (!d.ok) return d;
  if (String(version ?? '') !== ev.draw_token) return no(tx('pairs.swapStale'));
  if (d.rules.includes('self')) return no(tx('pairs.swapSelf'));
  const agreed = Array.isArray(agree) ? agree : [];
  if (d.rules.some((rule) => !agreed.includes(rule))) return no(tx('pairs.swapRulesChanged'));
  const same = snapshotGuard(ev.id, d.snapshot);
  const { a: change, version: claim } = pairsVersion(ctx.db, ev,
    `revealed = 0 AND status = 'active' AND avoid_previous = ? AND ${same.sql}`,
    ev.avoid_previous ? 1 : 0, ...same.args);
  // 049: о смене пишем только Санте, открывшему прежнего подопечного, — по строке пары в момент записи, до её удаления
  const settings = await ctx.settings();
  for (const santa of [a, b]) {
    change.and('EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND santa = ? AND ward = ? AND seen_text IS NOT NULL)',
      ev.id, santa, d.pairs.get(santa)).enqueue(santa, msg(tx('pairs.swapNotice', { title: q(ev) }), appKeyboard(settings, tx('pairs.lookButton'), { event: ev.id })));
  }
  const next = new Map(d.pairs).set(a, d.pairs.get(b)).set(b, d.pairs.get(a));
  await applyPairsChange(ctx, ev, change, d.rows, next, [], d.members);
  change.audit(ev.id, actor, 'draw.swap', tx('pairs.auditText.changed', { n: 2 }));
  change.claim(claim);
  if (!(await change.run()).won) {
    const cur = await getEvent(ctx.db, ev.id);
    return no(cur?.revealed ? SWAP_REVEALED : PAIRS_RACE);
  }
  return { ok: true };
}

// ---------- отмена жеребьёвки (007) и принудительная отмена (012) ----------

// Можно ли отменить жеребьёвку (FR-708): никто не открыл подопечного и переписки нет
const CANCEL_COND =
  'NOT EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND seen_text IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM messages WHERE event_id = ?)';

// null — отменить нельзя и без запроса (не проведена, раскрыта, завершено); иначе строка { ok }
export function cancelableQuery(db, ev) {
  if (!ev.draw_done || ev.revealed || isFinished(ev)) return null;
  return db.prepare(`SELECT ${CANCEL_COND} AS ok`).bind(ev.id, ev.id);
}

const NOT_DRAWN = tx('pairs.notDrawn');
const CANCEL_REVEALED = tx('pairs.cancelRevealed');

// Обе отмены (020, research R5): захват — по версии пар (draw_token) и «не раскрыта, идёт» + cond; пары удаляются,
// при chats — и переписка Сант эвента; письма остаются, регистрация открывается. Одновременное вписывание, удаление
// или другая отмена не дадут второго результата. lost() — текст отказа, если захват не состоялся.
async function undoDraw(ctx, ev, actor, { tag, cond = '', condArgs = [], chats = false, text, action, lost }) {
  const db = ctx.db;
  if (isFinished(ev)) return no(tx('pairs.cancelFinished'));
  if (!ev.draw_done) return no(NOT_DRAWN);
  if (ev.revealed) return no(CANCEL_REVEALED);
  const { settings, rows } = await ctx.read({ rows: pairLinksQuery(db, ev.id), settings: true });
  if (cond && !closedParens(cond)) throw new Error(`undoDraw: условие с незакрытой скобкой: ${cond}`);
  const token = tag + randomCode(12);
  const undone = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0 AND draw_token = ?)', ev.id, token);
  undone.claim(db.prepare(
    `UPDATE events SET draw_done = 0, draw_at = 0, draw_token = ?, registration_open = 1, draw_auto_date = ''
      WHERE id = ? AND draw_done = 1 AND draw_token = ? AND revealed = 0 AND status = 'active'${cond ? ` AND (${cond})` : ''}`
  ).bind(token, ev.id, ev.draw_token, ...condArgs));
  undone.where('DELETE FROM pairs WHERE event_id = ?', ev.id);
  if (chats) undone.where('DELETE FROM messages WHERE event_id = ?', ev.id);
  for (const p of rows) undone.enqueue(p.santa, msg(text, appKeyboard(settings, tx('events.openButton'), { event: ev.id })));
  undone.audit(ev.id, actor, action, tx('pairs.auditText.removed', { n: rows.length }));
  if (!(await undone.run()).won) return no(await lost());
  return { ok: true, count: rows.length };
}

// Отмена атомарно (research R3 012): если кто-то открыл подопечного между проверкой и batch — ничего не меняется
export async function cancelDraw(ctx, ev, actor) {
  return undoDraw(ctx, ev, actor, {
    tag: 'cancel:',
    cond: CANCEL_COND,
    condArgs: [ev.id, ev.id],
    text: tx('pairs.cancelled', { title: q(ev) }),
    action: 'draw.cancel',
    lost: async () => tx('pairs.cancelBlocked'),
  });
}

// Владелец отменяет жеребьёвку в любой момент до раскрытия (research R4 012): пары, отметки и переписка Сант эвента
// удаляются, письма остаются, регистрация открывается.
export async function forceCancelDraw(ctx, ev, actor) {
  return undoDraw(ctx, ev, actor, {
    tag: 'force:',
    chats: true,
    text: tx('pairs.forceCancelled', { title: q(ev) }),
    action: 'draw.cancel.force',
    lost: async () => {
      const cur = await getEvent(ctx.db, ev.id);
      if (!cur?.draw_done) return NOT_DRAWN;
      if (cur.revealed) return CANCEL_REVEALED;
      return PAIRS_RACE;
    },
  });
}

// Пары эвента: проверка и проведение жеребьёвки, отмена, удаление и вписывание участника после жеребьёвки.

import {
  getEvent, drawMembersQuery, pairsQuery, pairLinksQuery, exclusionsQuery, familyRowsQuery, fixedPairsQuery,
  markRemovedStmt, memberDataDeleteStmts,
} from './db.js';
import { familyExclusions } from './constraints.js';
import { atomic, closedParens } from './claim.js';
import { drawSnapshot, snapshotGuard } from './snapshots.js';
import { planDraw, pairRules, removeFromAssignment, insertIntoAssignment } from './draw.js';
import { msg, q, appKeyboard, randomCode, displayName, NO_DRAW, PAIRS_RACE } from './format.js';
import { isFinished } from './status.js';

// Пары прошлого эвента с наибольшим числом пар среди этих людей; при равенстве — последнего
// (для «не повторять пары», FR-510). Так параллельный эвент другой группы не подменяет «свой».
const previousPairsQuery = (db, ev) => db
  .prepare(
    `SELECT p.event_id, p.santa, p.ward FROM pairs p JOIN events e ON e.id = p.event_id
      WHERE p.event_id != ? AND e.created_at <= ? ORDER BY e.created_at DESC, e.id DESC`
  )
  .bind(ev.id, ev.created_at);

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

function describeProblem(p, byId) {
  const name = (id) => byId[id]?.name || 'кто-то';
  switch (p.type) {
    case 'too_few': return 'Нужно хотя бы 2 участника.';
    case 'ring_too_few': return 'Для кольцевой жеребьёвки нужно минимум 3 участника — или выключи кольцевую в параметрах.';
    // Это вывод по ограниченному поиску, а не доказательство (009, FR-924) — отсюда «похоже» и «попробуй ещё раз»
    case 'ring_impossible': return 'Похоже, без взаимных пар с такими исключениями не обойтись. Попробуй ещё раз; если не выйдет — убери часть исключений или выключи кольцевую жеребьёвку.';
    case 'no_receivers': return `${name(p.id)} не может дарить никому — проверь исключения.`;
    case 'no_givers': return `${name(p.id)} не может достаться никому — проверь исключения.`;
    case 'search_exhausted': return 'Не удалось быстро подобрать распределение — попробуй ещё раз. Если не выйдет, убери часть исключений или выключи кольцевую жеребьёвку.';
    // 014: без имён — причину видят и админы (и рассылка о неудаче автожеребьёвки), а закреплённые пары знает только владелец
    case 'fixed_block': return 'Мешают закреплённые пары: с ними распределить всех по правилам не получается. Владелец бота может убрать часть закреплённых пар.';
    default: return 'Слишком много исключений: распределить всех так, чтобы их соблюсти, не получается. Убери часть исключений.';
  }
}

// Всё, по чему считаются пары, — одним пакетом чтений (019); тексты писем не читаются — только признак «пустое»
export async function checkDraw(ctx, ev) {
  const db = ctx.db;
  const r = await ctx.read({
    members: drawMembersQuery(db, ev.id),
    exclusions: exclusionsQuery(db, ev.id),
    // 008: семьи — как исключения; строки семей читаются один раз — и для исключений, и для снимка (010)
    families: ev.families_on && familyRowsQuery(db),
    previous: ev.avoid_previous && previousPairsQuery(db, ev),
    // 014: закреплённые пары владельца (planDraw сам берёт только пары участников жеребьёвки)
    fixed: fixedPairsQuery(db, ev.id),
  });
  const people = r.members.filter((u) => u.registered);
  const ids = people.map((u) => u.user_id);
  const allEx = r.exclusions;
  const own = allEx.filter((e) => ids.includes(e.giver) && ids.includes(e.receiver));
  const famRows = r.families;
  const families = familyExclusions(ev, ids, famRows);
  const prev = ev.avoid_previous ? previousPairs(r.previous, ids) : [];
  const history = prev.map((p) => ({ giver: p.santa, receiver: p.ward }));
  const ring = !!ev.ring;
  const fixed = r.fixed;
  // 009, FR-923: попытки (с историей, без неё, «мешают ли закреплённые пары и семьи») делят один бюджет поиска
  const { familiesBlock, ...res } = planDraw(ids, { own, families, history, fixed }, Math.random, { ring });
  const byId = Object.fromEntries(people.map((u) => [u.user_id, u]));
  return {
    people,
    byId,
    res,
    ring,
    // Снимок того, по чему считались пары (009, FR-922; семьи — 010, FR-1019; закреплённые пары — 014): runDraw
    // записывает пары, только если он не изменился. По уже прочитанным строкам, без запросов (020: src/snapshots.js).
    snapshot: drawSnapshot(ev, { ids, exclusions: allEx, families: famRows, fixed }),
    // Учтены ли прошлые пары, наружу не сообщается: по этому признаку можно вычислить пары прошлого (009, FR-904)
    emptyWishlists: people.filter((u) => u.wishlist_blank).map((u) => u.name),
    problems: res.ok ? [] : [
      ...(familiesBlock ? ['Мешают семьи: члены одной семьи не дарят друг другу, и распределить всех так не получается. Выключи «Учитывать семьи» или кольцевую жеребьёвку.'] : []),
      ...res.problems.map((p) => describeProblem(p, byId)),
    ],
  };
}

// actor — кто проводит (0 — бот), action — код для журнала: 'draw' или 'draw.auto' (007)
export async function runDraw(ctx, ev, { actor = 0, action = 'draw' } = {}) {
  const db = ctx.db;
  if (ev.draw_done) return { ok: false, error: 'Жеребьёвка уже проведена.' };
  const settings = await ctx.settings();
  const check = await checkDraw(ctx, ev);
  if (!check.res.ok) return { ok: false, error: check.problems.join('\n') };
  // Атомарно (006, FR-607; 020 — src/claim.js): захват первым «занимает» жеребьёвку своим токеном; остальные записи
  // выполняются, только если токен в эвенте — наш. Вторая одновременная жеребьёвка ничего не запишет.
  // 009, FR-922: захват — только если участники, исключения и параметры те же, что при расчёте пар.
  const token = randomCode(16);
  const same = snapshotGuard(ev.id, check.snapshot);
  const mine = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_token = ?)', ev.id, token);
  mine.claim(db.prepare(
    `UPDATE events SET draw_done = 1, draw_at = ?, draw_token = ?, registration_open = 0, revealed = 0
      WHERE id = ? AND draw_done = 0 AND status = 'active' AND ring = ? AND families_on = ? AND ${same.sql}`
  ).bind(Date.now(), token, ev.id, check.ring ? 1 : 0, ev.families_on ? 1 : 0, ...same.args));
  mine.where('DELETE FROM pairs WHERE event_id = ?', ev.id);
  for (const [santa, ward] of check.res.pairs) {
    mine.select('INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) SELECT ?, ?, ?, NULL, ?, 0',
      ev.id, santa, ward, lastUpdate(check.byId[ward]));
  }
  for (const u of check.people) {
    mine.enqueue(u.user_id, msg(
      `🎄 <b>Жеребьёвка в событии ${q(ev)} проведена!</b>\n\nОткрой приложение и загляни во вкладку «Подопечный», чтобы узнать, кому ты даришь подарок. Никому не рассказывай 🤫`,
      appKeyboard(settings, '🎁 Узнать подопечного', { event: ev.id })
    ));
  }
  mine.audit(ev.id, actor, action, `участников: ${check.people.length}`);
  if (!(await mine.run()).won) {
    const cur = await getEvent(db, ev.id);
    if (cur?.draw_done) return { ok: false, error: 'Жеребьёвка уже проведена.' };
    if (isFinished(cur || ev)) return { ok: false, error: 'Событие завершено.' };
    return { ok: false, error: 'Участники, исключения или семьи изменились во время жеребьёвки — попробуй ещё раз.' };
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
      isNew
        ? `🎄 <b>Ты в игре!</b> Жеребьёвка события ${q(ev)} для тебя проведена — загляни во вкладку «Подопечный» 🤫`
        : `🔄 Состав события ${q(ev)} изменился, и у тебя теперь <b>новый подопечный</b>. Загляни во вкладку «Подопечный».`,
      appKeyboard(settings, '🎁 Посмотреть', { event: ev.id })
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
    families: done && ev.families_on && familyRowsQuery(db),
  });
  const { members } = read;
  const target = members.find((m) => m.user_id === userId);
  if (!target) return { ok: false, error: 'Человек не участвует в этом событии.' };
  const { a } = pairsVersion(db, ev);
  if (ev.draw_done) {
    const rows = read.pairs;
    if (rows.some((p) => p.santa === userId || p.ward === userId)) {
      // 014: закреплённые пары оставшихся не ломаются (пары с уходящим уже не действуют)
      const fixed = read.fixed.filter((f) => f.giver !== userId && f.receiver !== userId);
      const isAllowed = pairRules([...read.exclusions, ...familyExclusions(ev, members.map((m) => m.user_id), read.families)], fixed);
      const r = removeFromAssignment(pairsToMap(rows), userId, isAllowed, Math.random, { ring: !!ev.ring });
      if (!r) {
        return { ok: false, error: 'Не получается убрать участника, не нарушив исключения или кольцевую жеребьёвку. Ослабь исключения.' };
      }
      await applyPairsChange(ctx, ev, a, rows, r.pairs, r.changed, members);
    }
  }
  // Остальное — только пока человек ещё участник (018): до жеребьёвки версии пар нет, и без этого второй из двух
  // одновременных вызовов повторил бы уведомление, запись журнала и отметку. Строка участника удаляется последней.
  const g = a.and('EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)', ev.id, userId);
  if (notify) g.enqueue(userId, msg(`Организатор удалил тебя из события ${q(ev)}. Если это ошибка — напиши ему.`));
  g.audit(ev.id, actor, 'member.remove', displayName(target));
  if (mark) g.add(markRemovedStmt(db, ev.id, userId, actor, ...g.guard));
  // Исключения, закреплённые пары, переписка и обращения участника — по списку REGISTRY (018); строка участника —
  // последней: по ней узнаём исход
  g.claim(g.add(...memberDataDeleteStmts(db, ev.id, userId, ...g.guard)));
  if (!(await g.run()).won) {
    const still = await db.prepare('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?').bind(ev.id, userId).first();
    return { ok: false, error: still ? PAIRS_RACE : 'Человек не участвует в этом событии.' };
  }
  return { ok: true };
}

// Отказ вписывания — одна общая фраза (012, FR-1202): какая группа пуста и что именно помешало, наружу не сообщается
export const INSERT_BLOCKED =
  'Не получается вписать участника, не нарушив правила: подарки уже готовы у всех, кому мог бы смениться подопечный, ' +
  'или мешают исключения. Можно отменить жеребьёвку в опасной зоне и провести заново.';

// Группа Санты пары p при вписывании (012, FR-1202): 0 — не открыл подопечного и не переписывался с ним;
// 1 — подарок не готов и не получен; null — не трогать (подарок готов или уже получен).
export function insertRank(p, talked) {
  if (!p || p.gift_ready || p.gift_received) return null;
  return p.seen_text === null && !talked ? 0 : 1;
}

// Вписывает только владелец (012, FR-1201) — проверка прав в api.js
export async function insertMember(ctx, ev, userId, actor = 0) {
  const db = ctx.db;
  if (!ev.draw_done) return { ok: false, error: NO_DRAW };
  // Участники, пары (с отметкой «открыл» — для групп Сант), правила и переписка — одним пакетом чтений (019)
  const read = await ctx.read({
    members: drawMembersQuery(db, ev.id),
    rows: pairsQuery(db, ev.id),
    ownEx: exclusionsQuery(db, ev.id),
    families: ev.families_on && familyRowsQuery(db),
    chats: db.prepare('SELECT DISTINCT santa, ward FROM messages WHERE event_id = ?').bind(ev.id),
    fixed: fixedPairsQuery(db, ev.id), // 014: вписывание не разрывает закреплённых пар
  });
  const { members, rows, ownEx, chats, fixed } = read;
  const u = members.find((x) => x.user_id === userId);
  if (!u || !u.registered) return { ok: false, error: 'Участник не найден.' };
  const famEx = familyExclusions(ev, members.map((m) => m.user_id), read.families);
  if (rows.some((p) => p.santa === userId)) return { ok: false, error: 'Участник уже в жеребьёвке.' };
  const talked = new Set(chats.map((m) => `${m.santa}:${m.ward}`));
  const bySanta = new Map(rows.map((p) => [p.santa, p]));
  const rank = (a) => {
    const p = bySanta.get(a);
    return insertRank(p, p && talked.has(`${p.santa}:${p.ward}`));
  };
  const r = insertIntoAssignment(pairsToMap(rows), userId, pairRules([...ownEx, ...famEx], fixed), Math.random, { ring: !!ev.ring, rank });
  if (!r) return { ok: false, error: INSERT_BLOCKED };
  // Группа выбранного Санты проверяется ещё раз в захвате (research R2): если он только что открыл подопечного или
  // отметил подарок, пары не меняются — «попробуй ещё раз»
  const fresh = r.rank === 0 ? ' AND seen_text IS NULL AND NOT EXISTS (SELECT 1 FROM messages WHERE event_id = ? AND santa = ? AND ward = ?)' : '';
  const { a, version } = pairsVersion(db, ev,
    `EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND santa = ? AND ward = ? AND gift_ready = 0 AND gift_received = 0${fresh})`,
    ev.id, r.santa, r.ward, ...(fresh ? [ev.id, r.santa, r.ward] : []));
  await applyPairsChange(ctx, ev, a, rows, r.pairs, r.changed, members);
  a.audit(ev.id, actor, 'member.insert', displayName(u));
  a.claim(version);
  if (!(await a.run()).won) return { ok: false, error: PAIRS_RACE };
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

// Обе отмены (020, research R5): захват — по версии пар (draw_token) и «не раскрыта, идёт» + cond; пары удаляются,
// при chats — и переписка Сант эвента; письма остаются, регистрация открывается. Одновременное вписывание, удаление
// или другая отмена не дадут второго результата. lost() — текст отказа, если захват не состоялся.
async function undoDraw(ctx, ev, actor, { tag, cond = '', condArgs = [], chats = false, text, action, lost }) {
  const db = ctx.db;
  if (isFinished(ev)) return { ok: false, error: 'Событие завершено — отменить жеребьёвку нельзя.' };
  if (!ev.draw_done) return { ok: false, error: 'Жеребьёвка не проведена.' };
  if (ev.revealed) return { ok: false, error: 'Тайна уже раскрыта — отменить жеребьёвку нельзя.' };
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
  for (const p of rows) undone.enqueue(p.santa, msg(text, appKeyboard(settings, '🎁 Открыть', { event: ev.id })));
  undone.audit(ev.id, actor, action, `пар удалено: ${rows.length}`);
  if (!(await undone.run()).won) return { ok: false, error: await lost() };
  return { ok: true, count: rows.length };
}

// Отмена атомарно (research R3 012): если кто-то открыл подопечного между проверкой и batch — ничего не меняется
export async function cancelDraw(ctx, ev, actor) {
  return undoDraw(ctx, ev, actor, {
    tag: 'cancel:',
    cond: CANCEL_COND,
    condArgs: [ev.id, ev.id],
    text: `↩️ Организатор <b>отменил жеребьёвку</b> в событии ${q(ev)}. Твоё письмо Санте сохранено. Когда будет новая жеребьёвка, бот напишет.`,
    action: 'draw.cancel',
    lost: async () => 'Отменить нельзя: кто-то уже открыл подопечного или началась переписка.',
  });
}

// Владелец отменяет жеребьёвку в любой момент до раскрытия (research R4 012): пары, отметки и переписка Сант эвента
// удаляются, письма остаются, регистрация открывается.
export async function forceCancelDraw(ctx, ev, actor) {
  return undoDraw(ctx, ev, actor, {
    tag: 'force:',
    chats: true,
    text: `↩️ Организатор <b>отменил жеребьёвку</b> в событии ${q(ev)}. Прежняя пара больше не действует, переписка с Сантой и ` +
      'подопечным удалена. Твоё письмо сохранено. Когда будет новая жеребьёвка, бот напишет.',
    action: 'draw.cancel.force',
    lost: async () => {
      const cur = await getEvent(ctx.db, ev.id);
      if (!cur?.draw_done) return 'Жеребьёвка не проведена.';
      if (cur.revealed) return 'Тайна уже раскрыта — отменить жеребьёвку нельзя.';
      return PAIRS_RACE;
    },
  });
}

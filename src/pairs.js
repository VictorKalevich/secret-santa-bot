// Пары эвента: проверка и проведение жеребьёвки, отмена, удаление и вписывание участника после жеребьёвки.

import {
  getSettings, getExclusions, getPairs, eventMembers, drawParticipants, familyExclusions,
  enqueueStmt, enqueueIfStmt, auditStmt, auditIfStmt,
} from './db.js';
import { findAssignment, removeFromAssignment, insertIntoAssignment } from './draw.js';
import { msg, q, openAppButton, randomCode, displayName } from './format.js';
import { isFinished } from './events.js';

function buildIsAllowed(exclusions, extraPairs = []) {
  const banned = new Set();
  for (const e of exclusions) banned.add(`${e.giver}:${e.receiver}`);
  for (const h of extraPairs) banned.add(`${h.santa}:${h.ward}`);
  return (a, b) => !banned.has(`${a}:${b}`);
}

// Пары прошлого эвента с наибольшим числом пар среди этих людей; при равенстве — последнего
// (для «не повторять пары», FR-510). Так параллельный эвент другой группы не подменяет «свой».
async function previousPairs(db, ev, ids) {
  const set = new Set(ids);
  const { results } = await db
    .prepare(
      `SELECT p.event_id, p.santa, p.ward FROM pairs p JOIN events e ON e.id = p.event_id
        WHERE p.event_id != ? AND e.created_at <= ? ORDER BY e.created_at DESC, e.id DESC`
    )
    .bind(ev.id, ev.created_at)
    .all();
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
    case 'ring_too_few': return 'Для кольцевой жеребьёвки нужно минимум 3 участника — или выключи кольцевую в параметрах эвента.';
    case 'ring_impossible': return 'С такими исключениями без взаимных пар не обойтись. Убери часть исключений или выключи кольцевую жеребьёвку.';
    case 'no_receivers': return `${name(p.id)} не может дарить никому — проверь исключения.`;
    case 'no_givers': return `${name(p.id)} не может достаться никому — проверь исключения.`;
    case 'search_exhausted': return 'Не удалось быстро подобрать распределение — попробуй ещё раз. Если не выйдет, убери часть исключений или выключи кольцевую жеребьёвку.';
    default: return 'Слишком много исключений: распределить всех так, чтобы их соблюсти, не получается. Убери часть исключений.';
  }
}

export async function checkDraw(env, ev) {
  const db = env.DB;
  const people = await drawParticipants(db, ev.id);
  const ids = people.map((u) => u.user_id);
  const own = (await getExclusions(db, ev.id)).filter((e) => ids.includes(e.giver) && ids.includes(e.receiver));
  const fam = await familyExclusions(db, ev, ids); // 008: семьи — как исключения
  const exclusions = [...own, ...fam];
  const prev = ev.avoid_previous ? await previousPairs(db, ev, ids) : [];
  const ring = !!ev.ring;
  let res = findAssignment(ids, buildIsAllowed(exclusions, prev), Math.random, { ring });
  if (!res.ok && prev.length) res = findAssignment(ids, buildIsAllowed(exclusions), Math.random, { ring });
  // 008, FR-807: если мешают именно семьи — сказать об этом
  const familiesBlock = !res.ok && fam.length > 0 && findAssignment(ids, buildIsAllowed(own), Math.random, { ring }).ok;
  const byId = Object.fromEntries(people.map((u) => [u.user_id, u]));
  return {
    people,
    byId,
    res,
    ring,
    // Учтены ли прошлые пары, наружу не сообщается: по этому признаку можно вычислить пары прошлого (009, FR-904)
    emptyWishlists: people.filter((u) => !u.wishlist.trim()).map((u) => u.name),
    problems: res.ok ? [] : [
      ...(familiesBlock ? ['Мешают семьи: члены одной семьи не дарят друг другу, и распределить всех так не получается. Выключи «Учитывать семьи» или кольцевую жеребьёвку.'] : []),
      ...res.problems.map((p) => describeProblem(p, byId)),
    ],
  };
}

// actor — кто проводит (0 — бот), action — код для журнала: 'draw' или 'draw.auto' (007)
export async function runDraw(env, ev, { actor = 0, action = 'draw' } = {}) {
  const db = env.DB;
  if (ev.draw_done) return { ok: false, error: 'Жеребьёвка уже проведена.' };
  const settings = await getSettings(db);
  const check = await checkDraw(env, ev);
  if (!check.res.ok) return { ok: false, error: check.problems.join('\n') };
  // Атомарно (006, FR-607): batch D1 — одна транзакция. Первый оператор «занимает» жеребьёвку своим токеном;
  // остальные записи выполняются, только если токен в эвенте — наш. Вторая одновременная жеребьёвка ничего не запишет.
  const token = randomCode(16);
  const guard = 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_token = ?)';
  const stmts = [
    db.prepare('UPDATE events SET draw_done = 1, draw_at = ?, draw_token = ?, registration_open = 0, revealed = 0 WHERE id = ? AND draw_done = 0')
      .bind(Date.now(), token, ev.id),
    db.prepare(`DELETE FROM pairs WHERE event_id = ? AND ${guard}`).bind(ev.id, ev.id, token),
  ];
  for (const [santa, ward] of check.res.pairs) {
    stmts.push(
      db.prepare(`INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) SELECT ?, ?, ?, NULL, ?, 0 WHERE ${guard}`)
        .bind(ev.id, santa, ward, lastUpdate(check.byId[ward]), ev.id, token)
    );
  }
  for (const u of check.people) {
    stmts.push(enqueueIfStmt(db, u.user_id, msg(
      `🎄 <b>Жеребьёвка в эвенте ${q(ev)} проведена!</b>\n\nОткрой приложение и загляни во вкладку «Подопечный», чтобы узнать, кому ты даришь подарок. Никому не рассказывай 🤫`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Узнать подопечного', { event: ev.id })]] } }
    ), guard, ev.id, token));
  }
  stmts.push(auditIfStmt(db, ev.id, actor, action, `участников: ${check.people.length}`, guard, ev.id, token));
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) return { ok: false, error: 'Жеребьёвка уже проведена.' };
  return { ok: true, count: check.people.length, singleCycle: check.res.singleCycle };
}

// Последнее изменение письма или адреса подопечного (008) — с него Санте приходят уведомления
const lastUpdate = (m) => Math.max(m?.wishlist_updated_at || 0, m?.delivery_updated_at || 0);

function pairsToMap(rows) {
  return new Map(rows.map((p) => [p.santa, p.ward]));
}

// Применяем изменённое распределение эвента: переписываем только изменившиеся пары.
async function applyPairsChange(env, ev, oldRows, newMap, changed, members) {
  const db = env.DB;
  const settings = await getSettings(db);
  const oldMap = pairsToMap(oldRows);
  const byId = Object.fromEntries(members.map((u) => [u.user_id, u]));
  const stmts = [];
  for (const santa of oldMap.keys()) {
    if (!newMap.has(santa)) stmts.push(db.prepare('DELETE FROM pairs WHERE event_id = ? AND santa = ?').bind(ev.id, santa));
  }
  // Переписка исчезнувших пар удаляется: новая пара начинает разговор с чистого листа (003, FR-308)
  for (const [santa, ward] of oldMap) {
    if (newMap.get(santa) !== ward) {
      stmts.push(db.prepare('DELETE FROM messages WHERE event_id = ? AND santa = ? AND ward = ?').bind(ev.id, santa, ward));
    }
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward && oldMap.has(santa)) {
      stmts.push(db.prepare('DELETE FROM pairs WHERE event_id = ? AND santa = ?').bind(ev.id, santa));
    }
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward) {
      stmts.push(
        db.prepare('INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) VALUES (?, ?, ?, NULL, ?, 0)')
          .bind(ev.id, santa, ward, lastUpdate(byId[ward]))
      );
    }
  }
  for (const santa of changed) {
    const isNew = !oldMap.has(santa);
    stmts.push(enqueueStmt(db, santa, msg(
      isNew
        ? `🎄 <b>Ты в игре!</b> Жеребьёвка эвента ${q(ev)} для тебя проведена — загляни во вкладку «Подопечный» 🤫`
        : `🔄 Состав эвента ${q(ev)} изменился, и у тебя теперь <b>новый подопечный</b>. Загляни во вкладку «Подопечный».`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Посмотреть', { event: ev.id })]] } }
    )));
  }
  return stmts;
}

// Убрать человека из эвента (после жеребьёвки — с минимальной перестройкой пар)
export async function removeMember(env, ev, userId, { notify = true, actor = 0 } = {}) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  const target = members.find((m) => m.user_id === userId);
  if (!target) return { ok: false, error: 'Человек не участвует в этом эвенте.' };
  const stmts = [];
  if (ev.draw_done) {
    const rows = await getPairs(db, ev.id);
    if (rows.some((p) => p.santa === userId || p.ward === userId)) {
      const isAllowed = buildIsAllowed([...(await getExclusions(db, ev.id)), ...(await familyExclusions(db, ev, members.map((m) => m.user_id)))]);
      const r = removeFromAssignment(pairsToMap(rows), userId, isAllowed, Math.random, { ring: !!ev.ring });
      if (!r) {
        return { ok: false, error: 'Не получается убрать участника, не нарушив исключения или кольцевую жеребьёвку. Ослабь исключения.' };
      }
      stmts.push(...(await applyPairsChange(env, ev, rows, r.pairs, r.changed, members)));
    }
  }
  stmts.push(db.prepare('DELETE FROM exclusions WHERE event_id = ? AND (giver = ? OR receiver = ?)').bind(ev.id, userId, userId));
  stmts.push(db.prepare('DELETE FROM messages WHERE event_id = ? AND (santa = ? OR ward = ?)').bind(ev.id, userId, userId));
  stmts.push(db.prepare('DELETE FROM members WHERE event_id = ? AND user_id = ?').bind(ev.id, userId));
  if (notify) stmts.push(enqueueStmt(db, userId, msg(`Организатор удалил тебя из эвента ${q(ev)}. Если это ошибка — напиши ему.`)));
  stmts.push(auditStmt(db, ev.id, actor, 'member.remove', displayName(target)));
  await db.batch(stmts);
  return { ok: true };
}

export async function insertMember(env, ev, userId, actor = 0) {
  const db = env.DB;
  if (!ev.draw_done) return { ok: false, error: 'Жеребьёвка ещё не проведена.' };
  const members = await eventMembers(db, ev.id);
  const u = members.find((x) => x.user_id === userId);
  if (!u || !u.registered) return { ok: false, error: 'Участник не найден.' };
  const rows = await getPairs(db, ev.id);
  if (rows.some((p) => p.santa === userId)) return { ok: false, error: 'Участник уже в жеребьёвке.' };
  const ex = [...(await getExclusions(db, ev.id)), ...(await familyExclusions(db, ev, members.map((m) => m.user_id)))];
  const r = insertIntoAssignment(pairsToMap(rows), userId, buildIsAllowed(ex), Math.random, { ring: !!ev.ring });
  if (!r) return { ok: false, error: 'Не получается вписать участника, не нарушив исключения.' };
  await db.batch([
    ...(await applyPairsChange(env, ev, rows, r.pairs, r.changed, members)),
    auditStmt(db, ev.id, actor, 'member.insert', displayName(u)),
  ]);
  return { ok: true };
}

// ---------- отмена жеребьёвки (007) ----------

// Можно ли отменить жеребьёвку (FR-708): никто не открыл подопечного и переписки нет
const CANCEL_COND =
  'NOT EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND seen_text IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM messages WHERE event_id = ?)';

export async function drawCancelable(db, ev) {
  if (!ev.draw_done || ev.revealed || isFinished(ev)) return false;
  const r = await db.prepare(`SELECT ${CANCEL_COND} AS ok`).bind(ev.id, ev.id).first();
  return !!r?.ok;
}

// Отмена жеребьёвки атомарно (research R3): если кто-то открыл подопечного между проверкой и batch — ничего не меняется
export async function cancelDraw(env, ev, actor) {
  const db = env.DB;
  if (isFinished(ev)) return { ok: false, error: 'Эвент завершён — отменить жеребьёвку нельзя.' };
  if (!ev.draw_done) return { ok: false, error: 'Жеребьёвка не проведена.' };
  if (ev.revealed) return { ok: false, error: 'Тайна уже раскрыта — отменить жеребьёвку нельзя.' };
  const [settings, rows] = await Promise.all([getSettings(db), getPairs(db, ev.id)]);
  const token = 'cancel:' + randomCode(12);
  const guard = 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0 AND draw_token = ?)';
  const stmts = [
    db.prepare(
      `UPDATE events SET draw_done = 0, draw_at = 0, draw_token = ?, registration_open = 1, draw_auto_date = ''
        WHERE id = ? AND draw_done = 1 AND draw_token = ? AND revealed = 0 AND status = 'active' AND ${CANCEL_COND}`
    ).bind(token, ev.id, ev.draw_token, ev.id, ev.id),
    db.prepare(`DELETE FROM pairs WHERE event_id = ? AND ${guard}`).bind(ev.id, ev.id, token),
    ...rows.map((p) => enqueueIfStmt(db, p.santa, msg(
      `↩️ Организатор <b>отменил жеребьёвку</b> в эвенте ${q(ev)}. Твоё письмо Санте сохранено. Когда будет новая жеребьёвка, бот напишет.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть', { event: ev.id })]] } }
    ), guard, ev.id, token)),
    auditIfStmt(db, ev.id, actor, 'draw.cancel', `пар удалено: ${rows.length}`, guard, ev.id, token),
  ];
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) return { ok: false, error: 'Отменить нельзя: кто-то уже открыл подопечного или началась переписка.' };
  return { ok: true, count: rows.length };
}

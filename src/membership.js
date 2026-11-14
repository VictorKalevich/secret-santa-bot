// Участие в эвентах (008): семьи — постоянные группы исключений, заявки на вступление с одобрением.

import {
  getEvent, addMemberStmt, enqueueStmt, enqueueIfStmt, auditStmt, auditIfStmt, clearRemovedStmt, isRemoved,
  memberDataDeleteStmts,
} from './db.js';
import { msg, q, escapeHtml, openAppButton, appKeyboard, displayName, adminRecipients, oneLine } from './format.js';
import { isFinished } from './status.js';
import { atomic } from './claim.js';

// ---------- семьи ----------

const FAMILY_MAX = 20;

// Состав семьи меняет исключения во всех идущих эвентах, где есть двое её членов. После жеребьёвки это позволило бы
// вычислить пары по заменам (009, FR-902), поэтому членство людей такого эвента заморожено до его завершения.
// changed — люди, чьё членство меняется; family — все члены семьи до и после изменения.
async function frozenFamilyEvent(db, changed, family) {
  if (!changed.length) return null;
  const list = (a) => a.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT e.title FROM events e
        WHERE e.status = 'active' AND e.draw_done = 1 AND e.families_on = 1
          AND EXISTS (SELECT 1 FROM members m WHERE m.event_id = e.id AND m.user_id IN (${list(changed)}))
          AND (SELECT COUNT(*) FROM members m WHERE m.event_id = e.id AND m.user_id IN (${list(family)})) >= 2
        LIMIT 1`
    )
    .bind(...changed, ...family)
    .first();
}

const familyFrozen = (ev) =>
  `Состав семьи нельзя менять, пока идёт событие «${ev.title}» с проведённой жеребьёвкой: иначе по заменам участников ` +
  'можно было бы вычислить пары. Изменения — после его завершения.';

async function familyMembers(db, familyId) {
  const { results } = await db.prepare('SELECT user_id FROM family_members WHERE family_id = ?').bind(familyId).all();
  return results.map((r) => r.user_id);
}

// Действует владелец бота — заморозка против вычисления пар на него не распространяется (010, FR-1008)
export async function saveFamily(ctx, actor, { id = 0, name, members }) {
  const db = ctx.db;
  const clean = oneLine(name);
  if (!clean || clean.length > 40) return { ok: false, error: 'Название семьи — от 1 до 40 символов.' };
  const ids = [...new Set((Array.isArray(members) ? members : []).map(Number).filter(Boolean))];
  if (ids.length < 2 || ids.length > FAMILY_MAX) return { ok: false, error: `В семье должно быть от 2 до ${FAMILY_MAX} человек.` };
  id = Number(id) || 0;
  if (id && !(await db.prepare('SELECT id FROM families WHERE id = ?').bind(id).first())) return { ok: false, error: 'Семья не найдена.' };
  const users = await ctx.users();
  const byId = Object.fromEntries(users.map((u) => [u.tg_id, u]));
  for (const uid of ids) if (!byId[uid]?.registered) return { ok: false, error: 'Участник не найден.' };
  // Один человек — одна семья (FR-805)
  const { results: taken } = await db
    .prepare(`SELECT fm.user_id, f.name FROM family_members fm JOIN families f ON f.id = fm.family_id
               WHERE fm.family_id != ? AND fm.user_id IN (${ids.map(() => '?').join(',')})`)
    .bind(id, ...ids)
    .all();
  if (taken.length) return { ok: false, error: `${displayName(byId[taken[0].user_id])} уже в семье «${taken[0].name}».` };
  // Переименование без смены состава разрешено всегда
  const before = id ? await familyMembers(db, id) : [];
  const changed = [...ids.filter((x) => !before.includes(x)), ...before.filter((x) => !ids.includes(x))];
  const frozen = (await ctx.isOwner()) ? null : await frozenFamilyEvent(db, changed, [...new Set([...before, ...ids])]);
  if (frozen) return { ok: false, error: familyFrozen(frozen) };
  const now = Date.now();
  // Новая семья в остальных операторах batch — по автору и времени создания
  const famId = id ? '?' : '(SELECT MAX(id) FROM families WHERE created_by = ? AND created_at = ?)';
  const famArgs = id ? [id] : [actor, now];
  const stmts = id
    ? [db.prepare('UPDATE families SET name = ? WHERE id = ?').bind(clean, id), db.prepare('DELETE FROM family_members WHERE family_id = ?').bind(id)]
    : [db.prepare('INSERT INTO families (name, created_by, created_at) VALUES (?, ?, ?)').bind(clean, actor, now)];
  for (const uid of ids) stmts.push(db.prepare(`INSERT INTO family_members (user_id, family_id) VALUES (?, ${famId})`).bind(uid, ...famArgs));
  stmts.push(auditStmt(db, 0, actor, 'family.save', `«${clean}»: ${ids.map((x) => displayName(byId[x])).join(', ')}`));
  await db.batch(stmts);
  return { ok: true };
}

export async function deleteFamily(ctx, actor, id) {
  const db = ctx.db;
  const fam = await db.prepare('SELECT * FROM families WHERE id = ?').bind(Number(id) || 0).first();
  if (!fam) return { ok: false, error: 'Семья не найдена.' };
  const all = await familyMembers(db, fam.id);
  const frozen = (await ctx.isOwner()) ? null : await frozenFamilyEvent(db, all, all);
  if (frozen) return { ok: false, error: familyFrozen(frozen) };
  await db.batch([
    db.prepare('DELETE FROM family_members WHERE family_id = ?').bind(fam.id),
    db.prepare('DELETE FROM families WHERE id = ?').bind(fam.id),
    auditStmt(db, 0, actor, 'family.delete', `«${fam.name}»`),
  ]);
  return { ok: true };
}

// admin.families: семьи — общие для бота; адресов и пар здесь нет
export async function familiesList(ctx) {
  const db = ctx.db;
  const [users, fams, rows] = await Promise.all([
    ctx.users(),
    db.prepare('SELECT id, name FROM families ORDER BY name').all().then((r) => r.results),
    db.prepare('SELECT user_id, family_id FROM family_members').all().then((r) => r.results),
  ]);
  const famOf = Object.fromEntries(rows.map((r) => [r.user_id, r.family_id]));
  const reg = users.filter((u) => u.registered);
  return {
    families: fams.map((f) => ({ id: f.id, name: f.name, members: reg.filter((u) => famOf[u.tg_id] === f.id).map((u) => ({ id: u.tg_id, name: u.name })) })),
    users: reg.map((u) => ({ id: u.tg_id, name: u.name, family_id: famOf[u.tg_id] || 0 })),
  };
}

// ---------- участие админа и возврат удалённых (019: из api.js) ----------

const AFTER_DRAW = 'После жеребьёвки так нельзя. Попроси владельца бота вписать тебя.';

// «Я участвую» админа: вход и выход — только до жеребьёвки (вписывает после неё только владелец, 012)
export async function participate(ctx, ev, on, actor) {
  const db = ctx.db;
  if (ev.draw_done) return { ok: false, error: AFTER_DRAW };
  if (on) {
    await db.batch([
      addMemberStmt(db, ev, actor), clearRemovedStmt(db, ev.id, actor),
      auditStmt(db, ev.id, actor, 'participate', 'участвует'),
    ]);
    return { ok: true };
  }
  // Выход — только пока жеребьёвка не проведена, проверено в момент записи (018): иначе одновременная жеребьёвка
  // оставила бы в парах человека вне события. Данные участия (исключения, закреплённые пары, обращения) — по
  // списку REGISTRY; исход — по записи журнала под тем же условием (не участник тоже получает успешный ответ).
  const beforeDraw = 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0)';
  const [log] = await db.batch([
    auditIfStmt(db, ev.id, actor, 'participate', 'не участвует', beforeDraw, ev.id),
    ...memberDataDeleteStmts(db, ev.id, actor, beforeDraw, ev.id),
  ]);
  return log.meta.changes ? { ok: true } : { ok: false, error: AFTER_DRAW };
}

// Разрешить удалённому организатором вернуться по ссылке (010)
export async function allowRemoved(ctx, ev, rawId, actor) {
  const db = ctx.db;
  const id = Number(rawId) || 0;
  const row = await db.prepare('SELECT 1 FROM removed_members WHERE event_id = ? AND user_id = ?').bind(ev.id, id).first();
  if (!row) return { ok: false, error: 'Этого человека нет среди удалённых.' };
  const users = await ctx.users();
  await db.batch([clearRemovedStmt(db, ev.id, id), auditStmt(db, ev.id, actor, 'member.allow', displayName(users.find((u) => u.tg_id === id)))]);
  return { ok: true };
}

// ---------- вступление по пригласительной ссылке ----------

// После отказа новая заявка в тот же эвент — не раньше чем через сутки: иначе админов можно засыпать заявками (009, FR-924)
const REJECT_PAUSE_MS = 24 * 3600 * 1000;

// Удалённый организатором при запрете возврата (010, FR-1022) не вступает и не подаёт заявку по ссылке
export async function rejoinBlocked(db, ev, userId) {
  return !ev.rejoin && (await isRemoved(db, ev.id, userId));
}

// Вступление зарегистрированного человека, который ещё не участник эвента (009, FR-920) — единая логика для ссылки и
// для ввода имени после неё.
// Отказ по заявке (008): ответ боту и сообщение участнику — один текст (019)
export const requestRejected = (ev) => `Организатор не одобрил заявку на участие в событии ${q(ev)}. Если это ошибка — напиши ему.`;

// Админам (кроме самого человека) — «… присоединяется к событию»: вступление по ссылке и ввод имени в боте (019)
export function joinedNoticeStmts(db, users, user, ev) {
  return adminRecipients(users, [user.tg_id]).map((a) => enqueueStmt(db, a.tg_id, msg(
    `👋 <b>${escapeHtml(displayName(user))}</b> присоединяется к событию ${q(ev)}`, { disable_notification: true }
  )));
}

// Результат: 'joined' | 'closed' | 'removed' | 'request_sent' | 'request_pending' | 'request_rejected'.
export async function joinByInvite(ctx, ev, user) {
  const db = ctx.db;
  if (isFinished(ev) || !ev.registration_open) return 'closed';
  if (await rejoinBlocked(db, ev, user.tg_id)) return 'removed';
  // 008: эвент с одобрением — вместо участия заявка (админы вступают сами)
  if (ev.approval && !user.is_admin) return requestJoin(ctx, ev, user);
  const users = await ctx.users();
  await db.batch([
    addMemberStmt(db, ev, user.tg_id),
    clearRemovedStmt(db, ev.id, user.tg_id), // вернулся — больше не в списке удалённых (010)
    ...joinedNoticeStmts(db, users, user, ev),
  ]);
  return 'joined';
}

// Заявка человека в эвент с одобрением; админам — сообщение с кнопками.
async function requestJoin(ctx, ev, user) {
  const db = ctx.db;
  const now = Date.now();
  const rejected = await db
    .prepare("SELECT 1 FROM join_requests WHERE event_id = ? AND user_id = ? AND status = 'rejected' AND decided_at > ? LIMIT 1")
    .bind(ev.id, user.tg_id, now - REJECT_PAUSE_MS)
    .first();
  if (rejected) return 'request_rejected';
  const row = await db
    .prepare("INSERT OR IGNORE INTO join_requests (event_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?) RETURNING id")
    .bind(ev.id, user.tg_id, now)
    .first();
  if (!row) return 'request_pending';
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const admins = adminRecipients(users, [user.tg_id]);
  if (admins.length) {
    await db.batch(admins.map((a) => enqueueStmt(db, a.tg_id, msg(
      `🙋 <b>${escapeHtml(displayName(user))}</b>${user.username ? ' (@' + escapeHtml(user.username) + ')' : ''} хочет участвовать в событии ${q(ev)}.`,
      { reply_markup: { inline_keyboard: [
        [{ text: '✅ Принять', callback_data: `req:${row.id}:a` }, { text: '❌ Отклонить', callback_data: `req:${row.id}:r` }],
        [openAppButton(settings, '🛠 Открыть событие', { event: ev.id })],
      ] } }
    ))));
  }
  return 'request_sent';
}

// Решение по заявке — один раз (research R4): повторное нажатие или второй админ ничего не меняют
// inEvent — решение из панели события: заявка должна быть заявкой этого события
export async function decideRequest(ctx, id, actor, approve, { inEvent = null } = {}) {
  const db = ctx.db;
  const req = await db.prepare('SELECT * FROM join_requests WHERE id = ?').bind(Number(id) || 0).first();
  if (!req || (inEvent && req.event_id !== inEvent.id)) return { ok: false, error: 'Заявка не найдена.' };
  if (req.status !== 'pending') return { ok: false, error: 'Заявка уже рассмотрена.' };
  const ev = await getEvent(db, req.event_id);
  if (!ev) return { ok: false, error: 'Событие не найдено.' };
  if (approve && isFinished(ev)) return { ok: false, error: 'Событие завершено — принять в него уже нельзя.' };
  // Закрытая регистрация — значит никто (010, FR-1016): заявка ждёт открытия, отклонить можно
  const closed = `Регистрация на событие «${ev.title}» закрыта — открой её, чтобы принять заявку.`;
  if (approve && !ev.registration_open) return { ok: false, error: closed };
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const person = users.find((u) => u.tg_id === req.user_id);
  const by = users.find((u) => u.tg_id === actor);
  const status = approve ? 'approved' : 'rejected';
  // По прежнему состоянию (020): участие, сообщения и журнал — пока заявка ждёт решения, а чтобы принять, — ещё и пока
  // регистрация открыта и событие идёт (её могли закрыть в эту же секунду); само решение — последним, с тем же условием.
  // Второй вызов (даже того же админа в ту же миллисекунду) видит заявку уже рассмотренной и ничего не рассылает.
  const pending = atomic(db, "EXISTS (SELECT 1 FROM join_requests WHERE id = ? AND status = 'pending')", req.id);
  const p = approve ? pending.and("EXISTS (SELECT 1 FROM events WHERE id = ? AND registration_open = 1 AND status = 'active')", ev.id) : pending;
  if (approve) p.add(addMemberStmt(db, ev, req.user_id, ...p.guard), clearRemovedStmt(db, ev.id, req.user_id, ...p.guard));
  p.enqueue(req.user_id, approve
    ? msg(
      ev.draw_done
        ? `🎉 Заявка одобрена — ты в событии ${q(ev)}! Жеребьёвка уже прошла — организатор впишет тебя, бот пришлёт уведомление. А пока напиши письмо Санте.`
        : `🎉 Заявка одобрена — ты в событии ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`,
      appKeyboard(settings, '✏️ Написать письмо', { event: ev.id }))
    : msg(requestRejected(ev)));
  for (const a of adminRecipients(users, [actor, req.user_id])) {
    p.enqueue(a.tg_id, msg(
      `${approve ? '✅' : '❌'} <b>${escapeHtml(displayName(by))}</b> ${approve ? 'принял(а)' : 'отклонил(а)'} заявку <b>${escapeHtml(displayName(person))}</b> на участие в событии ${q(ev)}.`,
      { disable_notification: true }
    ));
  }
  p.audit(ev.id, actor, approve ? 'request.approve' : 'request.reject', displayName(person));
  p.claim(p.where('UPDATE join_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?', status, actor, Date.now(), req.id));
  if (!(await p.run()).won) {
    const cur = approve ? await getEvent(db, ev.id) : null;
    return { ok: false, error: cur && !cur.registration_open ? closed : 'Заявка уже рассмотрена.' };
  }
  return { ok: true, ev, name: displayName(person) };
}

// Участие в эвентах (008): заявки на вступление с одобрением. 050: человек, которого бот принял по ссылке события, — человек
// компании события (joinCompanyStmt в том же пакете, что вступление или заявка).

import {
  getEvent, addMemberStmt, enqueueStmt, auditStmt, clearRemovedStmt, isRemoved, joinCompanyStmt,
  memberDataDeleteStmts, eventQuery, memberQuery,
} from './db.js';
import {
  msg, q, escapeHtml, openAppButton, appKeyboard, displayName, adminRecipients, NOT_MEMBER, ADMIN_ONLY,
} from './format.js';
import { tx } from './i18n/index.js';
import { isFinished } from './status.js';
import { atomic } from './claim.js';
import { no } from './result.js';

// ---------- участие админа и возврат удалённых (019: из api.js) ----------

// 051: в компании с назначенным владельцем — «владельца», в компании владельца бота — прежний текст (ownerWord)
const AFTER_DRAW = (w) => tx('membership.afterDraw', { owner: w });

// «Я участвую» админа: вход и выход — только до жеребьёвки (вписывает после неё только владелец, 012)
export async function participate(ctx, ev, on, actor) {
  const db = ctx.db;
  if (ev.draw_done) return no(AFTER_DRAW(ctx.ownerWord()));
  if (on) {
    await db.batch([
      joinCompanyStmt(db, ev.company_id, actor), addMemberStmt(db, ev, actor), clearRemovedStmt(db, ev.id, actor),
      auditStmt(db, ev.id, actor, 'participate', tx('membership.audit.isParticipant')),
    ]);
    return { ok: true };
  }
  // Выход — только пока жеребьёвка не проведена, проверено в момент записи (018): иначе одновременная жеребьёвка
  // оставила бы в парах человека вне события. Данные участия (исключения, закреплённые пары, обращения) — по
  // списку REGISTRY; исход — по записи журнала под тем же условием (не участник тоже получает успешный ответ).
  const beforeDraw = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0)', ev.id);
  beforeDraw.claim(beforeDraw.audit(ev.id, actor, 'participate', tx('membership.audit.notParticipant')));
  beforeDraw.add(...memberDataDeleteStmts(db, ev.id, actor, ...beforeDraw.guard));
  return (await beforeDraw.run()).won ? { ok: true } : no(AFTER_DRAW(ctx.ownerWord()));
}

const LEAVE_AFTER_DRAW = tx('membership.leaveAfterDraw');
// Ключ словаря: отказ «завершено» у event.leave (поле finished таблицы действий) и проигравшему выходу
export const LEAVE_FINISHED = 'membership.leaveFinished';

const OPEN_EVENT = tx('membership.openEventButton');

// Выход участника из эвента (035): только до жеребьёвки и пока эвент идёт — проверено в момент записи, как выход админа
// (018). По прежнему состоянию (020): сообщения организаторам и журнал — перед захватом, пока человек ещё участник;
// данные участия — по списку REGISTRY, строка участника — последней (захват). Отметку «удалён» не ставим: вернуться можно
// по ссылке. Второй из одновременных выходов видит, что человек уже не участник, и ничего не рассылает.
export async function leaveEvent(ctx, ev) {
  const { db, me } = ctx;
  if (ev.draw_done) return no(LEAVE_AFTER_DRAW);
  const { users, settings } = await ctx.read({ users: true, settings: true });
  const going = atomic(db, "EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0 AND status = 'active')", ev.id)
    .and('EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)', ev.id, me.tg_id);
  for (const a of adminRecipients(users, [me.tg_id])) {
    going.enqueue(a.tg_id, msg(tx('membership.leaveNotice', { name: escapeHtml(displayName(me)), title: q(ev) }),
      appKeyboard(settings, OPEN_EVENT, { event: ev.id })));
  }
  going.audit(ev.id, me.tg_id, 'member.leave', displayName(me));
  going.claim(going.add(...memberDataDeleteStmts(db, ev.id, me.tg_id, ...going.guard)));
  if ((await going.run()).won) return { ok: true };
  const r = await ctx.read({ ev: eventQuery(db, ev.id), member: memberQuery(db, ev.id, me.tg_id) });
  const [cur] = r.ev;
  if (!cur || !r.member.length) return no(NOT_MEMBER, 403);
  return no(isFinished(cur) ? tx(LEAVE_FINISHED) : LEAVE_AFTER_DRAW);
}

// Разрешить удалённому организатором вернуться по ссылке (010)
export async function allowRemoved(ctx, ev, rawId, actor) {
  const db = ctx.db;
  const id = Number(rawId) || 0;
  const row = await db.prepare('SELECT 1 FROM removed_members WHERE event_id = ? AND user_id = ?').bind(ev.id, id).first();
  if (!row) return no(tx('membership.notRemoved'));
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
export const requestRejected = (ev) => tx('membership.requestRejected', { title: q(ev) });

// Админам (кроме самого человека) — «… присоединяется к событию»: вступление по ссылке и регистрация в боте (019, 047)
const joinedNotice = (user, ev) =>
  msg(tx('membership.joinedNotice', { name: escapeHtml(displayName(user)), title: q(ev) }), { disable_notification: true });

function joinedNoticeStmts(db, users, user, ev) {
  return adminRecipients(users, [user.tg_id]).map((a) => enqueueStmt(db, a.tg_id, joinedNotice(user, ev)));
}

// Регистрация в боте (047): имя — текстом или кнопкой «Участвовать как …». По прежнему состоянию (020): «присоединяется»
// (если человек уже участник ev — вступил по ссылке до имени) — перед захватом, пока он не зарегистрирован; захват —
// строка пользователя. Второе нажатие или сообщение (даже в ту же миллисекунду) видит имя сохранённым и ничего не
// рассылает. → true, если имя записал этот вызов
export async function register(ctx, name, username, ev = null) {
  const { db, me } = ctx;
  const fresh = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND registered = 0)', me.tg_id);
  if (ev) {
    fresh.add(joinCompanyStmt(db, ev.company_id, me.tg_id, ...fresh.guard));
    const member = fresh.and('EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)', ev.id, me.tg_id);
    for (const a of adminRecipients(await ctx.users(), [me.tg_id])) member.enqueue(a.tg_id, joinedNotice({ ...me, name }, ev));
  }
  fresh.claim(fresh.where("UPDATE users SET name = ?, username = ?, registered = 1, pending = '' WHERE tg_id = ?", name, username, me.tg_id));
  return (await fresh.run()).won;
}

// Результат: 'joined' | 'closed' | 'removed' | 'request_sent' | 'request_pending' | 'request_rejected'.
export async function joinByInvite(ctx, ev, user) {
  const db = ctx.db;
  if (isFinished(ev) || !ev.registration_open) return 'closed';
  if (await rejoinBlocked(db, ev, user.tg_id)) return 'removed';
  // 008: эвент с одобрением — вместо участия заявка (организаторы компании события вступают сами, 050)
  if (ev.approval && !ctx.me.is_admin) return requestJoin(ctx, ev, user);
  const users = await ctx.users();
  await db.batch([
    joinCompanyStmt(db, ev.company_id, user.tg_id),
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
  // Заявка и строка человека компании — одним пакетом (050)
  const [, inserted] = await db.batch([
    joinCompanyStmt(db, ev.company_id, user.tg_id),
    db.prepare("INSERT OR IGNORE INTO join_requests (event_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?) RETURNING id")
      .bind(ev.id, user.tg_id, now),
  ]);
  const row = inserted.results?.[0];
  if (!row) return 'request_pending';
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const admins = adminRecipients(users, [user.tg_id]);
  if (admins.length) {
    const name = escapeHtml(displayName(user));
    const text = user.username
      ? tx('membership.requestWithUsername', { name, username: escapeHtml(user.username), title: q(ev) })
      : tx('membership.request', { name, title: q(ev) });
    await db.batch(admins.map((a) => enqueueStmt(db, a.tg_id, msg(
      text,
      { reply_markup: { inline_keyboard: [
        [{ text: tx('membership.acceptButton'), callback_data: `req:${row.id}:a` }, { text: tx('membership.rejectButton'), callback_data: `req:${row.id}:r` }],
        [openAppButton(settings, OPEN_EVENT, { event: ev.id })],
      ] } }
    ))));
  }
  return 'request_sent';
}

const DECIDED = tx('membership.requestDecided');

// Решение по заявке — один раз (research R4): повторное нажатие или второй админ ничего не меняют
// inEvent — решение из панели события: заявка должна быть заявкой этого события. Решает организатор компании события
// (050: кнопка в чате — сначала общий признак у бота, здесь — права в компании; отказ тот же)
export async function decideRequest(ctx, id, actor, approve, { inEvent = null } = {}) {
  const db = ctx.db;
  const req = await db
    .prepare('SELECT r.*, e.company_id FROM join_requests r LEFT JOIN events e ON e.id = r.event_id WHERE r.id = ?')
    .bind(Number(id) || 0)
    .first();
  if (!req || (inEvent && req.event_id !== inEvent.id)) return no(tx('membership.requestNotFound'));
  if (req.company_id !== null) {
    ctx = await ctx.in(req.company_id);
    if (!ctx?.me?.is_admin) return no(ADMIN_ONLY);
  }
  if (req.status !== 'pending') return no(DECIDED);
  const ev = await getEvent(db, req.event_id);
  if (!ev) return no(tx('api.noEvent'));
  if (approve && isFinished(ev)) return no(tx('membership.approveFinished'));
  // Закрытая регистрация — значит никто (010, FR-1016): заявка ждёт открытия, отклонить можно
  const closed = tx('membership.approveClosed', { title: ev.title });
  if (approve && !ev.registration_open) return no(closed);
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const person = users.find((u) => u.tg_id === req.user_id);
  const by = users.find((u) => u.tg_id === actor);
  const status = approve ? 'approved' : 'rejected';
  // По прежнему состоянию (020): участие, сообщения и журнал — пока заявка ждёт решения, а чтобы принять, — ещё и пока
  // регистрация открыта и событие идёт (её могли закрыть в эту же секунду); само решение — последним, с тем же условием.
  // Второй вызов (даже того же админа в ту же миллисекунду) видит заявку уже рассмотренной и ничего не рассылает.
  const pending = atomic(db, "EXISTS (SELECT 1 FROM join_requests WHERE id = ? AND status = 'pending')", req.id);
  const p = approve ? pending.and("EXISTS (SELECT 1 FROM events WHERE id = ? AND registration_open = 1 AND status = 'active')", ev.id) : pending;
  if (approve) {
    p.add(joinCompanyStmt(db, ev.company_id, req.user_id, ...p.guard), addMemberStmt(db, ev, req.user_id, ...p.guard),
      clearRemovedStmt(db, ev.id, req.user_id, ...p.guard));
  }
  p.enqueue(req.user_id, approve
    ? msg(
      ev.draw_done
        ? tx('membership.approvedAfterDraw', { title: q(ev), owner: ctx.ownerWord() })
        : tx('membership.approved', { title: q(ev) }),
      appKeyboard(settings, tx('common.writeLetterButton'), { event: ev.id }))
    : msg(requestRejected(ev)));
  for (const a of adminRecipients(users, [actor, req.user_id])) {
    p.enqueue(a.tg_id, msg(
      tx(approve ? 'membership.approvedBy' : 'membership.rejectedBy', {
        by: escapeHtml(displayName(by)), name: escapeHtml(displayName(person)), title: q(ev),
      }),
      { disable_notification: true }
    ));
  }
  p.audit(ev.id, actor, approve ? 'request.approve' : 'request.reject', displayName(person));
  p.claim(p.where('UPDATE join_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?', status, actor, Date.now(), req.id));
  if (!(await p.run()).won) {
    const cur = approve ? await getEvent(db, ev.id) : null;
    return no(cur && !cur.registration_open ? closed : DECIDED);
  }
  return { ok: true, ev, name: displayName(person) };
}

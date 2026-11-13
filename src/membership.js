// Участие в эвентах (008): семьи — постоянные группы исключений, заявки на вступление с одобрением.

import {
  getSettings, allUsers, getEvent, addMemberStmt, enqueueStmt, enqueueIfStmt, auditStmt, auditIfStmt, clearRemovedStmt, isRemoved,
} from './db.js';
import { msg, q, escapeHtml, openAppButton, displayName, adminRecipients, oneLine } from './format.js';
import { isFinished } from './events.js';

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

// owner — действует владелец бота: заморозка против вычисления пар на него не распространяется (010, FR-1008)
export async function saveFamily(env, actor, { id = 0, name, members }, { owner = false } = {}) {
  const db = env.DB;
  const clean = oneLine(name);
  if (!clean || clean.length > 40) return { ok: false, error: 'Название семьи — от 1 до 40 символов.' };
  const ids = [...new Set((Array.isArray(members) ? members : []).map(Number).filter(Boolean))];
  if (ids.length < 2 || ids.length > FAMILY_MAX) return { ok: false, error: `В семье должно быть от 2 до ${FAMILY_MAX} человек.` };
  id = Number(id) || 0;
  if (id && !(await db.prepare('SELECT id FROM families WHERE id = ?').bind(id).first())) return { ok: false, error: 'Семья не найдена.' };
  const users = await allUsers(db);
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
  const frozen = owner ? null : await frozenFamilyEvent(db, changed, [...new Set([...before, ...ids])]);
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

export async function deleteFamily(env, actor, id, { owner = false } = {}) {
  const db = env.DB;
  const fam = await db.prepare('SELECT * FROM families WHERE id = ?').bind(Number(id) || 0).first();
  if (!fam) return { ok: false, error: 'Семья не найдена.' };
  const all = await familyMembers(db, fam.id);
  const frozen = owner ? null : await frozenFamilyEvent(db, all, all);
  if (frozen) return { ok: false, error: familyFrozen(frozen) };
  await db.batch([
    db.prepare('DELETE FROM family_members WHERE family_id = ?').bind(fam.id),
    db.prepare('DELETE FROM families WHERE id = ?').bind(fam.id),
    auditStmt(db, 0, actor, 'family.delete', `«${fam.name}»`),
  ]);
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
// Результат: 'joined' | 'closed' | 'removed' | 'request_sent' | 'request_pending' | 'request_rejected'.
export async function joinByInvite(env, ev, user) {
  const db = env.DB;
  if (isFinished(ev) || !ev.registration_open) return 'closed';
  if (await rejoinBlocked(db, ev, user.tg_id)) return 'removed';
  // 008: эвент с одобрением — вместо участия заявка (админы вступают сами)
  if (ev.approval && !user.is_admin) return requestJoin(env, ev, user);
  const users = await allUsers(db);
  await db.batch([
    addMemberStmt(db, ev, user.tg_id),
    clearRemovedStmt(db, ev.id, user.tg_id), // вернулся — больше не в списке удалённых (010)
    ...adminRecipients(users, [user.tg_id]).map((a) => enqueueStmt(db, a.tg_id, msg(
      `👋 <b>${escapeHtml(displayName(user))}</b> присоединяется к событию ${q(ev)}`, { disable_notification: true }
    ))),
  ]);
  return 'joined';
}

// Заявка человека в эвент с одобрением; админам — сообщение с кнопками.
async function requestJoin(env, ev, user) {
  const db = env.DB;
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
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
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
export async function decideRequest(env, id, actor, approve) {
  const db = env.DB;
  const req = await db.prepare('SELECT * FROM join_requests WHERE id = ?').bind(Number(id) || 0).first();
  if (!req) return { ok: false, error: 'Заявка не найдена.' };
  if (req.status !== 'pending') return { ok: false, error: 'Заявка уже рассмотрена.' };
  const ev = await getEvent(db, req.event_id);
  if (!ev) return { ok: false, error: 'Событие не найдено.' };
  if (approve && isFinished(ev)) return { ok: false, error: 'Событие завершено — принять в него уже нельзя.' };
  // Закрытая регистрация — значит никто (010, FR-1016): заявка ждёт открытия, отклонить можно
  const closed = `Регистрация на событие «${ev.title}» закрыта — открой её, чтобы принять заявку.`;
  if (approve && !ev.registration_open) return { ok: false, error: closed };
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const person = users.find((u) => u.tg_id === req.user_id);
  const by = users.find((u) => u.tg_id === actor);
  const status = approve ? 'approved' : 'rejected';
  const now = Date.now();
  const guard = 'EXISTS (SELECT 1 FROM join_requests WHERE id = ? AND status = ? AND decided_by = ? AND decided_at = ?)';
  const g = [req.id, status, actor, now];
  // Принять — только пока регистрация открыта (условие повторено в захвате: её могли закрыть в эту же секунду)
  const open = approve ? "AND EXISTS (SELECT 1 FROM events WHERE id = ? AND registration_open = 1 AND status = 'active')" : '';
  const stmts = [
    db.prepare(`UPDATE join_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending' ${open}`)
      .bind(status, actor, now, req.id, ...(approve ? [ev.id] : [])),
  ];
  if (approve) stmts.push(addMemberStmt(db, ev, req.user_id, guard, ...g), clearRemovedStmt(db, ev.id, req.user_id, guard, ...g));
  stmts.push(enqueueIfStmt(db, req.user_id, approve
    ? msg(
      ev.draw_done
        ? `🎉 Заявка одобрена — ты в событии ${q(ev)}! Жеребьёвка уже прошла — организатор впишет тебя, бот пришлёт уведомление. А пока напиши письмо Санте.`
        : `🎉 Заявка одобрена — ты в событии ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] } })
    : msg(`Организатор не одобрил заявку на участие в событии ${q(ev)}. Если это ошибка — напиши ему.`), guard, ...g));
  for (const a of adminRecipients(users, [actor, req.user_id])) {
    stmts.push(enqueueIfStmt(db, a.tg_id, msg(
      `${approve ? '✅' : '❌'} <b>${escapeHtml(displayName(by))}</b> ${approve ? 'принял(а)' : 'отклонил(а)'} заявку <b>${escapeHtml(displayName(person))}</b> на участие в событии ${q(ev)}.`,
      { disable_notification: true }
    ), guard, ...g));
  }
  stmts.push(auditIfStmt(db, ev.id, actor, approve ? 'request.approve' : 'request.reject', displayName(person), guard, ...g));
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) {
    const cur = approve ? await getEvent(db, ev.id) : null;
    return { ok: false, error: cur && !cur.registration_open ? closed : 'Заявка уже рассмотрена.' };
  }
  return { ok: true, ev, name: displayName(person) };
}

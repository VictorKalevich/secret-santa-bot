// Участие в эвентах (008): семьи — постоянные группы исключений, заявки на вступление с одобрением.

import { getSettings, allUsers, getEvent, addMemberStmt, enqueueStmt, enqueueIfStmt, auditStmt, auditIfStmt } from './db.js';
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
  `Состав семьи нельзя менять, пока идёт эвент «${ev.title}» с проведённой жеребьёвкой: иначе по заменам участников ` +
  'можно было бы вычислить пары. Изменения — после его завершения.';

async function familyMembers(db, familyId) {
  const { results } = await db.prepare('SELECT user_id FROM family_members WHERE family_id = ?').bind(familyId).all();
  return results.map((r) => r.user_id);
}

export async function saveFamily(env, actor, { id = 0, name, members }) {
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
  const frozen = await frozenFamilyEvent(db, changed, [...new Set([...before, ...ids])]);
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

export async function deleteFamily(env, actor, id) {
  const db = env.DB;
  const fam = await db.prepare('SELECT * FROM families WHERE id = ?').bind(Number(id) || 0).first();
  if (!fam) return { ok: false, error: 'Семья не найдена.' };
  const all = await familyMembers(db, fam.id);
  const frozen = await frozenFamilyEvent(db, all, all);
  if (frozen) return { ok: false, error: familyFrozen(frozen) };
  await db.batch([
    db.prepare('DELETE FROM family_members WHERE family_id = ?').bind(fam.id),
    db.prepare('DELETE FROM families WHERE id = ?').bind(fam.id),
    auditStmt(db, 0, actor, 'family.delete', `«${fam.name}»`),
  ]);
  return { ok: true };
}

// ---------- заявки на вступление ----------

// Заявка человека в эвент с одобрением; админам — сообщение с кнопками. already — заявка уже ждёт решения.
export async function requestJoin(env, ev, user) {
  const db = env.DB;
  const row = await db
    .prepare("INSERT OR IGNORE INTO join_requests (event_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?) RETURNING id")
    .bind(ev.id, user.tg_id, Date.now())
    .first();
  if (!row) return { ok: true, already: true };
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const admins = adminRecipients(users, [user.tg_id]);
  if (admins.length) {
    await db.batch(admins.map((a) => enqueueStmt(db, a.tg_id, msg(
      `🙋 <b>${escapeHtml(displayName(user))}</b>${user.username ? ' (@' + escapeHtml(user.username) + ')' : ''} просится в эвент ${q(ev)}.`,
      { reply_markup: { inline_keyboard: [
        [{ text: '✅ Принять', callback_data: `req:${row.id}:a` }, { text: '❌ Отклонить', callback_data: `req:${row.id}:r` }],
        [openAppButton(settings, '🛠 Открыть эвент', { event: ev.id })],
      ] } }
    ))));
  }
  return { ok: true, already: false, id: row.id };
}

// Решение по заявке — один раз (research R4): повторное нажатие или второй админ ничего не меняют
export async function decideRequest(env, id, actor, approve) {
  const db = env.DB;
  const req = await db.prepare('SELECT * FROM join_requests WHERE id = ?').bind(Number(id) || 0).first();
  if (!req) return { ok: false, error: 'Заявка не найдена.' };
  if (req.status !== 'pending') return { ok: false, error: 'Заявка уже рассмотрена.' };
  const ev = await getEvent(db, req.event_id);
  if (!ev) return { ok: false, error: 'Эвент не найден.' };
  if (approve && isFinished(ev)) return { ok: false, error: 'Эвент завершён — принять в него уже нельзя.' };
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const person = users.find((u) => u.tg_id === req.user_id);
  const by = users.find((u) => u.tg_id === actor);
  const status = approve ? 'approved' : 'rejected';
  const now = Date.now();
  const guard = 'EXISTS (SELECT 1 FROM join_requests WHERE id = ? AND status = ? AND decided_by = ? AND decided_at = ?)';
  const g = [req.id, status, actor, now];
  const stmts = [
    db.prepare("UPDATE join_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'").bind(status, actor, now, req.id),
  ];
  if (approve) stmts.push(addMemberStmt(db, ev, req.user_id, guard, ...g));
  stmts.push(enqueueIfStmt(db, req.user_id, approve
    ? msg(
      ev.draw_done
        ? `🎉 Тебя приняли в эвент ${q(ev)}! Жеребьёвка уже прошла — организатор впишет тебя, бот пришлёт уведомление. А пока напиши письмо Санте.`
        : `🎉 Тебя приняли в эвент ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] } })
    : msg(`Организатор не одобрил заявку в эвент ${q(ev)}. Если это ошибка — напиши ему.`), guard, ...g));
  for (const a of adminRecipients(users, [actor, req.user_id])) {
    stmts.push(enqueueIfStmt(db, a.tg_id, msg(
      `${approve ? '✅' : '❌'} <b>${escapeHtml(displayName(by))}</b> ${approve ? 'принял(а)' : 'отклонил(а)'} заявку <b>${escapeHtml(displayName(person))}</b> в эвент ${q(ev)}.`,
      { disable_notification: true }
    ), guard, ...g));
  }
  stmts.push(auditIfStmt(db, ev.id, actor, approve ? 'request.approve' : 'request.reject', displayName(person), guard, ...g));
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) return { ok: false, error: 'Заявка уже рассмотрена.' };
  return { ok: true, ev, name: displayName(person) };
}

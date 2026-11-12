// Жизненный цикл эвента: создание, завершение, удаление, сброс, приглашения, раскрытие тайны, напоминания, объявления.

import {
  getSettings, eventMembers, drawParticipants, getPairs, allUsers, enqueueStmt, updateEventStmt, auditStmt,
} from './db.js';
import { msg, q, escapeHtml, formatDate, formatMs, openAppButton, inviteLink, randomCode, oneLine, cleanText } from './format.js';

// Переписка завершённого эвента открыта ещё 7 суток (005, FR-506)
const CHAT_GRACE_MS = 7 * 24 * 3600 * 1000;

export const isFinished = (ev) => ev.status === 'finished';
export const chatUntil = (ev) => (isFinished(ev) ? ev.finished_at + CHAT_GRACE_MS : 0);
export const chatWritable = (ev, now = Date.now()) => !isFinished(ev) || now < chatUntil(ev);

// from — эвент-образец (007, FR-706): копируются параметры и исключения, даты — нет.
// invite — разослать участникам образца приглашение в новый эвент.
export async function createEvent(env, title, createdBy, { from = null, invite = false } = {}) {
  const db = env.DB;
  const clean = oneLine(title);
  if (!clean || clean.length > 80) return { ok: false, error: 'Название эвента — от 1 до 80 символов.' };
  const code = randomCode();
  const t = from || { budget: '', place: '', notes: '', ring: 1, avoid_previous: 1, reveal_auto: 0, finish_auto: 0, delivery_on: 0, families_on: 1, approval: 0 };
  // Новый эвент в остальных операторах batch находим по уникальному коду приглашения
  const newId = '(SELECT id FROM events WHERE invite_code = ?)';
  const stmts = [
    db.prepare(
      `INSERT INTO events (title, created_at, created_by, invite_code, budget, place, notes, ring, avoid_previous, reveal_auto, finish_auto,
                           delivery_on, families_on, approval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(clean, Date.now(), createdBy, code, t.budget, t.place, t.notes, t.ring, t.avoid_previous, t.reveal_auto, t.finish_auto,
      t.delivery_on, t.families_on, t.approval),
  ];
  if (from) {
    stmts.push(db.prepare(`INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) SELECT ${newId}, giver, receiver FROM exclusions WHERE event_id = ?`)
      .bind(code, from.id));
  }
  stmts.push(db.prepare(`INSERT INTO audit (event_id, actor, action, details, created_at) VALUES (${newId}, ?, 'event.create', ?, ?)`)
    .bind(code, createdBy, from ? `по образцу «${from.title}»` : '', Date.now()));
  const [ins] = await db.batch(stmts);
  const row = ins.results[0];
  let invited = 0;
  let inviteError = '';
  if (from && invite) {
    const r = await inviteFromEvent(env, row, from, createdBy);
    if (r.ok) invited = r.count;
    else inviteError = r.error;
  }
  return { ok: true, event: row, invited, inviteError };
}

export async function finishEvent(env, ev, actor = 0) {
  const db = env.DB;
  if (isFinished(ev)) return { ok: false, error: 'Эвент уже завершён.' };
  const settings = await getSettings(db);
  const now = Date.now();
  const members = await drawParticipants(db, ev.id);
  const until = formatMs(now + CHAT_GRACE_MS, Number(env.TIMEZONE_OFFSET_HOURS ?? 3));
  await db.batch([
    updateEventStmt(db, ev.id, { status: 'finished', finished_at: now, registration_open: 0 }),
    auditStmt(db, ev.id, actor, 'finish'),
    ...members.map((m) => enqueueStmt(db, m.user_id, msg(
      `🏁 <b>Эвент ${q(ev)} завершён.</b> Спасибо за игру!\n\nПисьмо Санте теперь только для чтения. Переписка открыта ещё 7 дней (до ${until}), потом останется для чтения. История эвента сохранится в приложении.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '📚 Открыть', { event: ev.id })]] } }
    ))),
  ]);
  return { ok: true };
}

export async function deleteEvent(env, ev, actor = 0) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  await db.batch([
    ...members.map((m) => enqueueStmt(db, m.user_id, msg(`🗑 Эвент ${q(ev)} удалён организатором вместе с письмами и перепиской.`))),
    db.prepare('DELETE FROM messages WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM exclusions WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM members WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM announcements WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM join_requests WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM events WHERE id = ?').bind(ev.id),
    // Журнал эвента остаётся; само удаление — в общем журнале (007)
    auditStmt(db, 0, actor, 'event.delete', `«${ev.title}», участников: ${members.length}`),
  ]);
  return { ok: true, count: members.length };
}

// Полный сброс эвента (004 → 005: в пределах одного эвента). Владелец, если участвовал, остаётся.
export async function resetEvent(env, ev, ownerId, actor = ownerId) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  const removed = members.filter((m) => m.user_id !== ownerId);
  const inviteCode = randomCode();
  await db.batch([
    ...removed.map((m) => enqueueStmt(db, m.user_id, msg(
      `🎄 Организатор начал эвент ${q(ev)} заново. Прежние данные удалены. Чтобы участвовать, попроси новую пригласительную ссылку.`
    ))),
    db.prepare('DELETE FROM members WHERE event_id = ? AND user_id != ?').bind(ev.id, ownerId),
    db.prepare("UPDATE members SET wishlist = '', wishlist_updated_at = 0 WHERE event_id = ?").bind(ev.id),
    db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM exclusions WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM messages WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM announcements WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM join_requests WHERE event_id = ?').bind(ev.id),
    db.prepare("UPDATE members SET delivery = '', delivery_updated_at = 0 WHERE event_id = ?").bind(ev.id),
    updateEventStmt(db, ev.id, {
      status: 'active', finished_at: 0, draw_done: 0, draw_at: 0, draw_token: '', revealed: 0, registration_open: 1, invite_code: inviteCode,
      ring: 1, avoid_previous: 1, budget: '', event_date: '', place: '', deadline: '', notes: '', last_daily: '',
      draw_auto_date: '', reveal_auto: 0, finish_auto: 0, delivery_on: 0, families_on: 1, approval: 0,
    }),
    auditStmt(db, ev.id, actor, 'reset', `удалено участников: ${removed.length}`),
  ]);
  return { removed: removed.length, inviteCode };
}

// Пригласить участников другого эвента: сообщение со ссылкой вступления (FR-509)
export async function inviteFromEvent(env, ev, fromEv, actor = 0) {
  const db = env.DB;
  const settings = await getSettings(db);
  const link = inviteLink(settings, ev);
  if (!link) return { ok: false, error: 'Сначала открой страницу настройки /setup (см. README).' };
  const current = new Set((await eventMembers(db, ev.id)).map((m) => m.user_id));
  const people = (await drawParticipants(db, fromEv.id)).filter((m) => !current.has(m.user_id));
  const stmts = people.map((m) => enqueueStmt(db, m.user_id, msg(
    `📨 <b>Приглашение в эвент ${q(ev)}</b> — Тайный Санта.\nНажми кнопку, чтобы участвовать.`,
    { reply_markup: { inline_keyboard: [[{ text: '🎄 Участвовать', url: link }]] } }
  )));
  stmts.push(auditStmt(db, ev.id, actor, 'invite.from', `из «${fromEv.title}», приглашено: ${people.length}`));
  await db.batch(stmts);
  return { ok: true, count: people.length };
}

export async function revealAll(env, ev, actor = 0) {
  const db = env.DB;
  const rows = await getPairs(db, ev.id);
  const users = await allUsers(db);
  const byId = Object.fromEntries(users.map((u) => [u.tg_id, u]));
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.ward, msg(`🎅 <b>Тайна раскрыта!</b>\n\nВ эвенте ${q(ev)} твой Тайный Санта — <b>${escapeHtml(byId[p.santa]?.name || '?')}</b>. С праздником! 🎄`))
  );
  stmts.push(updateEventStmt(db, ev.id, { revealed: 1 }));
  stmts.push(auditStmt(db, ev.id, actor, 'reveal', `пар: ${rows.length}`));
  await db.batch(stmts);
  return { ok: true, count: rows.length };
}

export async function remindUnfilled(env, ev, actor = 0) {
  const db = env.DB;
  const settings = await getSettings(db);
  const people = (await drawParticipants(db, ev.id)).filter((u) => !u.wishlist.trim());
  const deadline = ev.deadline ? ` до <b>${formatDate(ev.deadline)}</b>` : '';
  const stmts = people.map((u) =>
    enqueueStmt(db, u.user_id, msg(
      `⏰ Напоминание: твоё письмо Санте в эвенте ${q(ev)} пока пустое. Заполни его${deadline}, чтобы Санте было проще выбрать подарок.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] } }
    ))
  );
  // Пустое плановое напоминание журнал не засоряет
  if (people.length || actor) stmts.push(auditStmt(db, ev.id, actor, 'remind.unfilled', `получили: ${people.length}`));
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: people.length };
}

export async function remindSantas(env, ev, actor = 0) {
  const db = env.DB;
  const settings = await getSettings(db);
  const rows = (await getPairs(db, ev.id)).filter((p) => !p.gift_ready);
  const when = ev.event_date ? ` Вручение — <b>${formatDate(ev.event_date)}</b>.` : '';
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.santa, msg(
      `🎁 Напоминание для Санты (эвент ${q(ev)}): подарок для подопечного уже готов?${when}\nКогда будет готов — отметь это во вкладке «Подопечный».`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть', { event: ev.id })]] } }
    ))
  );
  // Пустое плановое напоминание журнал не засоряет
  if (rows.length || actor) stmts.push(auditStmt(db, ev.id, actor, 'remind.santas', `получили: ${rows.length}`));
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: rows.length };
}

// ---------- объявления (007) ----------

const ANNOUNCE_MAX = 2000;

// Объявление всем зарегистрированным участникам эвента (FR-701): хранится и рассылается через outbox
export async function announce(env, ev, actor, rawText) {
  const db = env.DB;
  if (isFinished(ev)) return { ok: false, error: 'Эвент завершён — объявления в нём уже не отправить.' };
  const text = cleanText(rawText);
  if (!text) return { ok: false, error: 'Напиши текст объявления.' };
  if (text.length > ANNOUNCE_MAX) return { ok: false, error: `Слишком длинно: ${text.length} символов, максимум ${ANNOUNCE_MAX}.` };
  const [settings, people] = await Promise.all([getSettings(db), drawParticipants(db, ev.id)]);
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO announcements (event_id, author, text, created_at) VALUES (?, ?, ?, ?)').bind(ev.id, actor, text, now),
    ...people.map((u) => enqueueStmt(db, u.user_id, msg(
      `📣 <b>Объявление · ${q(ev)}</b>\n\n${escapeHtml(text)}`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '📌 Открыть эвент', { event: ev.id })]] } }
    ))),
    auditStmt(db, ev.id, actor, 'announce', `получили: ${people.length}`),
  ]);
  return { ok: true, count: people.length };
}

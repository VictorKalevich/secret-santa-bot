// Жизненный цикл эвента: создание, завершение, удаление, сброс, приглашения, раскрытие тайны, напоминания, объявления.

import {
  getSettings, getEvent, eventMembers, drawParticipants, getPairs, allUsers, enqueueStmt, enqueueIfStmt, updateEventStmt,
  auditStmt, auditIfStmt, supportDeleteStmts,
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
  if (!clean || clean.length > 80) return { ok: false, error: 'Название события — от 1 до 80 символов.' };
  const code = randomCode();
  const t = from || {
    budget: '', place: '', notes: '', ring: 1, avoid_previous: 1, reveal_auto: 0, finish_auto: 0, delivery_on: 0, families_on: 1, approval: 0,
    rejoin: 1,
  };
  // Новый эвент в остальных операторах batch находим по уникальному коду приглашения
  const newId = '(SELECT id FROM events WHERE invite_code = ?)';
  const stmts = [
    db.prepare(
      `INSERT INTO events (title, created_at, created_by, invite_code, budget, place, notes, ring, avoid_previous, reveal_auto, finish_auto,
                           delivery_on, families_on, approval, rejoin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(clean, Date.now(), createdBy, code, t.budget, t.place, t.notes, t.ring, t.avoid_previous, t.reveal_auto, t.finish_auto,
      t.delivery_on, t.families_on, t.approval, t.rejoin ?? 1),
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
  if (isFinished(ev)) return { ok: false, error: 'Событие уже завершено.' };
  const settings = await getSettings(db);
  const now = Date.now();
  const members = await drawParticipants(db, ev.id);
  const until = formatMs(now + CHAT_GRACE_MS, Number(env.TIMEZONE_OFFSET_HOURS ?? 3));
  // Атомарно (009, FR-920): завершает только первый из одновременных вызовов (админ и cron) — остальные ничего не рассылают
  // Часы Workers у одновременных запросов могут совпасть до миллисекунды, поэтому «наш» захват узнаём ещё и по
  // отсутствию записи журнала 'finish': завершение необратимо, такая запись у эвента одна и пишется последней.
  const guard = `EXISTS (SELECT 1 FROM events WHERE id = ? AND status = 'finished' AND finished_at = ?)
    AND NOT EXISTS (SELECT 1 FROM audit WHERE event_id = ? AND action = 'finish')`;
  const [claim] = await db.batch([
    db.prepare("UPDATE events SET status = 'finished', finished_at = ?, registration_open = 0 WHERE id = ? AND status = 'active'").bind(now, ev.id),
    ...members.map((m) => enqueueIfStmt(db, m.user_id, msg(
      `🏁 <b>Событие ${q(ev)} завершено.</b> Спасибо за игру!\n\nПисьмо Санте теперь только для чтения. Переписка открыта ещё 7 дней (до ${until}), потом останется для чтения. История события сохранится в приложении.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '📚 Открыть', { event: ev.id })]] } }
    ), guard, ev.id, now, ev.id)),
    auditIfStmt(db, ev.id, actor, 'finish', '', guard, ev.id, now, ev.id),
  ]);
  if (!claim.meta.changes) return { ok: false, error: 'Событие уже завершено.' };
  return { ok: true };
}

// Атомарно (010, FR-1024): рассылка и запись журнала — только пока эвент существует, сам эвент удаляется последним.
// Batch D1 — одна транзакция, транзакции записи идут по очереди: второе одновременное удаление видит эвент уже удалённым
// и ничего не рассылает и не пишет.
export async function deleteEvent(env, ev, actor = 0) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  const exists = 'EXISTS (SELECT 1 FROM events WHERE id = ?)';
  const res = await db.batch([
    ...members.map((m) => enqueueIfStmt(db, m.user_id, msg(`🗑 Событие ${q(ev)} удалено организатором вместе с письмами и перепиской.`), exists, ev.id)),
    // Журнал эвента остаётся; само удаление — в общем журнале (007)
    auditIfStmt(db, 0, actor, 'event.delete', `«${ev.title}», участников: ${members.length}`, exists, ev.id),
    db.prepare('DELETE FROM messages WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM exclusions WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM members WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM announcements WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM join_requests WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM removed_members WHERE event_id = ?').bind(ev.id),
    ...supportDeleteStmts(db, ev.id), // 012: обращения к организаторам
    db.prepare('DELETE FROM events WHERE id = ?').bind(ev.id),
  ]);
  if (!res.at(-1).meta.changes) return { ok: false, error: 'Событие уже удалено.' };
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
      `🎄 Организатор начал событие ${q(ev)} заново. Прежние данные удалены. Чтобы участвовать, попроси новую пригласительную ссылку.`
    ))),
    db.prepare('DELETE FROM members WHERE event_id = ? AND user_id != ?').bind(ev.id, ownerId),
    db.prepare("UPDATE members SET wishlist = '', wishlist_updated_at = 0 WHERE event_id = ?").bind(ev.id),
    db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM exclusions WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM messages WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM announcements WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM join_requests WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM removed_members WHERE event_id = ?').bind(ev.id),
    ...supportDeleteStmts(db, ev.id), // 012: обращения к организаторам
    db.prepare("UPDATE members SET delivery = '', delivery_updated_at = 0 WHERE event_id = ?").bind(ev.id),
    updateEventStmt(db, ev.id, {
      status: 'active', finished_at: 0, draw_done: 0, draw_at: 0, draw_token: '', revealed: 0, registration_open: 1, invite_code: inviteCode,
      ring: 1, avoid_previous: 1, budget: '', event_date: '', place: '', deadline: '', notes: '', last_daily: '',
      draw_auto_date: '', reveal_auto: 0, finish_auto: 0, delivery_on: 0, families_on: 1, approval: 0, rejoin: 1,
    }),
    auditStmt(db, ev.id, actor, 'reset', `удалено участников: ${removed.length}`),
  ]);
  return { removed: removed.length, inviteCode };
}

// Пригласить участников другого эвента: сообщение со ссылкой вступления (FR-509).
// Закрытая регистрация — значит никто (010, FR-1017); удалённым организатором при запрете возврата — не приглашаем.
export async function inviteFromEvent(env, ev, fromEv, actor = 0) {
  const db = env.DB;
  if (!ev.registration_open) return { ok: false, error: 'Регистрация закрыта — открой её, чтобы приглашать.' };
  const settings = await getSettings(db);
  const link = inviteLink(settings, ev);
  if (!link) return { ok: false, error: 'Сначала открой страницу настройки /setup (см. README).' };
  const [members, removed] = await Promise.all([
    eventMembers(db, ev.id),
    ev.rejoin ? [] : db.prepare('SELECT user_id FROM removed_members WHERE event_id = ?').bind(ev.id).all().then((r) => r.results),
  ]);
  const skip = new Set([...members, ...removed].map((m) => m.user_id));
  const people = (await drawParticipants(db, fromEv.id)).filter((m) => !skip.has(m.user_id));
  const stmts = people.map((m) => enqueueStmt(db, m.user_id, msg(
    `📨 <b>Приглашение на событие ${q(ev)}</b> — Тайный Санта.\nНажми кнопку, чтобы участвовать.`,
    { reply_markup: { inline_keyboard: [[{ text: '🎄 Участвовать', url: link }]] } }
  )));
  stmts.push(auditStmt(db, ev.id, actor, 'invite.from', `из «${fromEv.title}», приглашено: ${people.length}`));
  await db.batch(stmts);
  return { ok: true, count: people.length };
}

// Раскрыть тайну: каждому подопечному — имя его Санты. Атомарно (009, FR-919): рассылает только первый из одновременных
// вызовов (админ и cron), и только если пары не поменялись после чтения (версия пар — draw_token).
export async function revealAll(env, ev, actor = 0) {
  const db = env.DB;
  const cur = await getEvent(db, ev.id);
  if (!cur?.draw_done) return { ok: false, error: 'Жеребьёвка ещё не проведена.' };
  if (cur.revealed) return { ok: false, error: 'Тайна уже раскрыта.' };
  const [rows, users] = await Promise.all([getPairs(db, ev.id), allUsers(db)]);
  const byId = Object.fromEntries(users.map((u) => [u.tg_id, u]));
  // revealed хранит уникальную отметку этого раскрытия (для условий ниже); везде читается как «да/нет».
  // Случайная, а не время: часы Workers у одновременных запросов могут совпасть.
  const mark = 1 + Math.floor(Math.random() * 2 ** 52);
  const guard = 'EXISTS (SELECT 1 FROM events WHERE id = ? AND revealed = ?)';
  const [claim] = await db.batch([
    db.prepare('UPDATE events SET revealed = ? WHERE id = ? AND revealed = 0 AND draw_done = 1 AND draw_token = ?')
      .bind(mark, ev.id, cur.draw_token),
    ...rows.map((p) => enqueueIfStmt(db, p.ward, msg(
      `🎅 <b>Тайна раскрыта!</b>\n\nВ событии ${q(ev)} твой Тайный Санта — <b>${escapeHtml(byId[p.santa]?.name || '?')}</b>. С праздником! 🎄`
    ), guard, ev.id, mark)),
    auditIfStmt(db, ev.id, actor, 'reveal', `пар: ${rows.length}`, guard, ev.id, mark),
  ]);
  if (!claim.meta.changes) {
    const now = await getEvent(db, ev.id);
    return { ok: false, error: now?.revealed ? 'Тайна уже раскрыта.' : 'Пары изменились одновременно с этим действием — попробуй ещё раз.' };
  }
  return { ok: true, count: rows.length };
}

// extra — операторы, которые выполняются в том же batch, что и рассылка (cron: отметка last_daily, 009)
export async function remindUnfilled(env, ev, actor = 0, extra = []) {
  const db = env.DB;
  const settings = await getSettings(db);
  const people = (await drawParticipants(db, ev.id)).filter((u) => !u.wishlist.trim());
  const deadline = ev.deadline ? ` до <b>${formatDate(ev.deadline)}</b>` : '';
  const stmts = people.map((u) =>
    enqueueStmt(db, u.user_id, msg(
      `⏰ Напоминание: твоё письмо Санте в событии ${q(ev)} пока пустое. Заполни его${deadline}, чтобы Санте было проще выбрать подарок.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] } }
    ))
  );
  // Пустое плановое напоминание журнал не засоряет
  if (people.length || actor) stmts.push(auditStmt(db, ev.id, actor, 'remind.unfilled', `получили: ${people.length}`));
  stmts.push(...extra);
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: people.length };
}

export async function remindSantas(env, ev, actor = 0, extra = []) {
  const db = env.DB;
  const settings = await getSettings(db);
  const rows = (await getPairs(db, ev.id)).filter((p) => !p.gift_ready);
  const when = ev.event_date ? ` Вручение — <b>${formatDate(ev.event_date)}</b>.` : '';
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.santa, msg(
      `🎁 Напоминание для Санты (${q(ev)}): подарок для подопечного уже готов?${when}\nКогда будет готов — отметь это во вкладке «Подопечный».`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть', { event: ev.id })]] } }
    ))
  );
  // Пустое плановое напоминание журнал не засоряет
  if (rows.length || actor) stmts.push(auditStmt(db, ev.id, actor, 'remind.santas', `получили: ${rows.length}`));
  stmts.push(...extra);
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: rows.length };
}

// ---------- объявления (007) ----------

const ANNOUNCE_MAX = 2000;

// Объявление всем зарегистрированным участникам эвента (FR-701): хранится и рассылается через outbox
export async function announce(env, ev, actor, rawText) {
  const db = env.DB;
  if (isFinished(ev)) return { ok: false, error: 'Событие завершено — объявления в нём уже не отправить.' };
  const text = cleanText(rawText);
  if (!text) return { ok: false, error: 'Напиши текст объявления.' };
  if (text.length > ANNOUNCE_MAX) return { ok: false, error: `Слишком длинно: ${text.length} символов, максимум ${ANNOUNCE_MAX}.` };
  const [settings, people] = await Promise.all([getSettings(db), drawParticipants(db, ev.id)]);
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO announcements (event_id, author, text, created_at) VALUES (?, ?, ?, ?)').bind(ev.id, actor, text, now),
    ...people.map((u) => enqueueStmt(db, u.user_id, msg(
      `📣 <b>Объявление · ${q(ev)}</b>\n\n${escapeHtml(text)}`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '📌 Открыть событие', { event: ev.id })]] } }
    ))),
    auditStmt(db, ev.id, actor, 'announce', `получили: ${people.length}`),
  ]);
  return { ok: true, count: people.length };
}

// Жизненный цикл эвента: создание, завершение, удаление, сброс, приглашения, раскрытие тайны, напоминания, объявления.

import {
  getEvent, rowsOf, memberIdsQuery, participantIdsQuery, unfilledIdsQuery, pairsQuery, pairLinksQuery, enqueueStmt, enqueueIfStmt,
  updateEventStmt, auditStmt, auditIfStmt, eventDataDeleteStmts,
} from './db.js';
import { msg, q, escapeHtml, formatDate, formatMs, appKeyboard, inviteLink, randomCode, oneLine, cleanText, ISO_DATE, NO_DRAW, PAIRS_RACE } from './format.js';

import { CHAT_GRACE_MS, isFinished } from './status.js';

// from — эвент-образец (007, FR-706): копируются параметры и исключения, даты — нет.
// invite — разослать участникам образца приглашение в новый эвент.
export async function createEvent(ctx, title, createdBy, { from = null, invite = false } = {}) {
  const db = ctx.db;
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
    const r = await inviteFromEvent(ctx, row, from, createdBy);
    if (r.ok) invited = r.count;
    else inviteError = r.error;
  }
  return { ok: true, event: row, invited, inviteError };
}

export async function finishEvent(ctx, ev, actor = 0) {
  const db = ctx.db;
  if (isFinished(ev)) return { ok: false, error: 'Событие уже завершено.' };
  const { settings, members } = await ctx.read({ members: participantIdsQuery(db, ev.id), settings: true });
  const now = Date.now();
  const until = formatMs(now + CHAT_GRACE_MS, Number(ctx.env.TIMEZONE_OFFSET_HOURS ?? 3));
  // Атомарно (009, FR-920): завершает только первый из одновременных вызовов (админ и cron) — остальные ничего не рассылают
  // Часы Workers у одновременных запросов могут совпасть до миллисекунды, поэтому «наш» захват узнаём ещё и по
  // отсутствию записи журнала 'finish': завершение необратимо, такая запись у эвента одна и пишется последней.
  const guard = `EXISTS (SELECT 1 FROM events WHERE id = ? AND status = 'finished' AND finished_at = ?)
    AND NOT EXISTS (SELECT 1 FROM audit WHERE event_id = ? AND action = 'finish')`;
  const [claim] = await db.batch([
    db.prepare("UPDATE events SET status = 'finished', finished_at = ?, registration_open = 0 WHERE id = ? AND status = 'active'").bind(now, ev.id),
    ...members.map((m) => enqueueIfStmt(db, m.user_id, msg(
      `🏁 <b>Событие ${q(ev)} завершено.</b> Спасибо за игру!\n\nПисьмо Санте теперь только для чтения. Переписка открыта ещё 7 дней (до ${until}), потом останется для чтения. История события сохранится в приложении.`,
      appKeyboard(settings, '📚 Открыть', { event: ev.id })
    ), guard, ev.id, now, ev.id)),
    auditIfStmt(db, ev.id, actor, 'finish', '', guard, ev.id, now, ev.id),
  ]);
  if (!claim.meta.changes) return { ok: false, error: 'Событие уже завершено.' };
  return { ok: true };
}

// Атомарно (010, FR-1024): рассылка и запись журнала — только пока эвент существует, сам эвент удаляется последним.
// Batch D1 — одна транзакция, транзакции записи идут по очереди: второе одновременное удаление видит эвент уже удалённым
// и ничего не рассылает и не пишет.
export async function deleteEvent(ctx, ev, actor = 0) {
  const db = ctx.db;
  const members = await rowsOf(memberIdsQuery(db, ev.id));
  const exists = 'EXISTS (SELECT 1 FROM events WHERE id = ?)';
  const res = await db.batch([
    ...members.map((m) => enqueueIfStmt(db, m.user_id, msg(`🗑 Событие ${q(ev)} удалено организатором вместе с письмами и перепиской.`), exists, ev.id)),
    // Журнал эвента остаётся; само удаление — в общем журнале (007)
    auditIfStmt(db, 0, actor, 'event.delete', `«${ev.title}», участников: ${members.length}`, exists, ev.id),
    // Данные эвента — по списку REGISTRY (018), строка эвента — последней
    ...eventDataDeleteStmts(db, ev.id, {}, exists, ev.id),
  ]);
  if (!res.at(-1).meta.changes) return { ok: false, error: 'Событие уже удалено.' };
  return { ok: true, count: members.length };
}

// Полный сброс эвента (004 → 005: в пределах одного эвента). Владелец, если участвовал, остаётся.
export async function resetEvent(ctx, ev, ownerId, actor = ownerId) {
  const db = ctx.db;
  const members = await rowsOf(memberIdsQuery(db, ev.id));
  const removed = members.filter((m) => m.user_id !== ownerId);
  const inviteCode = randomCode();
  await db.batch([
    ...removed.map((m) => enqueueStmt(db, m.user_id, msg(
      `🎄 Организатор начал событие ${q(ev)} заново. Прежние данные удалены. Чтобы участвовать, попроси новую пригласительную ссылку.`
    ))),
    // Данные эвента — по списку REGISTRY (018): участие владельца остаётся, его письмо и адрес стираются
    ...eventDataDeleteStmts(db, ev.id, { keepMember: ownerId, keepEvent: true }),
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
export async function inviteFromEvent(ctx, ev, fromEv, actor = 0) {
  const db = ctx.db;
  if (!ev.registration_open) return { ok: false, error: 'Регистрация закрыта — открой её, чтобы приглашать.' };
  const settings = await ctx.settings();
  const link = inviteLink(settings, ev);
  if (!link) return { ok: false, error: 'Сначала открой страницу настройки /setup (см. README).' };
  // Участники обоих событий и отметки «удалён» — одним пакетом чтений (019)
  const r = await ctx.read({
    members: memberIdsQuery(db, ev.id),
    removed: !ev.rejoin && db.prepare('SELECT user_id FROM removed_members WHERE event_id = ?').bind(ev.id),
    from: participantIdsQuery(db, fromEv.id),
  });
  const skip = new Set([...r.members, ...r.removed].map((m) => m.user_id));
  const people = r.from.filter((m) => !skip.has(m.user_id));
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
export async function revealAll(ctx, ev, actor = 0) {
  const db = ctx.db;
  const cur = await getEvent(db, ev.id);
  if (!cur?.draw_done) return { ok: false, error: NO_DRAW };
  if (cur.revealed) return { ok: false, error: 'Тайна уже раскрыта.' };
  const { rows, users } = await ctx.read({ rows: pairLinksQuery(db, ev.id), users: true });
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
    return { ok: false, error: now?.revealed ? 'Тайна уже раскрыта.' : PAIRS_RACE };
  }
  return { ok: true, count: rows.length };
}

// extra — операторы, которые выполняются в том же batch, что и рассылка (cron: отметка last_daily, 009)
export async function remindUnfilled(ctx, ev, actor = 0, extra = []) {
  const db = ctx.db;
  // Пустые письма отбираются в базе — тексты не читаются (019)
  const { settings, people } = await ctx.read({ people: unfilledIdsQuery(db, ev.id), settings: true });
  const deadline = ev.deadline ? ` до <b>${formatDate(ev.deadline)}</b>` : '';
  const stmts = people.map((u) =>
    enqueueStmt(db, u.user_id, msg(
      `⏰ Напоминание: твоё письмо Санте в событии ${q(ev)} пока пустое. Заполни его${deadline}, чтобы Санте было проще выбрать подарок.`,
      appKeyboard(settings, '✏️ Написать письмо', { event: ev.id })
    ))
  );
  // Пустое плановое напоминание журнал не засоряет
  if (people.length || actor) stmts.push(auditStmt(db, ev.id, actor, 'remind.unfilled', `получили: ${people.length}`));
  stmts.push(...extra);
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: people.length };
}

export async function remindSantas(ctx, ev, actor = 0, extra = []) {
  const db = ctx.db;
  const r = await ctx.read({ rows: pairsQuery(db, ev.id), settings: true });
  const { settings } = r;
  const rows = r.rows.filter((p) => !p.gift_ready);
  const when = ev.event_date ? ` Вручение — <b>${formatDate(ev.event_date)}</b>.` : '';
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.santa, msg(
      `🎁 Напоминание для Санты (${q(ev)}): подарок для подопечного уже готов?${when}\nКогда будет готов — отметь это во вкладке «Подопечный».`,
      appKeyboard(settings, '🎁 Открыть', { event: ev.id })
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
export async function announce(ctx, ev, actor, rawText) {
  const db = ctx.db;
  if (isFinished(ev)) return { ok: false, error: 'Событие завершено — объявления в нём уже не отправить.' };
  const text = cleanText(rawText);
  if (!text) return { ok: false, error: 'Напиши текст объявления.' };
  if (text.length > ANNOUNCE_MAX) return { ok: false, error: `Слишком длинно: ${text.length} символов, максимум ${ANNOUNCE_MAX}.` };
  const { settings, people } = await ctx.read({ people: participantIdsQuery(db, ev.id), settings: true });
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO announcements (event_id, author, text, created_at) VALUES (?, ?, ?, ?)').bind(ev.id, actor, text, now),
    ...people.map((u) => enqueueStmt(db, u.user_id, msg(
      `📣 <b>Объявление · ${q(ev)}</b>\n\n${escapeHtml(text)}`,
      appKeyboard(settings, '📌 Открыть событие', { event: ev.id })
    ))),
    auditStmt(db, ev.id, actor, 'announce', `получили: ${people.length}`),
  ]);
  return { ok: true, count: people.length };
}

// ---------- параметры события (019: из api.js) ----------

// admin.game: меняются только переданные поля (008) — отдельные переключатели не стирают остальные параметры
export async function saveEventSettings(ctx, ev, body, actor) {
  const db = ctx.db;
  const clean = (v, n) => String(v ?? '').slice(0, n);
  const date = (v) => (ISO_DATE.test(v || '') ? v : '');
  const title = oneLine(body.title ?? ev.title);
  if (!title || title.length > 80) return { ok: false, error: 'Название события — от 1 до 80 символов.' };
  const fields = { title };
  const limits = { budget: 100, place: 200, notes: 2000 };
  for (const [k, n] of Object.entries(limits)) if (k in body) fields[k] = clean(body[k], n);
  for (const k of ['event_date', 'deadline']) if (k in body) fields[k] = date(body[k]);
  // Расписание (007, FR-702): дату автожеребьёвки после жеребьёвки не изменить
  if ('draw_auto_date' in body) {
    const auto = date(body.draw_auto_date);
    if (auto !== ev.draw_auto_date) {
      if (ev.draw_done) return { ok: false, error: 'Дату автожеребьёвки после жеребьёвки не задать.' };
      fields.draw_auto_date = auto;
    }
  }
  // 008: адрес доставки, одобрение заявок, семьи (семьи — только до жеребьёвки)
  if ('delivery_on' in body) fields.delivery_on = body.delivery_on ? 1 : 0;
  if ('approval' in body) fields.approval = body.approval ? 1 : 0;
  if ('rejoin' in body) fields.rejoin = body.rejoin ? 1 : 0; // 010
  if ('families_on' in body && (body.families_on ? 1 : 0) !== ev.families_on) {
    if (ev.draw_done) return { ok: false, error: 'После жеребьёвки правило семей не изменить.' };
    fields.families_on = body.families_on ? 1 : 0;
  }
  if ('reveal_auto' in body) fields.reveal_auto = body.reveal_auto ? 1 : 0;
  if ('finish_auto' in body) fields.finish_auto = body.finish_auto ? 1 : 0;
  await db.batch([updateEventStmt(db, ev.id, fields), auditStmt(db, ev.id, actor, 'event.settings', 'параметры')]);
  return { ok: true };
}

export async function setRing(ctx, ev, on, actor) {
  if (ev.draw_done) return { ok: false, error: 'После жеребьёвки кольцевую жеребьёвку менять нельзя.' };
  const db = ctx.db;
  await db.batch([
    updateEventStmt(db, ev.id, { ring: on ? 1 : 0 }),
    auditStmt(db, ev.id, actor, 'event.settings', `кольцевая жеребьёвка: ${on ? 'вкл' : 'выкл'}`),
  ]);
  return { ok: true };
}

export async function setRegistration(ctx, ev, open, actor) {
  const db = ctx.db;
  await db.batch([
    updateEventStmt(db, ev.id, { registration_open: open ? 1 : 0 }),
    auditStmt(db, ev.id, actor, 'registration', open ? 'открыта' : 'закрыта'),
  ]);
  return { ok: true };
}

export async function regenInvite(ctx, ev, actor) {
  const db = ctx.db;
  await db.batch([updateEventStmt(db, ev.id, { invite_code: randomCode() }), auditStmt(db, ev.id, actor, 'invite.regen')]);
  return { ok: true };
}

export async function setAvoidPrevious(ctx, ev, on, actor) {
  const db = ctx.db;
  await db.batch([
    updateEventStmt(db, ev.id, { avoid_previous: on ? 1 : 0 }),
    auditStmt(db, ev.id, actor, 'event.settings', `не повторять прошлые пары: ${on ? 'вкл' : 'выкл'}`),
  ]);
  return { ok: true };
}

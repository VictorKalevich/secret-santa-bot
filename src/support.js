// Обращения участника к организаторам (012). Обращение привязано к эвенту и участнику; ведёт его один админ
// (assignee, 0 — ничьё). Переписку видят: участник; ничьё — все админы; взятое — ответственный и владелец (R7).
// Каждое изменение — один batch: первый оператор меняет обращение по условию прежнего состояния, уведомления и журнал —
// по условию «изменение сделал этот вызов» (research R6). Сообщения людям — только через outbox.

import { getSettings, allUsers, getUser, enqueueIfStmt, auditIfStmt } from './db.js';
import { msg, q, escapeHtml, shortTitle, displayName, adminRecipients, openAppButton, cleanText } from './format.js';
import { chatWritable } from './events.js';
import { MAX_CHARS } from './chat.js';

const READ_ONLY = 'Событие завершено больше недели назад: обращения только для чтения.';
const NOBODY = 'Сейчас некому написать: в боте нет других организаторов.';
const CLOSED = 'Обращение уже закрыто.';
const NOT_FOUND = 'Обращение не найдено.';

const fail = (error, status = 400) => ({ ok: false, error, status });
const title = (ev) => q({ title: shortTitle(ev.title) });
const bold = (u) => `<b>${escapeHtml(displayName(u))}</b>`;

function checkText(raw) {
  const text = cleanText(raw);
  if (!text) return { error: 'Пустое сообщение.' };
  if (text.length > MAX_CHARS) return { error: `Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS} (лимит сообщения Telegram).` };
  return { text };
}

// Кнопки уведомлений: участнику — ответ «в эвент», админу — взять или ответить в обращение
const userKeyboard = (settings, ev) => ({ inline_keyboard: [[
  { text: '↩️ Ответить', callback_data: `sup:u:${ev.id}` },
  openAppButton(settings, '💬 Открыть', { event: ev.id, support: 'my' }),
]] });
const adminKeyboard = (settings, ev, id, take) => ({ inline_keyboard: [[
  take ? { text: '🙋 Взять', callback_data: `sup:take:${id}` } : { text: '↩️ Ответить', callback_data: `sup:a:${id}` },
  openAppButton(settings, '💬 Открыть', { event: ev.id, support: id }),
]] });

export const supportAvailable = (users, userId) => adminRecipients(users, [userId]).length > 0;

async function threadOf(db, eventId, id) {
  return db.prepare('SELECT * FROM support_threads WHERE id = ? AND event_id = ?').bind(Number(id) || 0, eventId).first();
}

// Условие «обращение id в состоянии …» для операторов batch
const THREAD = 'EXISTS (SELECT 1 FROM support_threads WHERE id = ?';
// Условие «сообщение (обращение, отправитель, время) записано этим вызовом»; закрывающая скобка — у вызывающего
const MINE_SENT = 'EXISTS (SELECT 1 FROM support_messages WHERE thread_id = ? AND sender = ? AND created_at = ?';

// ---------- участник ----------

// Обращения участника в эвенте (до 10 последних, старые сначала); ответы организаторов помечаются прочитанными
export async function participantView(env, ev, me) {
  const db = env.DB;
  const [users, threads] = await Promise.all([
    allUsers(db),
    db.prepare('SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10').bind(ev.id, me.tg_id).all().then((r) => r.results.reverse()),
  ]);
  const byId = new Map(users.map((u) => [u.tg_id, u]));
  let messages = [];
  if (threads.length) {
    const ids = threads.map((t) => t.id);
    const marks = ids.map(() => '?').join(',');
    messages = (await db.prepare(`SELECT * FROM support_messages WHERE thread_id IN (${marks}) ORDER BY id`).bind(...ids).all()).results;
    if (messages.some((m) => m.from_admin && !m.read_at)) {
      await db.prepare(`UPDATE support_messages SET read_at = ? WHERE thread_id IN (${marks}) AND from_admin = 1 AND read_at = 0`).bind(Date.now(), ...ids).run();
    }
  }
  return {
    available: supportAvailable(users, me.tg_id),
    writable: chatWritable(ev),
    threads: threads.map((t) => ({
      id: t.id,
      status: t.status,
      assignee_name: t.assignee ? displayName(byId.get(t.assignee)) : '',
      created_at: t.created_at,
      closed_at: t.closed_at,
      messages: messages.filter((m) => m.thread_id === t.id).map((m) => ({
        id: m.id, mine: !m.from_admin, author: m.from_admin ? displayName(byId.get(m.sender)) : '', text: m.text, created_at: m.created_at,
      })),
    })),
  };
}

// Сообщение участника: в открытое обращение или новое (одно открытое на эвент — уникальный индекс)
export async function sendFromUser(env, ev, me, rawText, retry = true) {
  const db = env.DB;
  const t = checkText(rawText);
  if (t.error) return fail(t.error);
  if (!chatWritable(ev)) return fail(READ_ONLY);
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const admins = adminRecipients(users, [me.tg_id]);
  if (!admins.length) return fail(NOBODY);
  let thread = await db.prepare("SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? AND status = 'open'").bind(ev.id, me.tg_id).first();
  let created = false;
  if (!thread) {
    thread = await db
      .prepare("INSERT OR IGNORE INTO support_threads (event_id, user_id, status, created_at) VALUES (?, ?, 'open', ?) RETURNING *")
      .bind(ev.id, me.tg_id, Date.now())
      .first();
    created = !!thread;
    // Одновременно открыли из другого окна — пишем в него
    if (!thread) thread = await db.prepare("SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? AND status = 'open'").bind(ev.id, me.tg_id).first();
    if (!thread) return fail('Не получилось отправить — попробуй ещё раз.');
  }
  const now = Date.now();
  const body = '\n\n' + escapeHtml(t.text);
  // Уведомление — только если сообщение записано этим вызовом и обращение в нужном состоянии (ничьё / у ответственного)
  const sent = `${THREAD} AND status = 'open' AND assignee = ? AND ${MINE_SENT}))`;
  const g = (assignee) => [thread.id, assignee, thread.id, me.tg_id, now];
  const unassigned = created
    ? { text: `🆘 ${bold(me)} просит помощи в событии ${title(ev)}:${body}`, quiet: false }
    : { text: `💬 ${bold(me)} дополняет обращение (${title(ev)}):${body}`, quiet: true };
  const stmts = [
    db.prepare(`INSERT INTO support_messages (thread_id, sender, from_admin, text, created_at) SELECT ?, ?, 0, ?, ? WHERE ${THREAD} AND status = 'open') RETURNING id, created_at`)
      .bind(thread.id, me.tg_id, t.text, now, thread.id),
    // Отвечая, участник видел ответы организатора — помечаем их прочитанными
    db.prepare(`UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 1 AND read_at = 0 AND ${MINE_SENT} AND from_admin = 0)`)
      .bind(now, thread.id, thread.id, me.tg_id, now),
    // Ничьё — всем админам; взятое — только ответственному (кто именно — решает состояние на момент записи)
    ...admins.map((a) => enqueueIfStmt(db, a.tg_id, msg(unassigned.text, {
      disable_notification: unassigned.quiet, reply_markup: adminKeyboard(settings, ev, thread.id, true),
    }), sent, ...g(0))),
    ...admins.map((a) => enqueueIfStmt(db, a.tg_id, msg(`💬 ${bold(me)} пишет в обращении (${title(ev)}):${body}`, {
      reply_markup: adminKeyboard(settings, ev, thread.id, false),
    }), sent, ...g(a.tg_id))),
  ];
  if (created) stmts.push(auditIfStmt(db, ev.id, me.tg_id, 'support.open', displayName(me), `${THREAD} AND status = 'open')`, thread.id));
  const [inserted] = await db.batch(stmts);
  const row = inserted.results[0];
  if (!row) {
    // Обращение закрыли между чтением и записью — следующее сообщение открывает новое
    return retry ? sendFromUser(env, ev, me, rawText, false) : fail('Не получилось отправить — попробуй ещё раз.');
  }
  return { ok: true, thread: thread.id, created, message: { id: row.id, mine: true, author: '', text: t.text, created_at: row.created_at } };
}

export async function closeByUser(env, ev, me) {
  const db = env.DB;
  if (!chatWritable(ev)) return fail(READ_ONLY);
  const thread = await db.prepare("SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? AND status = 'open'").bind(ev.id, me.tg_id).first();
  if (!thread) return fail('Открытого обращения нет.');
  const users = await allUsers(db);
  const now = Date.now();
  const done = `${THREAD} AND status = 'closed' AND closed_at = ? AND closed_by = ? AND (assignee = 0 OR assignee = ?))`;
  const res = await db.batch([
    db.prepare("UPDATE support_threads SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ? AND status = 'open'").bind(now, me.tg_id, thread.id),
    // Ответственному (или всем админам, если обращение ничьё) — без звука
    ...adminRecipients(users, [me.tg_id]).map((a) => enqueueIfStmt(db, a.tg_id, msg(
      `✅ ${bold(me)} закрыл(а) обращение (${title(ev)}).`, { disable_notification: true }
    ), done, thread.id, now, me.tg_id, a.tg_id)),
    auditIfStmt(db, ev.id, me.tg_id, 'support.close', displayName(me), `${THREAD} AND closed_at = ? AND closed_by = ?)`, thread.id, now, me.tg_id),
  ]);
  if (!res[0].meta.changes) return fail('Открытого обращения нет.');
  return { ok: true };
}

// ---------- админ ----------

const canRead = (t, me, isOwner) => isOwner || !t.assignee || t.assignee === me.tg_id;

// Список обращений эвента для панели: открытые сверху, затем до 20 последних закрытых. Тексты не отдаются.
export async function adminList(db, ev, me, isOwner, users) {
  const { results } = await db
    .prepare(
      `SELECT t.*,
              (SELECT MAX(created_at) FROM support_messages m WHERE m.thread_id = t.id) AS last_at,
              (SELECT COUNT(*) FROM support_messages m WHERE m.thread_id = t.id AND m.from_admin = 0 AND m.read_at = 0) AS fresh
         FROM support_threads t WHERE t.event_id = ?
        ORDER BY (t.status = 'open') DESC, COALESCE((SELECT MAX(id) FROM support_messages m WHERE m.thread_id = t.id), 0) DESC, t.id DESC
        LIMIT 80`
    )
    .bind(ev.id)
    .all();
  const byId = new Map(users.map((u) => [u.tg_id, u]));
  const open = results.filter((t) => t.status === 'open');
  const closed = results.filter((t) => t.status !== 'open').slice(0, 20);
  return {
    threads: [...open, ...closed].map((t) => ({
      id: t.id,
      user_id: t.user_id,
      name: displayName(byId.get(t.user_id)),
      status: t.status,
      assignee: t.assignee,
      assignee_name: t.assignee ? displayName(byId.get(t.assignee)) : '',
      created_at: t.created_at,
      closed_at: t.closed_at,
      last_at: t.last_at || t.created_at,
      // Непрочитанное — во взятых мной и в ничьих (кроме моего собственного обращения)
      unread: t.status === 'open' && t.user_id !== me.tg_id && (t.assignee === me.tg_id || !t.assignee) ? t.fresh : 0,
      readable: canRead(t, me, isOwner),
    })),
    admins: adminRecipients(users).map((u) => ({ id: u.tg_id, name: displayName(u) })),
  };
}

// Одно обращение с перепиской (если её можно видеть); ответственный, открыв его, читает сообщения участника
export async function adminThread(env, ev, me, isOwner, id) {
  const db = env.DB;
  const t = await threadOf(db, ev.id, id);
  if (!t) return fail(NOT_FOUND, 404);
  const users = await allUsers(db);
  const byId = new Map(users.map((u) => [u.tg_id, u]));
  if (!canRead(t, me, isOwner)) {
    return fail(`Обращение ведёт ${displayName(byId.get(t.assignee))} — переписку видят он(а) и владелец.`, 403);
  }
  const { results } = await db.prepare('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY id').bind(t.id).all();
  if (t.assignee === me.tg_id && results.some((m) => !m.from_admin && !m.read_at)) {
    await db.prepare('UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 0 AND read_at = 0').bind(Date.now(), t.id).run();
  }
  const open = t.status === 'open';
  return {
    ok: true,
    thread: {
      id: t.id,
      user_id: t.user_id,
      name: displayName(byId.get(t.user_id)),
      status: t.status,
      assignee: t.assignee,
      assignee_name: t.assignee ? displayName(byId.get(t.assignee)) : '',
      created_at: t.created_at,
      closed_at: t.closed_at,
      closed_by_name: t.closed_by ? displayName(byId.get(t.closed_by)) : '',
      // Писать: открыто, срок не вышел, ничьё (возьмётся ответом) или моё; своё обращение как автор — нет
      writable: open && chatWritable(ev) && t.user_id !== me.tg_id && (!t.assignee || t.assignee === me.tg_id),
    },
    messages: results.map((m) => ({
      id: m.id, mine: m.sender === me.tg_id, from_admin: !!m.from_admin, author: displayName(byId.get(m.sender)), text: m.text, created_at: m.created_at,
    })),
    // Кому можно передать (без автора и нынешнего ответственного) — выбор в шторке обращения
    admins: adminRecipients(users, [t.user_id, t.assignee]).map((u) => ({ id: u.tg_id, name: displayName(u) })),
  };
}

// Операторы «взять ничьё обращение t» (первый — захват). participant: уведомить участника (не нужно, если он
// сразу получит ответ с именем организатора).
function takeStmts(db, settings, users, ev, t, me, now, { participant = true } = {}) {
  const author = users.find((u) => u.tg_id === t.user_id);
  const mine = `${THREAD} AND assignee = ? AND taken_at = ?)`;
  const g = [t.id, me.tg_id, now];
  const stmts = [
    db.prepare("UPDATE support_threads SET assignee = ?, taken_at = ? WHERE id = ? AND status = 'open' AND assignee = 0").bind(me.tg_id, now, t.id),
    ...adminRecipients(users, [me.tg_id, t.user_id]).map((a) => enqueueIfStmt(db, a.tg_id, msg(
      `🙋 ${bold(me)} взял(а) обращение ${bold(author)} (${title(ev)}).`, { disable_notification: true }
    ), mine, ...g)),
    auditIfStmt(db, ev.id, me.tg_id, 'support.take', displayName(author), mine, ...g),
  ];
  if (participant) {
    stmts.push(enqueueIfStmt(db, t.user_id, msg(
      `🙋 Твоё обращение в событии ${title(ev)} взял(а) ${bold(me)} — ответ придёт сюда.`
    ), mine, ...g));
  }
  return stmts;
}

async function taken(db, t) {
  const cur = await db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(t.id).first();
  if (!cur || cur.status !== 'open') return fail(CLOSED);
  const who = await getUser(db, cur.assignee);
  return fail(`Обращение уже взял(а) ${displayName(who)}.`);
}

export async function take(env, ev, me, id) {
  const db = env.DB;
  const t = await threadOf(db, ev.id, id);
  if (!t) return fail(NOT_FOUND, 404);
  if (t.status !== 'open') return fail(CLOSED);
  if (t.user_id === me.tg_id) return fail('Своё обращение взять нельзя.');
  if (t.assignee === me.tg_id) return { ok: true, thread: t };
  if (t.assignee) return taken(db, t);
  if (!chatWritable(ev)) return fail(READ_ONLY);
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const [claim] = await db.batch(takeStmts(db, settings, users, ev, t, me, Date.now()));
  if (!claim.meta.changes) return taken(db, t);
  return { ok: true, thread: { ...t, assignee: me.tg_id } };
}

// Ответ организатора: ничьё обращение берётся этим ответом; чужое — отказ (владелец сначала передаёт себе)
export async function sendFromAdmin(env, ev, me, id, rawText) {
  const db = env.DB;
  const tx = checkText(rawText);
  if (tx.error) return fail(tx.error);
  const t = await threadOf(db, ev.id, id);
  if (!t) return fail(NOT_FOUND, 404);
  if (t.status !== 'open') return fail(CLOSED);
  if (t.user_id === me.tg_id) return fail('Это твоё обращение — отвечать на него будут другие организаторы.');
  if (!chatWritable(ev)) return fail(READ_ONLY);
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  if (t.assignee && t.assignee !== me.tg_id) return fail(`Обращение ведёт ${displayName(users.find((u) => u.tg_id === t.assignee))}.`);
  const now = Date.now();
  const stmts = t.assignee ? [] : takeStmts(db, settings, users, ev, t, me, now, { participant: false });
  const at = stmts.length;
  stmts.push(
    db.prepare(`INSERT INTO support_messages (thread_id, sender, from_admin, text, created_at) SELECT ?, ?, 1, ?, ? WHERE ${THREAD} AND status = 'open' AND assignee = ?) RETURNING id, created_at`)
      .bind(t.id, me.tg_id, tx.text, now, t.id, me.tg_id),
    // Отвечая, организатор видел сообщения участника — помечаем их прочитанными (как в переписке Сант)
    db.prepare(`UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 0 AND read_at = 0 AND ${MINE_SENT})`)
      .bind(now, t.id, t.id, me.tg_id, now),
    enqueueIfStmt(db, t.user_id, msg(`💬 Организатор ${bold(me)} отвечает (${title(ev)}):\n\n${escapeHtml(tx.text)}`, {
      reply_markup: userKeyboard(settings, ev),
    }), `${MINE_SENT} AND from_admin = 1)`, t.id, me.tg_id, now),
  );
  const res = await db.batch(stmts);
  const row = res[at].results[0];
  if (!row) return t.assignee ? fail(CLOSED) : taken(db, t);
  return { ok: true, message: { id: row.id, mine: true, from_admin: true, author: displayName(me), text: tx.text, created_at: row.created_at } };
}

export async function pass(env, ev, me, isOwner, id, toId) {
  const db = env.DB;
  const t = await threadOf(db, ev.id, id);
  if (!t) return fail(NOT_FOUND, 404);
  if (t.assignee !== me.tg_id && !isOwner) return fail('Передать обращение может тот, кто его ведёт, или владелец.', 403);
  if (t.status !== 'open') return fail(CLOSED);
  if (!chatWritable(ev)) return fail(READ_ONLY);
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const to = users.find((u) => u.tg_id === Number(toId));
  if (!to || !to.is_admin || !to.registered || to.tg_id === t.user_id) return fail('Передать можно другому администратору.');
  if (to.tg_id === t.assignee) return fail(`Обращение и так ведёт ${displayName(to)}.`);
  const author = users.find((u) => u.tg_id === t.user_id);
  const prev = users.find((u) => u.tg_id === t.assignee);
  const now = Date.now();
  const done = `${THREAD} AND assignee = ? AND taken_at = ?)`;
  const g = [t.id, to.tg_id, now];
  const stmts = [
    db.prepare("UPDATE support_threads SET assignee = ?, taken_at = ? WHERE id = ? AND status = 'open' AND assignee = ?").bind(to.tg_id, now, t.id, t.assignee),
    enqueueIfStmt(db, t.user_id, msg(`↪️ Твоё обращение в событии ${title(ev)} теперь ведёт ${bold(to)}.`), done, ...g),
    auditIfStmt(db, ev.id, me.tg_id, 'support.pass', `${displayName(author)} → ${displayName(to)}`, done, ...g),
  ];
  if (to.tg_id !== me.tg_id) {
    stmts.push(enqueueIfStmt(db, to.tg_id, msg(`↪️ ${bold(me)} передал(а) тебе обращение ${bold(author)} (${title(ev)}).`, {
      reply_markup: adminKeyboard(settings, ev, t.id, false),
    }), done, ...g));
  }
  // Владелец забрал или передал чужое обращение — прежний ответственный узнаёт об этом
  if (prev && prev.tg_id !== me.tg_id) {
    stmts.push(enqueueIfStmt(db, prev.tg_id, msg(
      `↪️ ${bold(me)} передал(а) обращение ${bold(author)} (${title(ev)}) — теперь его ведёт ${bold(to)}.`, { disable_notification: true }
    ), done, ...g));
  }
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) return fail('Обращение изменилось одновременно с этим действием — обнови экран и попробуй ещё раз.');
  return { ok: true };
}

export async function closeByAdmin(env, ev, me, isOwner, id) {
  const db = env.DB;
  const t = await threadOf(db, ev.id, id);
  if (!t) return fail(NOT_FOUND, 404);
  if (t.assignee !== me.tg_id && !isOwner) return fail('Закрыть обращение может тот, кто его ведёт, или владелец.', 403);
  if (t.status !== 'open') return fail(CLOSED);
  if (!chatWritable(ev)) return fail(READ_ONLY);
  const users = await allUsers(db);
  const author = users.find((u) => u.tg_id === t.user_id);
  const now = Date.now();
  const done = `${THREAD} AND closed_at = ? AND closed_by = ?)`;
  const g = [t.id, now, me.tg_id];
  const stmts = [
    db.prepare("UPDATE support_threads SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ? AND status = 'open'").bind(now, me.tg_id, t.id),
    enqueueIfStmt(db, t.user_id, msg(
      `✅ Организатор ${bold(me)} закрыл(а) твоё обращение в событии ${title(ev)}. Если вопрос остался — просто напиши снова.`
    ), done, ...g),
    auditIfStmt(db, ev.id, me.tg_id, 'support.close', displayName(author), done, ...g),
  ];
  if (t.assignee && t.assignee !== me.tg_id) {
    stmts.push(enqueueIfStmt(db, t.assignee, msg(
      `✅ ${bold(me)} закрыл(а) обращение ${bold(author)} (${title(ev)}).`, { disable_notification: true }
    ), done, ...g));
  }
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) return fail(CLOSED);
  return { ok: true };
}

// ---------- счётчики ----------

// Для event.get: участнику — есть ли кому писать, открытое обращение, непрочитанные ответы; админу — ничьи и
// непрочитанные во взятых им. Один запрос.
export async function supportCounts(db, ev, me, { member, admin }) {
  const r = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE is_admin = 1 AND registered = 1 AND tg_id != ?1) AS admins,
         (SELECT COUNT(*) FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
           WHERE t.event_id = ?2 AND t.user_id = ?1 AND m.from_admin = 1 AND m.read_at = 0) AS answers,
         (SELECT t.assignee FROM support_threads t WHERE t.event_id = ?2 AND t.user_id = ?1 AND t.status = 'open') AS assignee,
         (SELECT u.name FROM support_threads t JOIN users u ON u.tg_id = t.assignee
           WHERE t.event_id = ?2 AND t.user_id = ?1 AND t.status = 'open') AS assignee_name,
         (SELECT COUNT(*) FROM support_threads WHERE event_id = ?2 AND status = 'open' AND assignee = 0 AND user_id != ?1) AS waiting,
         (SELECT COUNT(*) FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
           WHERE t.event_id = ?2 AND t.status = 'open' AND t.assignee = ?1 AND m.from_admin = 0 AND m.read_at = 0) AS fresh`
    )
    .bind(me.tg_id, ev.id)
    .first();
  const out = {};
  if (member) {
    out.support = {
      available: r.admins > 0,
      open: r.assignee !== null && r.assignee !== undefined,
      assignee_name: r.assignee ? r.assignee_name || 'организатор' : '',
      unread: r.answers,
    };
  }
  if (admin) out.support_admin = { waiting: r.waiting, unread: r.fresh };
  return out;
}

// Для «me»: непрочитанное по эвентам (ответы участнику; админу — ещё ничьи и сообщения во взятых им)
export async function supportUnreadByEvent(db, me) {
  const parts = [
    `SELECT t.event_id, COUNT(*) AS n FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
      WHERE t.user_id = ?1 AND m.from_admin = 1 AND m.read_at = 0 GROUP BY t.event_id`,
  ];
  if (me.is_admin) {
    parts.push(
      `SELECT event_id, COUNT(*) AS n FROM support_threads WHERE status = 'open' AND assignee = 0 AND user_id != ?1 GROUP BY event_id`,
      `SELECT t.event_id, COUNT(*) AS n FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
        WHERE t.status = 'open' AND t.assignee = ?1 AND m.from_admin = 0 AND m.read_at = 0 GROUP BY t.event_id`,
    );
  }
  const { results } = await db.prepare(parts.join(' UNION ALL ')).bind(me.tg_id).all();
  const out = {};
  for (const r of results) out[r.event_id] = (out[r.event_id] || 0) + r.n;
  return out;
}

// ---------- снятие прав админа (R9) ----------

// Операторы: открытые обращения админа adminId снова ничьи; админам — «снова ничьё» с кнопкой «Взять», участнику —
// «снова ждёт ответа». Список обращений читается заранее (threads из returnableThreads).
export async function returnThreadsStmts(db, settings, users, adminId) {
  const { results: threads } = await db
    .prepare(
      `SELECT t.id, t.event_id, t.user_id, e.title FROM support_threads t JOIN events e ON e.id = t.event_id
        WHERE t.assignee = ? AND t.status = 'open'`
    )
    .bind(adminId)
    .all();
  if (!threads.length) return [];
  const stmts = [db.prepare("UPDATE support_threads SET assignee = 0, taken_at = 0 WHERE assignee = ? AND status = 'open'").bind(adminId)];
  for (const t of threads) {
    const ev = { id: t.event_id, title: t.title };
    const author = users.find((u) => u.tg_id === t.user_id);
    for (const a of adminRecipients(users, [adminId, t.user_id])) {
      stmts.push(enqueueIfStmt(db, a.tg_id, msg(`🔄 Обращение ${bold(author)} (${title(ev)}) снова ничьё.`, {
        reply_markup: adminKeyboard(settings, ev, t.id, true),
      }), '1'));
    }
    stmts.push(
      enqueueIfStmt(db, t.user_id, msg(`🔄 Твоё обращение в событии ${title(ev)} снова ждёт ответа организатора.`), '1'),
      auditIfStmt(db, t.event_id, 0, 'support.return', displayName(author), '1'),
    );
  }
  return stmts;
}

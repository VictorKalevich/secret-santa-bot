// Обращения участника к организаторам (012). Обращение привязано к эвенту и участнику; ведёт его один админ
// (assignee, 0 — ничьё). Переписку видят: участник; ничьё — все админы; взятое — ответственный и владелец (R7).
// Каждое изменение — один batch помощника atomic (020): уведомления и журнал стоят перед изменением и проверяют прежнее
// состояние, которое изменение отменяет (обращение открыто, ничьё, его ведёт …); изменение — последним, по нему узнаётся
// исход. Второй из одновременных вызовов (даже того же человека в ту же миллисекунду) видит уже изменённое обращение и
// ничего не рассылает. Сообщения людям — только через outbox.

import { getUser, enqueueIfStmt, auditIfStmt } from './db.js';
import { atomic } from './claim.js';
import { msg, q, escapeHtml, shortTitle, displayName, adminRecipients, openAppButton, cleanText, SUPPORT_READ_ONLY } from './format.js';
import { chatWritable } from './status.js';
import { MAX_CHARS, tooLong } from './chat.js';
import { no } from './result.js';
import { tx, tjoin } from './i18n/index.js';

export const NO_SUPPORT_RECIPIENTS = tx('support.noRecipients');
export const CLOSED = tx('support.closed');
export const NOT_FOUND = tx('support.notFound');
export const OWN_THREAD = tx('support.ownThread');
const SEND_FAILED = tx('support.sendFailed');
const NO_OPEN = tx('support.noOpen');

const title = (ev) => q({ title: shortTitle(ev.title) });
// Имя человека для сообщения бота (HTML); в тексте словаря — <b>{name}</b>
const named = (u) => escapeHtml(displayName(u));

function checkText(raw) {
  const text = cleanText(raw);
  if (!text) return { error: tx('support.empty') };
  if (text.length > MAX_CHARS) return { error: tooLong(text.length) };
  return { text };
}

// Кнопки уведомлений: участнику — ответ «в эвент», админу — взять или ответить в обращение
const userKeyboard = (settings, ev) => ({ inline_keyboard: [[
  { text: tx('support.replyButton'), callback_data: `sup:u:${ev.id}` },
  openAppButton(settings, tx('support.openButton'), { event: ev.id, support: 'my' }),
]] });
const adminKeyboard = (settings, ev, id, take) => ({ inline_keyboard: [[
  take ? { text: tx('support.takeButton'), callback_data: `sup:take:${id}` } : { text: tx('support.replyButton'), callback_data: `sup:a:${id}` },
  openAppButton(settings, tx('support.openButton'), { event: ev.id, support: id }),
]] });

export const supportAvailable = (users, userId) => adminRecipients(users, [userId]).length > 0;

const threadQuery = (db, eventId, id) => db.prepare('SELECT * FROM support_threads WHERE id = ? AND event_id = ?').bind(Number(id) || 0, eventId);

async function threadOf(db, eventId, id) {
  return threadQuery(db, eventId, id).first();
}

// Обращение по одному id — без события: кнопки и режим ответа бота знают только его (029)
export const threadById = (db, id) => db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(Number(id) || 0).first();

// Что мешает организатору me ответить в обращение t события ev (029): одно правило для бота, ответа в API и признака
// «можно писать» экрана обращения. Тексты и порядок отказов — у вызывающих (они прежние и в углах разные).
export const replyBlocks = (t, me, ev) => ({
  closed: t.status !== 'open',
  own: t.user_id === me.tg_id,
  other: !!t.assignee && t.assignee !== me.tg_id, // ведёт другой; ничьё берётся ответом
  readOnly: !chatWritable(ev),
});

// Условия «обращение id …» для операторов batch (020: выражения целиком, скобки закрыты)
const OPEN = "EXISTS (SELECT 1 FROM support_threads WHERE id = ? AND status = 'open')"; // открыто
const LED_BY = 'EXISTS (SELECT 1 FROM support_threads WHERE id = ? AND assignee = ?)'; // ведёт assignee (0 — ничьё)
// Ведёт assignee или ничьё (закрытие участником: уведомить ответственного или, если ничьё, — каждого админа)
const LED_BY_OR_FREE = 'EXISTS (SELECT 1 FROM support_threads WHERE id = ? AND (assignee = 0 OR assignee = ?))';

// ---------- участник ----------

// Обращения участника в эвенте (до 10 последних, старые сначала); ответы организаторов помечаются прочитанными
export async function participantView(ctx, ev) {
  const { db, me } = ctx;
  const LAST = 'SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10';
  const r = await ctx.read({
    threads: db.prepare(LAST).bind(ev.id, me.tg_id),
    messages: db.prepare(`SELECT * FROM support_messages WHERE thread_id IN (SELECT id FROM (${LAST})) ORDER BY id`).bind(ev.id, me.tg_id),
    users: true,
  });
  const threads = r.threads.reverse();
  const { users, messages } = r;
  const byId = new Map(users.map((u) => [u.tg_id, u]));
  if (threads.length) {
    const ids = threads.map((t) => t.id);
    const marks = ids.map(() => '?').join(',');
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
        id: m.id, mine: !m.from_admin, author: m.from_admin ? displayName(byId.get(m.sender)) : '',
        text: m.text, created_at: m.created_at,
      })),
    })),
  };
}

// Сообщение участника: в открытое обращение или новое (одно открытое на эвент — уникальный индекс)
export async function sendFromUser(ctx, ev, rawText, retry = true) {
  const { db, me } = ctx;
  const t = checkText(rawText);
  if (t.error) return no(t.error);
  if (!chatWritable(ev)) return no(SUPPORT_READ_ONLY);
  const MY_OPEN = "SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? AND status = 'open'";
  const r = await ctx.read({ open: db.prepare(MY_OPEN).bind(ev.id, me.tg_id), users: true, settings: true });
  const { settings, users } = r;
  const admins = adminRecipients(users, [me.tg_id]);
  if (!admins.length) return no(NO_SUPPORT_RECIPIENTS);
  let thread = r.open[0] ?? null;
  let created = false;
  if (!thread) {
    thread = await db
      .prepare("INSERT OR IGNORE INTO support_threads (event_id, user_id, status, created_at) VALUES (?, ?, 'open', ?) RETURNING *")
      .bind(ev.id, me.tg_id, Date.now())
      .first();
    created = !!thread;
    // Одновременно открыли из другого окна — пишем в него
    if (!thread) thread = await db.prepare(MY_OPEN).bind(ev.id, me.tg_id).first();
    if (!thread) return no(SEND_FAILED);
  }
  const now = Date.now();
  const body = { name: named(me), title: title(ev), text: escapeHtml(t.text) };
  const unassigned = created
    ? { text: tx('support.notice.opened', body), quiet: false }
    : { text: tx('support.notice.added', body), quiet: true };
  // Всё — пока обращение открыто, то есть ровно тогда, когда запишется и само сообщение (оно — последним, 020)
  const open = atomic(db, OPEN, thread.id);
  // Отвечая, участник видел ответы организатора — помечаем их прочитанными
  open.where('UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 1 AND read_at = 0', now, thread.id);
  // Ничьё — всем админам; взятое — только ответственному (кто именно — решает состояние на момент записи)
  for (const a of admins) {
    open.and(LED_BY, thread.id, 0).enqueue(a.tg_id, msg(unassigned.text, {
      disable_notification: unassigned.quiet, reply_markup: adminKeyboard(settings, ev, thread.id, true),
    }));
  }
  for (const a of admins) {
    open.and(LED_BY, thread.id, a.tg_id).enqueue(a.tg_id, msg(tx('support.notice.writes', body), {
      reply_markup: adminKeyboard(settings, ev, thread.id, false),
    }));
  }
  if (created) open.audit(ev.id, me.tg_id, 'support.open', displayName(me));
  open.claim(db.prepare(`INSERT INTO support_messages (thread_id, sender, from_admin, text, created_at) SELECT ?, ?, 0, ?, ? WHERE ${open.sql} RETURNING id, created_at`)
    .bind(thread.id, me.tg_id, t.text, now, ...open.args));
  const { claim } = await open.run();
  const row = claim.results[0];
  if (!row) {
    // Обращение закрыли между чтением и записью — следующее сообщение открывает новое
    return retry ? sendFromUser(ctx, ev, rawText, false) : no(SEND_FAILED);
  }
  return { ok: true, thread: thread.id, created, message: { id: row.id, mine: true, author: '', text: t.text, created_at: row.created_at } };
}

export async function closeByUser(ctx, ev) {
  const { db, me } = ctx;
  if (!chatWritable(ev)) return no(SUPPORT_READ_ONLY);
  const thread = await db.prepare("SELECT * FROM support_threads WHERE event_id = ? AND user_id = ? AND status = 'open'").bind(ev.id, me.tg_id).first();
  if (!thread) return no(NO_OPEN);
  const users = await ctx.users();
  // Уведомления и журнал — пока обращение открыто, закрытие — последним (020)
  const open = atomic(db, OPEN, thread.id);
  // Ответственному (или всем админам, если обращение ничьё) — без звука
  for (const a of adminRecipients(users, [me.tg_id])) {
    open.and(LED_BY_OR_FREE, thread.id, a.tg_id).enqueue(a.tg_id, msg(tx('support.notice.closedByUser', { name: named(me), title: title(ev) }), {
      disable_notification: true,
    }));
  }
  open.audit(ev.id, me.tg_id, 'support.close', displayName(me));
  open.claim(db.prepare("UPDATE support_threads SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ? AND status = 'open'").bind(Date.now(), me.tg_id, thread.id));
  if (!(await open.run()).won) return no(NO_OPEN);
  return { ok: true };
}

// ---------- админ ----------

const canRead = (t, me, isOwner) => isOwner || !t.assignee || t.assignee === me.tg_id;

// Список обращений эвента для панели: открытые сверху, затем до 20 последних закрытых. Тексты не отдаются.
export const adminListQuery = (db, ev) => db
    .prepare(
      `SELECT t.*,
              (SELECT MAX(created_at) FROM support_messages m WHERE m.thread_id = t.id) AS last_at,
              (SELECT COUNT(*) FROM support_messages m WHERE m.thread_id = t.id AND m.from_admin = 0 AND m.read_at = 0) AS fresh
         FROM support_threads t WHERE t.event_id = ?
        ORDER BY (t.status = 'open') DESC, COALESCE((SELECT MAX(id) FROM support_messages m WHERE m.thread_id = t.id), 0) DESC, t.id DESC
        LIMIT 80`
    )
    .bind(ev.id);

export function adminListView(results, users, me, isOwner) {
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
export async function adminThread(ctx, ev, id) {
  const { db, me } = ctx;
  const tid = Number(id) || 0;
  const r = await ctx.read({
    thread: threadQuery(db, ev.id, tid),
    messages: db.prepare('SELECT * FROM support_messages WHERE thread_id = ? AND EXISTS (SELECT 1 FROM support_threads WHERE id = ? AND event_id = ?) ORDER BY id')
      .bind(tid, tid, ev.id),
    users: true,
  });
  const t = r.thread[0];
  if (!t) return no(NOT_FOUND, 404);
  const { users } = r;
  const byId = new Map(users.map((u) => [u.tg_id, u]));
  if (!canRead(t, me, await ctx.isOwner())) {
    return no(tx('support.hidden', { name: displayName(byId.get(t.assignee)) }), 403);
  }
  const results = r.messages;
  if (t.assignee === me.tg_id && results.some((m) => !m.from_admin && !m.read_at)) {
    await db.prepare('UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 0 AND read_at = 0').bind(Date.now(), t.id).run();
  }
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
      writable: !Object.values(replyBlocks(t, me, ev)).some(Boolean),
    },
    messages: results.map((m) => ({
      id: m.id, mine: m.sender === me.tg_id, from_admin: !!m.from_admin, author: displayName(byId.get(m.sender)),
      text: m.text, created_at: m.created_at,
    })),
    // Кому можно передать (без автора и нынешнего ответственного) — выбор в шторке обращения
    admins: adminRecipients(users, [t.user_id, t.assignee]).map((u) => ({ id: u.tg_id, name: displayName(u) })),
  };
}

// Взять ничьё обращение t (020): уведомления и журнал — в пакет free (условие «обращение открыто и ничьё»), перед
// захватом; возвращает сам захват — его ставит вызывающий. participant: уведомить участника (не нужно, если он сразу
// получит ответ с именем организатора).
function takeInto(free, db, users, ev, t, me, { participant = true } = {}) {
  const author = users.find((u) => u.tg_id === t.user_id);
  for (const a of adminRecipients(users, [me.tg_id, t.user_id])) {
    free.enqueue(a.tg_id, msg(tx('support.notice.taken', { name: named(me), author: named(author), title: title(ev) }), {
      disable_notification: true,
    }));
  }
  free.audit(ev.id, me.tg_id, 'support.take', displayName(author));
  if (participant) free.enqueue(t.user_id, msg(tx('support.user.taken', { title: title(ev), name: named(me) })));
  return db.prepare("UPDATE support_threads SET assignee = ?, taken_at = ? WHERE id = ? AND status = 'open' AND assignee = 0")
    .bind(me.tg_id, Date.now(), t.id);
}

// Пакет «обращение t открыто и его ведёт assignee» (0 — ничьё)
const ledBy = (db, t, assignee) => atomic(db, OPEN, t.id).and(LED_BY, t.id, assignee);

async function taken(db, t) {
  const cur = await threadById(db, t.id);
  if (!cur || cur.status !== 'open') return no(CLOSED);
  const who = await getUser(db, cur.assignee);
  return no(tx('support.alreadyTaken', { name: displayName(who) }));
}

export async function take(ctx, ev, id) {
  const { db, me } = ctx;
  const t = await threadOf(db, ev.id, id);
  if (!t) return no(NOT_FOUND, 404);
  if (t.status !== 'open') return no(CLOSED);
  if (t.user_id === me.tg_id) return no(tx('support.takeOwn'));
  if (t.assignee === me.tg_id) return { ok: true, thread: t };
  if (t.assignee) return taken(db, t);
  if (!chatWritable(ev)) return no(SUPPORT_READ_ONLY);
  const users = await ctx.users();
  const free = ledBy(db, t, 0);
  free.claim(takeInto(free, db, users, ev, t, me));
  if (!(await free.run()).won) return taken(db, t);
  return { ok: true, thread: { ...t, assignee: me.tg_id } };
}

// Ответ организатора: ничьё обращение берётся этим ответом; чужое — отказ (владелец сначала передаёт себе)
export async function sendFromAdmin(ctx, ev, id, rawText) {
  const { db, me } = ctx;
  const checked = checkText(rawText);
  if (checked.error) return no(checked.error);
  const t = await threadOf(db, ev.id, id);
  if (!t) return no(NOT_FOUND, 404);
  const blocks = replyBlocks(t, me, ev);
  if (blocks.closed) return no(CLOSED);
  if (blocks.own) return no(OWN_THREAD);
  if (blocks.readOnly) return no(SUPPORT_READ_ONLY);
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  if (blocks.other) return no(tx('support.ledBy', { name: displayName(users.find((u) => u.tg_id === t.assignee)) }));
  const now = Date.now();
  // Ничьё берётся этим ответом: уведомления о взятии — пока обращение ничьё, затем взятие (020)
  const open = atomic(db, OPEN, t.id);
  if (!t.assignee) {
    const free = open.and(LED_BY, t.id, 0);
    free.add(takeInto(free, db, users, ev, t, me, { participant: false }));
  }
  // Ответ, уведомление участнику и «прочитано» — пока обращение открыто и его ведёт отвечающий: то же условие, что у
  // записи ответа, которая идёт последней
  const mine = open.and(LED_BY, t.id, me.tg_id);
  const role = tx((await ctx.isOwner()) ? 'support.role.owner' : 'support.role.admin');
  mine.enqueue(t.user_id, msg(tx('support.user.reply', { role, name: named(me), title: title(ev), text: escapeHtml(checked.text) }), {
    reply_markup: userKeyboard(settings, ev),
  }));
  // Отвечая, организатор видел сообщения участника — помечаем их прочитанными (как в переписке Сант)
  mine.where('UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND from_admin = 0 AND read_at = 0', now, t.id);
  // Каждый ответ — запись журнала без текста (031); условие то же, что у записи ответа, поэтому они есть только вместе
  mine.audit(ev.id, me.tg_id, 'support.reply', displayName(users.find((u) => u.tg_id === t.user_id)));
  mine.claim(db.prepare(`INSERT INTO support_messages (thread_id, sender, from_admin, text, created_at) SELECT ?, ?, 1, ?, ? WHERE ${mine.sql} RETURNING id, created_at`)
    .bind(t.id, me.tg_id, checked.text, now, ...mine.args));
  const { claim } = await open.run();
  const row = claim.results[0];
  if (!row) return t.assignee ? no(CLOSED) : taken(db, t);
  return { ok: true, message: { id: row.id, mine: true, from_admin: true, author: displayName(me), text: checked.text, created_at: row.created_at } };
}

export async function pass(ctx, ev, id, toId) {
  const { db, me } = ctx;
  const t = await threadOf(db, ev.id, id);
  if (!t) return no(NOT_FOUND, 404);
  if (t.assignee !== me.tg_id && !(await ctx.isOwner())) return no(tx('support.passRights'), 403);
  if (t.status !== 'open') return no(CLOSED);
  if (!chatWritable(ev)) return no(SUPPORT_READ_ONLY);
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const to = users.find((u) => u.tg_id === Number(toId));
  // Администратору компании (050: гостю — нельзя) или себе — владельцу
  const allowed = to && to.registered && ((to.is_admin && !to.guest) || (to.tg_id === me.tg_id && (await ctx.isOwner())));
  if (!allowed || to.tg_id === t.user_id) return no(tx('support.passTarget'));
  if (to.tg_id === t.assignee) return no(tx('support.alreadyLed', { name: displayName(to) }));
  const author = users.find((u) => u.tg_id === t.user_id);
  const prev = users.find((u) => u.tg_id === t.assignee);
  // Уведомления и журнал — пока обращение открыто и его ведёт прежний ответственный; передача — последней (020)
  const before = ledBy(db, t, t.assignee);
  before.enqueue(t.user_id, msg(tx('support.user.passed', { title: title(ev), name: named(to) })));
  before.audit(ev.id, me.tg_id, 'support.pass', tjoin(' → ', [displayName(author), displayName(to)]));
  if (to.tg_id !== me.tg_id) {
    before.enqueue(to.tg_id, msg(tx('support.notice.passedToYou', { name: named(me), author: named(author), title: title(ev) }), {
      reply_markup: adminKeyboard(settings, ev, t.id, false),
    }));
  }
  // Владелец забрал или передал чужое обращение — прежний ответственный узнаёт об этом
  if (prev && prev.tg_id !== me.tg_id) {
    before.enqueue(prev.tg_id, msg(
      tx('support.notice.passed', { name: named(me), author: named(author), title: title(ev), to: named(to) }), { disable_notification: true }
    ));
  }
  before.claim(db.prepare("UPDATE support_threads SET assignee = ?, taken_at = ? WHERE id = ? AND status = 'open' AND assignee = ?")
    .bind(to.tg_id, Date.now(), t.id, t.assignee));
  if (!(await before.run()).won) return no(tx('support.passRace'));
  return { ok: true };
}

export async function closeByAdmin(ctx, ev, id) {
  const { db, me } = ctx;
  const t = await threadOf(db, ev.id, id);
  if (!t) return no(NOT_FOUND, 404);
  if (t.assignee !== me.tg_id && !(await ctx.isOwner())) return no(tx('support.closeRights'), 403);
  if (t.status !== 'open') return no(CLOSED);
  if (!chatWritable(ev)) return no(SUPPORT_READ_ONLY);
  const users = await ctx.users();
  const author = users.find((u) => u.tg_id === t.user_id);
  // Уведомления и журнал — пока обращение открыто, закрытие — последним (020)
  const open = atomic(db, OPEN, t.id);
  const role = tx((await ctx.isOwner()) ? 'support.role.owner' : 'support.role.admin');
  open.enqueue(t.user_id, msg(tx('support.user.closed', { role, name: named(me), title: title(ev) })));
  open.audit(ev.id, me.tg_id, 'support.close', displayName(author));
  if (t.assignee && t.assignee !== me.tg_id) {
    open.enqueue(t.assignee, msg(tx('support.notice.closed', { name: named(me), author: named(author), title: title(ev) }), {
      disable_notification: true,
    }));
  }
  open.claim(db.prepare("UPDATE support_threads SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ? AND status = 'open'")
    .bind(Date.now(), me.tg_id, t.id));
  if (!(await open.run()).won) return no(CLOSED);
  return { ok: true };
}

// ---------- счётчики ----------

// Для event.get: участнику — есть ли кому писать (организаторы компании события, 050), открытое обращение,
// непрочитанные ответы; админу — ничьи и непрочитанные во взятых им. Один запрос.
export const supportCountsQuery = (db, ev, me) => db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM company_members cm JOIN users u ON u.tg_id = cm.user_id
           WHERE cm.company_id = ?3 AND cm.is_admin = 1 AND u.registered = 1 AND cm.user_id != ?1) AS admins,
         (SELECT COUNT(*) FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
           WHERE t.event_id = ?2 AND t.user_id = ?1 AND m.from_admin = 1 AND m.read_at = 0) AS answers,
         (SELECT t.assignee FROM support_threads t WHERE t.event_id = ?2 AND t.user_id = ?1 AND t.status = 'open') AS assignee,
         (SELECT u.name FROM support_threads t JOIN users u ON u.tg_id = t.assignee
           WHERE t.event_id = ?2 AND t.user_id = ?1 AND t.status = 'open') AS assignee_name,
         (SELECT COUNT(*) FROM support_threads WHERE event_id = ?2 AND status = 'open' AND assignee = 0 AND user_id != ?1) AS waiting,
         (SELECT COUNT(*) FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
           WHERE t.event_id = ?2 AND t.status = 'open' AND t.assignee = ?1 AND m.from_admin = 0 AND m.read_at = 0) AS fresh`
    )
    .bind(me.tg_id, ev.id, ev.company_id);

export function supportCountsView(rows, { member, admin }) {
  const r = rows[0];
  const out = {};
  if (member) {
    out.support = {
      available: r.admins > 0,
      open: r.assignee !== null && r.assignee !== undefined,
      assignee_name: r.assignee ? r.assignee_name || tx('support.assigneeFallback') : '',
      unread: r.answers,
    };
  }
  if (admin) out.support_admin = { waiting: r.waiting, unread: r.fresh };
  return out;
}

// Для «me»: непрочитанное по эвентам (ответы участнику; админу — ещё ничьи в событиях компаний, где он администратор
// (050), и сообщения во взятых им)
export function supportUnreadQuery(db, me) {
  const parts = [
    `SELECT t.event_id, COUNT(*) AS n FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
      WHERE t.user_id = ?1 AND m.from_admin = 1 AND m.read_at = 0 GROUP BY t.event_id`,
  ];
  if (me.is_admin) {
    parts.push(
      `SELECT event_id, COUNT(*) AS n FROM support_threads WHERE status = 'open' AND assignee = 0 AND user_id != ?1
          AND event_id IN (SELECT e.id FROM events e JOIN company_members cm ON cm.company_id = e.company_id
                            WHERE cm.user_id = ?1 AND cm.is_admin = 1)
        GROUP BY event_id`,
      // t.assignee != 0 — по частичному индексу взятых открытых обращений support_threads_taken (055)
      `SELECT t.event_id, COUNT(*) AS n FROM support_messages m JOIN support_threads t ON t.id = m.thread_id
        WHERE t.status = 'open' AND t.assignee = ?1 AND t.assignee != 0 AND m.from_admin = 0 AND m.read_at = 0 GROUP BY t.event_id`,
    );
  }
  return db.prepare(parts.join(' UNION ALL ')).bind(me.tg_id);
}

export function supportUnreadFrom(results) {
  const out = {};
  for (const r of results) out[r.event_id] = (out[r.event_id] || 0) + r.n;
  return out;
}

// ---------- снятие прав админа (R9) ----------

// Операторы: открытые обращения админа adminId в событиях компании companyId (050) снова ничьи; админам компании
// (users — её люди) — «снова ничьё» с кнопкой «Взять», участнику — «снова ждёт ответа». Список обращений читается заранее.
// guard — условие всех операторов (024: снятие прав — пока он админ); по умолчанию — без условия, как раньше
export async function returnThreadsStmts(db, settings, users, adminId, companyId, [guard, ...args] = ['1']) {
  const { results: threads } = await db
    .prepare(
      `SELECT t.id, t.event_id, t.user_id, e.title FROM support_threads t JOIN events e ON e.id = t.event_id
        WHERE t.assignee = ? AND t.status = 'open' AND e.company_id = ?`
    )
    .bind(adminId, companyId)
    .all();
  if (!threads.length) return [];
  const stmts = [db.prepare(
    `UPDATE support_threads SET assignee = 0, taken_at = 0
      WHERE assignee = ? AND status = 'open' AND event_id IN (SELECT id FROM events WHERE company_id = ?) AND (${guard})`
  ).bind(adminId, companyId, ...args)];
  for (const t of threads) {
    const ev = { id: t.event_id, title: t.title };
    const author = users.find((u) => u.tg_id === t.user_id);
    for (const a of adminRecipients(users, [adminId, t.user_id])) {
      stmts.push(enqueueIfStmt(db, a.tg_id, msg(tx('support.notice.returned', { author: named(author), title: title(ev) }), {
        reply_markup: adminKeyboard(settings, ev, t.id, true),
      }), guard, ...args));
    }
    stmts.push(
      enqueueIfStmt(db, t.user_id, msg(tx('support.user.returned', { title: title(ev) })), guard, ...args),
      auditIfStmt(db, t.event_id, 0, 'support.return', displayName(author), guard, ...args),
    );
  }
  return stmts;
}

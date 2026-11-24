// Обработка сообщений в чате с ботом (webhook от Telegram).
// 029: у каждой команды и каждого вида кнопки — свой обработчик; запросов к базе здесь нет (чтения — функциями модулей).
// 050: обработчик, который нашёл событие, дальше работает с контекстом компании события (ctx.in(ev.company_id)).

import {
  getUser, createUser, createUserStmt, updateUser, updateUserStmt, pairOfSanta, pairOfWard, getEvent, getEventByInvite, getMember,
  memberQuery, addMemberStmt, clearRemovedStmt, joinCompanyStmt,
} from './db.js';
import { tgApi } from './telegram.js';
import {
  escapeHtml, msg, q, openAppButton, appKeyboard, oneLine, shortTitle, NOT_REGISTERED, ADMIN_ONLY, NOT_MEMBER, CHAT_READ_ONLY,
  SUPPORT_READ_ONLY,
} from './format.js';
import { tx, tjoin, isText } from './i18n/index.js';
import { isFinished, chatWritable } from './status.js';
import { MAX_CHARS, sendChatMessage } from './chat.js';
import { setOwner, ownerLinkCode, claimOwnerLink } from './roles.js';
import { joinByInvite, decideRequest, rejoinBlocked, requestRejected, register } from './membership.js';
import { openContext } from './context.js';
import {
  sendFromUser, sendFromAdmin, take, supportAvailable, threadById, replyBlocks,
  CLOSED as THREAD_CLOSED, NOT_FOUND as THREAD_NOT_FOUND, OWN_THREAD, NO_SUPPORT_RECIPIENTS,
} from './support.js';
import { menuEvents } from './participant.js';
import { maskLabel } from './looks.js';
import { claimCompanyOwner, companyByOwnerCode, menuCompanyTitles, openBot, NEW_COMPANY_OWNER, OWNER_LINK_GONE } from './companies.js';

const NAME_PROMPT = tx('bot.name.prompt');
const NAME_SAVED = tx('bot.name.saved');
const STALE_INVITE = tx('bot.invite.stale');
// Удалённый организатором при запрете возврата (010, FR-1022); админам об этой попытке ничего не приходит
const REMOVED = (ev) => tx('bot.invite.removed', { title: q(ev) });
const registrationClosed = (ev) => tx('bot.invite.closed', { title: q(ev) });
const REPLY_EXPIRED = tx('bot.reply.expired');
// Хвост подсказки «напиши сообщение» — у переписки и обращений
const REPLY_HINT = tx('bot.reply.hint', { n: MAX_CHARS });
// Текст после приветствия — через пустую строку
const afterIntro = (intro, text) => (intro ? tjoin('\n\n', [intro, text]) : text);
// Отказ в чате — с «❌»; событие не нашлось — тот же текст, что у API
const failed = (error) => tx('bot.reply.failed', { error });
const EVENT_NOT_FOUND = tx('api.noEvent');

// ---------- режим ответа (pending): сборка и разбор в одном месте (019) ----------
// В переписку: msg_<ward|santa>:<эвент>:<собеседник>:<время нажатия>; старый формат (до 009) — без двух последних
const REPLY_MODE = /^msg_(ward|santa):(\d+)(?::(\d+):(\d+))?$/;
// 012: в обращение — участник пишет в эвент (sup_u:<эвент>:<мс>), админ — в обращение (sup_a:<id>:<мс>)
const SUPPORT_MODE = /^sup_(u|a):(\d+):(\d+)$/;
const REPLY_WINDOW_MS = 60 * 60 * 1000;
const replyPending = (side, eventId, otherId) => `msg_${side}:${eventId}:${otherId}:${Date.now()}`;
const supportPending = (who, id) => `sup_${who}:${id}:${Date.now()}`;
// → { kind: 'reply', side, event, other, since } | { kind: 'support', who, id, since } | null. У старого формата since = 0 —
// «время ответа истекло»
function parsePending(pending) {
  const rm = REPLY_MODE.exec(pending);
  if (rm) return { kind: 'reply', side: rm[1], event: rm[2], other: Number(rm[3] || 0), since: Number(rm[4] || 0) };
  const sm = SUPPORT_MODE.exec(pending);
  if (sm) return { kind: 'support', who: sm[1], id: sm[2], since: Number(sm[3]) };
  return null;
}
const inReplyMode = (pending) => parsePending(pending) !== null;
const expired = (since) => !since || Date.now() - since > REPLY_WINDOW_MS;

// ---------- имя при регистрации ----------
// Одно правило для имени текстом и имени из Telegram (047): одна строка, 1–40 символов, не команда
const nameOk = (name) => !!name && !name.startsWith('/') && name.length <= 40;

// Имя из профиля Telegram для «Участвовать как …» (047): имя и фамилия, вместе не подходят — только имя; '' — нечего
// предложить
function telegramName(from) {
  return [oneLine(`${from?.first_name || ''} ${from?.last_name || ''}`), oneLine(from?.first_name)].find(nameOk) || '';
}

// Просьба имени (047): с подходящим именем из Telegram — оно и кнопки (каждая своей строкой: длинное имя на кнопке в
// одной строке с другой обрезалось бы); без него — прежний вопрос. intro — приветствие перед просьбой, joining — после
// пригласительной ссылки
function nameOffer(from, intro, joining) {
  const name = telegramName(from);
  if (!name) return msg(afterIntro(intro, NAME_PROMPT));
  return msg(afterIntro(intro, tx('bot.name.offer', { name: escapeHtml(name) })), { reply_markup: { inline_keyboard: [
    [{ text: tx(joining ? 'bot.name.join' : 'bot.name.continue', { name }), callback_data: 'reg:ok' }],
    [{ text: tx('bot.name.edit'), callback_data: 'reg:edit' }],
  ] } });
}

// Меню: идущие эвенты человека с кнопками переписки. Один запрос к базе на любое число эвентов (009, FR-913). 051: у
// человека с двумя и более видимыми компаниями рядом с событием — название компании (компании — из первого пакета вызова)
async function buildMenu(ctx, user, settings) {
  const results = await menuEvents(ctx.db, user.tg_id);
  const titles = await menuCompanyTitles(ctx, user.tg_id, new Set(results.map((e) => e.company_id)));
  const active = results.filter((e) => e.status === 'active');
  const finishedCount = results.length - active.length;
  const items = active.slice(0, 5);

  const lines = [tx('bot.menu.title'), ''];
  if (!items.length) {
    lines.push(tx(user.is_admin ? 'bot.menu.noEventsAdmin' : openBot(ctx.env) ? 'bot.menu.noEventsOpen' : 'bot.menu.noEvents'));
  } else {
    lines.push(tx('bot.menu.events'));
    for (const ev of items) {
      const letter = tx(ev.wishlist.trim() ? 'bot.menu.letterFilled' : 'bot.menu.letterEmpty');
      const draw = tx(!ev.draw_done ? 'bot.menu.drawAhead' : ev.has_ward ? 'bot.menu.wardAssigned' : 'bot.menu.awaitingInsert');
      lines.push(titles
        ? tx('bot.menu.eventInRoom', { title: q(ev), room: escapeHtml(titles.get(ev.company_id) ?? ''), letter, draw })
        : tx('bot.menu.event', { title: q(ev), letter, draw }));
    }
  }
  if (finishedCount) lines.push('', tx('bot.menu.finished', { n: finishedCount }));
  if (user.is_admin) {
    const owner = Number(settings.owner_id || 0) === user.tg_id;
    // 051: назначенный владелец компании
    const companyOwner = !owner && [...(await ctx.companies()).values()].some((c) => c.owner_id === user.tg_id);
    lines.push('', tx(owner ? 'bot.menu.botOwner' : companyOwner ? 'bot.menu.owner' : 'bot.menu.admin'));
  }
  const kb = [[openAppButton(settings)]];
  for (const ev of items.slice(0, 3)) {
    // shortTitle не разрывает эмодзи: кнопка с половинкой эмодзи сломала бы всё меню (009, FR-914)
    const row = [];
    if (ev.has_ward) row.push({ text: tx('bot.menu.toWard', { title: shortTitle(ev.title) }), callback_data: `msg:ward:${ev.id}` });
    if (ev.has_santa) row.push({ text: tx('bot.menu.toSanta', { title: shortTitle(ev.title) }), callback_data: `msg:santa:${ev.id}` });
    if (row.length) kb.push(row);
  }
  kb.push([{ text: tx('bot.menu.notify'), callback_data: 'notify' }]);
  return { text: tjoin('\n', lines), parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } };
}

// ---------- сообщение боту ----------

// Чат с человеком на время одного сообщения (029): контекст вызова, пользователь и ответы. Пользователь и настройки —
// одним пакетом (019); c.user обновляется вместе с ctx.me, когда запись перечитана (reload).
async function openChat(env, m) {
  const db = env.DB;
  const from = m.from;
  const ctx = await openContext(env, from.id);
  const call = tgApi(env, ctx.lang); // ответы — на языке человека (060)
  const settings = await ctx.settings();
  const c = {
    env, db, ctx, from, settings,
    text: (m.text || '').trim(),
    user: ctx.me,
    // payload — текст (строка или отложенный, 060) или сообщение целиком
    reply: (payload) => call('sendMessage', { chat_id: from.id, ...(isText(payload) ? msg(payload) : payload) }),
    sendMenu: async () => c.reply(await buildMenu(ctx, c.user, settings)),
    menuIfRegistered: () => (c.user?.registered ? c.sendMenu() : undefined),
    writeLetter: (text, ev) => ({ ...msg(text), ...appKeyboard(settings, tx('common.writeLetterButton'), { event: ev.id }) }),
    // joining — по умолчанию по ожиданию имени: name:<эвент>:<код> — после пригласительной ссылки
    askName: (intro = null, joining = c.user?.pending.startsWith('name:')) => c.reply(nameOffer(from, intro, joining)),
    setPending: (pending) => updateUser(db, from.id, { pending }),
    async reload() {
      c.user = ctx.me = await getUser(db, from.id);
    },
  };
  // Человек пишет боту или нажал кнопку регистрации — значит, бот у него не заблокирован (006, FR-609)
  if (c.user?.blocked_at) await updateUser(db, from.id, { blocked_at: 0 });
  return c;
}

export async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);

  const m = update.message;
  if (!m || !m.from || m.chat?.type !== 'private') return;
  const c = await openChat(env, m);
  const { text } = c;

  // Любая команда выключает режим ответа в переписку (009, FR-916) и в обращение (012): текст после неё не уйдёт собеседнику
  if (c.user && text.startsWith('/') && inReplyMode(c.user.pending)) {
    await c.setPending('');
    c.user.pending = '';
  }

  if (text.startsWith('/start')) return onStart(c);
  if (!c.user) return onStranger(c);
  if (text === '/cancel') return onCancel(c);
  if (c.user.pending.startsWith('name')) return onName(c);
  if (!c.user.registered) return openBot(c.env) ? onStranger(c) : c.askName();

  const mode = parsePending(c.user.pending);
  if (mode?.kind === 'reply') return onChatReply(c, mode);
  if (mode?.kind === 'support') return onSupportReply(c, mode);
  return c.sendMenu();
}

// Ответ на вступление по ссылке (joinByInvite); true — показать меню следом
async function replyJoin(c, ev, status) {
  switch (status) {
    case 'joined':
      await c.reply(c.writeLetter(tx('bot.invite.joined', { title: q(ev) }), ev));
      return true;
    case 'closed':
      await c.reply(registrationClosed(ev));
      return false;
    case 'removed':
      await c.reply(REMOVED(ev));
      return false;
    case 'request_pending':
      await c.reply(tx('bot.invite.requestPending', { title: q(ev) }));
      return false;
    case 'request_rejected':
      await c.reply(requestRejected(ev));
      return false;
    default:
      await c.reply(tx('bot.invite.requestSent', { title: q(ev) }));
      return false;
  }
}

// ---------- /start ----------
async function onStart(c) {
  const payload = c.text.split(/\s+/)[1] || '';
  // Ссылка со страницы /setup делает владельцем бота (002, FR-102) — один раз для текущего секрета (010, FR-1004)
  if (payload.startsWith('adm_') && payload === (await ownerLinkCode(c.env))) return onOwnerLink(c);
  // Пригласительная ссылка эвента (005; 009 — единая логика с вводом имени)
  if (payload.startsWith('inv_')) return onInvite(c, payload.slice(4));
  // Ссылка владельца компании (051)
  if (payload.startsWith('own_')) return onCompanyOwnerLink(c, payload.slice(4));
  if (c.user?.registered) return c.sendMenu();
  if (c.user && c.user.pending.startsWith('name')) return c.askName();
  return onStranger(c);
}

// Человек без ссылки и без имени (052): в закрытом боте — прежний ответ; в открытом — ожидание имени и просьба имени
// (047), после имени — меню, своя компания — в приложении
async function onStranger(c) {
  if (!openBot(c.env)) return c.reply(tx('bot.closedBot'));
  await (c.user ? c.setPending('name') : createUser(c.db, c.from.id, c.from.username, { pending: 'name' }));
  return c.askName(tx('bot.hello'), false);
}

async function onOwnerLink(c) {
  const { env, db, ctx, from, settings } = c;
  if (!(await claimOwnerLink(env))) {
    await c.reply(tx('bot.ownerLink.used'));
    return c.menuIfRegistered();
  }
  const prevOwnerId = await ctx.botOwnerId();
  if (!c.user) await createUser(db, from.id, from.username, { is_admin: true, pending: 'name' });
  ctx.forgetUsers(); // список пользователей изменился — setOwner читает его заново
  await setOwner(ctx, from.id, {
    via: 'link',
    prevOwnerId,
    newOwnerLabel: c.user?.name || from.first_name || (from.username ? '@' + from.username : ''),
  });
  settings.owner_id = String(from.id);
  await c.reload();
  if (!c.user.registered) {
    await c.setPending('name');
    return c.askName(tx('bot.ownerLink.hello'), false);
  }
  await c.reply(tx('bot.ownerLink.done'));
  return c.sendMenu();
}

// Ссылка владельца компании (051, контракт — раздел 4): зарегистрированный становится владельцем сразу, новый — после
// имени (ожидание name_own:<компания>:<код>), если код к тому времени тот же
const OWNER_LINK_REPLIES = {
  gone: OWNER_LINK_GONE,
  bot: tx('bot.roomLink.bot'),
  already: tx('bot.roomLink.already'),
  owner: tx('bot.roomLink.owner', { greeting: NEW_COMPANY_OWNER }),
};
async function onCompanyOwnerLink(c, code) {
  const { db, ctx, from } = c;
  if (c.user?.registered) {
    const status = await claimCompanyOwner(ctx, code, c.user);
    await c.reply(OWNER_LINK_REPLIES[status]);
    if (status === 'owner') {
      ctx.forgetUsers(); // права и компании изменились — меню читает их заново
      await c.reload();
    }
    return c.sendMenu();
  }
  const company = await companyByOwnerCode(db, code);
  if (!company) return c.reply(OWNER_LINK_GONE);
  const pending = `name_own:${company.id}:${code}`;
  await (c.user ? c.setPending(pending) : createUser(db, from.id, from.username, { pending }));
  return c.askName(NEW_COMPANY_OWNER, false);
}

// Запись участника и компания события одним пакетом (055): новичок ещё не человек компании — ctx.in не читает её отдельно
async function memberWithCompany(ctx, ev, userId) {
  return (await ctx.read({ member: memberQuery(ctx.db, ev.id, userId), inCompany: ev.company_id })).member[0] ?? null;
}

async function onInvite(c, code) {
  const { db, ctx, from, user } = c;
  const ev = await getEventByInvite(db, code);
  if (!ev) {
    await c.reply(STALE_INVITE);
    return c.menuIfRegistered();
  }
  const member = user ? await memberWithCompany(ctx, ev, from.id) : null;
  if (user?.registered) {
    // Участник открыл ссылку снова — даже после жеребьёвки и закрытия регистрации (009, FR-921)
    if (member) {
      await c.reply(tx('bot.invite.member', { title: q(ev) }));
      return c.sendMenu();
    }
    if (await replyJoin(c, ev, await joinByInvite(await ctx.in(ev.company_id), ev, user))) return c.sendMenu();
    return;
  }
  // Ещё без имени: сначала имя, вступление — после него (joinByInvite). Код ссылки запоминаем, чтобы после имени
  // не вступить по уже сменённой ссылке.
  if (!member && (isFinished(ev) || !ev.registration_open)) return c.reply(registrationClosed(ev));
  // Удалили ещё до ввода имени, а возврат запрещён (010): не добавляем и имя не спрашиваем
  if (!member && user && (await rejoinBlocked(db, ev, from.id))) return c.reply(REMOVED(ev));
  const pending = `name:${ev.id}:${code}`;
  // Человек компании события (050) — тем же пакетом, что запись или ожидание имени
  await db.batch([
    user ? updateUserStmt(db, from.id, { pending }) : createUserStmt(db, from.id, from.username, { pending }),
    joinCompanyStmt(db, ev.company_id, from.id),
  ]);
  // Без одобрения человек сразу виден организатору в списке (ещё без имени)
  if (!member && !ev.approval) await db.batch([addMemberStmt(db, ev, from.id), clearRemovedStmt(db, ev.id, from.id)]);
  return c.askName(tx('bot.helloEvent', { title: q(ev) }), true);
}

async function onCancel(c) {
  if (!c.user.registered) return c.askName();
  await c.setPending('');
  return c.reply(tx('bot.cancelled'));
}

// ---------- ввод имени при регистрации ----------
async function onName(c) {
  const name = oneLine(c.text);
  if (!nameOk(name)) return c.reply(tx('bot.name.rule'));
  if (!(await signUp(c, name))) return c.reply(NAME_SAVED);
}

// Имя сохранено — регистрация завершена (текстом или кнопкой «Участвовать как …», 047), затем вступление по
// запомненной ссылке. saved — сразу после записи (у кнопки — ответ на нажатие). false — имя уже сохранил другой вызов,
// ничего не отправлено
async function signUp(c, name, saved = async () => {}) {
  const { db, from } = c;
  const own = OWNER_PENDING.exec(c.user.pending);
  if (own) return signUpOwner(c, name, own[1], saved);
  const [, eid, code] = c.user.pending.split(':');
  const ev = Number(eid) ? await getEvent(db, eid) : null;
  const member = ev ? await memberWithCompany(c.ctx, ev, from.id) : null;
  const username = from.username || '';
  const ctx = (ev && (await c.ctx.in(ev.company_id))) || c.ctx;
  // Уже участник (вступил до имени) — организаторам «присоединяется» в том же пакете, что и имя
  if (!(await register(ctx, name, username, member ? ev : null))) return false;
  await saved();
  c.user = c.ctx.me = { ...c.user, name, username, registered: 1, pending: '' };
  const hello = tx('bot.niceToMeet', { name: escapeHtml(name) });
  if (!ev) {
    if (eid) await c.reply(afterIntro(hello, STALE_INVITE));
    else await c.reply(c.user.is_admin ? afterIntro(hello, tx('bot.createFirstEvent')) : hello);
  } else if (member) {
    await c.reply(c.writeLetter(afterIntro(hello, tx('bot.writeLetterFirst', { title: q(ev) })), ev));
  } else if (ev.invite_code !== code) {
    // Не участник (заявка, удалили до имени, сменили ссылку) — вступление как по ссылке (009, FR-922)
    await c.reply(afterIntro(hello, STALE_INVITE));
  } else {
    await c.reply(hello);
    const status = await joinByInvite(ctx, ev, c.user);
    if (!(await replyJoin(c, ev, status)) && status !== 'closed' && status !== 'removed') return true;
  }
  await c.sendMenu();
  return true;
}

// После ссылки владельца компании (051): имя, затем права — если код ссылки всё ещё тот же
const OWNER_PENDING = /^name_own:\d+:([a-z0-9]+)$/;
async function signUpOwner(c, name, code, saved) {
  if (!(await register(c.ctx, name, c.from.username || ''))) return false;
  await saved();
  c.user = c.ctx.me = { ...c.user, name, username: c.from.username || '', registered: 1, pending: '' };
  const owner = (await claimCompanyOwner(c.ctx, code, c.user)) === 'owner';
  if (owner) {
    c.ctx.forgetUsers();
    await c.reload();
  }
  await c.reply(afterIntro(tx('bot.niceToMeet', { name: escapeHtml(name) }), tx(owner ? 'bot.createFirstEvent' : 'bot.roomLink.gone')));
  await c.sendMenu();
  return true;
}

// ---------- ответ в переписку (003/005; 009 — привязан к собеседнику и истекает через час) ----------
async function onChatReply(c, mode) {
  const { db, ctx, from, text } = c;
  const toWard = mode.side === 'ward';
  if (!text) {
    await c.setPending('');
    return c.sendMenu();
  }
  if (expired(mode.since)) {
    await c.setPending('');
    return c.reply(REPLY_EXPIRED);
  }
  if (text.length > MAX_CHARS) {
    return c.reply(tx('bot.reply.tooLong', { n: text.length, max: MAX_CHARS }));
  }
  const ev = await getEvent(db, mode.event);
  await c.setPending('');
  if (!ev) return c.reply(failed(EVENT_NOT_FOUND));
  const res = await sendChatMessage(await ctx.in(ev.company_id), ev, from.id, toWard ? 'ward' : 'santa', text, { expectOther: mode.other });
  if (res.ok) return c.reply(tx(toWard ? 'bot.reply.toWardSent' : 'bot.reply.toSantaSent'));
  return c.reply(res.pairChanged ? res.error : failed(res.error));
}

// ---------- ответ в обращение к организатору (012) ----------
async function onSupportReply(c, mode) {
  const { db, ctx, from, text } = c;
  await c.setPending('');
  if (!text) return c.sendMenu();
  if (expired(mode.since)) return c.reply(REPLY_EXPIRED);
  if (mode.who === 'u') {
    const ev = await getEvent(db, mode.id);
    if (!ev || !(await getMember(db, ev.id, from.id))) return c.reply(failed(NOT_MEMBER));
    const res = await sendFromUser(await ctx.in(ev.company_id), ev, text);
    return c.reply(res.ok ? tx('bot.support.sent') : failed(res.error));
  }
  const ADMINS_ONLY = tx('bot.support.adminsOnly');
  if (!c.user.is_admin) return c.reply(ADMINS_ONLY);
  const t = await threadById(db, mode.id);
  const ev = t ? await getEvent(db, t.event_id) : null;
  if (!ev) return c.reply(failed(THREAD_NOT_FOUND));
  // Права — в компании события (050): тот же отказ
  const company = await ctx.in(ev.company_id);
  if (!company?.me.is_admin) return c.reply(ADMINS_ONLY);
  const res = await sendFromAdmin(company, ev, Number(mode.id), text);
  return c.reply(res.ok ? tx('bot.support.answered') : tx('bot.support.notSent', { error: res.error }));
}

// ---------- нажатие кнопки ----------

// Режимы уведомлений; подписи — bot.notify.mode.<режим>
const NOTIFY_MODES = ['sound', 'silent', 'off'];
const notifyLabel = (mode) => tx('bot.notify.mode.' + mode);

async function handleCallback(cq, env) {
  // Кнопки регистрации (047) нажимает человек без имени — до проверки «зарегистрирован»
  if (SIGNUP_BUTTON.test(cq.data || '')) return onSignupButton(cq, env);
  const db = env.DB;
  const from = cq.from;
  // Пользователь, настройки, его компании и владелец бота — одним пакетом (050: вместо одного чтения пользователя)
  const ctx = await openContext(env, from.id);
  const call = tgApi(env, ctx.lang); // ответы — на языке человека (060)
  const answer = (text) => call('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) });
  const user = ctx.me;
  if (user?.blocked_at) await updateUser(db, from.id, { blocked_at: 0 }); // 006, FR-609
  if (!user || !user.registered) return answer(NOT_REGISTERED);
  const k = {
    db, ctx, from, user, answer,
    send: (payload) => call('sendMessage', { chat_id: from.id, ...payload }),
    setPending: (pending) => updateUser(db, from.id, { pending }),
    // Нажатие отклонено — прежний режим ответа тоже выключается: текст не уйдёт туда, куда человек уже не целится
    async refuse(text) {
      if (inReplyMode(user.pending)) await k.setPending('');
      return answer(text);
    },
    // Режим ответа включён: подсказка, что и как написать
    async prompt(text) {
      await answer();
      return k.send(msg(tjoin('\n', [text, REPLY_HINT])));
    },
  };
  for (const [pattern, handler] of BUTTONS) {
    const found = pattern.exec(cq.data || '');
    if (found) return handler(k, found);
  }
  return answer();
}

// «✅ Участвовать / Продолжить как …» и «✏️ Изменить имя» под просьбой имени (047). Тот же чат, что у сообщения;
// ответ на нажатие — ровно один
const SIGNUP_BUTTON = /^reg:(ok|edit)$/;
async function onSignupButton(cq, env) {
  const c = await openChat(env, { from: cq.from });
  const call = tgApi(env, c.ctx.lang);
  const answer = (text) => call('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) });
  if (!c.user) return answer(NOT_REGISTERED);
  if (c.user.registered) return answer(NAME_SAVED);
  if (cq.data === 'reg:edit') {
    await answer();
    return c.reply(tx('bot.name.ask'));
  }
  // Имя из Telegram — в момент нажатия; стало неподходящим — прежний вопрос
  const name = telegramName(cq.from);
  if (!name) {
    await answer();
    return c.reply(NAME_PROMPT);
  }
  // Кнопки под просьбой больше не нужны
  const saved = () => Promise.all([
    answer(),
    cq.message && call('editMessageReplyMarkup', {
      chat_id: cq.from.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] },
    }),
  ]);
  if (!(await signUp(c, name, saved))) return answer(NAME_SAVED);
}

// «💬 Подопечному / Санте» в меню и «↩️ Ответить» под сообщением переписки
async function onReplyButton(k, [, side, eventId]) {
  const { db, from } = k;
  const toWard = side === 'ward';
  const ev = await getEvent(db, eventId);
  if (!ev) return k.refuse(EVENT_NOT_FOUND);
  const p = toWard ? await pairOfSanta(db, ev.id, from.id) : await pairOfWard(db, ev.id, from.id);
  if (!p) return k.refuse(tx(toWard ? 'chat.noWard' : 'chat.noSanta'));
  if (!chatWritable(ev)) return k.refuse(CHAT_READ_ONLY);
  // Режим ответа помнит собеседника и время нажатия (только на сервере): msg_<сторона>:<эвент>:<собеседник>:<мс>
  await k.setPending(replyPending(side, ev.id, toWard ? p.ward : p.santa));
  // 040: маска пары — Санте как «от чьего имени», подопечному — как он знает своего Санту
  const mask = maskLabel(p.mask, k.ctx.t);
  const title = q(ev);
  if (toWard) return k.prompt(mask ? tx('bot.reply.toWardMasked', { title, mask }) : tx('bot.reply.toWard', { title }));
  return k.prompt(mask ? tx('bot.reply.toSantaMasked', { title, mask }) : tx('bot.reply.toSanta', { title }));
}

// ---------- обращения к организатору (012) ----------
async function onSupportButton(k, [, kind, id]) {
  const { db, user } = k;
  if (kind === 'u') return onSupportAsk(k, id);
  if (!user.is_admin) return k.refuse(ADMIN_ONLY);
  const t = await threadById(db, id);
  const ev = t ? await getEvent(db, t.event_id) : null;
  if (!ev) return k.refuse(THREAD_NOT_FOUND);
  // Права — в компании события (050): тот же отказ
  const company = await k.ctx.in(ev.company_id);
  if (!company?.me.is_admin) return k.refuse(ADMIN_ONLY);
  const name = escapeHtml((await getUser(db, t.user_id))?.name || tx('bot.support.participant'));
  return kind === 'take' ? onSupportTake(k, company, t, ev, name) : onSupportAnswer(k, t, ev, name);
}

// Участник: «↩️ Ответить» под ответом организатора
async function onSupportAsk(k, eventId) {
  const { db, ctx, from } = k;
  const ev = await getEvent(db, eventId);
  if (!ev || !(await getMember(db, ev.id, from.id))) return k.refuse(NOT_MEMBER);
  if (!chatWritable(ev)) return k.refuse(SUPPORT_READ_ONLY);
  if (!supportAvailable(await (await ctx.in(ev.company_id)).users(), from.id)) return k.refuse(NO_SUPPORT_RECIPIENTS);
  await k.setPending(supportPending('u', ev.id));
  return k.prompt(tx('bot.support.ask', { title: q(ev) }));
}

// Админ: «🙋 Взять»
async function onSupportTake(k, ctx, t, ev, name) {
  const settings = await ctx.settings();
  const r = await take(ctx, ev, t.id);
  if (!r.ok) return k.refuse(r.error);
  await k.answer(tx('bot.support.takenAnswer'));
  return k.send(msg(tx('bot.support.taken', { name, title: q(ev) }), {
    reply_markup: { inline_keyboard: [[
      { text: tx('common.replyButton'), callback_data: `sup:a:${t.id}` },
      openAppButton(settings, tx('support.openButton'), { event: ev.id, support: t.id }),
    ]] },
  }));
}

// Админ: «↩️ Ответить» — правило то же, что у ответа из приложения (replyBlocks), порядок и тексты — бота
async function onSupportAnswer(k, t, ev, name) {
  const blocks = replyBlocks(t, k.user, ev);
  if (blocks.closed) return k.refuse(THREAD_CLOSED);
  if (blocks.own) return k.refuse(OWN_THREAD);
  if (blocks.other) {
    return k.refuse(tx('support.ledBy', { name: (await getUser(k.db, t.assignee))?.name || tx('bot.support.someoneElse') }));
  }
  if (blocks.readOnly) return k.refuse(SUPPORT_READ_ONLY);
  await k.setPending(supportPending('a', t.id));
  return k.prompt(tx(t.assignee ? 'bot.support.answer' : 'bot.support.answerTake', { name, title: q(ev) }));
}

// Решение по заявке на вступление (008): кнопки в сообщении админу
async function onRequestButton(k, [, id, decision]) {
  const approve = decision === 'a';
  if (!k.user.is_admin) return k.answer(ADMIN_ONLY);
  const r = await decideRequest(k.ctx, Number(id), k.from.id, approve);
  if (!r.ok) return k.answer(r.error);
  await k.answer(tx(approve ? 'bot.request.approvedAnswer' : 'bot.request.rejectedAnswer'));
  return k.send(msg(tx(approve ? 'bot.request.approved' : 'bot.request.rejected', { name: escapeHtml(r.name), title: q(r.ev) })));
}

async function onNotifyButton(k) {
  await k.answer();
  const mode = NOTIFY_MODES.includes(k.user.notify_mode) ? k.user.notify_mode : 'sound';
  return k.send(msg(
    tx('bot.notify.title', { mode: notifyLabel(mode) }),
    { reply_markup: { inline_keyboard: [NOTIFY_MODES.map((key) => ({ text: notifyLabel(key), callback_data: 'nm:' + key }))] } }
  ));
}

async function onNotifyMode(k, [, mode]) {
  if (!NOTIFY_MODES.includes(mode)) return k.answer();
  await updateUser(k.db, k.from.id, { notify_mode: mode });
  return k.answer(tx('bot.notify.saved', { mode: notifyLabel(mode) }));
}

// Вид кнопки (callback_data) → обработчик; первый подошедший
const BUTTONS = [
  [/^msg:(ward|santa):(\d+)$/, onReplyButton],
  [/^sup:(take|a|u):(\d+)$/, onSupportButton],
  [/^req:(\d+):(a|r)$/, onRequestButton],
  [/^notify$/, onNotifyButton],
  [/^nm:(.*)$/s, onNotifyMode],
];

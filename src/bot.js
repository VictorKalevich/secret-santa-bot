// Обработка сообщений в чате с ботом (webhook от Telegram).
// 029: у каждой команды и каждого вида кнопки — свой обработчик; запросов к базе здесь нет (чтения — функциями модулей).

import {
  getUser, createUser, updateUser, pairOfSanta, pairOfWard, getEvent, getEventByInvite, getMember, addMemberStmt, clearRemovedStmt,
} from './db.js';
import { tgApi } from './telegram.js';
import {
  escapeHtml, msg, q, openAppButton, appKeyboard, oneLine, shortTitle, NOT_REGISTERED, ADMIN_ONLY, CHAT_READ_ONLY, SUPPORT_READ_ONLY,
} from './format.js';
import { isFinished, chatWritable } from './status.js';
import { MAX_CHARS, sendChatMessage } from './chat.js';
import { setOwner, ownerLinkCode, claimOwnerLink } from './roles.js';
import { joinByInvite, decideRequest, rejoinBlocked, requestRejected, joinedNoticeStmts } from './membership.js';
import { openContext, makeContext } from './context.js';
import {
  sendFromUser, sendFromAdmin, take, supportAvailable, threadById, replyBlocks,
  CLOSED as THREAD_CLOSED, NOT_FOUND as THREAD_NOT_FOUND, OWN_THREAD,
} from './support.js';
import { menuEvents } from './participant.js';
import { maskLabel } from './looks.js';

const NAME_PROMPT =
  'Как тебя зовут? Напиши имя (и, если нужно, фамилию) — так тебя увидят твой Санта и организатор.';
const CLOSED_BOT = '🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси у организатора пригласительную ссылку события.';
const STALE_INVITE = 'Эта пригласительная ссылка устарела. Попроси у организатора новую.';
// Удалённый организатором при запрете возврата (010, FR-1022); админам об этой попытке ничего не приходит
const REMOVED = (ev) => `Организатор удалил тебя из события ${q(ev)} — вернуться по ссылке нельзя. Если это ошибка — напиши ему.`;
const registrationClosed = (ev) => `Регистрация на событие ${q(ev)} закрыта. Напиши организатору — он может открыть её снова.`;
const REPLY_EXPIRED = '⌛ Время ответа истекло — сообщение не отправлено. Нажми «↩️ Ответить» ещё раз и пришли его снова.';
// Хвост подсказки «напиши сообщение» — у переписки и обращений
const REPLY_HINT = `\nДо ${MAX_CHARS} символов, в течение часа. Вся переписка — в приложении (кнопка «💬»).\n\n/cancel — отмена`;

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

// Меню: идущие эвенты человека с кнопками переписки. Один запрос к базе на любое число эвентов (009, FR-913).
async function buildMenu(db, user, settings) {
  const results = await menuEvents(db, user.tg_id);
  const active = results.filter((e) => e.status === 'active');
  const finishedCount = results.length - active.length;
  const items = active.slice(0, 5);

  const lines = ['🎄 <b>Тайный Санта</b>', ''];
  if (!items.length) {
    lines.push(user.is_admin
      ? 'Идущих событий у тебя нет. Создай событие в приложении — там появится пригласительная ссылка.'
      : 'Сейчас ты не участвуешь ни в одном идущем событии. Попроси у организатора пригласительную ссылку.');
  } else {
    lines.push('Твои события:');
    for (const ev of items) {
      const letter = ev.wishlist.trim() ? 'письмо ✅' : 'письмо пустое ✏️';
      const draw = !ev.draw_done ? 'жеребьёвка впереди' : ev.has_ward ? 'подопечный назначен 🎁' : 'ждёт добавления в жеребьёвку';
      lines.push(`• ${q(ev)} — ${letter}, ${draw}`);
    }
  }
  if (finishedCount) lines.push('', `📚 Завершённых событий: ${finishedCount} — их история в приложении.`);
  if (user.is_admin) {
    const owner = Number(settings.owner_id || 0) === user.tg_id;
    lines.push('', owner
      ? '👑 Ты владелец бота — события и администраторы в приложении.'
      : '🛠 Ты администратор — события в приложении.');
  }
  const kb = [[openAppButton(settings)]];
  for (const ev of items.slice(0, 3)) {
    // shortTitle не разрывает эмодзи: кнопка с половинкой эмодзи сломала бы всё меню (009, FR-914)
    const row = [];
    if (ev.has_ward) row.push({ text: `💬 Подопечному · ${shortTitle(ev.title)}`, callback_data: `msg:ward:${ev.id}` });
    if (ev.has_santa) row.push({ text: `💬 Санте · ${shortTitle(ev.title)}`, callback_data: `msg:santa:${ev.id}` });
    if (row.length) kb.push(row);
  }
  kb.push([{ text: '🔔 Уведомления', callback_data: 'notify' }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } };
}

// ---------- сообщение боту ----------

// Чат с человеком на время одного сообщения (029): контекст вызова, пользователь и ответы. Пользователь и настройки —
// одним пакетом (019); c.user обновляется вместе с ctx.me, когда запись перечитана (reload).
async function openChat(env, m) {
  const db = env.DB;
  const call = tgApi(env);
  const from = m.from;
  const ctx = await openContext(env, from.id);
  const settings = await ctx.settings();
  const c = {
    env, db, ctx, from, settings,
    text: (m.text || '').trim(),
    user: ctx.me,
    reply: (payload) => call('sendMessage', { chat_id: from.id, ...(typeof payload === 'string' ? msg(payload) : payload) }),
    sendMenu: async () => c.reply(await buildMenu(db, c.user, settings)),
    menuIfRegistered: () => (c.user?.registered ? c.sendMenu() : undefined),
    writeLetter: (text, ev) => ({ ...msg(text), ...appKeyboard(settings, '✏️ Написать письмо', { event: ev.id }) }),
    setPending: (pending) => updateUser(db, from.id, { pending }),
    async reload() {
      c.user = ctx.me = await getUser(db, from.id);
    },
  };
  return c;
}

export async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);

  const m = update.message;
  if (!m || !m.from || m.chat?.type !== 'private') return;
  const c = await openChat(env, m);
  const { db, from, text } = c;
  // Человек пишет боту — значит, бот у него не заблокирован (006, FR-609)
  if (c.user?.blocked_at) await updateUser(db, from.id, { blocked_at: 0 });

  // Любая команда выключает режим ответа в переписку (009, FR-916) и в обращение (012): текст после неё не уйдёт собеседнику
  if (c.user && text.startsWith('/') && inReplyMode(c.user.pending)) {
    await c.setPending('');
    c.user.pending = '';
  }

  if (text.startsWith('/start')) return onStart(c);
  if (!c.user) return c.reply(CLOSED_BOT);
  if (text === '/cancel') return onCancel(c);
  if (c.user.pending.startsWith('name')) return onName(c);
  if (!c.user.registered) return c.reply(NAME_PROMPT);

  const mode = parsePending(c.user.pending);
  if (mode?.kind === 'reply') return onChatReply(c, mode);
  if (mode?.kind === 'support') return onSupportReply(c, mode);
  return c.sendMenu();
}

// Ответ на вступление по ссылке (joinByInvite); true — показать меню следом
async function replyJoin(c, ev, status) {
  switch (status) {
    case 'joined':
      await c.reply(c.writeLetter(`🎄 Ты в событии ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`, ev));
      return true;
    case 'closed':
      await c.reply(registrationClosed(ev));
      return false;
    case 'removed':
      await c.reply(REMOVED(ev));
      return false;
    case 'request_pending':
      await c.reply(`⏳ Заявка на участие в событии ${q(ev)} уже отправлена — ждём решения организатора.`);
      return false;
    case 'request_rejected':
      await c.reply(requestRejected(ev));
      return false;
    default:
      await c.reply(`⏳ Заявка на участие в событии ${q(ev)} отправлена организатору. Как только он её рассмотрит, я напишу.`);
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
  if (c.user?.registered) return c.sendMenu();
  if (c.user && c.user.pending.startsWith('name')) return c.reply(NAME_PROMPT);
  return c.reply(CLOSED_BOT);
}

async function onOwnerLink(c) {
  const { env, db, ctx, from, settings } = c;
  if (!(await claimOwnerLink(env))) {
    await c.reply('Ссылка владельца уже использована. Чтобы получить новую — смени ADMIN_SECRET и снова открой страницу настройки.');
    return c.menuIfRegistered();
  }
  const prevOwnerId = await ctx.ownerId();
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
    return c.reply('👑 Ты — владелец бота «Тайный Санта»: создаёшь события и назначаешь администраторов.\n\n' + NAME_PROMPT);
  }
  await c.reply('👑 Теперь ты владелец бота: события и администраторы — в приложении.');
  return c.sendMenu();
}

async function onInvite(c, code) {
  const { db, ctx, from, user } = c;
  const ev = await getEventByInvite(db, code);
  if (!ev) {
    await c.reply(STALE_INVITE);
    return c.menuIfRegistered();
  }
  const member = user ? await getMember(db, ev.id, from.id) : null;
  if (user?.registered) {
    // Участник открыл ссылку снова — даже после жеребьёвки и закрытия регистрации (009, FR-921)
    if (member) {
      await c.reply(`🎄 Ты уже участвуешь в событии ${q(ev)}.`);
      return c.sendMenu();
    }
    if (await replyJoin(c, ev, await joinByInvite(ctx, ev, user))) return c.sendMenu();
    return;
  }
  // Ещё без имени: сначала имя, вступление — после него (joinByInvite). Код ссылки запоминаем, чтобы после имени
  // не вступить по уже сменённой ссылке.
  if (!member && (isFinished(ev) || !ev.registration_open)) return c.reply(registrationClosed(ev));
  // Удалили ещё до ввода имени, а возврат запрещён (010): не добавляем и имя не спрашиваем
  if (!member && user && (await rejoinBlocked(db, ev, from.id))) return c.reply(REMOVED(ev));
  const pending = `name:${ev.id}:${code}`;
  if (!user) await createUser(db, from.id, from.username, { pending });
  else await c.setPending(pending);
  // Без одобрения человек сразу виден организатору в списке (ещё без имени)
  if (!member && !ev.approval) await db.batch([addMemberStmt(db, ev, from.id), clearRemovedStmt(db, ev.id, from.id)]);
  return c.reply(`🎄 Привет! Это бот для игры в Тайного Санту, ${q(ev)}.\n\n` + NAME_PROMPT);
}

async function onCancel(c) {
  if (!c.user.registered) return c.reply(NAME_PROMPT);
  await c.setPending('');
  return c.reply('Отменено.');
}

// ---------- ввод имени при регистрации ----------
async function onName(c) {
  const { db, ctx, from } = c;
  const name = oneLine(c.text);
  if (!name || name.startsWith('/') || name.length > 40) {
    return c.reply('Напиши, пожалуйста, имя обычным текстом (до 40 символов).');
  }
  const [, eid, code] = c.user.pending.split(':');
  await updateUser(db, from.id, { name, username: from.username || '', registered: 1, pending: '' });
  await c.reload();
  const hello = `Приятно познакомиться, ${escapeHtml(name)}! 🎉`;
  const ev = Number(eid) ? await getEvent(db, eid) : null;
  if (!ev) {
    if (eid) await c.reply(hello + '\n\n' + STALE_INVITE);
    else await c.reply(hello + (c.user.is_admin ? '\n\nСоздай первое событие в приложении — там появится пригласительная ссылка.' : ''));
    return c.sendMenu();
  }
  // Уже участник (вступил до имени) — приветствие, организатору «присоединяется» (имя уже сохранено в user)
  if (await getMember(db, ev.id, from.id)) {
    const notice = joinedNoticeStmts(db, await ctx.users(), c.user, ev);
    if (notice.length) await db.batch(notice);
    await c.reply(c.writeLetter(`${hello}\n\nТеперь открой приложение и напиши письмо своему Тайному Санте в событии ${q(ev)}: что хочешь получить, что любишь, размеры, чего точно не надо.`, ev));
    return c.sendMenu();
  }
  // Не участник (заявка, удалили до имени, сменили ссылку) — вступление как по ссылке (009, FR-922)
  if (ev.invite_code !== code) {
    await c.reply(hello + '\n\n' + STALE_INVITE);
    return c.sendMenu();
  }
  await c.reply(hello);
  const status = await joinByInvite(ctx, ev, c.user);
  const menu = await replyJoin(c, ev, status);
  if (menu || status === 'closed' || status === 'removed') return c.sendMenu();
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
    return c.reply(`❌ Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS}. Отправь покороче или /cancel.`);
  }
  const ev = await getEvent(db, mode.event);
  await c.setPending('');
  if (!ev) return c.reply('❌ Событие не найдено.');
  const res = await sendChatMessage(ctx, ev, from.id, toWard ? 'ward' : 'santa', text, { expectOther: mode.other });
  if (res.ok) return c.reply(toWard ? '✅ Отправлено подопечному от «Тайного Санты».' : '✅ Отправлено твоему Санте.');
  return c.reply(res.pairChanged ? res.error : '❌ ' + res.error);
}

// ---------- ответ в обращение к организатору (012) ----------
async function onSupportReply(c, mode) {
  const { db, ctx, from, text } = c;
  await c.setPending('');
  if (!text) return c.sendMenu();
  if (expired(mode.since)) return c.reply(REPLY_EXPIRED);
  if (mode.who === 'u') {
    const ev = await getEvent(db, mode.id);
    if (!ev || !(await getMember(db, ev.id, from.id))) return c.reply('❌ Ты не участвуешь в этом событии.');
    const res = await sendFromUser(ctx, ev, text);
    return c.reply(res.ok ? '✅ Отправлено организатору. Ответ придёт сюда.' : '❌ ' + res.error);
  }
  if (!c.user.is_admin) return c.reply('❌ Отвечать на обращения могут только администраторы.');
  const t = await threadById(db, mode.id);
  const ev = t ? await getEvent(db, t.event_id) : null;
  if (!ev) return c.reply('❌ ' + THREAD_NOT_FOUND);
  const res = await sendFromAdmin(ctx, ev, Number(mode.id), text);
  return c.reply(res.ok ? '✅ Отправлено участнику.' : `❌ ${res.error} Сообщение не отправлено.`);
}

// ---------- нажатие кнопки ----------

const NOTIFY_LABELS = {
  sound: '🔔 Со звуком',
  silent: '🔕 Без звука',
  off: '🚫 Не присылать',
};

async function handleCallback(cq, env) {
  const db = env.DB;
  const call = tgApi(env);
  const from = cq.from;
  const answer = (text) => call('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) });
  const user = await getUser(db, from.id);
  const ctx = makeContext(env, { me: user }); // настройки и пользователи — лениво: не всем нажатиям они нужны
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
      return k.send(msg(text + REPLY_HINT));
    },
  };
  for (const [pattern, handler] of BUTTONS) {
    const found = pattern.exec(cq.data || '');
    if (found) return handler(k, found);
  }
  return answer();
}

// «💬 Подопечному / Санте» в меню и «↩️ Ответить» под сообщением переписки
async function onReplyButton(k, [, side, eventId]) {
  const { db, from } = k;
  const toWard = side === 'ward';
  const ev = await getEvent(db, eventId);
  if (!ev) return k.refuse('Событие не найдено.');
  const p = toWard ? await pairOfSanta(db, ev.id, from.id) : await pairOfWard(db, ev.id, from.id);
  if (!p) return k.refuse(toWard ? 'У тебя пока нет подопечного.' : 'Жеребьёвка для тебя ещё не проведена.');
  if (!chatWritable(ev)) return k.refuse(CHAT_READ_ONLY);
  // Режим ответа помнит собеседника и время нажатия (только на сервере): msg_<сторона>:<эвент>:<собеседник>:<мс>
  await k.setPending(replyPending(side, ev.id, toWard ? p.ward : p.santa));
  // 040: маска пары — Санте как «от чьего имени», подопечному — как он знает своего Санту
  const mask = maskLabel(p.mask);
  return k.prompt(toWard
    ? `✍️ Напиши сообщение подопечному (${q(ev)}) — я передам его <b>анонимно</b>, от имени «Тайного Санты${mask ? ' · ' + mask : ''}».`
    : `✍️ Напиши сообщение своему Санте${mask ? ` «${mask}»` : ''} (${q(ev)}) — я передам его. Санта знает, кто ты, а ты его — нет.`);
}

// ---------- обращения к организатору (012) ----------
async function onSupportButton(k, [, kind, id]) {
  const { db, user } = k;
  if (kind === 'u') return onSupportAsk(k, id);
  if (!user.is_admin) return k.refuse(ADMIN_ONLY);
  const t = await threadById(db, id);
  const ev = t ? await getEvent(db, t.event_id) : null;
  if (!ev) return k.refuse(THREAD_NOT_FOUND);
  const name = escapeHtml((await getUser(db, t.user_id))?.name || 'участник');
  return kind === 'take' ? onSupportTake(k, t, ev, name) : onSupportAnswer(k, t, ev, name);
}

// Участник: «↩️ Ответить» под ответом организатора
async function onSupportAsk(k, eventId) {
  const { db, ctx, from } = k;
  const ev = await getEvent(db, eventId);
  if (!ev || !(await getMember(db, ev.id, from.id))) return k.refuse('Ты не участвуешь в этом событии.');
  if (!chatWritable(ev)) return k.refuse(SUPPORT_READ_ONLY);
  if (!supportAvailable(await ctx.users(), from.id)) return k.refuse('Сейчас некому написать: в боте нет других организаторов.');
  await k.setPending(supportPending('u', ev.id));
  return k.prompt(`✍️ Напиши сообщение организатору (${q(ev)}) — я передам его. Не пиши, кто твой подопечный.`);
}

// Админ: «🙋 Взять»
async function onSupportTake(k, t, ev, name) {
  const settings = await k.ctx.settings();
  const r = await take(k.ctx, ev, t.id);
  if (!r.ok) return k.refuse(r.error);
  await k.answer('🙋 Обращение твоё');
  return k.send(msg(`🙋 Обращение <b>${name}</b> (${q(ev)}) теперь ведёшь ты. Ответь кнопкой ниже или в приложении.`, {
    reply_markup: { inline_keyboard: [[
      { text: '↩️ Ответить', callback_data: `sup:a:${t.id}` },
      openAppButton(settings, '💬 Открыть', { event: ev.id, support: t.id }),
    ]] },
  }));
}

// Админ: «↩️ Ответить» — правило то же, что у ответа из приложения (replyBlocks), порядок и тексты — бота
async function onSupportAnswer(k, t, ev, name) {
  const blocks = replyBlocks(t, k.user, ev);
  if (blocks.closed) return k.refuse(THREAD_CLOSED);
  if (blocks.own) return k.refuse(OWN_THREAD);
  if (blocks.other) return k.refuse(`Обращение ведёт ${(await getUser(k.db, t.assignee))?.name || 'другой админ'}.`);
  if (blocks.readOnly) return k.refuse(SUPPORT_READ_ONLY);
  await k.setPending(supportPending('a', t.id));
  return k.prompt(`✍️ Напиши ответ <b>${name}</b> (обращение, ${q(ev)}).` + (t.assignee ? '' : ' Ответив, ты возьмёшь обращение себе.'));
}

// Решение по заявке на вступление (008): кнопки в сообщении админу
async function onRequestButton(k, [, id, decision]) {
  const approve = decision === 'a';
  if (!k.user.is_admin) return k.answer(ADMIN_ONLY);
  const r = await decideRequest(k.ctx, Number(id), k.from.id, approve);
  if (!r.ok) return k.answer(r.error);
  await k.answer(approve ? '✅ Принято' : '❌ Отклонено');
  return k.send(msg(`${approve ? '✅ Заявка принята' : '❌ Заявка отклонена'}: <b>${escapeHtml(r.name)}</b>, ${q(r.ev)}.`));
}

async function onNotifyButton(k) {
  await k.answer();
  return k.send(msg(
    `Уведомления о том, что подопечный изменил письмо (во всех событиях).\nСейчас: <b>${NOTIFY_LABELS[k.user.notify_mode] || NOTIFY_LABELS.sound}</b>`,
    { reply_markup: { inline_keyboard: [Object.entries(NOTIFY_LABELS).map(([key, label]) => ({ text: label, callback_data: 'nm:' + key }))] } }
  ));
}

async function onNotifyMode(k, [, mode]) {
  if (!NOTIFY_LABELS[mode]) return k.answer();
  await updateUser(k.db, k.from.id, { notify_mode: mode });
  return k.answer('Сохранено: ' + NOTIFY_LABELS[mode]);
}

// Вид кнопки (callback_data) → обработчик; первый подошедший
const BUTTONS = [
  [/^msg:(ward|santa):(\d+)$/, onReplyButton],
  [/^sup:(take|a|u):(\d+)$/, onSupportButton],
  [/^req:(\d+):(a|r)$/, onRequestButton],
  [/^notify$/, onNotifyButton],
  [/^nm:(.*)$/s, onNotifyMode],
];

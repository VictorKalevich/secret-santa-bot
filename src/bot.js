// Обработка сообщений в чате с ботом (webhook от Telegram).
// 029: у каждой команды и каждого вида кнопки — свой обработчик; запросов к базе здесь нет (чтения — функциями модулей).
// 050: обработчик, который нашёл событие, дальше работает с контекстом компании события (ctx.in(ev.company_id)).

import {
  getUser, createUser, createUserStmt, updateUser, updateUserStmt, pairOfSanta, pairOfWard, getEvent, getEventByInvite, getMember,
  memberQuery, addMemberStmt, clearRemovedStmt, joinCompanyStmt,
} from './db.js';
import { tgApi } from './telegram.js';
import {
  escapeHtml, msg, q, openAppButton, appKeyboard, oneLine, shortTitle, NOT_REGISTERED, ADMIN_ONLY, CHAT_READ_ONLY, SUPPORT_READ_ONLY,
} from './format.js';
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

const NAME_PROMPT =
  'Как тебя зовут? Напиши имя (и, если нужно, фамилию) — так тебя увидят твой Санта, владелец и администраторы.';
// 047: имя из Telegram — одним нажатием
const NAME_OFFER = (name) =>
  `Имя в игре — <b>${escapeHtml(name)}</b>, как в Telegram. Его увидят твой Санта, владелец и администраторы. ` +
  'Хочешь другое — нажми «✏️ Изменить имя» или просто напиши его.';
const NAME_ASK =
  '✏️ Напиши имя (и, если нужно, фамилию) одним сообщением — до 40 символов. Так тебя увидят твой Санта, владелец и администраторы.';
const NAME_SAVED = 'Имя уже сохранено. Сменить его можно в приложении: «Профиль» → «✏️ Изменить имя».';
const CLOSED_BOT = '🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси пригласительную ссылку на событие.';
const STALE_INVITE = 'Эта пригласительная ссылка устарела. Попроси новую ссылку.';
// Удалённый организатором при запрете возврата (010, FR-1022); админам об этой попытке ничего не приходит
const REMOVED = (ev) => `Тебя удалили из события ${q(ev)} — вернуться по ссылке нельзя. Если это ошибка, свяжись с владельцем или администратором.`;
const registrationClosed = (ev) => `Регистрация на событие ${q(ev)} закрыта. Владелец или администратор может открыть её снова.`;
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

// ---------- имя при регистрации ----------
// Одно правило для имени текстом и имени из Telegram (047): одна строка, 1–40 символов, не команда
const nameOk = (name) => !!name && !name.startsWith('/') && name.length <= 40;

// Имя из профиля Telegram для «Участвовать как …» (047): имя и фамилия, вместе не подходят — только имя; '' — нечего
// предложить
function telegramName(from) {
  return [oneLine(`${from?.first_name || ''} ${from?.last_name || ''}`), oneLine(from?.first_name)].find(nameOk) || '';
}

// Просьба имени (047): с подходящим именем из Telegram — оно и кнопки (каждая своей строкой: длинное имя на кнопке в
// одной строке с другой обрезалось бы); без него — прежний вопрос. joining — после пригласительной ссылки
function nameOffer(from, intro, joining) {
  const name = telegramName(from);
  if (!name) return msg(intro + NAME_PROMPT);
  return msg(intro + NAME_OFFER(name), { reply_markup: { inline_keyboard: [
    [{ text: `✅ ${joining ? 'Участвовать' : 'Продолжить'} как ${name}`, callback_data: 'reg:ok' }],
    [{ text: '✏️ Изменить имя', callback_data: 'reg:edit' }],
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

  const lines = ['🎄 <b>Тайный Санта</b>', ''];
  if (!items.length) {
    lines.push(user.is_admin
      ? 'Идущих событий у тебя нет. Создай событие в приложении — там появится пригласительная ссылка.'
      : openBot(ctx.env)
        ? 'Сейчас ты не участвуешь ни в одном идущем событии. Создай свою комнату в приложении или попроси пригласительную ссылку на событие.'
        : 'Сейчас ты не участвуешь ни в одном идущем событии. Попроси пригласительную ссылку на событие.');
  } else {
    lines.push('Твои события:');
    for (const ev of items) {
      const letter = ev.wishlist.trim() ? 'письмо ✅' : 'письмо пустое ✏️';
      const draw = !ev.draw_done ? 'жеребьёвка впереди' : ev.has_ward ? 'подопечный назначен 🎁' : 'ждёт добавления в жеребьёвку';
      const company = titles ? ` (${escapeHtml(titles.get(ev.company_id) ?? '')})` : '';
      lines.push(`• ${q(ev)}${company} — ${letter}, ${draw}`);
    }
  }
  if (finishedCount) lines.push('', `📚 Завершённых событий: ${finishedCount} — их история в приложении.`);
  if (user.is_admin) {
    const owner = Number(settings.owner_id || 0) === user.tg_id;
    // 051: назначенный владелец компании
    const companyOwner = !owner && [...(await ctx.companies()).values()].some((c) => c.owner_id === user.tg_id);
    lines.push('', owner
      ? '👑 Ты владелец бота — события и администраторы в приложении.'
      : companyOwner ? '👑 Ты владелец — события и администраторы в приложении.' : '🛠 Ты администратор — события в приложении.');
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
  const from = m.from;
  const ctx = await openContext(env, from.id);
  const call = tgApi(env, ctx.lang); // ответы — на языке человека (060)
  const settings = await ctx.settings();
  const c = {
    env, db, ctx, from, settings,
    text: (m.text || '').trim(),
    user: ctx.me,
    reply: (payload) => call('sendMessage', { chat_id: from.id, ...(typeof payload === 'string' ? msg(payload) : payload) }),
    sendMenu: async () => c.reply(await buildMenu(ctx, c.user, settings)),
    menuIfRegistered: () => (c.user?.registered ? c.sendMenu() : undefined),
    writeLetter: (text, ev) => ({ ...msg(text), ...appKeyboard(settings, '✏️ Написать письмо', { event: ev.id }) }),
    // joining — по умолчанию по ожиданию имени: name:<эвент>:<код> — после пригласительной ссылки
    askName: (intro = '', joining = c.user?.pending.startsWith('name:')) => c.reply(nameOffer(from, intro, joining)),
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
      await c.reply(c.writeLetter(`🎄 Ты в событии ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`, ev));
      return true;
    case 'closed':
      await c.reply(registrationClosed(ev));
      return false;
    case 'removed':
      await c.reply(REMOVED(ev));
      return false;
    case 'request_pending':
      await c.reply(`⏳ Заявка на участие в событии ${q(ev)} уже отправлена — ждём решения.`);
      return false;
    case 'request_rejected':
      await c.reply(requestRejected(ev));
      return false;
    default:
      await c.reply(`⏳ Заявка на участие в событии ${q(ev)} отправлена. Я напишу, когда её рассмотрят.`);
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
  if (!openBot(c.env)) return c.reply(CLOSED_BOT);
  await (c.user ? c.setPending('name') : createUser(c.db, c.from.id, c.from.username, { pending: 'name' }));
  return c.askName('🎄 Привет! Это бот для игры в Тайного Санту.\n\n', false);
}

async function onOwnerLink(c) {
  const { env, db, ctx, from, settings } = c;
  if (!(await claimOwnerLink(env))) {
    await c.reply('Ссылка владельца уже использована. Чтобы получить новую — смени ADMIN_SECRET и снова открой страницу настройки.');
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
    return c.askName('👑 Ты — владелец бота «Тайный Санта»: создаёшь события и назначаешь администраторов.\n\n', false);
  }
  await c.reply('👑 Теперь ты владелец бота: события и администраторы — в приложении.');
  return c.sendMenu();
}

// Ссылка владельца компании (051, контракт — раздел 4): зарегистрированный становится владельцем сразу, новый — после
// имени (ожидание name_own:<компания>:<код>), если код к тому времени тот же
const OWNER_LINK_REPLIES = {
  gone: OWNER_LINK_GONE,
  bot: 'Ты владелец бота — эту комнату и так ведёшь ты.',
  already: 'Ты уже владелец.',
  owner: NEW_COMPANY_OWNER + ' Всё — в приложении.',
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
  return c.askName(NEW_COMPANY_OWNER + '\n\n', false);
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
      await c.reply(`🎄 Ты уже участвуешь в событии ${q(ev)}.`);
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
  return c.askName(`🎄 Привет! Это бот для игры в Тайного Санту, ${q(ev)}.\n\n`, true);
}

async function onCancel(c) {
  if (!c.user.registered) return c.askName();
  await c.setPending('');
  return c.reply('Отменено.');
}

// ---------- ввод имени при регистрации ----------
async function onName(c) {
  const name = oneLine(c.text);
  if (!nameOk(name)) return c.reply('Напиши, пожалуйста, имя обычным текстом (до 40 символов).');
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
  const hello = `Приятно познакомиться, ${escapeHtml(name)}! 🎉`;
  if (!ev) {
    if (eid) await c.reply(hello + '\n\n' + STALE_INVITE);
    else await c.reply(hello + (c.user.is_admin ? '\n\nСоздай первое событие в приложении — там появится пригласительная ссылка.' : ''));
  } else if (member) {
    await c.reply(c.writeLetter(`${hello}\n\nТеперь открой приложение и напиши письмо своему Тайному Санте в событии ${q(ev)}: что хочешь получить, что любишь, размеры, чего точно не надо.`, ev));
  } else if (ev.invite_code !== code) {
    // Не участник (заявка, удалили до имени, сменили ссылку) — вступление как по ссылке (009, FR-922)
    await c.reply(hello + '\n\n' + STALE_INVITE);
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
  await c.reply(`Приятно познакомиться, ${escapeHtml(name)}! 🎉\n\n` + (owner
    ? 'Создай первое событие в приложении — там появится пригласительная ссылка.'
    : 'Ссылка владельца уже использована или отозвана. Попроси новую.'));
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
    return c.reply(`❌ Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS}. Отправь покороче или /cancel.`);
  }
  const ev = await getEvent(db, mode.event);
  await c.setPending('');
  if (!ev) return c.reply('❌ Событие не найдено.');
  const res = await sendChatMessage(await ctx.in(ev.company_id), ev, from.id, toWard ? 'ward' : 'santa', text, { expectOther: mode.other });
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
    const res = await sendFromUser(await ctx.in(ev.company_id), ev, text);
    return c.reply(res.ok ? '✅ Сообщение отправлено. Ответ придёт сюда.' : '❌ ' + res.error);
  }
  const ADMINS_ONLY = '❌ Отвечать на обращения могут владелец и администраторы.';
  if (!c.user.is_admin) return c.reply(ADMINS_ONLY);
  const t = await threadById(db, mode.id);
  const ev = t ? await getEvent(db, t.event_id) : null;
  if (!ev) return c.reply('❌ ' + THREAD_NOT_FOUND);
  // Права — в компании события (050): тот же отказ
  const company = await ctx.in(ev.company_id);
  if (!company?.me.is_admin) return c.reply(ADMINS_ONLY);
  const res = await sendFromAdmin(company, ev, Number(mode.id), text);
  return c.reply(res.ok ? '✅ Отправлено участнику.' : `❌ ${res.error} Сообщение не отправлено.`);
}

// ---------- нажатие кнопки ----------

const NOTIFY_LABELS = {
  sound: '🔔 Со звуком',
  silent: '🔕 Без звука',
  off: '🚫 Не присылать',
};

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
      return k.send(msg(text + REPLY_HINT));
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
    return c.reply(NAME_ASK);
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
  // Права — в компании события (050): тот же отказ
  const company = await k.ctx.in(ev.company_id);
  if (!company?.me.is_admin) return k.refuse(ADMIN_ONLY);
  const name = escapeHtml((await getUser(db, t.user_id))?.name || 'участник');
  return kind === 'take' ? onSupportTake(k, company, t, ev, name) : onSupportAnswer(k, t, ev, name);
}

// Участник: «↩️ Ответить» под ответом организатора
async function onSupportAsk(k, eventId) {
  const { db, ctx, from } = k;
  const ev = await getEvent(db, eventId);
  if (!ev || !(await getMember(db, ev.id, from.id))) return k.refuse('Ты не участвуешь в этом событии.');
  if (!chatWritable(ev)) return k.refuse(SUPPORT_READ_ONLY);
  if (!supportAvailable(await (await ctx.in(ev.company_id)).users(), from.id)) return k.refuse(NO_SUPPORT_RECIPIENTS);
  await k.setPending(supportPending('u', ev.id));
  return k.prompt(`✍️ Напиши сообщение по событию (${q(ev)}) — я передам его. Не пиши, кто твой подопечный.`);
}

// Админ: «🙋 Взять»
async function onSupportTake(k, ctx, t, ev, name) {
  const settings = await ctx.settings();
  const r = await take(ctx, ev, t.id);
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
  if (blocks.other) return k.refuse(`Обращение ведёт ${(await getUser(k.db, t.assignee))?.name || 'другой человек'}.`);
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

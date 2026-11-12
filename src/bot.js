// Обработка сообщений в чате с ботом (webhook от Telegram).

import {
  getSettings, getUser, createUser, updateUser, pairOfSanta, pairOfWard, enqueueStmt, allUsers,
  getEvent, getEventByInvite, getMember, addMemberStmt,
} from './db.js';
import { tgApi, derivedSecret } from './telegram.js';
import { escapeHtml, msg, q, openAppButton, adminRecipients, oneLine } from './format.js';
import { isFinished, chatWritable } from './events.js';
import { MAX_CHARS, sendChatMessage } from './chat.js';
import { resolveOwner, setOwner } from './roles.js';
import { requestJoin, decideRequest } from './membership.js';

const NAME_PROMPT =
  'Как тебя зовут? Напиши имя (и, если нужно, фамилию) — так тебя увидят твой Санта и организатор.';
const CLOSED_BOT = '🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси у организатора пригласительную ссылку эвента.';

// Меню: идущие эвенты человека с кнопками переписки
async function buildMenu(db, user, settings) {
  const { results } = await db
    .prepare(
      `SELECT e.*, m.wishlist FROM members m JOIN events e ON e.id = m.event_id
        WHERE m.user_id = ? ORDER BY e.created_at DESC`
    )
    .bind(user.tg_id)
    .all();
  const active = results.filter((e) => e.status === 'active').slice(0, 5);
  const items = [];
  for (const ev of active) {
    const [pair, wardPair] = await Promise.all([pairOfSanta(db, ev.id, user.tg_id), pairOfWard(db, ev.id, user.tg_id)]);
    items.push({ ev, member: { wishlist: ev.wishlist }, pair, wardPair });
  }
  return menuMessage(user, settings, items, results.length - results.filter((e) => e.status === 'active').length);
}

// items: [{ ev, member, pair, wardPair }] — идущие эвенты человека; finishedCount — сколько завершённых
function menuMessage(user, settings, items, finishedCount = 0) {
  const lines = ['🎄 <b>Тайный Санта</b>', ''];
  if (!items.length) {
    lines.push(user.is_admin
      ? 'Идущих эвентов у тебя нет. Создай эвент в приложении — там появится пригласительная ссылка.'
      : 'Сейчас ты не участвуешь ни в одном идущем эвенте. Попроси у организатора пригласительную ссылку.');
  } else {
    lines.push('Твои эвенты:');
    for (const it of items) {
      const letter = it.member.wishlist.trim() ? 'письмо ✅' : 'письмо пустое ✏️';
      const draw = !it.ev.draw_done ? 'жеребьёвка впереди' : it.pair ? 'подопечный назначен 🎁' : 'ждёт добавления в жеребьёвку';
      lines.push(`• ${q(it.ev)} — ${letter}, ${draw}`);
    }
  }
  if (finishedCount) lines.push('', `📚 Завершённых эвентов: ${finishedCount} — их история в приложении.`);
  if (user.is_admin) {
    const owner = Number(settings.owner_id || 0) === user.tg_id;
    lines.push('', owner
      ? '👑 Ты владелец бота — эвенты и администраторы в приложении.'
      : '🛠 Ты администратор — эвенты в приложении.');
  }
  const kb = [[openAppButton(settings)]];
  for (const it of items.slice(0, 3)) {
    const row = [];
    if (it.pair) row.push({ text: `💬 Подопечному · ${it.ev.title}`.slice(0, 60), callback_data: `msg:ward:${it.ev.id}` });
    if (it.wardPair) row.push({ text: `💬 Санте · ${it.ev.title}`.slice(0, 60), callback_data: `msg:santa:${it.ev.id}` });
    if (row.length) kb.push(row);
  }
  kb.push([{ text: '🔔 Уведомления', callback_data: 'notify' }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } };
}

async function notifyAdminsJoined(env, name, ev, exceptId) {
  const db = env.DB;
  const admins = adminRecipients(await allUsers(db), [exceptId]);
  if (!admins.length) return;
  await db.batch(admins.map((a) => enqueueStmt(db, a.tg_id, msg(`👋 <b>${escapeHtml(name)}</b> присоединяется к эвенту ${q(ev)}`, { disable_notification: true }))));
}

export async function handleUpdate(update, env) {
  const db = env.DB;
  const call = tgApi(env);

  if (update.callback_query) return handleCallback(update.callback_query, env, call);

  const m = update.message;
  if (!m || !m.from || m.chat?.type !== 'private') return;
  const from = m.from;
  const text = (m.text || '').trim();
  const settings = await getSettings(db);
  let user = await getUser(db, from.id);
  // Человек пишет боту — значит, бот у него не заблокирован (006, FR-609)
  if (user?.blocked_at) await updateUser(db, from.id, { blocked_at: 0 });

  const reply = (payload) => call('sendMessage', { chat_id: from.id, ...(typeof payload === 'string' ? msg(payload) : payload) });
  const sendMenu = async (u) => reply(await buildMenu(db, u, settings));
  // Заявка на вступление (008)
  const replyRequest = async (ev, u) => {
    const r = await requestJoin(env, ev, u);
    return reply(r.already
      ? `⏳ Заявка в эвент ${q(ev)} уже отправлена — ждём решения организатора.`
      : `⏳ Заявка в эвент ${q(ev)} отправлена организатору. Как только он её рассмотрит, я напишу.`);
  };

  // ---------- /start ----------
  if (text.startsWith('/start')) {
    const payload = text.split(/\s+/)[1] || '';
    const adminCode = 'adm_' + (await derivedSecret(env, 'admin:' + (env.ADMIN_SECRET || ''), 24));

    // Ссылка со страницы /setup делает владельцем бота (002, FR-102)
    if (payload === adminCode) {
      const prevOwnerId = await resolveOwner(db, settings);
      if (!user) await createUser(db, from.id, from.username, { is_admin: true, pending: 'name' });
      await setOwner(env, from.id, {
        via: 'link',
        prevOwnerId,
        newOwnerLabel: user?.name || from.first_name || (from.username ? '@' + from.username : ''),
      });
      settings.owner_id = String(from.id);
      user = await getUser(db, from.id);
      if (!user.registered) {
        await updateUser(db, from.id, { pending: 'name' });
        return reply('👑 Ты — владелец бота «Тайный Санта»: создаёшь эвенты и назначаешь администраторов.\n\n' + NAME_PROMPT);
      }
      await reply('👑 Теперь ты владелец бота: эвенты и администраторы — в приложении.');
      return sendMenu(user);
    }

    // Пригласительная ссылка эвента (005)
    if (payload.startsWith('inv_')) {
      const ev = await getEventByInvite(db, payload.slice(4));
      if (!ev) return reply('Эта пригласительная ссылка устарела. Попроси у организатора новую.');
      if (isFinished(ev) || !ev.registration_open) {
        return reply(`Регистрация в эвент ${q(ev)} закрыта. Напиши организатору — он может открыть её снова.`);
      }
      const already = user ? await getMember(db, ev.id, from.id) : null;
      // 008: эвент с одобрением — вместо участия заявка (админы вступают сами)
      const needsApproval = !!ev.approval && !user?.is_admin && !already;
      if (user?.registered) {
        if (needsApproval) return replyRequest(ev, user);
        if (!already) {
          await addMemberStmt(db, ev, from.id).run();
          await notifyAdminsJoined(env, user.name, ev, from.id);
        }
        await reply({
          ...msg(`🎄 Ты в эвенте ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`),
          reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] },
        });
        return sendMenu(user);
      }
      if (!user) await createUser(db, from.id, from.username, { pending: 'name:' + ev.id });
      else await updateUser(db, from.id, { pending: 'name:' + ev.id });
      if (!needsApproval) await addMemberStmt(db, ev, from.id).run();
      return reply(`🎄 Привет! Это бот для игры в Тайного Санту, эвент ${q(ev)}.\n\n` + NAME_PROMPT);
    }

    if (user?.registered) return sendMenu(user);
    if (user && user.pending.startsWith('name')) return reply(NAME_PROMPT);
    return reply(CLOSED_BOT);
  }

  if (!user) return reply(CLOSED_BOT);

  if (text === '/cancel') {
    if (!user.registered) return reply(NAME_PROMPT);
    await updateUser(db, from.id, { pending: '' });
    return reply('Отменено.');
  }

  // ---------- ввод имени при регистрации ----------
  if (user.pending.startsWith('name')) {
    const name = oneLine(text);
    if (!name || name.startsWith('/') || name.length > 40) {
      return reply('Напиши, пожалуйста, имя обычным текстом (до 40 символов).');
    }
    const eventId = Number(user.pending.split(':')[1] || 0);
    await updateUser(db, from.id, { name, username: from.username || '', registered: 1, pending: '' });
    user = await getUser(db, from.id);
    const ev = eventId ? await getEvent(db, eventId) : null;
    if (ev && ev.approval && !user.is_admin && !(await getMember(db, ev.id, from.id))) {
      await reply(`Приятно познакомиться, ${escapeHtml(name)}! 🎉`);
      return replyRequest(ev, user);
    }
    if (ev) {
      await notifyAdminsJoined(env, name, ev, from.id);
      await reply({
        ...msg(`Приятно познакомиться, ${escapeHtml(name)}! 🎉\n\nТеперь открой приложение и напиши письмо своему Тайному Санте в эвенте ${q(ev)}: что хочешь получить, что любишь, размеры, чего точно не надо.`),
        reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] },
      });
    } else {
      await reply(`Приятно познакомиться, ${escapeHtml(name)}! 🎉` + (user.is_admin ? '\n\nСоздай первый эвент в приложении — там появится пригласительная ссылка.' : ''));
    }
    return sendMenu(user);
  }

  if (!user.registered) return reply(NAME_PROMPT);

  // ---------- ответ в переписку (003/005) ----------
  if (user.pending.startsWith('msg_ward:') || user.pending.startsWith('msg_santa:')) {
    if (!text || text.startsWith('/')) {
      await updateUser(db, from.id, { pending: '' });
      return sendMenu(user);
    }
    const [kind, eid] = user.pending.split(':');
    const toWard = kind === 'msg_ward';
    if (text.length > MAX_CHARS) {
      return reply(`❌ Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS}. Отправь покороче или /cancel.`);
    }
    const ev = await getEvent(db, eid);
    await updateUser(db, from.id, { pending: '' });
    if (!ev) return reply('❌ Эвент не найден.');
    const res = await sendChatMessage(env, ev, from.id, toWard ? 'ward' : 'santa', text);
    return reply(res.ok
      ? (toWard ? '✅ Отправлено подопечному от «Тайного Санты».' : '✅ Отправлено твоему Санте.')
      : '❌ ' + res.error);
  }

  return sendMenu(user);
}

const NOTIFY_LABELS = {
  sound: '🔔 Со звуком',
  silent: '🔕 Без звука',
  off: '🚫 Не присылать',
};

async function handleCallback(cq, env, call) {
  const db = env.DB;
  const from = cq.from;
  const data = cq.data || '';
  const answer = (text) => call('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) });
  const user = await getUser(db, from.id);
  if (user?.blocked_at) await updateUser(db, from.id, { blocked_at: 0 }); // 006, FR-609
  if (!user || !user.registered) return answer('Сначала зарегистрируйся по пригласительной ссылке.');
  const send = (payload) => call('sendMessage', { chat_id: from.id, ...payload });

  const mm = /^msg:(ward|santa):(\d+)$/.exec(data);
  if (mm) {
    const toWard = mm[1] === 'ward';
    const ev = await getEvent(db, mm[2]);
    if (!ev) return answer('Эвент не найден.');
    const p = toWard ? await pairOfSanta(db, ev.id, from.id) : await pairOfWard(db, ev.id, from.id);
    if (!p) return answer(toWard ? 'У тебя пока нет подопечного.' : 'Жеребьёвка для тебя ещё не проведена.');
    if (!chatWritable(ev)) return answer('Эвент завершён больше недели назад — переписка только для чтения.');
    await updateUser(db, from.id, { pending: (toWard ? 'msg_ward:' : 'msg_santa:') + ev.id });
    await answer();
    return send(msg(
      (toWard
        ? `✍️ Напиши сообщение подопечному (эвент ${q(ev)}) — я передам его <b>анонимно</b>, от имени «Тайного Санты».`
        : `✍️ Напиши сообщение своему Санте (эвент ${q(ev)}) — я передам его. Санта знает, кто ты, а ты его — нет.`) +
      `\nДо ${MAX_CHARS} символов. Вся переписка — в приложении (кнопка «💬»).\n\n/cancel — отмена`
    ));
  }

  // Решение по заявке на вступление (008): кнопки в сообщении админу
  const rq = /^req:(\d+):(a|r)$/.exec(data);
  if (rq) {
    if (!user.is_admin) return answer('Только для администратора.');
    const r = await decideRequest(env, Number(rq[1]), from.id, rq[2] === 'a');
    if (!r.ok) return answer(r.error);
    await answer(rq[2] === 'a' ? '✅ Принято' : '❌ Отклонено');
    return send(msg(`${rq[2] === 'a' ? '✅ Заявка принята' : '❌ Заявка отклонена'}: <b>${escapeHtml(r.name)}</b>, эвент ${q(r.ev)}.`));
  }

  if (data === 'notify') {
    await answer();
    return send(msg(
      `Уведомления о том, что подопечный изменил письмо (во всех эвентах).\nСейчас: <b>${NOTIFY_LABELS[user.notify_mode] || NOTIFY_LABELS.sound}</b>`,
      { reply_markup: { inline_keyboard: [Object.entries(NOTIFY_LABELS).map(([k, v]) => ({ text: v, callback_data: 'nm:' + k }))] } }
    ));
  }

  if (data.startsWith('nm:')) {
    const mode = data.slice(3);
    if (!NOTIFY_LABELS[mode]) return answer();
    await updateUser(db, from.id, { notify_mode: mode });
    return answer('Сохранено: ' + NOTIFY_LABELS[mode]);
  }

  return answer();
}

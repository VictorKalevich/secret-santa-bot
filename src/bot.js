// Обработка сообщений в чате с ботом (webhook от Telegram).

import { getSettings, getUser, createUser, updateUser, pairOfSanta, pairOfWard, enqueueStmt, allUsers } from './db.js';
import { tgApi, derivedSecret } from './telegram.js';
import { menuMessage, isRegistrationOpen, escapeHtml, msg, flushOutbox } from './game.js';

const NAME_PROMPT =
  'Как тебя зовут? Напиши имя (и, если нужно, фамилию) — так тебя увидит твой Санта и организатор.';

export async function handleUpdate(update, env, ctx) {
  const db = env.DB;
  const call = tgApi(env);

  if (update.callback_query) return handleCallback(update.callback_query, env, ctx, call);

  const m = update.message;
  if (!m || !m.from || m.chat?.type !== 'private') return;
  const from = m.from;
  const text = (m.text || '').trim();
  const settings = await getSettings(db);
  let user = await getUser(db, from.id);

  const reply = (payload) => call('sendMessage', { chat_id: from.id, ...(typeof payload === 'string' ? msg(payload) : payload) });
  const sendMenu = async (u) => {
    const [pair, wardPair] = await Promise.all([pairOfSanta(db, u.tg_id), pairOfWard(db, u.tg_id)]);
    return reply(menuMessage(u, settings, pair, wardPair));
  };

  // ---------- /start ----------
  if (text.startsWith('/start')) {
    const payload = text.split(/\s+/)[1] || '';
    const adminCode = 'adm_' + (await derivedSecret(env, 'admin:' + (env.ADMIN_SECRET || ''), 24));

    if (payload === adminCode) {
      if (!user) {
        await createUser(db, from.id, from.username, { is_admin: true, pending: 'name' });
      } else {
        await updateUser(db, from.id, { is_admin: 1 });
      }
      user = await getUser(db, from.id);
      if (!user.registered) {
        await updateUser(db, from.id, { pending: 'name' });
        return reply('🛠 Ты назначен администратором Тайного Санты.\n\n' + NAME_PROMPT);
      }
      return sendMenu(user);
    }

    if (user?.registered) return sendMenu(user);

    if (payload.startsWith('inv_')) {
      if (!settings.invite_code || payload !== 'inv_' + settings.invite_code) {
        return reply('Эта пригласительная ссылка устарела. Попроси у организатора новую.');
      }
      if (!isRegistrationOpen(settings)) {
        return reply('Регистрация сейчас закрыта. Напиши организатору — он может открыть её снова.');
      }
      if (!user) await createUser(db, from.id, from.username, { pending: 'name' });
      else await updateUser(db, from.id, { pending: 'name' });
      return reply('🎄 Привет! Это бот для игры в Тайного Санту.\n\n' + NAME_PROMPT);
    }

    if (user && user.pending === 'name') return reply(NAME_PROMPT);
    return reply('🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси у организатора пригласительную ссылку.');
  }

  if (!user) {
    return reply('🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси у организатора пригласительную ссылку.');
  }

  if (text === '/cancel') {
    await updateUser(db, from.id, { pending: '' });
    if (!user.registered) return reply(NAME_PROMPT);
    return reply('Отменено.');
  }

  // ---------- ввод имени при регистрации ----------
  if (user.pending === 'name') {
    const name = text.replace(/\s+/g, ' ').trim();
    if (!name || name.startsWith('/') || name.length > 40) {
      return reply('Напиши, пожалуйста, имя обычным текстом (до 40 символов).');
    }
    const wasRegistered = user.registered;
    await updateUser(db, from.id, {
      name,
      username: from.username || '',
      registered: 1,
      pending: '',
      ...(user.is_admin && !wasRegistered ? {} : { is_participant: 1 }),
    });
    user = await getUser(db, from.id);
    if (user.is_admin && !wasRegistered) {
      return reply({
        ...msg(`Приятно познакомиться, ${escapeHtml(name)}! Ты сам(а) участвуешь в обмене подарками или только организуешь?`),
        reply_markup: {
          inline_keyboard: [[
            { text: '🎁 Участвую', callback_data: 'adm_part:1' },
            { text: '🛠 Только организую', callback_data: 'adm_part:0' },
          ]],
        },
      });
    }
    if (!wasRegistered) {
      // Сообщаем администраторам о новом участнике (без звука)
      const admins = (await allUsers(db)).filter((u) => u.is_admin && u.registered && u.tg_id !== from.id);
      if (admins.length) {
        await db.batch(admins.map((a) => enqueueStmt(db, a.tg_id, msg(`👋 Новый участник: <b>${escapeHtml(name)}</b>`, { disable_notification: true }))));
        ctx.waitUntil(flushOutbox(env));
      }
      await reply(`Приятно познакомиться, ${escapeHtml(name)}! 🎉\n\nТеперь открой приложение и напиши письмо своему Тайному Санте: что хочешь получить, что любишь, размеры, чего точно не надо.`);
    }
    return sendMenu(user);
  }

  if (!user.registered) return reply(NAME_PROMPT);

  // ---------- анонимные сообщения ----------
  if (user.pending === 'msg_ward' || user.pending === 'msg_santa') {
    if (!text || text.startsWith('/')) {
      await updateUser(db, from.id, { pending: '' });
      return sendMenu(user);
    }
    const toWard = user.pending === 'msg_ward';
    const res = await sendAnonymous(env, from.id, toWard ? 'ward' : 'santa', text, ctx);
    await updateUser(db, from.id, { pending: '' });
    return reply(res.ok ? '✅ Отправлено анонимно.' : '❌ ' + res.error);
  }

  return sendMenu(user);
}

export async function sendAnonymous(env, fromId, to, text, ctx) {
  const db = env.DB;
  text = String(text || '').trim().slice(0, 3500);
  if (!text) return { ok: false, error: 'Пустое сообщение.' };
  if (to === 'ward') {
    const p = await pairOfSanta(db, fromId);
    if (!p) return { ok: false, error: 'У тебя пока нет подопечного.' };
    await enqueueStmt(db, p.ward, {
      text: '🎅 <b>Сообщение от твоего Тайного Санты:</b>\n\n' + escapeHtml(text),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '↩️ Ответить Санте', callback_data: 'msg:santa' }]] },
    }).run();
  } else {
    const p = await pairOfWard(db, fromId);
    if (!p) return { ok: false, error: 'Жеребьёвка для тебя ещё не проведена.' };
    await enqueueStmt(db, p.santa, {
      text: '🎁 <b>Тебе пишет твой подопечный:</b>\n\n' + escapeHtml(text),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '↩️ Ответить подопечному', callback_data: 'msg:ward' }]] },
    }).run();
  }
  ctx.waitUntil(flushOutbox(env));
  return { ok: true };
}

const NOTIFY_LABELS = {
  sound: '🔔 Со звуком',
  silent: '🔕 Без звука',
  off: '🚫 Не присылать',
};

async function handleCallback(cq, env, ctx, call) {
  const db = env.DB;
  const from = cq.from;
  const data = cq.data || '';
  const answer = (text) => call('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) });
  const user = await getUser(db, from.id);
  if (!user || !user.registered) return answer('Сначала зарегистрируйся по пригласительной ссылке.');
  const settings = await getSettings(db);
  const send = (payload) => call('sendMessage', { chat_id: from.id, ...payload });

  if (data.startsWith('adm_part:') && user.is_admin) {
    const on = data.endsWith(':1') ? 1 : 0;
    await updateUser(db, from.id, { is_participant: on });
    await answer(on ? 'Отлично, ты участвуешь!' : 'Хорошо, ты только организатор.');
    const u = await getUser(db, from.id);
    const [pair, wardPair] = await Promise.all([pairOfSanta(db, u.tg_id), pairOfWard(db, u.tg_id)]);
    return send(menuMessage(u, settings, pair, wardPair));
  }

  if (data === 'msg:ward' || data === 'msg:santa') {
    const toWard = data === 'msg:ward';
    const p = toWard ? await pairOfSanta(db, from.id) : await pairOfWard(db, from.id);
    if (!p) return answer(toWard ? 'У тебя пока нет подопечного.' : 'Жеребьёвка для тебя ещё не проведена.');
    await updateUser(db, from.id, { pending: toWard ? 'msg_ward' : 'msg_santa' });
    await answer();
    return send(msg(
      toWard
        ? '✍️ Напиши сообщение подопечному — я передам его <b>анонимно</b>, от имени «Тайного Санты».\n\n/cancel — отмена'
        : '✍️ Напиши сообщение своему Санте — я передам его. Санта знает, кто ты, а ты его — нет.\n\n/cancel — отмена'
    ));
  }

  if (data === 'notify') {
    await answer();
    return send(msg(
      `Уведомления о том, что подопечный изменил письмо.\nСейчас: <b>${NOTIFY_LABELS[user.notify_mode] || NOTIFY_LABELS.sound}</b>`,
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

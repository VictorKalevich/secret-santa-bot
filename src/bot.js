// Обработка сообщений в чате с ботом (webhook от Telegram).

import {
  getSettings, getUser, createUser, updateUser, pairOfSanta, pairOfWard, enqueueStmt, allUsers,
  getEvent, getEventByInvite, getMember, addMemberStmt,
} from './db.js';
import { tgApi, derivedSecret } from './telegram.js';
import { escapeHtml, msg, q, openAppButton, adminRecipients, oneLine, shortTitle } from './format.js';
import { isFinished, chatWritable } from './events.js';
import { MAX_CHARS, sendChatMessage } from './chat.js';
import { resolveOwner, setOwner } from './roles.js';
import { joinByInvite, decideRequest } from './membership.js';

const NAME_PROMPT =
  'Как тебя зовут? Напиши имя (и, если нужно, фамилию) — так тебя увидят твой Санта и организатор.';
const CLOSED_BOT = '🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси у организатора пригласительную ссылку эвента.';
const STALE_INVITE = 'Эта пригласительная ссылка устарела. Попроси у организатора новую.';
// Режим ответа в переписку: msg_<ward|santa>:<эвент>[:<собеседник>:<время нажатия>] (старый формат — без двух последних)
const REPLY_MODE = /^msg_(ward|santa):(\d+)(?::(\d+):(\d+))?$/;
const REPLY_WINDOW_MS = 60 * 60 * 1000;

// Меню: идущие эвенты человека с кнопками переписки. Один запрос к базе на любое число эвентов (009, FR-913).
async function buildMenu(db, user, settings) {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.title, e.status, e.draw_done, m.wishlist,
              EXISTS (SELECT 1 FROM pairs p WHERE p.event_id = e.id AND p.santa = ?1) AS has_ward,
              EXISTS (SELECT 1 FROM pairs p WHERE p.event_id = e.id AND p.ward = ?1) AS has_santa
         FROM members m JOIN events e ON e.id = m.event_id
        WHERE m.user_id = ?1 ORDER BY e.created_at DESC`
    )
    .bind(user.tg_id)
    .all();
  const active = results.filter((e) => e.status === 'active');
  const finishedCount = results.length - active.length;
  const items = active.slice(0, 5);

  const lines = ['🎄 <b>Тайный Санта</b>', ''];
  if (!items.length) {
    lines.push(user.is_admin
      ? 'Идущих эвентов у тебя нет. Создай эвент в приложении — там появится пригласительная ссылка.'
      : 'Сейчас ты не участвуешь ни в одном идущем эвенте. Попроси у организатора пригласительную ссылку.');
  } else {
    lines.push('Твои эвенты:');
    for (const ev of items) {
      const letter = ev.wishlist.trim() ? 'письмо ✅' : 'письмо пустое ✏️';
      const draw = !ev.draw_done ? 'жеребьёвка впереди' : ev.has_ward ? 'подопечный назначен 🎁' : 'ждёт добавления в жеребьёвку';
      lines.push(`• ${q(ev)} — ${letter}, ${draw}`);
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
  const writeLetter = (text, ev) => ({
    ...msg(text),
    reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] },
  });
  // Ответ на вступление по ссылке (joinByInvite); true — показать меню следом
  const replyJoin = async (ev, status) => {
    switch (status) {
      case 'joined':
        await reply(writeLetter(`🎄 Ты в эвенте ${q(ev)}! Открой приложение и напиши письмо своему Тайному Санте.`, ev));
        return true;
      case 'closed':
        await reply(`Регистрация в эвент ${q(ev)} закрыта. Напиши организатору — он может открыть её снова.`);
        return false;
      case 'request_pending':
        await reply(`⏳ Заявка в эвент ${q(ev)} уже отправлена — ждём решения организатора.`);
        return false;
      case 'request_rejected':
        await reply(`Организатор не одобрил заявку в эвент ${q(ev)}. Если это ошибка — напиши ему.`);
        return false;
      default:
        await reply(`⏳ Заявка в эвент ${q(ev)} отправлена организатору. Как только он её рассмотрит, я напишу.`);
        return false;
    }
  };

  // Любая команда выключает режим ответа в переписку (009, FR-916): текст после неё не уйдёт собеседнику
  if (user && text.startsWith('/') && REPLY_MODE.test(user.pending)) {
    await updateUser(db, from.id, { pending: '' });
    user.pending = '';
  }

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

    // Пригласительная ссылка эвента (005; 009 — единая логика с вводом имени)
    if (payload.startsWith('inv_')) {
      const code = payload.slice(4);
      const ev = await getEventByInvite(db, code);
      if (!ev) {
        await reply(STALE_INVITE);
        return user?.registered ? sendMenu(user) : undefined;
      }
      const member = user ? await getMember(db, ev.id, from.id) : null;
      if (user?.registered) {
        // Участник открыл ссылку снова — даже после жеребьёвки и закрытия регистрации (009, FR-921)
        if (member) {
          await reply(`🎄 Ты уже участвуешь в эвенте ${q(ev)}.`);
          return sendMenu(user);
        }
        if (await replyJoin(ev, await joinByInvite(env, ev, user))) return sendMenu(user);
        return;
      }
      // Ещё без имени: сначала имя, вступление — после него (joinByInvite). Код ссылки запоминаем, чтобы после имени
      // не вступить по уже сменённой ссылке.
      if (!member && (isFinished(ev) || !ev.registration_open)) {
        return reply(`Регистрация в эвент ${q(ev)} закрыта. Напиши организатору — он может открыть её снова.`);
      }
      const pending = `name:${ev.id}:${code}`;
      if (!user) await createUser(db, from.id, from.username, { pending });
      else await updateUser(db, from.id, { pending });
      // Без одобрения человек сразу виден организатору в списке (ещё без имени)
      if (!member && !ev.approval) await addMemberStmt(db, ev, from.id).run();
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
    const [, eid, code] = user.pending.split(':');
    await updateUser(db, from.id, { name, username: from.username || '', registered: 1, pending: '' });
    user = await getUser(db, from.id);
    const hello = `Приятно познакомиться, ${escapeHtml(name)}! 🎉`;
    const ev = Number(eid) ? await getEvent(db, eid) : null;
    if (!ev) {
      if (eid) await reply(hello + '\n\n' + STALE_INVITE);
      else await reply(hello + (user.is_admin ? '\n\nСоздай первый эвент в приложении — там появится пригласительная ссылка.' : ''));
      return sendMenu(user);
    }
    // Уже участник (вступил до имени) — приветствие, организатору «присоединяется»
    if (await getMember(db, ev.id, from.id)) {
      await notifyAdminsJoined(env, name, ev, from.id);
      await reply(writeLetter(`${hello}\n\nТеперь открой приложение и напиши письмо своему Тайному Санте в эвенте ${q(ev)}: что хочешь получить, что любишь, размеры, чего точно не надо.`, ev));
      return sendMenu(user);
    }
    // Не участник (заявка, удалили до имени, сменили ссылку) — вступление как по ссылке (009, FR-922)
    if (ev.invite_code !== code) {
      await reply(hello + '\n\n' + STALE_INVITE);
      return sendMenu(user);
    }
    await reply(hello);
    const status = await joinByInvite(env, ev, user);
    const menu = await replyJoin(ev, status);
    if (menu || status === 'closed') return sendMenu(user);
    return;
  }

  if (!user.registered) return reply(NAME_PROMPT);

  // ---------- ответ в переписку (003/005; 009 — привязан к собеседнику и истекает через час) ----------
  const rm = REPLY_MODE.exec(user.pending);
  if (rm) {
    const toWard = rm[1] === 'ward';
    const otherId = Number(rm[3] || 0);
    const since = Number(rm[4] || 0);
    if (!text) {
      await updateUser(db, from.id, { pending: '' });
      return sendMenu(user);
    }
    if (!since || Date.now() - since > REPLY_WINDOW_MS) {
      await updateUser(db, from.id, { pending: '' });
      return reply('⌛ Время ответа истекло — сообщение не отправлено. Нажми «↩️ Ответить» ещё раз и пришли его снова.');
    }
    if (text.length > MAX_CHARS) {
      return reply(`❌ Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS}. Отправь покороче или /cancel.`);
    }
    const ev = await getEvent(db, rm[2]);
    await updateUser(db, from.id, { pending: '' });
    if (!ev) return reply('❌ Эвент не найден.');
    const res = await sendChatMessage(env, ev, from.id, toWard ? 'ward' : 'santa', text, { expectOther: otherId });
    if (res.ok) return reply(toWard ? '✅ Отправлено подопечному от «Тайного Санты».' : '✅ Отправлено твоему Санте.');
    return reply(res.pairChanged ? res.error : '❌ ' + res.error);
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
    // Нажатие отклонено — прежний режим ответа тоже выключается: текст не уйдёт туда, куда человек уже не целится
    const refuse = async (text) => {
      if (REPLY_MODE.test(user.pending)) await updateUser(db, from.id, { pending: '' });
      return answer(text);
    };
    const ev = await getEvent(db, mm[2]);
    if (!ev) return refuse('Эвент не найден.');
    const p = toWard ? await pairOfSanta(db, ev.id, from.id) : await pairOfWard(db, ev.id, from.id);
    if (!p) return refuse(toWard ? 'У тебя пока нет подопечного.' : 'Жеребьёвка для тебя ещё не проведена.');
    if (!chatWritable(ev)) return refuse('Эвент завершён больше недели назад — переписка только для чтения.');
    // Режим ответа помнит собеседника и время нажатия (только на сервере): msg_<сторона>:<эвент>:<собеседник>:<мс>
    const other = toWard ? p.ward : p.santa;
    await updateUser(db, from.id, { pending: `msg_${mm[1]}:${ev.id}:${other}:${Date.now()}` });
    await answer();
    return send(msg(
      (toWard
        ? `✍️ Напиши сообщение подопечному (эвент ${q(ev)}) — я передам его <b>анонимно</b>, от имени «Тайного Санты».`
        : `✍️ Напиши сообщение своему Санте (эвент ${q(ev)}) — я передам его. Санта знает, кто ты, а ты его — нет.`) +
      `\nДо ${MAX_CHARS} символов, в течение часа. Вся переписка — в приложении (кнопка «💬»).\n\n/cancel — отмена`
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

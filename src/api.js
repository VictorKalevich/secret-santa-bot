// JSON API для мини-приложения. Каждый запрос подписан Telegram (initData).

import {
  getSettings, getUser, updateUser, allUsers, getPairs, pairOfSanta, pairOfWard, getExclusions,
  getEvent, allEvents, getMember, eventMembers, addMemberStmt,
  updateEventStmt, auditStmt, auditIfStmt, getAudit, getAnnouncements, enqueueIfStmt, clearRemovedStmt,
} from './db.js';
import { validateInitData } from './telegram.js';
import { msg, q, openAppButton, inviteLink, randomCode, displayName, cleanText, oneLine, ISO_DATE } from './format.js';
import {
  isFinished, chatUntil, chatWritable, createEvent, finishEvent, deleteEvent, resetEvent, inviteFromEvent,
  revealAll, remindUnfilled, remindSantas, announce,
} from './events.js';
import { checkDraw, runDraw, removeMember, insertMember, cancelDraw, drawCancelable } from './pairs.js';
import { MAX_CHARS, chatPair, sendChatMessage, unreadCounts, unreadByEvent } from './chat.js';
import { resolveOwner, grantAdmin, revokeAdmin, transferOwnership, transferAccount } from './roles.js';
import { saveFamily, deleteFamily, decideRequest } from './membership.js';
import { vaultPerson, vaultPairs } from './vault.js';

const DELIVERY_MAX = 500;
const EXCLUSIONS_FROZEN =
  'После жеребьёвки исключения не меняются: иначе по заменам участников можно было бы вычислить пары. ' +
  'Чтобы поменять исключения, отмени жеребьёвку (пока никто не открыл подопечного).';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const fail = (error, status = 400) => json({ ok: false, error }, status);

function publicEvent(ev) {
  return {
    id: ev.id,
    title: ev.title,
    status: ev.status,
    finished_at: ev.finished_at,
    chat_until: chatUntil(ev),
    budget: ev.budget,
    event_date: ev.event_date,
    place: ev.place,
    deadline: ev.deadline,
    notes: ev.notes,
    draw_done: !!ev.draw_done,
    revealed: !!ev.revealed,
    ring: !!ev.ring,
    delivery_on: !!ev.delivery_on, // 008
    approval: !!ev.approval,
    rejoin: !!ev.rejoin, // 010: удалённые организатором могут вернуться по ссылке
  };
}

export async function handleApi(request, env, action) {
  if (request.method !== 'POST') return fail('method', 405);
  const tgUser = await validateInitData(request.headers.get('x-init-data'), env.BOT_TOKEN);
  if (!tgUser) return fail('Не удалось проверить вход. Открой приложение заново из чата с ботом.', 401);
  const body = await request.json().catch(() => ({}));
  const db = env.DB;
  const me = await getUser(db, tgUser.id);
  const settings = await getSettings(db);
  // Человек открыл приложение — значит, бот у него не заблокирован (006, FR-609)
  if (me?.blocked_at) await updateUser(db, me.tg_id, { blocked_at: 0 });

  if (action === 'me') {
    if (!me || !me.registered) return json({ ok: true, registered: false });
    const ownerId = me.is_admin ? await resolveOwner(db, settings) : null;
    const { results: mine } = await db.prepare('SELECT event_id FROM members WHERE user_id = ?').bind(me.tg_id).all();
    const memberOf = new Set(mine.map((r) => r.event_id));
    const unread = await unreadByEvent(db, me.tg_id);
    const events = (await allEvents(db))
      .filter((e) => me.is_admin || memberOf.has(e.id))
      .map((e) => ({
        id: e.id, title: e.title, status: e.status, finished_at: e.finished_at, event_date: e.event_date,
        draw_done: !!e.draw_done, member: memberOf.has(e.id), unread: unread[e.id] || 0,
      }));
    return json({
      ok: true,
      registered: true,
      me: { id: me.tg_id, name: me.name, is_admin: !!me.is_admin, is_owner: !!me.is_admin && ownerId === me.tg_id, notify_mode: me.notify_mode },
      events,
      limits: { chars: MAX_CHARS },
    });
  }

  if (!me || !me.registered) return fail('Сначала зарегистрируйся по пригласительной ссылке.', 403);

  if (action === 'notify.set') {
    if (!['sound', 'silent', 'off'].includes(body.mode)) return fail('bad mode');
    await updateUser(db, me.tg_id, { notify_mode: body.mode });
    return json({ ok: true });
  }

  // ---------- администратор ----------
  if (action.startsWith('admin.')) {
    if (!me.is_admin) return fail('Только для администратора.', 403);
    const result = await handleAdmin(action, body, env, me, settings);
    if (result instanceof Response) return result;
    return json({ ok: true, ...result });
  }

  // ---------- участник эвента ----------
  const ev = await getEvent(db, body.event);
  if (!ev) return fail('Эвент не найден.', 404);
  const member = await getMember(db, ev.id, me.tg_id);

  if (action === 'event.get') {
    if (!member && !me.is_admin) return fail('Ты не участвуешь в этом эвенте.', 403);
    const participants = (await eventMembers(db, ev.id)).filter((m) => m.registered).length;
    const out = {
      ok: true,
      event: { ...publicEvent(ev), participants },
      announcements: await getAnnouncements(db, ev.id), // 007, FR-701
      member: null,
      can: { edit_letter: false, chat_write: false },
    };
    if (member) {
      const [pair, wardPair] = await Promise.all([pairOfSanta(db, ev.id, me.tg_id), pairOfWard(db, ev.id, me.tg_id)]);
      out.member = {
        wishlist: member.wishlist,
        wishlist_updated_at: member.wishlist_updated_at,
        has_ward: !!pair,
        has_santa: !!wardPair,
        gift_received: !!wardPair?.gift_received, // 007, FR-704
        delivery: member.delivery, // 008: свой адрес доставки
        unread: pair || wardPair ? await unreadCounts(db, ev.id, me.tg_id) : { from_ward: 0, from_santa: 0 },
      };
      out.can = { edit_letter: !isFinished(ev), chat_write: chatWritable(ev) };
    }
    return json(out);
  }

  if (!member) return fail('Ты не участвуешь в этом эвенте.', 403);

  switch (action) {
    case 'wishlist.save': {
      if (isFinished(ev)) return fail('Эвент завершён: письмо теперь только для чтения.');
      const text = String(body.text ?? '').replace(/\r\n/g, '\n');
      if (text.length > MAX_CHARS) {
        return fail(`Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS} (лимит сообщения Telegram).`);
      }
      if (text === member.wishlist) return json({ ok: true, updated_at: member.wishlist_updated_at });
      const now = Date.now();
      await db.prepare('UPDATE members SET wishlist = ?, wishlist_updated_at = ? WHERE event_id = ? AND user_id = ?')
        .bind(text, now, ev.id, me.tg_id).run();
      return json({ ok: true, updated_at: now });
    }

    case 'delivery.save': {
      // Адрес доставки (008): виден только самому участнику и его Санте
      if (!ev.delivery_on) return fail('В этом эвенте адрес доставки не нужен.');
      if (isFinished(ev)) return fail('Эвент завершён: адрес теперь только для чтения.');
      const text = cleanText(body.text);
      if (text.length > DELIVERY_MAX) return fail(`Слишком длинно: ${text.length} символов, максимум ${DELIVERY_MAX}.`);
      if (text === member.delivery) return json({ ok: true, updated_at: member.delivery_updated_at });
      const now = Date.now();
      await db.prepare('UPDATE members SET delivery = ?, delivery_updated_at = ? WHERE event_id = ? AND user_id = ?')
        .bind(text, now, ev.id, me.tg_id).run();
      return json({ ok: true, updated_at: now });
    }

    case 'ward.get': {
      if (!ev.draw_done) return json({ ok: true, state: 'no_draw' });
      const pair = await pairOfSanta(db, ev.id, me.tg_id);
      if (!pair) return json({ ok: true, state: 'waiting' });
      const [ward, wardMember] = await Promise.all([getUser(db, pair.ward), getMember(db, ev.id, pair.ward)]);
      if (!ward || !wardMember) return json({ ok: true, state: 'waiting' });
      const prev = pair.seen_text;
      if (prev !== wardMember.wishlist) {
        await db.prepare('UPDATE pairs SET seen_text = ? WHERE event_id = ? AND santa = ?').bind(wardMember.wishlist, ev.id, me.tg_id).run();
      }
      return json({
        ok: true,
        state: 'ok',
        ward: {
          name: ward.name,
          wishlist: wardMember.wishlist,
          updated_at: wardMember.wishlist_updated_at,
          ...(ev.delivery_on ? { delivery: wardMember.delivery } : {}), // 008: адрес — только Санте
        },
        previous: prev === null || prev === wardMember.wishlist ? null : prev,
        first_view: prev === null,
        gift_ready: !!pair.gift_ready,
      });
    }

    case 'ward.gift': {
      if (isFinished(ev)) return fail('Эвент завершён: отметка только для чтения.');
      const r = await db.prepare('UPDATE pairs SET gift_ready = ? WHERE event_id = ? AND santa = ?').bind(body.ready ? 1 : 0, ev.id, me.tg_id).run();
      if (!r.meta.changes) return fail('У тебя пока нет подопечного.');
      return json({ ok: true });
    }

    case 'ward.received': {
      // Подопечный отмечает «подарок получен» (007, FR-704). Санта узнаёт об этом только при первой отметке.
      if (isFinished(ev)) return fail('Эвент завершён: отметка только для чтения.');
      const pair = await pairOfWard(db, ev.id, me.tg_id);
      if (!pair) return fail('У тебя пока нет Санты.');
      const on = body.received ? 1 : 0;
      const now = Date.now();
      const stmts = [
        db.prepare(
          `UPDATE pairs SET gift_received = ?, gift_received_at = CASE WHEN ? = 1 AND gift_received_at = 0 THEN ? ELSE gift_received_at END
            WHERE event_id = ? AND ward = ?`
        ).bind(on, on, now, ev.id, me.tg_id),
      ];
      if (on && !pair.gift_received_at) {
        // Только если отметку поставил именно этот запрос (защита от двойного нажатия)
        stmts.push(enqueueIfStmt(db, pair.santa, msg(
          `🎉 Твой подопечный в эвенте ${q(ev)} получил подарок! Спасибо, Санта 🎅`,
          { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть', { event: ev.id })]] } }
        ), 'EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND ward = ? AND gift_received_at = ?)', ev.id, me.tg_id, now));
      }
      await db.batch(stmts);
      return json({ ok: true });
    }

    case 'message.send': {
      const to = body.to === 'santa' ? 'santa' : 'ward';
      const r = await sendChatMessage(env, ev, me.tg_id, to, body.text);
      return r.ok ? json({ ok: true, message: r.message }) : fail(r.error);
    }

    case 'chat.get': {
      const withWhom = body.with === 'santa' ? 'santa' : 'ward';
      const pair = await chatPair(db, ev.id, me.tg_id, withWhom);
      if (!pair) return json({ ok: true, state: 'no_pair' });
      const after = Number(body.after) || 0;
      const sql = after
        ? db.prepare('SELECT id, sender, text, created_at FROM messages WHERE event_id = ? AND santa = ? AND ward = ? AND id > ? ORDER BY id LIMIT 300')
            .bind(ev.id, pair.santa, pair.ward, after)
        : db.prepare('SELECT id, sender, text, created_at FROM messages WHERE event_id = ? AND santa = ? AND ward = ? ORDER BY id DESC LIMIT 300')
            .bind(ev.id, pair.santa, pair.ward);
      const { results } = await sql.all();
      if (!after) results.reverse();
      if (results.some((m) => m.sender !== pair.me)) {
        await db.prepare('UPDATE messages SET read_at = ? WHERE event_id = ? AND santa = ? AND ward = ? AND sender != ? AND read_at = 0')
          .bind(Date.now(), ev.id, pair.santa, pair.ward, pair.me).run();
      }
      // Только текст и «моё/не моё» — без ID и имён собеседника (Конституция, принцип I)
      return json({
        ok: true,
        state: 'ok',
        counterpart: withWhom,
        writable: chatWritable(ev),
        messages: results.map((m) => ({ id: m.id, mine: m.sender === pair.me, text: m.text, created_at: m.created_at })),
      });
    }
  }
  return fail('Неизвестное действие', 404);
}

// Действия, разрешённые в завершённом эвенте
// Завершённый эвент — только просмотр, раскрытие, удаление и приглашение его участников в новый.
// Сброс запрещён: он вернул бы эвент в «идёт», а завершение необратимо (FR-506).
// Служебный просмотр владельца (010) — тоже только чтение.
const FINISHED_OK = new Set([
  'admin.state', 'admin.wishlist', 'admin.reveal', 'admin.event.delete', 'admin.event.invite_from', 'admin.audit',
  'admin.vault.person', 'admin.vault.pairs',
]);

async function handleAdmin(action, body, env, me, settings) {
  const db = env.DB;
  const ownerId = await resolveOwner(db, settings);
  const isOwner = ownerId === me.tg_id;
  const ownerOnly = (what = 'Назначать и снимать администраторов') => fail(`${what} может только владелец бота.`, 403);
  const nameOf = async (id) => displayName(await getUser(db, id));

  // ---------- общие (без эвента) ----------
  switch (action) {
    case 'admin.events.create': {
      let from = null;
      if (body.from) {
        from = await getEvent(db, body.from);
        if (!from) return fail('Образец не найден.');
      }
      const r = await createEvent(env, body.title, me.tg_id, { from, invite: !!body.invite });
      return r.ok ? { event: publicEvent(r.event), invited: r.invited, invite_error: r.inviteError } : fail(r.error);
    }
    case 'admin.families': {
      // Семьи (008) — общие для бота; адресов и пар здесь нет
      const [users, fams, rows] = await Promise.all([
        allUsers(db),
        db.prepare('SELECT id, name FROM families ORDER BY name').all().then((r) => r.results),
        db.prepare('SELECT user_id, family_id FROM family_members').all().then((r) => r.results),
      ]);
      const famOf = Object.fromEntries(rows.map((r) => [r.user_id, r.family_id]));
      const reg = users.filter((u) => u.registered);
      return {
        families: fams.map((f) => ({ id: f.id, name: f.name, members: reg.filter((u) => famOf[u.tg_id] === f.id).map((u) => ({ id: u.tg_id, name: u.name })) })),
        users: reg.map((u) => ({ id: u.tg_id, name: u.name, family_id: famOf[u.tg_id] || 0 })),
      };
    }
    case 'admin.family.save': {
      // Владелец видит пары и так — заморозка семей против вычисления пар на него не действует (010, FR-1008)
      const r = await saveFamily(env, me.tg_id, { id: body.id, name: body.name, members: body.members }, { owner: isOwner });
      return r.ok ? {} : fail(r.error);
    }
    case 'admin.family.delete': {
      const r = await deleteFamily(env, me.tg_id, body.id, { owner: isOwner });
      return r.ok ? {} : fail(r.error);
    }
    case 'admin.audit': {
      if (body.event) break; // журнал эвента — ниже, в пределах эвента
      return { entries: await getAudit(db, 0) };
    }
    case 'admin.users': {
      const users = (await allUsers(db)).filter((u) => u.registered);
      return {
        users: users.map((u) => ({ id: u.tg_id, name: u.name, username: u.username, is_admin: !!u.is_admin, is_owner: u.tg_id === ownerId })),
        owner_id: ownerId,
        owner_name: users.find((u) => u.tg_id === ownerId)?.name || '',
      };
    }
    case 'admin.rename': {
      const name = oneLine(body.name);
      if (!name || name.length > 40) return fail('Имя должно быть от 1 до 40 символов');
      const target = await getUser(db, Number(body.id));
      if (!target) return fail('Участник не найден');
      // Администраторов и владельца переименовывает только владелец; себя — любой админ (006, FR-613)
      if ((target.is_admin || target.tg_id === ownerId) && target.tg_id !== me.tg_id && !isOwner) {
        return fail('Переименовать администратора может только владелец бота.', 403);
      }
      await updateUser(db, target.tg_id, { name });
      return {};
    }
    case 'admin.transfer': {
      // Иначе админ перенёс бы участие игрока на свой второй, не-админский аккаунт и увидел его пары (010, FR-1001)
      if (!isOwner) return ownerOnly('Переносить участие на новый аккаунт');
      const from = Number(body.from);
      if (from === ownerId) {
        return fail('Запись владельца не переносится: владелец восстанавливает доступ по новой ссылке владельца (смена ADMIN_SECRET → страница /setup).');
      }
      const to = Number(body.to);
      const [fromUser, toUser] = await Promise.all([getUser(db, from), getUser(db, to)]);
      if (fromUser?.is_admin && !isOwner) return fail('Перенести администратора может только владелец бота.', 403);
      // Иначе админ получил бы чужие пары и переписку (Конституция, принцип I; 006, FR-601)
      if (toUser?.is_admin || to === ownerId) return fail('Переносить участие на аккаунт администратора нельзя.');
      const r = await transferAccount(env, from, to, me.tg_id);
      return r.ok ? { events: r.events } : fail(r.error);
    }
    case 'admin.role.grant': {
      if (!isOwner) return ownerOnly();
      const r = await grantAdmin(env, Number(body.id), me.tg_id);
      return r.ok ? {} : fail(r.error);
    }
    case 'admin.role.revoke': {
      if (!isOwner) return ownerOnly();
      const r = await revokeAdmin(env, Number(body.id), me.tg_id);
      return r.ok ? {} : fail(r.error);
    }
    case 'admin.owner.transfer': {
      if (!isOwner) return ownerOnly('Передать права владельца');
      const r = await transferOwnership(env, me.tg_id, Number(body.id));
      return r.ok ? {} : fail(r.error);
    }
  }

  // ---------- в пределах эвента ----------
  const ev = await getEvent(db, body.event);
  if (!ev) return fail('Эвент не найден.', 404);
  if (isFinished(ev) && !FINISHED_OK.has(action)) return fail('Эвент завершён — менять его уже нельзя (доступны просмотр, раскрытие и удаление).');

  switch (action) {
    case 'admin.state': {
      const [members, pairs, exclusions, events, cancelable, famRows, requests, removed] = await Promise.all([
        eventMembers(db, ev.id), getPairs(db, ev.id), getExclusions(db, ev.id), allEvents(db), drawCancelable(db, ev),
        db.prepare('SELECT fm.user_id, f.id, f.name FROM family_members fm JOIN families f ON f.id = fm.family_id').all().then((r) => r.results),
        db.prepare(
          `SELECT r.id, r.user_id, r.created_at, u.name, u.username FROM join_requests r JOIN users u ON u.tg_id = r.user_id
            WHERE r.event_id = ? AND r.status = 'pending' ORDER BY r.id`
        ).bind(ev.id).all().then((r) => r.results),
        // 010: удалённые организатором (при запрете возврата они не войдут по ссылке)
        db.prepare(
          `SELECT r.user_id, r.removed_at, u.name, u.username FROM removed_members r JOIN users u ON u.tg_id = r.user_id
            WHERE r.event_id = ? ORDER BY r.removed_at DESC`
        ).bind(ev.id).all().then((r) => r.results),
      ]);
      const santas = new Set(pairs.map((p) => p.santa));
      const ready = new Set(pairs.filter((p) => p.gift_ready).map((p) => p.santa));
      // 007: статусы человека, а не пары — «получил подарок» (как подопечный) и «открыл подопечного» (как Санта)
      const received = new Set(pairs.filter((p) => p.gift_received).map((p) => p.ward));
      const seen = new Set(pairs.filter((p) => p.seen_text !== null).map((p) => p.santa));
      const memberIds = new Set(members.map((m) => m.user_id));
      // ВАЖНО: здесь нет ни пар, ни текстов писем — только статусы.
      return {
        users: members.map((u) => ({
          id: u.user_id,
          name: u.name,
          username: u.username,
          registered: !!u.registered,
          is_admin: !!u.is_admin,
          is_owner: u.user_id === ownerId,
          has_wishlist: !!u.wishlist.trim(),
          in_draw: santas.has(u.user_id),
          gift_ready: ready.has(u.user_id),
          blocked: !!u.blocked_at, // Telegram сообщил, что бот заблокирован (006)
          gift_received: received.has(u.user_id),
          ward_seen: santas.has(u.user_id) ? seen.has(u.user_id) : null,
          // 008: только «указан ли адрес» — сам адрес админу не отдаётся
          ...(ev.delivery_on ? { has_delivery: !!u.delivery.trim() } : {}),
        })),
        // 008: семьи, в которых не меньше двух участников этого эвента
        families: Object.values(famRows.filter((r) => memberIds.has(r.user_id)).reduce((acc, r) => {
          (acc[r.id] ||= { id: r.id, name: r.name, members: [] }).members.push(r.user_id);
          return acc;
        }, {})).filter((f) => f.members.length >= 2),
        requests: requests.map((r) => ({ id: r.id, user_id: r.user_id, name: r.name, username: r.username, created_at: r.created_at })),
        removed: removed.map((r) => ({ id: r.user_id, name: r.name, username: r.username, removed_at: r.removed_at })),
        // Исключения образца начинают действовать, когда оба вступят (007, FR-707)
        exclusions: exclusions.filter((e) => memberIds.has(e.giver) && memberIds.has(e.receiver)),
        me_member: members.some((m) => m.user_id === me.tg_id),
        other_events: events.filter((e) => e.id !== ev.id).map((e) => ({ id: e.id, title: e.title, status: e.status })),
        settings: {
          ...publicEvent(ev),
          registration_open: !!ev.registration_open,
          avoid_previous: !!ev.avoid_previous,
          invite_link: inviteLink(settings, ev),
          draw_at: ev.draw_at,
          owner_id: ownerId,
          draw_auto_date: ev.draw_auto_date,
          reveal_auto: !!ev.reveal_auto,
          finish_auto: !!ev.finish_auto,
          draw_cancelable: cancelable,
          families_on: !!ev.families_on,
        },
      };
    }

    case 'admin.wishlist': {
      const [u, m] = await Promise.all([getUser(db, Number(body.id)), getMember(db, ev.id, Number(body.id))]);
      if (!u || !m) return fail('Участник не найден');
      await auditStmt(db, ev.id, me.tg_id, 'wishlist.view', u.name).run();
      return { name: u.name, wishlist: m.wishlist, updated_at: m.wishlist_updated_at };
    }

    case 'admin.game': {
      const clean = (v, n) => String(v ?? '').slice(0, n);
      const date = (v) => (ISO_DATE.test(v || '') ? v : '');
      const title = oneLine(body.title ?? ev.title);
      if (!title || title.length > 80) return fail('Название эвента — от 1 до 80 символов.');
      // Меняются только переданные поля (008): отдельные переключатели не стирают остальные параметры
      const fields = { title };
      const limits = { budget: 100, place: 200, notes: 2000 };
      for (const [k, n] of Object.entries(limits)) if (k in body) fields[k] = clean(body[k], n);
      for (const k of ['event_date', 'deadline']) if (k in body) fields[k] = date(body[k]);
      // Расписание (007, FR-702): дату автожеребьёвки после жеребьёвки не изменить
      if ('draw_auto_date' in body) {
        const auto = date(body.draw_auto_date);
        if (auto !== ev.draw_auto_date) {
          if (ev.draw_done) return fail('Дату автожеребьёвки после жеребьёвки не задать.');
          fields.draw_auto_date = auto;
        }
      }
      // 008: адрес доставки, одобрение заявок, семьи (семьи — только до жеребьёвки)
      if ('delivery_on' in body) fields.delivery_on = body.delivery_on ? 1 : 0;
      if ('approval' in body) fields.approval = body.approval ? 1 : 0;
      if ('rejoin' in body) fields.rejoin = body.rejoin ? 1 : 0; // 010
      if ('families_on' in body && (body.families_on ? 1 : 0) !== ev.families_on) {
        if (ev.draw_done) return fail('После жеребьёвки правило семей не изменить.');
        fields.families_on = body.families_on ? 1 : 0;
      }
      if ('reveal_auto' in body) fields.reveal_auto = body.reveal_auto ? 1 : 0;
      if ('finish_auto' in body) fields.finish_auto = body.finish_auto ? 1 : 0;
      await db.batch([updateEventStmt(db, ev.id, fields), auditStmt(db, ev.id, me.tg_id, 'event.settings', 'параметры эвента')]);
      return {};
    }

    case 'admin.ring': {
      if (ev.draw_done) return fail('После жеребьёвки кольцевую жеребьёвку менять нельзя.');
      await db.batch([
        updateEventStmt(db, ev.id, { ring: body.on ? 1 : 0 }),
        auditStmt(db, ev.id, me.tg_id, 'event.settings', `кольцевая жеребьёвка: ${body.on ? 'вкл' : 'выкл'}`),
      ]);
      return {};
    }

    case 'admin.registration':
      await db.batch([
        updateEventStmt(db, ev.id, { registration_open: body.open ? 1 : 0 }),
        auditStmt(db, ev.id, me.tg_id, 'registration', body.open ? 'открыта' : 'закрыта'),
      ]);
      return {};

    case 'admin.invite.regen':
      await db.batch([updateEventStmt(db, ev.id, { invite_code: randomCode() }), auditStmt(db, ev.id, me.tg_id, 'invite.regen')]);
      return {};

    case 'admin.avoid_previous':
      await db.batch([
        updateEventStmt(db, ev.id, { avoid_previous: body.on ? 1 : 0 }),
        auditStmt(db, ev.id, me.tg_id, 'event.settings', `не повторять прошлые пары: ${body.on ? 'вкл' : 'выкл'}`),
      ]);
      return {};

    case 'admin.participate': {
      if (ev.draw_done) return fail('После жеребьёвки так нельзя. Попроси другого админа вписать тебя.');
      const log = auditStmt(db, ev.id, me.tg_id, 'participate', body.on ? 'участвует' : 'не участвует');
      if (body.on) await db.batch([addMemberStmt(db, ev, me.tg_id), clearRemovedStmt(db, ev.id, me.tg_id), log]);
      else {
        await db.batch([
          db.prepare('DELETE FROM exclusions WHERE event_id = ? AND (giver = ? OR receiver = ?)').bind(ev.id, me.tg_id, me.tg_id),
          db.prepare('DELETE FROM members WHERE event_id = ? AND user_id = ?').bind(ev.id, me.tg_id),
          log,
        ]);
      }
      return {};
    }

    case 'admin.remove': {
      const id = Number(body.id);
      if (id === me.tg_id) return fail('Нельзя удалить самого себя — выключи «Я участвую».');
      if (id === ownerId) return fail('Владельца нельзя удалить из эвента. Сначала он должен передать права владельца.');
      const target = await getUser(db, id);
      if (target?.is_admin && !isOwner) return fail('Удалить администратора может только владелец бота.', 403);
      if (!(await getMember(db, ev.id, id))) return fail('Человек не участвует в этом эвенте.');
      // Отметка «удалён организатором» (010): при запрете возврата человек не войдёт по ссылке снова
      const r = await removeMember(env, ev, id, { actor: me.tg_id, mark: true });
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.removed.allow': {
      const id = Number(body.id) || 0;
      const row = await db.prepare('SELECT 1 FROM removed_members WHERE event_id = ? AND user_id = ?').bind(ev.id, id).first();
      if (!row) return fail('Этого человека нет среди удалённых.');
      await db.batch([clearRemovedStmt(db, ev.id, id), auditStmt(db, ev.id, me.tg_id, 'member.allow', await nameOf(id))]);
      return {};
    }

    case 'admin.insert': {
      // Вписав себя, админ узнал бы своего подопечного из заранее известной перестановки (009, FR-903).
      // Владелец пары видит и так (010, FR-1008).
      if (Number(body.id) === me.tg_id && !isOwner) return fail('Вписать себя нельзя — попроси другого администратора.');
      const r = await insertMember(env, ev, Number(body.id), me.tg_id);
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.exclusion.add':
    case 'admin.exclusion.del': {
      // После жеребьёвки исключения заморожены: по заменам при удалении/вписывании их можно было бы использовать,
      // чтобы вычислить пары (009, FR-901). Условие повторено в SQL — на случай жеребьёвки в эту же секунду.
      // Владелец пары видит и так — для него заморозки нет (010, FR-1008).
      if (ev.draw_done && !isOwner) return fail(EXCLUSIONS_FROZEN);
      const giver = Number(body.giver);
      const receiver = Number(body.receiver);
      const add = action === 'admin.exclusion.add';
      if (add) {
        if (!giver || !receiver || giver === receiver) return fail('Выбери двух разных людей');
        const [g, r] = await Promise.all([getMember(db, ev.id, giver), getMember(db, ev.id, receiver)]);
        if (!g || !r) return fail('Исключение можно задать только между участниками эвента.');
      }
      const beforeDraw = isOwner ? '? > 0' : 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)';
      const change = (a, b) => add
        ? db.prepare(`INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) SELECT ?, ?, ? WHERE ${beforeDraw}`).bind(ev.id, a, b, ev.id)
        : db.prepare(`DELETE FROM exclusions WHERE event_id = ? AND giver = ? AND receiver = ? AND ${beforeDraw}`).bind(ev.id, a, b, ev.id);
      const stmts = [change(giver, receiver)];
      if (body.mutual) stmts.push(change(receiver, giver));
      const names = `${await nameOf(giver)} ${body.mutual ? '↔' : '→'} ${await nameOf(receiver)}`;
      stmts.push(auditIfStmt(db, ev.id, me.tg_id, add ? 'exclusion.add' : 'exclusion.del', names, beforeDraw, ev.id));
      await db.batch(stmts);
      if (!isOwner && (await getEvent(db, ev.id))?.draw_done) return fail(EXCLUSIONS_FROZEN);
      return {};
    }

    case 'admin.draw.check': {
      if (ev.draw_done) return fail('Жеребьёвка уже проведена.');
      const c = await checkDraw(env, ev);
      // Без признаков учёта прошлых пар: по ним можно было бы вычислить чужие пары прошлого года (009, FR-904)
      return {
        possible: c.res.ok,
        count: c.people.length,
        ring: c.ring,
        problems: c.problems,
        empty_wishlists: c.emptyWishlists,
      };
    }

    case 'admin.draw': {
      const r = await runDraw(env, ev, { actor: me.tg_id });
      return r.ok ? { count: r.count, single_cycle: r.singleCycle } : fail(r.error);
    }

    case 'admin.draw.cancel': {
      const r = await cancelDraw(env, ev, me.tg_id);
      return r.ok ? { count: r.count } : fail(r.error);
    }

    case 'admin.announce': {
      const r = await announce(env, ev, me.tg_id, body.text);
      return r.ok ? { count: r.count } : fail(r.error);
    }

    case 'admin.audit':
      return { entries: await getAudit(db, ev.id) };

    case 'admin.request.decide': {
      const req = await db.prepare('SELECT event_id FROM join_requests WHERE id = ?').bind(Number(body.id) || 0).first();
      if (!req || req.event_id !== ev.id) return fail('Заявка не найдена.');
      const r = await decideRequest(env, body.id, me.tg_id, !!body.approve);
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.remind.unfilled':
      return { count: (await remindUnfilled(env, ev, me.tg_id)).count };

    case 'admin.remind.santas':
      if (!ev.draw_done) return fail('Жеребьёвка ещё не проведена.');
      return { count: (await remindSantas(env, ev, me.tg_id)).count };

    case 'admin.reveal': {
      // Повторно имена не рассылаются (006, FR-610), в том числе при одновременных вызовах (009)
      const r = await revealAll(env, ev, me.tg_id);
      return r.ok ? { count: r.count } : fail(r.error);
    }

    case 'admin.event.finish': {
      const r = await finishEvent(env, ev, me.tg_id);
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.event.invite_from': {
      const fromEv = await getEvent(db, body.from);
      if (!fromEv || fromEv.id === ev.id) return fail('Выбери другой эвент.');
      if (isFinished(ev)) return fail('Эвент завершён — приглашать в него нельзя.');
      const r = await inviteFromEvent(env, ev, fromEv, me.tg_id);
      return r.ok ? { count: r.count } : fail(r.error);
    }

    case 'admin.event.delete': {
      if (!isOwner) return ownerOnly('Удалить эвент');
      if (String(body.confirm || '').trim().toUpperCase() !== 'УДАЛИТЬ') return fail('Для удаления введи слово УДАЛИТЬ.');
      const r = await deleteEvent(env, ev, me.tg_id);
      return r.ok ? { notified: r.count } : fail(r.error);
    }

    // ---------- служебный просмотр владельца (010, FR-1009–FR-1013) ----------
    case 'admin.vault.person':
    case 'admin.vault.pairs': {
      if (!isOwner) return fail('Служебный просмотр доступен только владельцу бота.', 403);
      const r = action === 'admin.vault.pairs'
        ? await vaultPairs(env, ev, me.tg_id)
        : await vaultPerson(env, ev, Number(body.id) || 0, me.tg_id);
      if (!r.ok) return fail(r.error);
      const { ok, ...data } = r;
      return data;
    }

    case 'admin.reset.full': {
      if (!isOwner) return ownerOnly('Полный сброс');
      if (String(body.confirm || '').trim().toUpperCase() !== 'СБРОС') return fail('Для полного сброса введи слово СБРОС.');
      const r = await resetEvent(env, ev, ownerId, me.tg_id);
      return { removed: r.removed, invite_link: inviteLink(settings, { invite_code: r.inviteCode }) };
    }
  }
  return fail('Неизвестное действие', 404);
}

// JSON API для мини-приложения. Каждый запрос подписан Telegram (initData).

import {
  getSettings, getUser, updateUser, allUsers, getPairs, pairOfSanta, pairOfWard, getExclusions,
  getEvent, allEvents, updateEvent, getMember, eventMembers, addMemberStmt,
} from './db.js';
import { validateInitData } from './telegram.js';
import {
  MAX_CHARS, inviteLink, randomCode, isFinished, chatUntil, chatWritable,
  checkDraw, runDraw, removeMember, insertMember, revealAll, remindUnfilled, remindSantas,
  flushOutbox, resolveOwner, grantAdmin, revokeAdmin, transferOwnership, chatPair, unreadCounts, unreadByEvent,
  resetEvent, transferAccount, createEvent, finishEvent, deleteEvent, inviteFromEvent,
} from './game.js';
import { sendAnonymous } from './bot.js';

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
  };
}

export async function handleApi(request, env, ctx, action) {
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
    const result = await handleAdmin(action, body, env, ctx, me, settings);
    if (result instanceof Response) return result;
    ctx.waitUntil(flushOutbox(env));
    return json({ ok: true, ...result });
  }

  // ---------- участник эвента ----------
  const ev = await getEvent(db, body.event);
  if (!ev) return fail('Эвент не найден.', 404);
  const member = await getMember(db, ev.id, me.tg_id);

  if (action === 'event.get') {
    if (!member && !me.is_admin) return fail('Ты не участвуешь в этом эвенте.', 403);
    const participants = (await eventMembers(db, ev.id)).filter((m) => m.registered).length;
    const out = { ok: true, event: { ...publicEvent(ev), participants }, member: null, can: { edit_letter: false, chat_write: false } };
    if (member) {
      const [pair, wardPair] = await Promise.all([pairOfSanta(db, ev.id, me.tg_id), pairOfWard(db, ev.id, me.tg_id)]);
      out.member = {
        wishlist: member.wishlist,
        wishlist_updated_at: member.wishlist_updated_at,
        has_ward: !!pair,
        has_santa: !!wardPair,
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
        ward: { name: ward.name, wishlist: wardMember.wishlist, updated_at: wardMember.wishlist_updated_at },
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

    case 'message.send': {
      const to = body.to === 'santa' ? 'santa' : 'ward';
      const r = await sendAnonymous(env, ev, me.tg_id, to, body.text, ctx);
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
const FINISHED_OK = new Set(['admin.state', 'admin.wishlist', 'admin.reveal', 'admin.event.delete', 'admin.event.invite_from']);

async function handleAdmin(action, body, env, ctx, me, settings) {
  const db = env.DB;
  const ownerId = await resolveOwner(db, settings);
  const isOwner = ownerId === me.tg_id;
  const ownerOnly = (what = 'Назначать и снимать администраторов') => fail(`${what} может только владелец бота.`, 403);

  // ---------- общие (без эвента) ----------
  switch (action) {
    case 'admin.events.create': {
      const r = await createEvent(env, body.title, me.tg_id);
      return r.ok ? { event: publicEvent(r.event) } : fail(r.error);
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
      const name = String(body.name || '').replace(/\s+/g, ' ').trim();
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
      const from = Number(body.from);
      if (from === ownerId) {
        return fail('Запись владельца не переносится: владелец восстанавливает доступ по ссылке владельца со страницы /setup.');
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
      const r = await grantAdmin(env, Number(body.id));
      return r.ok ? {} : fail(r.error);
    }
    case 'admin.role.revoke': {
      if (!isOwner) return ownerOnly();
      const r = await revokeAdmin(env, Number(body.id));
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
      const [members, pairs, exclusions, events] = await Promise.all([eventMembers(db, ev.id), getPairs(db, ev.id), getExclusions(db, ev.id), allEvents(db)]);
      const santas = new Set(pairs.map((p) => p.santa));
      const ready = new Set(pairs.filter((p) => p.gift_ready).map((p) => p.santa));
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
        })),
        exclusions,
        me_member: members.some((m) => m.user_id === me.tg_id),
        other_events: events.filter((e) => e.id !== ev.id).map((e) => ({ id: e.id, title: e.title, status: e.status })),
        settings: {
          ...publicEvent(ev),
          registration_open: !!ev.registration_open,
          avoid_previous: !!ev.avoid_previous,
          invite_link: inviteLink(settings, ev),
          draw_at: ev.draw_at,
          owner_id: ownerId,
        },
      };
    }

    case 'admin.wishlist': {
      const [u, m] = await Promise.all([getUser(db, Number(body.id)), getMember(db, ev.id, Number(body.id))]);
      if (!u || !m) return fail('Участник не найден');
      return { name: u.name, wishlist: m.wishlist, updated_at: m.wishlist_updated_at };
    }

    case 'admin.game': {
      const clean = (v, n) => String(v ?? '').slice(0, n);
      const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
      const title = String(body.title ?? ev.title).replace(/\s+/g, ' ').trim();
      if (!title || title.length > 80) return fail('Название эвента — от 1 до 80 символов.');
      await updateEvent(db, ev.id, {
        title,
        budget: clean(body.budget, 100),
        place: clean(body.place, 200),
        notes: clean(body.notes, 2000),
        event_date: date(body.event_date),
        deadline: date(body.deadline),
      });
      return {};
    }

    case 'admin.ring': {
      if (ev.draw_done) return fail('После жеребьёвки кольцевую жеребьёвку менять нельзя.');
      await updateEvent(db, ev.id, { ring: body.on ? 1 : 0 });
      return {};
    }

    case 'admin.registration':
      await updateEvent(db, ev.id, { registration_open: body.open ? 1 : 0 });
      return {};

    case 'admin.invite.regen':
      await updateEvent(db, ev.id, { invite_code: randomCode() });
      return {};

    case 'admin.avoid_previous':
      await updateEvent(db, ev.id, { avoid_previous: body.on ? 1 : 0 });
      return {};

    case 'admin.participate': {
      if (ev.draw_done) return fail('После жеребьёвки так нельзя. Попроси другого админа вписать тебя.');
      if (body.on) await addMemberStmt(db, ev.id, me.tg_id).run();
      else {
        await db.batch([
          db.prepare('DELETE FROM exclusions WHERE event_id = ? AND (giver = ? OR receiver = ?)').bind(ev.id, me.tg_id, me.tg_id),
          db.prepare('DELETE FROM members WHERE event_id = ? AND user_id = ?').bind(ev.id, me.tg_id),
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
      const r = await removeMember(env, ev, id);
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.insert': {
      const r = await insertMember(env, ev, Number(body.id));
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.exclusion.add': {
      const giver = Number(body.giver);
      const receiver = Number(body.receiver);
      if (!giver || !receiver || giver === receiver) return fail('Выбери двух разных людей');
      const [g, r] = await Promise.all([getMember(db, ev.id, giver), getMember(db, ev.id, receiver)]);
      if (!g || !r) return fail('Исключение можно задать только между участниками эвента.');
      const stmts = [db.prepare('INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) VALUES (?, ?, ?)').bind(ev.id, giver, receiver)];
      if (body.mutual) stmts.push(db.prepare('INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) VALUES (?, ?, ?)').bind(ev.id, receiver, giver));
      await db.batch(stmts);
      return {};
    }

    case 'admin.exclusion.del': {
      const stmts = [db.prepare('DELETE FROM exclusions WHERE event_id = ? AND giver = ? AND receiver = ?').bind(ev.id, Number(body.giver), Number(body.receiver))];
      if (body.mutual) stmts.push(db.prepare('DELETE FROM exclusions WHERE event_id = ? AND giver = ? AND receiver = ?').bind(ev.id, Number(body.receiver), Number(body.giver)));
      await db.batch(stmts);
      return {};
    }

    case 'admin.draw.check': {
      if (ev.draw_done) return fail('Жеребьёвка уже проведена.');
      const c = await checkDraw(env, ev);
      return {
        possible: c.res.ok,
        count: c.people.length,
        ring: c.ring,
        problems: c.problems,
        empty_wishlists: c.emptyWishlists,
        history_ignored: c.historyIgnored,
        history_used: c.historyUsed,
      };
    }

    case 'admin.draw': {
      const r = await runDraw(env, ev);
      return r.ok ? { count: r.count, single_cycle: r.singleCycle, history_ignored: r.historyIgnored } : fail(r.error);
    }

    case 'admin.remind.unfilled':
      return { count: (await remindUnfilled(env, ev)).count };

    case 'admin.remind.santas':
      if (!ev.draw_done) return fail('Жеребьёвка ещё не проведена.');
      return { count: (await remindSantas(env, ev)).count };

    case 'admin.reveal':
      if (!ev.draw_done) return fail('Жеребьёвка ещё не проведена.');
      if (ev.revealed) return fail('Тайна уже раскрыта.'); // повторно имена не рассылаем (006, FR-610)
      return { count: (await revealAll(env, ev)).count };

    case 'admin.event.finish': {
      const r = await finishEvent(env, ev);
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.event.invite_from': {
      const fromEv = await getEvent(db, body.from);
      if (!fromEv || fromEv.id === ev.id) return fail('Выбери другой эвент.');
      if (isFinished(ev)) return fail('Эвент завершён — приглашать в него нельзя.');
      const r = await inviteFromEvent(env, ev, fromEv);
      return r.ok ? { count: r.count } : fail(r.error);
    }

    case 'admin.event.delete': {
      if (!isOwner) return ownerOnly('Удалить эвент');
      if (String(body.confirm || '').trim().toUpperCase() !== 'УДАЛИТЬ') return fail('Для удаления введи слово УДАЛИТЬ.');
      const r = await deleteEvent(env, ev);
      return { notified: r.count };
    }

    case 'admin.reset.full': {
      if (!isOwner) return ownerOnly('Полный сброс');
      if (String(body.confirm || '').trim().toUpperCase() !== 'СБРОС') return fail('Для полного сброса введи слово СБРОС.');
      const r = await resetEvent(env, ev, ownerId);
      return { removed: r.removed, invite_link: inviteLink(settings, { invite_code: r.inviteCode }) };
    }
  }
  return fail('Неизвестное действие', 404);
}

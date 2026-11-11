// JSON API для мини-приложения. Каждый запрос подписан Telegram (initData).

import {
  getSettings, setSettings, getUser, updateUser, allUsers, getPairs, pairOfSanta, pairOfWard,
  getExclusions, getHistory,
} from './db.js';
import { validateInitData } from './telegram.js';
import {
  MAX_CHARS, isDrawDone, isRegistrationOpen, inviteLink, randomCode,
  checkDraw, runDraw, removeUser, insertUser, revealAll, newGame, remindUnfilled, remindSantas,
  flushOutbox, resolveOwner, grantAdmin, revokeAdmin, transferOwnership, chatPair, unreadCounts,
} from './game.js';
import { sendAnonymous } from './bot.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const fail = (error, status = 400) => json({ ok: false, error }, status);

function publicGame(settings) {
  return {
    budget: settings.budget || '',
    event_date: settings.event_date || '',
    place: settings.place || '',
    deadline: settings.deadline || '',
    notes: settings.notes || '',
    draw_done: isDrawDone(settings),
    revealed: settings.revealed === '1',
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

  if (action === 'me') {
    if (!me || !me.registered) return json({ ok: true, registered: false });
    const [pair, wardPair, users] = await Promise.all([pairOfSanta(db, me.tg_id), pairOfWard(db, me.tg_id), allUsers(db)]);
    const participants = users.filter((u) => u.registered && u.is_participant).length;
    const ownerId = me.is_admin ? await resolveOwner(db, settings, users) : null;
    const unread = pair || wardPair ? await unreadCounts(db, me.tg_id) : { from_ward: 0, from_santa: 0 };
    return json({
      ok: true,
      registered: true,
      me: {
        id: me.tg_id,
        name: me.name,
        is_admin: !!me.is_admin,
        is_owner: !!me.is_admin && ownerId === me.tg_id,
        is_participant: !!me.is_participant,
        notify_mode: me.notify_mode,
        wishlist: me.wishlist,
        wishlist_updated_at: me.wishlist_updated_at,
        has_ward: !!pair,
        has_santa: !!wardPair,
        unread,
      },
      game: { ...publicGame(settings), participants },
      limits: { chars: MAX_CHARS },
    });
  }

  if (!me || !me.registered) return fail('Сначала зарегистрируйся по пригласительной ссылке.', 403);

  // ---------- участник ----------
  switch (action) {
    case 'wishlist.save': {
      const text = String(body.text ?? '').replace(/\r\n/g, '\n');
      if (text.length > MAX_CHARS) {
        return fail(`Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS} (лимит сообщения Telegram).`);
      }
      if (text === me.wishlist) return json({ ok: true, updated_at: me.wishlist_updated_at });
      const now = Date.now();
      await updateUser(db, me.tg_id, { wishlist: text, wishlist_updated_at: now });
      return json({ ok: true, updated_at: now });
    }

    case 'ward.get': {
      if (!isDrawDone(settings)) return json({ ok: true, state: 'no_draw' });
      const pair = await pairOfSanta(db, me.tg_id);
      if (!pair) return json({ ok: true, state: 'waiting' });
      const ward = await getUser(db, pair.ward);
      if (!ward) return json({ ok: true, state: 'waiting' });
      const prev = pair.seen_text;
      if (prev !== ward.wishlist) {
        await db.prepare('UPDATE pairs SET seen_text = ? WHERE santa = ?').bind(ward.wishlist, me.tg_id).run();
      }
      return json({
        ok: true,
        state: 'ok',
        ward: { name: ward.name, wishlist: ward.wishlist, updated_at: ward.wishlist_updated_at },
        previous: prev === null || prev === ward.wishlist ? null : prev,
        first_view: prev === null,
        gift_ready: !!pair.gift_ready,
      });
    }

    case 'ward.gift': {
      const r = await db.prepare('UPDATE pairs SET gift_ready = ? WHERE santa = ?').bind(body.ready ? 1 : 0, me.tg_id).run();
      if (!r.meta.changes) return fail('У тебя пока нет подопечного.');
      return json({ ok: true });
    }

    case 'message.send': {
      const to = body.to === 'santa' ? 'santa' : 'ward';
      const r = await sendAnonymous(env, me.tg_id, to, body.text, ctx);
      return r.ok ? json({ ok: true, message: r.message }) : fail(r.error);
    }

    case 'chat.get': {
      const withWhom = body.with === 'santa' ? 'santa' : 'ward';
      const pair = await chatPair(db, me.tg_id, withWhom);
      if (!pair) return json({ ok: true, state: 'no_pair' });
      const after = Number(body.after) || 0;
      const q = after
        ? db.prepare('SELECT id, sender, text, created_at FROM messages WHERE santa = ? AND ward = ? AND id > ? ORDER BY id LIMIT 300')
            .bind(pair.santa, pair.ward, after)
        : db.prepare('SELECT id, sender, text, created_at FROM messages WHERE santa = ? AND ward = ? ORDER BY id DESC LIMIT 300')
            .bind(pair.santa, pair.ward);
      const { results } = await q.all();
      if (!after) results.reverse();
      if (results.some((m) => m.sender !== pair.me)) {
        await db.prepare('UPDATE messages SET read_at = ? WHERE santa = ? AND ward = ? AND sender != ? AND read_at = 0')
          .bind(Date.now(), pair.santa, pair.ward, pair.me).run();
      }
      // Только текст и «моё/не моё» — без ID и имён собеседника (Конституция, принцип I)
      return json({
        ok: true,
        state: 'ok',
        counterpart: withWhom,
        messages: results.map((m) => ({ id: m.id, mine: m.sender === pair.me, text: m.text, created_at: m.created_at })),
      });
    }

    case 'notify.set': {
      if (!['sound', 'silent', 'off'].includes(body.mode)) return fail('bad mode');
      await updateUser(db, me.tg_id, { notify_mode: body.mode });
      return json({ ok: true });
    }
  }

  // ---------- администратор ----------
  if (!action.startsWith('admin.')) return fail('Неизвестное действие', 404);
  if (!me.is_admin) return fail('Только для администратора.', 403);

  const result = await handleAdmin(action, body, env, ctx, me, settings);
  if (result instanceof Response) return result;
  ctx.waitUntil(flushOutbox(env));
  return json({ ok: true, ...result });
}

async function handleAdmin(action, body, env, ctx, me, settings) {
  const db = env.DB;
  const drawDone = isDrawDone(settings);
  const ownerId = await resolveOwner(db, settings);
  const isOwner = ownerId === me.tg_id;
  const ownerOnly = () => fail('Назначать и снимать администраторов может только владелец игры.', 403);

  switch (action) {
    case 'admin.state': {
      if (!settings.invite_code) {
        settings.invite_code = randomCode();
        await setSettings(db, { invite_code: settings.invite_code });
      }
      const [users, pairs, exclusions, history] = await Promise.all([allUsers(db), getPairs(db), getExclusions(db), getHistory(db)]);
      const santas = new Set(pairs.map((p) => p.santa));
      const ready = new Set(pairs.filter((p) => p.gift_ready).map((p) => p.santa));
      // ВАЖНО: здесь нет ни пар, ни текстов писем — только статусы.
      return {
        users: users.map((u) => ({
          id: u.tg_id,
          name: u.name,
          username: u.username,
          registered: !!u.registered,
          is_admin: !!u.is_admin,
          is_owner: u.tg_id === ownerId,
          is_participant: !!u.is_participant,
          has_wishlist: !!u.wishlist.trim(),
          in_draw: santas.has(u.tg_id),
          gift_ready: ready.has(u.tg_id),
        })),
        exclusions,
        settings: {
          ...publicGame(settings),
          registration_open: isRegistrationOpen(settings),
          avoid_previous: settings.avoid_previous !== '0',
          has_history: history.length > 0,
          invite_link: inviteLink(settings),
          draw_at: Number(settings.draw_at || 0),
          owner_id: ownerId,
          owner_name: users.find((u) => u.tg_id === ownerId)?.name || '',
        },
      };
    }

    case 'admin.wishlist': {
      const u = await getUser(db, Number(body.id));
      if (!u) return fail('Участник не найден');
      return { name: u.name, wishlist: u.wishlist, updated_at: u.wishlist_updated_at };
    }

    case 'admin.game': {
      const clean = (v, n) => String(v ?? '').slice(0, n);
      const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
      await setSettings(db, {
        budget: clean(body.budget, 100),
        place: clean(body.place, 200),
        notes: clean(body.notes, 2000),
        event_date: date(body.event_date),
        deadline: date(body.deadline),
      });
      return {};
    }

    case 'admin.registration': {
      await setSettings(db, { registration_open: body.open ? '1' : '0' });
      return {};
    }

    case 'admin.invite.regen': {
      await setSettings(db, { invite_code: randomCode() });
      return {};
    }

    case 'admin.avoid_previous': {
      await setSettings(db, { avoid_previous: body.on ? '1' : '0' });
      return {};
    }

    case 'admin.participate': {
      if (drawDone) return fail('После жеребьёвки так нельзя. Попроси другого админа вписать тебя, или начни новую игру.');
      await updateUser(db, me.tg_id, { is_participant: body.on ? 1 : 0 });
      return {};
    }

    case 'admin.rename': {
      const name = String(body.name || '').replace(/\s+/g, ' ').trim();
      if (!name || name.length > 40) return fail('Имя должно быть от 1 до 40 символов');
      await updateUser(db, Number(body.id), { name });
      return {};
    }

    case 'admin.remove': {
      const id = Number(body.id);
      if (id === me.tg_id) return fail('Нельзя удалить самого себя.');
      if (id === ownerId) return fail('Владельца нельзя удалить из игры. Сначала он должен передать права владельца.');
      const target = await getUser(db, id);
      if (target?.is_admin && !isOwner) return fail('Удалить администратора может только владелец игры.', 403);
      const r = await removeUser(env, id);
      return r.ok ? {} : fail(r.error);
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
      if (!isOwner) return ownerOnly();
      const r = await transferOwnership(env, me.tg_id, Number(body.id));
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.insert': {
      const r = await insertUser(env, Number(body.id));
      return r.ok ? {} : fail(r.error);
    }

    case 'admin.exclusion.add': {
      const giver = Number(body.giver);
      const receiver = Number(body.receiver);
      if (!giver || !receiver || giver === receiver) return fail('Выбери двух разных людей');
      const stmts = [db.prepare('INSERT OR IGNORE INTO exclusions (giver, receiver) VALUES (?, ?)').bind(giver, receiver)];
      if (body.mutual) stmts.push(db.prepare('INSERT OR IGNORE INTO exclusions (giver, receiver) VALUES (?, ?)').bind(receiver, giver));
      await db.batch(stmts);
      return {};
    }

    case 'admin.exclusion.del': {
      const stmts = [db.prepare('DELETE FROM exclusions WHERE giver = ? AND receiver = ?').bind(Number(body.giver), Number(body.receiver))];
      if (body.mutual) stmts.push(db.prepare('DELETE FROM exclusions WHERE giver = ? AND receiver = ?').bind(Number(body.receiver), Number(body.giver)));
      await db.batch(stmts);
      return {};
    }

    case 'admin.draw.check': {
      if (drawDone) return fail('Жеребьёвка уже проведена.');
      const c = await checkDraw(env);
      return {
        possible: c.res.ok,
        count: c.people.length,
        problems: c.problems,
        empty_wishlists: c.emptyWishlists,
        history_ignored: c.historyIgnored,
        history_used: c.historyUsed,
      };
    }

    case 'admin.draw': {
      const r = await runDraw(env);
      return r.ok ? { count: r.count, single_cycle: r.singleCycle, history_ignored: r.historyIgnored } : fail(r.error);
    }

    case 'admin.remind.unfilled': {
      const r = await remindUnfilled(env);
      return { count: r.count };
    }

    case 'admin.remind.santas': {
      if (!drawDone) return fail('Жеребьёвка ещё не проведена.');
      const r = await remindSantas(env);
      return { count: r.count };
    }

    case 'admin.reveal': {
      if (!drawDone) return fail('Жеребьёвка ещё не проведена.');
      const r = await revealAll(env);
      return { count: r.count };
    }

    case 'admin.newgame': {
      await newGame(env);
      return {};
    }
  }
  return fail('Неизвестное действие', 404);
}

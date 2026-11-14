// Участник события (019): экран «мои события», экран события, письмо Санте, адрес доставки (008), подопечный и отметки
// «подарок готов» / «подарок получен» (007). Права (участник ли, завершено ли событие) проверены в api.js.

import {
  eventsQuery, pairOfSanta, pairOfWard, pairOfSantaQuery, pairOfWardQuery, participantCountQuery, announcementsQuery, getUser, getMember,
  enqueueIfStmt,
} from './db.js';
import { msg, q, appKeyboard, cleanText } from './format.js';
import { isFinished, chatWritable, publicEvent } from './status.js';
import { MAX_CHARS, tooLong, unreadQuery, unreadFrom, unreadByEventQuery, unreadByEventFrom } from './chat.js';
import { supportCountsQuery, supportCountsView, supportUnreadQuery, supportUnreadFrom } from './support.js';

const DELIVERY_MAX = 500;

const no = (error) => ({ ok: false, error });

// me: незарегистрированному — только registered: false; владельца вычисляет только для админа
export async function homeView(ctx) {
  const { db, me } = ctx;
  if (!me || !me.registered) return { registered: false };
  // Одним пакетом чтений (019); админу в нём же — пользователи, чтобы найти владельца
  const r = await ctx.read({
    mine: db.prepare('SELECT event_id FROM members WHERE user_id = ?').bind(me.tg_id),
    unread: unreadByEventQuery(db, me.tg_id),
    supUnread: supportUnreadQuery(db, me),
    events: eventsQuery(db),
    users: !!me.is_admin,
  });
  const ownerId = me.is_admin ? await ctx.ownerId() : null;
  const memberOf = new Set(r.mine.map((x) => x.event_id));
  const unread = unreadByEventFrom(r.unread);
  const supUnread = supportUnreadFrom(r.supUnread);
  const events = r.events
    .filter((e) => me.is_admin || memberOf.has(e.id))
    .map((e) => ({
      id: e.id, title: e.title, status: e.status, finished_at: e.finished_at, event_date: e.event_date,
      draw_done: !!e.draw_done, member: memberOf.has(e.id), unread: (unread[e.id] || 0) + (supUnread[e.id] || 0),
    }));
  return {
    registered: true,
    me: { id: me.tg_id, name: me.name, is_admin: !!me.is_admin, is_owner: !!me.is_admin && ownerId === me.tg_id, notify_mode: me.notify_mode },
    events,
    limits: { chars: MAX_CHARS },
  };
}

// event.get: участнику — его письмо, адрес, есть ли подопечный и Санта, непрочитанное; админу-неучастнику — событие
export async function eventView(ctx, ev, member) {
  const { db, me } = ctx;
  // Одним пакетом чтений (019): число участников, объявления, пары и непрочитанное участника, счётчики обращений
  const r = await ctx.read({
    count: participantCountQuery(db, ev.id),
    announcements: announcementsQuery(db, ev.id), // 007, FR-701
    pair: member && pairOfSantaQuery(db, ev.id, me.tg_id),
    wardPair: member && pairOfWardQuery(db, ev.id, me.tg_id),
    unread: member && unreadQuery(db, ev.id, me.tg_id),
    support: supportCountsQuery(db, ev, me),
  });
  const out = {
    event: { ...publicEvent(ev), participants: r.count[0].n },
    announcements: r.announcements,
    member: null,
    can: { edit_letter: false, chat_write: false },
  };
  if (member) {
    const pair = r.pair[0] ?? null;
    const wardPair = r.wardPair[0] ?? null;
    out.member = {
      wishlist: member.wishlist,
      wishlist_updated_at: member.wishlist_updated_at,
      has_ward: !!pair,
      has_santa: !!wardPair,
      gift_received: !!wardPair?.gift_received, // 007, FR-704
      delivery: member.delivery, // 008: свой адрес доставки
      unread: pair || wardPair ? unreadFrom(r.unread) : { from_ward: 0, from_santa: 0 },
    };
    out.can = { edit_letter: !isFinished(ev), chat_write: chatWritable(ev) };
  }
  // 012: обращения — участнику его статус, админу — ничьи и непрочитанные (для точек на вкладках)
  Object.assign(out, supportCountsView(r.support, { member: !!member, admin: !!me.is_admin }));
  return out;
}

export async function saveWishlist(ctx, ev, member, raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (text.length > MAX_CHARS) {
    return no(tooLong(text.length));
  }
  if (text === member.wishlist) return { ok: true, updated_at: member.wishlist_updated_at };
  const now = Date.now();
  await ctx.db.prepare('UPDATE members SET wishlist = ?, wishlist_updated_at = ? WHERE event_id = ? AND user_id = ?')
    .bind(text, now, ev.id, ctx.me.tg_id).run();
  return { ok: true, updated_at: now };
}

// Адрес доставки (008): виден только самому участнику и его Санте. «Адрес не нужен» — раньше «завершено».
export async function saveDelivery(ctx, ev, member, raw) {
  if (!ev.delivery_on) return no('В этом событии адрес доставки не нужен.');
  if (isFinished(ev)) return no('Событие завершено: адрес теперь только для чтения.');
  const text = cleanText(raw);
  if (text.length > DELIVERY_MAX) return no(`Слишком длинно: ${text.length} символов, максимум ${DELIVERY_MAX}.`);
  if (text === member.delivery) return { ok: true, updated_at: member.delivery_updated_at };
  const now = Date.now();
  await ctx.db.prepare('UPDATE members SET delivery = ?, delivery_updated_at = ? WHERE event_id = ? AND user_id = ?')
    .bind(text, now, ev.id, ctx.me.tg_id).run();
  return { ok: true, updated_at: now };
}

// ward.get: подопечный, его письмо и адрес (только Санте); открытие запоминает увиденное письмо
export async function wardView(ctx, ev) {
  const { db, me } = ctx;
  if (!ev.draw_done) return { state: 'no_draw' };
  const pair = await pairOfSanta(db, ev.id, me.tg_id);
  if (!pair) return { state: 'waiting' };
  const [ward, wardMember] = await Promise.all([getUser(db, pair.ward), getMember(db, ev.id, pair.ward)]);
  if (!ward || !wardMember) return { state: 'waiting' };
  const prev = pair.seen_text;
  if (prev !== wardMember.wishlist) {
    await db.prepare('UPDATE pairs SET seen_text = ? WHERE event_id = ? AND santa = ?').bind(wardMember.wishlist, ev.id, me.tg_id).run();
  }
  return {
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
  };
}

export async function setGiftReady(ctx, ev, ready) {
  const r = await ctx.db.prepare('UPDATE pairs SET gift_ready = ? WHERE event_id = ? AND santa = ?').bind(ready ? 1 : 0, ev.id, ctx.me.tg_id).run();
  if (!r.meta.changes) return no('У тебя пока нет подопечного.');
  return { ok: true };
}

// Подопечный отмечает «подарок получен» (007, FR-704). Санта узнаёт об этом только при первой отметке.
export async function setGiftReceived(ctx, ev, received) {
  const { db, me } = ctx;
  const pair = await pairOfWard(db, ev.id, me.tg_id);
  if (!pair) return no('У тебя пока нет Санты.');
  const on = received ? 1 : 0;
  const now = Date.now();
  const stmts = [
    db.prepare(
      `UPDATE pairs SET gift_received = ?, gift_received_at = CASE WHEN ? = 1 AND gift_received_at = 0 THEN ? ELSE gift_received_at END
        WHERE event_id = ? AND ward = ?`
    ).bind(on, on, now, ev.id, me.tg_id),
  ];
  if (on && !pair.gift_received_at) {
    const settings = await ctx.settings();
    // Только если отметку поставил именно этот запрос (защита от двойного нажатия)
    stmts.push(enqueueIfStmt(db, pair.santa, msg(
      `🎉 Твой подопечный в событии ${q(ev)} получил подарок! Спасибо, Санта 🎅`,
      appKeyboard(settings, '🎁 Открыть', { event: ev.id })
    ), 'EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND ward = ? AND gift_received_at = ?)', ev.id, me.tg_id, now));
  }
  await db.batch(stmts);
  return { ok: true };
}

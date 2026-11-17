// Участник события (019): экран «мои события», экран события, письмо Санте, адрес доставки (008), подопечный и отметки
// «подарок готов» / «подарок получен» (007). Права (участник ли, завершено ли событие) проверены в api.js.

import {
  eventsQuery, pairOfSanta, pairOfWard, pairOfSantaQuery, pairOfWardQuery, peopleQuery, giftTotalsQuery, announcementsQuery, getUser,
  getMember,
} from './db.js';
import { atomic } from './claim.js';
import { msg, q, appKeyboard, cleanText, inviteLink } from './format.js';
import { isFinished, chatWritable, publicEvent } from './status.js';
import { MAX_CHARS, tooLong, unreadQuery, unreadFrom, unreadByEventQuery, unreadByEventFrom } from './chat.js';
import { supportCountsQuery, supportCountsView, supportUnreadQuery, supportUnreadFrom } from './support.js';
import { no } from './result.js';
import { EMOJIS, POSTCARDS, validEmoji, validCard } from './looks.js';

const DELIVERY_MAX = 500;

// Меню бота: события человека с признаками «есть подопечный» и «есть Санта» — один запрос на любое число событий
// (009, FR-913; 029 — из bot.js)
export async function menuEvents(db, userId) {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.title, e.status, e.draw_done, m.wishlist,
              EXISTS (SELECT 1 FROM pairs p WHERE p.event_id = e.id AND p.santa = ?1) AS has_ward,
              EXISTS (SELECT 1 FROM pairs p WHERE p.event_id = e.id AND p.ward = ?1) AS has_santa
         FROM members m JOIN events e ON e.id = m.event_id
        WHERE m.user_id = ?1 ORDER BY e.created_at DESC`
    )
    .bind(userId)
    .all();
  return results;
}

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
    me: {
      id: me.tg_id, name: me.name, emoji: me.emoji, is_admin: !!me.is_admin, is_owner: !!me.is_admin && ownerId === me.tg_id,
      notify_mode: me.notify_mode,
    },
    events,
    limits: { chars: MAX_CHARS },
    looks: { emojis: EMOJIS, postcards: POSTCARDS }, // 038: набор значков и открыток — один, на сервере
  };
}

// event.get: участнику — его письмо, адрес, есть ли подопечный и Санта, непрочитанное; админу-неучастнику — событие
export async function eventView(ctx, ev, member) {
  const { db, me } = ctx;
  // Одним пакетом чтений (019): участники (037: и список для «Инфо»), объявления, пары и непрочитанное участника,
  // счётчики обращений, суммы по парам, пользователи и настройки (организаторы, ссылка-приглашение)
  const r = await ctx.read({
    people: peopleQuery(db, ev.id),
    announcements: announcementsQuery(db, ev.id), // 007, FR-701
    pair: member && pairOfSantaQuery(db, ev.id, me.tg_id),
    wardPair: member && pairOfWardQuery(db, ev.id, me.tg_id),
    unread: member && unreadQuery(db, ev.id, me.tg_id),
    support: supportCountsQuery(db, ev, me),
    gifts: ev.draw_done && giftTotalsQuery(db, ev.id),
    users: true,
    settings: true,
  });
  const out = {
    event: { ...publicEvent(ev), participants: r.people.length },
    roster: rosterView(ev, r.people, r.gifts?.[0], r.users, await ctx.ownerId(), r.settings),
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
      card: member.card, // 038: открытка письма
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

// Список участников на «Инфо» (037, specs/037-info-people/contracts/info-people.md): имена, роли и общие суммы — ни
// отметок по людям, ни пар; @username — только если организатор разрешил участникам писать друг другу
const byName = (a, b) => a.name.localeCompare(b.name, 'ru') || a.id - b.id;
export function rosterView(ev, people, gifts, users, ownerId, settings) {
  const contact = (u) => ({ emoji: u.emoji, ...(ev.contacts_on && u.username ? { username: u.username } : {}) });
  const role = (u) => (u.tg_id === ownerId ? 'owner' : u.is_admin ? 'admin' : '');
  const admins = users.filter((u) => u.is_admin && u.registered);
  return {
    people: people.map((m) => ({ id: m.user_id, name: m.name, role: role({ ...m, tg_id: m.user_id }), ...contact(m) })).sort(byName),
    organizers: [
      ...admins.filter((u) => u.tg_id === ownerId),
      ...admins.filter((u) => u.tg_id !== ownerId).map((u) => ({ ...u, id: u.tg_id })).sort(byName),
    ].map((u) => ({ id: u.tg_id, name: u.name, owner: u.tg_id === ownerId, ...contact(u) })),
    progress: ev.draw_done
      ? { ready: gifts.ready, received: gifts.received, of: gifts.n }
      : { letters: people.filter((m) => m.has_wishlist).length, of: people.length },
    invite_link: ev.registration_open && !isFinished(ev) ? inviteLink(settings, ev) : '',
  };
}

// 038: значок у имени (один на все события) и открытка письма (своя в событии) — только из набора; без сообщений и
// журнала, время изменения письма открытка не трогает
export async function setEmoji(ctx, raw) {
  const emoji = validEmoji(raw);
  if (emoji === null) return no('Такого значка нет — выбери из списка.');
  await ctx.db.prepare('UPDATE users SET emoji = ? WHERE tg_id = ?').bind(emoji, ctx.me.tg_id).run();
  return { ok: true, emoji };
}

export async function setCard(ctx, ev, raw) {
  const card = validCard(raw);
  if (card === null) return no('Такой открытки нет — выбери из списка.');
  await ctx.db.prepare('UPDATE members SET card = ? WHERE event_id = ? AND user_id = ?').bind(card, ev.id, ctx.me.tg_id).run();
  return { ok: true, card };
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
      emoji: ward.emoji, // 038: в приложении — внутри скрытого имени
      wishlist: wardMember.wishlist,
      card: wardMember.card,
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
// Защита от двойного нажатия (020): сообщение — перед отметкой и только пока отметки нет. Второй вызов (даже в ту же
// миллисекунду) видит отметку первого и ничего не рассылает.
export async function setGiftReceived(ctx, ev, received) {
  const { db, me } = ctx;
  const pair = await pairOfWard(db, ev.id, me.tg_id);
  if (!pair) return no('У тебя пока нет Санты.');
  const on = received ? 1 : 0;
  const a = atomic(db, 'EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND ward = ? AND gift_received_at = 0)', ev.id, me.tg_id);
  if (on && !pair.gift_received_at) {
    const settings = await ctx.settings();
    a.enqueue(pair.santa, msg(
      `🎉 Твой подопечный в событии ${q(ev)} получил подарок! Спасибо, Санта 🎅`,
      appKeyboard(settings, '🎁 Открыть', { event: ev.id })
    ));
  }
  a.claim(db.prepare(
    `UPDATE pairs SET gift_received = ?, gift_received_at = CASE WHEN ? = 1 AND gift_received_at = 0 THEN ? ELSE gift_received_at END
      WHERE event_id = ? AND ward = ?`
  ).bind(on, on, Date.now(), ev.id, me.tg_id));
  await a.run();
  return { ok: true };
}

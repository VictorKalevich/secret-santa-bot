// Участник события (019): экран «мои события», экран события, письмо Санте, адрес доставки (008), подопечный и отметки
// «подарок готов» / «подарок получен» (007). Права (участник ли, завершено ли событие) проверены в api.js.

import {
  eventsQuery, pairOfSanta, pairOfWard, pairOfSantaQuery, pairOfWardQuery, peopleQuery, giftTotalsQuery, announcementsQuery, getUser,
  getMember, getEvent,
} from './db.js';
import { atomic } from './claim.js';
import { shipmentDetails } from './shipment.js';
import { msg, q, appKeyboard, cleanText, inviteLink } from './format.js';
import { isFinished, chatWritable, publicEvent } from './status.js';
import { MAX_CHARS, tooLong, unreadQuery, unreadFrom, unreadByEventQuery, unreadByEventFrom } from './chat.js';
import { supportCountsQuery, supportCountsView, supportUnreadQuery, supportUnreadFrom } from './support.js';
import { no } from './result.js';
import { POSTCARDS, MASKS, validCard, validMask } from './looks.js';

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
      id: me.tg_id, name: me.name, is_admin: !!me.is_admin, is_owner: !!me.is_admin && ownerId === me.tg_id,
      notify_mode: me.notify_mode,
    },
    events,
    limits: { chars: MAX_CHARS },
    looks: { postcards: POSTCARDS, masks: MASKS }, // 038, 040: наборы открыток и масок — на сервере
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
      ...(ev.letter_drafts ? { draft: {
        text: member.draft_text, revision: member.letter_revision, stale: !!member.draft_stale, joined_at: member.joined_at,
      } } : {}),
      card: member.card, // 038: открытка письма
      has_ward: !!pair,
      has_santa: !!wardPair,
      santa_mask: wardPair?.mask || '', // 040: маска своего Санты — только самому подопечному
      gift_received: !!wardPair?.gift_received, // 007, FR-704
      delivery: member.delivery, // 008: свой адрес доставки
      ...(ev.delivery_on && wardPair ? { shipment: shipmentDetails(wardPair) } : {}),
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
  const contact = (u) => ev.contacts_on && u.username ? { username: u.username } : {};
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

// 038: открытка письма выбирается из набора. Смена открытки не меняет время письма.
export async function setCard(ctx, ev, raw) {
  const card = validCard(raw);
  if (card === null) return no('Такой открытки нет — выбери из списка.');
  await ctx.db.prepare('UPDATE members SET card = ? WHERE event_id = ? AND user_id = ?').bind(card, ev.id, ctx.me.tg_id).run();
  return { ok: true, card };
}

export async function saveWishlist(ctx, ev, member, raw) {
  if (ev.letter_drafts) return no('Включены черновики. Открой письмо заново для публикации.');
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (text.length > MAX_CHARS) {
    return no(tooLong(text.length));
  }
  if (text === member.wishlist) return { ok: true, updated_at: member.wishlist_updated_at };
  const now = Date.now();
  const result = await ctx.db.prepare(`UPDATE members SET wishlist = ?, wishlist_updated_at = ?, letter_revision = letter_revision + 1,
      draft_stale = (draft_text IS NOT NULL) WHERE event_id = ? AND user_id = ?
      AND EXISTS (SELECT 1 FROM events WHERE id = members.event_id AND letter_drafts = 0 AND status = 'active')`)
    .bind(text, now, ev.id, ctx.me.tg_id).run();
  if (!result.meta.changes) return no('Настройки события изменились. Открой письмо заново.');
  return { ok: true, updated_at: now };
}

// Одна условная запись проверяет текущий режим, участие и версию. При публикации
// снятие черновика и обновление текста для Санты вступают в силу вместе.
export async function writeLetterDraft(ctx, ev, member, body, publish) {
  if (!ev.letter_drafts) return no('Черновики выключены. Открой письмо заново.');
  if (typeof body.text !== 'string') return no('Передай текст письма.');
  const text = body.text.replace(/\r\n/g, '\n');
  if (text.length > MAX_CHARS) return no(tooLong(text.length));
  if (publish && !text.trim()) return no('Напиши письмо перед публикацией.');
  const conflict = 'Письмо или настройки изменились. Открой событие заново.';
  if (body.revision !== member.letter_revision || body.joined_at !== member.joined_at) return no(conflict);
  const updated = publish && text !== member.wishlist ? Math.max(Date.now(), member.wishlist_updated_at + 1) : member.wishlist_updated_at;
  const assignment = publish ? 'wishlist = ?, wishlist_updated_at = ?, draft_text = NULL' : 'draft_text = ?';
  const values = publish ? [text, updated] : [text === member.wishlist ? null : text];
  const result = await ctx.db.prepare(`UPDATE members SET ${assignment}, draft_stale = 0, letter_revision = letter_revision + 1
    WHERE event_id = ? AND user_id = ? AND letter_revision = ? AND joined_at = ?
    AND EXISTS (SELECT 1 FROM events WHERE id = members.event_id AND letter_drafts = 1 AND status = 'active')`)
    .bind(...values, ev.id, ctx.me.tg_id, body.revision, body.joined_at).run();
  return result.meta.changes ? { ok: true, revision: body.revision + 1, updated_at: updated } : no(conflict);
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

// 040: маска Санты в переписке — у пары, пока событие идёт (завершённое отсекает конвейер API) и тайна не раскрыта: её
// уже назвало сообщение о раскрытии. Без сообщений и журнала; условие «не раскрыта» — в самой записи (гонка с раскрытием)
const MASK_REVEALED = 'Тайна уже раскрыта — маску больше не сменить.';
const NO_WARD = 'У тебя пока нет подопечного.';
export async function setMask(ctx, ev, raw) {
  const mask = validMask(raw);
  if (mask === null) return no('Такой маски нет — выбери из списка.');
  if (ev.revealed) return no(MASK_REVEALED);
  const r = await ctx.db
    .prepare('UPDATE pairs SET mask = ? WHERE event_id = ? AND santa = ? AND EXISTS (SELECT 1 FROM events WHERE id = ? AND revealed = 0)')
    .bind(mask, ev.id, ctx.me.tg_id, ev.id).run();
  if (!r.meta.changes) return no((await getEvent(ctx.db, ev.id))?.revealed ? MASK_REVEALED : NO_WARD);
  return { ok: true, mask };
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
      card: wardMember.card,
      updated_at: wardMember.wishlist_updated_at,
      ...(ev.delivery_on ? { delivery: wardMember.delivery } : {}), // 008: адрес — только Санте
    },
    previous: prev === null || prev === wardMember.wishlist ? null : prev,
    first_view: prev === null,
    gift_ready: !!pair.gift_ready,
    ...(ev.delivery_on ? { shipment: { ...shipmentDetails(pair), version: pair.shipment_version },
      timezone_offset_hours: Number(ctx.env.TIMEZONE_OFFSET_HOURS ?? 3) } : {}),
    mask: pair.mask, // 040: своя маска в этой паре
  };
}

export async function setGiftReady(ctx, ev, ready) {
  const r = await ctx.db.prepare('UPDATE pairs SET gift_ready = ?1 WHERE event_id = ?2 AND santa = ?3 AND (?1 = 1 OR gift_sent = 0)').bind(ready ? 1 : 0, ev.id, ctx.me.tg_id).run();
  if (!r.meta.changes) {
    const pair = await pairOfSanta(ctx.db, ev.id, ctx.me.tg_id);
    return no(pair?.gift_sent ? 'Сначала сними отметку об отправке.' : NO_WARD);
  }
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

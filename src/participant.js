// Участник события (019): экран «мои события», экран события, письмо Санте, подопечный (064: без адреса доставки и
// отметок подарка). Права (участник ли, завершено ли событие) проверены в api.js.

import {
  myEventsQuery, pairOfSanta, pairOfSantaQuery, pairOfWardQuery, peopleQuery, announcementsQuery, getUser, getMember,
} from './db.js';
import { inviteLink } from './format.js';
import { isFinished, chatWritable, publicEvent } from './status.js';
import { MAX_CHARS, tooLong, unreadQuery, unreadFrom, unreadByEventQuery, unreadByEventFrom } from './chat.js';
import { supportCountsQuery, supportCountsView, supportUnreadQuery, supportUnreadFrom } from './support.js';
import { no } from './result.js';
import { tx } from './i18n/index.js';
import { looksView, validCard } from './looks.js';
import { openBot, canCreate, createView, creationsQuery } from './creation.js';

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

// me: незарегистрированному — только registered: false (052: в открытом боте и open). 063: события — где человек
// участник или организатор (владельцу бота — тоже только свои), у каждого роль (owner | admin | member); is_admin —
// «организатор где-нибудь», is_owner — владелец бота; create — может ли создавать и сколько ещё (creation.js)
export async function homeView(ctx) {
  const { db, me } = ctx;
  // 052: open — открытый бот (и незарегистрированному: в нём регистрируются без ссылки)
  const open = openBot(ctx.env);
  const flag = open ? { open: true } : {};
  if (!me || !me.registered) return { registered: false, ...flag };
  // Владелец бота — из первого пакета вызова (без запроса, если запись владельца действительна)
  const botOwnerId = await ctx.botOwnerId();
  const botOwner = !!me.is_admin && botOwnerId === me.tg_id;
  const counted = !botOwner && (await canCreate(ctx));
  // Одним пакетом чтений (019); события, где он организатор, — из первого пакета вызова
  const r = await ctx.read({
    mine: db.prepare('SELECT event_id FROM members WHERE user_id = ?').bind(me.tg_id),
    unread: unreadByEventQuery(db, me.tg_id),
    supUnread: supportUnreadQuery(db, me),
    events: myEventsQuery(db, me.tg_id),
    creations: counted && creationsQuery(db, me.tg_id),
  });
  const organizer = await ctx.organizerOf();
  const memberOf = new Set(r.mine.map((x) => x.event_id));
  const unread = unreadByEventFrom(r.unread);
  const supUnread = supportUnreadFrom(r.supUnread);
  const roleOf = (e) => (e.owner_id === me.tg_id || (!e.owner_id && botOwner) ? 'owner' : organizer.has(e.id) ? 'admin' : 'member');
  const events = r.events.map((e) => ({
    id: e.id, title: e.title, status: e.status, finished_at: e.finished_at, event_date: e.event_date,
    draw_done: !!e.draw_done, member: memberOf.has(e.id), role: roleOf(e), unread: (unread[e.id] || 0) + (supUnread[e.id] || 0),
  }));
  const create = await createView(ctx, r.creations[0]);
  return {
    registered: true,
    me: {
      id: me.tg_id, name: me.name, is_admin: !!me.is_admin, is_owner: botOwner,
      notify_mode: me.notify_mode,
    },
    ...flag,
    ...(create ? { create } : {}),
    events,
    limits: { chars: MAX_CHARS },
    looks: looksView(), // 038: набор открыток — на сервере
  };
}

// event.get: участнику — его письмо, есть ли подопечный и Санта, непрочитанное; админу-неучастнику — событие
export async function eventView(ctx, ev, member) {
  const { db, me } = ctx;
  // Одним пакетом чтений (019): участники (037: и список для «Инфо»), объявления, пары и непрочитанное участника,
  // счётчики обращений, пользователи и настройки (организаторы, ссылка-приглашение)
  const r = await ctx.read({
    people: peopleQuery(db, ev.id),
    announcements: announcementsQuery(db, ev.id, ctx.t('db.announcementAuthor')), // 007, FR-701
    pair: member && pairOfSantaQuery(db, ev.id, me.tg_id),
    wardPair: member && pairOfWardQuery(db, ev.id, me.tg_id),
    unread: member && unreadQuery(db, ev.id, me.tg_id),
    support: supportCountsQuery(db, ev, me),
    users: true,
    settings: true,
  });
  // 063: роль вызывающего в событии — владелец, организатор, участник или гость (владелец бота без участия и строки
  // организатора)
  const ownerId = await ctx.ownerId();
  const role = ownerId === me.tg_id ? 'owner' : (await ctx.organizerOf()).has(ev.id) ? 'admin' : member ? 'member' : 'guest';
  const out = {
    event: { ...publicEvent(ev), participants: r.people.length, role, bot_run: !ev.owner_id },
    roster: rosterView(ev, r.people, r.users, ownerId, r.settings),
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
      unread: pair || wardPair ? unreadFrom(r.unread) : { from_ward: 0, from_santa: 0 },
    };
    out.can = { edit_letter: !isFinished(ev), chat_write: chatWritable(ev) };
  }
  // 012: обращения — участнику его статус, админу — ничьи и непрочитанные (для точек на вкладках)
  Object.assign(out, supportCountsView(r.support, { member: !!member, admin: !!me.is_admin }));
  return out;
}

// Список участников на «Инфо» (037, specs/037-info-people/contracts/info-people.md): имена, роли и до жеребьёвки — сколько
// написали письма; ни отметок по людям, ни пар. @username — у каждого, у кого он есть (064)
const byName = (a, b) => a.name.localeCompare(b.name, 'ru') || a.id - b.id;
export function rosterView(ev, people, users, ownerId, settings) {
  const contact = (u) => (u.username ? { username: u.username } : {});
  const role = (u) => (u.tg_id === ownerId ? 'owner' : u.is_admin ? 'admin' : '');
  const admins = users.filter((u) => u.is_admin && u.registered);
  return {
    people: people.map((m) => ({ id: m.user_id, name: m.name, role: role({ ...m, tg_id: m.user_id }), ...contact(m) })).sort(byName),
    organizers: [
      ...admins.filter((u) => u.tg_id === ownerId),
      ...admins.filter((u) => u.tg_id !== ownerId).map((u) => ({ ...u, id: u.tg_id })).sort(byName),
    ].map((u) => ({ id: u.tg_id, name: u.name, owner: u.tg_id === ownerId, ...contact(u) })),
    progress: ev.draw_done ? null : { letters: people.filter((m) => m.has_wishlist).length, of: people.length },
    invite_link: ev.registration_open && !isFinished(ev) ? inviteLink(settings, ev) : '',
  };
}

// 038: открытка письма выбирается из набора. Смена открытки не меняет время письма.
export async function setCard(ctx, ev, raw) {
  const card = validCard(raw);
  if (card === null) return no(tx('participant.noCard'));
  await ctx.db.prepare('UPDATE members SET card = ? WHERE event_id = ? AND user_id = ?').bind(card, ev.id, ctx.me.tg_id).run();
  return { ok: true, card };
}

// 057: правка письма — отметка «ждёт уведомления Санте» (время правки) в той же записи, если у участника есть Санта;
// минутная проверка (src/cron.js) читает только отметки. Каждая запись, меняющая время письма, — с ней (тест cron-marks).
// Параметр — время правки
export const NOTIFY_MARK = `notify_at = CASE WHEN EXISTS (SELECT 1 FROM pairs WHERE pairs.event_id = members.event_id
  AND pairs.ward = members.user_id) THEN ? ELSE notify_at END`;

export async function saveWishlist(ctx, ev, member, raw) {
  if (ev.letter_drafts) return no(tx('participant.draftsOn'));
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (text.length > MAX_CHARS) {
    return no(tooLong(text.length));
  }
  if (text === member.wishlist) return { ok: true, updated_at: member.wishlist_updated_at };
  const now = Date.now();
  const result = await ctx.db.prepare(`UPDATE members SET wishlist = ?, wishlist_updated_at = ?, letter_revision = letter_revision + 1,
      draft_stale = (draft_text IS NOT NULL), ${NOTIFY_MARK} WHERE event_id = ? AND user_id = ?
      AND EXISTS (SELECT 1 FROM events WHERE id = members.event_id AND letter_drafts = 0 AND status = 'active')`)
    .bind(text, now, now, ev.id, ctx.me.tg_id).run();
  if (!result.meta.changes) return no(tx('participant.settingsChanged'));
  return { ok: true, updated_at: now };
}

// Одна условная запись проверяет текущий режим, участие и версию. При публикации
// снятие черновика и обновление текста для Санты вступают в силу вместе.
export async function writeLetterDraft(ctx, ev, member, body, publish) {
  if (!ev.letter_drafts) return no(tx('participant.draftsOff'));
  if (typeof body.text !== 'string') return no(tx('participant.noText'));
  const text = body.text.replace(/\r\n/g, '\n');
  if (text.length > MAX_CHARS) return no(tooLong(text.length));
  if (publish && !text.trim()) return no(tx('participant.emptyLetter'));
  const conflict = tx('participant.letterConflict');
  if (body.revision !== member.letter_revision || body.joined_at !== member.joined_at) return no(conflict);
  const changed = publish && text !== member.wishlist;
  const updated = changed ? Math.max(Date.now(), member.wishlist_updated_at + 1) : member.wishlist_updated_at;
  // Публикация неизменённого текста только снимает черновик: время письма и отметка уведомления прежние (057)
  const assignment = !publish ? 'draft_text = ?'
    : changed ? `wishlist = ?, wishlist_updated_at = ?, draft_text = NULL, ${NOTIFY_MARK}` : 'draft_text = NULL';
  const values = !publish ? [text === member.wishlist ? null : text] : changed ? [text, updated, updated] : [];
  const result = await ctx.db.prepare(`UPDATE members SET ${assignment}, draft_stale = 0, letter_revision = letter_revision + 1
    WHERE event_id = ? AND user_id = ? AND letter_revision = ? AND joined_at = ?
    AND EXISTS (SELECT 1 FROM events WHERE id = members.event_id AND letter_drafts = 1 AND status = 'active')`)
    .bind(...values, ev.id, ctx.me.tg_id, body.revision, body.joined_at).run();
  return result.meta.changes ? { ok: true, revision: body.revision + 1, updated_at: updated } : no(conflict);
}

// ward.get: подопечный и его письмо (только Санте); открытие запоминает увиденное письмо
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
    },
    previous: prev === null || prev === wardMember.wishlist ? null : prev,
    first_view: prev === null,
  };
}


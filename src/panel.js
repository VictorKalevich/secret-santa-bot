// Панель организатора (019): admin.state — состояние события одним ответом, письмо участника для админа, список
// пользователей. Здесь нет ни пар, ни текстов писем и адресов — только статусы (Конституция, принцип I).

import {
  eventMembers, getPairs, getExclusions, allEvents, getFixedPairs, getUser, getMember, auditStmt,
} from './db.js';
import { inviteLink } from './format.js';
import { publicEvent } from './status.js';
import { drawCancelable } from './pairs.js';
import { adminList } from './support.js';

export async function adminState(ctx, ev) {
  const { db, me } = ctx;
  const [ownerId, isOwner, settings] = await Promise.all([ctx.ownerId(), ctx.isOwner(), ctx.settings()]);
  const [members, pairs, exclusions, events, cancelable, famRows, requests, removed, users, fixed] = await Promise.all([
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
    ctx.users(),
    // 014: закреплённые пары — только владельцу; админу они не читаются вовсе
    isOwner ? getFixedPairs(db, ev.id) : null,
  ]);
  const santas = new Set(pairs.map((p) => p.santa));
  const ready = new Set(pairs.filter((p) => p.gift_ready).map((p) => p.santa));
  // 007: статусы человека, а не пары — «получил подарок» (как подопечный) и «открыл подопечного» (как Санта)
  const received = new Set(pairs.filter((p) => p.gift_received).map((p) => p.ward));
  const seen = new Set(pairs.filter((p) => p.seen_text !== null).map((p) => p.santa));
  const memberIds = new Set(members.map((m) => m.user_id));
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
    // 012: обращения — без текстов; переписка — отдельным запросом admin.support.get
    support: await adminList(db, ev, me, isOwner, users),
    // Исключения образца начинают действовать, когда оба вступят (007, FR-707)
    exclusions: exclusions.filter((e) => memberIds.has(e.giver) && memberIds.has(e.receiver)),
    // 014: у админа поля нет вовсе (Конституция, принцип I)
    ...(fixed ? { fixed: fixed.filter((f) => memberIds.has(f.giver) && memberIds.has(f.receiver)) } : {}),
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

// admin.wishlist: письмо участника для организатора; каждое открытие — запись в журнал (без текста)
export async function memberLetter(ctx, ev, rawId) {
  const { db, me } = ctx;
  const id = Number(rawId);
  const [u, m] = await Promise.all([getUser(db, id), getMember(db, ev.id, id)]);
  if (!u || !m) return { ok: false, error: 'Участник не найден' };
  await auditStmt(db, ev.id, me.tg_id, 'wishlist.view', u.name).run();
  return { ok: true, name: u.name, wishlist: m.wishlist, updated_at: m.wishlist_updated_at };
}

// admin.users: зарегистрированные пользователи бота и владелец
export async function usersList(ctx) {
  const [all, ownerId] = await Promise.all([ctx.users(), ctx.ownerId()]);
  const users = all.filter((u) => u.registered);
  return {
    users: users.map((u) => ({ id: u.tg_id, name: u.name, username: u.username, is_admin: !!u.is_admin, is_owner: u.tg_id === ownerId })),
    owner_id: ownerId,
    owner_name: users.find((u) => u.tg_id === ownerId)?.name || '',
  };
}

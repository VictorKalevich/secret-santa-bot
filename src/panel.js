// Панель организатора (019): admin.state — состояние события одним ответом, письмо участника для админа,
// переименование. Здесь нет ни пар, ни текстов писем и адресов — только статусы (Конституция, принцип I).
// 063: люди и права — в пределах события контекста; другие события — где вызывающий организатор.

import {
  panelMembersQuery, panelPairsQuery, exclusionsQuery, organizerEventsQuery, fixedPairsQuery, getUser, getMember, auditStmt, BOT_LOG,
} from './db.js';
import { inviteLink, displayName } from './format.js';
import { atomic } from './claim.js';
import { publicEvent } from './status.js';
import { cancelableQuery } from './pairs.js';
import { adminListQuery, adminListView } from './support.js';
import { no } from './result.js';
import { tx, tjoin } from './i18n/index.js';

export async function adminState(ctx, ev) {
  const { db, me } = ctx;
  const [ownerId, isOwner, settings, botOwner] = await Promise.all([ctx.ownerId(), ctx.isOwner(), ctx.settings(), ctx.isBotOwner()]);
  // Всё состояние — одним пакетом чтений (019). Тексты писем и увиденные письма не читаются: «письмо есть» и «открыл
  // подопечного» считаются в базе
  const r = await ctx.read({
    members: panelMembersQuery(db, ev.id),
    pairs: panelPairsQuery(db, ev.id),
    exclusions: exclusionsQuery(db, ev.id),
    // Владельцу бота — ещё события владельца этого события (образцы и «Из какого события…»)
    events: organizerEventsQuery(db, me.tg_id, botOwner ? ev.owner_id : 0),
    cancelable: cancelableQuery(db, ev),
    requests: db.prepare(
      `SELECT r.id, r.user_id, r.created_at, u.name, u.username FROM join_requests r JOIN users u ON u.tg_id = r.user_id
        WHERE r.event_id = ? AND r.status = 'pending' ORDER BY r.id`
    ).bind(ev.id),
    // 010: удалённые организатором (при запрете возврата они не войдут по ссылке)
    removed: db.prepare(
      `SELECT r.user_id, r.removed_at, u.name, u.username FROM removed_members r JOIN users u ON u.tg_id = r.user_id
        WHERE r.event_id = ? ORDER BY r.removed_at DESC`
    ).bind(ev.id),
    support: adminListQuery(db, ev),
    // 014: закреплённые пары — только владельцу; админу они не читаются вовсе
    fixed: isOwner && fixedPairsQuery(db, ev.id),
    users: true,
  });
  const { members, pairs, exclusions, events, requests, removed, users } = r;
  const cancelable = !!r.cancelable[0]?.ok;
  const fixed = isOwner ? r.fixed : null;
  const santas = new Set(pairs.map((p) => p.santa));
  // Статус человека, а не пары — «открыл подопечного» (как Санта)
  const seen = new Set(pairs.filter((p) => p.seen).map((p) => p.santa));
  const memberIds = new Set(members.map((m) => m.user_id));
  return {
    users: members.map((u) => ({
      id: u.user_id,
      name: u.name,
      username: u.username,
      registered: !!u.registered,
      is_admin: !!u.is_admin,
      is_owner: u.user_id === ownerId,
      has_wishlist: !!u.has_wishlist,
      in_draw: santas.has(u.user_id),
      blocked: !!u.blocked_at, // Telegram сообщил, что бот заблокирован (006)
      ward_seen: santas.has(u.user_id) ? seen.has(u.user_id) : null,
    })),
    requests: requests.map((r) => ({ id: r.id, user_id: r.user_id, name: r.name, username: r.username, created_at: r.created_at })),
    removed: removed.map((r) => ({ id: r.user_id, name: r.name, username: r.username, removed_at: r.removed_at })),
    // 012: обращения — без текстов; переписка — отдельным запросом admin.support.get
    support: adminListView(r.support, users, me, isOwner),
    // Исключения образца начинают действовать, когда оба вступят (007, FR-707)
    exclusions: exclusions.filter((e) => memberIds.has(e.giver) && memberIds.has(e.receiver)),
    // 014: у админа поля нет вовсе (Конституция, принцип I)
    ...(fixed ? { fixed: fixed.filter((f) => memberIds.has(f.giver) && memberIds.has(f.receiver)) } : {}),
    me_member: members.some((m) => m.user_id === me.tg_id),
    // 063: владелец и администраторы события — владелец первым, остальные по имени
    organizers: organizersView(users, ownerId),
    other_events: events.filter((e) => e.id !== ev.id).map((e) => ({ id: e.id, title: e.title, status: e.status })),
    settings: {
      ...publicEvent(ev),
      registration_open: !!ev.registration_open,
      avoid_previous: !!ev.avoid_previous,
      invite_link: inviteLink(settings, ev),
      draw_at: ev.draw_at,
      owner_id: ownerId,
      reveal_auto: !!ev.reveal_auto,
      draw_cancelable: cancelable,
    },
  };
}

// admin.wishlist: письмо участника для организатора; каждое открытие — запись в журнал (без текста)
export async function memberLetter(ctx, ev, rawId) {
  const { db, me } = ctx;
  const id = Number(rawId);
  const [u, m] = await Promise.all([getUser(db, id), getMember(db, ev.id, id)]);
  if (!u || !m) return no(tx('api.memberNotFound'));
  await auditStmt(db, ev.id, me.tg_id, 'wishlist.view', u.name).run();
  return { ok: true, name: u.name, wishlist: m.wishlist, card: m.card, updated_at: m.wishlist_updated_at };
}

// Организаторы события (зарегистрированные, без гостя): { id, name, username, owner }
function organizersView(users, ownerId) {
  return users
    .filter((u) => u.is_admin && u.registered && !u.guest)
    .map((u) => ({ id: u.tg_id, name: u.name, username: u.username, owner: u.tg_id === ownerId }))
    .sort((x, y) => Number(y.owner) - Number(x.owner) || x.name.localeCompare(y.name));
}

// Переименование (025): запись «старое → новое» — только при настоящем изменении. По прежнему состоянию (020): запись —
// пока имя другое, само имя — последним (захват). Второй вызов с тем же именем ничего не пишет и тоже успех: имя уже
// такое, какое просили. Права и длину проверяет строка действия. 063: журнал бота — только у переименования владельцем
// бота (log); своё имя (name.set) журналы не пишет
export async function renameUser(ctx, target, name, actor, log) {
  if (target.name === name) return;
  const a = atomic(ctx.db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND name IS NOT ?)', target.tg_id, name);
  if (log) a.audit(BOT_LOG, actor, 'rename', tjoin(' → ', [displayName(target), name]));
  a.claim(a.where('UPDATE users SET name = ? WHERE tg_id = ?', name, target.tg_id));
  await a.run();
}

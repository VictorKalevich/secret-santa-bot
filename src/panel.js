// Панель организатора (019): admin.state — состояние события одним ответом, письмо участника для админа, список
// пользователей. Здесь нет ни пар, ни текстов писем и адресов — только статусы (Конституция, принцип I).
// 050: всё — в пределах компании контекста (люди, права, другие события, семьи).

import {
  panelMembersQuery, panelPairsQuery, exclusionsQuery, companyEventsQuery, fixedPairsQuery, getUser, getMember, auditStmt,
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
  const [ownerId, isOwner, settings] = await Promise.all([ctx.ownerId(), ctx.isOwner(), ctx.settings()]);
  // Всё состояние — одним пакетом чтений (019). Тексты писем, адреса и увиденные письма не читаются: «письмо есть»,
  // «адрес указан» и «открыл подопечного» считаются в базе
  const r = await ctx.read({
    members: panelMembersQuery(db, ev.id),
    pairs: panelPairsQuery(db, ev.id),
    exclusions: exclusionsQuery(db, ev.id),
    events: companyEventsQuery(db, ev.company_id),
    cancelable: cancelableQuery(db, ev),
    famRows: db.prepare('SELECT fm.user_id, f.id, f.name FROM family_members fm JOIN families f ON f.id = fm.family_id WHERE fm.company_id = ?')
      .bind(ev.company_id),
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
  const { members, pairs, exclusions, events, famRows, requests, removed, users } = r;
  const cancelable = !!r.cancelable[0]?.ok;
  const fixed = isOwner ? r.fixed : null;
  const santas = new Set(pairs.map((p) => p.santa));
  const ready = new Set(pairs.filter((p) => p.gift_ready).map((p) => p.santa));
  const sent = new Set(pairs.filter((p) => p.gift_sent).map((p) => p.santa));
  // 007: статусы человека, а не пары — «получил подарок» (как подопечный) и «открыл подопечного» (как Санта)
  const received = new Set(pairs.filter((p) => p.gift_received).map((p) => p.ward));
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
      gift_ready: ready.has(u.user_id),
      ...(ev.delivery_on ? { gift_sent: sent.has(u.user_id) } : {}),
      blocked: !!u.blocked_at, // Telegram сообщил, что бот заблокирован (006)
      gift_received: received.has(u.user_id),
      ward_seen: santas.has(u.user_id) ? seen.has(u.user_id) : null,
      // 008: только «указан ли адрес» — сам адрес админу не отдаётся
      ...(ev.delivery_on ? { has_delivery: !!u.has_delivery } : {}),
    })),
    // 008: семьи, в которых не меньше двух участников этого эвента
    families: Object.values(famRows.filter((r) => memberIds.has(r.user_id)).reduce((acc, r) => {
      (acc[r.id] ||= { id: r.id, name: r.name, members: [] }).members.push(r.user_id);
      return acc;
    }, {})).filter((f) => f.members.length >= 2),
    requests: requests.map((r) => ({ id: r.id, user_id: r.user_id, name: r.name, username: r.username, created_at: r.created_at })),
    removed: removed.map((r) => ({ id: r.user_id, name: r.name, username: r.username, removed_at: r.removed_at })),
    // 012: обращения — без текстов; переписка — отдельным запросом admin.support.get
    support: adminListView(r.support, users, me, isOwner),
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
  if (!u || !m) return no(tx('api.memberNotFound'));
  await auditStmt(db, ev.id, me.tg_id, 'wishlist.view', u.name).run();
  return { ok: true, name: u.name, wishlist: m.wishlist, card: m.card, updated_at: m.wishlist_updated_at };
}

// Человек состоит больше чем в одной компании (051, FR-5116): его имя меняет он сам или владелец бота
export const companyCountQuery = (db, userId) => db.prepare('SELECT COUNT(*) AS n FROM company_members WHERE user_id = ?').bind(userId);

// admin.users: зарегистрированные люди компании (без гостя) и её владелец
export async function usersList(ctx) {
  const [all, ownerId] = await Promise.all([ctx.users(), ctx.ownerId()]);
  const users = all.filter((u) => u.registered && !u.guest);
  return {
    users: users.map((u) => ({ id: u.tg_id, name: u.name, username: u.username, is_admin: !!u.is_admin, is_owner: u.tg_id === ownerId })),
    owner_id: ownerId,
    owner_name: users.find((u) => u.tg_id === ownerId)?.name || '',
  };
}

// Переименование (025): запись общего журнала «старое → новое» — только при настоящем изменении. По прежнему
// состоянию (020): запись — пока имя другое, само имя — последним (захват). Второй вызов с тем же именем ничего не
// пишет и тоже успех: имя уже такое, какое просили. Права и длину проверяет строка admin.rename. companies — в чьи общие
// журналы запись (050): организатор — компания вызова, сам человек — каждая его компания; пакет и условие — общие.
export async function renameUser(ctx, target, name, actor, companies) {
  if (target.name === name) return;
  const a = atomic(ctx.db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND name IS NOT ?)', target.tg_id, name);
  for (const id of companies) a.audit({ company: id }, actor, 'rename', tjoin(' → ', [displayName(target), name]));
  a.claim(a.where('UPDATE users SET name = ? WHERE tg_id = ?', name, target.tg_id));
  await a.run();
}

// Служебный просмотр владельца бота (010, Конституция 2.0.0, принцип I): единственное место, где пары, письма, адреса и
// переписка читаются не для самого Санты. Только владелец (проверяет api.js), каждое открытие — запись в журнал эвента
// (без пар), статусы участников не меняются: здесь нет ни одного UPDATE.

import { memberQuery, pairLinksQuery, drawMembersQuery, pairOfSantaQuery, pairOfWardQuery, auditStmt } from './db.js';
import { displayName } from './format.js';

const CHAT_LIMIT = 200;

const who = (u, id) => ({ id, name: displayName(u) });

// Последние сообщения переписки человека в одной роли (santa — он Санта, ward — он подопечный), по времени
const chatQuery = (db, ev, column, id) => db
  .prepare(`SELECT sender, text, created_at FROM messages WHERE event_id = ? AND ${column} = ? ORDER BY id DESC LIMIT ?`)
  .bind(ev.id, id, CHAT_LIMIT);

function chatOf(results) {
  // sender — сторона отправителя: 'santa' или 'ward'
  return results.reverse().map((m) => ({ from: m.sender === 'santa' ? 'santa' : 'ward', text: m.text, created_at: m.created_at }));
}

// Участник: кому дарит, кто его Санта, письмо, адрес, переписка с Сантой и с подопечным
export async function vaultPerson(ctx, ev, id, actor) {
  const db = ctx.db;
  // Люди — из списка пользователей вызова (019), участие — одним пакетом с ним
  const first = await ctx.read({ member: memberQuery(db, ev.id, id), users: true });
  const byId = new Map(first.users.map((u) => [u.tg_id, u]));
  const user = byId.get(id);
  const member = first.member[0];
  if (!user || !member) return { ok: false, error: 'Участник не найден' };
  // Сначала журнал: если запись не удалась, данные не отдаются
  await auditStmt(db, ev.id, actor, 'vault.person', displayName(user)).run();
  const r = await ctx.read({
    asSanta: pairOfSantaQuery(db, ev.id, id),
    asWard: pairOfWardQuery(db, ev.id, id),
    withWard: chatQuery(db, ev, 'santa', id),
    withSanta: chatQuery(db, ev, 'ward', id),
  });
  const asSanta = r.asSanta[0];
  const asWard = r.asWard[0];
  const withWard = chatOf(r.withWard);
  const withSanta = chatOf(r.withSanta);
  const wardUser = asSanta ? byId.get(asSanta.ward) : null;
  const santaUser = asWard ? byId.get(asWard.santa) : null;
  return {
    ok: true,
    person: who(user, id),
    in_draw: !!asSanta,
    ward: asSanta ? who(wardUser, asSanta.ward) : null,
    santa: asWard ? who(santaUser, asWard.santa) : null,
    wishlist: member.wishlist,
    wishlist_updated_at: member.wishlist_updated_at,
    ...(ev.delivery_on ? { delivery: member.delivery } : {}),
    chat_with_santa: withSanta,
    chat_with_ward: withWard,
  };
}

// Все пары «Санта → подопечный» эвента
export async function vaultPairs(ctx, ev, actor) {
  const db = ctx.db;
  const { rows, members } = await ctx.read({ rows: pairLinksQuery(db, ev.id), members: drawMembersQuery(db, ev.id) });
  await auditStmt(db, ev.id, actor, 'vault.pairs', `пар: ${rows.length}`).run();
  const byId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const pairs = rows
    .map((p) => ({ santa: who(byId[p.santa], p.santa), ward: who(byId[p.ward], p.ward) }))
    .sort((a, b) => a.santa.name.localeCompare(b.santa.name, 'ru'));
  return { ok: true, pairs };
}

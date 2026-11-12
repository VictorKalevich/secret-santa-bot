// Служебный просмотр владельца бота (010, Конституция 2.0.0, принцип I): единственное место, где пары, письма, адреса и
// переписка читаются не для самого Санты. Только владелец (проверяет api.js), каждое открытие — запись в журнал эвента
// (без пар), статусы участников не меняются: здесь нет ни одного UPDATE.

import { getUser, getMember, getPairs, eventMembers, pairOfSanta, pairOfWard, auditStmt } from './db.js';
import { displayName } from './format.js';

const CHAT_LIMIT = 200;

const who = (u, id) => ({ id, name: displayName(u) });

// Последние сообщения переписки человека в одной роли (santa — он Санта, ward — он подопечный), по времени
async function chatOf(db, ev, column, id) {
  const { results } = await db
    .prepare(`SELECT sender, text, created_at FROM messages WHERE event_id = ? AND ${column} = ? ORDER BY id DESC LIMIT ?`)
    .bind(ev.id, id, CHAT_LIMIT)
    .all();
  // sender — сторона отправителя: 'santa' или 'ward'
  return results.reverse().map((m) => ({ from: m.sender === 'santa' ? 'santa' : 'ward', text: m.text, created_at: m.created_at }));
}

// Участник: кому дарит, кто его Санта, письмо, адрес, переписка с Сантой и с подопечным
export async function vaultPerson(env, ev, id, actor) {
  const db = env.DB;
  const [user, member] = await Promise.all([getUser(db, id), getMember(db, ev.id, id)]);
  if (!user || !member) return { ok: false, error: 'Участник не найден' };
  // Сначала журнал: если запись не удалась, данные не отдаются
  await auditStmt(db, ev.id, actor, 'vault.person', displayName(user)).run();
  const [asSanta, asWard, withWard, withSanta] = await Promise.all([
    pairOfSanta(db, ev.id, id),
    pairOfWard(db, ev.id, id),
    chatOf(db, ev, 'santa', id),
    chatOf(db, ev, 'ward', id),
  ]);
  const [wardUser, santaUser] = await Promise.all([
    asSanta ? getUser(db, asSanta.ward) : null,
    asWard ? getUser(db, asWard.santa) : null,
  ]);
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
export async function vaultPairs(env, ev, actor) {
  const db = env.DB;
  const [rows, members] = await Promise.all([getPairs(db, ev.id), eventMembers(db, ev.id)]);
  await auditStmt(db, ev.id, actor, 'vault.pairs', `пар: ${rows.length}`).run();
  const byId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const pairs = rows
    .map((p) => ({ santa: who(byId[p.santa], p.santa), ward: who(byId[p.ward], p.ward) }))
    .sort((a, b) => a.santa.name.localeCompare(b.santa.name, 'ru'));
  return { ok: true, pairs };
}

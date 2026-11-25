// Владелец бота (063, specs/063-events-without-rooms/contracts/events-without-rooms.md, раздел 3): журнал бота, все
// события бота страницами, кто может создавать события в закрытом боте. Действия bot.* вызывает только владелец бота
// (конвейер api.js).

import { readMany, userQuery, getAudit, BOT_LOG } from './db.js';
import { msg, displayName, appKeyboard } from './format.js';
import { tx } from './i18n/index.js';
import { atomic } from './claim.js';
import { no } from './result.js';
import { openBot } from './creation.js';

// Событий на странице «Все события»
const PAGE = 50;

// Журнал бота: записи без события (063) — передача прав владельца бота, создание и удаление событий, перенос участия,
// разрешения; прежние записи общих журналов комнат (051) — там же как история
export async function botAudit(ctx) {
  return { entries: await getAudit(ctx.db, BOT_LOG, ctx.t) };
}

// Все события бота, новые первыми; владелец — по имени (событие без владельца ведёт владелец бота), people — участников
export async function eventsPage(ctx, offset = 0) {
  const from = Math.max(0, Math.floor(offset));
  const { rows } = await readMany(ctx.db, {
    rows: ctx.db.prepare(
      `SELECT e.id, e.title, e.status, e.event_date, COALESCE(u.name, '') AS owner_name,
              (SELECT COUNT(*) FROM members m WHERE m.event_id = e.id) AS people
         FROM events e LEFT JOIN users u ON u.tg_id = COALESCE(NULLIF(e.owner_id, 0), ?)
        ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?`
    ).bind(await ctx.botOwnerId(), PAGE + 1, from),
  });
  return { events: rows.slice(0, PAGE), more: rows.length > PAGE };
}

// Кто может создавать события: закрытый бот — все зарегистрированные; открытый — люди событий, где владелец бота
// организатор. Сам владелец бота — не в списке (может всегда)
export async function peopleView(ctx) {
  const db = ctx.db;
  const me = ctx.me.tg_id;
  const among = openBot(ctx.env)
    ? `AND tg_id IN (SELECT m.user_id FROM members m JOIN event_admins a ON a.event_id = m.event_id WHERE a.user_id = ?1
                     UNION SELECT b.user_id FROM event_admins b JOIN event_admins a ON a.event_id = b.event_id WHERE a.user_id = ?1)`
    : '';
  const { rows } = await readMany(db, {
    rows: db.prepare(`SELECT tg_id AS id, name, username, can_create FROM users WHERE registered = 1 AND tg_id != ?1 ${among}`).bind(me),
  });
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  return { people: rows.map((u) => ({ ...u, can_create: !!u.can_create })) };
}

// Разрешить или запретить создавать события (закрытый бот). По прежнему значению (024): сообщение и журнал — пока значение
// прежнее, запись — последней (захват); из одновременных одинаковых — один успех
export async function setCreator(ctx, id, on) {
  if (openBot(ctx.env)) return no(tx('botOwner.creator.open'));
  const db = ctx.db;
  const { person: [u], settings } = await ctx.read({ person: userQuery(db, id), settings: true });
  if (!u || !u.registered) return no(tx('botOwner.creator.target'));
  const already = no(tx(on ? 'botOwner.creator.already' : 'botOwner.creator.alreadyOff'));
  if (!!u.can_create === on) return already;
  const a = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND can_create = ?)', id, on ? 0 : 1);
  a.enqueue(id, on
    ? msg(tx('botOwner.creator.granted'), appKeyboard(settings, tx('botOwner.creator.openButton')))
    : msg(tx('botOwner.creator.revoked')));
  a.audit(BOT_LOG, ctx.me.tg_id, on ? 'creator.grant' : 'creator.revoke', displayName(u));
  a.claim(a.where('UPDATE users SET can_create = ? WHERE tg_id = ?', on ? 1 : 0, id));
  if (!(await a.run()).won) return already;
  return { ok: true };
}

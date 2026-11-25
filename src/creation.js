// Кто может создавать события и лимит (063, specs/063-events-without-rooms/research.md R5, R6). Открытый бот — любой
// зарегистрированный; закрытый — владелец бота и люди с разрешением (users.can_create). Лимит — не больше LIMIT_EVENTS
// созданий за LIMIT_MS (факты event_creations: удаление и передача события место не освобождают); у владельца бота
// лимита нет. Условие — в пакете вставки события (createGuard): одновременные создания лимит не превышают.

import { readMany } from './db.js';
import { tx, tdate } from './i18n/index.js';
import { no } from './result.js';

// Открытый бот (052): создавать события может любой. Признак — настройка выката (vars окружения), читается только здесь
export const openBot = (env) => env.OPEN_BOT === '1';

export const LIMIT_EVENTS = 10;
export const LIMIT_MS = 365 * 24 * 60 * 60 * 1000;

export const CREATE_RIGHT = tx('events.createRight');

// Может ли вызывающий создавать события (без учёта лимита)
export async function canCreate(ctx) {
  if (!ctx.me?.registered) return false;
  if (await ctx.isBotOwner()) return true;
  return openBot(ctx.env) || !!ctx.me.can_create;
}

// Созданные человеком за окно лимита: число и время создания LIMIT_EVENTS-го с конца (когда оно выйдет из окна —
// освободится место), и свежее разрешение — для отказа проигравшему
export const creationsQuery = (db, userId, now = Date.now()) => db.prepare(
  `SELECT COUNT(*) AS n,
          (SELECT created_at FROM event_creations WHERE user_id = ?1 AND created_at > ?2 ORDER BY created_at DESC LIMIT 1 OFFSET ?3) AS edge,
          (SELECT can_create FROM users WHERE tg_id = ?1) AS can_create
     FROM event_creations WHERE user_id = ?1 AND created_at > ?2`
).bind(userId, now - LIMIT_MS, LIMIT_EVENTS - 1);

// Сколько ещё можно создать: { left, limit, next } (next — мс, когда освободится место; только при left = 0)
export function limitFrom(row) {
  const left = Math.max(0, LIMIT_EVENTS - (Number(row?.n) || 0));
  return left ? { left, limit: LIMIT_EVENTS } : { left, limit: LIMIT_EVENTS, next: Number(row.edge) + LIMIT_MS };
}

// me.create: владельцу бота — { bot: true }; кто может — лимит; кто не может — null. row — строка creationsQuery
export async function createView(ctx, row) {
  if (await ctx.isBotOwner()) return { bot: true };
  if (!(await canCreate(ctx))) return null;
  return limitFrom(row);
}

// Условие вставки события (SQL и параметры): разрешение в закрытом боте и лимит — кроме владельца бота
export async function createGuard(ctx, now) {
  if (await ctx.isBotOwner()) return { sql: '1', args: [] };
  const sql = ['(SELECT COUNT(*) FROM event_creations WHERE user_id = ? AND created_at > ?) < ?'];
  const args = [ctx.me.tg_id, now - LIMIT_MS, LIMIT_EVENTS];
  if (!openBot(ctx.env)) {
    sql.push('EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND can_create = 1)');
    args.push(ctx.me.tg_id);
  }
  return { sql: sql.join(' AND '), args };
}

// Отказ по свежему состоянию: разрешение сняли или лимит исчерпан
export async function createRefusal(ctx) {
  const { c } = await readMany(ctx.db, { c: creationsQuery(ctx.db, ctx.me.tg_id) });
  const row = c[0];
  if (!openBot(ctx.env) && !(await ctx.isBotOwner()) && !row?.can_create) return no(CREATE_RIGHT, 403);
  const { next } = limitFrom(row);
  const offset = Number(ctx.env.TIMEZONE_OFFSET_HOURS ?? 3);
  return no(tx('events.limit', { limit: LIMIT_EVENTS, date: tdate(next ?? Date.now(), offset) }));
}

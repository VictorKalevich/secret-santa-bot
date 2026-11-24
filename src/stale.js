// Автозавершение брошенных событий в открытом боте (056, specs/056-auto-finish-stale/contracts/auto-finish.md): правила
// владельца А — дата вручения прошла, Г — без даты, без жеребьёвки и никого, кроме организаторов, Б — без даты и старое.
// Подходит — организаторам предупреждение, через STALE.wait дней — обычное завершение (finishEvent). Проверяет ежедневный
// шаг cron (src/cron.js), только в открытом боте.

import { atomic } from './claim.js';
import { msg, q, formatDate, addDays, ISO_DATE, localDate, adminRecipients, appKeyboard } from './format.js';

// Пороги в днях по местным датам: А — от даты вручения, Г и Б — от создания; завершение — через wait после предупреждения
export const STALE = { afterDate: 7, empty: 23, age: 113, wait: 7 };
const DAY_MS = 86400000;

// Почему событие брошено: 'date' (А), 'empty' (Г), 'age' (Б) или null. Будущая дата защищает от всех правил.
// ev.outsiders — участники, кроме организаторов (-1 — не считали: dailyEventsQuery)
export function staleReason(env, ev, today) {
  if (ISO_DATE.test(ev.event_date || '')) return addDays(ev.event_date, STALE.afterDate) <= today ? 'date' : null;
  const created = localDate(env, ev.created_at).iso;
  if (!ev.draw_done && ev.outsiders === 0 && addDays(created, STALE.empty) <= today) return 'empty';
  return addDays(created, STALE.age) <= today ? 'age' : null;
}

// Что сделать с событием сегодня: предупредить, завершить, снять отметку (перестало подходить) или ничего.
// Отметка причину не помнит: подошло по другому правилу — завершается в назначенный день
export function staleStep(env, ev, today) {
  const reason = staleReason(env, ev, today);
  if (!reason) return ev.finish_warned ? { act: 'clear' } : null;
  if (!ev.finish_warned) return { act: 'warn', reason, until: addDays(today, STALE.wait) };
  return addDays(ev.finish_warned, STALE.wait) <= today ? { act: 'finish' } : null;
}

// Идущие события ежедневного шага (индекс events_active, 054) и outsiders — сколько участников не организаторы компании
// события (её администраторы — в том числе владелец компании, инвариант I3 (050/051), — и владелец бота). Считается только в открытом боте у кандидатов правила Г, ещё не
// проверенных сегодня, иначе -1: CASE не вычисляет подзапрос, участники остальных событий не читаются. since — на день
// раньше порога Г (точная проверка — по местным датам, staleReason)
export const dailyEventsQuery = (db, { open, today, now = Date.now() }) => db.prepare(
  `SELECT events.*, CASE WHEN ?1 AND last_daily != ?2 AND event_date = '' AND draw_done = 0 AND created_at <= ?3
     THEN (SELECT COUNT(*) FROM members m
            WHERE m.event_id = events.id
              AND m.user_id != COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'), 0)
              AND NOT EXISTS (SELECT 1 FROM company_members cm
                               WHERE cm.company_id = events.company_id AND cm.user_id = m.user_id AND cm.is_admin = 1))
     ELSE -1 END AS outsiders
     FROM events WHERE status = 'active'`
).bind(open ? 1 : 0, today, now - (STALE.empty - 1) * DAY_MS);

const WHY = {
  date: (ev) => `Дата вручения (${formatDate(ev.event_date)}) уже прошла.`,
  empty: () => 'В него пока никто не вступил, кроме владельца и администраторов.',
  age: () => 'У него нет даты вручения, а создано оно больше трёх месяцев назад.',
};
const KEEP = {
  date: 'Если событие ещё нужно — перенеси дату вручения: «Управление» → «Параметры».',
  empty: 'Если событие ещё нужно — пригласи участников или укажи дату вручения: «Управление» → «Параметры».',
  age: 'Если событие ещё нужно — укажи дату вручения: «Управление» → «Параметры».',
};
const LOGGED = { date: 'дата вручения прошла', empty: 'никто не вступил, кроме владельца и администраторов', age: 'нет даты вручения' };

// Предупреждение организаторам компании события (ctx — её контекст) по прежнему состоянию (020): сообщения и журнал —
// перед захватом, захват — отметка; из одновременных запусков отправляет один, завершённому событию — ничего
export async function warnStale(ctx, ev, { reason, until }, today) {
  const db = ctx.db;
  const { users, settings } = await ctx.read({ users: true, settings: true });
  const when = formatDate(until);
  const text = `⏳ <b>Событие ${q(ev)} завершится автоматически ${when}.</b>\n${WHY[reason](ev)}\n\n${KEEP[reason]}`;
  const fresh = atomic(db, "EXISTS (SELECT 1 FROM events WHERE id = ? AND status = 'active' AND finish_warned = '')", ev.id);
  for (const u of adminRecipients(users)) fresh.enqueue(u.tg_id, msg(text, appKeyboard(settings, '⚙️ Открыть событие', { event: ev.id })));
  fresh.audit(ev.id, 0, 'finish.warn', `${LOGGED[reason]}; завершится ${when}`);
  fresh.claim(db.prepare("UPDATE events SET finish_warned = ?, last_daily = ? WHERE id = ? AND status = 'active' AND finish_warned = ''")
    .bind(today, today, ev.id));
  return fresh.run();
}

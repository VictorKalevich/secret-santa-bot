// Автозавершение брошенных событий в открытом боте (056, specs/056-auto-finish-stale/contracts/auto-finish.md): правила
// владельца А — дата вручения прошла, Г — без даты, без жеребьёвки и никого, кроме организаторов, Б — без даты и старое.
// Подходит — организаторам предупреждение, через STALE.wait дней — обычное завершение (finishEvent). Проверяет ежедневный
// шаг cron (src/cron.js), только в открытом боте.

import { atomic } from './claim.js';
import { msg, q, addDays, ISO_DATE, localDate, adminRecipients, appKeyboard } from './format.js';
import { tx, tdate } from './i18n/index.js';

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

// Идущие события ежедневного шага, ещё не проверенные сегодня (057: индекс events_unchecked, checked_on < сегодня), и
// outsiders — сколько участников не организаторы компании события (её администраторы — в том числе владелец компании,
// инвариант I3 (050/051), — и владелец бота). Считается только в открытом боте у кандидатов правила Г, ещё не
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
     FROM events WHERE status = 'active' AND checked_on < ?2`
).bind(open ? 1 : 0, today, now - (STALE.empty - 1) * DAY_MS);

// Тексты по причине (060): почему брошено (stale.why.*), как сохранить (stale.keep.*), запись журнала (stale.logged.*)
const WHY = {
  date: (ev) => tx('stale.why.date', { date: tdate(ev.event_date) }),
  empty: () => tx('stale.why.empty'),
  age: () => tx('stale.why.age'),
};

// Предупреждение организаторам компании события (ctx — её контекст) по прежнему состоянию (020): сообщения и журнал —
// перед захватом, захват — отметка (с ней и «сегодня сделано», «на сегодня проверено» — 057); из одновременных запусков
// отправляет один, завершённому событию — ничего
export async function warnStale(ctx, ev, { reason, until }, today) {
  const db = ctx.db;
  const { users, settings } = await ctx.read({ users: true, settings: true });
  const when = tdate(until);
  const text = tx('stale.warning', { title: q(ev), when, why: WHY[reason](ev), keep: tx('stale.keep.' + reason) });
  const fresh = atomic(db, "EXISTS (SELECT 1 FROM events WHERE id = ? AND status = 'active' AND finish_warned = '')", ev.id);
  for (const u of adminRecipients(users)) fresh.enqueue(u.tg_id, msg(text, appKeyboard(settings, tx('stale.openButton'), { event: ev.id })));
  fresh.audit(ev.id, 0, 'finish.warn', tx('stale.audit', { why: tx('stale.logged.' + reason), when }));
  fresh.claim(db.prepare("UPDATE events SET finish_warned = ?, last_daily = ?, checked_on = ? WHERE id = ? AND status = 'active' AND finish_warned = ''")
    .bind(today, today, today, ev.id));
  return fresh.run();
}

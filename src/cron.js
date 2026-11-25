// Плановые задачи: запускаются Cloudflare раз в минуту. Работают только с идущими эвентами.

import { enqueueStmt, updateEventStmt, getEvent, auditStmt } from './db.js';
import { appKeyboard, msg, q, escapeHtml, localDate, daysUntil, addDays, ISO_DATE, adminRecipients } from './format.js';
import { flushOutbox } from './outbox.js';
import { tx } from './i18n/index.js';
import { isFinished } from './status.js';
import { remindUnfilled, revealAll, finishEvent } from './events.js';
import { runDraw } from './pairs.js';
import { makeContext } from './context.js';
import { dailyEventsQuery, staleStep, warnStale } from './stale.js';

// Шаги запуска независимы (009, FR-910): ошибка в одном не мешает остальным, а очередь сообщений отправляется
// всегда — в пределах оставшегося бюджета запросов вызова (outbox.js).
// Один контекст на запуск (019): настройки и пользователи читаются не больше раза и только если нужны. Действие над
// событием — в его контексте (063, ctx.at): люди, организаторы и права — этого события.
export async function runScheduled(env) {
  const ctx = makeContext(env);
  await step('notify', () => notifyWishlistChanges(ctx));
  await step('daily', () => dailyStep(ctx));
  await step('flush', () => flushOutbox(env, 45));
}

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    console.log('cron step failed', name, e && e.stack ? e.stack : String(e));
  }
}

// Санта получает уведомление, когда подопечный перестал править письмо
// (через NOTIFY_DELAY_MINUTES после последней правки), чтобы не было спама.
// 057: проверка начинается с отметок правок (members.notify_at, индекс members_notify — только отмеченные): пары, письма
// и события без правок не читаются. Решение «уведомлять» — прежнее (событие идёт, Санта есть, правка новее учтённой
// парой); отметка снимается, только если её не сменила новая правка после чтения
async function notifyWishlistChanges(ctx) {
  const { db, env } = ctx;
  const delayMs = Number(env.NOTIFY_DELAY_MINUTES ?? 10) * 60 * 1000;
  const { results } = await db
    .prepare(
      `SELECT w.event_id, w.user_id, w.notify_at, MAX(w.wishlist_updated_at, w.delivery_updated_at) AS upd,
              p.santa, p.notified_at, s.notify_mode, e.title, e.status
         FROM members w
         LEFT JOIN pairs p ON p.event_id = w.event_id AND p.ward = w.user_id
         LEFT JOIN events e ON e.id = w.event_id
         LEFT JOIN users s ON s.tg_id = p.santa
        WHERE w.notify_at > 0 AND w.notify_at <= ?`
    )
    .bind(Date.now() - delayMs)
    .all();
  if (!results.length) return;
  const due = results.filter((r) => r.santa != null && r.status === 'active' && r.upd > r.notified_at);
  const settings = due.some((r) => r.notify_mode !== 'off') ? await ctx.settings() : null; // только если есть кому писать
  const stmts = results.map((r) => db.prepare('UPDATE members SET notify_at = 0 WHERE event_id = ? AND user_id = ? AND notify_at = ?')
    .bind(r.event_id, r.user_id, r.notify_at));
  for (const r of due) {
    stmts.push(db.prepare('UPDATE pairs SET notified_at = ? WHERE event_id = ? AND santa = ?').bind(r.upd, r.event_id, r.santa));
    if (r.notify_mode === 'off') continue;
    // Без имени подопечного и без текста — превью видно на экране блокировки
    stmts.push(enqueueStmt(db, r.santa, msg(tx('cron.wishlistChanged', { title: q(r) }), {
      disable_notification: r.notify_mode === 'silent',
      ...appKeyboard(settings, tx('cron.lookButton'), { event: r.event_id }),
    })));
  }
  await db.batch(stmts);
}

// Ежедневное напоминание: до жеребьёвки — один раз, за 2 дня до дедлайна, тем, у кого пустое письмо (066: за день и в
// день дедлайна — нет). После жеребьёвки напоминаний нет (064: отметки «подарок готов» убраны)
function dailyReminder(env, ev) {
  if (ev.draw_done) return null;
  return daysUntil(env, ev.deadline) === 2 ? remindUnfilled : null;
}

// Раз в день (с REMINDER_HOUR по местному времени) — автодействия расписания (007: жеребьёвка → раскрытие →
// завершение) и ежедневные напоминания. Каждое такое действие стоит ~10 запросов, поэтому за запуск выполняется
// только одно (009, FR-911); остальные — в следующие минуты. Кандидат выбирается по минуте суток: если один эвент
// раз за разом падает, он не задерживает остальные. Эвенты, которым сегодня ничего не нужно, отмечаются одним запросом.
// 056: ещё правила автозавершения брошенных событий (src/stale.js; 064 — в обоих ботах, только события без даты):
// завершение важнее напоминания, предупреждение — нет; снятие отметки — вместе с «сегодня сделано».
// 057: событие, с которым на сегодня всё (ежедневная часть сделана, автодействие не нужно), отмечается checked_on и до
// завтра не читается. Автодействие может наступить в тот же день только после сохранения параметров, жеребьёвки или
// сброса — они отметку снимают (specs/057-cron-marks/research.md, R7); last_daily при этом остаётся — напоминание не
// повторяется.
async function dailyStep(ctx) {
  const { db, env } = ctx;
  const now = localDate(env);
  if (now.hour < Number(env.REMINDER_HOUR ?? 10)) return;
  // Идущие эвенты без отметки «на сегодня проверено» (057). Людей события читает контекст только для действия — в
  // обычную минуту их не читаем (054)
  const { events: results } = await ctx.read({ events: dailyEventsQuery(db, { today: now.iso }) });
  const autos = [];
  const reminders = [];
  const quiet = [];
  const cleared = [];
  for (const ev of results) {
    const due = dueAutoAction(ev, now.iso);
    if (due) autos.push(async () => runAutoAction(await ctx.at(ev), ev, due));
    else if (ev.last_daily !== now.iso) {
      const stale = staleStep(env, ev, now.iso);
      const remind = dailyReminder(env, ev);
      // Отметка «сегодня сделано» — в одном batch с напоминанием: либо оба, либо ничего
      if (stale?.act === 'finish') reminders.push(async () => finishEvent(await ctx.at(ev), ev, 0));
      else if (remind) reminders.push(async () => remind(await ctx.at(ev), ev, 0, [updateEventStmt(db, ev.id, { last_daily: now.iso, checked_on: now.iso })]));
      else if (stale?.act === 'warn') reminders.push(async () => warnStale(await ctx.at(ev), ev, stale, now.iso));
      else (stale?.act === 'clear' ? cleared : quiet).push(ev.id);
    } else quiet.push(ev.id); // ежедневная часть сделана раньше, отметку сняли — автодействие не наступило
  }
  await markDaily(db, 'last_daily = ?, checked_on = ?', quiet, [now.iso, now.iso]);
  await markDaily(db, "last_daily = ?, finish_warned = '', checked_on = ?", cleared, [now.iso, now.iso]);
  const candidates = [...autos, ...reminders];
  if (candidates.length) await candidates[now.minute % candidates.length]();
}

async function markDaily(db, set, ids, values) {
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90); // не больше 100 параметров в запросе
    await db.prepare(`UPDATE events SET ${set} WHERE id IN (${part.map(() => '?').join(',')})`).bind(...values, ...part).run();
  }
}

// ---------- автодействия по расписанию (007, FR-703) ----------

// Какое автодействие наступило для эвента сегодня: 'draw' → 'reveal' → 'finish' (в этом порядке) или null.
// Завершение — у каждого события с датой вручения на 3-й день после неё (064: галочки finish_auto нет)
function dueAutoAction(ev, today) {
  if (isFinished(ev)) return null;
  if (!ev.draw_done && ISO_DATE.test(ev.draw_auto_date || '') && ev.draw_auto_date <= today) return 'draw';
  const dated = ISO_DATE.test(ev.event_date || '');
  if (ev.reveal_auto && ev.draw_done && !ev.revealed && dated && addDays(ev.event_date, 1) <= today) return 'reveal';
  if (dated && addDays(ev.event_date, 3) <= today) return 'finish';
  return null;
}

async function runAutoAction(ctx, ev, what) {
  const db = ctx.db;
  if (what === 'reveal') return revealAll(ctx, ev, 0);
  if (what === 'finish') return finishEvent(ctx, ev, 0);
  const r = await runDraw(ctx, ev, { actor: 0, action: 'draw.auto' });
  if (r.ok) return r;
  if ((await getEvent(db, ev.id))?.draw_done) return r; // жеребьёвку уже провёл кто-то другой
  // Неудача: организаторам компании события — причина, дата снимается, чтобы не пытаться каждую минуту
  const users = await ctx.users();
  await db.batch([
    updateEventStmt(db, ev.id, { draw_auto_date: '' }),
    ...adminRecipients(users).map((u) => enqueueStmt(db, u.tg_id, msg(
      tx('cron.autoDrawFailed', { title: q(ev), error: escapeHtml(r.error) })
    ))),
    auditStmt(db, ev.id, 0, 'draw.auto.failed', r.error),
  ]);
  return r;
}

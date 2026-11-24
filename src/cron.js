// Плановые задачи: запускаются Cloudflare раз в минуту. Работают только с идущими эвентами.

import { enqueueStmt, updateEventStmt, getEvent, auditStmt } from './db.js';
import { appKeyboard, msg, q, escapeHtml, localDate, daysUntil, addDays, ISO_DATE, adminRecipients } from './format.js';
import { flushOutbox } from './outbox.js';
import { isFinished } from './status.js';
import { remindUnfilled, remindSantas, revealAll, finishEvent } from './events.js';
import { runDraw } from './pairs.js';
import { makeContext } from './context.js';
import { openBot } from './companies.js';
import { dailyEventsQuery, staleStep, warnStale } from './stale.js';

// Шаги запуска независимы (009, FR-910): ошибка в одном не мешает остальным, а очередь сообщений отправляется
// всегда — в пределах оставшегося бюджета запросов вызова (outbox.js).
// Один контекст на запуск (019): настройки и пользователи читаются не больше раза и только если нужны. Действие над
// событием — в контексте его компании (050, ctx.in): люди, организаторы и права — этой компании.
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
// 054: CROSS JOIN закрепляет порядок «идущие события (индекс events_active) → их пары → подопечный» — пары завершённых
// событий и участники без пар не читаются (лимит чтений D1 бесплатного тарифа)
async function notifyWishlistChanges(ctx) {
  const { db, env } = ctx;
  const delayMs = Number(env.NOTIFY_DELAY_MINUTES ?? 10) * 60 * 1000;
  const { results } = await db
    .prepare(
      `SELECT p.event_id, p.santa, MAX(w.wishlist_updated_at, w.delivery_updated_at) AS upd, s.notify_mode, e.title, e.delivery_on
         FROM events e
        CROSS JOIN pairs p ON p.event_id = e.id
        CROSS JOIN members w ON w.event_id = p.event_id AND w.user_id = p.ward
         JOIN users s ON s.tg_id = p.santa
        WHERE e.status = 'active'
          AND MAX(w.wishlist_updated_at, w.delivery_updated_at) > p.notified_at
          AND MAX(w.wishlist_updated_at, w.delivery_updated_at) <= ?`
    )
    .bind(Date.now() - delayMs)
    .all();
  if (!results.length) return;
  const settings = await ctx.settings(); // только если есть что отправлять
  const stmts = [];
  for (const r of results) {
    stmts.push(db.prepare('UPDATE pairs SET notified_at = ? WHERE event_id = ? AND santa = ?').bind(r.upd, r.event_id, r.santa));
    if (r.notify_mode === 'off') continue;
    // Без имени подопечного и без текста — превью видно на экране блокировки.
    // 008: изменение адреса доставки — тем же уведомлением, без текста адреса
    const what = r.delivery_on ? 'обновил письмо или адрес доставки' : 'обновил письмо Санте';
    stmts.push(enqueueStmt(db, r.santa, msg(`📝 Твой подопечный в событии ${q(r)} ${what}.`, {
      disable_notification: r.notify_mode === 'silent',
      ...appKeyboard(settings, '👀 Посмотреть', { event: r.event_id }),
    })));
  }
  await db.batch(stmts);
}

// Какое ежедневное напоминание нужно эвенту сегодня:
//  • до жеребьёвки — за 2 дня, за день и в день дедлайна напомнить тем, у кого пустое письмо;
//  • после жеребьёвки — за 2 дня и в день вручения напомнить Сантам, которые не отметили «подарок готов».
function dailyReminder(env, ev) {
  if (!ev.draw_done) {
    const d = daysUntil(env, ev.deadline);
    return d !== null && d >= 0 && d <= 2 ? remindUnfilled : null;
  }
  const d = daysUntil(env, ev.event_date);
  return d === 2 || d === 0 ? remindSantas : null;
}

// Раз в день (с REMINDER_HOUR по местному времени) — автодействия расписания (007: жеребьёвка → раскрытие →
// завершение) и ежедневные напоминания. Каждое такое действие стоит ~10 запросов, поэтому за запуск выполняется
// только одно (009, FR-911); остальные — в следующие минуты. Кандидат выбирается по минуте суток: если один эвент
// раз за разом падает, он не задерживает остальные. Эвенты, которым сегодня ничего не нужно, отмечаются одним запросом.
// 056: в открытом боте — ещё правила автозавершения брошенных событий (src/stale.js): завершение важнее напоминания,
// предупреждение — нет; снятие отметки — вместе с «сегодня сделано».
async function dailyStep(ctx) {
  const { db, env } = ctx;
  const now = localDate(env);
  if (now.hour < Number(env.REMINDER_HOUR ?? 10)) return;
  // Все идущие эвенты (индекс events_active, 054): автодействие, заданное уже после сегодняшнего прохода, выполняется
  // сразу. Компании читает ctx.in только для действия — в обычную минуту их не читаем (054)
  const open = openBot(env);
  const { events: results } = await ctx.read({ events: dailyEventsQuery(db, { open, today: now.iso }) });
  const inCompany = (ev) => ctx.in(ev.company_id);
  const autos = [];
  const reminders = [];
  const quiet = [];
  const cleared = [];
  for (const ev of results) {
    const due = dueAutoAction(ev, now.iso);
    if (due) autos.push(async () => runAutoAction(await inCompany(ev), ev, due));
    else if (ev.last_daily !== now.iso) {
      const stale = open ? staleStep(env, ev, now.iso) : null;
      const remind = dailyReminder(env, ev);
      // Отметка «сегодня сделано» — в одном batch с напоминанием: либо оба, либо ничего
      if (stale?.act === 'finish') reminders.push(async () => finishEvent(await inCompany(ev), ev, 0));
      else if (remind) reminders.push(async () => remind(await inCompany(ev), ev, 0, [updateEventStmt(db, ev.id, { last_daily: now.iso })]));
      else if (stale?.act === 'warn') reminders.push(async () => warnStale(await inCompany(ev), ev, stale, now.iso));
      else (stale?.act === 'clear' ? cleared : quiet).push(ev.id);
    }
  }
  await markDaily(db, 'last_daily = ?', quiet, now.iso);
  await markDaily(db, "last_daily = ?, finish_warned = ''", cleared, now.iso);
  const candidates = [...autos, ...reminders];
  if (candidates.length) await candidates[now.minute % candidates.length]();
}

async function markDaily(db, set, ids, today) {
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90); // не больше 100 параметров в запросе
    await db.prepare(`UPDATE events SET ${set} WHERE id IN (${part.map(() => '?').join(',')})`).bind(today, ...part).run();
  }
}

// ---------- автодействия по расписанию (007, FR-703) ----------

// Какое автодействие наступило для эвента сегодня: 'draw' → 'reveal' → 'finish' (в этом порядке) или null
function dueAutoAction(ev, today) {
  if (isFinished(ev)) return null;
  if (!ev.draw_done && ISO_DATE.test(ev.draw_auto_date || '') && ev.draw_auto_date <= today) return 'draw';
  const dated = ISO_DATE.test(ev.event_date || '');
  if (ev.reveal_auto && ev.draw_done && !ev.revealed && dated && addDays(ev.event_date, 1) <= today) return 'reveal';
  if (ev.finish_auto && dated && addDays(ev.event_date, 3) <= today) return 'finish';
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
      `⚠️ <b>Автожеребьёвка ${q(ev)} не прошла:</b>\n${escapeHtml(r.error)}\n\nДата автожеребьёвки снята — проведи жеребьёвку вручную в панели события.`
    ))),
    auditStmt(db, ev.id, 0, 'draw.auto.failed', r.error),
  ]);
  return r;
}

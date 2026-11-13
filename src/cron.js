// Плановые задачи: запускаются Cloudflare раз в минуту. Работают только с идущими эвентами.

import { getSettings, enqueueStmt, updateEventStmt, getEvent, allUsers, auditStmt } from './db.js';
import { openAppButton, msg, q, escapeHtml, localDate, daysUntil, addDays, ISO_DATE, adminRecipients } from './format.js';
import { flushOutbox } from './outbox.js';
import { isFinished, remindUnfilled, remindSantas, revealAll, finishEvent } from './events.js';
import { runDraw } from './pairs.js';

// Шаги запуска независимы (009, FR-910): ошибка в одном не мешает остальным, а очередь сообщений отправляется
// всегда — в пределах оставшегося бюджета запросов вызова (outbox.js).
export async function runScheduled(env) {
  await step('notify', () => notifyWishlistChanges(env));
  await step('daily', () => dailyStep(env));
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
async function notifyWishlistChanges(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  const delayMs = Number(env.NOTIFY_DELAY_MINUTES ?? 10) * 60 * 1000;
  const { results } = await db
    .prepare(
      `SELECT p.event_id, p.santa, MAX(w.wishlist_updated_at, w.delivery_updated_at) AS upd, s.notify_mode, e.title, e.delivery_on
         FROM pairs p
         JOIN events e ON e.id = p.event_id AND e.status = 'active'
         JOIN members w ON w.event_id = p.event_id AND w.user_id = p.ward
         JOIN users s ON s.tg_id = p.santa
        WHERE MAX(w.wishlist_updated_at, w.delivery_updated_at) > p.notified_at
          AND MAX(w.wishlist_updated_at, w.delivery_updated_at) <= ?`
    )
    .bind(Date.now() - delayMs)
    .all();
  if (!results.length) return;
  const stmts = [];
  for (const r of results) {
    stmts.push(db.prepare('UPDATE pairs SET notified_at = ? WHERE event_id = ? AND santa = ?').bind(r.upd, r.event_id, r.santa));
    if (r.notify_mode === 'off') continue;
    // Без имени подопечного и без текста — превью видно на экране блокировки.
    // 008: изменение адреса доставки — тем же уведомлением, без текста адреса
    const what = r.delivery_on ? 'обновил письмо или адрес доставки' : 'обновил письмо Санте';
    stmts.push(enqueueStmt(db, r.santa, msg(`📝 Твой подопечный в событии ${q(r)} ${what}.`, {
      disable_notification: r.notify_mode === 'silent',
      reply_markup: { inline_keyboard: [[openAppButton(settings, '👀 Посмотреть', { event: r.event_id })]] },
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
async function dailyStep(env) {
  const now = localDate(env);
  if (now.hour < Number(env.REMINDER_HOUR ?? 10)) return;
  const db = env.DB;
  // Все идущие эвенты (их немного): автодействие, заданное уже после сегодняшнего прохода, выполняется сразу
  const { results } = await db.prepare("SELECT * FROM events WHERE status = 'active'").all();
  const autos = [];
  const reminders = [];
  const quiet = [];
  for (const ev of results) {
    const due = dueAutoAction(ev, now.iso);
    if (due) autos.push(() => runAutoAction(env, ev, due));
    else if (ev.last_daily !== now.iso) {
      const remind = dailyReminder(env, ev);
      // Отметка «сегодня сделано» — в одном batch с напоминанием: либо оба, либо ничего
      if (remind) reminders.push(() => remind(env, ev, 0, [updateEventStmt(db, ev.id, { last_daily: now.iso })]));
      else quiet.push(ev.id);
    }
  }
  for (let i = 0; i < quiet.length; i += 90) {
    const ids = quiet.slice(i, i + 90); // не больше 100 параметров в запросе
    await db.prepare(`UPDATE events SET last_daily = ? WHERE id IN (${ids.map(() => '?').join(',')})`).bind(now.iso, ...ids).run();
  }
  const candidates = [...autos, ...reminders];
  if (candidates.length) await candidates[now.minute % candidates.length]();
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

async function runAutoAction(env, ev, what) {
  const db = env.DB;
  if (what === 'reveal') return revealAll(env, ev, 0);
  if (what === 'finish') return finishEvent(env, ev, 0);
  const r = await runDraw(env, ev, { actor: 0, action: 'draw.auto' });
  if (r.ok) return r;
  if ((await getEvent(db, ev.id))?.draw_done) return r; // жеребьёвку уже провёл кто-то другой
  // Неудача: админам — причина, дата снимается, чтобы не пытаться каждую минуту
  const users = await allUsers(db);
  await db.batch([
    updateEventStmt(db, ev.id, { draw_auto_date: '' }),
    ...adminRecipients(users).map((u) => enqueueStmt(db, u.tg_id, msg(
      `⚠️ <b>Автожеребьёвка ${q(ev)} не прошла:</b>\n${escapeHtml(r.error)}\n\nДата автожеребьёвки снята — проведи жеребьёвку вручную в панели события.`
    ))),
    auditStmt(db, ev.id, 0, 'draw.auto.failed', r.error),
  ]);
  return r;
}

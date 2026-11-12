// Плановые задачи: запускаются Cloudflare раз в минуту. Работают только с идущими эвентами.

import { getSettings, enqueueStmt, updateEvent, updateEventStmt, getEvent, allUsers, auditStmt } from './db.js';
import { openAppButton, msg, q, escapeHtml, localDate, daysUntil, addDays, ISO_DATE, adminRecipients } from './format.js';
import { flushOutbox } from './outbox.js';
import { isFinished, remindUnfilled, remindSantas, revealAll, finishEvent } from './events.js';
import { runDraw } from './pairs.js';

export async function runScheduled(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  await notifyWishlistChanges(env, settings);
  const acted = await dailyReminders(env);
  // Автодействие само тратит ~10 запросов к D1 — отправляем меньше, чтобы уложиться в лимит вызова
  await flushOutbox(env, acted ? 25 : 35);
}

// Санта получает уведомление, когда подопечный перестал править письмо
// (через NOTIFY_DELAY_MINUTES после последней правки), чтобы не было спама.
async function notifyWishlistChanges(env, settings) {
  const db = env.DB;
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
    stmts.push(enqueueStmt(db, r.santa, msg(`📝 Твой подопечный в эвенте ${q(r)} ${what}.`, {
      disable_notification: r.notify_mode === 'silent',
      reply_markup: { inline_keyboard: [[openAppButton(settings, '👀 Посмотреть', { event: r.event_id })]] },
    })));
  }
  await db.batch(stmts);
}

// Раз в день (в REMINDER_HOUR по местному времени) для каждого идущего эвента:
//  • до жеребьёвки — за 2 дня, за день и в день дедлайна напомнить тем, у кого пустое письмо;
//  • после жеребьёвки — за 2 дня и в день вручения напомнить Сантам, которые не отметили «подарок готов».
// Сначала — автодействия расписания (007): жеребьёвка → раскрытие → завершение. Не больше одного эвента
// с автодействием за вызов; такой эвент не помечается last_daily и проверяется снова в следующую минуту.
async function dailyReminders(env) {
  const now = localDate(env);
  if (now.hour < Number(env.REMINDER_HOUR ?? 10)) return false;
  const db = env.DB;
  // Все идущие эвенты (их немного): автодействие, заданное уже после сегодняшнего прохода, выполняется сразу
  const { results } = await db.prepare("SELECT * FROM events WHERE status = 'active'").all();
  let acted = false;
  for (const ev of results) {
    const due = dueAutoAction(ev, now.iso);
    if (!due && ev.last_daily === now.iso) continue;
    if (due) {
      if (acted) continue;
      acted = true;
      await runAutoAction(env, ev, due);
      continue;
    }
    await updateEvent(db, ev.id, { last_daily: now.iso });
    if (!ev.draw_done) {
      const d = daysUntil(env, ev.deadline);
      if (d !== null && d >= 0 && d <= 2) await remindUnfilled(env, ev);
    } else {
      const d = daysUntil(env, ev.event_date);
      if (d === 2 || d === 0) await remindSantas(env, ev);
    }
  }
  return acted;
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
      `⚠️ <b>Автожеребьёвка ${q(ev)} не прошла:</b>\n${escapeHtml(r.error)}\n\nДата автожеребьёвки снята — проведи жеребьёвку вручную в панели эвента.`
    ))),
    auditStmt(db, ev.id, 0, 'draw.auto.failed', r.error),
  ]);
  return r;
}

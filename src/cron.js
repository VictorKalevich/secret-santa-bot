// Плановые задачи: запускаются Cloudflare раз в минуту.

import { getSettings, setSettings, enqueueStmt } from './db.js';
import { flushOutbox, openAppButton, msg, isDrawDone, remindUnfilled, remindSantas } from './game.js';

export async function runScheduled(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  await notifyWishlistChanges(env, settings);
  await dailyReminders(env, settings);
  await flushOutbox(env, 35);
}

// Санта получает уведомление, когда подопечный перестал править письмо
// (через NOTIFY_DELAY_MINUTES после последней правки), чтобы не было спама.
async function notifyWishlistChanges(env, settings) {
  if (!isDrawDone(settings)) return;
  const db = env.DB;
  const delayMs = Number(env.NOTIFY_DELAY_MINUTES ?? 10) * 60 * 1000;
  const { results } = await db
    .prepare(
      `SELECT p.santa, w.wishlist_updated_at AS upd, s.notify_mode
         FROM pairs p
         JOIN users w ON w.tg_id = p.ward
         JOIN users s ON s.tg_id = p.santa
        WHERE w.wishlist_updated_at > p.notified_at
          AND w.wishlist_updated_at <= ?`
    )
    .bind(Date.now() - delayMs)
    .all();
  if (!results.length) return;
  const stmts = [];
  for (const r of results) {
    stmts.push(db.prepare('UPDATE pairs SET notified_at = ? WHERE santa = ?').bind(r.upd, r.santa));
    if (r.notify_mode === 'off') continue;
    // Без имени подопечного и без текста — превью видно на экране блокировки.
    stmts.push(enqueueStmt(db, r.santa, msg('📝 Твой подопечный обновил письмо Санте.', {
      disable_notification: r.notify_mode === 'silent',
      reply_markup: { inline_keyboard: [[openAppButton(settings, '👀 Посмотреть')]] },
    })));
  }
  await db.batch(stmts);
}

function localDate(env, plusDays = 0) {
  const offset = Number(env.TIMEZONE_OFFSET_HOURS ?? 3);
  const d = new Date(Date.now() + offset * 3600 * 1000 + plusDays * 86400 * 1000);
  return { iso: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

function daysUntil(env, iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const today = localDate(env).iso;
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}

// Раз в день (в REMINDER_HOUR по местному времени):
//  • до жеребьёвки — за 2 дня, за день и в день дедлайна напомнить тем, у кого пустое письмо;
//  • после жеребьёвки — за 2 дня и в день вручения напомнить Сантам, которые не отметили «подарок готов».
async function dailyReminders(env, settings) {
  const now = localDate(env);
  if (now.hour < Number(env.REMINDER_HOUR ?? 10)) return;
  if (settings.last_daily === now.iso) return;
  await setSettings(env.DB, { last_daily: now.iso });

  if (!isDrawDone(settings)) {
    const d = daysUntil(env, settings.deadline);
    if (d !== null && d >= 0 && d <= 2) await remindUnfilled(env);
  } else {
    const d = daysUntil(env, settings.event_date);
    if (d === 2 || d === 0) await remindSantas(env);
  }
}

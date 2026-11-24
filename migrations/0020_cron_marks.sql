-- 057: минутная проверка по отметкам. members.notify_at — время правки письма или адреса, о которой Санта ещё не
-- уведомлён (0 — ничего не ждёт); events.checked_on — местная дата (YYYY-MM-DD), когда ежедневный шаг закончил с
-- событием ('' — не проверено). Частичные индексы — только отмеченные участники и идущие события: cron находит их, не
-- перебирая пары и события. Отметки получают правки, уже ждущие уведомления (то же условие, что у прежнего запроса).
-- Применяется ДО выката кода: прежний код колонки не читает. После выката — tools/notify-reconcile.sql (правки,
-- принятые прежним кодом между миграцией и выкатом).

ALTER TABLE members ADD COLUMN notify_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN checked_on TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS members_notify ON members (notify_at) WHERE notify_at > 0;
CREATE INDEX IF NOT EXISTS events_unchecked ON events (checked_on) WHERE status = 'active';

UPDATE members SET notify_at = MAX(wishlist_updated_at, delivery_updated_at)
 WHERE EXISTS (SELECT 1 FROM pairs p JOIN events e ON e.id = p.event_id
                WHERE p.event_id = members.event_id AND p.ward = members.user_id AND e.status = 'active'
                  AND p.notified_at < MAX(members.wishlist_updated_at, members.delivery_updated_at));

INSERT INTO settings (key, value) VALUES ('schema', '20') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

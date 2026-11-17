-- 037: параметр события «Участники могут писать друг другу» — @username в списке участников на «Инфо» и чат в Telegram
-- по нажатию на имя. Только добавляет колонку (у всех событий — выключено) и поднимает версию схемы: код 037 её требует,
-- прежний код с ней работает (требует не ниже 11).

ALTER TABLE events ADD COLUMN contacts_on INTEGER NOT NULL DEFAULT 0;

INSERT INTO settings (key, value) VALUES ('schema', '12')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

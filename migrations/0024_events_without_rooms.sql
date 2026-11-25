-- 063: события без комнат (specs/063-events-without-rooms/). У события свой владелец (events.owner_id) и свои
-- организаторы (event_admins; владелец — тоже там). Владелец события — назначенный владелец его комнаты, у комнаты без
-- него — владелец бота; организаторы — администраторы комнаты, для каждого её события, включая завершённые. Факты
-- создания (event_creations) — для лимита «10 за 365 суток»; разрешение создавать в закрытом боте (users.can_create) —
-- бывшим администраторам и владельцам комнат. Таблицы и колонки комнат остаются: прежний код (062) их читает — откат
-- возможен. Применяется ДО выката кода (код 063 требует схему 24, прежний — не ниже 23). После выката — сверка
-- tools/rooms-reconcile.sql (события, которые прежний код успел создать между миграцией и выкатом).

ALTER TABLE events ADD COLUMN owner_id INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN can_create INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS event_admins (
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_admins_user ON event_admins (user_id);

CREATE TABLE IF NOT EXISTS event_creations (
  event_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS event_creations_user ON event_creations (user_id, created_at);

CREATE INDEX IF NOT EXISTS events_owner ON events (owner_id, created_at);

UPDATE events
   SET owner_id = COALESCE(
         NULLIF((SELECT c.owner_id FROM companies c WHERE c.id = events.company_id), 0),
         (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'),
         0)
 WHERE owner_id = 0;

INSERT OR IGNORE INTO event_admins (event_id, user_id, created_at)
SELECT e.id, cm.user_id, cm.joined_at
  FROM events e
  JOIN company_members cm ON cm.company_id = e.company_id AND cm.is_admin = 1;

INSERT OR IGNORE INTO event_admins (event_id, user_id, created_at)
SELECT id, owner_id, created_at FROM events WHERE owner_id != 0;

INSERT OR IGNORE INTO event_creations (event_id, user_id, created_at)
SELECT id, created_by, created_at FROM events WHERE created_by != 0;

UPDATE users SET can_create = 1
 WHERE can_create = 0
   AND (tg_id IN (SELECT user_id FROM company_members WHERE is_admin = 1)
     OR tg_id IN (SELECT owner_id FROM companies WHERE owner_id != 0));

INSERT INTO settings (key, value) VALUES ('schema', '24') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

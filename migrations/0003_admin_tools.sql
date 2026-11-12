-- 007: объявления, журнал действий, расписание эвента, «подарок получен».
-- Только добавляет таблицы и поля; данные не меняет.

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  author INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS announcements_event ON announcements (event_id, id);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL DEFAULT 0,
  actor INTEGER NOT NULL DEFAULT 0,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_event ON audit (event_id, id);

ALTER TABLE events ADD COLUMN draw_auto_date TEXT NOT NULL DEFAULT '';

ALTER TABLE events ADD COLUMN reveal_auto INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events ADD COLUMN finish_auto INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pairs ADD COLUMN gift_received INTEGER NOT NULL DEFAULT 0;

ALTER TABLE pairs ADD COLUMN gift_received_at INTEGER NOT NULL DEFAULT 0;

INSERT INTO settings (key, value) VALUES ('schema', '7')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- 008: адрес доставки, семьи (постоянные исключения), заявки на вступление.
-- Только добавляет таблицы и поля; данные не меняет.

ALTER TABLE members ADD COLUMN delivery TEXT NOT NULL DEFAULT '';

ALTER TABLE members ADD COLUMN delivery_updated_at INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events ADD COLUMN delivery_on INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events ADD COLUMN families_on INTEGER NOT NULL DEFAULT 1;

ALTER TABLE events ADD COLUMN approval INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Человек состоит не больше чем в одной семье
CREATE TABLE IF NOT EXISTS family_members (
  user_id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS family_members_family ON family_members (family_id);

CREATE TABLE IF NOT EXISTS join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  decided_by INTEGER NOT NULL DEFAULT 0,
  decided_at INTEGER NOT NULL DEFAULT 0
);

-- Не больше одной ожидающей заявки человека в эвент
CREATE UNIQUE INDEX IF NOT EXISTS join_requests_pending ON join_requests (event_id, user_id) WHERE status = 'pending';

INSERT INTO settings (key, value) VALUES ('schema', '8')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

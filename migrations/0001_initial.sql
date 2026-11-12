-- Схема 005 (эвенты и история). IF NOT EXISTS: безопасно и для пустой базы,
-- и для локальной базы, созданной кодом 005.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  tg_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  is_admin INTEGER NOT NULL DEFAULT 0,
  registered INTEGER NOT NULL DEFAULT 0,
  notify_mode TEXT NOT NULL DEFAULT 'sound',
  pending TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL DEFAULT 0,
  finished_at INTEGER NOT NULL DEFAULT 0,
  invite_code TEXT NOT NULL UNIQUE,
  registration_open INTEGER NOT NULL DEFAULT 1,
  draw_done INTEGER NOT NULL DEFAULT 0,
  draw_at INTEGER NOT NULL DEFAULT 0,
  revealed INTEGER NOT NULL DEFAULT 0,
  ring INTEGER NOT NULL DEFAULT 1,
  avoid_previous INTEGER NOT NULL DEFAULT 1,
  budget TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_daily TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS members (
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  wishlist TEXT NOT NULL DEFAULT '',
  wishlist_updated_at INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS members_user ON members (user_id);

CREATE TABLE IF NOT EXISTS exclusions (
  event_id INTEGER NOT NULL,
  giver INTEGER NOT NULL,
  receiver INTEGER NOT NULL,
  PRIMARY KEY (event_id, giver, receiver)
);

CREATE TABLE IF NOT EXISTS pairs (
  event_id INTEGER NOT NULL,
  santa INTEGER NOT NULL,
  ward INTEGER NOT NULL,
  seen_text TEXT,
  notified_at INTEGER NOT NULL DEFAULT 0,
  gift_ready INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, santa),
  UNIQUE (event_id, ward)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  santa INTEGER NOT NULL,
  ward INTEGER NOT NULL,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS messages_pair ON messages (event_id, santa, ward, id);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT INTO settings (key, value) VALUES ('schema', '5')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

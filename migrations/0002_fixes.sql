-- 006: отметка «не получает сообщения», захват сообщений очереди, защита от двойной жеребьёвки.
-- Только добавляет поля; данные не меняет.

ALTER TABLE users ADD COLUMN blocked_at INTEGER NOT NULL DEFAULT 0;

ALTER TABLE outbox ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events ADD COLUMN draw_token TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS outbox_chat ON outbox (chat_id, id);

INSERT INTO settings (key, value) VALUES ('schema', '6')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

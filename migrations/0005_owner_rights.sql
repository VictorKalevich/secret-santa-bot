-- 010: права владельца — настройка эвента «удалённые могут вернуться по ссылке» и отметки «удалён организатором».
-- Только добавляет поле и таблицу; данные не меняет.

ALTER TABLE events ADD COLUMN rejoin INTEGER NOT NULL DEFAULT 1;

-- Кого удалил организатор (admin.remove). Снимается при вступлении, «Разрешить вернуться», сбросе и удалении эвента.
CREATE TABLE IF NOT EXISTS removed_members (
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  removed_by INTEGER NOT NULL DEFAULT 0,
  removed_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

INSERT INTO settings (key, value) VALUES ('schema', '9')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

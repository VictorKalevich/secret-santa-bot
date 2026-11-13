-- 012: обращения участника к организаторам (по эвентам). Только добавляет таблицы; данные не меняет.

-- Обращение: автор — участник эвента; assignee — админ, который его ведёт (0 — ничьё).
CREATE TABLE IF NOT EXISTS support_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assignee INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  taken_at INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER NOT NULL DEFAULT 0,
  closed_by INTEGER NOT NULL DEFAULT 0
);

-- Не больше одного открытого обращения участника в эвенте
CREATE UNIQUE INDEX IF NOT EXISTS support_threads_open ON support_threads (event_id, user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS support_threads_event ON support_threads (event_id, id);

-- Сообщения обращения: from_admin = 1 — ответ организатора, 0 — участник. read_at — прочитано другой стороной.
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  sender INTEGER NOT NULL,
  from_admin INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS support_messages_thread ON support_messages (thread_id, id);

INSERT INTO settings (key, value) VALUES ('schema', '10')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

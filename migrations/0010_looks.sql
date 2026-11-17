-- 038: значок у имени (users.emoji — эмодзи из набора src/looks.js или пусто) и открытка письма Санте (members.card —
-- открытка из набора или пусто, своя у письма в каждом событии). Только добавляет колонки (у всех — пусто) и поднимает
-- версию схемы: код 038 её требует, прежний код с ней работает (требует не ниже 12).

ALTER TABLE users ADD COLUMN emoji TEXT NOT NULL DEFAULT '';

ALTER TABLE members ADD COLUMN card TEXT NOT NULL DEFAULT '';

INSERT INTO settings (key, value) VALUES ('schema', '13')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

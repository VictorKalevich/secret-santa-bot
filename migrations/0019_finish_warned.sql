-- 056: автозавершение брошенных событий в открытом боте — местная дата (YYYY-MM-DD), когда организаторы получили
-- предупреждение; '' — не предупреждали или отметка снята. Применяется ДО выката кода: прежний код колонку не читает.

ALTER TABLE events ADD COLUMN finish_warned TEXT NOT NULL DEFAULT '';

INSERT INTO settings (key, value) VALUES ('schema', '19') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

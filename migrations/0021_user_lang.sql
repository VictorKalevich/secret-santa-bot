-- 060: язык интерфейса человека — код языка из списка src/i18n/index.js ('' — язык по умолчанию, русский). В шаге 1
-- локализации его ставят только тесты; язык Telegram и выбор человека — шаг 2. Применяется ДО выката кода: прежний код
-- колонку не читает.

ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT '';

INSERT INTO settings (key, value) VALUES ('schema', '21') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

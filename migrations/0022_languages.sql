-- 061: язык человека и журнал на языке смотрящего (specs/061-i18n-languages/). users.lang (0021) — язык, выбранный
-- человеком; tg_lang — последний известный язык Telegram, приведённый к языку бота ('' — неизвестен); menu_lang — язык
-- кнопки меню, поставленной чату ('' — общая кнопка бота). audit.details_tx — подробности записи отложенным текстом
-- (JSON, '' — нет), details — прежний русский текст. Применяется ДО выката кода: прежний код новые колонки не читает.

ALTER TABLE users ADD COLUMN tg_lang TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN menu_lang TEXT NOT NULL DEFAULT '';
ALTER TABLE audit ADD COLUMN details_tx TEXT NOT NULL DEFAULT '';

INSERT INTO settings (key, value) VALUES ('schema', '22') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- 052: открытый бот — признак «название общее» у компании, которую создал человек (company.create). Его видят люди
-- компании; у прежних компаний — 0 (название видит только владелец бота, 051). Применяется ДО выката кода: прежний код
-- колонку не читает.

ALTER TABLE companies ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;

INSERT INTO settings (key, value) VALUES ('schema', '18') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

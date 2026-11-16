-- 031: индексы для подсчёта непрочитанных сообщений переписки («мои события»: человек — Санта или подопечный, не
-- прочитано). Только добавляет индексы: ни одна строка не меняется, повтор безопасен. Версию схемы (settings.schema = 11)
-- не меняет: код от индексов не зависит — бот работает и до этой миграции, и после, откат кода безопасен.

CREATE INDEX IF NOT EXISTS messages_unread_santa ON messages (santa, read_at);

CREATE INDEX IF NOT EXISTS messages_unread_ward ON messages (ward, read_at);

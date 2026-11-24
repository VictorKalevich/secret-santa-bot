-- 055: индексы для чтений API — обычный вызов находит свои компании, обращения, заявки и семьи, не просматривая таблицы
-- целиком: компании по владельцу (счёт своих компаний, запасной поиск владельца бота), обращения по автору (непрочитанное
-- на главном экране), открытые взятые обращения по ответственному, заявки человека в событии, семьи компании. Только
-- добавляет индексы: ни одна строка не меняется, повтор безопасен. Версию схемы (settings.schema = 18) не меняет: код от
-- индексов не зависит — бот работает и до этой миграции, и после, откат кода безопасен.

CREATE INDEX IF NOT EXISTS companies_owner ON companies (owner_id);
CREATE INDEX IF NOT EXISTS support_threads_user ON support_threads (user_id);
CREATE INDEX IF NOT EXISTS support_threads_taken ON support_threads (assignee) WHERE status = 'open' AND assignee != 0;
CREATE INDEX IF NOT EXISTS join_requests_event ON join_requests (event_id, user_id);
CREATE INDEX IF NOT EXISTS families_company ON families (company_id);

# Проверка и выкат 055

## Локально

```powershell
node --test tests/api-reads.test.mjs tests/cron-reads.test.mjs tests/migrations.test.mjs
node tests/bench/queries.mjs   # число запросов на действие — как до 055
npm run test:all               # перед слиянием
```

## Выкат (по команде владельца; «оба» — сначала второй, проверка, потом первый)

Миграция `0018` — только индексы, код от неё не зависит: порядок «миграция ↔ выкат» и откат кода безопасны. Копия базы
не обязательна (строки не меняются), но правило проекта — копия перед любой миграцией. Если `0017` (054) ещё не
применена, `migrations apply` применит обе по порядку.

```powershell
# второй бот
npx wrangler deployments list --env second                                   # Version ID — точка отката
npx wrangler d1 export secret-santa-db-2 --env second --remote --output "backup-secret-santa-db-2-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 migrations apply secret-santa-db-2 --env second --remote     # 0018_read_indexes.sql
npm run deploy:second
# первый бот — так же без --env second, база secret-santa-db, npm run deploy
```

После выката — открыть приложение в Telegram: главный экран, событие, панель организатора, «Семьи»; у владельца бота —
«Компании» (все компании на месте).

## Проверка планов на базе бота

Планы запросов (без данных людей) — по индексам, а не `SCAN` таблицы:

```powershell
npx wrangler d1 execute secret-santa-db-2 --env second --remote --command "EXPLAIN QUERY PLAN SELECT u.tg_id FROM company_members cm JOIN users u ON u.tg_id = cm.user_id WHERE cm.company_id = 1"
npx wrangler d1 execute secret-santa-db-2 --env second --remote --command "EXPLAIN QUERY PLAN SELECT 1 FROM join_requests WHERE event_id = 1 AND user_id = 1 AND status = 'rejected'"
npx wrangler d1 execute secret-santa-db-2 --env second --remote --command "EXPLAIN QUERY PLAN SELECT id FROM families WHERE company_id = 1"
```

Ожидается `SEARCH cm USING … (company_id=?)` и `SEARCH u USING INTEGER PRIMARY KEY`, `SEARCH join_requests USING INDEX
join_requests_event`, `SEARCH families USING INDEX families_company`.

Через сутки: `npx wrangler d1 info secret-santa-db-2 --env second` — `rows_read_24h` растёт с числом активных людей, а не
с размером бота.

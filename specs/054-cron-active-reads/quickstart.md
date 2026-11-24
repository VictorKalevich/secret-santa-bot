# Проверка и выкат 054

## Локально

```powershell
node --test tests/cron-reads.test.mjs tests/migrations.test.mjs
npm run test:all     # перед слиянием
```

## Выкат (по команде владельца; «оба» — сначала второй, проверка, потом первый)

Миграция `0017` — только индекс, код от неё не зависит: порядок «миграция ↔ выкат» и откат кода безопасны. Копия базы не
обязательна (строки не меняются), но правило проекта — копия перед любой миграцией.

```powershell
# второй бот
npx wrangler deployments list --env second                                   # Version ID — точка отката
npx wrangler d1 export secret-santa-db-2 --env second --remote --output "backup-secret-santa-db-2-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 migrations apply secret-santa-db-2 --env second --remote     # 0017_active_events_index.sql
npm run deploy:second
# первый бот — так же без --env second, база secret-santa-db, npm run deploy
```

## Проверка плана на базе бота

План запроса уведомлений в D1 (без данных людей) — первой строкой должен идти индекс идущих событий:

```powershell
npx wrangler d1 execute secret-santa-db-2 --env second --remote --command "EXPLAIN QUERY PLAN SELECT p.santa FROM events e CROSS JOIN pairs p ON p.event_id = e.id CROSS JOIN members w ON w.event_id = p.event_id AND w.user_id = p.ward JOIN users s ON s.tg_id = p.santa WHERE e.status = 'active'"
```

Ожидается `SCAN e USING INDEX events_active` (или `USING COVERING INDEX`), затем `SEARCH p …`, `SEARCH w …`, `SEARCH s …`.

Через сутки: `npx wrangler d1 info secret-santa-db-2 --env second` — `rows_read_24h` при тех же идущих событиях не растёт
от числа завершённых.

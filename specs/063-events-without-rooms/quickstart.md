# 063. Проверка и выкат

## Локально

```powershell
npm test               # быстрые тесты: event-owners, event-create, bot-owner, app-home, rights, atomic, api-refusals, migrations…
npm run test:e2e       # сквозной сценарий
npm run screenshots    # Chrome: checkHome (список, «Создать» внизу на 320 точках, обе темы), checkSettings, checkOrganizers,
                       # checkOpenBot (второй Worker с OPEN_BOT)
```

Ожидаемо: всё зелёное, в журнале Worker нет `budget exceeded`, нарушений CSP — 0.

## Выкат (каждый бот; «оба» — сначала второй, проверка, потом первый)

Команды — CLAUDE.md, «Боты». Миграция — **до** кода: прежний код (062) со схемой 24 работает.

1. `npx wrangler deployments list <env>` — запомнить Version ID (точка отката кода).
2. `npx wrangler d1 migrations list <db> <env> --remote` — ждёт `0024_events_without_rooms.sql`.
3. Копия базы: `npx wrangler d1 export <db> <env> --remote --output "backup-<db>-<дата>.sql"`.
4. `npx wrangler d1 migrations apply <db> <env> --remote`; `SELECT value FROM settings WHERE key = 'schema'` → `24`.
5. Проверка переноса (`npx wrangler d1 execute <db> <env> --remote --command "…"`):
   - `SELECT COUNT(*) FROM events WHERE owner_id = 0` → 0 (если владелец бота настроен);
   - `SELECT COUNT(*) FROM events e WHERE NOT EXISTS (SELECT 1 FROM event_admins a WHERE a.event_id = e.id AND a.user_id = e.owner_id) AND e.owner_id != 0` → 0;
   - `SELECT COUNT(*) FROM event_creations` = числу событий с `created_by != 0`.
6. `npm run deploy` / `npm run deploy:second`; `/app` → 200.
7. Сверка: `npx wrangler d1 execute <db> <env> --remote --file tools/rooms-reconcile.sql` — события, созданные прежним
   кодом между миграцией и выкатом. Повтор ничего не меняет.
8. Назвать новый и прежний Version ID.

## Проверка на iPhone (владелец)

- Первый бот: главный экран — список событий с ролями, «Завершённые» свёрнуты, внизу «🎄 Создать событие» (у владельца
  бота), ⚙️ → «Настройки» с разделом «Владелец бота»; в событии «Управление» → «Владелец и администраторы» — прежние
  администраторы на месте.
- Второй бот: новый человек без ссылки → имя → приложение → «Создать событие» → ссылка.
- Кнопка «Создать» не закрывает последнюю строку списка и видна над «домашней полосой».

## Откат

- Код: `npx wrangler rollback <Version ID> <env> -m "откат"` (база не меняется). Прежний код со схемой 24 работает; события,
  созданные после выката 063, в нём не видны (их `company_id = 0`), назначения администраторов после выката он не видит.
  Вернуть — выкатить 063 снова (данные на месте).
- База: Time Travel на момент до миграции (только с «да» владельца) — откатывает всё бота, в том числе новые события.

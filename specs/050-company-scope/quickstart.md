# Quickstart: проверка 050

## Быстрые тесты

```powershell
npm test
```

Главная проверка шага — **прежние тесты без правки ожиданий**: `api-refusals` (эталон не меняется), `queries` (таблица
`BASELINE` не меняется), `rights`, `secrecy`, `atomic`, `draw-golden`, `world` (`GET /app` побайтно). Правятся только
тесты устройства: `data-registry` (19 таблиц), `server-shape` (`company_id` — служебная колонка `events`), `api-table`
(признак `company`), `api-doc`, `snapshots` (семьи компании), `migrations` (0015).

Новое: `tests/companies.test.mjs` — две компании: отказ чужому администратору на каждом `admin.*`, списки без чужих
событий, людей и семей, сообщения только своим организаторам, семьи и прошлые пары не пересекают границу, права по
компаниям, владелец бота как гость, инварианты I1–I6.

## Перед слиянием

```powershell
npm run test:all     # быстрые + e2e
```

## Прежний код на новой схеме (FR-5040)

Проверяется один раз перед слиянием, в отдельной рабочей копии прежнего `main`:

```powershell
git worktree add ..\santa-old main
Copy-Item migrations\0015_companies.sql ..\santa-old\migrations\
cd ..\santa-old; npm ci; npm test
```

Ожидаемо падают только тесты устройства схемы прежнего кода (`data-registry` — число таблиц, `server-shape` — колонка
`company_id`, `migrations` — число файлов). Остальные — зелёные. После проверки: `git worktree remove ..\santa-old`.

Рабочая копия создаётся рядом с проектом, в `C:\ClaudeProjects\` файлы не кладутся: путь должен быть вне неё или внутри
папки проекта (например, `test-results\santa-old`).

## Выкат (владелец)

```powershell
npx wrangler deployments list                                # записать Version ID — точка отката
npx wrangler d1 export secret-santa-db --remote --output "backup-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 migrations apply secret-santa-db --remote    # 0015_companies.sql, схема 17
npm run deploy
npx wrangler d1 execute secret-santa-db --remote --file tools/companies-reconcile.sql   # сверка
```

Проверка после выката:

```powershell
npx wrangler d1 execute secret-santa-db --remote --command "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM company_members WHERE company_id = 1) AS people, (SELECT COUNT(*) FROM events WHERE company_id != 1) AS stray_events, (SELECT COUNT(*) FROM users u WHERE u.is_admin != (SELECT is_admin FROM company_members WHERE company_id = 1 AND user_id = u.tg_id)) AS admin_mismatch"
```

Ожидается: `users = people`, `stray_events = 0`, `admin_mismatch = 0`. Затем на iPhone: главный экран, своё событие,
панель «Управление», «Семьи», «Владелец и администраторы», журнал — всё как до обновления.

## Откат

Пока компания одна:

```powershell
npx wrangler rollback <Version ID прежней версии> -m "откат 050"
```

Прежний код работает на схеме 17. После повторного выката нового кода — снова сверка
(`tools/companies-reconcile.sql`): она перенесёт права, изменённые прежним кодом, и людей, вступивших за это время.

Если нужно вернуть и базу — восстановление из копии по README («Резервная копия и восстановление»).

# Quickstart 062: проверка и выкат

## Локально

```powershell
npm test            # в т.ч. tests/masks-families.test.mjs, migrations (0023 и сверка), api-refusals, swap, snapshots
npm run test:all    # перед слиянием: npm test и e2e
npm run screenshots # Chrome: checkNoMasksFamilies и прежние проверки
```

`tests/masks-families.test.mjs` проверяет на «мире» с данными 061 (семьи, маски, события до и после жеребьёвки, завершённое,
выключенное правило, вторая комната): после миграции — исключения ровно по правилу `data-model.md`, прежние исключения
целы, пары и переписка прежние, журнал и очередь не выросли, масок и семей нет; сверка повторно — 0 изменений; жеребьёвка,
вписывание и обмен не ставят членов бывшей семьи друг к другу; удалённые действия — отказ неизвестного действия; ответы,
сообщения бота и раскрытие — без маски; по склейке приложения — нет масок, раздела «Семьи», переключателя и подсказки.

## Выкат (по команде владельца)

Миграция `0023` поднимает схему до 23 — её применяют **в обе базы до выката кода** (новый код без неё не запустится: «схема
не готова»; прежний код с ней работает). Миграция переносит семьи в исключения, стирает маски и удаляет семьи. После выката
— **сверка** (то, что прежний код успел создать между миграцией и выкатом). Порядок — CLAUDE.md, раздел «Боты»; «оба» —
сначала второй.

Перед миграцией можно посмотреть, сколько данных затронет (только счётчики, без пар и имён):

```powershell
npx wrangler d1 execute <db> <env> --remote --command "SELECT (SELECT COUNT(*) FROM families) AS families, (SELECT COUNT(*) FROM family_members) AS people, (SELECT COUNT(*) FROM events WHERE families_on = 1) AS events_on, (SELECT COUNT(*) FROM pairs WHERE mask <> '') AS masks, (SELECT COUNT(*) FROM exclusions) AS exclusions"
```

1. Второй бот:
   - `npx wrangler deployments list --env second` — записать текущий Version ID (точка отката);
   - копия базы: `npx wrangler d1 export secret-santa-db-2 --env second --remote --output "backup-secret-santa-db-2-<дата>.sql"`;
   - `npx wrangler d1 migrations apply secret-santa-db-2 --env second --remote`;
   - схема: `SELECT value FROM settings WHERE key = 'schema'` → `23`; счётчики выше → `families` 0, `people` 0, `masks` 0,
     `exclusions` — не меньше, чем до миграции;
   - `npm run deploy:second`; `/app` отвечает 200;
   - сверка: `npx wrangler d1 execute secret-santa-db-2 --env second --remote --file tools/masks-families-reconcile.sql`.
2. Первый бот — то же без `--env second` (`--env=""` в Bash), база `secret-santa-db`.

## После выката (iPhone)

- Главный экран: в «Уведомлениях» сразу кнопки режима; раздела «Семьи» нет.
- Событие → «Управление» → «Исключения»: переключателя «Учитывать семьи» нет, бывшие семьи — строками «А ↔ Б».
- «Подопечный» — без кнопки маски; переписка — «Твой Тайный Санта».
- Журнал комнаты: прежние записи «👪 Семья сохранена» на месте.

## Откат

Код — `npx wrangler rollback <прежний Version ID> <env> -m "откат"`; база не меняется (схема 23 ≥ 22 — прежний код
работает). Семей после отката нет (исключения остаются), маски пустые. Вернуть семьи — только восстановлением базы из копии
или Time Travel (CLAUDE.md, «Боты»), с потерей всего, что было после миграции.

# Quickstart 056: проверка и выкат

## Локально

```powershell
npm test            # в т.ч. tests/auto-finish.test.mjs и migrations (0019)
npm run test:all    # перед слиянием: npm test и e2e
```

`tests/auto-finish.test.mjs` проверяет на «мире» открытого бота: правила А, Б, Г на границах (день до и день порога),
предупреждение одно (повторный шаг, два одновременных запуска), снятие отметки (дата в будущем, вступил участник),
завершение через 7 дней прежним сообщением, журнал `finish.warn`/`finish`, закрытый бот — без изменений, сброс снимает
отметку, планы запроса ежедневного шага без полных просмотров и 3 запроса в обычную минуту.

## Выкат (по команде владельца)

Миграция `0019` поднимает схему до 19 — её применяют **в обе базы до выката кода** (новый код без неё не запустится:
«схема не готова»; прежний код с ней работает). Порядок — как в CLAUDE.md, раздел «Боты»; «оба» — сначала второй.

1. Второй бот:
   - `npx wrangler deployments list --env second` — записать текущий Version ID (точка отката);
   - копия базы: `npx wrangler d1 export secret-santa-db-2 --env second --remote --output "backup-secret-santa-db-2-<дата>.sql"`;
   - `npx wrangler d1 migrations apply secret-santa-db-2 --env second --remote`;
   - `npx wrangler d1 execute secret-santa-db-2 --env second --remote --command "SELECT value FROM settings WHERE key = 'schema'"` → `19`;
   - `npm run deploy:second`; `/app` отвечает 200.
2. Первый бот — то же без `--env second` (`--env=""` в Bash), база `secret-santa-db`; поведение первого бота не меняется,
   миграция нужна, потому что код общий.

## После выката (второй бот)

- Наутро (после `REMINDER_HOUR`) в логах (`npx wrangler tail --env second`) нет `cron step failed`.
- Предупреждения, если подходящие события есть: в журнале события — `⏳ Предупреждение об автозавершении`.
- Проверка без ожидания — только на копии или тестовом событии: сдвинуть `created_at` тестового пустого события на 23 дня
  назад (`UPDATE events SET created_at = … , last_daily = '' WHERE id = …`) и дождаться ближайшей минуты.

## Откат

Код — `npx wrangler rollback <прежний Version ID> --env second -m "откат"` (база не меняется, прежний код колонку не
читает). Колонку удалять не нужно.

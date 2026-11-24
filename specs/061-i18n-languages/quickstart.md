# Quickstart 061: проверка и выкат

## Локально

```powershell
node tests/support/i18n-lang-check.mjs en   # словарь одного языка (ключи, подстановки, формы, длины, кириллица)
npm test            # в т.ч. i18n (все языки), i18n-languages (правило, выбор, профиль, журнал, игра на 10 языках)
npm run screenshots # Chrome: прежние проверки
node --test tests/i18n-languages.ui.mjs   # Chrome: en и zh — экраны без кириллицы, смена языка в «Профиле»
npm run test:all    # перед слиянием
```

## Выкат (оба бота — сначала второй, проверка, потом первый)

Миграция `0022_languages.sql` (колонки `users.tg_lang`, `users.menu_lang`, `audit.details_tx`, схема 22) — **до** выката
кода в каждую базу (новый код без неё не запустится, прежний с ней работает).

1. Второй бот (`--env second`, база `secret-santa-db-2`):
   - `npx wrangler deployments list --env second` — Version ID (точка отката);
   - копия базы: `npx wrangler d1 export secret-santa-db-2 --env second --remote --output "backup-secret-santa-db-2-<дата>.sql"`;
   - `npx wrangler d1 migrations apply secret-santa-db-2 --env second --remote` (0021, 0022 — если ещё нет);
   - `SELECT value FROM settings WHERE key = 'schema'` → `22`;
   - `npm run deploy:second`; `/app` → 200.
2. Проверка второго: `/start` от себя — ответ по-русски; профиль бота дойдёт за несколько обращений (`npx wrangler tail
   --env second` — нет `bot profile:` с ошибками, нет `i18n:`); `SELECT value FROM settings WHERE key = 'bot_profile'`
   — версия и число отправленных = 60 после нескольких обращений.
3. Первый бот — то же без `--env second` (`--env=""` в Bash), база `secret-santa-db`.

## После выката (владелец, iPhone)

- «Профиль» → «🌐 Язык» → English: экраны по-английски сразу; «Как в Telegram» — обратно по-русски.
- `/language` в боте — кнопки языков; выбор — ответ и меню на выбранном языке.
- Меню команд «/» — `/start`, `/language`, `/cancel` по-русски.

## Откат

Код — `npx wrangler rollback <прежний Version ID> <env> -m "откат"`; база не меняется (прежний код новые колонки не
читает). Профиль бота и кнопки меню чатов, поставленные новой версией, остаются (команда `/language` у прежней версии —
«не понимаю», как любой текст: бот покажет меню).

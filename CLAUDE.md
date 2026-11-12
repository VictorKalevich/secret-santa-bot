# CLAUDE.md — secret-santa-bot

Telegram-бот «Тайный Санта» для небольшой группы (все участники в Беларуси). Cloudflare Worker (бесплатный
тариф) + D1 + мини-приложение Telegram. Язык интерфейса и документации — русский.

## Обязательный процесс: Spec Kit

- Любое изменение поведения — через Spec Kit: `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. Скилы лежат в `.claude/skills/speckit-*`.
- Спецификации — источник истины: `specs/NNN-имя/` (spec.md, plan.md, research.md, data-model.md, contracts/,
  quickstart.md, tasks.md). Активная фича записана в `.specify/feature.json`.
- Конституция: `.specify/memory/constitution.md` — проверяй каждый план по всем принципам.
- Скрипты Spec Kit — PowerShell (`.specify/scripts/powershell/`), платформа разработчика — Windows.
- Код и спецификация не должны расходиться: поменял поведение — обнови spec/contracts в той же ветке.

## Фичи

| Ветка | Спецификация | Статус |
|---|---|---|
| `001-secret-santa-bot` | `specs/001-secret-santa-bot/` | реализовано (v1) |
| `002-admin-roles` | `specs/002-admin-roles/` | реализовано: владелец/админы, исправление цветов кнопок |
| `003-santa-ward-chat` | `specs/003-santa-ward-chat/` | реализовано: переписка, лимит 4000 символов |
| `004-event-reset` | `specs/004-event-reset/` | реализовано: полный сброс (владелец), меню участника, перенос на новый аккаунт |
| `005-events-history` | `specs/005-events-history/` | реализовано: эвенты (параллельно), история, завершение, кольцевая жеребьёвка |
| `006-fixes` | `specs/006-fixes/` | реализовано: исправления ревью (тайна при переносе, лимит CPU жеребьёвки, очередь, отметка блокировки), миграции D1 |

С 005 почти все действия привязаны к эвенту (`event_id`); актуальный контракт API — `specs/005-events-history/contracts/events.md`
(контракты 001–004 описывают поведение внутри одного эвента); изменения 006 — `specs/006-fixes/contracts/api-changes.md`.

## Технологии

- JavaScript ES2022, ES-модули, Cloudflare Workers (workerd); без рантайм-зависимостей и без сборщика.
- Wrangler 4 (dev/deploy), Cloudflare D1 (SQLite), Cron Triggers (раз в минуту).
- Telegram Bot API (webhook `/tg`) + Telegram Mini Apps (`/app`, подпись `initData`).
- Тесты: `node:test`; e2e — `wrangler dev` + `tests/mock-telegram.mjs`; скриншоты — `playwright-core` + Chrome.

## Команды

```powershell
npm test             # юнит + правила дизайн-системы (перед каждым коммитом)
npm run test:e2e     # сквозной сценарий (перед выкатом)
npm run screenshots  # визуальная проверка UI → test-results/
npm run dev          # локальный Worker
npm run deploy       # выкат в Cloudflare
```

## Структура

- `src/index.js` — маршруты: `/tg`, `/app`, `/api/*`, `/setup`, `scheduled`.
- `src/bot.js` — чат: `/start` (`inv_<код эвента>`/`adm_`), регистрация, меню со списком эвентов, ответы в переписку (`msg:<сторона>:<eid>`).
- `src/api.js` — API мини-приложения: почти все действия с полем `event` (контракт: `specs/005-events-history/contracts/events.md`).
- `src/game.js` — игровая логика по эвентам, очередь `outbox`, жеребьёвка/замены, завершение, сброс, перенос, напоминания.
- `src/draw.js` — чистые функции жеребьёвки (тестируются в Node); поиск ограничен бюджетом шагов (`DEFAULT_BUDGET`, лимит CPU).
- `src/cron.js` — уведомления об изменениях писем, ежедневные напоминания.
- `migrations/` — схема D1 (сейчас 6): `0001_initial.sql` (схема 005), `0002_fixes.sql` (`users.blocked_at`,
  `outbox.locked_until`, `events.draw_token`). Код таблицы не создаёт и не удаляет: `checkSchema` требует `REQUIRED_SCHEMA`.
  Новая схема → новый файл миграции + `REQUIRED_SCHEMA` в `src/db.js`.
- `src/db.js` — проверка схемы и запросы.
- `src/app.html` — мини-приложение; стили только из дизайн-системы.
- `design-system/` — `tokens.css`, `components.css`, `preview.html`, `README.md`.

## Жёсткие правила

1. **Тайна.** Никакой ответ API, кроме `ward.get` самому Санте, не содержит пар. Админ и владелец видят только статусы.
   Роли: владелец один (`settings.owner_id`, `resolveOwner`), только он назначает/снимает админов.
   Тексты уведомлений — без имени подопечного и без текста письма. Пользовательский текст — только через
   `textContent` / `escapeHtml`. Админ видит любой эвент (`event.get`), но `ward.get`/`chat.get` — только участникам.
   **Эвенты.** Данные одного эвента не влияют на другой. Завершённый эвент (`status='finished'`) — только чтение,
   кроме переписки в течение `CHAT_GRACE_MS` (7 суток); завершение необратимо, сброс завершённого запрещён.
   Кольцевая (`events.ring`) — без взаимных пар, в т.ч. при заменах (`src/draw.js`).
   Перенос участия на аккаунт админа/владельца запрещён (иначе админ получил бы чужие пары).
2. **Дизайн-система.** В `src/app.html` — только классы `ds-*`, без `style`, без сырых цветов и px. Базовые стили
   элементов в `components.css` — только через `:where()`. Новый элемент:
   токен → компонент в `components.css` → показ в `preview.html` → строка в `design-system/README.md`. Тест
   `tests/design-system.test.mjs` это проверяет.
3. **Лимит текста** — `MAX_CHARS = 4000` (`src/game.js`): письмо и сообщения переписки помещаются в одно сообщение Telegram (4096).
4. **Бесплатный тариф.** ≤ 10 мс CPU и ≤ 50 внешних запросов (вкл. D1) на вызов. Сообщения другим людям — только
   через `outbox` (`enqueueStmt` + `flushOutbox`), тяжёлые вычисления — на клиенте.
5. **Секреты** (`BOT_TOKEN`, `ADMIN_SECRET`) — только `wrangler secret put`; `.dev.vars`, `.env*` не коммитить.
6. **Файлы.** Проект живёт в `C:\ClaudeProjects\secret-santa-bot\`. В самой `C:\ClaudeProjects\` ничего не создавать.
7. **README.** Фича меняет установку, настройку, секреты, команды, роли или использование → правь `README.md` в той же
   ветке (отдельная задача в `tasks.md`). Владелец проекта ещё не выкатывал бота — README должен вести от нуля до работы.

## Git

- Основная ветка `main`; фичи — `NNN-короткое-имя` (создаёт `/speckit-specify` через расширение git).
- Перед коммитом — `npm test`. Одна логическая единица на коммит.

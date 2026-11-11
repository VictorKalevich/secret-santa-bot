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
- `src/bot.js` — чат: `/start` (`inv_`/`adm_`), регистрация, меню, анонимные сообщения.
- `src/api.js` — API мини-приложения (контракт: `specs/001-secret-santa-bot/contracts/mini-app-api.md`).
- `src/game.js` — игровая логика, очередь `outbox`, жеребьёвка/замены, напоминания.
- `src/draw.js` — чистые функции жеребьёвки (тестируются в Node).
- `src/cron.js` — уведомления об изменениях писем, ежедневные напоминания.
- `src/db.js` — схема D1 (создаётся автоматически) и запросы.
- `src/app.html` — мини-приложение; стили только из дизайн-системы.
- `design-system/` — `tokens.css`, `components.css`, `preview.html`, `README.md`.

## Жёсткие правила

1. **Тайна.** Никакой ответ API, кроме `ward.get` самому Санте, не содержит пар. Админ и владелец видят только статусы.
   Роли: владелец один (`settings.owner_id`, `resolveOwner`), только он назначает/снимает админов.
   Тексты уведомлений — без имени подопечного и без текста письма. Пользовательский текст — только через
   `textContent` / `escapeHtml`.
2. **Дизайн-система.** В `src/app.html` — только классы `ds-*`, без `style`, без сырых цветов и px. Базовые стили
   элементов в `components.css` — только через `:where()`. Новый элемент:
   токен → компонент в `components.css` → показ в `preview.html` → строка в `design-system/README.md`. Тест
   `tests/design-system.test.mjs` это проверяет.
3. **Бесплатный тариф.** ≤ 10 мс CPU и ≤ 50 внешних запросов (вкл. D1) на вызов. Сообщения другим людям — только
   через `outbox` (`enqueueStmt` + `flushOutbox`), тяжёлые вычисления — на клиенте.
4. **Секреты** (`BOT_TOKEN`, `ADMIN_SECRET`) — только `wrangler secret put`; `.dev.vars`, `.env*` не коммитить.
5. **Файлы.** Проект живёт в `C:\ClaudeProjects\secret-santa-bot\`. В самой `C:\ClaudeProjects\` ничего не создавать.
6. **README.** Фича меняет установку, настройку, секреты, команды, роли или использование → правь `README.md` в той же
   ветке (отдельная задача в `tasks.md`). Владелец проекта ещё не выкатывал бота — README должен вести от нуля до работы.

## Git

- Основная ветка `main`; фичи — `NNN-короткое-имя` (создаёт `/speckit-specify` через расширение git).
- Перед коммитом — `npm test`. Одна логическая единица на коммит.

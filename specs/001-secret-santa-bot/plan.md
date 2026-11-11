# Implementation Plan: Telegram-бот «Тайный Санта»

**Branch**: `001-secret-santa-bot` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-secret-santa-bot/spec.md`

## Summary

Закрытый Telegram-бот для небольшой группы: регистрация по приглашению, письмо Санте до 1000 слов
в мини-приложении Telegram, исключения и жеребьёвка (единый круг, иначе любое корректное распределение),
вкладка подопечного с подсветкой изменений, уведомления без спойлеров с задержкой, анонимные вопросы,
админ-панель без доступа к парам. Один Cloudflare Worker на бесплатном тарифе + база D1; интерфейс собран
из собственной дизайн-системы поверх темы Telegram. Обоснование выбора — [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022, ES-модули), среда Cloudflare Workers (workerd)

**Primary Dependencies**: нет рантайм-зависимостей; разработка — Wrangler 4 (CLI Cloudflare); Telegram Bot API
и Telegram Mini Apps (`telegram-web-app.js` подключается на странице)

**Storage**: Cloudflare D1 (SQLite) — таблицы `users`, `exclusions`, `pairs`, `history`, `settings`, `outbox`
([data-model.md](./data-model.md)); схема создаётся автоматически при первом запросе

**Testing**: `node:test` — юнит-тесты алгоритма жеребьёвки и проверка дизайн-системы; сквозной тест —
`wrangler dev` + имитация Telegram Bot API на Node + сценарий игры через webhook и API мини-приложения;
визуальная проверка мини-приложения — `playwright-core` + установленный Chrome (скриншоты)

**Target Platform**: Cloudflare Workers (бесплатный тариф); клиенты — Telegram на iOS, Android, Windows/macOS/Linux

**Project Type**: web-service (бот + API) с одностраничным мини-приложением

**Performance Goals**: ответ на действие пользователя < 1 с; рассылка 40 сообщений < 2 мин

**Constraints**: ≤ 10 мс CPU и ≤ 50 внешних запросов на вызов; ≤ 100 000 запросов/сутки; сообщение Telegram
≤ 4096 символов; без сборщика и без платных сервисов

**Scale/Scope**: одна игра, до ~40 участников, 4 вкладки мини-приложения, ~25 API-действий

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Как соблюдается | Статус |
|---|---|---|
| I. Тайна по умолчанию | `admin.state` не возвращает пар и текстов; письмо — только `admin.wishlist` после подтверждения в UI; пары отдаются только Санте (`ward.get`); уведомления без имён; аварийного просмотра нет | ✅ |
| II. Проще некуда | Вход через Telegram, регистрация по ссылке, письмо в мини-приложении, всё по-русски | ✅ |
| III. Спецификация до кода | spec → plan → tasks в `specs/001-secret-santa-bot/`, ветка `001-secret-santa-bot` | ✅ |
| IV. Только дизайн-система | `design-system/tokens.css` + `components.css`; страница использует только классы `ds-*`; тест `tests/design-system.test.mjs` | ✅ |
| V. Бесплатно и без сервера | Workers Free + D1; очередь `outbox` пачками ≤ 35; сравнение текстов на клиенте | ✅ |
| VI. Проверено до выката | `tests/draw.test.mjs`, `tests/e2e.test.mjs`, `tests/screenshots.mjs` | ✅ |

Повторная проверка после Phase 1: нарушений нет, Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/001-secret-santa-bot/
├── plan.md              # этот файл
├── research.md          # Phase 0: решения и альтернативы
├── data-model.md        # Phase 1: сущности и таблицы D1
├── quickstart.md        # Phase 1: как проверить, что всё работает
├── contracts/
│   ├── bot-chat.md      # диалоги и deep-link в чате с ботом
│   ├── mini-app-api.md  # JSON API мини-приложения
│   └── notifications.md # каталог сообщений бота
├── checklists/
│   └── requirements.md  # проверка качества спецификации
└── tasks.md             # Phase 2: задачи
```

### Source Code (repository root)

```text
src/
├── index.js        # точка входа Worker: /tg (webhook), /app, /api/*, /setup, scheduled
├── bot.js          # диалоги в чате: /start, регистрация, меню, анонимные сообщения
├── api.js          # JSON API мини-приложения (участник + админ)
├── game.js         # игровая логика: меню, рассылки, жеребьёвка, замены, напоминания
├── draw.js         # чистые функции жеребьёвки (без Cloudflare)
├── cron.js         # уведомления об изменениях, ежедневные напоминания, очередь
├── db.js           # схема и запросы D1
├── telegram.js     # Bot API, проверка initData, производные секреты
└── app.html        # мини-приложение (только классы дизайн-системы)

design-system/
├── tokens.css      # цвета, типографика, отступы, радиусы, тени, анимации
├── components.css  # компоненты ds-*
├── preview.html    # витрина всех компонентов
└── README.md       # правила использования

tests/
├── draw.test.mjs           # юнит-тесты жеребьёвки
├── design-system.test.mjs  # запрет «сырых» цветов/px в приложении, покрытие классов
├── e2e.test.mjs            # сквозной сценарий игры
├── harness.mjs             # общая обвязка: имитация Telegram + wrangler dev + помощники
├── mock-telegram.mjs       # имитация Telegram Bot API
└── screenshots.mjs         # скриншоты мини-приложения (playwright-core + Chrome)
```

**Structure Decision**: один проект (single project): Worker без сборщика + отдельная папка дизайн-системы,
которую Worker встраивает в страницу как текстовые модули (`[[rules]] type = "Text"` в `wrangler.toml`).

## Complexity Tracking

Нарушений Конституции нет.

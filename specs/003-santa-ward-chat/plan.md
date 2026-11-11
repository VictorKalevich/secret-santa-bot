# Implementation Plan: Переписка Санты и подопечного; лимит письма по символам Telegram

**Branch**: `003-santa-ward-chat` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-santa-ward-chat/spec.md`

## Summary

Новая таблица `messages` (переписка привязана к паре «Санта, подопечный»). API `chat.get` (история + отметка о прочтении),
`message.send` теперь сохраняет сообщение и ставит уведомление в очередь; ответ через бота (`↩️ Ответить`) пишет в ту же
переписку. В мини-приложении — экран переписки (шторка на весь экран) с пузырями сообщений, полем ввода и опросом новых
сообщений каждые 6 с; счётчики непрочитанных в `me`. Лимит письма и сообщения — 4000 символов (длина строки JS = UTF-16,
как считает Telegram). Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers

**Primary Dependencies**: без новых

**Storage**: D1 — новая таблица `messages` + индекс ([data-model.md](./data-model.md)); создаётся автоматически

**Testing**: e2e-сценарий переписки и лимитов, проверка дизайн-системы (новые компоненты), скриншоты переписки

**Target Platform**: как в 001

**Project Type**: web-service + мини-приложение

**Performance Goals**: новое сообщение у собеседника ≤ 10 с (опрос 6 с), уведомление ≤ 1 мин

**Constraints**: ≤ 50 внешних запросов на вызов; 100 000 запросов/сутки (опрос только пока переписка открыта)

**Scale/Scope**: 1 таблица, 1 новое API-действие, 1 экран, 4 компонента дизайн-системы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Как соблюдается | Статус |
|---|---|---|
| I. Тайна по умолчанию | Ответы `chat.get` без ID и имён собеседников; подопечный видит «Тайный Санта»; доступ только участникам пары; при смене пары история удаляется | ✅ |
| II. Проще некуда | Кнопки «💬 Написать Санте/подопечному», ответ прямо из уведомления | ✅ |
| III. Спецификация до кода | `specs/003-santa-ward-chat/`; FR-309 явно заменяет FR-007 | ✅ |
| IV. Только дизайн-система | Новые компоненты `ds-chat`, `ds-composer`, `ds-badge`, `ds-sheet--full` — сначала в дизайн-системе и витрине | ✅ |
| V. Бесплатно | Опрос только при открытой переписке; уведомления через `outbox` | ✅ |
| VI. Проверено до выката | e2e: переписка, непрочитанные, ответ через бота, изоляция пар, лимиты | ✅ |
| Процесс: README | Задача T313 | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/003-santa-ward-chat/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/chat.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/db.js        # таблица messages, индекс
src/game.js      # MAX_CHARS = 4000, сообщения: сохранение, уведомление, удаление при смене пар
src/bot.js       # sendAnonymous → сохраняет в переписку; лимит; кнопки уведомления
src/api.js       # chat.get; unread в me; лимит письма в символах
src/app.html     # экран переписки, кнопки с числом непрочитанных, счётчик символов, ?chat= из уведомления
design-system/   # ds-chat, ds-composer, ds-badge, ds-sheet--full (+ токены, витрина, README)
tests/           # e2e-сценарий переписки, обновлённые лимиты
README.md        # переписка, лимит 4000 символов
```

**Structure Decision**: прежняя структура.

## Complexity Tracking

Нарушений Конституции нет.

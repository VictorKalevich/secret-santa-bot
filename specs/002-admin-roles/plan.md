# Implementation Plan: Роли «владелец» и «администратор»; читаемость выбранных элементов

**Branch**: `002-admin-roles` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-roles/spec.md`

## Summary

Добавляем единственного владельца игры (`settings.owner_id`): ссылка `/setup` делает человека владельцем, только владелец
назначает/снимает админов и передаёт владение; админы не могут трогать роли и удалять админов/владельца. В мини-приложении —
раздел «Администраторы». Исправляем ошибку дизайн-системы: базовое правило `.ds-root button { color: inherit }` имело
бо́льшую специфичность, чем классы компонентов, и перебивало цвет текста кнопок и выбранной вкладки (в светлой теме —
чёрный на синем). Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers (как в 001)

**Primary Dependencies**: без новых зависимостей

**Storage**: D1 — новый ключ `settings.owner_id`; схема таблиц не меняется ([data-model.md](./data-model.md))

**Testing**: `node:test` (правило специфичности в `tests/design-system.test.mjs`), e2e-сценарий ролей
в `tests/e2e.test.mjs`, проверка вычисленных цветов в `tests/screenshots.mjs`

**Target Platform**: как в 001

**Project Type**: web-service + мини-приложение

**Performance Goals**: без изменений

**Constraints**: лимиты бесплатного тарифа (≤ 50 внешних запросов на вызов) — уведомления о ролях через `outbox`

**Scale/Scope**: 3 новых API-действия, 1 раздел UI, 1 правка CSS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Как соблюдается | Статус |
|---|---|---|
| I. Тайна по умолчанию | Роли не открывают пары; `admin.state` по-прежнему без пар и текстов; уведомления о ролях без данных игры | ✅ |
| II. Проще некуда | Назначение — выбор из списка + кнопка; роль видна чипом | ✅ |
| III. Спецификация до кода | Ветка и папка `002-admin-roles`; контракты 001 помечены ссылкой на изменения | ✅ |
| IV. Только дизайн-система | Раздел «Администраторы» из существующих компонентов; исправление цвета — в `components.css` + тест | ✅ |
| V. Бесплатно | Без новых сервисов; рассылка через очередь | ✅ |
| VI. Проверено до выката | e2e-сценарий ролей, проверка цветов на скриншотах | ✅ |

Повторная проверка после Phase 1: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-roles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── roles.md        # изменения API, чата и сообщений
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/game.js            # resolveOwner, setOwner, grant/revoke/transfer, защита удаления
src/api.js             # admin.role.grant / admin.role.revoke / admin.owner.transfer; is_owner в me/admin.state
src/bot.js             # ссылка adm_ → владелец; предупреждение прежнему владельцу; текст меню
src/index.js           # /setup: «ссылка владельца»
src/app.html           # раздел «Администраторы»; чипы ролей; скрытие 🗑 у владельца/админов для не-владельца
design-system/components.css  # базовые стили через :where(); подписи вкладок крупнее
design-system/README.md       # правило специфичности
tests/design-system.test.mjs  # тест правила специфичности
tests/e2e.test.mjs            # сценарий ролей
tests/screenshots.mjs         # проверка вычисленных цветов кнопок и вкладок
```

**Structure Decision**: тот же единый проект; новые модули не нужны.

## Complexity Tracking

Нарушений Конституции нет.

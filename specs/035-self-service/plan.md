# Implementation Plan: Участник сам меняет имя и выходит из события (035)

**Branch**: `035-self-service` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

## Summary

1. **Выход** — действие `event.leave` (участник, событие, в завершённом — отказ, слово `ВЫЙТИ`) и `leaveEvent` в
   `src/membership.js`: только до жеребьёвки; пакет `atomic` «по прежнему состоянию» (событие идёт, жеребьёвки нет,
   человек участник): сообщения организаторам со звуком и кнопкой «🛠 Открыть событие», журнал `member.leave`, данные
   участия по `REGISTRY` (`memberDataDeleteStmts`), строка участника — последней (захват). Без отметки «удалён».
2. **Имя** — действие `name.set` (зарегистрированный): правило `admin.rename` (общая константа), запись — `renameUser`
   (журнал `rename` только при изменении), ответ `{ name }`.
3. **Приложение** — «Профиль» на главном экране (`03-home`), раздел «Выход из события» внизу «Инфо» (`04-event`),
   общий помощник шторки со словом `typedSheet` (`07-sheet-chat`), «Опасная зона» (`05-admin`) — через него, подпись
   журнала `member.leave` (`06-vault-audit`).
4. **Документы и тесты** — `docs/api.md` (61 действие), эталон отказов — дополнение новыми ключами, счётчики действий в
   тестах, новые проверки поведения, одновременности, данных и приложения в Chrome; README, CLAUDE.md.

Решения — [research.md](research.md); контракт — [contracts/self-service.md](contracts/self-service.md); проверка —
[quickstart.md](quickstart.md). Новых данных нет (`data-model.md` не нужен): схема, `REGISTRY` и миграции не меняются.

## Technical Context

**Language/Version**: JavaScript ES2022 (Worker, мини-приложение), Node 22.15+ для тестов

**Primary Dependencies**: нет новых

**Storage**: D1 — схема не меняется; пишутся `users.name`, `audit`, `outbox`, удаляются строки участия по `REGISTRY`

**Testing**: `npm test` — новый файл `tests/self-service.test.mjs` (поведение обоих действий, тексты, сообщения,
журнал, возврат по ссылке, бот после выхода), `atomic` (+3: выход ×2 в одну миллисекунду, выход ↔ жеребьёвка в обоих
порядках записи), `data-registry` (выход: в событии не остаётся данных человека, кроме заявки), `api-table`, `rights`,
`api-doc`, `api-refusals` (61 действие, слово `ВЫЙТИ`), `app-ui` (шторка со словом — только `typedSheet`); Chrome —
`checkSelfService` в `tests/screenshots.mjs`; e2e — без изменений сценария (владелец ⊇ админ — только `admin.*`)

**Target Platform**: Cloudflare Workers (бесплатный тариф), Telegram Mini App (iOS WebKit, Android, ПК)

**Project Type**: веб-сервис + мини-приложение

**Performance Goals**: выход — 1 пакет чтений (контекст) + 1 пакет записи; имя — как `admin.rename`

**Constraints**: ≤ 10 мс CPU, ≤ 50 запросов на вызов; одно действие — один результат только через `atomic` (020);
сообщения — только через `outbox`; дизайн-система; слова — «событие»

**Scale/Scope**: `src/api.js`, `src/membership.js`; `src/app/03-home`, `04-event`, `05-admin`, `06-vault-audit`,
`07-sheet-chat`; тесты; `docs/api.md`, README, CLAUDE.md

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Выход — только до жеребьёвки: пар нет, ничего не перестраивается; сообщение и журнал — имя и название, без пар; смена имени пар не раскрывает (организатор и так видит состав и имена) | ✅ |
| II. Проще некуда | Имя и выход — в приложении, без обращения к организатору; слово `ВЫЙТИ` защищает от случайного нажатия | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `035-self-service`; `docs/api.md` — в той же ветке | ✅ |
| IV. Дизайн-система | Только существующие компоненты (`ds-section`, `ds-card`, `ds-btn--danger`, `ds-notice--error`, `ds-input`, шторка через `openSheet`); новых элементов нет | ✅ |
| V. Бесплатно | Один пакет записи; сообщения организаторам — через `outbox` (их немного) | ✅ |
| VI. Проверено до выката | Новые тесты падают на прежнем коде; `npm test`, e2e, скриншоты | ✅ |
| VII. Владелец | Новые действия — участника, не `admin.*`; владелец-участник выходит так же, как любой участник | ✅ |

Повторная проверка после дизайна — без изменений: нарушений нет, Complexity Tracking не нужен.

## Project Structure

```text
specs/035-self-service/
├── spec.md, plan.md, research.md, quickstart.md, tasks.md
├── contracts/self-service.md
└── checklists/requirements.md

src/api.js                    # name.set, event.leave; NAME_RULE — общий текст с admin.rename
src/membership.js             # leaveEvent (рядом с participate)
src/app/03-home.js.txt        # раздел «Профиль» и шторка «Твоё имя»
src/app/04-event.js.txt       # раздел «Выход из события» внизу «Инфо»
src/app/05-admin.js.txt       # «Опасная зона» — через typedSheet
src/app/06-vault-audit.js.txt # подпись member.leave
src/app/07-sheet-chat.js.txt  # typedSheet — шторка со словом
tests/self-service.test.mjs   # новый (+ в скрипт test в package.json)
tests/atomic.test.mjs, tests/data-registry.test.mjs, tests/api-table.test.mjs, tests/rights.test.mjs,
tests/api-doc.test.mjs, tests/api-refusals.test.mjs, tests/support/refusals-scenario.mjs,
tests/fixtures/api-refusals.json, tests/app-ui.test.mjs, tests/screenshots.mjs
docs/api.md, README.md, CLAUDE.md
```

**Structure Decision**: прежняя структура проекта; новая логика выхода — в модуле участия (`membership.js`), имени —
обработчик в таблице действий поверх `renameUser`.

# Implementation Plan: Мелкие правки поведения

**Branch**: `025-behavior-fixes` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/025-behavior-fixes/spec.md`; «Решения владельца» плана рефакторинга
(порядок 2026-11-14, пункт 3: слово «ОТКРЫТЬ» в API, «кто сделал» при переносе, журнал переименования, отклонение
заявки в завершённом событии).

## Summary

Четыре правки по месту (research R1–R4): служебный просмотр требует слово «ОТКРЫТЬ» полем `confirm` таблицы действий,
приложение передаёт введённое слово; роль `ACTOR` в `REGISTRY` переносится (`ACTOR_MOVED` упразднена), у старого
аккаунта остаётся только очередь; `admin.rename` пишет `rename` в общий журнал через `atomic` по прежнему состоянию
(новая `renameUser` в `src/panel.js`); `admin.request.decide` разрешено в завершённом событии только для отклонения,
приложение показывает заявки завершённого события с кнопкой «Отклонить». Эталон отказов — 10 изменённых ответов и 4
новых случая (R5); новый тест `tests/behavior.test.mjs` (R6).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; Node 24 (минимум 22.15) для тестов

**Primary Dependencies**: нет новых

**Storage**: D1 — схема не меняется (версия 11); меняется только правило переноса в `REGISTRY`

**Testing**: `npm test` (новый `behavior`; правки `atomic`, `data-registry`, `api-refusals` + эталон, сценарий
запросов), `npm run test:e2e` (слово в вызовах служебного просмотра)

**Target Platform**: Cloudflare Workers (бесплатный тариф) + мини-приложение Telegram

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: число запросов на вызов — прежнее (`tests/queries.test.mjs`; `admin.rename` — один пакет вместо
одного `UPDATE`, `admin.transfer` — тот же пакет с большим числом операторов)

**Constraints**: тайна (пар в ответах нет), слова (013), дизайн-система (новых элементов нет — только существующие
`ds-icon-btn`, `ds-hint`)

**Scale/Scope**: `src/api.js` (3 строки таблицы), `src/db.js` (`REGISTRY`, роли, `personTransferStmts`),
`src/panel.js` (`renameUser`), `src/app/05-admin.js.txt` (заявки), `src/app/06-vault-audit.js.txt` (слово, подпись
`rename`); тесты; `docs/api.md`, контракт и модель 018, `CLAUDE.md`, README, план рефакторинга

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Служебный просмотр получает серверную проверку слова — тайна сильнее; права (только владелец) и журнал — прежние. Перенос отметок «кто сделал» пар не касается; перенос на аккаунт админа и записи владельца — по-прежнему запрещён. Запись `rename` — без пар и писем. | ✅ |
| II. Проще некуда для участника | Заявитель в завершённом событии получает ответ из приложения так же, как кнопкой бота. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `025-behavior-fixes`; `docs/api.md`, контракт 018 — в той же ветке. | ✅ |
| IV. Только дизайн-система | В приложении — существующие классы (`ds-icon-btn`, `ds-hint`, `ds-card`); новых элементов нет. | ✅ |
| V. Бесплатно и без своего сервера | Число запросов прежнее; сообщения — через `outbox`. | ✅ |
| VI. Проверено до выката | Тесты до правки (падают), `npm test` ×3, e2e, скриншоты до слияния. | ✅ |
| VII. Владелец — максимальные права | Слово — подтверждение, а не ограничение прав (как СБРОС, УДАЛИТЬ, ОТМЕНА у владельца); владелец по-прежнему открывает служебный просмотр в любом событии. | ✅ |

Нарушений нет; Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/025-behavior-fixes/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

`data-model.md` и `contracts/` не нужны: схема прежняя; изменение правила переноса — поправка к контракту 018
(`specs/018-data-registry/contracts/data-registry.md`, `data-model.md`), API — `docs/api.md`.

### Source Code (repository root)

```text
src/api.js                       # vault.* — confirm; admin.rename → renameUser; admin.request.decide — finished: true
src/db.js                        # ACTOR переносится, ACTOR_MOVED упразднена, onTransfer у events/announcements/audit/families
src/panel.js                     # renameUser — atomic по прежнему состоянию, журнал rename
src/app/05-admin.js.txt          # requestNodes(): заявки в идущем и завершённом событии
src/app/06-vault-audit.js.txt    # confirm в запросах служебного просмотра; подпись rename
tests/behavior.test.mjs          # новый (025)
tests/atomic.test.mjs, tests/data-registry.test.mjs, tests/api-refusals.test.mjs, tests/fixtures/api-refusals.json,
tests/support/refusals-scenario.mjs, tests/support/queries-scenario.mjs, tests/e2e.test.mjs, package.json
docs/api.md, specs/018-data-registry/contracts/data-registry.md, specs/018-data-registry/data-model.md, CLAUDE.md,
README.md, docs/refactoring-roadmap.md
```

**Structure Decision**: правки по месту; общий конвейер проверок (019), помощник `atomic` (020) и список данных
`REGISTRY` (018) — без новых механизмов.

## Post-design Constitution Check

Схема, права и тексты людям прежние; добавлены одна проверка слова, одна запись журнала, перенос отметок «кто сделал»
и отклонение заявки в завершённом событии — все принципы выполнены.

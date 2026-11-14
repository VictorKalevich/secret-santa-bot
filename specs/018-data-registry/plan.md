# Implementation Plan: Один список данных события и человека

**Branch**: `018-data-registry` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-data-registry/spec.md`; шаг 3 плана рефакторинга
(`docs/refactoring/step-3-data-registry.md`), замеры `docs/refactoring/baseline.md` (разделы 3 и 4).

## Summary

В `src/db.js` появляется `REGISTRY` — описание всех 17 таблиц схемы: колонка события или родитель, колонки человека с
ролью («участник», «кто сделал», «кто сделал, переносится», получатель очереди, сама запись, «не человек»), якорь и
что делают с таблицей удаление события, уход участника и перенос. Из списка три построителя операторов
(`eventDataDeleteStmts`, `memberDataDeleteStmts`, `personTransferStmts`), каждый с условием `guard` как у
`enqueueIfStmt`; якорь — последний оператор. Пять мест (`deleteEvent`, `resetEvent`, `removeMember`,
`admin.participate` выкл, `transferAccount`) вызывают построители; `supportDeleteStmts`/`supportTransferStmts`
исчезают. Три дефекта закрываются условиями в момент записи: выход админа — «жеребьёвка не проведена» (исход — по
записи журнала), перенос — «старая запись ещё есть» (запись удаляется последней), удаление участника — «участник ещё в
событии» (уведомление, журнал, отметка — раньше удаления строки). Новый `tests/data-registry.test.mjs`: тест схемы в обе
стороны с проверками «от противного» и «после действия не остаётся строк» для пяти действий.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Workers/workerd); тесты — Node 24.21 (минимум 22.15)

**Primary Dependencies**: нет новых

**Storage**: D1 (SQLite), схема 11 без изменений; миграции не добавляются

**Testing**: `npm test` (`node:test`, «мир» `tests/support/world.mjs` на `node:sqlite`), новый
`tests/data-registry.test.mjs`, `tests/atomic.test.mjs` (снять три `todo: 'шаг 3'`), `tests/queries.test.mjs`;
`npm run test:e2e` перед слиянием

**Target Platform**: Cloudflare Workers, бесплатный тариф (10 мс CPU, 50 внешних запросов на вызов)

**Project Type**: веб-сервис (Worker) + мини-приложение; фича — внутренняя перестройка записи данных

**Performance Goals**: число запросов к базе на каждое из 46 действий сценария — не больше базового, к Telegram — то
же; построители — циклы по 17 записям, CPU незаметен

**Constraints**: ответы, тексты, получатели и порядок сообщений, журнал — прежние (FR-1801); схема и миграции —
прежние; перестройка пар (`applyPairsChange`, `removeFromAssignment`), версия пар (`pairsVersion`), эталон
жеребьёвки — не трогаются; захваты в сброс, объявления, напоминания и роли не добавляются; ссылки «кто сделал» при
переносе не переносятся; подстрока `DELETE FROM members WHERE event_id = ? AND user_id = ?` в операторе удаления
участника сохраняется (`beforeWrite` в `tests/atomic.test.mjs`)

**Scale/Scope**: `src/db.js` (+ список и построители ~150 строк, − два помощника обращений), правки `src/events.js`,
`src/pairs.js`, `src/roles.js`, `src/api.js`; новый тестовый файл; снятие трёх `todo`; документы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Построители только пишут; ни одного нового ответа API и чтения пар. Ответы пяти действий те же (`tests/secrecy.test.mjs` без правок). Перенос на аккаунт админа/владельца по-прежнему запрещён до записи (`src/api.js`), уведомления о переносе и удалении — без имён подопечных и текстов писем (тексты не меняются). Дефект 1 — сам по себе нарушение «одно действие — один результат», исправление не открывает статусов: отказ — прежний текст. | ✅ |
| II. Проще некуда для участника | Экраны и тексты те же; участник больше не теряет письмо при двойном переносе и не получает дубль «удалил тебя». | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `018-data-registry`. Внешние контракты не меняются; внутренний контракт — `contracts/data-registry.md`. Спецификации 012 и 014, где описан каскад, получают пометку «с 018 — из списка». | ✅ |
| IV. Только дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно и без своего сервера | Те же чтения и один `batch` на действие (`batch` = 1 запрос): `tests/queries.test.mjs` — не больше базовых чисел. Новых зависимостей нет. Операторов в `batch` столько же или на 1–3 больше (без влияния на лимит запросов). | ✅ |
| VI. Проверено до выката | Три дефекта получают проверки с навязанным чередованием (снятие `todo`); тест схемы и тест остатков — новые; e2e перед слиянием без правок. | ✅ |
| VII. Владелец — максимальные права | Права не меняются: перенос и сброс — только владелец, выход и удаление — как сейчас. `tests/rights.test.mjs` (46 действий × 3 роли) без правок. | ✅ |

Поправка Конституции не нужна: правило «Одно действие — один результат» и тайна только укрепляются.

**После Phase 1**: дизайн (`data-model.md`, `contracts/data-registry.md`) не добавил ни данных, ни внешних
интерфейсов; условия выполнения — только ужесточение существующих — все строки ✅.

## Project Structure

### Documentation (this feature)

```text
specs/018-data-registry/
├── spec.md
├── plan.md                        # этот файл
├── research.md                    # R1–R10
├── data-model.md                  # список: роли, 17 таблиц, политики, действия и условия, что остаётся
├── contracts/data-registry.md     # внутренний контракт: REGISTRY, построители, mergeMembership, условия
├── quickstart.md                  # как проверить: тесты, «от противного», запросы, поиск каскадов, e2e
├── checklists/requirements.md
└── tasks.md                       # /speckit-tasks
```

### Source Code (repository root)

```text
src/db.js            # REGISTRY + роли; eventDataDeleteStmts, memberDataDeleteStmts, personTransferStmts, mergeMembership;
                     # supportDeleteStmts/supportTransferStmts удалены
src/events.js        # deleteEvent, resetEvent — через eventDataDeleteStmts
src/pairs.js         # removeMember — memberDataDeleteStmts, условие «участник ещё в событии», исход — последний оператор
src/api.js           # admin.participate выкл — memberDataDeleteStmts с условием «жеребьёвка не проведена»
src/roles.js         # transferAccount — personTransferStmts с условием «старая запись ещё есть»
tests/data-registry.test.mjs   # новый: тест схемы (+ «от противного»), остатки после пяти действий
tests/atomic.test.mjs          # три todo 'шаг 3' сняты; комментарий шапки: 19 + 2 todo
package.json                   # новый файл в скрипте test
CLAUDE.md                      # таблица фич (018); src/db.js — список и построители; жёсткое правило про новые данные; tests/
docs/refactoring-roadmap.md    # статус шага 3
docs/refactoring/baseline.md   # раздел 1 — npm test после шага 3; раздел 4 — 19 «один результат», 8 дубль/порча
specs/012-insert-cancel-support/research.md, specs/014-fixed-pairs/data-model.md, specs/014-fixed-pairs/research.md
                               # пометка: каскад с 018 — из REGISTRY
```

**Structure Decision**: список и построители — в `src/db.js` (как требует файл шага; там же жили помощники обращений,
чтобы не было циклов импорта). Новых модулей `src/` нет. Новый тестовый файл добавляется в скрипт `test`
(`package.json` перечисляет файлы явно). README не меняется: установка, команды, роли и использование те же.

## Complexity Tracking

Нет нарушений.

# Implementation Plan: Захваты и снимки жеребьёвки

**Branch**: `020-claims-snapshots` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md) | **Статус**: выполнен (2026-11-14)

**Input**: Feature specification from `specs/020-claims-snapshots/spec.md`; шаг 5 плана рефакторинга
(`docs/refactoring/step-5-claims-snapshots.md`), замеры `docs/refactoring/baseline.md` (разделы 2, 3, 4).

## Summary

**Помощник захватов** — новый модуль `src/claim.js`: `atomic(db, cond, ...args)` — построитель пакета записи, где
условие и его параметры заданы один раз (выражение с закрытыми скобками, иначе ошибка), операторы идут в порядке
вызовов (`enqueue`, `audit`, `where`, `select`, `add`), `and()` расширяет условие для части операторов, `claim()`
отмечает оператор захвата, `run()` выполняет пакет и сообщает исход (research R2). Помощником собираются все атомарные
действия: жеребьёвка, обе отмены (одна функция `undoDraw`, R5), удаление и вписывание (версия пар), раскрытие,
завершение, удаление события, перенос, выход админа, решение по заявке, шесть действий обращений, «подарок получен»,
исключения (R1, R4).

**Захваты без метки времени** (R3): где «свой» захват узнавался по `now` (и автору), уведомления и журнал ставятся
**перед** изменением и проверяют прежнее состояние, которое изменение отменяет; исход — по захвату. Чинит два дефекта
(`ward.received` ×2, `admin.exclusion.add` ×2) и дубли при двойном нажатии одним человеком в одну миллисекунду во
взятии, передаче, закрытии обращения и решении по заявке. Фрагменты `THREAD`, `MINE_SENT` уходят.

**Снимки** — новый модуль `src/snapshots.js` (R6): четыре снимка парами «JS + SQL», суммы по модулю 2^52 и произведения
по модулю 1000003 (числа < 2^53 по построению), снимок исключений с произведением «дарящий × получатель» — различает
перестановку партнёров. `checkDraw` и `runDraw` берут их оттуда; тест паритета на случайных данных.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Workers/workerd); тесты — Node 24.21 (минимум 22.15)

**Primary Dependencies**: нет новых

**Storage**: D1 (SQLite), схема 11 без изменений; миграции не добавляются

**Testing**: `npm test` («мир» `tests/support/world.mjs` на `node:sqlite`): `tests/atomic.test.mjs` (−2 `todo`, +5
проверок `sameMoment`), новые `tests/snapshots.test.mjs` (паритет, «от противного», гонка) и `tests/claims.test.mjs`
(помощник, статическая проверка литералов SQL); `tests/unit.test.mjs` — импорт снимка семей из нового модуля;
`npm run test:e2e`; `npm run bench:draw` до и после; `node tests/bench/queries.mjs`

**Target Platform**: Cloudflare Workers, бесплатный тариф (10 мс CPU, 50 внешних запросов на вызов)

**Project Type**: веб-сервис (Worker) + мини-приложение; фича — внутренняя перестройка пакетов записи

**Performance Goals**: число запросов на действие — не больше чисел после 019 (операторы переставляются внутри тех же
пакетов, R10); `checkDraw` — без новых запросов, по одному проходу на список (было 4 прохода по исключениям)

**Constraints**: ответы, тексты, сообщения, журнал — прежние, кроме исправлений (FR-2001, FR-2009, FR-2013); надёжные
захваты — прежние признаки и порядок (FR-2003; запись `finish` — последней); `src/draw.js`, `src/outbox.js`,
`src/budget.js`, схема — не трогаются; эталон жеребьёвки не пересоздаётся; действиям без захвата захват не добавляется

**Scale/Scope**: новые `src/claim.js` (~70 строк), `src/snapshots.js` (~70 строк); правки `src/pairs.js` (жеребьёвка,
версия пар, отмены), `src/events.js` (раскрытие, завершение, удаление), `src/support.js` (6 действий, условия),
`src/membership.js` (заявка, выход), `src/participant.js` («получен»), `src/constraints.js` (исключения; снимки уходят),
`src/roles.js` (перенос); 2 новых тестовых файла, правки `tests/atomic.test.mjs`, `tests/unit.test.mjs`, `package.json`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы, тексты уведомлений и их получатели не меняются (тесты тайны `tests/secrecy.test.mjs` и эталон отказов — без правок). Условия уведомлений «по прежнему состоянию» повторяют все условия захвата — уведомление не уходит при несостоявшемся изменении (в том числе о взятии чужого обращения). Причина отказа жеребьёвки и тексты не меняются; снимок закреплённых пар и исключений — только в условии записи, наружу не отдаётся. Журнал — без пар, имён закреплённых пар, как прежде. | ✅ |
| II. Проще некуда для участника | Экраны и тексты те же; двойное нажатие больше не присылает второе одинаковое сообщение. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `020-claims-snapshots`; внутренний контракт — `contracts/claims-snapshots.md`; исправления записаны в спецификации (FR-2009, FR-2013), заметки — в спецификациях 012 (R6) и 014 (R6). | ✅ |
| IV. Только дизайн-система | Интерфейс и `src/app.html` не меняются. | ✅ |
| V. Бесплатно и без своего сервера | Пакетов и запросов столько же (`tests/queries.test.mjs`); CPU `checkDraw` не растёт (один проход на список, R6); `outbox` и отправка очереди не трогаются. | ✅ |
| VI. Проверено до выката | Новые проверки одновременных вызовов (пишутся первыми, падают на старом коде), паритет снимков, статическая проверка SQL; e2e и замер жеребьёвки перед слиянием. | ✅ |
| VII. Владелец — максимальные права | Права не меняются (таблица `ACTIONS` не трогается); владелец по-прежнему меняет исключения после жеребьёвки (условие «до жеребьёвки» для него — всегда истина, журнал — по наличию строк). Тест прав 46 × 3 зелёный без правок. | ✅ |

Поправка Конституции не нужна.

**После Phase 1**: дизайн (`data-model.md`, `contracts/claims-snapshots.md`) не добавил ни данных, ни внешних
интерфейсов; все строки ✅.

## Project Structure

### Documentation (this feature)

```text
specs/020-claims-snapshots/
├── spec.md
├── plan.md                         # этот файл
├── research.md                     # R1–R10
├── data-model.md                   # построитель, условия действий, снимки
├── contracts/claims-snapshots.md   # внутренний контракт: atomic(), два вида условий, снимки
├── quickstart.md                   # как проверить
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks
```

### Source Code (repository root)

```text
src/claim.js         # новый: atomic(db, cond, ...args) — построитель пакета; closedParens
src/snapshots.js     # новый: SNAPSHOTS (members, exclusions, families, fixed), drawSnapshot, snapshotGuard
src/pairs.js         # checkDraw/runDraw — снимки из snapshots.js, сборка atomic; pairsVersion → построитель;
                     # applyPairsChange пишет в построитель; undoDraw = cancelDraw + forceCancelDraw
src/constraints.js   # исключения: журнал по прежнему состоянию; снимки уходят в snapshots.js (familyExclusions остаётся)
src/events.js        # revealAll, finishEvent, deleteEvent — сборка atomic
src/support.js       # OPEN, LED_BY вместо THREAD/MINE_SENT; 6 действий — по прежнему состоянию
src/membership.js    # decideRequest — по прежнему состоянию; participate (выход) — atomic
src/participant.js   # setGiftReceived — уведомление перед отметкой
src/roles.js         # transferAccount — atomic
tests/claims.test.mjs     # новый: помощник + нет SQL с незакрытой скобкой в src/
tests/snapshots.test.mjs  # новый: паритет 4 снимков, перестановка, гонка с перестановкой
tests/atomic.test.mjs     # без todo; +5 проверок sameMoment
tests/unit.test.mjs       # снимок семей — из snapshots.js
package.json              # новые файлы в скрипте test
```

**Structure Decision**: помощник и снимки — отдельные модули верхнего уровня `src/` (тест слов читает только его;
`src/db.js` не растёт). README: установка, команды и роли не меняются; список быстрых тестов в README дополняется двумя
файлами (отдельная задача).

## Complexity Tracking

Нет нарушений.

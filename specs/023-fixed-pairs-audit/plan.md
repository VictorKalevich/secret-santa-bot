# Implementation Plan: Журнал закреплённых пар — одна запись на одно изменение

**Branch**: `023-fixed-pairs-audit` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/023-fixed-pairs-audit/spec.md`; research R9 фичи 020.

## Summary

`changeFixed` (`src/constraints.js`) пишет запись журнала `fixed.add`/`fixed.del` с условием только «жеребьёвка не
проведена» — поэтому запись появляется при каждом вызове. Исправление (research R1, R2): пакет собирается помощником
`atomic`; запись журнала идёт первой в пакете с условием «по прежнему состоянию» — для закрепления «хотя бы одна сторона
будет вставлена» (нет строки с этим Сантой и нет строки с этим подопечным), для удаления «хотя бы одна сторона есть»;
вставки и удаления — прежние операторы с условием «до жеребьёвки». Ответы, проверки, тексты, схема и число запросов не
меняются (R3). Тесты: 6 новых проверок одновременных вызовов и проверка повторов без изменений в
`tests/atomic.test.mjs`, ожидание числа записей в e2e 014 — 2 → 1 (R4). Документы — `docs/api.md`, `CLAUDE.md`, план
рефакторинга, замеры, память (R5).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; Node 24.21 (минимум 22.15) для тестов

**Primary Dependencies**: нет новых

**Storage**: D1 — схема не меняется (версия 11, `fixed_pairs`: первичный ключ `(event_id, giver)`, уникальный
`(event_id, receiver)`)

**Testing**: `npm test` (`tests/atomic.test.mjs` — новые проверки; прочие — без правок), `npm run test:e2e` (одно
ожидание в сценарии 014)

**Target Platform**: Cloudflare Workers (бесплатный тариф)

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: число запросов на `admin.fixed.add` — 6 к базе, 0 к Telegram (`tests/queries.test.mjs`); CPU —
без изменений (один пакет, те же чтения)

**Constraints**: меняется только `changeFixed` в `src/constraints.js`; ответы и тексты побайтно прежние (эталон
`tests/fixtures/api-refusals.json` не пересоздаётся); правило «одно действие — один результат» — через `atomic`

**Scale/Scope**: 1 функция в `src/`; 1 тестовый файл (+7 проверок), 1 ожидание в e2e; документы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Закреплённые пары по-прежнему видит и меняет только владелец; запись журнала — без имён и подробностей (её видят админы). Меньше записей — меньше косвенных сведений, новых нет. | ✅ |
| II. Проще некуда для участника | Участник ничего не замечает. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `023-fixed-pairs-audit`; `docs/api.md` правится в той же ветке. | ✅ |
| IV. Только дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно и без своего сервера | Число запросов то же (проверяет `tests/queries.test.mjs`), CPU — тот же порядок. | ✅ |
| VI. Проверено до выката | Новые проверки одновременных вызовов (до правки — падают), `npm test` и `npm run test:e2e` до слияния. | ✅ |
| VII. Владелец — максимальные права | Права не меняются: `admin.fixed.*` — владелец, админу 403. | ✅ |

Нарушений нет; Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/023-fixed-pairs-audit/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

`data-model.md` и `contracts/` не нужны: сущностей и интерфейсов не добавляется, поведение API описывает `docs/api.md`.

### Source Code (repository root)

```text
src/constraints.js          # changeFixed — пакет через atomic, журнал по прежнему состоянию
tests/atomic.test.mjs       # блок «закреплённые пары»: 6 одновременных случаев + повторы без изменений
tests/e2e.test.mjs          # сценарий 014: записей fixed.* после повтора — 1
docs/api.md                 # admin.fixed.add / admin.fixed.del и «Коды журнала»: «только при изменении»
CLAUDE.md                   # строка 023, changeFixed — не исключение, atomic — 32 проверки
docs/refactoring-roadmap.md # «Решения владельца»: ответ второму из одновременных закреплений с одним Сантой
docs/refactoring/baseline.md# раздел 4: проверки после 023
```

**Structure Decision**: правка одной функции и её тестов; остальное — документы.

## Post-design Constitution Check

Проектирование (R1–R5) не добавило таблиц, запросов, текстов и прав — все принципы выполнены, как выше.

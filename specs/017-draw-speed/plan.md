# Implementation Plan: Жеребьёвка быстрее при том же результате

**Branch**: `017-draw-speed` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/017-draw-speed/spec.md`; шаг 2 плана рефакторинга
(`docs/refactoring/step-2-draw-speed.md`), готовая правка `docs/refactoring/prototypes/draw-speedup.patch`, сверка
`docs/refactoring/prototypes/draw-equivalence.mjs`, замеры `docs/refactoring/baseline.md` (раздел 2).

## Summary

Две правки в `src/draw.js`, обе не трогают порядок вызовов `rng`: в `shuffle` перестановка через временную
переменную вместо деструктуризации (в непрогретом коде деструктуризация создаёт массив на каждую перестановку), а
функция правил из `pairRules` получает свойство `fillMatrix(ids, adj)`, которое заполняет матрицу допустимости по
спискам запретов и закреплённых пар вместо `n²` вызовов функции правил. `findAssignment` вызывает `fillMatrix`, если
оно есть, иначе — прежний перебор. Равенство доказывают эталон шага 1 (400 случаев), сверка двух вариантов файла
(6000 случаев) и новый тест «матрица `fillMatrix` = матрица перебора» на случайных правилах. Попутно — фиксированное
зерно в сценарии теста числа запросов (тест шага 1 падал в ~10% прогонов на неизменном коде). После приёмки прототипы
удаляются, замеры и статусы записываются в документы.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Workers/workerd); тесты и замеры — Node 24.21 (минимум 22.15)

**Primary Dependencies**: нет новых

**Storage**: D1 без изменений (схема 11); `src/draw.js` к базе не обращается

**Testing**: `npm test` (эталон `tests/draw-golden.test.mjs`, `tests/draw.test.mjs`), `npm run test:e2e`, замер
`npm run bench:draw`, сверка `draw-equivalence.mjs` (до удаления)

**Target Platform**: Cloudflare Workers, бесплатный тариф (10 мс CPU на вызов)

**Project Type**: веб-сервис (Worker) + мини-приложение; фича — внутренняя правка чистых функций

**Performance Goals**: холодная медиана `planDraw` на 200 человек — не менее −25% (было 5,69–6,08 мс); ни одна из
восьми медиан не растёт больше разброса двух прогонов «до»

**Constraints**: результат при том же зерне побайтно прежний (эталон не пересоздаётся); `git diff main -- src`
затрагивает только `src/draw.js`; `DEFAULT_BUDGET`, 30 случайных кругов, 5 попыток перебора, 60 паросочетаний,
порядок попыток `planDraw` — прежние; оптимизации 015 сохраняются (`Uint8Array`, `range` циклом, `Map<число, Set>`,
общий бюджет `planDraw`)

**Scale/Scope**: ~40 строк в `src/draw.js`, 1 новый тест в `tests/draw.test.mjs`, 1 правка
`tests/support/queries-scenario.mjs`, документы; удаление `docs/refactoring/prototypes/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | `src/draw.js` — чистые функции без ответа наружу. Пары при том же зерне те же, причины отказа те же: `fixed_block` по-прежнему без имён, остальные причины считаются без закреплённых пар (порядок попыток `planDraw` не меняется). API, тексты и журнал не меняются. | ✅ |
| II. Проще некуда для участника | Участник и организатор видят прежние экраны и тексты; жеребьёвка просто считается быстрее. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в этой ветке. Контракты API не меняются; внутренний контракт функции правил (`fillMatrix`) описан в `contracts/draw-rules.md`. | ✅ |
| IV. Только дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно и без своего сервера | Цель фичи — запас по лимиту 10 мс CPU: холодный вызов на 200 человек −25% и больше. Запросы к базе и Telegram не меняются (тест числа запросов, теперь детерминированный). Зависимостей нет. | ✅ |
| VI. Проверено до выката | Алгоритм покрыт прежними 42 юнит-тестами, эталоном (400 случаев) и новым тестом матрицы; сверка на 6000 случаях до удаления прототипа; e2e перед слиянием. Проверка перед коммитом перестаёт падать случайно. | ✅ |
| VII. Владелец — максимальные права | Права не затрагиваются; тест прав по 46 действиям остаётся зелёным. | ✅ |

Поправка Конституции не нужна.

**После Phase 1**: дизайн не добавил ни данных, ни внешних интерфейсов — все строки ✅.

## Project Structure

### Documentation (this feature)

```text
specs/017-draw-speed/
├── spec.md
├── plan.md                    # этот файл
├── research.md                # R1–R8
├── data-model.md              # матрица допустимости и правило «кто кому может дарить»
├── contracts/draw-rules.md    # внутренний контракт: функция правил, fillMatrix, findAssignment
├── quickstart.md              # как проверить: эталон, сверка, тест матрицы, замер
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
src/draw.js                          # shuffle без деструктуризации; pairRules → rule.fillMatrix; findAssignment
tests/draw.test.mjs                  # + тест: fillMatrix = перебор правил (люди не из списка, дубли, «самому себе»)
tests/support/queries-scenario.mjs   # фиксированное зерно Math.random на время сценария
tests/support/draw-cases.mjs         # комментарий: прототип сверки удалён
tests/d1-sqlite.test.mjs             # комментарий: ссылка на удалённый prototypes/README.md
docs/refactoring/prototypes/         # удаляется целиком (draw-speedup.patch, draw-equivalence.mjs, README.md)
docs/refactoring-roadmap.md          # статус шага 2, абзац о прототипах
docs/refactoring/baseline.md         # раздел 2: замеры «после», раздел 1: число тестов
CLAUDE.md                            # таблица фич (017), строка про src/draw.js
```

**Structure Decision**: меняется один файл `src/`; тестовые правки — в существующих файлах (`tests/draw.test.mjs`
уже в скрипте `test`, новый файл в `package.json` не нужен). README не меняется (установка, команды и роли те же).

## Complexity Tracking

Нет нарушений.

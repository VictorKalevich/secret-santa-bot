# Implementation Plan: Быстрые тесты всего Worker

**Branch**: `016-fast-tests` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-fast-tests/spec.md`; шаг 1 плана рефакторинга
(`docs/refactoring/step-1-fast-tests.md`), прототипы `docs/refactoring/prototypes/`, замеры `docs/refactoring/baseline.md`.

## Summary

Весь Worker (`src/index.js`) запускается в процессе `node --test` на подмене D1 поверх встроенного `node:sqlite` с
настоящими миграциями; `.html`/`.css` подключаются перехватчиком загрузки `module.registerHooks`, Telegram подменён
через `globalThis.fetch` с теми же правилами ответа, что HTTP-имитация e2e. Прототипы из `docs/refactoring/prototypes/`
переезжают в `tests/support/` и становятся тестами: тайна по значениям (перестановка пар, замена писем и адресов),
права ролей по всем 46 действиям `admin.*`, атомарность с навязанным чередованием (16 проверок + 5 `todo` с номером
шага), число запросов на действие против базового замера, эталон жеребьёвки (несколько сотен случаев с зерном), страница
`/app`. Замер скорости жеребьёвки — команда `npm run bench:draw`. В e2e — только регулярка автотеста прав и порог «ровно
46». `src/` не меняется.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; тесты — Node `^22.15.0 || >=23.5.0` (R1), у разработчика 24.21

**Primary Dependencies**: нет новых; встроенные `node:test`, `node:sqlite`, `node:module` (`registerHooks`)

**Storage**: D1 в проде без изменений (схема 11); в тестах — `node:sqlite` в памяти, схема из `migrations/*.sql`

**Testing**: `node --test` (`npm test`), e2e — `wrangler dev` + `tests/mock-telegram.mjs` (`npm run test:e2e`)

**Target Platform**: Cloudflare Workers (код приложения не меняется); тесты — Windows-ноутбук разработчика

**Project Type**: веб-сервис (Worker) + мини-приложение; эта фича — только тестовая обвязка и документы

**Performance Goals**: `npm test` целиком ≤ 5 с (SC-1601)

**Constraints**: `git diff main -- src` пуст (FR-1601); без зависимостей и поддельных таймеров (FR-1603); сценарии e2e
не сокращаются (FR-1602); пороги `< 10 мс` в `tests/draw.test.mjs` не ослабляются

**Scale/Scope**: ~8 новых файлов тестов и опор, 3 правленых тестовых файла, `package.json`, документы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Код не меняется. Тайна впервые проверяется по значениям: перестановка пар и замена писем/адресов не меняют ни одного ответа админу; поле `fixed` и `admin.fixed.*` админу недоступны; действия участника не-участнику — 403; тексты сообщений без имени подопечного и текста письма; взятое обращение — 403 третьему админу. | ✅ |
| II. Проще некуда для участника | Участник ничего нового не видит. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в этой ветке; поведение не меняется, контракты API не меняются (новый «контракт» — только интерфейс тестовой обвязки, `contracts/test-harness.md`). | ✅ |
| IV. Только дизайн-система | Интерфейс не меняется; тест `/app` проверяет, что страница собирается из `tokens.css` + `components.css`. | ✅ |
| V. Бесплатно и без своего сервера | Лимит 50 запросов на вызов проверяется на каждом действии сценария и на жеребьёвке 40 человек; журнал без `budget exceeded`. Рантайм-зависимостей нет, dev-зависимостей не добавляется. | ✅ |
| VI. Проверено до выката | Усиливается: тайна, права и атомарность — перед каждым коммитом за секунды; e2e остаётся перед выкатом и не сокращается. Алгоритм жеребьёвки дополнительно закреплён эталоном. | ✅ |
| VII. Владелец — максимальные права | Автотест прав находит все 46 действий (в e2e было 44) и проверяет каждое на свежем событии: владельцу ни одного 403, включая `admin.reset.full`, которое e2e не проверял. | ✅ |

Поправка Конституции не нужна (текст принципов VI и VII остаётся верным).

**После Phase 1**: проект не изменился — все строки ✅.

## Project Structure

### Documentation (this feature)

```text
specs/016-fast-tests/
├── spec.md
├── plan.md                    # этот файл
├── research.md                # R1–R10
├── data-model.md              # мир, эталон, базовые числа
├── contracts/test-harness.md  # интерфейс «мира» и подмены D1 для следующих шагов
├── quickstart.md
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
tests/
├── support/
│   ├── auth.mjs               # TOKEN, ADMIN_SECRET, initData — без child_process (из harness.mjs)
│   ├── telegram-rules.mjs     # чистая функция ответа Telegram (из mock-telegram.mjs)
│   ├── text-hooks.mjs         # .html/.css/.txt как текст (прототип)
│   ├── d1-sqlite.mjs          # подмена D1 на node:sqlite (прототип d1-shim.mjs)
│   ├── world.mjs              # весь Worker в одном процессе (прототип)
│   ├── draw-cases.mjs         # случаи эталона жеребьёвки и их сериализация (из draw-equivalence.mjs)
│   └── queries-scenario.mjs   # сценарий из 46 действий (из queries.mjs)
├── fixtures/
│   ├── make-draw-golden.mjs   # создаёт эталон от текущего src/draw.js (не пересоздавать в шагах плана)
│   └── draw-golden.json
├── bench/
│   ├── bench-draw.mjs, bench-draw-cold.mjs, draw-scenario.mjs   # npm run bench:draw
│   └── queries.mjs            # печать таблицы запросов (и SQL) — для шага 4
├── d1-sqlite.test.mjs         # свойства подмены D1
├── world.test.mjs             # страница /app, правила Telegram в «мире», ожидание waitUntil
├── secrecy.test.mjs           # тайна по значениям
├── rights.test.mjs            # права ролей по всем admin.*
├── atomic.test.mjs            # одновременные вызовы: 16 проверок + 5 todo
├── queries.test.mjs           # запросы на действие ≤ базовых, жеребьёвка 40 человек ≤ 50
├── draw-golden.test.mjs       # эталон жеребьёвки
├── unit.test.mjs              # правка: подмена из support вместо узнавания SQL по подстроке
├── harness.mjs                # правка: auth из support
├── mock-telegram.mjs          # правка: правила из support
└── e2e.test.mjs               # правка: регулярка [a-z._]+, ровно 46
package.json                   # test, bench:draw, engines.node
docs/refactoring/prototypes/   # остаются draw-speedup.patch, draw-equivalence.mjs, README.md
docs/refactoring-roadmap.md, docs/refactoring/baseline.md, README.md, CLAUDE.md
```

**Structure Decision**: всё новое — в `tests/` (опоры — `tests/support/`, данные — `tests/fixtures/`, замеры —
`tests/bench/`); `src/`, `migrations/`, `design-system/` не меняются. В `npm test` файлы перечисляются явно (как сейчас),
чтобы не подхватить `e2e.test.mjs`.

## Complexity Tracking

Нет нарушений.

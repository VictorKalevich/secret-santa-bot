# Implementation Plan: Мини-приложение по частям

**Branch**: `021-app-parts` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-app-parts/spec.md`; шаг 6 плана рефакторинга
(`docs/refactoring/step-6-app-split.md`), замеры `docs/refactoring/baseline.md` (раздел 1).

## Summary

`src/app.html` (1872 строки, один скрипт) разрезается без правки символов на восемь частей в `src/app/` по карте файла
шага: `01-shell.html`, `02-core.js.txt`, `03-home.js.txt`, `04-event.js.txt`, `05-admin.js.txt`,
`06-vault-audit.js.txt`, `07-sheet-chat.js.txt`, `08-start.html` (research R1, R2; пустая строка на шве — в начале
следующей части). Новый модуль `src/app-page.js` импортирует части по порядку и отдаёт их склейку и список
(`APP_PARTS`); `src/index.js` импортирует склейку вместо `./app.html`, вставка стилей прежняя (R3). Тесты дизайн-системы,
слов и страницы `/app` берут ту же склейку через `tests/support/app-source.mjs` (R4); новый `tests/app-parts.test.mjs`
защищает список, формат, разбор частей и один скрипт со `start()` последним (R5). Приёмка — побайтное равенство
склейки и страницы настоящего Worker прежним, сборка для выката, скриншоты попиксельно (R7, R8).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Workers/workerd); тесты — Node 24.21 (минимум 22.15)

**Primary Dependencies**: нет новых; wrangler 4.160.1 (правило `Text` — проектное для `.html`/`.css`, по умолчанию для
`.txt`)

**Storage**: D1 — не затрагивается; схема 11, миграций нет

**Testing**: `npm test` — правки `tests/design-system.test.mjs`, `tests/wording.test.mjs`, `tests/world.test.mjs`; новые
`tests/support/app-source.mjs`, `tests/app-parts.test.mjs`; `npm run test:e2e`, `npm run screenshots` — без правок;
приёмочные скрипты — `quickstart.md`

**Target Platform**: Cloudflare Workers (бесплатный тариф); мини-приложение — Telegram iOS (WebKit), Android, Desktop

**Project Type**: веб-сервис (Worker) + мини-приложение; фича — перенос файла без правок кода

**Performance Goals**: склейка — один раз при загрузке модуля (8 строк, 127 КБ); на CPU вызова не влияет; `npm test` —
в пределах прежнего времени

**Constraints**: страница побайтно та же (до вставки стилей и в ответе Worker); ни одного символа внутри частей;
один `<script>`, без модулей и сборщика; `wrangler.toml` не меняется; недочёты интерфейса не исправляются

**Scale/Scope**: 8 новых файлов частей (127 062 байта), `src/app-page.js` (~25 строк), `src/index.js` (1 строка),
удаление `src/app.html`; 3 правленых теста, 2 новых тестовых файла, `package.json` (скрипт `test`); документы — R9

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Сервер, API, тексты уведомлений не меняются; страница побайтно та же — приложение показывает ровно то же, что раньше (в том числе `textContent` для пользовательского текста). Тесты тайны (`tests/secrecy.test.mjs`) и эталон отказов — без правок. | ✅ |
| II. Проще некуда для участника | Вид и поведение приложения те же до байта — на iOS, Android и компьютерах; участник ничего не замечает. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `021-app-parts`; внутренний контракт — `contracts/app-parts.md`; `CLAUDE.md` и README — отдельной задачей. | ✅ |
| IV. Только дизайн-система | Правило действует для всех частей: `tests/design-system.test.mjs` проверяет склейку целиком, проверка «от противного» (`style=` в части 5) — при реализации. Правило 2 `CLAUDE.md` переформулируется: «в частях приложения (`src/app/`)». | ✅ |
| V. Бесплатно и без своего сервера | Без сборщика и зависимостей; склейка при загрузке модуля — не в CPU вызова; запросов к базе и Telegram столько же (`tests/queries.test.mjs` без правок). | ✅ |
| VI. Проверено до выката | `npm test` (с новым тестом частей), e2e, скриншоты, побайтное сравнение страницы настоящего Worker и сборки для выката до слияния. | ✅ |
| VII. Владелец — максимальные права | Права не меняются (`ACTIONS` не трогается), тест прав 46 × 3 — без правок. | ✅ |

Поправка Конституции не нужна (принцип IV называет тест, а не файл приложения).

**После Phase 1**: дизайн (`data-model.md`, `contracts/app-parts.md`) не добавил ни данных, ни внешних интерфейсов;
все строки ✅.

## Project Structure

### Documentation (this feature)

```text
specs/021-app-parts/
├── spec.md
├── plan.md                  # этот файл
├── research.md              # R1–R10
├── data-model.md            # части, модуль сборки, склейка в тестах
├── contracts/app-parts.md   # внутренний контракт: где что лежит, правила частей, как добавить часть
├── quickstart.md            # приёмка: сумма склейки, страница Worker, сборка, скриншоты, «от противного»
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/app/01-shell.html          # новые: части прежнего src/app.html, побайтно
src/app/02-core.js.txt
src/app/03-home.js.txt
src/app/04-event.js.txt
src/app/05-admin.js.txt
src/app/06-vault-audit.js.txt
src/app/07-sheet-chat.js.txt
src/app/08-start.html
src/app-page.js                # новый: импорт частей по порядку, APP_PARTS, склейка (default)
src/app.html                   # удаляется
src/index.js                   # import APP_HTML from './app-page.js'
tests/support/app-source.mjs   # новый: APP, PARTS, where(line) — склейка для тестов
tests/app-parts.test.mjs       # новый: список, формат, разбор, один скрипт, start() последним
tests/design-system.test.mjs   # app = склейка
tests/wording.test.mjs         # склейка вместо src/app.html; место нарушения — часть и строка
tests/world.test.mjs           # GET /app = склейка со стилями
tests/support/text-hooks.mjs   # только комментарий
tests/support/world.mjs        # только комментарий
package.json                   # tests/app-parts.test.mjs в скрипте test
```

**Structure Decision**: части — в отдельной папке `src/app/` (тест слов и статическая проверка SQL читают только
`src/*.js` верхнего уровня — части в них не попадают, а склейку тест слов получает явно); модуль сборки — рядом с
`src/index.js`, на верхнем уровне `src/`. README: установка, секреты, команды и роли не меняются — правятся строка
структуры папок и список проверок `npm test` (отдельная задача).

## Complexity Tracking

Нет нарушений.

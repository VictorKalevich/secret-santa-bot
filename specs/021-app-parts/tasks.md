---

description: "Task list for 021-app-parts"
---

# Tasks: Мини-приложение по частям

**Input**: Design documents from `specs/021-app-parts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/app-parts.md, quickstart.md

**Tests**: требуются спецификацией (FR-2110–FR-2113): проверки дизайн-системы, слов и страницы `/app` переводятся на
склейку, новый тест частей; проверки «от противного» — при реализации (quickstart, раздел 6).

**Organization**: по историям спецификации — US1 (части и склейка, Worker отдаёт ту же страницу, P1), US2 (проверки
дизайн-системы и слов по склейке, P1), US3 (тест частей, P2). Перед каждым коммитом — `npm test`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: история спецификации (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: замеры «до» для сравнения в конце

- [X] T001 Снять замеры «до» на `main` (`35bc60d`): `npm test` (164 теста, все прошли, 0,72–0,80 с), страница `/app` с
  `wrangler dev` через `tests/harness.mjs` (200, 153 719 байт, SHA-256 `b4ab9c8f…`), `npm run screenshots` ×2 (38 снимков,
  8 попиксельно одинаковых); записано в `specs/021-app-parts/research.md` (вступление, R8)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: части, модуль сборки и склейка для тестов — ими пользуются все истории

- [X] T002 Разрезать `src/app.html` на части в `src/app/` командой `sed -n 'A,Bp' src/app.html > src/app/<файл>` (Git
  Bash, LF сохраняется) по `data-model.md`: `01-shell.html` 1–25, `02-core.js.txt` 26–216, `03-home.js.txt` 217–512,
  `04-event.js.txt` 513–778, `05-admin.js.txt` 779–1433, `06-vault-audit.js.txt` 1434–1544, `07-sheet-chat.js.txt`
  1545–1838, `08-start.html` 1839–1872; проверить: `cat src/app/* | cmp - src/app.html` — без отличий, сумма 127 062 байта,
  каждая часть «кончается непустой строкой и ровно одним `\n`», части 3–8 начинаются с пустой строки
- [X] T003 Создать `src/app-page.js`: комментарий (что это, правила частей — ссылка на `specs/021-app-parts/contracts/
  app-parts.md`, почему не `.js`), восемь `import … from './app/<файл>'` по порядку, `export const APP_PARTS = [[имя файла,
  текст], …]` в том же порядке, `export default APP_PARTS.map(([, text]) => text).join('')`
- [X] T004 Создать `tests/support/app-source.mjs`: `import './text-hooks.mjs'`, затем динамический
  `import('../../src/app-page.js')`; экспорт `APP` (склейка), `PARTS` (`[{ name, text, start }]`, `start` — номер первой
  строки части в склейке, с 1), `where(line)` → `src/app/<имя>:<строка в части>`

**Checkpoint**: склейка из `src/app-page.js` побайтно равна `src/app.html` (quickstart, раздел 2 — сравнение с текущим
файлом); `npm test` зелёный (тесты ещё читают `src/app.html`)

---

## Phase 3: User Story 1 — Правка экрана — в файле своей области, страница та же (Priority: P1) 🎯 MVP

**Goal**: Worker отдаёт склейку частей; страница побайтно та же

**Independent Test**: quickstart, раздел 2 (`РАВНЫ`, SHA-256 `440b0db8…`); тест `/app` в `tests/world.test.mjs` сравнивает
ответ со склейкой; страница настоящего Worker — в Phase 6 (T014)

- [X] T005 [US1] `src/index.js`: строка 3 — `import APP_HTML from './app-page.js';` (комментарий у `APP_PAGE` — «склейка
  частей `src/app/`»); вставка стилей (строка 16) — без изменений
- [X] T006 [US1] `tests/world.test.mjs`, тест «/app: страница приложения со встроенной дизайн-системой»: эталон — `APP` из
  `tests/support/app-source.mjs` (вместо `read('src/app.html')`), метка `/*@design-system*/` в склейке есть, ответ =
  `APP.replace('/*@design-system*/', () => css)`
- [X] T007 [US1] Проверить quickstart, раздел 2 (против `git show 35bc60d:src/app.html`): `440b0db8… 127062 РАВНЫ`;
  `npm test` зелёный

**Checkpoint**: коммит «021 US1: mini app in eight parts, Worker serves their assembly (byte-identical page)»;
`src/app.html` ещё лежит — его читают тесты дизайн-системы и слов (US2)

---

## Phase 4: User Story 2 — Проверки дизайн-системы и слов видят весь собранный скрипт (Priority: P1)

**Goal**: все проверки, которые читали `src/app.html`, получают склейку; нарушение слов называет часть и строку

**Independent Test**: «от противного» — `style=` в части 5, «эвент» в части 5, «＋» в части 4 роняют тесты (T011)

- [X] T008 [P] [US2] `tests/design-system.test.mjs`: `const app = APP` (из `./support/app-source.mjs`) вместо
  `read('src/app.html')`; проверки те же; тексты сообщений «app.html» → «приложении» / «частях приложения»
- [X] T009 [P] [US2] `tests/wording.test.mjs`: проверка «эвент» — файлы `src/*.js` (теперь и `src/app-page.js`) и
  склейка `APP` одним текстом; место нарушения в склейке — `where(n)`; проверка «＋» — по склейке, место — `where(n)`
- [X] T010 [US2] Удалить `src/app.html` (`git rm`); `grep -rn "app\.html" src tests` — только комментарии об истории
  (или ничего)
- [X] T011 [US2] «От противного» (quickstart, раздел 6, первые три строки): по одной правке, `npm test` падает в нужном
  тесте с нужным местом, откат `git checkout -- src/app`; затем `npm test` зелёный

**Checkpoint**: коммит «021 US2: design-system and wording checks on the assembled page, src/app.html removed»

---

## Phase 5: User Story 3 — Порядок и цельность склейки защищены (Priority: P2)

**Goal**: быстрый тест ловит забытую или лишнюю часть, сломанный разбор, второй скрипт, `start()` не последним, CRLF/BOM

**Independent Test**: «от противного» на искусственных данных — в самом тесте; вручную — лишний файл и удалённая `}` (T013)

- [X] T012 [US3] Создать `tests/app-parts.test.mjs` (research R5) — чистые функции и их проверки: `listProblems(names,
  files)` (имена `^\d\d-[a-z0-9-]+\.(html|js\.txt)$`, номера подряд с `01`, каждый файл папки ровно один раз и по
  порядку), `partProblems(name, text)` (без `\r`, без BOM, не пустая, кончается `\n`, но не `\n\n`; `.js.txt` разбирается
  как тело функции — `new vm.Script('(function () {\n' + text + '\n})')`), `pageProblems(page)` (начало `<!doctype html>`,
  конец `  start();\n})();\n</script>\n</body>\n</html>\n`, один `<script src=…>`, один встроенный `<script>`, один
  `'use strict'`, встроенный скрипт разбирается целиком); «от противного» — каждая функция находит искусственную ошибку
  (CRLF, BOM, `\n\n` в конце, незакрытая скобка, пропущенный и лишний файл, второй `<script>`, оператор после `start()`);
  настоящие части — без замечаний, текст из `APP_PARTS` = файл на диске; добавить файл в скрипт `test` в `package.json`
- [X] T013 [US3] «От противного» вручную (quickstart, раздел 6, последние две строки): лишний `src/app/09-extra.js.txt` и
  удалённая `}` в `src/app/06-vault-audit.js.txt` роняют `tests/app-parts.test.mjs`; откат; `npm test` зелёный

**Checkpoint**: коммит «021 US3: parts test — list, format, parse, one script, start() last»

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 Приёмка: quickstart, раздел 3 — страница настоящего Worker = снятой на `main` (153 719 байт, `b4ab9c8f…`);
  раздел 4 — `npx wrangler deploy --dry-run --outdir` во временную папку: восемь текстовых модулей частей побайтно равны
  файлам (уточнить в quickstart, как они названы в сборке); раздел 5 — `npm run screenshots`, сравнение попиксельно с
  двумя прогонами «до» (8 стабильных снимков — «identical pixels»); `npm test` — 5 прогонов подряд (время)
- [X] T015 `npm run test:e2e` — зелёный без правок, в журнале нет `budget exceeded`
- [X] T016 [P] Комментарии: `tests/support/text-hooks.mjs` (`.txt` — части приложения `src/app/*.js.txt`, шаг 6 выполнен),
  `tests/support/world.mjs` (динамический импорт — «части приложения» вместо `app.html`)
- [X] T017 [P] Документы: `CLAUDE.md` (строка 021 в таблице фич; структура — `src/app/` с восемью частями и правилами,
  `src/app-page.js` вместо `src/app.html`, `src/index.js` — откуда склейка; жёсткое правило 2 — «в частях приложения
  (`src/app/`)»; тесты — `app-parts`, `support/app-source.mjs`; перехватчик понимает `.txt`); `design-system/README.md`
  (строки 4 и 79 — части приложения); `docs/refactoring-roadmap.md` (статус шага 6); `docs/refactoring/baseline.md`
  (раздел 1 — `npm test` и e2e после шага 6); статус `spec.md` и `plan.md` этой фичи
- [X] T018 [P] README: установка, секреты, команды и роли не меняются; строка `src/` в «Структуре» (мини-приложение —
  части `src/app/`, склейка — `src/app-page.js`) и пункт о мини-приложении в списке проверок `npm test`
- [X] T019 Память проекта: `refactoring-roadmap.md` — шаг 6 выполнен (021), дальше шаг 7 (документы)
- [X] T020 Слияние в `main` (`--ff-only`) и `git push` веток после зелёных `npm test` и `npm run test:e2e`; в отчёте —
  просьба к владельцу открыть приложение на iPhone после выката

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (части, модуль сборки, склейка для тестов) → US1 → US2 → US3.
- US2 после US1: `src/app.html` удаляется, только когда Worker и тест страницы уже на склейке.
- US3 после Phase 2 (нужны `APP_PARTS` и `tests/support/app-source.mjs`); от US2 не зависит, но идёт после неё, чтобы
  проверять папку без `src/app.html`.
- Polish — после всех историй; T014 и T015 — до слияния.

### Parallel Opportunities

- Phase 2: T003 и T004 — разные файлы (T004 использует экспорт T003, писать можно одновременно).
- US2: T008 и T009 — разные файлы.
- Polish: T016, T017, T018 — разные файлы; T014 и T015 можно запускать одновременно (разные порты `wrangler dev`).

## Implementation Strategy

1. MVP — Phase 2 + US1: части лежат по областям, Worker отдаёт ту же страницу.
2. US2 — проверки дизайн-системы и слов на склейке, `src/app.html` удалён.
3. US3 — тест частей защищает порядок и цельность при следующих правках.
4. Приёмка (страница Worker, сборка, скриншоты), e2e, документы, слияние.

---
description: "Задачи фичи 026 — недочёты интерфейса мини-приложения"
---

# Tasks: Недочёты интерфейса мини-приложения

**Input**: `specs/026-ui-fixes/` — spec.md, plan.md, research.md (R1–R8), contracts/app-ui.md, quickstart.md

**Tests**: обязательны (просьба пользователя): сначала проверка, которая падает на коде до правки, потом правка. Правила
по склейке — `tests/app-ui.test.mjs` (по образцу `tests/app-buttons.test.mjs`: функция находит нарушения, тест «нарушений
нет» и «от противного»); поведение в Chrome — `checkUiFixes` в `tests/screenshots.mjs`.

**Organization**: по историям spec.md; US1–US3 — P1, US4 — P2, US5 — P3. Все правки приложения — в частях `src/app/`
(одна склейка, общая область видимости), поэтому задачи одной части идут по порядку.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (другие файлы, нет зависимостей)
- **[Story]**: история spec.md (US1…US5)

---

## Phase 1: Setup

**Purpose**: снимки «до» и заготовка тестов

- [X] T001 Снять скриншоты на коде до правок: `npm run screenshots` на ветке `026-ui-fixes` до изменений `src/app/`, скопировать `test-results/*.png` в папку «до» во временной папке сеанса (scratchpad) — для сравнения в T030
- [X] T002 Создать `tests/app-ui.test.mjs`: импорт `APP`, `where` из `tests/support/app-source.mjs`; общие помощники — `lines(text)`, `block(text, re)` (тело по отступам: от строки начала до первой следующей строки с тем же отступом, начинающейся с `}` или `)`, — contracts/app-ui.md), `fnBody(text, name)` (верхнеуровневое `function name(` / `const name =` с отступом 2), `topLevelOwner(lines, i)` (имя ближайшего объявления верхнего уровня выше строки); добавить файл в скрипт `test` в `package.json` после `tests/app-buttons.test.mjs`

---

## Phase 2: Foundational

**Purpose**: обвязка проверок в браузере (нужна US1–US3)

- [X] T003 В `tests/screenshots.mjs` — `checkUiFixes()` после `checkSheetScroll(admin, A)`: событие «Проверка» (создать, «Я участвую», участник `people[4]` по ссылке), страница как в `checkSheetScroll` (без SDK Telegram, `initData` в адресе), список нарушений → `colorProblems` с пометкой «026:», итог `✔ недочёты интерфейса (026): …`; вызовы страниц — с таймаутами, сбой ожидания — нарушение, а не падение скрипта

**Checkpoint**: заготовки есть — истории можно делать по порядку

---

## Phase 3: User Story 1 — Панель показывает актуальные данные (P1) 🎯 MVP

**Goal**: после «Сохранить» панель тихо перестраивается (новое название во всех текстах, экран на месте); журнал,
«Опасная зона» и плашка «завершено» — из ответа своей панели (research R1, R2).

**Independent Test**: правила 1 и 2 `app-ui`; в Chrome — подтверждение «Удалить из события» с новым названием после
«Сохранить», панель события, завершённого со стороны, без «Полный сброс».

### Tests for User Story 1

- [X] T004 [US1] Правила 1 и 2 в `tests/app-ui.test.mjs`: `saveRebuilds(text)` — блок с `xapi('admin.game', values())` содержит `refresh(` или `again(`; `panelOwnData(text)` — в теле `renderAdmin` нет `state.ev`, `state.can`, `state.evId` (кроме `evId = state.evId`), `finished()`, `eapi(`, `finishedNotice()` без аргумента; тесты «нарушений нет» и «от противного»
- [X] T005 [US1] В `checkUiFixes` (`tests/screenshots.mjs`): (а) вкладка «Админ» события «Проверка» → поле «Название» = «Проверка — новое» → «Сохранить» → после «Сохранено» кнопка «Сохранить» в видимой области, «⋯» участника → «🗑 Удалить из события» — текст окна (`page.once('dialog')`, отказ) содержит ««Проверка — новое»»; (б) открытая панель → `admin.event.finish` запросом → «Инфо» → «Админ» → нет кнопки «Полный сброс», есть «Удалить событие» и текст «Событие завершено»
- [X] T006 [US1] Убедиться, что T004 и T005 падают на коде до правок (`node --test tests/app-ui.test.mjs`, `npm run screenshots`)

### Implementation for User Story 1

- [X] T007 [US1] `finishedNotice(e = state.ev)` в `src/app/04-event.js.txt`: плашка по событию `e` (`status`, `finished_at`, `chat_until`), строка переписки — по `state.can.chat_write`
- [X] T008 [US1] `renderAdmin` в `src/app/05-admin.js.txt`: параметр `{ quiet = false }` — без `showLoader()`, после `main.replaceChildren` прокрутка прежняя; `again(opts)`, `refresh(opts)` передают параметр; `finishedNotice(s)`; кнопка журнала — `openAudit(evId)`; «Опасная зона» — `done` вместо `finished()`; «Сохранить» параметров — после `admin.game` и `delete drafts.game` → `await refresh({ quiet: true })`, затем `haptic('success')`, `toast('Сохранено')` (только если панель ещё на экране)

**Checkpoint**: правила 1–2 зелёные; проверки (а), (б) в Chrome проходят

---

## Phase 4: User Story 2 — Шторки не мешают друг другу (P1)

**Goal**: заголовок «Обращение: …» — только своей шторке; опрос — только пока открыта своя (research R3).

**Independent Test**: правило 3 `app-ui`; в Chrome — заголовок журнала после задержанного ответа обращения.

### Tests for User Story 2

- [X] T009 [US2] Правило 3 в `tests/app-ui.test.mjs`: `sheetOwners(text)` — строки с `sheetEl` только в `openSheet`, `requestCloseSheet`, `closeSheet`, `poll`, `syncBack`, объявлении `let sheetEl` и строке с `BackButton.onClick`; `setInterval(` — только в `poll`; «от противного»
- [X] T010 [US2] В `checkUiFixes`: событие A, вкладка «Админ», `page.route('**/api/admin.support.get')` держит первый ответ → открыть обращение «Олег» → ✕ → дождаться панели → «📜 Журнал действий» → отпустить ответ → через 500 мс заголовок шторки — «Журнал события»
- [X] T011 [US2] Убедиться, что T009 и T010 падают на коде до правок

### Implementation for User Story 2

- [X] T012 [US2] `src/app/07-sheet-chat.js.txt`: `openSheet` возвращает `sheetEl` (заголовок — строка или узел); `poll(own, load)` — раз в 6 с `load().catch(() => {})`, пока `sheetEl === own`, иначе `clearInterval` себя, возвращает таймер; `openChat`, `openSupport`, `openSupportThread` — `const own = openSheet(...)`, `timer = poll(own, load)`; `openSupportThread` — заголовок `document.createTextNode('Обращение')`, в `load` — `titleText.data = 'Обращение: ' + t.name` (без поиска шторки)

**Checkpoint**: правило 3 зелёное; заголовок журнала прежний

---

## Phase 5: User Story 3 — Нет вечного загрузчика (P1)

**Goal**: сбой построения экрана → «Не получилось загрузить» с повтором; отказ после закрытия шторки не теряется
(research R4).

**Independent Test**: правило 4 `app-ui`; в Chrome — неполный ответ панели даёт экран ошибки (вкладка и закрытие
шторки обращения), повтор строит панель.

### Tests for User Story 3

- [X] T013 [US3] Правило 4 в `tests/app-ui.test.mjs`: `screensGuarded(text)` — нет `async function render`; в теле `render` есть `catch` и `showError`; в теле `closeSheet` есть `.catch(`; «от противного»
- [X] T014 [US3] В `checkUiFixes`: (а) событие «Проверка», `page.route('**/api/admin.state')` → `{"ok":true}` → вкладка «Админ» → за 3 с экран «Не получилось загрузить», загрузчика нет; снять подмену → «Попробовать снова» → панель («Журнал действий»); (б) событие A: открыть обращение, подменить `admin.state`, ✕ → экран ошибки, не загрузчик
- [X] T015 [US3] Убедиться, что T013 и T014 падают на коде до правок

### Implementation for User Story 3

- [X] T016 [US3] `src/app/03-home.js.txt`: `screen(build)` рядом с `showError` — `async (...args)`, отказ → `showError(e)`, если `state.nav` прежний; `render()` — тело вкладки/главного экрана в `try`, исключение → `showError(e)`
- [X] T017 [US3] `renderWard = screen(async ({ cached = false } = {}) => {…})` в `src/app/04-event.js.txt`; `renderAdmin = screen(async ({ quiet = false } = {}) => {…})` в `src/app/05-admin.js.txt`
- [X] T018 [US3] `closeSheet` в `src/app/07-sheet-chat.js.txt`: `onClose` — `new Promise((done) => done(cb())).catch((e) => toast('⚠️ ' + e.message))` (синхронное начало сохраняется)

**Checkpoint**: правило 4 зелёное; экран ошибки вместо загрузчика

---

## Phase 6: User Story 4 — Подтверждения не обрезаются (P2)

**Goal**: худший случай каждого подтверждения ≤ 250; длиннее — «…» (research R6).

**Independent Test**: правило 6 `app-ui` и «от противного» (длинный текст и подстановка без предела находятся).

### Tests for User Story 4

- [X] T019 [US4] Правило 6 в `tests/app-ui.test.mjs`: `CONFIRM_MAX` из склейки (нет — нарушение); сканер аргумента `confirmBox(` (строки, шаблоны с `${…}`); `worst(expr, ctx)` — строка, шаблон, `a || b`, `x ? a : b`, `plural(n, …)`, таблица пределов (имя 40, семья 40, название события 80, число 3 — contracts/app-ui.md), локальные `const`/`let` выше вызова и `x += …` между ними, `title` у `typed('…'`; подстановка без предела — нарушение; в теле `confirmBox` — обрезка с «…» и `CONFIRM_MAX`; «от противного»: текст 251 символ, подстановка `${u.secret}`, `confirmBox` со `slice(0, 250)`
- [X] T020 [US4] Убедиться, что T019 падает на коде до правок

### Implementation for User Story 4

- [X] T021 [US4] `src/app/02-core.js.txt`: `const CONFIRM_MAX = 250;` с комментарием (предел Telegram 256, тест `app-ui`); `confirmBox` — в окно Telegram текст длиннее предела уходит как `text.slice(0, CONFIRM_MAX - 1) + '…'`, `window.confirm(text)` — целиком

**Checkpoint**: правило 6 зелёное

---

## Phase 7: User Story 5 — Код без копий и с полным состоянием (P3)

**Goal**: `state.announcements` в начальном состоянии; одно поле ответа; один помощник правил пар — разметка и
поведение прежние (research R5, R7).

**Independent Test**: правила 5 и 7 `app-ui`; скриншоты панели, переписки и обращений до и после совпадают (кроме
времени).

### Tests for User Story 5

- [X] T022 [US5] Правила 5 и 7 в `tests/app-ui.test.mjs`: `stateDeclared(text)` — каждое `state.X` есть в литерале `const state = {…}`; `copies(text)` — `ds-composer__input`, разбор взаимных пар (`x.giver === ….receiver && x.receiver === ….giver`), `'и наоборот (в обе стороны)'`, `'Выбери двух людей'`, `'Нужны два разных человека'` — не больше одного раза; «от противного»
- [X] T023 [US5] Убедиться, что T022 падает на коде до правок

### Implementation for User Story 5

- [X] T024 [US5] `announcements: []` в `state` (`src/app/03-home.js.txt`)
- [X] T025 [US5] `src/app/07-sheet-chat.js.txt`: `composerParts` — в начало раздела переписки (перед `openChat`), комментарий «поле ответа: переписка и обращения»; `openChat` на `composerParts('Сообщение…')`: `setWritable` — `c.show(w)`, `closedNote.hidden = w`, при `!w` — `c.counter.hidden = true`; отправка — `c.clear(text)`, `.then(c.update)`; содержимое шторки — `c.composer, c.counter`; `beforeClose` — `c.ta`
- [X] T026 [US5] `renderAdmin` (`src/app/05-admin.js.txt`): `nameOf`, `rulePairs(rows)`, `ruleList(pairs, { empty, both, one, del })`, `ruleForm({ to, label, mutual, add })` перед блоком исключений; «Исключения» и «Закреплённые пары» — через них с прежними текстами, флажками (исключения — включён; закреплённые — выключен, при кольцевой строки нет — `syncFixed`), сообщениями, запросами (`admin.exclusion.add/del`, `admin.fixed.add` с `mutual: !s.ring && …`, `admin.fixed.del`) и порядком узлов

**Checkpoint**: все правила `app-ui` зелёные

---

## Phase 8: Polish & Cross-Cutting

- [X] T027 `npm test` — всё зелёное (в т.ч. `design-system`, `wording`, `app-parts`, `app-buttons`, `world`)
- [X] T028 `npm run screenshots` — код выхода 0, `✔ недочёты интерфейса (026)`, прежние проверки цветов, шторки, полей даты
- [X] T029 `npm run test:e2e` — зелёный
- [X] T030 Сравнить скриншоты «до» (T001) и «после» попиксельно: отличия — только тексты времени; места с отличиями просмотреть глазами
- [X] T031 [P] `docs/todo.md`: убрать «2. Недочёты интерфейса»; вступление раздела «Ждёт проверки на iPhone» — про оставшийся пункт (CSP)
- [X] T032 [P] `CLAUDE.md`: строка `026-ui-fixes` в таблице фич; тест `app-ui` в списке тестов; помощники частей (`screen`, `poll`, `composerParts`, правила пар, `CONFIRM_MAX`) в описании `src/app/`; «Отложено» — без «недочётов интерфейса»
- [X] T033 [P] README: проверить — установка, настройка, секреты, команды, роли и работа с ботом не меняются, правка не нужна (записать в отчёт)
- [X] T034 `spec.md`, `plan.md` — статус «Реализовано»; отметить задачи в `tasks.md`
- [X] T035 Коммиты (тесты и правки; документы; приёмка), слияние в `main` (`--ff-only`), `git push` веток — без выката

---

## Dependencies & Execution Order

- T001 — до любых правок `src/app/`.
- T002, T003 — до тестов историй.
- Истории — по порядку US1 → US2 → US3 → US4 → US5: они правят одни и те же части (`05-admin`, `07-sheet-chat`),
  параллельно — только тестовая часть внутри истории.
- Внутри истории: тесты → «падают» → правки.
- T017 (обёртка `renderAdmin`) — после T008 (параметр `quiet`); T026 — после T008 и T017.
- Phase 8 — после всех историй; T031–T033 — параллельно.

## Parallel Example

```text
# US1: правило в app-ui и проверка в Chrome — разные файлы
T004 tests/app-ui.test.mjs
T005 tests/screenshots.mjs
# Документы в конце
T031 docs/todo.md · T032 CLAUDE.md · T033 README (проверка)
```

## Implementation Strategy

- MVP — US1 (панель с актуальными данными): самый заметный недочёт перед необратимыми действиями.
- Дальше по одному пункту с проверкой: каждая история — свои правила и своя проверка в Chrome, отдельно проверяемы.
- Перед слиянием — `npm test`, e2e, скриншоты и сравнение «до/после»; выкат — владельцем по `quickstart.md`.

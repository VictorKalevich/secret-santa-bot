---
description: "Задачи фичи 027 — мелкие правки мини-приложения"
---

# Tasks: Мелкие правки мини-приложения (027)

**Input**: `specs/027-ui-tweaks/` — spec.md, plan.md, research.md (R1–R8), contracts/app-calendar.md, quickstart.md

**Tests**: как в 026 — сначала проверка, которая падает на коде до правки, потом правка. Правила по склейке —
`tests/app-tweaks.test.mjs` (функция находит нарушения, тест «нарушений нет» и «от противного»); поведение в Chrome —
`checkTweaks` в `tests/screenshots.mjs`.

**Organization**: по историям spec.md: US1 (P1) — календарь автожеребьёвки, US2 (P2) — подсказка названия, US3 (P3) —
отступ над «Вопрос решён». Правки приложения — в частях `src/app/` (одна склейка), дизайн-системы — в `design-system/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (другие файлы, нет зависимостей)
- **[Story]**: история spec.md (US1…US3)

---

## Phase 1: Setup

**Purpose**: снимки «до» и заготовка тестов

- [X] T001 Снять скриншоты на коде до правок: `npm run screenshots` до изменений `src/app/`, скопировать `test-results/*.png` в папку «до» во временной папке сеанса (scratchpad) — для сравнения в T024
- [X] T002 Создать `tests/app-tweaks.test.mjs`: импорт `APP` из `tests/support/app-source.mjs`, `readFileSync` для `design-system/components.css`; помощник `fnText(text, name)` — текст верхнеуровневой `function name(` (отступ 2) до строки `  }`; добавить файл в скрипт `test` в `package.json` после `tests/app-ui.test.mjs`

---

## Phase 2: Foundational

**Purpose**: обвязка проверок в браузере (нужна US1–US3)

- [X] T003 В `tests/screenshots.mjs` — `checkTweaks()` рядом с `checkDateFields(admin, B)` (событие A ещё не завершено): шаг на своей странице (без SDK Telegram, `initData` в адресе, сбой ожидания — нарушение, а не падение), нарушения → `colorProblems` с пометкой «027:», итог `✔ правки 027: …`

**Checkpoint**: заготовки есть — истории можно делать по порядку

---

## Phase 3: User Story 1 — Автожеребьёвка не включается случайно (P1) 🎯 MVP

**Goal**: у поля «Автожеребьёвка» свой календарь: месяц даты или текущий, без даты ничего не выделено, «Готово»
недоступна до выбора, «Сбросить» — при заданной дате, прошедшие дни бледные (research R1–R5).

**Independent Test**: правила 1–3 `app-tweaks`; в Chrome — календарь пустого поля без выделения и с бледной «Готово»,
выбор → «Готово» → «Сохранить» → дата на сервере, «Сбросить» → `''`.

### Tests for User Story 1

- [X] T004 [US1] Правила 1–3 в `tests/app-tweaks.test.mjs`: `autoDrawField(text)` — `f.draw_auto_date = ui.datePick(`, `event_date: ui.date(`, `deadline: ui.date(`; `calendarCells` — вычислить из склейки (`fnText(APP, 'calendarCells')` + `isoDay` → `Function`): ноябрь 2026 — 6 пустых клеток и 30 дней, февраль 2027 — 28 дней, 24 месяца подряд с ноября 2026: число пустых = `(new Date(y, m - 1, 1).getDay() + 6) % 7`, дни 1…N по порядку с `iso` `YYYY-MM-DD`; `doneGated(text)` — в `openCalendar` кнопка «Готово» создаётся с `disabled = !picked` и `disabled` снимается только в обработчике дня (`picked = …` рядом); тесты «нарушений нет» и «от противного» (поле через `ui.date`, «Готово» без `disabled`)
- [X] T005 [US1] В `checkTweaks` (`tests/screenshots.mjs`), событие B, вкладка «Админ»: поле `.ds-field` «Автожеребьёвка» → `button.ds-input--pick` с текстом «Не выбрана»; нажатие → шторка «Автожеребьёвка», заголовок календаря = текущий месяц и год (по `new Date()` в Node), `.ds-calendar__day--selected` нет, «Готово» `disabled`, «Сбросить» нет, «‹» `disabled`, вчерашний день (если он в этом месяце) `disabled`; «›» → следующий месяц, «‹» → обратно; день 15 следующего месяца → выделен один, «Готово» доступна; ✕ → поле «Не выбрана»; снова открыть → ничего не выделено; выбрать день 15 следующего месяца → «Готово» → шторки нет, поле «15 <месяц> <год>»; «Сохранить» → «Сохранено», `admin.state` → `settings.draw_auto_date` = эта дата; открыть → тот месяц, день выделен, «Готово» доступна, «Сбросить» → поле «Не выбрана» → «Сохранить» → `draw_auto_date` = `''`
- [X] T006 [US1] `checkDateFields` в `tests/screenshots.mjs`: системных полей даты два («вручение, письмо до»), проверка «Сбросить» закрывает календарь — на поле 2 (`nth(1)`)
- [X] T007 [US1] Убедиться, что T004–T006 падают на коде до правок (`node --test tests/app-tweaks.test.mjs`, `npm run screenshots`)

### Implementation for User Story 1

- [X] T008 [P] [US1] `design-system/components.css`: `.ds-input--pick` (`text-align: start; cursor: pointer; min-height` как у `.ds-input[type="date"]`), `.ds-input--placeholder` (`color: var(--ds-color-text-muted)`), раздел «Календарь (027)»: `.ds-calendar` (`user-select: none`), `.ds-calendar__title` (полужирный), `.ds-calendar__grid` (`display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--ds-space-1); margin-top: var(--ds-space-2)`), `.ds-calendar__weekday` (по центру, `--ds-text-xs`, приглушённо, `padding: var(--ds-space-1) 0`), `.ds-calendar__day` (`min-height: var(--ds-size-control)`, `border: 0`, `border-radius: var(--ds-radius-md)`, `background: transparent`, `cursor: pointer`, `font-variant-numeric: tabular-nums`), `--selected` (`--ds-color-accent` / `--ds-color-on-accent`, полужирный), `:disabled` (`--ds-opacity-disabled`, `cursor: default`); версия в заголовке — 1.5.0
- [X] T009 [P] [US1] `design-system/preview.html`: в демо полей — `button.ds-input.ds-input--pick` с датой и с «Не выбрана» (`ds-input--placeholder`); календарь месяца (`ds-calendar`: ряд «‹ Декабрь 2026 ›», дни недели, дни с бледными прошедшими и одним выбранным)
- [X] T010 [P] [US1] `design-system/README.md`: версия 1.5.0; в строку «Поля» — `--pick`, `--placeholder`; новая строка «Календарь» (`ds-calendar`, `__title`, `__grid`, `__weekday`, `__day` (+`--selected`)); правило полей даты — «системный календарь — `ui.date`, свой (автожеребьёвка) — `ui.datePick`»
- [X] T011 [US1] `src/app/02-core.js.txt`: `ui.datePick: (value, opts) => datePick(value, opts)`; после `closeOnReset` — `isoDay(y, m, d)`, `calendarCells(y, m)` (чистая), `datePick(value, { title, hint })` (кнопка `type="button"`, `ds-input ds-input--pick`, `value`, текст «D <месяц> YYYY» / «Не выбрана» + `ds-input--placeholder`; `set(iso)` — значение, текст, класс, `change` с `bubbles`; нажатие → `openCalendar`), `openCalendar(field, { title, hint })` по contracts/app-calendar.md (`picked`, `view`, нижний предел, `‹`/`›` — `ds-icon-btn` с `title`, сетка `ds-calendar__grid` — дни недели, пустые клетки, дни: `disabled` раньше сегодня, кроме даты поля; `--selected` + `aria-pressed`; «Готово» `disabled = !picked`; «Сбросить» — только при дате поля; `openSheet(title, [hint, календарь, «Готово», «Сбросить»])`, выбор → `set` + `closeSheet()`); рядом с `MONTHS` — `MONTHS_NOM`
- [X] T012 [US1] `src/app/05-admin.js.txt`: `f.draw_auto_date = ui.datePick(val('draw_auto_date'), { title: 'Автожеребьёвка', hint: 'В выбранный день бот сам проведёт жеребьёвку — в час ежедневных напоминаний.' })`

**Checkpoint**: правила 1–3 зелёные, календарь в Chrome ведёт себя по T005

---

## Phase 4: User Story 2 — Подсказка названия про ближайший Новый год (P2)

**Goal**: подсказка «Например: Новый год <год + 1> — семья» (research R6).

**Independent Test**: правило 4 `app-tweaks`; в Chrome — шторка «Новое событие».

- [X] T013 [US2] Правило 4 в `tests/app-tweaks.test.mjs`: `literalYears(text)` — подсказки (`placeholder: '…'`/`"…"`/`` `…` `` без подстановки) с годом `20\d\d` — нарушения; подсказка нового события — шаблон с `Новый год ${…}`, вычислить его выражение с подменённым `Date` (год 2026 → «Например: Новый год 2027 — семья», 2027 → «… 2028 …»); «от противного» — подсказка с «2026» находится
- [X] T014 [US2] В `checkTweaks` (`tests/screenshots.mjs`): главный экран владельца → «🎄 Создать» → `placeholder` поля названия = `Например: Новый год ${new Date().getFullYear() + 1} — семья`
- [X] T015 [US2] Убедиться, что T013–T014 падают на коде до правки
- [X] T016 [US2] `src/app/03-home.js.txt`: `` placeholder: `Например: Новый год ${new Date().getFullYear() + 1} — семья` ``

**Checkpoint**: правило 4 зелёное, подсказка в Chrome — следующий год

---

## Phase 5: User Story 3 — Кнопка «Вопрос решён» не прилипает к полю ввода (P3)

**Goal**: отступ `ds-sheet__action` над «✅ Вопрос решён» (research R7).

**Independent Test**: правило 5 `app-tweaks`; в Chrome — расстояние между полем ввода и кнопкой.

- [X] T017 [US3] Правило 5 в `tests/app-tweaks.test.mjs`: кнопка «✅ Вопрос решён» — с классом `ds-sheet__action`; в `components.css` `.ds-sheet__action { margin-top: X }` и `.ds-stack > * + * { margin-top: X }` — одно и то же `X`; «от противного» — кнопка без класса находится
- [X] T018 [US3] В `checkTweaks` (`tests/screenshots.mjs`): `people[3]` (открытое обращение в A) → «Инфо» → «Написать организатору» → `top(«Вопрос решён») − bottom(.ds-composer)` ≥ 12
- [X] T019 [US3] Убедиться, что T017–T018 падают на коде до правки
- [X] T020 [P] [US3] `design-system/components.css` (раздел «Шторка»): `.ds-sheet__action { margin-top: var(--ds-space-3); }` с комментарием; `design-system/preview.html` — в демо переписки под счётчиком `button.ds-btn.ds-btn--secondary.ds-btn--block.ds-sheet__action` «✅ Вопрос решён»; `design-system/README.md` — `ds-sheet__action` в строке «Поле сообщения»
- [X] T021 [US3] `src/app/07-sheet-chat.js.txt`, `openSupport`: `ui.btn('✅ Вопрос решён', 'secondary', 'ds-btn--block ds-sheet__action')`

**Checkpoint**: правило 5 зелёное, отступ в Chrome ≥ 12

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Снимки `29-auto-draw-calendar` (светлая и тёмная, событие B, вкладка «Админ», `before` — нажатие на поле «Автожеребьёвка») в `tests/screenshots.mjs`
- [X] T023 [P] `README.md`, «Инструменты организатора» → «Расписание»: «Автожеребьёвка» — свой календарь: день выбирается явно (пока не выбран, «Готово» недоступна), «Сбросить» снимает дату; сохраняется кнопкой «Сохранить»
- [X] T024 Прогон: `npm test`, `npm run test:e2e`, `npm run screenshots` (код выхода 0); сравнить снимки с «до» (T001) — отличия только в поле «Автожеребьёвка», подсказке названия, месте «Вопрос решён», новых снимках, текстах времени и коде приглашения
- [X] T025 `CLAUDE.md`: строка 027 в таблице фич; в «Структуре» — `02-core`: `ui.datePick`/`openCalendar`/`calendarCells`, у поля даты — системный (`ui.date`) или свой; тест `app-tweaks` в списке тестов
- [X] T026 Отметить задачи в `tasks.md`, статус в `spec.md` и `plan.md` — «реализовано»; `docs/todo.md` — нечего убирать (проверить)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → Polish. Истории независимы по коду (разные части и правила), но правят общие
  файлы (`tests/app-tweaks.test.mjs`, `tests/screenshots.mjs`, `components.css`, `preview.html`) — поэтому по порядку.
- Внутри истории: проверки (падают) → дизайн-система → приложение.
- T024 — после всех правок; T025–T026 — после T024.

## Parallel Opportunities

- T008, T009, T010 (дизайн-система US1) — разные файлы.
- T020 параллельна T021 (разные файлы), T022 и T023 — независимы.

## Implementation Strategy

MVP — US1 (календарь: единственная правка, от которой зависит, включится ли жеребьёвка). US2 и US3 — по строке кода
каждая, с проверкой. Коммиты: проверки и правки — одним коммитом на историю или общим «tests and fixes», как в 026;
документы — отдельным коммитом; приёмка — последним.

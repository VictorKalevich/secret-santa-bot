---

description: "Задачи 011: «Как это работает», тёмная тема системных элементов, прокрутка шторок"
---

# Tasks: Правки мини-приложения (011)

**Input**: `specs/011-ui-polish/` — plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: правила дизайн-системы расширяются проверками новых правил (SC-005); e2e не меняется (API тот же).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Поправка конституции 2.0.0 → 2.1.0 в `.specify/memory/constitution.md`: принцип I — «Участникам об этой
  возможности честно сказано в README; в приложении — по решению владельца проекта»; Sync Impact Report (2026-11-13),
  `Last Amended: 2026-11-13`

## Phase 2: Foundational

Нет — истории независимы.

## Phase 3: User Story 1 — читаемые выпадающие списки в любой теме (P1) 🎯 MVP

**Goal**: системные элементы в схеме темы Telegram; пункты списков — цвета дизайн-системы.

**Independent Test**: тёмная тема Telegram / тёмная колонка витрины — раскрытые списки и календарь тёмные, текст
читается без наведения; светлая — светлые.

- [X] T002 [US1] `design-system/tokens.css`: токен `--ds-color-scheme: var(--tg-color-scheme, light dark);` в блоке
  `:root, .ds-theme` (раздел цветов), версия 1.4.0 в шапке
- [X] T003 [US1] `design-system/components.css`: в «Основе» — `:where(:root, .ds-theme) { color-scheme: var(--ds-color-scheme); }`
  и `:where(.ds-root) :where(option, optgroup) { background-color: var(--ds-color-surface); color: var(--ds-color-text); }`
  (существующее правило `:where(.ds-root) :where(button, input, textarea, select)` не менять); версия 1.4.0
- [X] T004 [US1] `design-system/preview.html`: `--tg-color-scheme: dark` в `.pv-dark`, `--tg-color-scheme: light` для
  светлой колонки (`.pv-light` на `#light`); в демо полей — список с несколькими пунктами и поле `type="date"`

## Phase 4: User Story 2 — прокрутка внутри открытой шторки (P1)

**Goal**: пока открыта шторка, страница под ней не прокручивается; прокрутка не перетекает за край шторки/ленты.

**Independent Test**: открыть «🔐 Открыть служебный просмотр» / журнал / переписку, крутить колесо над шторкой и
фоном — страница стоит; после закрытия прокручивается и стоит там же.

- [X] T005 [US2] `design-system/components.css`: модификатор `.ds-root--locked { overflow: hidden; }` (раздел
  «Основа»); `overscroll-behavior: contain` у `.ds-sheet` и `.ds-chat`
- [X] T006 [US2] `src/app.html`: `openSheet` — `document.body.classList.add('ds-root--locked')` после вставки шторки;
  `closeSheet` — `document.body.classList.remove('ds-root--locked')` (единственное место; покрывает ✕, фон, «Назад»,
  закрытие кодом, смену шторки и переписку)
- [X] T007 [US2] `design-system/preview.html`: подпись у демо шторки о блокировке прокрутки страницы (`ds-root--locked`)

## Phase 5: User Story 3 — короткий блок «Как это работает» (P2)

**Goal**: три пункта из `contracts/ui.md`; раскрытие — в README.

**Independent Test**: вкладка «Инфо» любого эвента — ровно три пункта.

- [X] T008 [P] [US3] `src/app.html` (`renderInfo`, «Как это работает»): ровно три пункта — «Напиши письмо Санте — его
  увидит тот, кто будет дарить тебе подарок.», «После жеребьёвки во вкладке «Подопечный» появится, кому даришь ты.»,
  «После завершения эвента письмо остаётся для чтения, переписка открыта ещё 7 дней. Эвент сохранится в истории.»
- [X] T009 [P] [US3] `specs/010-owner-rights/spec.md`: у сценария 9 и FR-1015 пометка «текст «Как это работает» заменён
  спецификацией 011»

## Phase 6: Polish & Cross-Cutting

- [X] T010 `tests/design-system.test.mjs`: проверки — токен `--ds-color-scheme` с `--tg-color-scheme`, правило
  `color-scheme` на корне, `option` через `:where()`, `.ds-root--locked` и `overscroll-behavior` у `.ds-sheet`/`.ds-chat`,
  `openSheet`/`closeSheet` ставят/снимают `ds-root--locked`
- [X] T011 [P] `design-system/README.md`: версия 1.4.0; токен `--ds-color-scheme`; строки «Корень страницы»
  (`ds-root--locked`) и «Всплывающие» (прокрутка); правило про системные элементы и тему
- [X] T012 [P] `README.md` (Конституция: задача на README): абзац «Чужое письмо…» — без ссылки на «Инфо» →
  «Как это работает»; раскрытие служебного просмотра и открытия писем остаётся в README
- [X] T013 [P] `CLAUDE.md`: строка про честное раскрытие — «в README»; таблица фич — `011-ui-polish`
- [X] T014 `npm test`, `npm run screenshots` (визуально), `npm run test:e2e` перед выкатом

## Dependencies & Execution Order

- T001 — первым (конституция до кода).
- US1 (T002 → T003 → T004), US2 (T005 → T006 → T007), US3 (T008, T009) — независимы; US1 и US2 правят
  `components.css` и `preview.html` — делать последовательно.
- Polish: T010 после T003/T005/T006; T011–T013 параллельно; T014 — последним.

## Parallel Example

```text
T008 (app.html, «Инфо») ‖ T009 (spec 010) ‖ T012 (README) ‖ T013 (CLAUDE.md)
```

## Implementation Strategy

MVP — US1 (без него организатор в тёмной теме не может выбрать исключение). Затем US2, US3, Polish; один коммит
реализации + один коммит документации, выкат после `npm run test:e2e`.

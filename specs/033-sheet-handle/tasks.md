# Tasks: Драгер у каждой шторки (033)

**Input**: `specs/033-sheet-handle/` — spec.md, plan.md, research.md, contracts/sheet-handle.md, quickstart.md

**Tests**: да — правило дизайн-системы просит владелец (US3), поведение проверяется в Chrome; новые проверки сначала
падают на прежнем коде.

## Phase 1: Setup

- [X] T001 Спецификация, план, исследование, контракт, quickstart, задачи — `specs/033-sheet-handle/`; `.specify/feature.json`

## Phase 2: Foundational — правила (падают до правок)

- [X] T002 [P] Правило дизайн-системы «у каждой шторки драгер (033)» и «от противного» в `tests/design-system.test.mjs`
  (контракт, раздел «Проверки»)
- [X] T003 [P] Правило 7 «драгер и жест Telegram — в ядре шторки» и «от противного 7» в `tests/app-tweaks.test.mjs`
  (вместо «только у календаря»)
- [X] T004 [P] `sheetHandle` и `mayCloseSheet` — в списке ядра шторки `SHEET_CORE` в `tests/app-ui.test.mjs`
- [X] T005 Убедиться, что T002–T003 падают на прежнем коде (`npm test`) — проверки ловят «драгер только у календаря»

## Phase 3: User Story 1 + 2 — драгер у каждой шторки (P1) 🎯 MVP

**Goal**: у любой шторки (журнал, переписка, меню, календарь…) полоса сверху и свайп, как у календаря; несохранённое не
теряется; полоса видна у прокрученной шторки; жест Telegram выключен, пока открыта шторка.

**Independent Test**: журнал — свайп закрывает, короткий — нет, прокрученный — полоса у края; переписка с текстом —
вопрос, «Отмена» — на месте.

- [X] T006 [US1] Ядро шторки в `src/app/07-sheet-chat.js.txt`: `openSheet` → `sheetHandle(sheetEl)` и выключение жеста
  Telegram (`sheetSwipes`), `closeSheet` → включение; `mayCloseSheet()` и `requestCloseSheet()` через неё; `sheetHandle`
  переезжает сюда — закрытие после `mayCloseSheet()`, отказ — возврат на место, `closeSheet()` только при `sheetEl === own`
- [X] T007 [US1] `src/app/02-core.js.txt`: `openCalendar` — без своего жеста и `sheetHandle`; функция `sheetHandle`
  отсюда удалена
- [X] T008 [US1] `design-system/components.css`: `.ds-sheet__handle` — `position: sticky; top: 0`, `z-index:
  var(--ds-z-sticky)`, фон `--ds-color-bg`; `.ds-sheet--full` без `padding-top`; комментарии 028 → 033
- [X] T009 [US2] `checkSheetHandle` в `tests/screenshots.mjs` (контракт, «Проверки»): журнал, прокрученный журнал,
  меню участника, переписка без текста и с текстом («Отмена»/«ОК»), жест Telegram на заглушке SDK; вызов после
  `checkTweaks`

## Phase 4: User Story 3 — правило дизайн-системы (P2)

**Goal**: правило записано и видно в витрине.

**Independent Test**: `npm test` — `design-system` зелёный, «от противного» находит шторку в обход и второй драгер.

- [X] T010 [US3] `design-system/preview.html`: у каждой шторки (`ds-sheet`, в т.ч. `--full`) — `ds-sheet--handle` и полоса
  первым ребёнком
- [X] T011 [US3] `design-system/README.md`: строки «Всплывающие» и «Переписка» (драгер у всех шторок, sticky), правило в
  разделе «Правила»
- [X] T012 [US3] `CLAUDE.md`: строка 033 в таблице фич, жёсткое правило 2 (у каждой шторки драгер), структура
  (`02-core` без `sheetHandle`, `07-sheet-chat` — ядро шторки с драгером и жестом), тесты (`design-system`, `app-tweaks`
  правило 7, `checkSheetHandle`)

## Phase 5: Polish

- [X] T013 `npm test`, `npm run test:e2e`, `npm run screenshots` — зелёные; снимки шторок — с полосой; quickstart
  сверен
- [X] T014 Отметить задачи, статус spec «Реализовано», коммиты, push ветки `033-sheet-handle`

## Dependencies

- T001 → T002–T004 (параллельно) → T005 → T006 → T007 → T008 → T009; T010–T012 — после T008; T013 → T014.
- US1 и US2 — одна правка ядра (T006): драгер у всех шторок сразу, проверки разделены в T009.

## Implementation Strategy

MVP — Phase 3 (драгер у всех шторок, проверено в Chrome); затем правило и документы (Phase 4); всё в одной ветке и
одном выкате — сервер не меняется, откат безопасен.

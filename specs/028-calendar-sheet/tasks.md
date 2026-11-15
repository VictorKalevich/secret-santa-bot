---
description: "Задачи фичи 028 — шторка календаря автожеребьёвки"
---

# Tasks: Шторка календаря автожеребьёвки (028)

**Input**: `specs/028-calendar-sheet/` — spec.md, plan.md, research.md (R1–R4), contracts/calendar-sheet.md, quickstart.md

**Tests**: сначала проверки, которые падают на коде 027, потом правки (правила — `tests/app-tweaks.test.mjs`, поведение —
`checkTweaks` в `tests/screenshots.mjs`).

## Phase 1: Tests (падают до правок)

- [X] T001 [US1] `tests/app-tweaks.test.mjs`, правило 3 `doneGated`: вторая кнопка — `const reset = ui.btn(value ? 'Сбросить' : 'Закрыть', 'secondary'`; «от противного» — «Сбросить» только при дате находится
- [X] T002 [US2] Правило 6 `sixWeeks(css)`: `.ds-calendar__grid` — `grid-template-rows: auto repeat(6, var(--ds-size-control))`; «от противного»
- [X] T003 [US3] Правило 7 `handleRule(text)`: в `openCalendar` — `const own = openSheet(` и `sheetHandle(own)`; в `sheetHandle` — `ds-sheet__handle`, `setPointerCapture`, `pointerup`, `pointercancel`, `requestCloseSheet()`; жест Telegram — `disableVerticalSwipes` в `openCalendar` и `enableVerticalSwipes` в `onClose`; `openSheet` без `ds-sheet__handle` (другие шторки не меняются); «от противного»
- [X] T004 [US1] [US2] [US3] `checkTweaks` (`tests/screenshots.mjs`): без даты — «Закрыть» есть, «Сбросить» нет, «Закрыть» закрывает и поле «Не выбрана»; высота `.ds-sheet` одинакова на месяцах с 4, 5 и 6 неделями (ищутся листанием вперёд, до 24 месяцев); драгер `.ds-sheet__handle` есть; мышью вниз на 20 px — шторка открыта и без сдвига; на половину высоты — шторка закрыта, поле не изменилось
- [X] T005 Убедиться, что T001–T004 падают на коде 027 (правила `app-tweaks` 3, 6, 7 — падали; проверки в Chrome отдельно на коде 027 не гонялись — без «Закрыть» и драгера они падают на первых же шагах)

## Phase 2: Implementation

- [X] T006 [P] `design-system/tokens.css`: `--ds-size-handle-w: 36px; --ds-size-handle-h: 5px;`
- [X] T007 [P] `design-system/components.css` (v1.6.0): `.ds-calendar__grid` + `grid-template-rows`; раздел «Шторка»: `.ds-sheet--handle`, `.ds-sheet__handle` (+`::before`), `.ds-stack > .ds-sheet__handle + *`, `.ds-sheet--settle`
- [X] T008 [P] `design-system/preview.html` — шторка календаря с драгером; `design-system/README.md` — строки «Всплывающие» и «Календарь», версия 1.6.0
- [X] T009 `src/app/02-core.js.txt`: `openCalendar` — вторая кнопка всегда, `own = openSheet(…, { onClose })`, `sheetHandle(own)`, жест Telegram; `sheetHandle(own)` по contracts/calendar-sheet.md

## Phase 3: Polish

- [X] T010 [P] `README.md` («Расписание»): «Закрыть» без даты, свайп вниз за полоску сверху закрывает календарь
- [X] T011 [P] `CLAUDE.md`: строка 028, `sheetHandle` в описании полей даты, правила `app-tweaks`
- [X] T012 Прогон: `npm test`, `npm run test:e2e`, `npm run screenshots` (код 0); снимки `29-auto-draw-calendar` — глазами
- [X] T013 Статусы spec/plan, отметки задач, quickstart — итог

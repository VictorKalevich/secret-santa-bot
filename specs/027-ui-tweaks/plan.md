# Implementation Plan: Мелкие правки мини-приложения (027)

**Branch**: `027-ui-tweaks` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-ui-tweaks/spec.md`

## Summary

Три правки мини-приложения, сервер не меняется (research R1–R7). У поля «Автожеребьёвка» — свой календарь в шторке
(`ui.datePick` → `openCalendar`, ядро `02-core`): открывается на месяце заданной даты или на текущем, без даты ничего
не выделено, «Готово» недоступна до выбора дня, «Сбросить» — только при заданной дате, прошедшие дни бледные; поле —
кнопка со свойством `value`, поэтому «Сохранить» и черновик параметров работают как прежде. Подсказка названия нового
события — `Новый год ${год + 1} — семья`. Над «✅ Вопрос решён» — отступ нового элемента `ds-sheet__action`. Новые
элементы — в дизайн-системе (компонент → витрина → README). Проверки: `tests/app-tweaks.test.mjs` (правила по склейке и
`calendarCells`, «от противного») и `checkTweaks` в `tests/screenshots.mjs` (поведение в Chrome) — сначала падают,
потом правки (R8).

## Technical Context

**Language/Version**: JavaScript ES2022 (мини-приложение — один `<script>` из частей `src/app/`); Node 22.15+ для тестов

**Primary Dependencies**: нет новых (`playwright-core` уже есть — снимки и проверки в Chrome)

**Storage**: не меняется (D1, схема 11; `events.draw_auto_date` — прежний формат `YYYY-MM-DD` или `''`)

**Testing**: `npm test` (новый `tests/app-tweaks.test.mjs`), `npm run screenshots` (`checkDateFields` — два системных
поля, новый `checkTweaks`, снимки `29-auto-draw-calendar`), `npm run test:e2e` (без изменений)

**Target Platform**: мини-приложение Telegram (iOS — WebKit, Android, Desktop/Web — Chromium); локально — Chrome

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: запросов к серверу — столько же (календарь работает без сервера, дата уходит прежним
`admin.game` по «Сохранить»)

**Constraints**: дизайн-система (принцип IV: новые классы — компонент, витрина, README), слова (013: «событие», кнопки
без «＋»), части приложения (021: формат, разрез между объявлениями, `start()` последним), кнопки на время запроса (024 —
календарь запросов не делает), шторка и опрос — ядро (026: `sheetEl` не трогать)

**Scale/Scope**: `src/app/02-core.js.txt` (`ui.datePick`, `datePick`, `openCalendar`, `calendarCells`, `isoDay`,
`MONTHS_NOM`), `03-home.js.txt` (подсказка), `05-admin.js.txt` (поле автожеребьёвки), `07-sheet-chat.js.txt` (класс
кнопки); `design-system/components.css`, `preview.html`, `README.md`; тесты; `README.md`, `CLAUDE.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы сервера и что видит каждая роль — прежние; календарь показывает только дату события, которую организатор и так видит. Тексты — через `h()` (текстовые узлы). | ✅ |
| II. Проще некуда для участника | Автожеребьёвка не включается случайно; календарь на русском, неделя с понедельника; «Вопрос решён» не прилипает к полю; подсказка не устаревает. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `027-ui-tweaks`; README и `CLAUDE.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | Новые `ds-input--pick`, `ds-input--placeholder`, `ds-calendar*`, `ds-sheet__action` — из токенов (новых токенов нет), показаны в `preview.html`, строки в `design-system/README.md`; тест `design-system` — по склейке. | ✅ |
| V. Бесплатно и без своего сервера | Сервер не меняется; лишних запросов нет. | ✅ |
| VI. Проверено до выката | Новые проверки падают до правок; `npm test`, e2e, скриншоты; проверка на iPhone по `quickstart.md` с откатом. | ✅ |
| VII. Владелец — максимальные права | Права не меняются: «Параметры» — как раньше, владельцу и админам. | ✅ |

Нарушений нет; Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/027-ui-tweaks/
├── spec.md
├── plan.md
├── research.md
├── contracts/app-calendar.md   # поле и шторка календаря, классы дизайн-системы, подсказка, отступ, проверки
├── quickstart.md               # проверки, выкат, шаги на iPhone, откат
├── checklists/requirements.md
└── tasks.md
```

`data-model.md` не нужен: данных и схемы фича не меняет (`draw_auto_date` — прежний формат).

### Source Code (repository root)

```text
src/app/02-core.js.txt        # ui.datePick, datePick, openCalendar, calendarCells, isoDay, MONTHS_NOM
src/app/03-home.js.txt        # подсказка «Новый год ${год + 1} — семья»
src/app/05-admin.js.txt       # f.draw_auto_date = ui.datePick(...)
src/app/07-sheet-chat.js.txt  # «✅ Вопрос решён» + ds-sheet__action
design-system/components.css  # ds-input--pick, ds-input--placeholder, ds-calendar*, ds-sheet__action; версия 1.5.0
design-system/preview.html    # поле с календарём, календарь месяца, кнопка под полем ввода
design-system/README.md       # строки таблицы, правило полей даты, версия 1.5.0
tests/app-tweaks.test.mjs     # новый: правила по склейке, calendarCells, подсказка, отступ + «от противного»
tests/screenshots.mjs         # checkDateFields — два поля; checkTweaks; снимки 29-auto-draw-calendar
package.json                  # app-tweaks — в скрипт test
README.md                     # «Расписание»: свой календарь автожеребьёвки
CLAUDE.md                     # строка 027, помощники ядра, тест app-tweaks
```

**Structure Decision**: помощник поля — в ядре рядом с `ui.date` (части и их порядок не меняются, `src/app-page.js` не
трогается); тест — по образцу `tests/app-ui.test.mjs` (правила по склейке и вычисление из неё); поведение — в
`tests/screenshots.mjs`, где уже есть проверки полей даты и шторки.

## Post-design Constitution Check

Сервер, API, права, данные и тексты бота прежние; изменены поле «Автожеребьёвка» (свой календарь), подсказка названия
и отступ одной кнопки. Новые элементы вида — в дизайн-системе. Все принципы выполнены.

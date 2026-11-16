# Implementation Plan: Драгер у каждой шторки (033)

**Branch**: `033-sheet-handle` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md) | **Статус**: выполнен (2026-11-16)

## Summary

Драгер 028 переезжает из календаря в ядро шторки (research R1–R5): `openSheet` сам вызывает `sheetHandle` — драгер у
каждой шторки, новая получает его без правок; `sheetHandle` — рядом с `openSheet` в `07-sheet-chat` (часть ядра
шторки, знает `sheetEl`). Закрытие свайпом — как ✕: сначала `mayCloseSheet()` (проверка `beforeClose`, шторка ждёт
ответа там, где её отпустили), отказ — возврат на место, согласие — уезд вниз и `closeSheet()`, только если открыта всё
ещё эта шторка. Жест Telegram «свайп вниз» выключает `openSheet` и возвращает `closeSheet` (как было в календаре, теперь
для любой шторки). Полоса — `position: sticky` с фоном шторки: у длинной шторки видна всегда; у шторки на весь экран
верхний отступ тоже даёт полоса. Правило «у каждой шторки драгер» — в README дизайн-системы, `CLAUDE.md` и тестах:
`design-system` (шторку строит только `openSheet`, драгер — только `sheetHandle` из `openSheet`, в витрине у каждой
шторки полоса, полоса прилипает), `app-tweaks` правило 7 (поведение драгера и жест — в ядре), `app-ui` (ядро шторки +
`sheetHandle`); в Chrome — `checkSheetHandle` (журнал, прокрученный журнал, переписка с черновиком, жест Telegram на
заглушке SDK, календарь — прежняя проверка).

## Technical Context

**Language/Version**: JavaScript ES2022 (части `src/app/`), Node 22.15+ для тестов

**Primary Dependencies**: нет новых

**Storage**: не меняется

**Testing**: `npm test` (`design-system`, `app-tweaks`, `app-ui`), `npm run screenshots` (`checkSheetHandle`,
`checkTweaks`, все снимки со шторками), e2e — без изменений (страница отдаётся с новым отпечатком CSP автоматически)

**Target Platform**: Telegram для iOS (WebKit) и Chromium; локально — Chrome

**Constraints**: дизайн-система (только токены, `ds-*`, витрина и README); `sheetEl` — только в ядре шторки (026);
CSP 032 — встроенный скрипт меняется, отпечаток считается сервером по странице (правка `src/csp.js` не нужна);
сервер, API, тексты не меняются

**Scale/Scope**: `src/app/02-core.js.txt`, `src/app/07-sheet-chat.js.txt`; `design-system/components.css`,
`preview.html`, `README.md`; тесты; `CLAUDE.md`

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Данные и ответы прежние, сервер не меняется | ✅ |
| II. Проще некуда | Один привычный жест iOS у всех шторок; несохранённое не теряется (тот же вопрос, что у ✕) | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `033-sheet-handle` | ✅ |
| IV. Дизайн-система | Новых токенов нет (`--ds-z-sticky`, `--ds-color-bg` уже есть); правило в README, витрина — у всех шторок полоса; тест `design-system` | ✅ |
| V. Бесплатно | Сервер не меняется | ✅ |
| VI. Проверено до выката | Новые проверки падают до правок; тесты, e2e, снимки; iPhone — по quickstart | ✅ |
| VII. Владелец | Права не меняются | ✅ |

## Project Structure

```text
specs/033-sheet-handle/ spec.md, plan.md, research.md, contracts/sheet-handle.md, quickstart.md, tasks.md, checklists/
src/app/02-core.js.txt        # openCalendar — без своего драгера и жеста; sheetHandle отсюда уходит
src/app/07-sheet-chat.js.txt  # ядро шторки: openSheet → sheetHandle, жест Telegram, mayCloseSheet, sheetHandle
design-system/components.css  # .ds-sheet__handle — sticky с фоном; полноэкранная шторка — отступ сверху даёт полоса
design-system/preview.html    # у каждой шторки полоса
design-system/README.md       # «Всплывающие», «Переписка», правило «у каждой шторки драгер»
tests/design-system.test.mjs  # правило дизайн-системы (033) и «от противного»
tests/app-tweaks.test.mjs     # правило 7 — драгер и жест в ядре шторки
tests/app-ui.test.mjs         # sheetHandle — часть ядра шторки
tests/screenshots.mjs         # checkSheetHandle
CLAUDE.md                     # строка 033, правило 2, части 02/07, тесты
```

## Post-design Constitution Check

Меняется только ядро шторки и стиль полосы; все принципы выполнены.

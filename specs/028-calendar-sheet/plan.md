# Implementation Plan: Шторка календаря автожеребьёвки (028)

**Branch**: `028-calendar-sheet` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

## Summary

Правки только в `openCalendar` (`src/app/02-core.js.txt`) и новых классах дизайн-системы (research R1–R4): вторая кнопка
всегда — `value ? 'Сбросить' : 'Закрыть'`; сетка — строка дней недели и 6 строк недель фиксированной высоты
(`grid-template-rows`); драгер — помощник `sheetHandle(own)` для шторки, которую вернул `openSheet` (класс
`ds-sheet--handle`, полоса `ds-sheet__handle`, Pointer Events, порог — четверть высоты или быстрый свайп, уезд вниз и
`requestCloseSheet()`); жест Telegram «свайп вниз» — выключен, пока открыт календарь (`disableVerticalSwipes`, Bot API
7.7), и возвращён в `onClose`. `openSheet` и другие шторки не меняются. Проверки: правила в `tests/app-tweaks.test.mjs`
и `checkTweaks` в Chrome (высота на трёх месяцах, «Закрыть», свайп мышью — длинный закрывает, короткий нет).

## Technical Context

**Language/Version**: JavaScript ES2022 (части `src/app/`), Node 22.15+ для тестов

**Primary Dependencies**: нет новых

**Storage**: не меняется

**Testing**: `npm test` (`app-tweaks`), `npm run screenshots` (`checkTweaks`, снимки `29-auto-draw-calendar`), e2e — без изменений

**Target Platform**: Telegram для iOS (WebKit) и Chromium; локально — Chrome

**Constraints**: дизайн-система (токены → компонент → витрина → README); в приложении без атрибутов `style` и сырых px —
сдвиг во время свайпа задаётся из JS (как высота поля в `autosize`); `sheetEl` — только в ядре шторки (026)

**Scale/Scope**: `02-core.js.txt`; `design-system/tokens.css`, `components.css`, `preview.html`, `README.md`; тесты;
`CLAUDE.md`, README (раздел «Расписание»)

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Данные и ответы прежние | ✅ |
| II. Проще некуда | Привычный жест iOS, понятная кнопка «Закрыть», шторка не прыгает | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `028-calendar-sheet` | ✅ |
| IV. Дизайн-система | Новые токены `--ds-size-handle-w/-h`, классы `ds-sheet--handle`, `ds-sheet__handle`, `ds-sheet--settle` — в `components.css`, витрине и README | ✅ |
| V. Бесплатно | Сервер не меняется | ✅ |
| VI. Проверено до выката | Новые проверки падают до правок; тесты, e2e, снимки; iPhone — по quickstart | ✅ |
| VII. Владелец | Права не меняются | ✅ |

## Project Structure

```text
specs/028-calendar-sheet/ spec.md, plan.md, research.md, contracts/calendar-sheet.md, quickstart.md, tasks.md, checklists/
src/app/02-core.js.txt        # openCalendar: «Закрыть»/«Сбросить», sheetHandle, жест Telegram
design-system/tokens.css      # --ds-size-handle-w, --ds-size-handle-h
design-system/components.css  # .ds-calendar__grid — 6 строк; .ds-sheet--handle, .ds-sheet__handle, .ds-sheet--settle
design-system/preview.html    # шторка календаря с драгером
design-system/README.md       # строки «Всплывающие», «Календарь»
tests/app-tweaks.test.mjs     # правила 3 (вторая кнопка), 6 (сетка 6 недель), 7 (драгер)
tests/screenshots.mjs         # checkTweaks: «Закрыть», высота, свайп
```

## Post-design Constitution Check

Меняется только шторка календаря; все принципы выполнены.

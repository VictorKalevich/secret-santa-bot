# Contract: драгер у каждой шторки (033) — заменяет раздел «sheetHandle» в `specs/028-calendar-sheet/contracts/calendar-sheet.md`

## Ядро шторки (`src/app/07-sheet-chat.js.txt`)

- `openSheet(title, content, { full, onClose, beforeClose })` — как раньше, плюс: после сборки шторки
  `sheetHandle(sheetEl)`; после вставки в страницу — жест Telegram: `tg.isVerticalSwipesEnabled` →
  `tg.disableVerticalSwipes()`, `sheetSwipes = true`.
- `closeSheet()` — как раньше, плюс: `sheetSwipes` → `tg.enableVerticalSwipes()`, `sheetSwipes = false`.
- `mayCloseSheet()` → `true`, если `beforeClose` нет или он разрешил закрыть; `requestCloseSheet()` =
  `if (await mayCloseSheet()) closeSheet()`.
- `sheetHandle(own)` — вызывается только из `openSheet`:
  - `own.firstElementChild` (`.ds-sheet`) — `+ ds-sheet--handle`, первый ребёнок — `div.ds-sheet__handle` (`aria-hidden`);
  - `pointerdown` — начало, захват указателя, без `ds-sheet--settle`; `pointermove` — `translateY(max(0, dy))`;
  - `pointerup` дальше порога (`dy > высота / 4` или `dy > 30` и скорость > 0,5 px/мс): `ds-sheet--settle`; если
    `sheetEl !== own` или `!(await mayCloseSheet())` — сдвиг 0; иначе `translateY(100%)` и по `transitionend`
    (запасной таймер 400 мс) — `closeSheet()`, если `sheetEl === own`;
  - короче порога или `pointercancel` — `ds-sheet--settle`, сдвиг 0.
- `openCalendar` (`02-core`) — без `sheetHandle` и без жеста Telegram: всё это даёт `openSheet`.

## Дизайн-система

| Что | Правило |
|---|---|
| `.ds-sheet__handle` | как в 028, плюс `position: sticky; top: 0; z-index: var(--ds-z-sticky); background: var(--ds-color-bg)` — у прокрученной шторки полоса у верхнего края |
| `.ds-sheet--full` | без `padding-top` — верхний отступ даёт полоса |
| README | правило: у каждой шторки драгер; шторку открывает только `openSheet`, драгер ставит только он |
| `preview.html` | у каждой `.ds-sheet` — `ds-sheet--handle` и первым ребёнком `ds-sheet__handle` |

## Проверки

- `tests/design-system.test.mjs` — «у каждой шторки драгер (033)»: `ds-sheet-backdrop` в склейке один раз и в
  `openSheet`; `openSheet` вызывает `sheetHandle(sheetEl)`; других вызовов `sheetHandle(` нет; `ds-sheet__handle` — только
  в `sheetHandle`; в витрине у каждой шторки полоса; полоса прилипает (sticky, top 0, фон шторки); у `--full` нет
  `padding-top`; «от противного».
- `tests/app-tweaks.test.mjs` правило 7 — драгер и жест в ядре: `openCalendar` без `sheetHandle` и без жеста;
  `openSheet` — `disableVerticalSwipes()`, `closeSheet` — `enableVerticalSwipes()`; `sheetHandle` — полоса, захват,
  `pointerup`/`pointercancel`, `mayCloseSheet()`, `sheetEl === own`, `closeSheet()`; `requestCloseSheet` — через
  `mayCloseSheet()`; «от противного».
- `tests/app-ui.test.mjs` — `sheetHandle` и `mayCloseSheet` — в ядре шторки (могут знать `sheetEl`).
- `tests/screenshots.mjs` — `checkSheetHandle`: журнал (полоса первой и у верхнего края, в т.ч. прокрученный; короткий
  свайп — на месте, длинный — закрыт), переписка (без текста — длинный свайп закрывает; с текстом — вопрос, «Отмена» —
  на месте с текстом, «ОК» — закрыта), меню участника и шторка на весь экран — полоса первой с отступом 0, жест Telegram
  (заглушка SDK) выключен при открытой шторке, при смене шторки, включён после закрытия; календарь — `checkTweaks`.

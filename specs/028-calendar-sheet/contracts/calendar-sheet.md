# Contract: шторка календаря (028) — дополнение к `specs/027-ui-tweaks/contracts/app-calendar.md`

## `openCalendar(value, onPick, { title, hint })` — изменения

- Вторая кнопка — всегда: `ui.btn(value ? 'Сбросить' : 'Закрыть', 'secondary', 'ds-btn--block')`; «Сбросить» →
  `closeSheet()`, `onPick('')`; «Закрыть» → `closeSheet()`.
- `const own = openSheet(title, […], { onClose })`, затем `sheetHandle(own)`.
- Жест Telegram: `tg.isVerticalSwipesEnabled` → `tg.disableVerticalSwipes()` при открытии; `onClose` →
  `tg.enableVerticalSwipes()` (только если выключали).

## `sheetHandle(own)`

- `own.firstElementChild` (`.ds-sheet`) — `+ ds-sheet--handle`, первый ребёнок — `div.ds-sheet__handle`
  (`aria-hidden`).
- `pointerdown` — начало, захват указателя; `pointermove` — `translateY(max(0, dy))`; `pointerup` — закрыть, если
  `dy > высота / 4` или (`dy > 30` и скорость > 0,5 px/мс): `ds-sheet--settle`, `translateY(100%)`, по `transitionend`
  (запасной таймер) — `requestCloseSheet()`; иначе `ds-sheet--settle` и сдвиг 0; `pointercancel` — сдвиг 0.

## Дизайн-система

| Что | Правило |
|---|---|
| `--ds-size-handle-w` / `--ds-size-handle-h` | 36px / 5px — полоска драгера |
| `.ds-calendar__grid` | `+ grid-template-rows: auto repeat(6, var(--ds-size-control))` |
| `.ds-sheet--handle` | `padding-top: 0` — верхний отступ даёт полоса |
| `.ds-sheet__handle` | полоса во всю ширину, `padding: var(--ds-space-2) 0`, `touch-action: none`, `cursor: grab`; `::before` — полоска `--ds-size-handle-w × --ds-size-handle-h`, `--ds-radius-pill`, цвет `--ds-color-text-muted`, `opacity: var(--ds-opacity-disabled)` |
| `.ds-stack > .ds-sheet__handle + *` | `margin-top: 0` — заголовок сразу под полосой |
| `.ds-sheet--settle` | `transition: transform var(--ds-duration-base)` |

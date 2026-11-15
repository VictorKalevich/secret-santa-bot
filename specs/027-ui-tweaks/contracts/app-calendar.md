# Contract: свой календарь, подсказка названия, действие под полем ввода (027)

## Поле с календарём — `ui.datePick(value, { title, hint })` (`src/app/02-core.js.txt`)

| Что | Как |
|---|---|
| Элемент | `<button type="button" class="ds-input ds-input--pick">`; без даты — ещё `ds-input--placeholder` |
| `el.value` | `'YYYY-MM-DD'` или `''` — так его читает `values()` панели, как у остальных полей |
| Текст | дата словами «20 декабря 2026» или «Не выбрана» |
| Нажатие | `openCalendar(el.value, set, { title, hint })` — `set(iso)` ставит значение, текст и класс и шлёт `change` |
| После «Готово» / «Сбросить» | новое `value`, текст и класс; `el.dispatchEvent(new Event('change', { bubbles: true }))` — черновик `drafts.game` |

Где: только «Автожеребьёвка» в «Параметрах» (`05-admin`, `f.draw_auto_date`). «Дата вручения» и «Написать письмо
до» — `ui.date` (системный календарь, `closeOnReset`, 011); `type: 'date'` в склейке — по-прежнему один раз.

## Шторка календаря — `openCalendar(value, onPick, { title, hint })`

- `openSheet(title, [hint?, календарь, «Готово», «Сбросить»?])` — обычная шторка (`ds-stack`), закрытие ✕ / фоном /
  «Назад» не меняет поле.
- Состояние: `picked` — выбранный день (`value` поля или `''`), `view` — показанный месяц: месяц `picked`, без него —
  текущий. `today` — сегодня по часам телефона (`isoDay(y, m, d)` — дата `YYYY-MM-DD`); нижний предел листания — меньший из месяцев `today` и `picked`.
- Разметка календаря:

```text
div.ds-calendar
  div.ds-row.ds-row--between
    button.ds-icon-btn «‹» (title «Предыдущий месяц», disabled на нижнем пределе)
    div.ds-calendar__title «Декабрь 2026»
    button.ds-icon-btn «›» (title «Следующий месяц»)
  div.ds-calendar__grid
    div.ds-calendar__weekday × 7 «Пн … Вс»
    div (пустая клетка) × сдвиг первого дня
    button.ds-calendar__day × дни месяца (+ --selected, aria-pressed; disabled — раньше today, кроме заданной даты)
```

- «Готово» — `ui.btn('Готово', '', 'ds-btn--block')`, `disabled`, пока `picked` пуст; нажатие дня ставит `picked`,
  перерисовывает сетку и снимает `disabled`. «Готово» → `closeSheet()`, `onPick(picked)`.
- «Сбросить» — `ui.btn('Сбросить', 'secondary', 'ds-btn--block')`, только если у поля была дата при открытии:
  `closeSheet()`, `onPick('')`.
- `calendarCells(y, m)` — чистая (без DOM): массив клеток месяца `m` (1–12) года `y`: сначала `null` по числу дней от
  понедельника до 1-го, затем `{ iso: 'YYYY-MM-DD', day }` для каждого дня.
- `MONTHS_NOM` — «Январь» … «Декабрь» (заголовок); дата в поле — `MONTHS` (родительный падеж) и год.

## Дизайн-система (`design-system/`)

| Класс | Правило | Витрина |
|---|---|---|
| `ds-input--pick` | `text-align: start`, `cursor: pointer`, высота как у поля даты | поле «Автожеребьёвка» с датой и без |
| `ds-input--placeholder` | `color: var(--ds-color-text-muted)` | «Не выбрана» |
| `ds-calendar` | блок календаря, `user-select: none` | календарь месяца с выбранным днём и бледными прошедшими |
| `ds-calendar__title` | месяц и год, полужирный | |
| `ds-calendar__grid` | `grid`, 7 равных колонок, `gap: var(--ds-space-1)` | |
| `ds-calendar__weekday` | мелко, приглушённо, по центру | |
| `ds-calendar__day` (+`--selected`, `:disabled`) | кнопка дня высотой `--ds-size-control`; выбранный — `--ds-color-accent` / `--ds-color-on-accent`; недоступный — `--ds-opacity-disabled` | |
| `ds-sheet__action` | `margin-top: var(--ds-space-3)` — как `ds-stack` | кнопка под полем ввода в демо переписки |

Новых токенов нет. Строки — в таблицу компонентов `design-system/README.md`; правило «поля даты» там же дополняется
`ui.datePick`.

## Подсказка названия (`src/app/03-home.js.txt`)

`` placeholder: `Например: Новый год ${new Date().getFullYear() + 1} — семья` `` — в подсказках приложения нет года
числом.

## «✅ Вопрос решён» (`src/app/07-sheet-chat.js.txt`, `openSupport`)

`ui.btn('✅ Вопрос решён', 'secondary', 'ds-btn--block ds-sheet__action')`; место в шторке прежнее (после поля ввода,
счётчика и плашки «только для чтения»).

## Проверки

- `tests/app-tweaks.test.mjs` — правила research R8 по склейке, у каждого «от противного».
- `tests/screenshots.mjs` — `checkDateFields` (системных полей даты два), `checkTweaks` (календарь, подсказка, отступ),
  снимки `29-auto-draw-calendar` (светлая и тёмная).

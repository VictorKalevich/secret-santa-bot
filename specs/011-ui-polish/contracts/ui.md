# UI-контракт 011

API (`specs/005-events-history/contracts/events.md` и изменения 006–010) не меняется.

## «Как это работает» (вкладка «Инфо» эвента)

Ровно три пункта `ds-bullets`, в этом порядке:

1. «Напиши письмо Санте — его увидит тот, кто будет дарить тебе подарок.»
2. «После жеребьёвки во вкладке «Подопечный» появится, кому даришь ты.»
3. «После завершения эвента письмо остаётся для чтения, переписка открыта ещё 7 дней. Эвент сохранится в истории.»

Заменяет текст FR-1015 / сценарий 9 спецификации 010.

## Дизайн-система 1.4.0

| Что | Контракт |
|---|---|
| Токен `--ds-color-scheme` | `var(--tg-color-scheme, light dark)`; определён в `:root, .ds-theme` |
| Схема страницы | `:where(:root, .ds-theme) { color-scheme: var(--ds-color-scheme) }` — системные элементы (раскрытый список, календарь, флажки, полосы прокрутки) в схеме темы Telegram, без неё — системной |
| Пункты списков | `:where(.ds-root) :where(option, optgroup)` — фон `--ds-color-surface`, текст `--ds-color-text` |
| `select.ds-input` | своя «галочка» (`appearance: none`): справа на `--ds-space-3` — как текст слева, цвет текста поля, `padding-right` под неё |
| `.ds-input[type="date"]` | `appearance: none`, значение от левого отступа, `min-height` — как у текстового поля; `::-webkit-calendar-picker-indicator` без своего `padding`, слева `--ds-space-2`, справа выходит на `--ds-date-icon-bleed` — рисунок на `--ds-space-3` от края; `::-webkit-datetime-edit(-fields-wrapper)` без отступов; `::-webkit-date-and-time-value` (iOS/Android) — без отступа справа, `text-align: start` |
| `ds-root--locked` | на `<body>` пока открыта шторка: страница не прокручивается, позиция сохраняется |
| `.ds-sheet`, `.ds-chat` | `overscroll-behavior: contain` — прокрутка не уходит за край |

## Поле даты (`ui.date` в `src/app.html`)

- Все поля даты создаются через `ui.date(значение)` → `closeOnReset`.
- `input`/`change`, значение пустое, поле в фокусе и последняя клавиша нажата больше секунды назад → `blur()` —
  системный календарь закрывается. Значение не трогается: «Сбросить» очищает поле, как раньше.

## Шторки (`openSheet` / `closeSheet` в `src/app.html`)

- `openSheet` → `document.body.classList.add('ds-root--locked')` после вставки шторки.
- `closeSheet` (✕, фон, «Назад», закрытие кодом, смена шторки) → `classList.remove('ds-root--locked')`.
- Других мест, где ставится или снимается блокировка, нет.

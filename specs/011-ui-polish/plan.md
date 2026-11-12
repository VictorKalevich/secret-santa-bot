# Implementation Plan: Правки мини-приложения — «Как это работает», тёмная тема системных элементов, прокрутка шторок

**Branch**: `011-ui-polish` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-ui-polish/spec.md`

## Summary

Три правки только на клиенте и в дизайн-системе, сервер не меняется:

1. «Как это работает» — три пункта; раскрытие открытия писем и служебного просмотра остаётся в README; конституция
   2.0.0 → 2.1.0.
2. Системные элементы (раскрытый `<select>`, календарь `type=date`, флажки, полосы прокрутки) рисуются в схеме темы
   Telegram: новый токен `--ds-color-scheme` = `var(--tg-color-scheme, light dark)` (Telegram SDK выставляет
   `--tg-color-scheme` на `<html>`), базовое правило `color-scheme` на корне и в `.ds-theme`; пункты `<option>`
   получают `surface`/`text` через `:where()`.
3. Шторки: пока открыта шторка, на `<body>` модификатор `ds-root--locked` (`overflow: hidden` — страница не
   прокручивается ни колесом, ни жестом, ни клавишами, положение сохраняется); `.ds-sheet` и `.ds-chat` —
   `overscroll-behavior: contain` (прокрутка не перетекает за край). Ставится/снимается в одном месте —
   `openSheet`/`closeSheet`.

## Technical Context

**Language/Version**: JavaScript ES2022 (браузер / WebView Telegram), CSS

**Primary Dependencies**: Telegram Mini Apps SDK (`telegram-web-app.js`, уже подключён); без новых зависимостей

**Storage**: N/A (данные не меняются)

**Testing**: `node:test` — `tests/design-system.test.mjs` (правила дизайн-системы), `npm test`; визуально —
`npm run screenshots`, вручную — Telegram Desktop (Windows, тёмная тема) и телефон

**Target Platform**: Telegram Desktop (Windows, WebView2/Chromium), Telegram iOS (WKWebView), Android (WebView),
обычный браузер

**Project Type**: web-service (Cloudflare Worker) + мини-приложение (`src/app.html`)

**Performance Goals**: без изменений

**Constraints**: принцип IV — в `app.html` только классы `ds-*`, без `style`, сырых цветов и px; базовые стили
элементов только через `:where()`; новое — токен → компонент → `preview.html` → README дизайн-системы

**Scale/Scope**: 6 мест с `<select>`, 3 поля `type=date`, ~14 флажков, все шторки (`openSheet`, в т.ч. переписка)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Пары, письма, журнал, права не меняются. Меняется только место честного раскрытия: из «Как это работает» — в README (решение владельца проекта, поправка 2.1.0 в этой же ветке). README по-прежнему описывает открытие письма и служебный просмотр с журналом. | ✅ (после поправки) |
| II. Проще некуда | Короткий блок «Как это работает», читаемые списки в тёмной теме, шторки прокручиваются как ожидается | ✅ |
| III. Спецификация до кода | spec → plan → tasks → implement в ветке `011-ui-polish`; FR-1015 спецификации 010 помечен как заменённый | ✅ |
| IV. Только дизайн-система | Новый токен `--ds-color-scheme`, базовые правила через `:where()`, модификатор `ds-root--locked`, `overscroll-behavior` в компонентах; превью и README дизайн-системы обновлены; в `app.html` — только `classList` с классом `ds-*` | ✅ |
| V. Бесплатно | Сервер не меняется: ни запросов, ни CPU | ✅ |
| VI. Проверено до выката | `npm test` (дизайн-система), `npm run test:e2e` перед выкатом — поведение API не меняется | ✅ |
| VII. Владелец — максимальные права | Права не меняются | ✅ |

Повторная проверка после дизайна: без изменений — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/011-ui-polish/
├── plan.md
├── research.md
├── data-model.md        # данных нет — фиксирует, что модель не меняется
├── quickstart.md
├── contracts/ui.md      # UI-контракт: текст блока, токен, классы, поведение шторки
└── tasks.md
```

### Source Code (repository root)

```text
design-system/
├── tokens.css           # + --ds-color-scheme
├── components.css       # color-scheme на корне/.ds-theme, option/optgroup, ds-root--locked, overscroll-behavior
├── preview.html         # схема колонок витрины, демо списка/даты/флажка, заметка о блокировке
└── README.md            # версия 1.4.0, токен, строки компонентов
src/app.html             # «Как это работает», openSheet/closeSheet → ds-root--locked
.specify/memory/constitution.md   # 2.1.0
specs/010-owner-rights/spec.md     # пометка: FR-1015 (текст «Как это работает») заменён 011
README.md, CLAUDE.md     # место раскрытия — README
```

**Structure Decision**: существующая структура; новых файлов кода нет.

## Complexity Tracking

Нарушений нет.

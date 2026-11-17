# Implementation Plan: Подсказка о выходе для организаторов-участников

**Branch**: `036-organizer-leave-hint` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/036-organizer-leave-hint/spec.md`

## Summary

После жеребьёвки раздел «Выход из события» на «Инфо» (035, `leaveSection` в `src/app/04-event.js.txt`) выбирает
подсказку по роли из уже загруженного `state.me`: владельцу — путь через отмену жеребьёвки (после раскрытия — «выйти
нельзя»), без кнопок; админу — «удалить администратора может только владелец» и прежняя кнопка «Написать организатору»;
участнику — как в 035. Сервер, API, тексты отказов и бот не меняются. Проверка — в Chrome (`checkSelfService`), тексты —
по контракту.

## Technical Context

**Language/Version**: JavaScript ES2022 (мини-приложение — части `src/app/*.js.txt`, один `<script>`)

**Primary Dependencies**: нет новых; Telegram Mini Apps SDK, дизайн-система `design-system/`

**Storage**: не меняется (D1 не трогаем)

**Testing**: `npm test` (склейка: дизайн-система, слова, `app-*`), `npm run screenshots` (Chrome: `checkSelfService`),
`npm run test:e2e` (без изменений — сервер прежний)

**Target Platform**: Telegram для iOS (WebKit), Desktop, веб-клиент

**Project Type**: Cloudflare Worker + мини-приложение Telegram

**Performance Goals**: без новых запросов — роль и состояние события уже в `state.me` / `state.ev`

**Constraints**: только классы `ds-*` (правило 2), «событие» вместо «эвент» (правило 3), CSP (032) — без новых внешних
адресов и встроенных обработчиков

**Scale/Scope**: одна функция `leaveSection` (~10 строк), проверка в Chrome, README, CLAUDE.md

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Подсказка зависит только от роли смотрящего и признаков события (`draw_done`, `revealed`), которые он и так видит; пар и чужих данных нет | ✅ |
| II. Проще некуда | Организатор сразу видит рабочий путь выхода вместо обещания, которое никто не выполнит | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `036-organizer-leave-hint`; README и CLAUDE.md — в той же ветке | ✅ |
| IV. Дизайн-система | Только `ui.section`, `ui.card`, `ui.hint`, `ui.btn` — новых элементов нет | ✅ |
| V. Бесплатно | Ни одного нового запроса к серверу | ✅ |
| VI. Проверено до выката | Проверка в Chrome падает на прежнем коде (у владельца и админа — прежняя подсказка); `npm test`, e2e, скриншоты | ✅ |
| VII. Владелец | Права не меняются; владельцу честно показан единственный путь (принудительная отмена — только его действие, 012) | ✅ |

Повторная проверка после дизайна — без изменений: нарушений нет, Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/036-organizer-leave-hint/
├── spec.md
├── plan.md
├── research.md
├── contracts/leave-hints.md   # тексты и правило выбора подсказки
├── quickstart.md
└── tasks.md
```

`data-model.md` не нужен: данные и схема не меняются.

### Source Code (repository root)

```text
src/app/04-event.js.txt   # leaveSection: подсказка по роли после жеребьёвки
tests/screenshots.mjs     # checkSelfService: владелец, админ, участник × проведена / раскрыта; снимок владельца
README.md                 # «Своё имя и выход из события» — выход организатора после жеребьёвки
CLAUDE.md                 # строка 036, описание приложения
```

**Structure Decision**: изменение — в одной части приложения (`04-event`), где уже живёт раздел выхода (035).

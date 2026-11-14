# Implementation Plan: Недочёты интерфейса мини-приложения

**Branch**: `026-ui-fixes` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md) | **Статус**: выполнен (2026-11-14)

**Input**: Feature specification from `specs/026-ui-fixes/spec.md`; `docs/todo.md`, «Ждёт проверки на iPhone» →
«Недочёты интерфейса» (7 пунктов; Content-Security-Policy — не в этой фиче).

## Summary

Семь правок мини-приложения (research R1–R7), сервер не меняется: после «Сохранить» в «Параметрах» панель тихо
перестраивается (`refresh({ quiet: true })`, без загрузчика, прокрутка прежняя); панель берёт событие только из своего
ответа (журнал — `evId`, «Опасная зона» — `done`, плашка — `finishedNotice(s)`); шторка сама владеет заголовком (узел) и
опросом (`poll(own, load)` — единственный `setInterval`); асинхронные вкладки объявлены через `screen()` — отказ даёт
экран ошибки, `render()` и `closeSheet()` перехватывают ошибки; `state.announcements` — в начальном состоянии;
`confirmBox` — предел `CONFIRM_MAX`, длиннее — «…», тест считает худший случай каждого подтверждения; поле ответа
переписки — `composerParts`, исключения и закреплённые пары — `rulePairs`/`ruleList`/`ruleForm`. Проверки: новый
`tests/app-ui.test.mjs` (правила по склейке, по образцу `app-buttons`) и `checkUiFixes` в `tests/screenshots.mjs`
(поведение в Chrome) — сначала падают, потом правки (R8).

## Technical Context

**Language/Version**: JavaScript ES2022 (мини-приложение — один `<script>` из частей `src/app/`); Node 22.15+ для тестов

**Primary Dependencies**: нет новых (`playwright-core` уже есть — для снимков и проверок в Chrome)

**Storage**: не меняется (D1, схема 11)

**Testing**: `npm test` (новый `tests/app-ui.test.mjs`), `npm run screenshots` (новые проверки `checkUiFixes`),
`npm run test:e2e` (без изменений)

**Target Platform**: мини-приложение Telegram (iOS — WebKit, Android, Desktop/Web — Chromium); локально — Chrome

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: запросов к серверу — столько же, кроме «Сохранить» параметров: +1 (`admin.state` для перестройки
панели, как у других действий); опрос шторок — не чаще прежнего

**Constraints**: дизайн-система (новых элементов и классов нет), слова (013; новых текстов нет), части приложения
(021: формат, разрез между объявлениями, `start()` последним), кнопки на время запроса недоступны (024)

**Scale/Scope**: `src/app/02-core.js.txt` (`CONFIRM_MAX`, `confirmBox`), `03-home.js.txt` (`state`, `screen`, `render`),
`04-event.js.txt` (`finishedNotice`, `renderWard`), `05-admin.js.txt` (`renderAdmin`: тихая перестройка, данные
панели, правила пар), `07-sheet-chat.js.txt` (`openSheet`, `closeSheet`, `poll`, `composerParts`, `openChat`,
`openSupport`, `openSupportThread`); тесты; `docs/todo.md`, `CLAUDE.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы сервера и что видит каждая роль — прежние; закреплённые пары по-прежнему строятся только из поля `fixed` (его получает только владелец); общий помощник правил пар не добавляет данных. Пользовательский текст — через `h()` (текстовые узлы); заголовок обращения — текстовый узел. | ✅ |
| II. Проще некуда для участника | Нет вечной загрузки (тупик на iPhone); подтверждения без обрыва; экран не прыгает после «Сохранить». Тексты прежние, на русском. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `026-ui-fixes`; `docs/todo.md` и `CLAUDE.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | Новых элементов и классов нет: прежняя разметка (`ds-composer`, `ds-list-item`, `ds-check`, `ds-empty`…); проверки `design-system` и `wording` — по склейке. | ✅ |
| V. Бесплатно и без своего сервера | Сервер не меняется; +1 запрос на «Сохранить» параметров; опрос — только у своей шторки (не больше прежнего). | ✅ |
| VI. Проверено до выката | Новые проверки падают до правок; `npm test`, e2e, скриншоты до и после; проверка на iPhone по `quickstart.md` с откатом. | ✅ |
| VII. Владелец — максимальные права | Права не меняются; «Опасная зона» и служебный просмотр — по-прежнему только владельцу. | ✅ |

Нарушений нет; Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/026-ui-fixes/
├── spec.md
├── plan.md
├── research.md
├── contracts/app-ui.md      # помощники частей и правила проверки app-ui, проверки в браузере
├── quickstart.md            # проверки, выкат, шаги на iPhone, откат
├── checklists/requirements.md
└── tasks.md
```

`data-model.md` не нужен: данных и схемы фича не меняет (поле `state.announcements` — описано в контракте и research R5).

### Source Code (repository root)

```text
src/app/02-core.js.txt       # CONFIRM_MAX, confirmBox: «…» вместо молчаливой обрезки
src/app/03-home.js.txt       # state.announcements; screen(); render() с перехватом
src/app/04-event.js.txt      # finishedNotice(e = state.ev); renderWard = screen(...)
src/app/05-admin.js.txt      # renderAdmin = screen(...), { quiet }; журнал — evId; «Опасная зона» — done; плашка — s;
                             # «Сохранить» → refresh({ quiet: true }); rulePairs / ruleList / ruleForm
src/app/07-sheet-chat.js.txt # openSheet → своя шторка, заголовок-узел; closeSheet — перехват onClose; poll();
                             # composerParts в начале раздела; openChat на composerParts; заголовок обращения — свой узел
tests/app-ui.test.mjs        # новый: 7 правил по склейке + «от противного»
tests/screenshots.mjs        # checkUiFixes: поведение в Chrome
package.json                 # app-ui — в скрипт test
docs/todo.md                 # пункт «Недочёты интерфейса» убран
CLAUDE.md                    # строка 026, тест app-ui, помощники частей
```

**Structure Decision**: правки по месту в частях `src/app/` (порядок частей и `src/app-page.js` не меняются); новый
тестовый файл — по образцу `tests/app-buttons.test.mjs`; проверки в браузере — в `tests/screenshots.mjs`, где уже есть
проверки шторки и полей даты.

## Post-design Constitution Check

Сервер, API, права, данные и тексты прежние; изменены только поведение приложения в исправляемых местах и устройство
кода (два общих помощника, обёртка экрана, опрос шторки). Все принципы выполнены.

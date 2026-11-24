# План 058: опрос переписки и черновики писем — меньше запросов

**Branch**: `058-poll-drafts` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Только мини-приложение (`src/app/`), сервер, API и база — без изменений.

- **Опрос шторок** (`poll`, `08-sheet-chat`): расписание на `setTimeout` вместо `setInterval`. Промежуток —
  `pollDelay(empty, quiet, open)`: в закрытом боте 6 с, в открытом — `POLL_STEPS` (6, 10, 20, 30, 60) по числу запросов
  подряд без нового и `null` (сон), когда тишина `quiet` ≥ `POLL_IDLE` (300 с). `load()` шторки возвращает истину, если
  пришло новое. Пока приложение не на экране, таймера нет; при возвращении — `now()`. `poll` возвращает `{ now, stop }`:
  `now()` — запрос сразу и расписание с начала (после своей отправки и действий в обращении, при возвращении, при касании
  спящей шторки), `stop()` — конец опроса (закрытие шторки, отказ обращения).
- **Видимость приложения** (`02-core`): `appVisible()` — страница видна и Telegram не свернул мини-приложение
  (`tg.isActive !== false`); `onVisibility(fn)` — подписка на смену (`visibilitychange`, события Telegram `activated` и
  `deactivated`), возвращает отписку.
- **Черновик письма** (`letterDraftEditor`, `05-event`): сохранение планирует `draftDelay(now, last)` =
  max(`DRAFT_PAUSE` 450 мс, начало прошлого сохранения + `DRAFT_GAP` 5 с); новая правка запланированное не откладывает.
  `saveNow()` — сразу (или сразу после идущего сохранения); его вызывают уход приложения с экрана (одна подписка части) и
  уход с вкладки (`mayLeave`). Сохранения всех редакторов — по одному через `letterQueue`; версия — максимум из своей и
  `letterRevisions` (из последнего ответа).
- **Уход** (`03-home`): `mayLeave()` — общий для «‹»/«Назад» (`leaveEvent`) и вкладок (`renderTabs`): сначала
  `saveLetterNow()`, вопрос `UNSAVED` — только если `state.dirty === true`. `state.dirty`: `true` — несохранённое, о котором
  спросить (адрес, письмо без черновиков), `'draft'` — только черновик письма (сохранится сам), `false` — ничего; вопрос
  Telegram при закрытии и точка на вкладке — при любом истинном.

## Technical Context

**Language/Version**: JavaScript ES2022 (браузер Telegram: iOS WebKit, Android WebView, веб и ПК)
**Primary Dependencies**: Telegram Web App SDK (`isActive`, `onEvent('activated' | 'deactivated')` — Bot API 8.0); новых нет
**Storage**: нет изменений (копия черновика в `localStorage` — как в 041)
**Testing**: `node:test` — новый `tests/poll-drafts.test.mjs` (по склейке: расписание `pollDelay` и `draftDelay`, `poll` на
поддельных таймерах и видимости, правила кода, «от противного»); в Chrome — `tests/poll-drafts.ui.mjs` (Playwright clock,
заглушка SDK: запросы опроса и сохранения, сворачивание, уход с вкладки, быстрое возвращение); `letter-drafts.ui.mjs` —
прежний сценарий 041
**Target Platform**: мини-приложение Telegram, оба бота
**Project Type**: Telegram-бот + мини-приложение (один Worker)
**Performance Goals**: открытый бот — ≤ 9 запросов опроса за 5 минут тишины, затем 0; скрытое приложение — 0; набор письма —
≤ 1 сохранение за 5 с
**Constraints**: CSP 032 (без новых скриптов и адресов, без строк в таймерах); правила частей 021 и 026 (опрос — только в
`poll`, `sheetEl` — только в ядре шторки, поля `state` объявлены); дизайн-система — новых элементов нет
**Scale/Scope**: три шторки с опросом, один редактор черновика

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Запросы и ответы прежние; новых данных нет. | ✅ |
| II. Проще некуда | Меньше вопросов при уходе (черновик сохраняется сам); новые сообщения — как раньше, пока что-то происходит; заснувшую шторку будит касание. | ✅ |
| III. Спецификация до кода | `specs/058-poll-drafts/`, строка в `CLAUDE.md`, `docs/todo.md` (пункты 2 и 4 убрать). | ✅ |
| IV. Дизайн-система | Новых элементов и классов нет. | ✅ |
| V. Бесплатно | Цель фичи — меньше запросов к Worker и записей D1; сервер не меняется. | ✅ |
| VI. Проверено до выката | Расписание и опрос — тестами по склейке с «от противного», поведение — в Chrome; выкат — обычный, без миграций. | ✅ |
| VII. Владелец | Права не меняются. | ✅ |
| Безопасность и данные | CSP не меняется: события и таймеры — функциями, без новых адресов. | ✅ |
| Процесс | README: черновики и переписка — отдельная задача. | ✅ |

Пост-дизайн: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/058-poll-drafts/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── contracts/app-requests.md
├── checklists/requirements.md
└── tasks.md
```

Модели данных нет — база и API не меняются.

### Source Code

```text
src/app/02-core.js.txt       # appVisible, onVisibility (visibilitychange, activated/deactivated)
src/app/03-home.js.txt       # state.dirty: true | 'draft' | false; mayLeave; leaveEvent через mayLeave
src/app/05-event.js.txt      # вкладки через mayLeave; DRAFT_PAUSE, DRAFT_GAP, draftDelay, letterQueue, letterRevisions,
                             # saveLetterNow; letterDraftEditor: schedule, saveNow, write по очереди
src/app/08-sheet-chat.js.txt # POLL_STEPS, POLL_IDLE, pollDelay, poll → { now, stop }; load() шторок → «новое»;
                             # после отправки и действий — now()
tests/poll-drafts.test.mjs   # новый (в скрипт test)
tests/poll-drafts.ui.mjs     # новый, Chrome
README.md, CLAUDE.md, docs/todo.md
```

## Complexity Tracking

Нет отступлений.

# Tasks: 058. Опрос переписки и черновики писем — меньше запросов

**Input**: `specs/058-poll-drafts/` — spec.md, plan.md, research.md, contracts/app-requests.md, quickstart.md

**Tests**: нужны (Конституция VI, правила проекта: `npm test` перед коммитом, «от противного» у каждого правила).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Мини-приложение — части `src/app/` (склейка `src/app-page.js`), тесты — `tests/`.

## Phase 1: Foundational

- [X] T001 `src/app/02-core.js.txt`: после `blurOnTap()` — блок «приложение на экране» (058): `appVisible()` =
  `!document.hidden && !(tg && tg.isActive === false)`, `onVisibility(fn)` → отписка, одна подписка на `visibilitychange` и
  `tg.onEvent('activated' | 'deactivated')`, вызов подписчиков только при смене (контракт, «Видимость»)

## Phase 2: User Story 1 — опрос шторок (P1) 🎯 MVP

**Goal**: шторки не опрашивают сервер, пока приложение скрыто; в открытом боте без нового — реже и сон через 5 минут.

**Independent Test**: по склейке — `poll` на поддельных таймерах: тишина в открытом боте — 9 запросов за 5 минут, потом 0;
скрыто — 0; закрытый бот — 10 в минуту.

- [X] T002 [US1] `src/app/08-sheet-chat.js.txt`: `POLL_STEPS`, `POLL_IDLE`, `pollDelay(empty, quiet, open)`; `poll(own,
  load)` на `setTimeout` → `{ now, stop }` (контракт, «Опрос шторки»): пауза по `onVisibility`, возвращение — `now()`,
  касание спящей шторки — `now()`, остановка при смене шторки; комментарий над функцией — по-новому
- [X] T003 [US1] Там же: `openChat`, `openSupport`, `openSupportThread` — `let live = null` вместо `timer`; `load()`
  возвращает «новое» (`add` → добавлено ли; обращения — смена `sig`); первая загрузка — `live.now()`, после отправки и
  действий — `live.now()` вместо `load()`; `onClose` и отказ обращения — `live.stop()`
- [X] T004 [US1] `tests/poll-drafts.test.mjs` (новый, в скрипт `test` в `package.json`): `pollDelay` из склейки — открытый
  бот 6, 10, 20, 30, 60, 60, 60, 60 и сон, закрытый — 6; `poll` из склейки на поддельных таймерах, видимости и шторке —
  тишина (9 запросов за 5 минут, затем 0), новое сбрасывает расписание, касание спящей — запрос, касание неспящей — нет,
  скрыто — 0 и запрос при возвращении, `now()` — сразу и с начала, смена шторки и `stop()` — конец и отписка, закрытый бот
  — 10 в минуту; правила кода по склейке — `load` шторок только через `poll` (нет `load()` вне `poll(own, load)`), таймеры
  опроса только в `poll`, ядро подписано на `visibilitychange`, `activated`, `deactivated`; «от противного»

## Phase 3: User Story 2 — черновик письма (P1)

**Goal**: пока печатают — сохранение не чаще раза в 5 с; при сворачивании и уходе с вкладки — сразу, без вопроса.

**Independent Test**: по склейке — `draftDelay`; в Chrome — набор, сворачивание, уход на «Инфо», быстрое возвращение.

- [X] T005 [US2] `src/app/05-event.js.txt`: перед `letterDraftEditor` — `DRAFT_PAUSE`, `DRAFT_GAP`, `draftDelay`,
  `letterQueue`, `letterRevisions`, `saveLetterNow` и подписка `onVisibility` (скрыто → `saveLetterNow()`); в редакторе —
  `schedule()` (не откладывает запланированное), `saveNow()` (`urgent`), `write` по очереди `letterQueue` с версией
  `max(draft.revision, letterRevisions)`, после сохранения — `schedule()`; `saveLetterNow = saveNow`
- [X] T006 [US2] `src/app/03-home.js.txt`: комментарий и значение `state.dirty` (`true` | `'draft'` | `false`); `mayLeave()`
  (`saveLetterNow()`, вопрос `UNSAVED` только при `true`, `setDirty(false)`); `leaveEvent` — через `mayLeave`;
  `src/app/05-event.js.txt`: переключение вкладок — через `mayLeave`; `renderMy` — черновик даёт `'draft'`, адрес и письмо
  без черновиков — `true`
- [X] T007 [US2] В `tests/poll-drafts.test.mjs`: `draftDelay` из склейки (450 после паузы, до 5000 от начала прошлого);
  правила кода — в `letterDraftEditor` нет таймера `write` на 450 мс мимо `draftDelay`, сохранение — только через
  `letterQueue`, `confirmBox(UNSAVED)` — только в `mayLeave`, `leaveEvent` и вкладки зовут `mayLeave`, подписка
  `onVisibility` зовёт `saveLetterNow`; «от противного»

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T008 `tests/poll-drafts.ui.mjs` (новый, Chrome; как `letter-drafts.ui.mjs`, Playwright clock, заглушка SDK с
  `onEvent`/`isActive`): опрос в открытом и закрытом боте, сворачивание и возвращение, касание спящей; черновик — набор,
  сворачивание, уход на «Инфо» без вопроса, быстрое возвращение без отказа; прогнать и `letter-drafts.ui.mjs`
- [X] T009 [P] `README.md`: черновики (сохраняются сами: при наборе не чаще раза в 5 с, при сворачивании и уходе — сразу)
  и переписка (в открытом боте при долгой тишине обновляется реже и засыпает; касание или возвращение — обновление)
- [X] T010 [P] `CLAUDE.md`: строка 058 в таблице фич; `src/app/` — `appVisible`/`onVisibility` (02-core), `mayLeave` и
  `state.dirty` (03-home), черновик (`draftDelay`, `letterQueue`, `saveLetterNow`, 05-event), `poll` → `{ now, stop }`
  (08-sheet-chat); тест `poll-drafts`; «Отложено» — пункты 2 и 4 сделаны
- [X] T011 [P] `docs/todo.md`: пункты 2 и 4 «Важного» — сделаны в 058 (убрать), остался пункт 5
- [ ] T012 `npm run test:all` зелёный; задачи отмечены; спецификация — статус «Реализовано»

## Dependencies & Execution Order

- T001 → T002–T007 (видимость нужна опросу и черновику).
- US1 (T002–T004) и US2 (T005–T007) независимы; внутри — код, затем тесты.
- T008 — после обеих историй; T009–T011 параллельно; T012 — последним.

## Implementation Strategy

MVP — T001 + US1 (опрос: главный расход запросов открытого бота). Затем US2, Chrome-проверка, документация. Выкат — по
команде владельца, без миграций (`quickstart.md`).

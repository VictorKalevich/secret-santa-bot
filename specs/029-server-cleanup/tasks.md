# Tasks: Порядок на сервере — параметры события, бот, отказы

**Input**: `specs/029-server-cleanup/` — spec.md, plan.md

**Tests**: новые проверки — в `tests/server-shape.test.mjs`; прежние тесты — без правок ожиданий.

## Phase 1: Setup

- [ ] T001 Базовый прогон `npm test` до правок (число проверок — в отчёт приёмки)
- [ ] T002 `tests/server-shape.test.mjs` — каркас, строка в скрипте `test` (`package.json`)

## Phase 2: User Story 1 — параметры события (P1)

- [ ] T003 [US1] `src/event-params.js`: `EVENT_PARAMS`, `EVENT_SERVICE`, `eventDefaults()`, `templateValues(from)` (plan R1–R4)
- [ ] T004 [US1] Тесты (до правки `events.js` — зелёные по списку, поведенческие — прежнее поведение): колонки схемы ↔
  список в обе стороны и «от противного»; умолчания ↔ схема; сброс → умолчания; образец → копируемые; панель отдаёт
  каждый параметр
- [ ] T005 [US1] `src/db.js`: `EVENT_FIELDS` — из списка (тот же набор)
- [ ] T006 [US1] `src/events.js`: `createEvent`, `resetEvent`, `saveEventSettings` — из списка; порядок проверок прежний
- [ ] T007 [US1] `npm test`; коммит

## Phase 3: User Story 2 — бот (P2)

- [ ] T008 [US2] `src/participant.js`: `menuEvents(db, userId)`; `src/support.js`: `threadById(db, id)` (и в `taken`),
  `replyBlocks(t, me, ev)` — в `adminThread.writable` и `sendFromAdmin`
- [ ] T009 [US2] `src/bot.js`: объект чата, обработчики команд (`onOwnerLink`, `onInvite`, `onStart`, `onName`,
  `onChatReply`, `onSupportReply`), обработчики кнопок (`msg:`, `sup:`, `req:`, `notify`, `nm:`), общие `refuse` и
  `REPLY_HINT`; порядок обращений к базе прежний
- [ ] T010 [US2] Тесты: в `src/bot.js` нет `.prepare(`; самая длинная функция ≤ 60 строк; «от противного»
- [ ] T011 [US2] `npm test`; коммит

## Phase 4: User Story 3 — отказы (P3)

- [ ] T012 [US3] `src/result.js`: `no(error, status)`; замена литералов и локальных помощников в `chat.js`,
  `constraints.js`, `events.js`, `membership.js`, `pairs.js`, `panel.js`, `participant.js`, `roles.js`, `support.js`,
  `vault.js`, `bot.js`
- [ ] T013 [US3] Тест: в модулях нет `ok: false` (кроме `result.js`, `index.js`, `api.js`); «от противного»
- [ ] T014 [US3] `npm test`; коммит

## Phase 5: Polish

- [ ] T015 `CLAUDE.md`: строка 029, «Структура» (`event-params.js`, `result.js`, `bot.js`, `support.js`), тесты
- [ ] T016 `npm run test:all`; отчёт приёмки в этом файле; статус spec и plan
- [ ] T017 Коммит, push ветки; слияние в `main` — после e2e

## Dependencies

US1 → US2 → US3 независимы по смыслу, но делаются по порядку (US3 трогает файлы US1 и US2). README не меняется:
установка, настройка, роли и использование прежние.

# Tasks: Один текст «только для чтения» и журнал семьи только при изменении (034)

**Input**: `specs/034-small-consistency/` — spec.md, plan.md

**Tests**: да — поведение проверяется в «мире» (`npm test`); новые проверки падают на прежнем коде.

## Phase 1: Setup

- [X] T001 Спецификация, план, задачи — `specs/034-small-consistency/`; `.specify/feature.json`

## Phase 2: Тесты (падают до правок)

- [X] T002 [P] [US1] `tests/behavior.test.mjs`: «только для чтения» — тексты с тире; API (`message.send`, `support.send`,
  `support.close`) и бот (`msg:ward:<событие>`, `sup:u:<событие>`) в событии, завершённом больше недели назад; приложение
  показывает те же тексты; в `src/*.js`, кроме `format.js`, своих нет
- [X] T003 [P] [US2] `tests/behavior.test.mjs`: семья — новая с записью; то же название и состав (другой порядок,
  повтор, пробелы) — без записи; новое название, новый состав, замена человека — по записи
- [X] T004 [P] [US2] `tests/atomic.test.mjs`: два сохранения существующей семьи с одним изменением в одну миллисекунду —
  оба успех, одна запись (49 проверок)
- [X] T005 [US1] `tests/fixtures/api-refusals.json` — 1 ответ (`finished-old-member support.close`), строка 034 в заголовке
  `tests/api-refusals.test.mjs`
- [X] T006 Проверить, что T002–T005 падают на прежних модулях (с новыми константами `format.js`)

## Phase 3: User Story 1 — один текст отказа (P1)

- [X] T007 [US1] `src/format.js`: `CHAT_READ_ONLY`, `SUPPORT_READ_ONLY`; `src/chat.js`, `src/support.js`, `src/bot.js` —
  отказы из них, свои константы и литералы убраны

## Phase 4: User Story 2 — журнал семьи (P1)

- [X] T008 [US2] `src/membership.js`: `saveFamily` — без изменений `{ ok: true }` без записи; существующая семья —
  `atomic(db, familyChanges(n), …)`: запись журнала перед изменением, остальные операторы прежние; новая — прежний пакет

## Phase 5: Polish

- [X] T009 `docs/api.md`: тексты отказов (`message.send`, обращения), `admin.family.save` (журнал), таблица кодов,
  «не пишут»; `CLAUDE.md`: строка 034, общие тексты `format.js`, журнал, `membership.js`, тесты `behavior`, `atomic` (49)
- [X] T010 `npm test`, `npm run test:e2e` — зелёные; статус spec; коммиты; влить в `main`, push

## Dependencies

T001 → T002–T005 → T006 → T007, T008 → T009 → T010.

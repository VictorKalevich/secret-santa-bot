---
description: "Task list for 013 — «событие» вместо «эвент», короткие подписи"
---

# Tasks: Терминология «событие» и подписи

**Input**: `specs/013-event-wording/` (plan.md, spec.md, research.md, contracts/texts.md, quickstart.md)

**Tests**: да — принцип VI Конституции (автотест терминологии, e2e и скриншоты с новыми текстами).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Автотест `tests/wording.test.mjs` (research R2): в `src/*.js` и `src/app.html` без комментариев нет `/[Ээ]вент/` (сообщение — файл и строка); в `src/app.html` ни одна кнопка не начинается с «＋»/«+ »; добавить файл в скрипт `test` в `package.json`. Сейчас тест падает — это ожидаемо до T002–T005

## Phase 2: User Story 1 — сообщения бота (P1) 🎯

**Goal**: в сообщениях, кнопках и ошибках бота и API нет «эвент»; правила R1.
**Independent Test**: `tests/wording.test.mjs` по `src/*.js`; e2e — уведомления в новых словах.

- [X] T002 [US1] Тексты по правилам R1 в `src/bot.js`, `src/membership.js` (вступление: «присоединяется к событию «X»», FR-1304), `src/events.js`, `src/pairs.js`, `src/chat.js`, `src/cron.js`, `src/roles.js`, `src/support.js` (скобки «(эвент «X»)» → «(«X»)»), `src/api.js` (ошибки: «Событие не найдено.» и т. п.), `src/index.js` (`/setup`); род — средний (R1 п. 3); комментарии не трогать
- [X] T003 [US1] Ожидаемые тексты в `tests/e2e.test.mjs` (регулярки и строки с «эвент» → новые формы), поведение и шаги — без изменений

## Phase 3: User Story 2 — подписи приложения (P1)

**Goal**: подписи из `contracts/texts.md`, «событие» во всех остальных строках приложения.
**Independent Test**: `tests/wording.test.mjs` по `src/app.html`; скриншоты 00-home, 13-new-event, 06-info, 07, 12.

- [X] T004 [US2] `src/app.html`: 12 подписей из `contracts/texts.md` (в т.ч. «🎄 Создать» с прежним стилем `festive`, заголовок «Новое событие», «Новая семья» и «Добавить исключение» без «＋» и пробела); остальные строки — по R1 (подсказки, подтверждения, тосты, подписи журнала `AUDIT_LABELS`, «Как это работает»)
- [X] T005 [US2] `tests/screenshots.mjs`: селекторы по подписям («Новый эвент» → «Создать», «Полный сброс эвента» → «Полный сброс» и др.)

## Phase 4: User Story 3 — README (P2)

- [X] T006 [US3] `README.md`: пользовательские разделы — «событие» вместо «эвент», цитаты подписей из `contracts/texts.md`; `CLAUDE.md` — строка фичи 013 и правило «в текстах для людей — «событие»» (термин в коде и документах разработки — «эвент»)

## Phase 5: Polish

- [X] T007 `npm test`, `npm run test:e2e`, `npm run screenshots` — всё зелёное, скриншоты просмотрены; вручную по `quickstart.md` п. 1–6 — после выката

## Dependencies

- T001 → T002–T005 (тест показывает, что осталось); T002 → T003; T004 → T005; T006 — после T004 (подписи сверяются с приложением); T007 — последней.

## Parallel Opportunities

- T002 (`src/*.js`) и T004 (`src/app.html`) — разные файлы, можно параллельно.

## Implementation Strategy

MVP — US1 + US2 вместе (одна правка текстов, один выкат); README — в той же ветке до слияния.

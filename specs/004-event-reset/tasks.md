---

description: "Задачи: полный сброс, удаление и перенос участников"
---

# Tasks: Полный сброс события; удаление и перенос участников

**Input**: `/specs/004-event-reset/` · **Tests**: да

## Phase 1: User Story 3 — Перенос на новый аккаунт (P1)

- [X] T401 [US3] `transferAccount` в `src/game.js`, `admin.transfer` в `src/api.js`
- [X] T402 [US3] Пункт «🔁 Перенести на новый аккаунт» с выбором записи в меню участника (`src/app.html`)

## Phase 2: User Story 2 — Удаление поштучно (P1)

- [X] T403 [US2] Меню участника «⋯» (письмо, переименовать, перенести, удалить) вместо ряда значков (`src/app.html`)

## Phase 3: User Story 1 — Полный сброс (P1)

- [X] T404 [US1] `fullReset` в `src/game.js`, `admin.reset.full` в `src/api.js`
- [X] T405 [US1] «Опасная зона»: шторка с последствиями и вводом «СБРОС» (только владелец) (`src/app.html`)

## Phase 4: Polish

- [X] T406 e2e: перенос до/после жеребьёвки, права, пары остальных; сброс: права, слово, состояние после (`tests/e2e.test.mjs`)
- [X] T407 [P] Скриншоты меню участника и опасной зоны (`tests/screenshots.mjs`)
- [X] T408 [P] CLAUDE.md: фича 004
- [X] T409 [P] README: сброс, удаление и перенос участника
- [X] T410 Прогон quickstart

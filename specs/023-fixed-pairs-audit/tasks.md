# Tasks: Журнал закреплённых пар — одна запись на одно изменение

**Input**: Design documents from `specs/023-fixed-pairs-audit/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: проверки одновременных вызовов и повторов — требование спецификации (FR-2307, SC-2301–SC-2303); пишутся до
правки кода и сначала падают.

**Organization**: истории 1–3 исправляются одной правкой `changeFixed`; тесты — по историям.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: история спецификации (US1–US3)

---

## Phase 1: Setup

- [X] T001 Снять «до»: `npm test` на ветке — все зелёные (178), записать время; `node tests/bench/queries.mjs` —
  строка `admin.fixed.add` 6 / 0

---

## Phase 2: Foundational

Нет: правка одной функции, общей подготовки нет.

---

## Phase 3: User Story 1 — Двойное нажатие даёт одну запись (Priority: P1) 🎯 MVP

**Goal**: два одновременных закрепления или удаления одной пары — одна запись журнала.

**Independent Test**: `node --test tests/atomic.test.mjs` — блок «закреплённые пары».

- [X] T002 [US1] `tests/atomic.test.mjs`: блок `describe('атомарность: закреплённые пары', …)` в событии до жеребьёвки
  (владелец `boss`): `admin.fixed.add` ×2 (`z.twice`) — строк `fixed_pairs` 1, `z.audit('fixed.add')` 1; ×2 с
  `{ sameMoment: true }` — то же на другой паре; `admin.fixed.del` ×2 — строк 0, `fixed.del` 1; взаимная
  (`mutual: true`) ×2 — строк 2, запись одна. Счёт записей — разницей до и после (в событии уже есть записи прошлых
  проверок). Запустить — проверки падают (2 записи вместо 1)
- [X] T003 [US1] `src/constraints.js`, `changeFixed`: пакет через `atomic(db, beforeDraw, ev.id)`; запись журнала —
  первой, `.and(условие изменения).audit(ev.id, me.tg_id, add ? 'fixed.add' : 'fixed.del', '')`; условие изменения
  (research R1) — закрепление: `OR` по сторонам `(NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ?)
  AND NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND receiver = ?))`; удаление: `OR` по сторонам
  `EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?)`; затем стороны —
  `beforeDraw.select('INSERT OR IGNORE INTO fixed_pairs (event_id, giver, receiver) SELECT ?, ?, ?', …)` /
  `beforeDraw.where('DELETE FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?', …)`; `await …run()`;
  импорт `auditIfStmt` убрать; комментарий — «журнал по прежнему состоянию (023)»; проверки, тексты и повторное чтение
  события — без изменений. T002 — зелёный

**Checkpoint**: двойное нажатие — одна запись.

---

## Phase 4: User Story 2 — Вызов без изменений не пишет журнал (Priority: P1)

**Goal**: повторное закрепление и удаление отсутствующей пары — без записи; взаимная с одной изменённой стороной — одна.

**Independent Test**: `node --test tests/atomic.test.mjs` — проверка «без изменений».

- [X] T004 [US2] `tests/atomic.test.mjs`, тот же блок: `it('без изменений — без записи; взаимная с одной новой стороной —
  одна')`: повторное `admin.fixed.add` закреплённой пары — +0 записей, ответ 200; `admin.fixed.del` отсутствующей — +0,
  200; закреплена «А → Б», `admin.fixed.add` взаимной «А ↔ Б» — строк 2, +1 запись; закреплена одна сторона, удаление
  взаимной — строк 0, +1 запись
- [X] T005 [US2] `tests/e2e.test.mjs`, сценарий 014 «закрепление: только владелец…»: `assert.equal(audit.length, 2)` →
  `1` с пояснением «повтор без изменений записи не пишет (023)»

**Checkpoint**: журнал совпадает с изменениями и при последовательных вызовах.

---

## Phase 5: User Story 3 — Одновременные закрепления с одним Сантой или подопечным (Priority: P2)

**Goal**: одна сохранённая пара — одна запись.

**Independent Test**: `node --test tests/atomic.test.mjs` — две проверки «один Санта» / «один подопечный».

- [X] T006 [US3] `tests/atomic.test.mjs`, тот же блок: `z.w.together([...])` двух владельцев-вызовов «А → Б» и «А → В» —
  у А одна строка, +1 запись `fixed.add`, оба ответа 200 (прежний ответ, research R3); «А → Б» и «В → Б» — у Б один
  Санта, +1 запись. До T003 — падают, после — зелёные

**Checkpoint**: все истории готовы.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T007 [P] `tests/atomic.test.mjs`: заголовок — 26 → 32 проверки «один результат» (+6 закреплённых пар, 023) и
  проверка повторов без изменений
- [ ] T008 [P] `docs/api.md`: разделы `admin.fixed.add` и `admin.fixed.del` — «Журнал: `fixed.add` — только если пара
  (хотя бы одна сторона) действительно закреплена; без имён…» / «`fixed.del` — только если действительно убрана»;
  строки `fixed.add`/`fixed.del` в «Кодах журнала» — то же
- [ ] T009 [P] `CLAUDE.md`: строка 023 в таблице фич; в правиле «Одно действие — один результат» убрать `changeFixed` из
  списка «`auditIfStmt` напрямую»; в списке тестов `atomic` — 32 «один результат»
- [ ] T010 [P] `docs/refactoring-roadmap.md`, «Решения владельца» → «Поведение»: ответ «успех» второму из одновременных
  закреплений с одним Сантой (подопечным), хотя его пара не сохранена; `docs/refactoring/baseline.md`, раздел 4 — число
  проверок после 023
- [ ] T011 [P] Память проекта `refactoring-roadmap.md`: снять «`admin.fixed.add` ×2 пишет две записи журнала»
  (исправлено в 023)
- [ ] T012 `npm test` (3 прогона, время; `queries` — `admin.fixed.add` 6 / 0), `npm run test:e2e` (без
  `budget exceeded`); `git diff main --stat -- src/` — только `src/constraints.js`
- [ ] T013 Отметки задач, статус `spec.md`/`plan.md` — «реализовано»; коммиты; слияние в `main` (`--ff-only`) и
  `git push` после зелёных `npm test` и e2e

---

## Dependencies & Execution Order

- T001 → тесты T002, T004, T006 (пишутся до правки и падают на текущем коде) → T003 (правка — все зелёные).
- T005 — независим от T002–T004 (другой файл), проверяется в e2e.
- Polish — после историй; T007–T011 — разные файлы, параллельно.

### Parallel Opportunities

- T005 параллельно с T002–T004.
- T007–T011.

## Implementation Strategy

1. Тесты T002, T004, T006 — сначала (падают на текущем коде), затем T003 — все зелёные.
2. T005 — ожидание e2e.
3. Документы, замеры, память; приёмка; слияние.

Коммиты: тесты + правка `changeFixed` + e2e — один (одна логическая единица: исправление с проверками); документы —
отдельный; приёмка — отдельный. Перед коммитами с кодом и тестами — `npm test`.

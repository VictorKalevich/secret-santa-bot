---
description: "Task list for 018-data-registry"
---

# Tasks: Один список данных события и человека

**Input**: Design documents from `specs/018-data-registry/` (plan.md, spec.md, research.md, data-model.md,
contracts/data-registry.md, quickstart.md); шаг 3 плана рефакторинга — `docs/refactoring/step-3-data-registry.md`.

**Tests**: требуются спецификацией — тест схемы (FR-1809), снятие трёх `todo` (FR-1813), тест остатков (FR-1814).

**Organization**: сначала список и построители (основа), затем пять мест переводятся на построители без изменения
поведения (US2), затем три дефекта закрываются условиями (US1), затем тест остатков (US3). US1 стоит после US2, хотя
у обеих P1: исправления делаются уже внутри построителей (файл шага, «Что сделать», п. 5–7), а чистый перевод без
исправлений доказывает, что сам перевод поведения не меняет (`todo` шага 3 по-прежнему падают).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей)
- **[Story]**: US1, US2, US3 — из spec.md

---

## Phase 1: Setup

- [ ] T001 Ветка `018-data-registry`, дерево чистое; замеры «до» записаны в этот файл: `npm test` — 113 тестов, 108
  прошли, 5 `todo`, 0 упали; `node tests/bench/queries.mjs` — таблица совпадает с `docs/refactoring/baseline.md`,
  раздел 3

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: список и построители — на них опираются все истории.

- [ ] T002 `src/db.js`: раздел «данные события и человека (018)» — константы ролей `MEMBER`, `ACTOR`, `ACTOR_MOVED`,
  `RECIPIENT`, `SELF`, `NOT_PERSON` и `REGISTRY` по `data-model.md` (17 таблиц в порядке таблицы «Список»:
  `support_messages` раньше `support_threads`, `members` раньше `removed_members`). Поля — по
  `contracts/data-registry.md`: `event`/`via`, `people`, `anchor` (`events` — `'event'`, `members` — `'member'`,
  `users` — `'person'`), `onEventDelete` (у `audit` — `'keep'`), `onLeave` (`exclusions`, `fixed_pairs`, `messages`,
  `support_threads` — `'delete'`; `pairs` — `'rebuild'`; `join_requests`, `removed_members` — `'keep'`), `onTransfer`
  (`members` — `'merge'`; `pairs`, `messages`, `support_threads`, `support_messages` — `'update'`; `exclusions`,
  `fixed_pairs`, `join_requests`, `removed_members`, `family_members` — `'dedupe'`), `noSelf` у `exclusions` и
  `fixed_pairs`, `members.personal = [['wishlist', 'wishlist_updated_at'], ['delivery', 'delivery_updated_at']]`;
  `transferBefore`/`transferAfter`: `support_threads` — до: закрыть открытое старого (`status = 'closed', closed_at =
  now, closed_by = 0`), если у нового в том же событии есть открытое; после: `assignee = 0, taken_at = 0 WHERE assignee
  = user_id`; `removed_members` — после: удалить отметки нового в событиях, где он участник; `users` — до: `is_admin =
  MAX(is_admin, COALESCE((SELECT is_admin FROM users WHERE tg_id = старый), 0))` у нового; `settings.note` — владелец
  хранится значением `owner_id`, не переносится
- [ ] T003 `src/db.js`: построители по `contracts/data-registry.md` — `eventDataDeleteStmts(db, eventId, { keepMember,
  keepEvent }, guard = '1', ...args)`, `memberDataDeleteStmts(db, eventId, userId, guard = '1', ...args)`,
  `personTransferStmts(db, fromId, toId, { merge }, guard = '1', ...args)` и чистая `mergeMembership(fromRow, toRow)`.
  Условие — `AND (guard)` у каждого оператора, параметры условия — в конце `bind`; свои `OR` — в скобках; якорь —
  последний оператор; оператор удаления участника — ровно `DELETE FROM members WHERE event_id = ? AND user_id = ? AND
  (…)` (подстрока для `beforeWrite` в `tests/atomic.test.mjs`); `dedupe` — `UPDATE OR IGNORE` каждой переносимой
  колонки, затем `DELETE … WHERE (c = старый OR … [OR giver = receiver при noSelf])`; `merge` — по решениям `merge`:
  `DELETE` участия нового в событии, `UPDATE` личных полей участия старого, затем один `UPDATE members SET user_id =
  новый WHERE user_id = старый`. Колонки `ACTOR` и `RECIPIENT` не трогаются
- [ ] T004 [P] `tests/data-registry.test.mjs` (новый) и скрипт `test` в `package.json`: `registryGaps(sqlite, registry)` —
  все таблицы схемы (`sqlite_master` без `sqlite_*`) в списке и наоборот; каждая колонка с именем `event_id`,
  `user_id`, `tg_id`, `chat_id`, `…_id`, `…_by` или именем колонки человека из списка описана (событие, `via`, колонка
  человека, `NOT_PERSON`); каждая описанная колонка есть в схеме; обязательные политики (`onEventDelete` у таблиц с
  событием, `onLeave` у таблиц с событием и `MEMBER`, `onTransfer` у таблиц с `MEMBER`/`ACTOR_MOVED`, кроме якорей).
  Тесты: схема из миграций — 0 расхождений; «от противного» — `ALTER TABLE settings ADD COLUMN event_id`, новая таблица
  `notes (id, user_id)`, копия списка с лишней колонкой — каждое даёт расхождение с именем колонки/таблицы. Плюс
  юнит-тесты построителей: якорь последний, `AND (guard)` у каждого оператора, параметры условия в конце, `mergeMembership`
  (письмо нового с пробелами по краям — непустое, из одних пробелов — пустое)

**Checkpoint**: `npm test` зелёный (5 `todo` прежние), список сверен со схемой.

---

## Phase 3: User Story 2 — Данные события и человека описаны в одном месте (Priority: P1)

**Goal**: пять мест получают операторы из построителей; поведение не меняется ни на одном тесте.

**Independent Test**: `npm test` — те же 5 `todo` падают как `todo`, остальное зелёное без правки ожиданий; таблица
запросов прежняя; поиск из `quickstart.md`, раздел 4, находит каскады только в построителях.

- [ ] T005 [US2] `src/events.js`, `deleteEvent`: операторы удаления — `eventDataDeleteStmts(db, ev.id, {}, exists,
  ev.id)` после уведомлений и записи в общий журнал; исход — последний оператор (`DELETE FROM events`), как сейчас
- [ ] T006 [US2] `src/events.js`, `resetEvent`: `eventDataDeleteStmts(db, ev.id, { keepMember: ownerId, keepEvent: true })`
  вместо 12 операторов (в том числе двух `UPDATE members` письма и адреса); уведомления — до, параметры события по
  умолчанию и журнал — после, как сейчас; захвата нет
- [ ] T007 [US2] `src/pairs.js`, `removeMember`: удаление исключений, закреплённых пар, переписки, обращений и строки
  участника — `memberDataDeleteStmts(db, ev.id, userId, v.guard, ...v.args)` последним блоком; отметка, уведомление и
  журнал — перед ним с прежним условием `v.guard`; исход — `res.at(-1)` вместо `removeAt`; отказы — прежние
- [ ] T008 [US2] `src/api.js`, `admin.participate` (выкл): `[log, ...memberDataDeleteStmts(db, ev.id, me.tg_id)]`
  вместо четырёх операторов
- [ ] T009 [US2] `src/roles.js`, `transferAccount`: решения слияния — `mergeMembership(m, t)` для событий, где участвуют
  оба; операторы переноса — `personTransferStmts(db, fromId, toId, { merge })`; уведомления новому, старому, остальным
  админам и журнал — перед ними (взаимный порядок прежний); `getUser`, чтения участий и проверка «новый уже в
  жеребьёвке» — без изменений
- [ ] T010 [US2] `src/db.js`: удалить `supportDeleteStmts` и `supportTransferStmts`, убрать их из импортов `src/events.js`,
  `src/pairs.js`, `src/api.js`, `src/roles.js`; комментарий шапки `src/db.js` — про список
- [ ] T011 [US2] Проверка: `npm test` (5 `todo` падают как `todo`, 0 упали); `node tests/bench/queries.mjs` = базовая
  таблица; поиск `quickstart.md`, раздел 4; коммит «018 US2: …»

**Checkpoint**: перевод на построители не изменил ни одного ответа, сообщения и числа запросов.

---

## Phase 4: User Story 1 — Одновременные вызовы больше не портят данные (Priority: P1)

**Goal**: три дефекта закрыты условиями в момент записи; проигравший вызов получает существующий отказ.

**Independent Test**: `node --test tests/atomic.test.mjs` — 19 проверок «один результат», 2 `todo` «шаг 5».

- [ ] T012 [US1] Дефект 1, `src/api.js`, `admin.participate` (выкл): условие `EXISTS (SELECT 1 FROM events WHERE id = ?
  AND draw_done = 0)` у журнала (`auditIfStmt`, первым) и у `memberDataDeleteStmts`; журнал не записался — `fail('После
  жеребьёвки так нельзя. Попроси владельца бота вписать тебя.')`; проверка `ev.draw_done` до записи остаётся
- [ ] T013 [US1] Дефект 2, `src/roles.js`, `transferAccount`: условие `EXISTS (SELECT 1 FROM users WHERE tg_id = ?)`
  (старый) у уведомлений (`enqueueIfStmt`), журнала (`auditIfStmt`) и `personTransferStmts`; последний оператор (удаление
  старой записи) не сработал — `{ ok: false, error: 'Старая запись не найдена.' }`
- [ ] T014 [US1] Дефект 3, `src/pairs.js`, `removeMember`: условие `${v.guard} AND EXISTS (SELECT 1 FROM members WHERE
  event_id = ? AND user_id = ?)` у уведомления, журнала, отметки «удалён» и `memberDataDeleteStmts` (захват версии и
  перестройка пар — только `v.guard`); порядок — уведомление, журнал, отметка, данные, строка участника
- [ ] T015 [US1] `tests/atomic.test.mjs`: снять `todo: 'шаг 3'` у трёх проверок (и «(будет исправлено в шаге 3)» в
  названиях), шапка — «19 проверок … 2 известных дефекта»; `npm test` (2 `todo`), таблица запросов прежняя; коммит
  «018 US1: …»

**Checkpoint**: 3 из 3 дефектов шага 3 исправлены, остальные тесты без правки ожиданий.

---

## Phase 5: User Story 3 — После действия не остаётся чужих строк (Priority: P2)

**Goal**: доказать, что построители делают ровно то, что делали пять мест.

**Independent Test**: `node --test tests/data-registry.test.mjs` — тесты остатков зелёные.

- [ ] T016 [US3] `tests/data-registry.test.mjs`: «богатый мир» через `tests/support/world.mjs` — владелец участвует,
  админ, 6 участников, событие A (адрес включён) и событие B (одобрение заявок); письма и адреса, исключение,
  закреплённая пара, семья, обращение с ответом админа и закрытием участником, объявление, удалённый организатором,
  заявка в B, жеребьёвка в A, открытый подопечный, переписка пары. Поиск остатков по `REGISTRY` (значение события — по
  колонкам события и сироты `via`; человека — по всем колонкам человека и `users.tg_id`) с разрешёнными остатками из
  `data-model.md` («Что остаётся после действия»). Тесты: удаление события; сброс (плюс параметры события по умолчанию и
  пустые письмо/адрес владельца); удаление участника до жеребьёвки (в B) и после (в A: человека нет в парах, остальные
  пары целы — каждый участник A дарит и получает ровно один раз); перенос (новый аккаунт уже участник B — участие одно,
  письмо нового или старого по правилу; в A — пары и переписка у нового)
- [ ] T017 [US3] `npm test`; коммит «018 US3: …»

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [P] `CLAUDE.md`: строка `018-data-registry` в таблице фич; `src/db.js` — `REGISTRY` и три построителя вместо
  `supportDeleteStmts`/`supportTransferStmts`; жёсткое правило: новая таблица/колонка с событием или человеком —
  описать в `REGISTRY` (тест схемы падает), каскады — только построителями; `tests/` — `data-registry`, `atomic` (2 `todo`
  шага 5)
- [ ] T019 [P] `docs/refactoring-roadmap.md`: статус шага 3 «выполнен (018, 2026-11-14)»; `docs/refactoring/step-3-data-registry.md`
  — пометка в начале «Выполнен в 018»
- [ ] T020 [P] `docs/refactoring/baseline.md`: раздел 1 — строка `npm test` после шага 3; раздел 4 — три случая шага 3
  в «Один результат» (19), «Дубль или порча данных» — 8; раздел 3 — без изменений (числа те же)
- [ ] T021 [P] Пометки «с 018 — из списка `REGISTRY` (`src/db.js`)» в `specs/012-insert-cancel-support/research.md`
  (удаление и перенос обращений), `specs/014-fixed-pairs/data-model.md` (жизненный цикл), `specs/014-fixed-pairs/research.md`
- [ ] T022 [P] README: проверить, что установка, настройка, секреты, команды, роли и использование не изменились —
  правка не нужна (Конституция: задача на README в каждой фиче)
- [ ] T023 Память проекта (`refactoring-roadmap.md` в памяти): шаг 3 выполнен, `todo` шага 5 — два
- [ ] T024 `npm test` 5 раз подряд — зелёный; коммит «018 docs: …»
- [ ] T025 `npm run test:e2e` — 8 сценариев зелёные без правок, журнал без `budget exceeded`
- [ ] T026 Слияние в `main` (`--ff-only`), `git push` ветки и `main`; `git branch -a --no-merged main` пуст

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2**: T002 → T003 (построители читают список); T004 — после T002 (импортирует `REGISTRY`),
  юнит-тесты построителей — после T003.
- **Phase 3 (US2)** — после Phase 2. T005–T009 правят разные функции; T005 и T006 — один файл, T010 — после T005–T009.
- **Phase 4 (US1)** — после Phase 3: условия ставятся в уже переведённые места (T012 — T008, T013 — T009, T014 — T007).
- **Phase 5 (US3)** — после Phase 4 (тест остатков проверяет итоговое поведение; удаление участника — с исправлением 3).
- **Phase 6**: T018–T023 параллельно; T024 → T025 → T026.

### Parallel Opportunities

- T004 параллельно T003 (схемная часть теста зависит только от `REGISTRY`).
- T007, T008, T009 — разные файлы (`src/pairs.js`, `src/api.js`, `src/roles.js`).
- T012, T013, T014 — разные файлы.
- T018–T022 — разные файлы.

## Parallel Example: Phase 4

```bash
Task: "Дефект 1 — условие «жеребьёвка не проведена» в admin.participate (src/api.js)"
Task: "Дефект 2 — условие «старая запись ещё есть» в transferAccount (src/roles.js)"
Task: "Дефект 3 — условие «участник ещё в событии» в removeMember (src/pairs.js)"
```

## Implementation Strategy

1. Основа: список, построители, тест схемы → зелёный `npm test` (коммит вместе с US2: построители без вызовов — не
   логическая единица).
2. US2: перевод пяти мест без изменения поведения → коммит. Это MVP шага: один список, одно место для новых данных.
3. US1: три условия, снятие `todo` → коммит.
4. US3: тест остатков → коммит.
5. Polish: документы, e2e, слияние.

Остановиться и спросить владельца, если: после перевода (US2) меняется хоть один ответ, сообщение или число запросов;
исправление дефекта требует изменить текст отказа, схему или Конституцию; тест остатков находит строку, которую текущий
код оставляет, а таблица «что делает сейчас» — нет.

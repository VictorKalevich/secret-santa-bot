---

description: "Task list for 020-claims-snapshots"
---

# Tasks: Захваты и снимки жеребьёвки

**Input**: Design documents from `specs/020-claims-snapshots/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/claims-snapshots.md, quickstart.md

**Tests**: требуются спецификацией (FR-2011, FR-2014, FR-2015): проверки одновременных вызовов и гонки снимка пишутся
**первыми** и должны падать на коде до исправления.

**Organization**: по историям спецификации — US1 (захваты без метки времени, P1), US2 (снимки, P1), US3 (помощник везде,
P2). Перед каждым коммитом — `npm test`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: история спецификации (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: замеры «до» для сравнения в конце

- [X] T001 Снять замеры «до» на `main` (`7c5e774`): `npm test` (138 тестов, 136 прошли, 2 `todo`), `npm run bench:draw` ×2,
  `node tests/bench/queries.mjs`; записать в `specs/020-claims-snapshots/research.md` (R10)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: помощник захватов — им пользуются все истории

- [X] T002 Создать `src/claim.js`: `closedParens(sql)` (баланс скобок без учёта строк в одинарных кавычках) и
  `atomic(db, cond, ...args)` по `data-model.md` — поля `sql` (`(cond)`), `args`, `guard` (`[sql, ...args]`); методы
  `and(more, ...moreArgs)`, `enqueue(chatId, payload)` (через `enqueueIfStmt`), `audit(eventId, actor, action, details)`
  (через `auditIfStmt`), `where(sql, ...params)` (`sql AND (cond)`), `select(sql, ...params)` (`sql WHERE (cond)`),
  `add(...stmts)`, `claim(stmt)` (один на пакет; добавляет, если оператора ещё нет в списке), `run()` →
  `{ won, claim, results }` (`won` — `meta.changes > 0` или вернувшаяся строка; без захвата — `null`); методы добавления
  возвращают оператор; общий список операторов у всех построителей из `and()`; незакрытая скобка в `cond`/`more` —
  `Error`
- [X] T003 Создать `tests/claims.test.mjs` (помощник): порядок операторов = порядок вызовов; `and` склеивает условия и
  параметры; `claim` уже добавленного оператора не дублирует его; второй `claim` — ошибка; незакрытая скобка — ошибка;
  на настоящем SQLite (`createMigratedD1`) пакет «по прежнему состоянию» (уведомление перед захватом) при повторе не
  пишет второго уведомления и даёт `won = false`; добавить файл в скрипт `test` в `package.json`

**Checkpoint**: `npm test` зелёный (2 `todo` как прежде); коммит «020 foundation: claim helper»

---

## Phase 3: User Story 1 — Двойной вызов — один результат, даже в одну миллисекунду (Priority: P1) 🎯 MVP

**Goal**: «свой» захват больше не узнаётся по времени; дефекты `ward.received` ×2 и `admin.exclusion.add` ×2 исправлены;
двойное нажатие одним человеком в одну миллисекунду во взятии, передаче, закрытии обращения и решении по заявке даёт
одно уведомление и одну запись журнала

**Independent Test**: `node --test tests/atomic.test.mjs` — 0 `todo`, новые проверки `sameMoment` зелёные

### Tests for User Story 1 (сначала, должны падать)

- [X] T004 [US1] В `tests/atomic.test.mjs` снять `todo: 'шаг 5'` у двух проверок (и «будет исправлено в шаге 5» из
  названий) и добавить проверки `together(…, { sameMoment: true })` одним человеком: `admin.support.take` ×2 (одна запись
  `support.take`, по одному «взял(а)» участнику и другим админам), `admin.support.pass` ×2 владельцем (одна запись
  `support.pass`, по одному уведомлению участнику, новому и прежнему ответственному), `admin.support.close` ×2
  ответственным, `support.close` ×2 участником (по одной записи `support.close`, по одному уведомлению), 
  `admin.request.decide` «принять» ×2 одним админом (одно «Заявка одобрена», одна запись `request.approve`, по одному
  уведомлению остальным админам); статусы — `[200, 400]` с прежними текстами отказов. Обновить шапку файла (число
  проверок). Запустить на текущем коде: 7 проверок падают (дубли) — записать в отчёт задачи

### Implementation for User Story 1

- [X] T005 [P] [US1] `src/participant.js`, `setGiftReceived`: построитель с условием «у пары подопечного
  `gift_received_at = 0`»; уведомление Санте (только при первой отметке, как прежде) — перед `UPDATE pairs`, отметка —
  захватом последней
- [X] T006 [P] [US1] `src/constraints.js`, `changeExclusions`: построитель с прежним условием «до жеребьёвки» (владельцу —
  `? > 0`); запись журнала — первой, `and`: «хотя бы одной добавляемой строки нет» (`NOT EXISTS … OR NOT EXISTS …`) / для
  удаления «хотя бы одна есть»; затем изменения (`select` / `where`); повторное чтение события — как прежде
- [X] T007 [US1] `src/support.js`: вместо `THREAD`/`MINE_SENT` — `OPEN` («обращение открыто») и `LED_BY` («ведёт X»,
  0 — ничьё), оба с закрытыми скобками; `takeStmts` → операторы взятия в построитель (уведомления и журнал — `and`
  «ничьё», возвращает `UPDATE` захвата); `take` — захват последним; `pass` — `and` «ведёт прежний», уведомления и журнал
  перед захватом (порядок уведомлений прежний); `closeByAdmin`, `closeByUser` — перед захватом (уведомления участника —
  `and` «ничьё или ведёт получатель»); `sendFromAdmin` — взятие (если ничьё), затем `and` «ведёт отвечающий»:
  уведомление участнику, «прочитано», вставка ответа последней (`RETURNING`, захват); `sendFromUser` — «прочитано»,
  уведомления (`and` «ведёт 0» / «ведёт получатель»), журнал `support.open` при создании, вставка сообщения последней
  (`RETURNING`, захват); `adminThread` — условие на событие обращения без `THREAD`; повтор `sendFromUser` при закрытом
  обращении — как прежде
- [X] T008 [P] [US1] `src/membership.js`, `decideRequest`: построитель «заявка `pending`», для «принять» — `and`
  «регистрация открыта и событие идёт»; участие (`addMemberStmt`, `clearRemovedStmt` с `...guard`), уведомления, журнал —
  перед захватом; захват `UPDATE join_requests` — последним (через `where` и `claim`); отказ при несостоявшемся захвате —
  как прежде

**Checkpoint**: `npm test` зелёный, 0 `todo`; коммит «020 US1: claims without timestamps»

---

## Phase 4: User Story 2 — Снимок жеребьёвки: одна формула, сверенная тестом (Priority: P1)

**Goal**: четыре снимка в `src/snapshots.js` парами «JS + SQL», паритет проверен тестом; снимок исключений различает
перестановку партнёров

**Independent Test**: `node --test tests/snapshots.test.mjs`

### Tests for User Story 2

- [X] T009 [US2] Создать `tests/snapshots.test.mjs`, сначала — гонка: событие до жеребьёвки с исключениями {А→Б, В→Г};
  `world.beforeWrite('UPDATE events SET draw_done = 1', …)` переставляет их на {А→Г, В→Б} прямым SQL; `admin.draw` —
  400 «Участники, исключения или семьи изменились во время жеребьёвки — попробуй ещё раз.», пар нет. Запустить на
  текущем коде — падает (жеребьёвка записывается). Добавить файл в скрипт `test` в `package.json` после T011

### Implementation for User Story 2

- [X] T010 [US2] Создать `src/snapshots.js` по `data-model.md`: `SNAPSHOTS.{members, exclusions, families, fixed}` с
  `js(data)` (`data = { ids, exclusions, families, fixed }`) и `sql` (один параметр — id события); суммы по модулю 2^52
  (JS — на каждом шаге), произведения — сомножители по модулю 1000003; одна функция «связи» для исключений и закреплённых
  пар; `drawSnapshot(ev, data)` (семьи — `''`, если правило выключено) и `snapshotGuard(eventId, snap)` → `{ sql, args }`
  (семьи — `(? = '' OR <sql> = ?)`)
- [X] T011 [US2] Дописать `tests/snapshots.test.mjs`: паритет — на случайных данных с зерном (несколько прогонов: 40–80
  человек, часть не зарегистрирована, люди семей вне события, идентификаторы до 2^52, исключения, закреплённые пары)
  `js(data)` = `SELECT <sql>` для каждого из четырёх снимков; «от противного» — перестановка партнёров в исключениях меняет
  снимок в JS и в SQL; пустые данные — `0:…`; добавить файл в `package.json`
- [X] T012 [US2] `src/pairs.js`: `checkDraw` — снимок из `drawSnapshot` по уже прочитанным строкам (без новых запросов);
  `runDraw` — условие снимка из `snapshotGuard`; `src/constraints.js` — снимки удалены (остаётся `familyExclusions`);
  `tests/unit.test.mjs` — `familySnapshot` → `SNAPSHOTS.families.js({ ids, families: rows })` из `src/snapshots.js`
  (ожидания те же)

**Checkpoint**: `npm test` зелёный, эталон жеребьёвки без пересоздания; коммит «020 US2: draw snapshots module»

---

## Phase 5: User Story 3 — Атомарное действие собирается одним помощником (Priority: P2)

**Goal**: все атомарные действия собраны `atomic()`; две отмены — одна функция; в `src/` нет SQL с незакрытой скобкой

**Independent Test**: все проверки одновременных вызовов шагов 1–4 зелёные без правки ожиданий; статическая проверка
зелёная

- [X] T013 [US3] `src/pairs.js`: `runDraw` — построитель «`draw_token` = новый», захват первым, удаление пар (`where`),
  вставки (`select`), рассылка, журнал; `pairsVersion` → `{ a, version }` (версия уже в списке; до жеребьёвки — условие
  `draw_done = 0`, версии нет; дополнительное условие захвата — в скобках и с проверкой `closedParens`);
  `applyPairsChange(ctx, ev, a, …)` пишет в построитель; `removeMember` — `and` «ещё участник», уведомление, журнал,
  отметка, `memberDataDeleteStmts(...guard)`, захват — строка участника (последней); `insertMember` — захват — версия,
  журнал последним
- [X] T014 [US3] `src/pairs.js`: `undoDraw(ctx, ev, actor, { tag, cond, condArgs, chats, text, action, lost })` — общие
  проверки и порядок, тексты отказов прежние; `cancelDraw` (`CANCEL_COND`, переписка остаётся, постоянный отказ) и
  `forceCancelDraw` (переписка удаляется, отказ по повторному чтению события) — обёртки с прежними сигнатурами
- [X] T015 [P] [US3] `src/events.js`: `revealAll` (отметка раскрытия), `finishEvent` (захват первым, рассылка, запись
  `finish` — последней), `deleteEvent` (уведомления, журнал, `eventDataDeleteStmts(...guard)`, захват — строка события,
  последней) — через `atomic`
- [X] T016 [P] [US3] `src/membership.js`, `participate` (выход): построитель «`draw_done = 0`», журнал — первым и
  захватом, затем `memberDataDeleteStmts(...guard)`; `src/roles.js`, `transferAccount`: построитель «старая запись
  существует», уведомления, журнал, `personTransferStmts(...guard)`, захват — последний оператор
- [X] T017 [US3] `tests/claims.test.mjs`: статическая проверка — разбор литералов `src/*.js` (кавычки, шаблоны с
  вложенными `${…}`, без комментариев и регулярных выражений); литералы со словами SQL — скобки сбалансированы;
  «от противного» — синтетический фрагмент `'EXISTS (SELECT 1 FROM t WHERE id = ?'` находится; вручную проверить, что на
  `src/support.js` из `main` находятся `THREAD` и `MINE_SENT`
- [X] T018 [US3] Убедиться, что `enqueueIfStmt`/`auditIfStmt` вне `src/claim.js` остались только в не-атомарных местах
  (`src/chat.js` — «пара жива», `returnThreadsStmts`, `otherAdminsNotice` без условия) и `src/constraints.js` (`changeFixed`,
  сборка прежняя по R9)

**Checkpoint**: `npm test` зелёный без правки ожиданий; коммит «020 US3: every atomic action built by the claim helper»

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 Замеры «после»: `node tests/bench/queries.mjs` (не больше таблицы `tests/queries.test.mjs`), `npm run bench:draw`
  ×2 (медианы в разбросе «до»), `npm test` 5 прогонов (время), `npm run test:e2e` (зелёный без правок, нет `budget exceeded`)
- [X] T020 [P] Документы: `CLAUDE.md` (строка 020 в таблице фич; структура — `src/claim.js`, `src/snapshots.js`,
  `constraints.js` без снимков, `pairs.js` — `undoDraw`, `support.js` — `OPEN`/`LED_BY`; жёсткое правило «Одно действие —
  один результат» — помощник и два вида условий, `FIXED_SNAPSHOT_SQL`/`familySnapshot` → `SNAPSHOTS`; тесты — `claims`,
  `snapshots`, `atomic` без `todo`); `docs/refactoring/baseline.md` (раздел 1 — тесты после шага 5, раздел 2 — замер, раздел
  4 — исправленные строки); `docs/refactoring-roadmap.md` (статус шага 5); заметки в `specs/012-insert-cancel-support/
  research.md` (R6) и `specs/014-fixed-pairs/research.md` (R6); статус `spec.md` и `plan.md` этой фичи
- [X] T021 [P] README: установка, команды, роли не меняются; дополнить список быстрых тестов (`tests/claims.test.mjs`,
  `tests/snapshots.test.mjs`), если он перечислен
- [X] T022 Память проекта: `refactoring-roadmap.md` — шаг 5 выполнен (020), что дальше
- [X] T023 Слияние в `main` (`--ff-only`) и `git push` веток после зелёных `npm test` и `npm run test:e2e`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (помощник) → US1, US2, US3.
- US1 и US2 независимы друг от друга (разные функции; US2 трогает `checkDraw`/`runDraw` только в части снимка).
- US3 после US1 (статическая проверка требует замены `THREAD`/`MINE_SENT`) и после US2 (T013 меняет `runDraw`, уже
  с `snapshotGuard`).
- Polish — после всех историй.

### Parallel Opportunities

- US1: T005, T006, T008 — разные файлы (T007 — `src/support.js` — отдельно, но тоже независим).
- US3: T015 и T016 — разные файлы; T013 → T014 — один файл, по очереди.
- Polish: T020 и T021.

## Implementation Strategy

1. MVP — Phase 2 + US1: два воспроизведённых дефекта исправлены, дубли при двойном нажатии в одну миллисекунду ушли.
2. US2 — снимки сверены тестом, перестановка партнёров не проходит.
3. US3 — остальные действия на помощнике (поведение то же), статическая проверка.
4. Замеры, e2e, документы, слияние.

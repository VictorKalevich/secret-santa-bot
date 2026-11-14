---

description: "Task list for 016-fast-tests"
---

# Tasks: Быстрые тесты всего Worker

**Input**: Design documents from `specs/016-fast-tests/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/test-harness.md, quickstart.md

**Tests**: фича сама состоит из тестов; отдельных «тестов на тесты» нет, кроме проверки подмены D1 (FR-1605) и
проверки «тесты ловят поломки» (quickstart, раздел 4).

**Organization**: по историям спецификации. `src/` не меняется ни в одной задаче (FR-1601).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей)
- **[Story]**: история спецификации (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: общие опоры, которые нужны и быстрым тестам, и e2e

- [X] T001 [P] `tests/support/auth.mjs`: перенести `TOKEN`, `ADMIN_SECRET`, `initData` из `tests/harness.mjs` (без `child_process`); `tests/harness.mjs` импортирует и реэкспортирует их (импорты `e2e.test.mjs`, `screenshots.mjs` не меняются) (FR-1616)
- [X] T002 [P] `tests/support/telegram-rules.mjs`: `BLOCKED_CHAT`, `visibleLength`, `brokenUtf16`, `telegramReply(method, params, nextMessageId) → { status, body }` по таблице `data-model.md`; `tests/mock-telegram.mjs` отвечает через неё, реэкспортирует `BLOCKED_CHAT`, заголовок `connection: close` сохраняется (FR-1606, R5)
- [X] T003 [P] `package.json`: `engines.node` = `^22.15.0 || >=23.5.0` (FR-1617, R1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: «мир» — весь Worker в одном процессе. Без него ни одна история не начинается.

- [X] T004 `tests/support/text-hooks.mjs` из `docs/refactoring/prototypes/text-hooks.mjs` (R3)
- [X] T005 `tests/support/d1-sqlite.mjs` из `docs/refactoring/prototypes/d1-shim.mjs`: класс `sqlite.Database ?? sqlite.DatabaseSync`, поведение прежнее (R2)
- [X] T006 `tests/support/world.mjs` из `docs/refactoring/prototypes/world.mjs` по `contracts/test-harness.md`: перехват `fetch` по хосту `TG_API` (`http://tg<N>.test`, неизвестный хост — ошибка), `restoreFetch()`, ответы через `telegramReply`, `api(…, raw)` → `{ status, data, text }`, `setup()` с `inviteCode`, `page()`, `request()`, `query(sql, ...params)`, `log()` с перехватом `console.log` (печать при `WORLD_LOG=1`), `together`, `beforeWrite` без изменений (R4, R6, R13) (depends on T001, T002, T004, T005)
- [X] T007 [P] `tests/d1-sqlite.test.mjs`: каждое свойство подмены из R2 — `first()`/`first(col)` и `null`; `meta.changes` этого оператора, у `SELECT` после записи — 0; `batch` — откат всех при ошибке, результат на оператор, `RETURNING` в `results`; `?1`/`?2` с повтором; число → REAL, колонка `INTEGER` — целое; `boolean` → 0/1; `undefined` → `D1_TYPE_ERROR`; счётчик запросов (`batch` = 1) (FR-1605) (depends on T005)
- [X] T008 [P] `tests/world.test.mjs`: `GET /app` = `src/app.html` с `/*@design-system*/` → `tokens.css + '\n' + components.css`, плейсхолдера в ответе нет, заголовки `text/html`, `no-store` (FR-1613); `telegramReply` — 403 `BLOCKED_CHAT`, 400 при 4097 видимых символах и при разорванном эмодзи в кнопке, 200 при 4096 символах с HTML-тегами; в «мире» сообщение заблокировавшему отмечает `users.blocked_at`; очередь после вызова API отправлена без ожидания (`waitUntil`) (depends on T006)
- [X] T009 `tests/unit.test.mjs`: `fakeD1` с узнаванием SQL по подстроке → `createD1` с миграциями (R12): 100 строк `outbox` вместо «бесконечной очереди»; «падающий шаг cron» — переименованная таблица `events` (`cron step failed daily` в журнале, очередь ушла); «в batch уходят исходные операторы» — перехват `batch` подмены: у каждого оператора `sql` — строка, `raw_stmt` нет; остальные тесты по смыслу прежние (FR-1615) (depends on T005)
- [X] T010 `package.json`: в скрипт `test` добавить `tests/d1-sqlite.test.mjs tests/world.test.mjs` (остальные файлы — по мере появления) (depends on T007, T008)

**Checkpoint**: `npm test` зелёный, «мир» работает.

---

## Phase 3: User Story 1 — Тайна пар и права ролей (Priority: P1) 🎯 MVP

**Goal**: тайна по значениям и права ролей по всем действиям — перед каждым коммитом.

**Independent Test**: `node --test tests/secrecy.test.mjs tests/rights.test.mjs` — зелёные; правка из quickstart,
раздел 4 (поле с подопечным в `admin.state`, снятая проверка владельца у `admin.reset.full`) роняет их.

- [X] T011 [US1] `tests/secrecy.test.mjs` — мир: владелец и админ `adm` не участвуют, 8 участников с разными именами (ни одно не входит в другое), письма и адреса с уникальными метками, семья, исключение, «адрес доставки» включён; событие E1 — жеребьёвка, статусы (часть открыла подопечного, часть «подарок готов», часть «получил», переписка, обращение); событие E2 тех же людей позже, «не повторять прошлые пары» (R7)
- [X] T012 [US1] `tests/secrecy.test.mjs` — перестановка пар: снимок (текст ответов) админу и владельцу — `admin.state` E1/E2, `admin.audit` E1 и общий, `admin.users`, `admin.families`, `event.get` E1/E2, `me`, `admin.draw.check` E2; контроль — второй снимок без изменений равен первому; в одной транзакции SQLite пары E1 удаляются и вставляются по другой расстановке (у каждого Санты подопечный сменился, никто не дарит себе; `seen_text`, `gift_ready`, `notified_at` — у Санты, `gift_received`, `gift_received_at` — с подопечным); снимок равен прежнему побайтно (FR-1607)
- [X] T013 [US1] `tests/secrecy.test.mjs` — замена непустых писем и адресов другими непустыми другой длины (без правки `*_updated_at`) не меняет снимок (без `admin.wishlist`) (FR-1607)
- [X] T014 [US1] `tests/secrecy.test.mjs` — обычный админ: в `admin.state` нет ключа `fixed`, `admin.fixed.add`/`admin.fixed.del` — 403; владелец видит `fixed`; не-участник (зарегистрирован только в E2) и админ-неучастник получают 403 «Ты не участвуешь в этом событии.» на `ward.get`, `chat.get`, `message.send`, `ward.gift`, `ward.received`, `delivery.save`, `wishlist.save`, `support.get`, `support.send`, `support.close` в E1 (FR-1607)
- [X] T015 [US1] `tests/secrecy.test.mjs` — взятое обращение: `adm` взял; второй админ — 403 на `admin.support.get`, владелец — переписка (FR-1607)
- [X] T016 [US1] `tests/secrecy.test.mjs` — тексты сообщений: отдельный мир со всеми рассылками после жеребьёвки (cron «письмо обновлено», переписка в обе стороны, «подарок готов/получен», напоминания, объявление, удаление и вписывание после жеребьёвки, раскрытие, завершение); у каждого участника-неадмина множество подопечных за всё время; ни один текст ему, кроме «Тайна раскрыта», не содержит имени его подопечного; ни один текст никому не содержит метки письма или адреса (FR-1607, R7)
- [X] T017 [P] [US1] `tests/rights.test.mjs` — действия `case '(admin\.[a-z._]+)'` из `src/api.js`, уникальные, ровно 46; на каждое действие и роль — новое событие владельца, тело `{ event, id: 0, from: 0, to: 0, giver: 0, receiver: 0 }`; участник — 403 и `Только для администратора.`; админ — 403 ровно на 12 действиях владельца (`admin.transfer`, `admin.role.grant`, `admin.role.revoke`, `admin.owner.transfer`, `admin.insert`, `admin.fixed.add`, `admin.fixed.del`, `admin.draw.cancel.force`, `admin.event.delete`, `admin.vault.person`, `admin.vault.pairs`, `admin.reset.full`), текст — «… может только владелец бота.» / «Служебный просмотр доступен только владельцу бота.»; владелец — ни одного 403; незарегистрированный — 403, неверная подпись — 401, `GET` — 405 (FR-1608, R8)
- [X] T018 [US1] `package.json`: `tests/secrecy.test.mjs tests/rights.test.mjs` в скрипт `test`; `npm test` зелёный

**Checkpoint**: US1 готова — тайна и права проверяются за секунды.

---

## Phase 4: User Story 2 — Одновременные вызовы с навязанным чередованием (Priority: P1)

**Goal**: 16 проверок «один результат» и 5 известных дефектов с пометкой «будет исправлено в шаге N».

**Independent Test**: `node --test tests/atomic.test.mjs` — `pass 16`, `todo 5`, `fail 0`, одинаково три раза подряд.

- [X] T019 [US2] `tests/atomic.test.mjs` из `docs/refactoring/prototypes/atomic.mjs` — 16 проверок «один результат» обычными утверждениями (ответы `[200, 400]` после сортировки там, где их два; число сообщений, записей журнала, пар с не-участником — как в прототипе): `admin.draw`, `admin.reveal`, `admin.event.finish`, `admin.event.delete`, `admin.draw.cancel`, `admin.draw.cancel.force` ×2; `admin.remove` ×2 после жеребьёвки; `admin.remove` двух людей; `admin.insert` ×2; `admin.remove` ↔ `admin.draw` (`beforeWrite`); «Я участвую» выкл ↔ `admin.draw` (участие первым); `admin.request.decide`; `admin.support.take` двумя админами; ответ двух админов на ничьё обращение; закрытие админом и участником; ссылка владельца двумя людьми (FR-1609, R6)
- [X] T020 [US2] `tests/atomic.test.mjs` — 5 дефектов как `test(…, { todo: 'шаг N' }, …)` с правильным ожиданием и «(будет исправлено в шаге N)» в имени: шаг 3 — `admin.transfer` ×2 (новый аккаунт уже в событии: участие и письмо остаются, журнал 1, сообщение 1); «Я участвую» выкл ↔ `admin.draw` (жеребьёвка пишет первой: пар с не-участником 0); `admin.remove` ×2 до жеребьёвки (журнал 1, сообщение 1); шаг 5 — `admin.exclusion.add` ×2 (журнал 1); `ward.received` ×2 с `sameMoment` (сообщение Санте 1). Убедиться, что сейчас все 5 падают (FR-1609, R9)
- [X] T021 [US2] `package.json`: `tests/atomic.test.mjs` в скрипт `test`; три прогона подряд — одинаковый результат (SC-1605)

**Checkpoint**: US2 готова.

---

## Phase 5: User Story 3 — Число запросов на действие не растёт (Priority: P2)

**Goal**: каждое действие сценария не тяжелее базового замера; жеребьёвка 40 человек ≤ 50 запросов.

**Independent Test**: `node --test tests/queries.test.mjs` зелёный; лишнее чтение в любом действии роняет его.

- [ ] T022 [US3] `tests/support/queries-scenario.mjs` из `docs/refactoring/prototypes/queries.mjs`: `runQueriesScenario()` → `{ rows: [{ name, db, tg, sql }], world, ms }`, утверждения сценария (14 человек в жеребьёвке, закреплённая пара соблюдена, админ без `fixed`, раскрытие ×2 — `[200, 400]`) сохраняются (R10)
- [ ] T023 [US3] `tests/queries.test.mjs`: таблица базовых чисел (46 строк = `baseline.md`, раздел 3), для каждой строки `db ≤ базовое`, `tg = базовое`, набор имён совпадает; в `world.log()` нет `budget exceeded`; отдельный мир — жеребьёвка на 40 участников: `db + tg ≤ 50`, часть очереди осталась, следующий `cron()` её отправляет (FR-1610) (depends on T022)
- [ ] T024 [P] [US3] `tests/bench/queries.mjs`: печать таблицы «действие / к базе / к Telegram» и, с аргументом `sql`, текста запросов (как прототип) (depends on T022)
- [ ] T025 [US3] `package.json`: `tests/queries.test.mjs` в скрипт `test`

**Checkpoint**: US3 готова.

---

## Phase 6: User Story 4 — Результат жеребьёвки при том же зерне не меняется (Priority: P2)

**Goal**: постоянный эталон из нескольких сотен случаев; замер скорости — отдельная команда.

**Independent Test**: `node --test tests/draw-golden.test.mjs` зелёный; правка порядка случайных выборов в
`src/draw.js` роняет его и называет случаи (quickstart, раздел 4).

- [ ] T026 [P] [US4] `tests/support/draw-cases.mjs`: `seeded`, `drawCases(count = 400)` — генератор случаев из `docs/refactoring/prototypes/draw-equivalence.mjs` (зерна 1–count), `runCase(draw, c)` → строка: `JSON.stringify` (Map/Set → массивы) результатов `planDraw`, `findAssignment` с `pairRules` и с функцией-обёрткой, `removeFromAssignment`, `insertIntoAssignment` без ранга и с рангом (R11)
- [ ] T027 [US4] `tests/fixtures/make-draw-golden.mjs` (заголовок: «эталон не пересоздаётся в шагах плана рефакторинга») и созданный им `tests/fixtures/draw-golden.json` от текущего `src/draw.js` (`{ note, count, cases }`, по строке на случай) (depends on T026)
- [ ] T028 [US4] `tests/draw-golden.test.mjs`: пересчитать все случаи текущим `src/draw.js`, сравнить строки с эталоном, при расхождении — номера первых случаев и обе строки; число случаев = `count` (FR-1611) (depends on T027)
- [ ] T029 [P] [US4] `tests/bench/`: перенести `bench-draw.mjs`, `bench-draw-cold.mjs`, `draw-scenario.mjs` (`seeded` — из `tests/support/draw-cases.mjs`), путь по умолчанию — `src/draw.js` от корня; `package.json` — скрипт `"bench:draw": "node tests/bench/bench-draw.mjs"`, в `npm test` не входит; `docs/refactoring/prototypes/draw-equivalence.mjs` — импорт `seeded` из нового места (FR-1612)
- [ ] T030 [US4] `package.json`: `tests/draw-golden.test.mjs` в скрипт `test`

**Checkpoint**: US4 готова.

---

## Phase 7: User Story 5 — Автотест «владелец ⊇ админ» в e2e ничего не пропускает (Priority: P3)

**Goal**: e2e находит ровно 46 действий.

**Independent Test**: `npm run test:e2e` — зелёный, в подтесте «владелец может всё, что админ» 46 действий.

- [ ] T031 [US5] `tests/e2e.test.mjs` (подтест «владелец может всё, что админ», ~строки 1321–1322): регулярка `case '(admin\.[a-z._]+)'`, `assert.equal(actions.length, 46, …)` вместо `>= 35`; остальное в e2e не трогать (FR-1614, FR-1602)

**Checkpoint**: US5 готова.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T032 Время и стабильность: `npm test` ≤ 5 с; 5 прогонов подряд без падений проверок `< 10 мс` в `tests/draw.test.mjs`; если нестабильно — `--test-concurrency=1` в скрипте `test`, пороги не трогать (SC-1601, R14)
- [ ] T033 Проверка «тесты ловят поломки» (quickstart, раздел 4) — временные правки `src/`, каждая роняет свой тест; затем `git checkout -- src`; `git diff main -- src` пуст (SC-1602)
- [ ] T034 [P] `docs/refactoring/prototypes/`: удалить `d1-shim.mjs`, `text-hooks.mjs`, `world.mjs`, `queries.mjs`, `atomic.mjs`, `bench-draw.mjs`, `bench-draw-cold.mjs`, `draw-scenario.mjs`; оставить `draw-speedup.patch`, `draw-equivalence.mjs`; `README.md` — что где теперь лежит (SC-1606)
- [ ] T035 [P] `README.md`: версия Node в разделе установки («нужна 22.15 или новее»), раздел о тестах — что проверяет `npm test` (тайна, права, атомарность, запросы, эталон жеребьёвки), `npm run bench:draw`, структура `tests/` (FR-1618, Конституция «README в той же ветке»)
- [ ] T036 [P] `CLAUDE.md`: строка 016 в таблице фич, команды (`npm run bench:draw`), «Технологии» (быстрые тесты на `node:sqlite`, Node 22.15+), структура `tests/support/`, правило «e2e проверяет `budget exceeded`» — теперь и быстрые тесты (FR-1618)
- [ ] T037 `npm run test:e2e` — зелёный (SC-1603)
- [ ] T038 [P] `docs/refactoring/baseline.md`: раздел 1 (новые числа `npm test`, время), раздел 7 (команды: `npm test`, `npm run test:e2e`, `npm run bench:draw`, `node tests/bench/queries.mjs`, `node --test tests/atomic.test.mjs`), ссылки на скрипты — новые пути (SC-1607)
- [ ] T039 [P] `docs/refactoring-roadmap.md`: шаг 1 — «выполнен (016)»; упоминания путей прототипов, которые переехали (SC-1607)
- [ ] T040 Память проекта: `refactoring-roadmap.md` — шаг 1 выполнен, где лежат опоры тестов
- [ ] T041 Отметить задачи в этом файле; слияние в `main` и отправка после зелёных `npm test` и `npm run test:e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей; T001–T003 параллельны.
- **Foundational (Phase 2)**: после Setup; T004 → T005 → T006 → (T007 ∥ T008 ∥ T009) → T010. Блокирует все истории.
- **US1–US4 (Phase 3–6)**: после Phase 2, независимы друг от друга (разные файлы; общий только `package.json` — правки
  по одной строке в скрипте `test`).
- **US5 (Phase 7)**: независима даже от Phase 2 (правка e2e), проверяется прогоном e2e в Polish.
- **Polish (Phase 8)**: после всех историй.

### User Story Dependencies

- US1 (P1), US2 (P1), US3 (P2), US4 (P2) — только от «мира» (Phase 2); US4 не нужен даже «мир» (чистые функции).
- US5 (P3) — ни от чего.

### Parallel Opportunities

- Phase 1: T001, T002, T003.
- Phase 2: T007, T008, T009 после T006.
- После Phase 2: US1 (T011–T017), US2 (T019–T020), US3 (T022–T024), US4 (T026–T029) — в разных файлах.
- Polish: T034, T035, T036, T038, T039.

---

## Parallel Example: User Story 1

```text
Task: "tests/secrecy.test.mjs — перестановка пар, замена писем, 403, сообщения, обращения (T011–T016)"
Task: "tests/rights.test.mjs — 46 действий × 3 роли (T017)"
```

## Parallel Example: User Story 4

```text
Task: "tests/support/draw-cases.mjs (T026)"
Task: "tests/bench/ — перенос замера жеребьёвки (T029)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 — «мир» и подмена D1 под тестами.
2. Phase 3 — тайна и права.
3. **STOP and VALIDATE**: `npm test` зелёный, quickstart раздел 4 (первые два пункта).

### Incremental Delivery

1. Setup + Foundational → коммит «мир».
2. US1 → коммит. US2 → коммит. US3 → коммит. US4 → коммит. US5 → коммит.
3. Polish: документы, прототипы, e2e, слияние.

Перед каждым коммитом — `npm test` (кроме коммитов только с документами).

---

## Notes

- `src/` не меняется ни в одной задаче; найденный дефект — только `todo` с номером шага.
- Эталон жеребьёвки (T027) создаётся один раз; в шагах 2–7 не пересоздаётся.
- Если тест показывает изменение поведения, которого нет в файле шага, — остановиться и спросить владельца
  (`docs/refactoring-roadmap.md`, «Порядок работы над шагом»).

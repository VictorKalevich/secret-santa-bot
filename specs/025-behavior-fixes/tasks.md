# Tasks: Мелкие правки поведения

**Input**: Design documents from `specs/025-behavior-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: проверки — требование спецификации (SC-2501–SC-2505); пишутся до правки и сначала падают.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: история спецификации (US1–US4)

---

## Phase 1: Setup

- [X] T001 Снять «до»: `npm test` (198, зелёные), `node tests/bench/queries.mjs` — строки `admin.rename`,
  `admin.transfer`, `admin.vault.person`, `admin.vault.pairs`, `admin.request.decide`
- [X] T002 `tests/behavior.test.mjs`: каркас (мир `startWorld`, владелец, админ, участники, событие; `after(restoreFetch)`);
  `package.json` — файл в скрипт `test`

---

## Phase 2: User Story 1 — Служебный просмотр открывается только словом (Priority: P1) 🎯 MVP

**Goal**: сервер требует «ОТКРЫТЬ» (research R1).

**Independent Test**: `node --test tests/behavior.test.mjs` — блок служебного просмотра; `tests/api-refusals.test.mjs`.

- [X] T003 [US1] `tests/behavior.test.mjs`: блок «служебный просмотр: слово ОТКРЫТЬ» — без слова и со словом «СБРОС»
  оба действия → 400 «Для служебного просмотра введи слово ОТКРЫТЬ.», в ответе нет `pairs`/`person`, записей
  `vault.*` в журнале не прибавилось; « открыть » → 200 и одна запись; админ со словом → 403 «Служебный просмотр
  доступен только владельцу бота.»; несуществующее событие со словом → 404. Запустить — падает
- [X] T004 [US1] `tests/support/refusals-scenario.mjs`: в конец `extra` — `vault.pairs-word`, `vault.person-word-wrong`,
  `vault.pairs-word-admin` (research R5); `tests/fixtures/api-refusals.json` — 6 ответов служебного просмотра владельцу
  (R5) и 3 новых ключа; `tests/api-refusals.test.mjs` — в заголовке список изменений эталона 025
- [X] T005 [US1] `src/api.js`: у `admin.vault.person` и `admin.vault.pairs` — `confirm: ['ОТКРЫТЬ', 'Для служебного
  просмотра введи слово ОТКРЫТЬ.']`; `tests/support/queries-scenario.mjs` и `tests/e2e.test.mjs` — `confirm: 'ОТКРЫТЬ'`
  в вызовах служебного просмотра
- [X] T006 [US1] `src/app/06-vault-audit.js.txt`: `openVaultGate` передаёт введённое слово в `openVault`, `vapi`
  добавляет `confirm`. T003, T004 — зелёные

---

## Phase 3: User Story 2 — После переноса всё подписано новым аккаунтом (Priority: P1)

**Goal**: роль `ACTOR` переносится (research R2).

**Independent Test**: `node --test tests/data-registry.test.mjs tests/behavior.test.mjs`.

- [X] T007 [US2] `tests/data-registry.test.mjs`: правило «`onTransfer` у таблиц с `MEMBER` или `ACTOR`»; проверка
  построителя переноса — колонки «кто сделал» (`actor`, `author`, `created_by`, `decided_by`, `removed_by`,
  `closed_by`, `sender`, `assignee`) переносятся, `chat_id` — нет; `STAYS` = `outbox.chat_id` (только `RECIPIENT`);
  сквозной перенос — у старого аккаунта только очередь, `support_threads.closed_by` — у нового; импорт без
  `ACTOR_MOVED`. `tests/behavior.test.mjs`: блок «перенос: подписи у нового аккаунта» — админ (не владелец)
  отправил объявление и удалил участника (записи журнала); владелец переносит его участие на новый аккаунт (не админ):
  записи журнала события (`admin.audit`) подписаны именем нового аккаунта, автор объявления (`event.get`) — тоже; у
  старого аккаунта в базе — только `outbox`. Запустить — падают
- [X] T008 [US2] `src/db.js`: `ACTOR` — «кто сделал: удаление участника не трогает, перенос переносит (025)»;
  `ACTOR_MOVED` упразднить (`support_messages.sender`, `support_threads.assignee` → `ACTOR`); `onTransfer: 'update'` у
  `events`, `announcements`, `audit`, `families`; `personTransferStmts` — колонки `MEMBER` и `ACTOR`; комментарий
  построителя. T007 — зелёный

---

## Phase 4: User Story 3 — Переименование видно в журнале (Priority: P2)

**Goal**: запись `rename` только при настоящем изменении (research R3).

**Independent Test**: `node --test tests/behavior.test.mjs tests/atomic.test.mjs`.

- [X] T009 [US3] `tests/behavior.test.mjs`: блок «переименование»: смена имени — одна запись общего журнала `rename`
  «Старое → Новое», `actor_name` — переименовавший; то же имя (и с лишними пробелами) — успех, записи нет; админ
  переименовал себя — запись. `tests/atomic.test.mjs`: `admin.rename` ×2 в одну миллисекунду с одним именем (блок
  «повторные нажатия», `sameMoment`) — оба 200, запись одна. Запустить — падают
- [X] T010 [US3] `src/panel.js`: `renameUser(ctx, target, name, actor)` — без изменения — успех; иначе `atomic` по
  прежнему состоянию (`name IS NOT ?`), запись журнала перед захватом, захват — `UPDATE users … AND name IS NOT ?`
  последним; `src/api.js`: строка `admin.rename` вызывает `renameUser` (прежние проверки длины и прав)
- [X] T011 [US3] `src/app/06-vault-audit.js.txt`: `AUDIT_LABELS` — `rename: '✏️ Переименован'`. T009 — зелёный

---

## Phase 5: User Story 4 — Заявку в завершённом событии можно отклонить (Priority: P3)

**Goal**: одно правило с кнопкой бота (research R4).

**Independent Test**: `node --test tests/behavior.test.mjs tests/api-refusals.test.mjs`.

- [X] T012 [US4] `tests/behavior.test.mjs`: блок «заявка в завершённом событии»: заявка ждёт, событие завершено;
  `approve: true` — 400 «Событие завершено — менять его уже нельзя (доступны просмотр, раскрытие и удаление).»;
  отклонение — 200, заявителю сообщение об отказе, второму админу — уведомление, `request.reject` — одна запись;
  повтор — «Заявка уже рассмотрена.». `tests/support/refusals-scenario.mjs` — случай
  `request.decide-approve-finished`; эталон — 4 ответа `admin.request.decide` на завершённых событиях (R5) и новый
  ключ. Запустить — падают
- [X] T013 [US4] `src/api.js`: строка `admin.request.decide` — `finished: true`, в обработчике первым — принять в
  завершённое → `refuse(CLOSED)`
- [X] T014 [US4] `src/app/05-admin.js.txt`: раздел заявок — функция `requestNodes()`; в идущем событии — прежнее место
  и вид; в завершённом — перед обращениями, только «Отклонить» и подсказка «Событие завершено — принять заявку нельзя,
  отклонить можно: человек получит ответ.» T012 — зелёный

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] `docs/api.md`: служебный просмотр — слово `ОТКРЫТЬ` (вместо «API его не требует»); `admin.rename` —
  журнал `rename`; `admin.request.decide` — «В завершённом: проверяет обработчик», принять — 400; `admin.transfer` —
  отметки «кто сделал» переходят; «Коды журнала» — `rename`; абзац «кроме `admin.rename`» — убрать. Тест `api-doc`
- [X] T016 [P] `specs/018-data-registry/contracts/data-registry.md`, `data-model.md`: поправка 025 — `ACTOR`
  переносится, `ACTOR_MOVED` упразднена, у старого аккаунта — только `RECIPIENT`
- [X] T017 [P] `CLAUDE.md`: строка 025; `REGISTRY` (роли), журнал (без исключения `admin.rename`), служебный просмотр
  (слово проверяет и сервер), `atomic` 44, тест `behavior`; `README.md`: журнал — переименования, перенос — подписи
  переходят, заявки в завершённом — отклонить в приложении, служебный просмотр — слово
- [X] T018 [P] `docs/refactoring-roadmap.md` — четыре пункта «Решений владельца» — сделано (025), порядок — пункт 3
  сделан; `tests/atomic.test.mjs` — заголовок 43 → 44
- [X] T019 `npm test` ×3, `node tests/bench/queries.mjs` (прежние числа), `npm run test:e2e`, `npm run screenshots`
  (19–21 — служебный просмотр открывается); `git diff main --stat`
- [X] T020 Отметки задач, статус spec/plan — «реализовано»; коммиты; слияние в `main` (`--ff-only`), `git push`;
  память проекта

---

## Dependencies & Execution Order

- T001 → T002 → истории. В каждой истории тест — до правки и падает.
- US1 (T003–T006), US2 (T007–T008), US3 (T009–T011), US4 (T012–T014) независимы, кроме общих файлов
  (`tests/behavior.test.mjs`, `src/api.js`, эталон отказов) — последовательно.
- Polish — после историй; T015–T018 — разные файлы.

## Implementation Strategy

1. MVP — US1 (тайна).
2. US2 — данные человека; US3, US4 — журнал и заявки.
3. Документы, замеры, слияние.

Коммиты: тесты и код (US1–US4) — один; документы — один; приёмка — один. Перед коммитами с кодом — `npm test`.

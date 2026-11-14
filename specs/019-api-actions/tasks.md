---
description: "Task list for 019-api-actions"
---

# Tasks: Таблица действий API и контекст запроса

**Input**: Design documents from `specs/019-api-actions/` (plan.md, spec.md, research.md, data-model.md,
contracts/api-actions.md, quickstart.md); шаг 4 плана рефакторинга — `docs/refactoring/step-4-api-table-context.md`.

**Tests**: требуются спецификацией — эталон отказов (FR-1910), тест таблицы (FR-1909), паритет пустоты (FR-1915), пакет
чтений в подмене D1 (FR-1916), сниженные пороги запросов (FR-1905).

**Organization**: сначала эталон отказов на неизменённом коде (без него нечем доказать «ответы те же»), затем основа
(простые проверки, пакет чтений, контекст), затем таблица (US1), модули и контекст в сигнатурах (US3), чтения (US2) и
мелочи (US4). US3 стоит перед US2: объединять чтения проще, когда логика уже в модулях и получает контекст; числа
запросов US2 меряются на итоговом коде.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей)
- **[Story]**: US1–US4 — из spec.md

---

## Phase 1: Setup

- [X] T001 Ветка `019-api-actions`, дерево чистое; замеры «до» на `main` `c8d1cf9` (Node 24.21.0): `npm test` — 130
  тестов, 128 прошли, 2 `todo`, 0 упали; `npm run bench:draw` ×2, медианы холодный / тёплый, мс: 50 — 0,96–1,00 / 0,06;
  100 — 1,97–2,00 / 0,19–0,20; 150 — 2,97–3,02 / 0,45; 200 — 3,69–3,76 / 0,73–0,74; `node tests/bench/queries.mjs` =
  таблица `BASELINE` в `tests/queries.test.mjs`
- [X] T002 Эталон отказов **до изменения `src/`** (research R3): `tests/support/refusals-scenario.mjs` — мир (владелец,
  админ, участник, посторонний, незнакомец; идущее событие E, завершённые F без адреса и FD с адресом, несуществующее
  999999), список 59 действий явно в порядке прежних `case` + `admin.nope`, `nope`, ситуации `stranger`, `outsider`,
  `member`, `admin` (свежее событие на каждое действие), `missing`, `finished`, `finished-admin`, `finished-delivery`;
  тела `{ event, id: 0, from: 0, to: 0, giver: 0, receiver: 0 }`; запись `{ status, error }` (`error` — `null` при
  успехе). `tests/fixtures/make-api-refusals.mjs` пишет `tests/fixtures/api-refusals.json` (`{ actions, cases }`);
  `tests/api-refusals.test.mjs` — сценарий = эталон (`deepEqual`); файл — в скрипт `test` в `package.json`
- [X] T003 Снять эталон на неизменённом коде, `npm test`; коммит «019 refusals fixture: …» (только тесты и эталон)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: простые проверки, пакет чтений и контекст — на них опираются US1–US3. Поведение не меняется.

- [X] T004 [P] `src/status.js` (новый, **без импортов**): `CHAT_GRACE_MS`, `isFinished`, `chatUntil`, `chatWritable` (из
  `src/events.js`) и `publicEvent` (из `src/api.js`) без изменений; импорты в `src/events.js`, `src/pairs.js`,
  `src/membership.js`, `src/support.js`, `src/chat.js`, `src/bot.js`, `src/cron.js`, `src/api.js`, тестах — из
  `src/status.js` (реэкспорт из `events.js` не оставлять)
- [X] T005 [P] `src/db.js`: `readMany(db, named)` — один `db.batch` из заданных операторов (пропущенные `null`/ложь — `[]`,
  ни одного заданного — без запроса), результат по именам; построители чтений `userQuery`, `settingsQuery` (+
  `settingsFrom(rows)`), `usersQuery`, `eventQuery`, `memberQuery`; прежние `getUser`, `getSettings`, `allUsers`,
  `getEvent`, `getMember` читают тем же оператором
- [X] T006 [P] `tests/support/d1-sqlite.mjs`: `batch` ставит барьер `gate`, только если в пакете есть запись
  (`INSERT|UPDATE|DELETE`); `tests/d1-sqlite.test.mjs` — пакет чтений: результаты по порядку операторов, при закрытом
  барьере выполняется сразу, пакет с записью ждёт; `specs/016-fast-tests/contracts/test-harness.md` — правило барьера
- [X] T007 `src/context.js` (новый, research R4, `contracts/api-actions.md` §2): `makeContext(env, { me, settings })`,
  `openContext(env, userId)` (пользователь + настройки одним `readMany`); `settings()`, `users()`, `ownerId()`
  (`resolveOwner(db, settings, users)`), `isOwner()`, `read(named)` с `users: true` / `settings: true` (из кэша или в
  этом же пакете), `forgetUsers()`; кэш — обещания на вызов, ошибка сбрасывает кэш
- [X] T008 `npm test` (без правки ожиданий; 2 `todo`)

**Checkpoint**: основа есть, ни один ответ и ни одно число запросов не изменились.

---

## Phase 3: User Story 1 — Права и условия каждого действия — в одной таблице (Priority: P1) 🎯 MVP

**Goal**: 59 строк таблицы, один конвейер проверок в прежнем порядке, тесты прав и e2e — из таблицы.

**Independent Test**: `node --test tests/api-refusals.test.mjs tests/api-table.test.mjs tests/rights.test.mjs
tests/secrecy.test.mjs` — зелёные, ожидания прав и тайны не правились.

- [X] T009 [US1] `src/api.js`: `ROLES` (`ANY`, `USER`, `VIEWER`, `MEMBER`, `ADMIN`, `OWNER`), `CLOSED` («Событие завершено —
  менять его уже нельзя (доступны просмотр, раскрытие и удаление).»), `onlyOwner(what)` → «${what} может только
  владелец бота.», `refuse(text, status = 400)`, `confirmed(body, word)`, `respond(data)` → `{ ok: true, ...data }`;
  `export const ACTIONS` — 59 строк по `data-model.md` §1 в порядке прежних `case` (13 участника, 11 общих админа, 35
  событий; `admin.audit` — `event: 'given'`); заглушки `UNKNOWN_ADMIN` и `UNKNOWN` → 404 «Неизвестное действие»;
  обработчики `run(ctx, body, ev, member)` — тела прежних веток, возвращают данные или `refuse(…)`; `FINISHED_OK` и
  проверки владельца/слова внутри веток удаляются (переходят в поля строки)
- [X] T010 [US1] `src/api.js`, `handleApi`: конвейер research R2 — 405 → 401 → тело → контекст (`openContext`) → снятие
  `blocked_at` → строка → `role !== ANY` и не зарегистрирован → 403 → `admin.*` и не админ → 403 «Только для
  администратора.» → `admin.*`: `await ctx.ownerId()` сразу → без события: владелец → `run`; с событием: 404 «Событие не
  найдено.» → не `admin.*`: участие → 403 «Ты не участвуешь в этом событии.» (`VIEWER` пропускает админа) → `finished` →
  владелец (403, **после** «завершено») → слово (400) → `run`; заголовки ответа прежние; недостижимая ветка «перенести
  администратора может только владелец» удаляется
- [X] T011 [P] [US1] `tests/api-table.test.mjs` (новый) и скрипт `test`: 59 строк (46 `admin.*`), порядок = список эталона;
  роль из `ROLES`; `owner` (непустая строка) ⇔ роль `OWNER`; у действия события `finished` — `true` или непустая строка;
  `confirm` — пара непустых строк; `run` — функция; `admin.*` — `ADMIN`/`OWNER`, остальные — нет; проверка «от
  противного» на копии строки без роли / без `finished` даёт ошибку с именем действия
- [X] T012 [P] [US1] `tests/rights.test.mjs`: список — `Object.keys(ACTIONS).filter((a) => a.startsWith('admin.'))` из
  `../src/api.js` вместо регулярки по тексту; утверждение «46, в том числе с «_»» остаётся, добавить «всего 59»;
  ожидания не меняются. `tests/api-refusals.test.mjs`: набор действий эталона = ключи `ACTIONS` (в том же порядке)
- [X] T013 [P] [US1] `tests/e2e.test.mjs` (автотест «владелец ⊇ админ», ~строка 1320): список — из `ACTIONS` (тот же
  фильтр); сценарий не меняется
- [X] T014 [US1] `npm test` (эталон отказов, права, тайна — зелёные без правки ожиданий; таблица запросов — не больше
  базовой); коммит «019 US1: …»
  Сделано вместе с T016, T017 и частью T015, T018, T019 (новые функции модулей с контекстом: `participant.js`, `panel.js`, `constraints.js`, параметры события, участие, список семей, история переписки): иначе тела веток пришлось бы писать дважды — в таблице и при переносе. Запросов к базе на 1–3 меньше базовых на каждом действии (пользователь и настройки — одним пакетом, пользователи — из контекста).

**Checkpoint**: права — в таблице; ответы на отказы побайтно прежние.

---

## Phase 4: User Story 3 — Предметная логика — в модулях, общие правила — в одном месте (Priority: P2)

**Goal**: в `src/api.js` нет `db.prepare`; функции модулей получают контекст первым параметром (`contracts/api-actions.md`
§3); простые проверки — в `src/status.js`.

**Independent Test**: `Select-String -Path src/api.js -Pattern 'prepare\('` — пусто; `npm test` зелёный; таблица запросов
не больше базовой.

- [ ] T015 [P] [US3] `src/constraints.js` (новый): `changeExclusions(ctx, ev, { add, giver, receiver, mutual })` и
  `changeFixed(ctx, ev, …)` — тела веток `admin.exclusion.*` / `admin.fixed.*` (заморозка исключений для не-владельца —
  внутри, повторное чтение события после записи — как сейчас); из `src/db.js` — `familyExclusions` (чистая: `(ev, ids,
  rows)`, чтение семей — в вызывающих), `familySnapshot`, `FAMILY_SNAPSHOT_SQL`, `fixedSnapshot`, `FIXED_SNAPSHOT_SQL`;
  импорты в `src/pairs.js`, `src/membership.js`, `tests/unit.test.mjs` (`../src/constraints.js`); импорт только из
  `db.js`, `format.js`, `status.js`
- [X] T016 [P] [US3] `src/participant.js` (новый): `homeView(ctx)` (`me`), `eventView(ctx, ev, member)` (`event.get`),
  `saveWishlist`, `saveDelivery` (порядок отказов прежний: «адрес не нужен» раньше «завершено»), `wardView`,
  `setGiftReady`, `setGiftReceived` — тела прежних веток
- [X] T017 [P] [US3] `src/panel.js` (новый): `adminState(ctx, ev)`, `memberLetter(ctx, ev, id)` (`admin.wishlist`),
  `usersList(ctx)` (`admin.users`) — тела прежних веток, поля и порядок полей ответа прежние
- [X] T018 [US3] `src/events.js`: `saveEventSettings`, `setRing`, `setRegistration`, `regenInvite`, `setAvoidPrevious` — из
  веток `admin.game`, `admin.ring`, `admin.registration`, `admin.invite.regen`, `admin.avoid_previous`; все функции —
  `ctx` первым (`createEvent`, `finishEvent`, `deleteEvent`, `resetEvent`, `inviteFromEvent`, `revealAll`,
  `remindUnfilled`, `remindSantas`, `announce`); настройки и пользователи — `ctx.settings()` / `ctx.users()`
- [X] T019 [US3] `src/membership.js`: `participate(ctx, ev, on, actor)`, `allowRemoved(ctx, ev, id, actor)`,
  `familiesList(ctx)` — из `src/api.js`; `decideRequest(ctx, id, actor, approve, { ev })` проверяет `req.event_id`
  (прежний текст отказа); `saveFamily`, `deleteFamily`, `joinByInvite` — `ctx` первым, «владелец ли я» — из контекста
- [X] T020 [US3] `src/pairs.js` (`checkDraw`, `runDraw`, `removeMember`, `insertMember`, `cancelDraw`, `forceCancelDraw`),
  `src/chat.js` (`sendChatMessage`, `chatHistory` — из ветки `chat.get`), `src/support.js` (`participantView`,
  `sendFromUser`, `closeByUser`, `adminThread`, `take`, `sendFromAdmin`, `pass`, `closeByAdmin`), `src/roles.js`
  (`setOwner`, `grantAdmin`, `revokeAdmin`, `transferOwnership`, `transferAccount`), `src/vault.js` (`vaultPerson`,
  `vaultPairs`): `ctx` первым; `me`, `isOwner`, `users`, `settings` — из контекста; низкоуровневые построители
  (`drawCancelable`, `chatPair`, `returnThreadsStmts`, `rejoinBlocked`, функции `db.js`) — по-прежнему `db`; условия
  захватов и состав пакетов записи не меняются; в `vaultPerson` журнал — до чтений, как сейчас
  `adminList` и счётчики обращений — по-прежнему с `db` (разделение «запрос + сборка» — US2, T029).
- [X] T021 [US3] `src/bot.js`: контекст — `openContext` для сообщения, `makeContext(env, { me })` для нажатия кнопки;
  `ctx.me` обновляется после повторного чтения пользователя; ссылка владельца: `createUser` → `ctx.forgetUsers()` →
  `setOwner`; `src/cron.js`: `makeContext(env)` на запуск, шаги получают его (ошибка одного шага не отравляет кэш
  следующего); `src/index.js` — без изменений маршрутов
- [X] T022 [US3] `src/api.js`: обработчики таблицы — вызовы модулей и сборка полей ответа; ни одного `prepare(`;
  импорты — только модули
- [X] T023 [US3] `npm test`; `node tests/bench/queries.mjs` — ни одно число не выше базового; коммит «019 US3: …»

**Checkpoint**: обработчик API — разбор, таблица, ответ; функции модулей — с контекстом.

---

## Phase 5: User Story 2 — Каждое действие делает меньше обращений к базе (Priority: P1)

**Goal**: пороги файла шага; настройки и пользователи — одно чтение на вызов; независимые чтения — пакетами; признак
«пусто» — в базе.

**Independent Test**: `node --test tests/queries.test.mjs tests/unit.test.mjs tests/atomic.test.mjs
tests/draw-golden.test.mjs` — зелёные; `npm run bench:draw` ×2 — без ухудшения.

- [ ] T024 [P] [US2] `src/db.js`: `BLANK_SQL(col)` — `trim(col, char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,
  8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)) = ''`; узкие построители `drawMembersQuery`
  (`user_id, name, username, registered, wishlist_updated_at, delivery_updated_at, wishlist_blank`; `FROM members m JOIN
  users u ON u.tg_id = m.user_id WHERE m.event_id = ? ORDER BY m.joined_at` — как прежняя выборка), `panelMembersQuery`
  (`has_wishlist`, `has_delivery` через `NOT BLANK_SQL`; `NULL` — «нет»), `participantCountQuery`, `memberIdsQuery`,
  `participantIdsQuery`, `unfilledIdsQuery`, `pairLinksQuery`, `panelPairsQuery` (`seen_text IS NOT NULL AS seen`) и
  построители прежних чтений пар, исключений, закреплённых пар, семей, прошлых пар (`contracts/api-actions.md` §4)
- [ ] T025 [P] [US2] `tests/unit.test.mjs`: паритет пустоты — для каждого n от 1 до 65535 (без суррогатов) значение
  `BLANK_SQL` над `char(n)` в `node:sqlite` = `!String.fromCharCode(n).trim()`; плюс строки из нескольких пробельных,
  пустая строка, `NULL` в `panelMembersQuery`
- [ ] T026 [US2] `src/pairs.js`: `checkDraw` — один пакет (`drawMembersQuery`, исключения, семьи, прошлые пары, закреплённые
  пары); пустые письма — по `wishlist_blank`, `lastUpdate` — по временам; `runDraw` — те же чтения и настройки из
  контекста; `removeMember` / `insertMember` — чтения перед перестройкой пар одним пакетом, человек — из `ctx.users()`,
  лишняя проверка участия убирается, если её даёт пакет; в `insertMember` пары — полные (`insertRank` смотрит
  `seen_text`); порядок участников и состав переданного в `planDraw` / `insertIntoAssignment` — прежние
- [ ] T027 [US2] `src/panel.js` `adminState`: одно `ctx.read({ … , users: true })` — участники (`panelMembersQuery`),
  пары (`panelPairsQuery`), исключения, закреплённые пары (только владельцу), семьи, заявки, удалённые, объявления,
  расписание, обращения (`adminListQuery` + `adminListView`, `supportCountsQuery`); ответ — те же поля и порядок
- [ ] T028 [US2] `src/participant.js`: `homeView` — пакет (события, участия, непрочитанные, обращения; админу — с
  пользователями); `eventView` — пакет (`participantCountQuery`, объявления, пары, непрочитанные, обращения)
- [ ] T029 [US2] `src/support.js`: пакеты «обращение + сообщения», «пользователи + обращение»; `adminList` → `adminListQuery`
  + `adminListView`; `supportCounts` / `supportUnreadByEvent` → запрос + разбор; настройки и пользователи — из контекста
- [ ] T030 [US2] `src/events.js` (`finishEvent`, `announce`, `inviteFromEvent`, `deleteEvent`, `resetEvent`,
  `remindUnfilled`) — получатели узкими выборками (`memberIdsQuery`, `participantIdsQuery`, `unfilledIdsQuery`);
  `revealAll`, `vaultPairs` — `pairLinksQuery`; повторные чтения события внутри атомарных действий и после неудачного
  захвата — остаются; `src/cron.js` — настройки читаются, только если есть что отправлять
- [ ] T031 [US2] `tests/queries.test.mjs`: новые числа «не больше» по факту (`node tests/bench/queries.mjs`), проверка
  порогов файла шага (`admin.state` ≤ 6, `admin.draw.check` ≤ 6, `admin.draw` ≤ 10, `admin.remove` ≤ 12, `admin.insert`
  ≤ 11, действия обращений — базовое − 2, остальные ≤ базовых), запросы к Telegram — прежние
- [ ] T032 [US2] `npm test`; `npm run bench:draw` ×2 — медианы не выше «до» больше разброса; `tests/draw-golden.test.mjs`
  без пересоздания эталона; коммит «019 US2: …»

**Checkpoint**: пороги выполнены, ответы прежние, гонки по-прежнему проверяются.

---

## Phase 6: User Story 4 — Попутные мелочи в затронутых файлах (Priority: P3)

**Goal**: побайтно одинаковые тексты и разметка — в одном месте (research R9).

**Independent Test**: `npm test` (слова, эталон отказов, запросы) зелёный; тексты сообщений побайтно те же.

- [ ] T033 [P] [US4] `src/format.js`: `NOT_REGISTERED`, `ADMIN_ONLY`, `NO_DRAW`, `PAIRS_RACE` и `appKeyboard(settings, text,
  params)` → `{ reply_markup: { inline_keyboard: [[openAppButton(…)]] } }`; замена в `src/api.js`, `src/bot.js`,
  `src/events.js`, `src/pairs.js` и местах «одна кнопка приложения» (порядок ключей сообщения прежний)
- [ ] T034 [P] [US4] `src/chat.js` `tooLong(n)` (письмо, переписка, обращения); `src/membership.js` `requestRejected(ev)`
  (бот и модуль) и `joinedNoticeStmts(db, users, user, ev)` — рассылка «… присоединяется к событию» для `joinByInvite`
  и ввода имени в боте
- [ ] T035 [US4] `src/bot.js`: `registrationClosed(ev)`, `REPLY_EXPIRED`, `parsePending` / `replyPending` /
  `supportPending` (старый `msg_<сторона>:<событие>` без собеседника → «время ответа истекло»); четыре разных «Событие
  завершено больше недели назад…» не объединять
- [ ] T036 [P] [US4] `src/setup.js` (новый): страница `/setup` из `src/index.js` без правок текста и заголовков;
  `src/index.js` импортирует её
- [ ] T037 [P] [US4] `src/db.js`: `updateUserStmt` / `updateEventStmt` с пустым набором полей — `throw new Error(…)`;
  имена для журнала исключений — из `ctx.users()` (`src/constraints.js`)
- [ ] T038 [US4] `npm test`; `node tests/bench/queries.mjs` — числа US2 не выросли; коммит «019 US4: …»

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T039 [P] `CLAUDE.md`: строка `019-api-actions` в таблице фич; «Структура» — `src/api.js` (таблица `ACTIONS`,
  конвейер, без SQL), `src/context.js`, `src/status.js`, `src/constraints.js`, `src/participant.js`, `src/panel.js`,
  `src/setup.js`, `readMany`/узкие чтения/`BLANK_SQL` в `src/db.js`; жёсткое правило «владелец ⊇ админ»: e2e-автотест и
  тест прав берут список из `ACTIONS`; новое действие — строка таблицы (роль, событие, «в завершённом»); `tests/` —
  `api-table`, `api-refusals` (эталон не пересоздавать), пакет чтений в подмене D1
- [ ] T040 [P] `docs/refactoring-roadmap.md`: статус шага 4 «выполнен (019, 2026-11-14)»;
  `docs/refactoring/step-4-api-table-context.md` — пометка в начале «Выполнен в 019»
- [ ] T041 [P] `docs/refactoring/baseline.md`: числа запросов после шага 4 (раздел 3), `npm test` после шага 4 (раздел 1),
  замер жеребьёвки «после» (раздел 2)
- [ ] T042 [P] README: проверить, что установка, настройка, секреты, команды, роли и использование не изменились — правка
  не нужна (Конституция: задача на README в каждой фиче)
- [ ] T043 Память проекта (`refactoring-roadmap.md` в памяти): шаг 4 выполнен (019), опоры — `ACTIONS`, контекст
- [ ] T044 `npm test` 5 раз подряд — зелёный; коммит «019 docs: …»
- [ ] T045 `npm run test:e2e` — 8 сценариев зелёные, журнал без `budget exceeded`
- [ ] T046 Слияние в `main` (`--ff-only`), `git push` ветки и `main`; `git branch -a --no-merged main` пуст

---

## Dependencies & Execution Order

- **Phase 1**: T002 → T003 строго до любой правки `src/` (эталон снимается на прежнем коде).
- **Phase 2**: T004, T005, T006 — разные файлы, параллельно; T007 — после T005 (читает построители).
- **Phase 3 (US1)** — после Phase 2: T009 → T010; T011–T013 — после T009 (импортируют `ACTIONS`), параллельно.
- **Phase 4 (US3)** — после Phase 3: T015–T017 — новые файлы, параллельно; T018–T021 — после них (сигнатуры меняются
  вместе с вызывающими); T022 — последним.
- **Phase 5 (US2)** — после Phase 4: T024, T025 параллельно; T026–T030 — после T024; T031 — после T026–T030.
- **Phase 6 (US4)** — после Phase 5 (числа запросов уже зафиксированы): T033, T034, T036, T037 параллельно; T035 — после
  T033–T034.
- **Phase 7**: T039–T043 параллельно; T044 → T045 → T046.

### Parallel Opportunities

- T004, T005, T006 — `src/status.js`, `src/db.js`, подмена D1.
- T011, T012, T013 — три тестовых файла.
- T015, T016, T017 — три новых модуля.
- T024, T025; T033, T034, T036, T037; T039–T042.

## Parallel Example: Phase 4

```bash
Task: "src/constraints.js — исключения и закреплённые пары из api.js, familyExclusions и снимки из db.js"
Task: "src/participant.js — me, event.get, письмо, адрес, подопечный, отметки подарка"
Task: "src/panel.js — admin.state, admin.wishlist, admin.users"
```

## Implementation Strategy

1. Эталон отказов на прежнем коде → коммит (без него «ответы те же» не доказать).
2. Основа + US1: таблица и конвейер → коммит. Это MVP шага: права — одной строкой, тесты прав и e2e — из таблицы.
3. US3: логика в модули, контекст в сигнатурах → коммит.
4. US2: пакеты и узкие чтения, новые пороги → коммит.
5. US4: мелочи → коммит.
6. Polish: документы, e2e, слияние.

Остановиться и спросить владельца, если: эталон отказов, тест прав, тайны или атомарности падает и это не ошибка
перевода; порог запросов не достигается без изменения условий захватов или состава пакетов записи; нужно менять схему
или Конституцию. Если шаг не помещается в одну сессию — закончить на зелёных тестах, закоммитить, продолжить с этого
файла.

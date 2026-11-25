# Tasks: 063. События без комнат

**Input**: `specs/063-events-without-rooms/` — spec.md, plan.md, research.md, data-model.md,
contracts/events-without-rooms.md, quickstart.md

**Tests**: нужны (Конституция VI, правила проекта: `npm test` перед коммитом, «от противного» у каждого правила).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Один Worker: `src/`, `migrations/`, `tools/`, `tests/`, `docs/` в корне. Словари — `src/i18n/<язык>/` (11 языков: ru,
en, es, pt, fr, de, zh, it, tr, id, pl). Во время работы над сервером и приложением тексты пишутся в `ru`; перевод
остальных 10 — фаза 11 (тест `i18n` зелёный только после неё). Внутренний термин «компания» в коде и спецификациях
остаётся только там, где речь о прежних данных (миграция, сверка, история журнала).

## Phase 1: Setup (данные)

- [X] T001 Миграция `migrations/0024_events_without_rooms.sql` по `data-model.md`: комментарий (063: применять до выката
  кода, прежний код со схемой 24 работает; после выката — `tools/rooms-reconcile.sql`; таблицы комнат остаются ради
  отката); `ALTER TABLE events ADD COLUMN owner_id INTEGER NOT NULL DEFAULT 0`; `ALTER TABLE users ADD COLUMN can_create
  INTEGER NOT NULL DEFAULT 0`; `CREATE TABLE event_admins (event_id, user_id, created_at, PRIMARY KEY (event_id,
  user_id))`; `CREATE TABLE event_creations (event_id INTEGER PRIMARY KEY, user_id, created_at)`; индексы
  `event_admins_user (user_id)`, `event_creations_user (user_id, created_at)`, `events_owner (owner_id, created_at)`,
  `audit_bot (id) WHERE event_id = 0`; заполнение по порядку: 1) `owner_id` = `companies.owner_id` комнаты события, если
  не 0, иначе `settings.owner_id` (число), иначе 0; 2) `event_admins` — `INSERT OR IGNORE` администраторов комнаты
  (`company_members.is_admin = 1`, `created_at` = `joined_at`) и владельца (`owner_id != 0`, `created_at` =
  `events.created_at`) для каждого события, включая завершённые; 3) `event_creations` — `INSERT OR IGNORE … SELECT id,
  created_by, created_at FROM events WHERE created_by != 0`; 4) `users.can_create = 1` — администраторам комнат и
  назначенным владельцам комнат; 5) `settings.schema = 24`
- [X] T002 `tools/rooms-reconcile.sql`: комментарий (сверка после выката 063 и после возврата к 063 с прежнего кода;
  идемпотентна; события, созданные прежним кодом между миграцией и выкатом — `owner_id = 0 AND company_id != 0`);
  операторы 1–4 миграции, ограниченные такими событиями (и `event_creations` — для всех, `INSERT OR IGNORE`), без
  версии схемы
- [X] T003 `src/db.js`: `REQUIRED_SCHEMA = 24`; `REGISTRY`: `events.people` — `{ created_by: ACTOR, owner_id: ACTOR }`,
  новые `event_admins` (`event: 'event_id'`, `people: { user_id: MEMBER }`, `onEventDelete: 'delete'`, `onLeave: 'keep'`,
  `onTransfer: 'dedupe'`) и `event_creations` (`event: 'event_id'`, `people: { user_id: ACTOR }`, `onEventDelete:
  'keep'`, `onTransfer: 'update'`); `users.transferBefore` — ещё `can_create` (MAX); убрать `onCompanyDelete` у всех
  таблиц и `companyDataDeleteStmts`; ключ `company` у таблиц — только описание колонки (комментарий: 063 — комнаты не
  используются, таблицы ради отката); проверить, что `onLeave: 'keep'` поддержан построителями (иначе — добавить)

## Phase 2: Foundational (сервер без комнат)

**Цель**: контекст события вместо контекста компании, конвейер API без компаний, все модули работают от события;
приложение ещё прежнее по виду. Блокирует все истории.

- [X] T004 `src/db.js` — запросы людей события: `eventUsersQuery(db, eventId)` — участники ∪ организаторы события
  (`event_admins`), поле `is_admin` — строка организатора; владелец бота без строки — гость (`guest: true, is_admin: 0`),
  как `companyUsersQuery` в 050; `eventUsersFrom` вместо `companyUsersFrom`; `EVENT_ADMIN` вместо `COMPANY_ADMIN` в
  `panelMembersQuery` и `peopleQuery` (`EXISTS (SELECT 1 FROM event_admins …)`); удалить `companiesQuery`,
  `companyQuery`, `myCompaniesQuery`, `companyUsersQuery`, `companyEventsQuery`, `joinCompanyStmt`
- [X] T005 `src/db.js` — `adminFlagStmt(db, userId)`: `is_admin = EXISTS (event_admins по человеку) OR владелец бота
  (settings.owner_id)`; `myEventsQuery` — участник ∪ организатор, с ролью (`owner` по `events.owner_id`, `admin` — строка
  `event_admins`, иначе `member`), по индексам; `eventsQuery` — без `company_id`
- [X] T006 `src/db.js` — журнал: `auditSphere` — число (событие) или `BOT_LOG`, `{ company }` — ошибка; все вставки
  `audit` пишут `company_id = 0` явно (умолчание колонки — 1); `getAudit(db, sphere, …)` — событие или `BOT_LOG` (`WHERE
  event_id = 0`, индекс `audit_bot`); прямые `INSERT INTO audit` в модулях (`src/events.js`) — через `auditStmt` или с
  `company_id = 0`
- [X] T007 `src/context.js`: убрать `companies()`, `company()`, `mine()`, `soleCompany()`, `in()`, `bindCompany`, чтения
  компаний из первого пакета `openContext` (`me`, `settings`, запись владельца бота — как были); новый `ctx.at(ev)` —
  привязанный контекст события (один на событие за вызов): `event`, `me.is_admin` (организатор этого события или владелец
  бота), `users()` (`eventUsersQuery`), `ownerId()` (`ev.owner_id || botOwnerId()`), `isOwner()` (владелец события или
  владелец бота), `ownerWord()` (`owner_id = 0` → «владелец бота»), `read({ users })`; у общего контекста `users()`,
  `ownerId()`, `isOwner()`, `ownerWord()` — ошибка «контекст без события»; `forgetUsers()` — сброс кэша людей событий
- [X] T008 Новый `src/creation.js`: `openBot(env)` (перенос из `companies.js`, единственное чтение `OPEN_BOT`),
  `LIMIT_EVENTS = 10`, `LIMIT_MS = 365 * 86400000`, `canCreate(ctx)` (владелец бота; открытый бот — любой
  зарегистрированный; закрытый — `can_create = 1`), `creationsQuery(db, userId, since)` (счёт и `MIN(created_at)` окна),
  `createView(ctx)` → `{ bot: true }` | `{ left, limit, next }` | `null`, условие вставки `createGuard(ctx, now)` (SQL и
  параметры: разрешение в закрытом боте, лимит — кроме владельца бота)
- [X] T009 `src/api.js` — конвейер: убрать признак `company`, `ctx.in`, «Выбери комнату.»; с событием — `ctx.at(ev)`;
  организатор другого события: участник этого события — 403 `ADMIN_ONLY`, иначе 404; действие без события с ролью
  `OWNER` и `bot: true` — `ctx.isBotOwner()`, иначе 403 текстом `owner`; импорт `openBot` — из `src/creation.js`
- [X] T010 `src/participant.js`: `menuEvents` — без `company_id`; `homeView` — без `companies`, `events[].company`;
  события с `role`, `create` — `createView`; `eventView` — без `event.company`, `event.role` (`owner` | `admin` | `member`
  | `guest`); `rosterView` — организаторы и роли по событию (`ctx.at(ev).users()`), импорты из `companies.js` убрать
- [X] T011 `src/panel.js`: `adminState` — `users[].is_admin` по событию, `organizers` (владелец первым, остальные по
  имени), `other_events` — события, где вызывающий организатор (владелец бота — ещё события владельца этого события),
  без текущего; `settings.owner_id`; удалить `companyCountQuery`; `usersList` — только для `bot.people` (или удалить, если
  не нужен); `renameUser(ctx, target, name, actor)` — журнал бота `rename` при изменении
- [X] T012 `src/support.js`: `supportCountsQuery` — число организаторов события по `event_admins`; `supportUnreadQuery` —
  ничьи в событиях, где он организатор; `returnThreadsStmts(db, settings, users, adminId, eventId, guard)` — по событию
- [X] T013 `src/membership.js`: без `joinCompanyStmt` (строки вступления, заявок, «Я участвую», возврата); `decideRequest`
  — `ctx.at(ev)` вместо `ctx.in(req.company_id)`; `leaveEvent` — получатели по организаторам события
- [X] T014 `src/pairs.js`: `previousPairsQuery` — `WHERE e.owner_id = ? AND p.event_id != ? AND e.created_at <= ?`
  (параметр — `ev.owner_id`), правило выбора прежнее (R7)
- [X] T015 `src/stale.js`: `dailyEventsQuery` — `outsiders` без `company_members`: участники, кроме организаторов
  события (`event_admins`) и владельца бота; `warnStale` — получатели `adminRecipients` из `ctx.at(ev).users()`;
  `src/cron.js` — `ctx.at(ev)` вместо `inCompany`, `openBot` из `src/creation.js`
- [X] T016 `src/events.js`: `deleteEvent` — журнал бота `event.delete` (`«<название>», участников: <n>`) вместо `{ company
  }`, после удаления строк `event_admins` — `adminFlagStmt` организаторов; приглашение из события и прочие пути — через
  `ctx.at(ev)`; `resetEvent` не трогает `event_admins`, `owner_id`, `event_creations`
- [X] T017 `src/roles.js`: `resolveOwner` — запасной поиск владельца бота по организаторам событий с `owner_id = 0` (не по
  компаниям); `setOwner` — без `companies`/`company_members` (журнал бота, флаги); `transferBotOwnership` — цель любой
  зарегистрированный, кроме себя; `transferAccount` — без компаний: проверка цели по общему признаку `is_admin` и
  владельцу бота, сообщения — организаторам событий старой записи, журнал бота `transfer`; `grantAdmin`/`revokeAdmin` —
  через `event_admins` (подробно — US3)
- [X] T018 `src/bot.js`: `ctx.at(ev)` вместо `ctx.in(ev.company_id)` везде; `onInvite`/`memberWithCompany` — без
  `joinCompanyStmt` и чтения компании; меню — без `menuCompanyTitles` и `bot.menu.eventInRoom`; `/start own_…` и
  `name_own:…` — US4 (T047)
- [X] T019 Удалить `src/companies.js`; `src/i18n/ru/companies.js` → ключи, ещё нужные (журнал бота, `botAudit`), — в
  `src/i18n/ru/bot-owner.js` (новая область `botOwner`, строка в `AREAS` `ru/index.js`); прочие ключи компаний — удалить;
  `src/api.js` — убрать строки `company.label.set`, `company.create`, `company.delete`, `bot.company.create`,
  `bot.company.link`, `bot.company.delete`, `admin.users`
- [X] T020 `tests/support/companies.mjs` → `tests/support/events.mjs`: помощники «два владельца, организаторы, гость»
  (`addOwner`, `grant`, `invariants` E1–E4 по `data-model.md`); `tests/support/world.mjs` — без компании 1 в начальных
  данных сценариев (события создаются владельцем); `tests/support/queries-scenario.mjs`,
  `tests/support/refusals-scenario.mjs` — события без `company`
- [X] T021 Прогон `npm test`: поправить тесты, падающие только из-за удалённых полей (`company`, `companies`) и запросов;
  тесты компаний (`companies`, `companies-manage`, `open-bot`, `app-companies`) — пометить к замене в US1–US6 (до замены —
  убрать из `package.json`, вернуть новыми файлами)

**Checkpoint**: сервер работает без компаний, `npm test` (кроме `i18n`, приложения и заменяемых тестов) зелёный.

## Phase 3: User Story 1 — главный экран «Мои события» (P1) 🎯 MVP

**Goal**: первый экран — свои события с ролями, «Завершённые» свёрнуты, «Создать» закреплена внизу.

**Independent Test**: человек — участник А, организатор Б, владелец В → видит ровно А, Б, В с ролями; порядок по дате
вручения; владелец бота — только свои.

- [X] T022 [P] [US1] Дизайн-система: токены и компоненты `ds-bottom-bar` (закреплена внизу, фон страницы, отступ
  `env(safe-area-inset-bottom)`), `ds-page--bar` (нижний отступ страницы под панель), `ds-hero__action` (кнопка справа в
  шапке) — `design-system/tokens.css`, `design-system/components.css` (базовые — через `:where()`),
  `design-system/preview.html`, `design-system/README.md` (версия дизайн-системы +1 minor)
- [X] T023 [US1] `src/app/02-core.js.txt`: убрать `capi`, `withList`, `companyTitle`, `ownerWord(botRun)` → `ownerWord()` по
  `state.ev.owner_id`/роли события; `api` — без поля `company`
- [X] T024 [US1] `src/app/03-home.js.txt`: `state` — без `companies`, `companyId`, `company`; `view` — `home` | `settings` |
  `event`; убрать `enterCompany`, `goCompanies`, `openCompany`, `personalSections` с главного экрана, `renderAdminsSection`;
  `renderHome` — шапка (приветствие, ⚙️ `ds-hero__action` → `goSettings`), «Идут» по дате вручения (без даты — в конце,
  новые первыми), «Завершённые · N» в `ds-details` (свёрнуто), `eventRow` с ролью (`app.core.role.owner`/`admin`), датой,
  непрочитанными; пусто — подсказка по `state.create`; `ds-bottom-bar` с «🎄 Создать событие» при `state.create` и
  `ds-page--bar` у страницы; `goBack`/`goHome` — к списку
- [X] T025 [US1] `src/app/03-home.js.txt` — `openEvent`: права из `event.get` — `enterEvent(role)` (пишет `state.me.is_admin`,
  `is_owner` события; владелец бота — права владельца везде), «‹» — к списку; `src/app/09-start.html` — без `listFirst`,
  `enterCompany` и автооткрытия единственного события; ссылка `/app?event=` открывает событие сразу
- [X] T026 [US1] Удалить `src/app/04-companies.js.txt` и строку в `src/app-page.js` (часть `04-settings` — US7)
- [X] T027 [US1] Тексты главного экрана — `src/i18n/ru/app-home.js` (`app.home.*`: «Идут», «Завершённые · {n}», пусто с
  правом и без, «Создать событие»), удалить `app.home.admins.*`, ключи компаний в `app-core.js`
- [X] T028 [US1] Тест `tests/app-home.test.mjs` (по склейке): кнопка «Создать» только в `ds-bottom-bar` и только при
  `state.create`; порядок «Идут» (чистая функция сортировки из склейки на примерах); «Завершённые» — `ds-details`; нет
  экрана компаний и слов `company`/`companies` в склейке, кроме удалённых; «от противного»; заменяет
  `tests/app-companies.test.mjs` (удалить, строка в `package.json`)
- [X] T029 [US1] Тест сервера `tests/event-owners.test.mjs` — часть «главный экран»: `me.events` у участника, организатора,
  владельца, владельца бота (только свои), роли, без чужих; `me` без `companies`

## Phase 4: User Story 2 — создание события и лимит (P1)

**Goal**: создать событие может тот, кому можно; лимит 10 за 365 суток в условии записи.

**Independent Test**: незнакомец открытого бота → имя → «Создать» → ссылка; 11-е создание — отказ с датой; два
одновременных у границы — одно.

- [X] T030 [US2] `src/events.js` — `createEvent(ctx, title, createdBy, { from, invite, participate })`: вставка события с
  `company_id = 0`, `owner_id = createdBy` и условием `createGuard` (T008); по коду приглашения — `event_admins`
  создателя, `event_creations`, участие (`participate`, по умолчанию `true`), исключения образца, журнал события
  `event.create` (по образцу — «по образцу «…»»), журнал бота `event.create` («<название>»), `adminFlagStmt` создателя;
  проигравшему — отказ по свежему состоянию (разрешение снято → текст разрешения, иначе лимит с датой)
- [X] T031 [US2] `src/api.js`: строка `event.create` (роль `USER`, без события) вместо `admin.events.create`; обработчик —
  проверки по порядку контракта (разрешение, название, образец — событие, где вызывающий организатор, владельцу бота —
  любое, лимит по свежему счёту), ответ `event` (`publicEvent` + `role: 'owner'`), `invited`, `invite_error`
- [X] T032 [US2] `src/bot.js`: незнакомец открытого бота после имени — «создай своё событие в приложении или попроси
  ссылку» (без «комнаты»); `bot.createFirstEvent` — при `canCreate`; меню без идущих событий — текст по `canCreate`
- [X] T033 [US2] Приложение: шторка создания в `src/app/03-home.js.txt` (`openCreateSheet`): название, образец (события с
  ролью `owner`/`admin`), «Пригласить участников образца», «Я тоже участвую» (вкл.), подсказка «Можно создать ещё {n}» /
  «Предел: следующее — {date}», кнопка недоступна при `left = 0`; после создания — открыть новое событие; `busy`
- [X] T034 [US2] Тексты — `src/i18n/ru/events.js` (отказы лимита и разрешения, журнал бота), `src/i18n/ru/api.js`,
  `src/i18n/ru/bot.js`, `src/i18n/ru/app-home.js` (`app.home.create.*`)
- [X] T035 [US2] Тест `tests/event-create.test.mjs`: открытый бот — любой создаёт, участие вкл./выкл., образец своего и
  чужого события, история пар нового события — по владельцу; лимит — 10 проходят, 11-е — отказ с датой (часы мира),
  через 365 суток — снова можно, удалённые и переданные считаются, владелец бота без лимита; закрытый бот — без
  разрешения отказ, с разрешением можно; незнакомец открытого бота — имя → создание; `me.create` во всех случаях; «от
  противного» (условие лимита убрано — тест падает)
- [X] T036 [US2] `tests/atomic.test.mjs`: два создания у границы лимита (9 создано) в обоих порядках — одно событие,
  второму отказ лимита; создание ↔ снятие разрешения — один результат

## Phase 5: User Story 3 — владелец и организаторы события (P1)

**Goal**: владелец назначает, снимает организаторов и передаёт владение; права организатора — только в его событии.

**Independent Test**: владелец назначает участника; тот управляет только этим событием; передача владения меняет роли.

- [X] T037 [US3] `src/roles.js`: `grantAdmin(ctx, ev, id)` — `atomic` по прежнему состоянию «строки нет»: только
  зарегистрированный участник события; сообщения назначенному (кнопка события) и остальным организаторам без звука,
  журнал события `role.grant` → вставка `event_admins` (захват) → `adminFlagStmt`; `revokeAdmin` — «строка есть, не
  владелец»: `returnThreadsStmts` по событию, сообщения, журнал `role.revoke` → удаление строки (захват) →
  `adminFlagStmt`; `transferEventOwner(ctx, ev, id)` — по прежнему владельцу: строка `event_admins` нового → сообщения
  (новому; прежнему, если передал не он; остальным без звука) → журнал `event.owner` («→ <имя>») → `owner_id` (захват) →
  `adminFlagStmt` обоих; отказы — контракт §2
- [X] T038 [US3] `src/api.js`: `admin.role.grant`, `admin.role.revoke`, `admin.owner.transfer` — действия события (`event:
  true`, `OWNER`, в завершённом — да), отказ не владельцу — тексты контракта; `admin.rename` — только владелец бота
  (`OWNER`, `bot: true`, отказ `api.botOwner.rename`); `admin.event.invite_from` — источник по организаторству
- [X] T039 [US3] Приложение `src/app/06-admin.js.txt`: секция `adminOrganizers(p)` «Владелец и администраторы» (место —
  перед «Опасной зоной»): `p.d.organizers` (владелец 👑 первым), ✕ и 👑 — владельцу, «Назначить администратором» из
  участников-неорганизаторов, «Передать владение» из участников и организаторов (подтверждение `confirmBox`), не
  владельцу — «Назначает администраторов владелец события — <имя>.»; после ответа — `refresh({ quiet: true })`;
  `canRename` — только `state.botOwner`; `canRemove`/`canTransfer` — по роли события; `other_events` — из ответа
- [X] T040 [US3] Тексты — `src/i18n/ru/roles.js` (сообщения, отказы, журнал), `src/i18n/ru/app-admin.js`
  (`app.admin.admins.*`), `src/i18n/ru/app-vault.js` (подписи `event.owner`, `creator.*`)
- [X] T041 [US3] `tests/event-owners.test.mjs` — права: организатор А не видит событие Б того же владельца (404; участник Б
  — 403), назначение только участника, снятие не владельца, передача владения (роли, сообщения, журнал), снятие
  возвращает обращения, событие пропадает из списка снятого неучастника; инварианты E1–E4 после каждого шага
- [X] T042 [US3] `tests/rights.test.mjs`: роли — владелец бота, владелец события, организатор события, организатор
  другого события, участник; список `admin.*` — из `ACTIONS`; «владелец бота ⊇ владелец события ⊇ организатор»;
  организатор другого события — 404/403 на каждом действии (SC-004); `admin.rename`/`admin.transfer` — только владелец
  бота
- [X] T043 [US3] `tests/atomic.test.mjs`: назначение ×2, снятие ×2, назначение ↔ снятие, передача владения ×2 (одному и
  разным) — один результат, одна запись журнала, одно сообщение; убрать случаи компаний (050–052)
- [X] T044 [US3] Замена `tests/companies.test.mjs` и `tests/companies-manage.test.mjs` на проверки событий в
  `tests/event-owners.test.mjs` (статические правила: права не из `users.is_admin` в SQL модулей, кроме разрешённых мест;
  нет `company_members`/`companies` в `src/*.js` вне комментариев; сфера журнала — событие или `BOT_LOG`); удалить
  старые файлы и строки в `package.json`

## Phase 6: User Story 4 — перенос ничего не отнимает (P1)

**Goal**: после миграции права, история пар и лимит совпадают с прежними; `own_` не действует.

**Independent Test**: база «как у 062» с несколькими комнатами → после `0024` права «человек — событие» совпадают.

- [X] T045 [US4] `tests/migrations.test.mjs` — `0024`: база «как у 062» (миграции до `0023`, данные: комната владельца
  бота, комната с назначенным владельцем, администраторы, завершённые события, события без создателя, пустой бот) →
  после `0024`: `owner_id`, `event_admins`, `event_creations`, `can_create` по правилу; прочие строки прежние; повтор
  сверки `tools/rooms-reconcile.sql` ничего не меняет и переносит событие, созданное «прежним кодом» после миграции;
  индексы на месте; «от противного»
- [X] T046 [US4] Тот же тест — права до и после: для каждой пары «человек — событие» роль 062 (владелец комнаты /
  админ комнаты / участник) = роль 063; «не повторять пары» выбирает те же прошлые пары (события одной комнаты с одним
  владельцем)
- [X] T047 [US4] `src/bot.js`: `/start own_<код>` — текст «ссылка больше не действует» и меню (незнакомцу закрытого бота —
  `CLOSED_BOT`, открытого — просьба имени); `name_own:…` после имени — обычная регистрация и тот же текст; убрать
  `onCompanyOwnerLink`, `signUpOwner`, `OWNER_PENDING`; тексты — `src/i18n/ru/bot.js`
- [X] T048 [US4] `tests/signup.test.mjs` / `tests/event-owners.test.mjs`: прежняя ссылка `own_` прав не даёт, ожидание
  `name_own:` — регистрация без прав

## Phase 7: User Story 5 — закрытый бот: кто создаёт (P2)

**Goal**: владелец бота разрешает и запрещает создавать события.

**Independent Test**: без разрешения нет кнопки и отказ; разрешение → кнопка и создание.

- [X] T049 [US5] Новый `src/bot-owner.js`: `setCreator(ctx, id, on)` — `atomic` по прежнему значению: открытый бот — отказ;
  только зарегистрированный; сообщение человеку, журнал бота `creator.grant`/`creator.revoke` (имя) → `can_create`
  (захват); `peopleView(ctx)` — `bot.people` (закрытый бот — все зарегистрированные по имени, открытый — люди событий, где
  владелец бота организатор, кроме него), поля `{ id, name, username, can_create }`
- [X] T050 [US5] `src/api.js`: строки `bot.people`, `bot.creator.set` (роль `BOT`)
- [X] T051 [US5] Приложение (часть `04-settings`, T058): шторка «✍️ Кто может создавать события» — `bot.people`,
  переключатели `ds-switch`, `busy`; только в закрытом боте
- [X] T052 [US5] Тексты — `src/i18n/ru/bot-owner.js`, `src/i18n/ru/app-settings.js`
- [X] T053 [US5] Тест `tests/bot-owner.test.mjs` — разрешения: без разрешения — отказ и нет `me.create`; разрешение →
  сообщение, журнал, создание; снятие — созданные остаются; открытый бот — отказ действия; не владельцу бота — 403;
  `atomic`: разрешение ×2 — один результат

## Phase 8: User Story 6 — владелец бота: журнал, передача, все события (P2)

**Goal**: раздел «Владелец бота» в «Настройках».

**Independent Test**: «Все события» — все события страницами по 50, открытие с правами владельца; журнал бота — записи
по контракту и прежние общие записи.

- [X] T054 [US6] `src/bot-owner.js`: `eventsPage(ctx, offset)` — `bot.events` (новые первыми, `LIMIT 51 OFFSET ?`,
  `owner_name`, `people`), `botAudit` — `getAudit(db, BOT_LOG, …)`; `src/api.js` — строка `bot.events`; `bot.audit` —
  через `bot-owner.js`
- [X] T055 [US6] `src/roles.js` — `bot.owner.transfer`: цель любой зарегистрированный, кроме себя; журнал бота; события и
  организаторство не меняются, флаги `is_admin` обоих пересчитываются
- [X] T056 [US6] Приложение (`04-settings`): раздел «Владелец бота» — «📜 Журнал бота» (`openAudit` с `BOT_LOG`),
  «👑 Передать права владельца бота» (кандидаты — `bot.people`), «🗂 Все события» (шторка, «Показать ещё», нажатие —
  `openEvent`); гость в событии — плашка (`app.event.guest`); `src/app/07-vault-audit.js.txt` — `openAudit(evId)` только
  событие или журнал бота
- [X] T057 [US6] `tests/bot-owner.test.mjs` — `bot.events` (страницы, порядок, `more`), открытие чужого события
  владельцем бота — гость (нет в `users`, получателях, своём списке; журнал под его именем), журнал бота — коды
  контракта §4 и прежние записи комнат (база с историей), передача прав владельца бота — лимит появляется у прежнего и
  пропадает у нового; не владельцу бота — 403

## Phase 9: User Story 7 — «Настройки» для всех (P2)

**Goal**: профиль, язык, уведомления, «О боте» — на отдельном экране.

**Independent Test**: смена имени, языка, режима в «Настройках» — тот же результат, что раньше на главном экране.

- [X] T058 [US7] Новая часть `src/app/04-settings.js.txt` (`renderSettings`): «Профиль» (`openNameSheet`), «🌐 Язык»
  (`openLangSheet`), «Уведомления» (режим + пояснение `app.settings.notify.hint`), «О боте» («Как это работает»,
  `donateSection` в открытом боте), раздел «Владелец бота» (US5, US6); «‹» — к списку; строка в `src/app-page.js`;
  `profileChanged` — обновление на месте
- [X] T059 [US7] Перенос `openNameSheet`, `openLangSheet`, `langLabel`, режима уведомлений из `03-home` в `04-settings`
  (без копий; правило `app-ui` — одна шторка)
- [X] T060 [US7] Тексты — `src/i18n/ru/app-settings.js` (область `app-settings`, строка в `AREAS`), удалить
  `src/i18n/ru/app-companies.js`
- [X] T061 [US7] `tests/app-home.test.mjs` — «Настройки»: на главном экране нет «Профиля», «Уведомлений»,
  «Администраторов»; «Поддержать проект» только при `state.open`; `tests/names.test.mjs`, `tests/donate.test.mjs`,
  `tests/poll-drafts.test.mjs` — по новому месту

## Phase 10: User Story 8 — журналы (P3)

**Goal**: журнал события и журнал бота, без общих журналов комнат.

- [X] T062 [US8] `src/i18n/ru/app-vault.js`: подписи кодов `event.owner`, `creator.grant`, `creator.revoke`; прежние
  `company.*` — с пометкой «история» (видит только владелец бота); `AUDIT_HISTORY` — при необходимости
- [X] T063 [US8] `tests/event-owners.test.mjs` — журналы: назначение, снятие, передача — в журнале события; удаление
  события — журнал бота с названием и числом участников; `name.set` — без записей; `admin.audit` без события — 404
- [ ] T064 [US8] `tests/api-doc.test.mjs` проходит: коды журнала документа = коды `src/*.js`

## Phase 11: Тексты на 11 языках

- [x] T065 Сверка `ru`: `node tests/support/i18n-check.mjs` по изменённым файлам; список новых, изменённых и удалённых
  ключей (для переводчиков) — в `C:\Users\victo\AppData\Local\Temp\…\scratchpad` (не в репозиторий)
- [x] T066 [P] Перевод en, es, pt, fr, de (по языку — свой каталог `src/i18n/<язык>/`, глоссарий
  `specs/061-i18n-languages/contracts/glossary/`, «комната» нигде, «администратор» — как в языке), проверка `node
  tests/support/i18n-lang-check.mjs <язык>`
- [x] T067 [P] Перевод zh, it, tr, id, pl — то же
- [x] T068 `tests/wording.test.mjs`: правило «комнат» — слова «комната» нет в текстах для людей ни на одном языке, кроме
  подписей прежних кодов журнала (`app.vault.audit.company.*`); прежние разрешения для части `04-companies` убрать

## Phase 12: Polish & сквозные проверки

- [x] T069 `tests/api-refusals.test.mjs` + `tests/fixtures/api-refusals.json`: ответы удалённых действий убраны; изменённые
  ответы — списком в заголовке теста; новые действия — проход `063 …` (`NEW_ACTIONS_063` в
  `tests/support/refusals-scenario.mjs`); `NEW_ACTIONS_051`/`052` — без удалённых действий
- [x] T070 `tests/api-table.test.mjs`, `tests/server-shape.test.mjs` (колонка `events.owner_id` — служебная `EVENT_SERVICE`),
  `tests/data-registry.test.mjs` (новые таблицы, перенос и удаление события — строки `event_admins` уходят,
  `event_creations` остаются), `tests/claims.test.mjs`, `tests/snapshots.test.mjs`, `tests/swap.test.mjs`,
  `tests/masks-families.test.mjs` — без компаний
- [x] T071 `tests/queries.test.mjs`: `me`, `event.get`, `admin.state`, действия организатора — запросов не больше 062;
  `event.create` — по контракту; базовые числа — только вниз
- [x] T072 `tests/api-reads.test.mjs`, `tests/cron-reads.test.mjs`: планы всех операторов — без полного просмотра (кроме
  разрешённых `settings`, `outbox` и `bot.events`/`bot.people` владельца бота); «от противного» — база без индексов `0024`
- [x] T073 `tests/auto-finish.test.mjs`: правило Г — организаторы события; предупреждение — организаторам события;
  `tests/roster.test.mjs` — роли по событию; `tests/self-service.test.mjs` — выход владельца-участника оставляет
  владение; `tests/i18n-languages.test.mjs` — без компаний
- [ ] T074 `tests/e2e.test.mjs`: сценарий без компаний (создание события в приложении, назначение организатора, передача
  владения)
- [ ] T075 `tests/screenshots.mjs`: `checkHome` (список, «Создать» внизу на 320 точках, обе темы, длинный список),
  `checkSettings`, `checkOrganizers`, `checkOpenBot` (второй Worker); убрать `checkCompanies`; `tests/*.ui.mjs` —
  без компаний; нарушения CSP — 0
- [ ] T076 `docs/api.md`: 69 действий, конвейер, поля `me`/`event.get`/`admin.state`, журнал (коды и журналы), бот
  (`own_`, меню); тест `api-doc`
- [ ] T077 Конституция `.specify/memory/constitution.md` 5.0.0 (принципы I, II, VII, «Безопасность и данные», журнал
  поправок); `CLAUDE.md` — строка 063 в таблице фич, разделы «Структура» (`creation.js`, `bot-owner.js`, `04-settings`,
  `ctx.at`), «Жёсткие правила» 1, 9, 10 (события вместо компаний), миграции
- [ ] T078 README: роли (владелец события, администраторы события, владелец бота), создание событий и лимит, закрытый бот
  — разрешения, «Настройки», выкат с миграцией `0024` и сверкой `tools/rooms-reconcile.sql`
- [ ] T079 `docs/todo.md`: «Удалить мои данные», часовой пояс события, поиск во «Всех событиях», удаление таблиц комнат
  (`companies`, `company_members`, `events.company_id`, `audit.company_id`) после того, как откат на 062 не нужен
- [ ] T080 `npm run test:all` зелёный, в журнале нет `budget exceeded`; `npm run screenshots` — просмотр снимков

## Dependencies & Execution Order

- Phase 1 → Phase 2 → истории. US1–US4 (P1) — по порядку (US2 и US3 используют экран события из US1); US5–US8 —
  после US1 и US7 (часть `04-settings`, T058, нужна US5 и US6 — делать T058 раньше T051/T056).
- Phase 11 (переводы) — после того, как ключи `ru` устоялись (после US8); T066 и T067 параллельно.
- Phase 12 — в конце; T076–T079 параллельно друг другу.

## Parallel Example

- T022 (дизайн-система) — параллельно с T023–T025.
- T066 и T067 — два исполнителя, каждый в своих каталогах языков.
- T076, T077, T078, T079 — разные файлы.

## Implementation Strategy

Сервер целиком (Phase 1–2) → главный экран (US1) → создание (US2) → организаторы (US3) → перенос (US4) → владелец бота и
настройки (US5–US7) → журналы (US8) → переводы → сквозные проверки. Коммиты — по фазам, перед каждым `npm test` (до
фазы 11 — без теста `i18n` на 10 языков, это отмечается в сообщении коммита).

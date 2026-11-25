# Tasks 064: тексты и упрощение

**Input**: `specs/064-texts-cleanup/` — spec.md, plan.md, research.md, data-model.md, contracts/texts.md,
contracts/removal.md, quickstart.md. Тесты нужны (правило проекта: `npm test` перед каждым коммитом, новый тест — в
скрипт `test`).

Формат: `[ID] [P?] [Story] описание`. Словари — `src/i18n/<язык>/` для 11 языков (ru, en, es, pt, fr, de, zh, it, tr, id,
pl); каждая правка текста — во всех 11.

## Phase 1: Setup

- [ ] T001 Ветка `064-texts-cleanup`, `.specify/feature.json` → `specs/064-texts-cleanup` (сделано `/speckit-specify`)

## Phase 2: Foundational

- [ ] T002 Параметры: `delivery_on`, `contacts_on`, `finish_auto` из `EVENT_PARAMS` в `EVENT_RETIRED` в `src/event-params.js` (комментарий — 064); `publicEvent` без `delivery_on`, `contacts_on` в `src/status.js`; `admin.state.settings` без `finish_auto` в `src/panel.js`
- [ ] T003 Создание и вступление без копирования адреса: `createEvent` в `src/events.js`, вступление (строка `INSERT INTO members … delivery`) в `src/db.js`

## Phase 3: User Story 1 — События завершаются сами (P1)

**Goal**: D+3 для всех событий с датой; «без даты» — оба бота, Г 23+7, Б 53+7; без кнопки и галочки.
**Independent Test**: `tests/auto-finish.test.mjs` и `tests/texts-cleanup.test.mjs` (cron-часть).

- [ ] T004 [US1] `dueAutoAction` без `ev.finish_auto` в `src/cron.js`; `dailyStep` вызывает `staleStep` в обоих ботах, `dailyEventsQuery` без `open`
- [ ] T005 [US1] `src/stale.js`: событие с датой — `null`, `STALE = { empty: 23, age: 53, wait: 7 }`, без причины `'date'` (`WHY.date`), `dailyEventsQuery(db, { today, now })` без признака открытого бота; шапка модуля — оба бота (064)
- [ ] T006 [US1] Тексты stale на 11 языках: `stale.why.age` — «больше семи недель назад»; удалить `stale.why.date`, `stale.keep.date`; `stale.logged.date` оставить в `src/i18n/*/stale.js`
- [ ] T007 [US1] Приложение: убрать кнопку «🏁 Завершить» и подсказку из `adminDraw`, галочку `finish_auto` и подсказку `autoHint` из `adminParams`, `noDate` — только при `reveal_auto` в `src/app/06-admin.js.txt`
- [ ] T008 [US1] Обновить `tests/auto-finish.test.mjs`: правила Г/Б на границах 23/30 и 53/60 в обоих ботах, правило А не срабатывает, событие с датой завершается на D+3 при `finish_auto = 0`, закрытый бот предупреждает, дата снимает отметку

## Phase 4: User Story 2 — Без адреса, отправки и отметок подарка (P1)

**Goal**: функции убраны целиком (contracts/removal.md).
**Independent Test**: `tests/texts-cleanup.test.mjs` — неизвестные действия, ответы без полей, cron без напоминаний Сантам.

- [ ] T009 [US2] `src/api.js`: убрать строки `delivery.save`, `ward.gift`, `ward.received`, `ward.shipment`, `admin.remind.santas`, `MARK_CLOSED`, импорты `saveShipment`, `saveDelivery`, `setGiftReady`, `setGiftReceived`, `remindSantas`
- [ ] T010 [US2] `src/participant.js`: удалить `saveDelivery`, `setGiftReady`, `setGiftReceived`, `DELIVERY_MAX`, импорт `shipment.js`; `eventView.member` без `gift_received`, `delivery`, `shipment`, без чтения `giftTotalsQuery`; `wardView` без `delivery`, `gift_ready`, `shipment`, `timezone_offset_hours`; шапка модуля
- [ ] T011 [US2] Удалить `src/shipment.js`, `src/i18n/*/shipment.js` и строку области `shipment` в `AREAS` (`src/i18n/*/index.js`)
- [ ] T012 [US2] `src/events.js`: удалить `remindSantas`; `src/cron.js`: `dailyReminder` после жеребьёвки — `null`, уведомление о правке письма — только `cron.wishlistChanged`, запрос без `e.delivery_on`
- [ ] T013 [US2] `src/panel.js`: `users[]` без `gift_ready`, `gift_sent`, `gift_received`, `has_delivery`; `src/db.js`: `panelMembersQuery` без `has_delivery`, удалить `giftTotalsQuery`
- [ ] T014 [US2] `src/vault.js`: `vaultPerson` без `gift_sent` и `delivery`
- [ ] T015 [US2] Словари сервера на 11 языках: удалить `api.markClosed`, `participant.noDelivery`, `.deliveryClosed`, `.unmarkSentFirst`, `.noSanta`, `.giftReceived`, `events.remindSantas`, `.remindSantasDated`, `cron.wishlistOrDeliveryChanged` в `src/i18n/*/`
- [ ] T016 [US2] Приложение «Письмо»: убрать адрес, «Мою посылку», «Я получил(а) подарок», переход вкладки по `delivery_on` в `src/app/05-event.js.txt`; `app.home.unsaved` — «Письмо не сохранено…»
- [ ] T017 [US2] Приложение «Подопечный»: убрать адрес, «Подарок готов», `outgoingShipment`, `shipmentCard` в `src/app/05-event.js.txt`; `09-start.html` — без `shipment=1`
- [ ] T018 [US2] Приложение «Управление»: значки `ready/notReady/sent/received/address/noAddress` в `adminMembers`, строка `progress` и кнопка `remindSantas` в `adminDraw`, галочка `delivery_on` в `adminParams`, вопрос `insertConfirm` в `src/app/06-admin.js.txt`; `cancelLines`/`cancelKeep` — без отметок и адресов
- [ ] T019 [US2] Служебный просмотр: без строки отправки и раздела адреса в `src/app/07-vault-audit.js.txt`
- [ ] T020 [US2] Новый `tests/texts-cleanup.test.mjs` (в скрипт `test` в `package.json`): неизвестные действия, ответы без полей на событии с прежними данными, `admin.game` не меняет удалённые параметры, cron (напоминаний Сантам нет, один текст уведомления, D+3), по склейке — удалённые элементы, «от противного»; удалить `tests/shipment.test.mjs`, `tests/shipment.ui.mjs`, `tests/support/shipment-world.mjs` и их строки в `package.json`

## Phase 5: User Story 3 — Участники на «Инфо» (P2)

- [ ] T021 [US3] `rosterView` в `src/participant.js`: `username` всегда, `progress` после жеребьёвки — `null`
- [ ] T022 [US3] `src/app/05-event.js.txt`: `peopleSection` без сводки подарков и «Показать всех», `personRow` без нажатия; `src/app/03-home.js.txt` — без `rosterOpen`; галочка `contacts_on` с подсказкой — из `adminParams` в `src/app/06-admin.js.txt`
- [ ] T023 [US3] Обновить `tests/roster.test.mjs`: @username при `contacts_on = 0`, `progress` после жеребьёвки — `null`

## Phase 6: User Story 4 — Короче тексты (P2)

- [ ] T024 [US4] Тексты приложения ru по `contracts/texts.md` §1–3 в `src/i18n/ru/app-*.js`
- [ ] T025 [US4] Те же правки на 10 языках в `src/i18n/{en,es,pt,fr,de,zh,it,tr,id,pl}/app-*.js`
- [ ] T026 [US4] Вызовы в частях приложения: шторка создания (`03-home`), «Настройки» без «О боте» и подписи уведомлений (`04-settings`), подсказки переписки, кнопка «🎨 Раскрасить письмо» без названия открытки и шторка без подсказки, «Нужна помощь?», без «Как это работает» и `howItWorks` (`05-event`), подсказки «Приглашения», обращения (`app.admin.support.title`), объявление, «Участники», исключения, «Параметры», «Обмен подопечными», служебный просмотр, «Владелец и администраторы», «Опасная зона» без подсказок и «Полного сброса» (`06-admin`)

## Phase 7: User Story 5 — Ссылка при закрытой регистрации (P3)

- [ ] T027 [P] [US5] Дизайн-система: `.ds-input:disabled` в `design-system/components.css`, пример в `design-system/preview.html`, строка и версия 1.11.0 в `design-system/README.md`
- [ ] T028 [US5] `adminInvite` в `src/app/06-admin.js.txt`: поле `disabled` и ряд кнопок `hidden` при закрытой регистрации, `p.watch('registration_open', sync)`

## Phase 8: Polish

- [ ] T029 Тесты по месту: `secrecy`, `atomic`, `queries` (+`support/queries-scenario.mjs`), `api-refusals` (эталон без ключей пяти действий, заголовок — 064), `support/refusals-scenario.mjs`, `cron-marks`, `cron-reads`, `i18n-lang`, `i18n-languages`, `swap`, `data-registry`, `server-shape`, `rights`, `api-doc`, `donate`, `app-*`, `wording`, `e2e`; `tests/screenshots.mjs` — сценарии адреса, отметок, контактов
- [ ] T030 `docs/api.md`: 64 действия, без пяти разделов, поля ответов (`contracts/removal.md` §2), журнал (`remind.santas` — прежний код, `finish`, `finish.warn`), `/app` без `shipment`
- [ ] T031 Конституция 5.1.0 (`.specify/memory/constitution.md`): принцип I — статусы администратора без отметок и адреса, пункт об адресе — история; «Безопасность и данные» — адрес не собирается; отчёт синхронизации
- [ ] T032 [P] README (`README.md`): адрес, отправка, отметки, контакты, завершение по дате и «брошенные» события в обоих ботах, кнопки «Завершить» и «Полный сброс»
- [ ] T033 [P] `CLAUDE.md` (строка 064, жёсткое правило об адресе, описание модулей) и `docs/todo.md` (удалить оставленные колонки)
- [ ] T034 `npm test`, `npm run test:e2e`, `npm run screenshots`; отметить задачи

## Dependencies

T002–T003 → все истории. US1 (T004–T008) и US2 (T009–T020) независимы по файлам сервера, но делят `src/cron.js` и
`src/app/06-admin.js.txt` — последовательно. US3 после T010 (тот же файл). US4 — после US1–US3 (те же части приложения и
словари). US5 — после US4 (тот же `adminInvite`). Polish — в конце.

## Implementation Strategy

Один проход по файлам: сервер (T002–T015, T021), приложение (T007, T016–T019, T022, T026, T028), словари (T006, T015, T024,
T025), дизайн-система (T027), тесты (T008, T020, T023, T029), документы (T030–T033). MVP — US1 + US2 (без них список
противоречив); выкат — после всех историй (решение владельца: оба бота сразу после влития в `main`).

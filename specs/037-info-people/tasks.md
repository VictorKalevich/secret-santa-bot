# Tasks: Список участников на «Инфо» (037)

**Input**: `specs/037-info-people/` — spec.md, plan.md, research.md, contracts/info-people.md, quickstart.md

**Tests**: да — сервер в «мире» (`npm test`), приложение в Chrome (`npm run screenshots`); новые проверки падают на
прежнем коде.

## Phase 1: Setup

- [ ] T001 Спецификация, план, решения, контракт, проверка, задачи — `specs/037-info-people/`; `.specify/feature.json`

## Phase 2: Foundational — параметр `contacts_on`

- [ ] T002 `migrations/0009_contacts.sql` (`ALTER TABLE events ADD COLUMN contacts_on INTEGER NOT NULL DEFAULT 0`,
  `settings.schema` → 12); `src/db.js` — `REQUIRED_SCHEMA = 12`; `src/event-params.js` — `contacts_on: { kind: 'flag',
  default: 0, template: true }`; `src/status.js` — `publicEvent`: `contacts_on`, `draw_auto_date` (из `settings` панели —
  убрать повтор, `src/panel.js`)
- [ ] T003 [P] `tests/migrations.test.mjs`: 0009 — только колонка `contacts_on` с умолчанием 0 и версия схемы 12; база с
  данными «до 0009»: после — у всех событий 0, остальные строки прежние

## Phase 3: User Story 1 — участник видит, кто играет (P1) 🎯 MVP

**Goal**: `event.get` отдаёт `roster` (люди, организаторы, прогресс); «Инфо» показывает раздел «Участники · N».

**Independent Test**: участник открывает «Инфо» — список по алфавиту с «(ты)» и метками, прогресс, «Организаторы»,
«Автожеребьёвка»; в данных — ни одной отметки по людям.

- [ ] T004 [P] [US1] `tests/roster.test.mjs` (новый, + в скрипт `test` в `package.json`): `roster.people` — только
  зарегистрированные, по алфавиту, роли, ключи ровно `id, name, role`; `organizers` — владелец первым; `progress` до
  жеребьёвки (письма) и после (готово / получено, с вписанным после жеребьёвки); организатор-не участник получает то же;
  `event.participants` и `event.draw_auto_date`
- [ ] T005 [US1] `src/db.js` — `peopleQuery` (вместо `participantCountQuery`), `giftTotalsQuery`; `src/participant.js` —
  `eventView` читает их и `users` в том же пакете, `rosterView` (чистая) собирает `roster`
- [ ] T006 [US1] `src/app/03-home.js.txt` — `state.roster`, `state.rosterOpen` (начальное состояние), `reloadEvent` берёт
  `d.roster`; `src/app/04-event.js.txt` — «О событии» (без «Участников»; «Организаторы», «Автожеребьёвка»),
  `peopleSection()`: прогресс, строки, свёртка после 8 с «Показать всех (N)»

## Phase 4: User Story 2 — организатор разрешает писать друг другу (P1)

**Goal**: параметр в «Параметрах»; @username — только при нём; нажатие на имя — вопрос и чат.

**Independent Test**: параметр выключен — @username нет ни в данных, ни на экране; включён — есть, строка нажимается.

- [ ] T007 [P] [US2] `tests/roster.test.mjs`: `contacts_on` выключен — ни одного `username` в `roster`; включён
  (`admin.game`) — у людей и организаторов с @username; образец копирует, полный сброс — 0; журнал «параметры»
- [ ] T008 [US2] `src/participant.js` (`rosterView`): `username` — только при `ev.contacts_on`
- [ ] T009 [US2] `src/app/05-admin.js.txt` — флажок `contacts_on` в «Параметрах» (подпись и подсказка по контракту);
  `src/app/04-event.js.txt` — строка с @username нажимается (`ds-list-item--link`, «›»): `confirmBox` → чат

## Phase 5: User Story 3 — участник зовёт друга (P2)

- [ ] T010 [P] [US3] `tests/roster.test.mjs`: `invite_link` — при открытой регистрации в идущем событии; закрыта,
  завершено — `''`; друг по этой ссылке вступает (с одобрением — заявка)
- [ ] T011 [US3] `src/participant.js` — `invite_link` в `roster`; `src/app/02-core.js.txt` — `shareInvite(link, title)`;
  `src/app/05-admin.js.txt` — «📤 Отправить в чат» через него; `src/app/04-event.js.txt` — подсказка и «📨 Пригласить
  друга»

## Phase 6: Polish & Cross-Cutting

- [ ] T012 [P] `tests/screenshots.mjs` — `checkInfoPeople` (свёртка и раскрытие, «(ты)», метки, прогресс, «Организаторы»,
  «Автожеребьёвка — не установлена», без @ при выключенном, с @ и чатом при включённом, своя строка не нажимается,
  «Пригласить друга» и его пропажа при закрытой регистрации), снимки `34-info-people` (светлая и тёмная)
- [ ] T013 [P] `docs/api.md` — `event.get` (`roster`, `event.contacts_on`, `event.draw_auto_date`), `admin.game`
  (`contacts_on`), `admin.state`
- [ ] T014 [P] `README.md` — участнику: список, прогресс, «Пригласить друга», чат при разрешении; организатору:
  параметр; «Обновление бота» — миграция 0009 перед выкатом
- [ ] T015 `CLAUDE.md` — строка 037, миграции (0009, схема 12, файлов 9), `participant.js` (`roster`), приложение
  (`shareInvite`, «Участники» на «Инфо»), тесты (`roster`, `migrations`)
- [ ] T016 Новые тесты падают на прежнем коде; `npm test`, `npm run test:e2e`, `npm run screenshots` — зелёные; статус
  spec; коммиты; влить в `main`, push

## Dependencies

T001 → T002 → (T003, T004) → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012–T015 → T016.

## Parallel

- T003 и T004 — разные файлы тестов; T013, T014 — разные документы.

## Implementation Strategy

MVP — US1 (список и прогресс для всех). Затем US2 (параметр и чат), US3 (приглашение). Сервер каждой истории — до
приложения; тест — до кода.

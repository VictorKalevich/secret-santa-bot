# Tasks: Значок у имени и открытка для письма (038)

**Input**: `specs/038-emoji-postcards/` — spec.md, plan.md, research.md, contracts/looks.md, quickstart.md

**Tests**: да — сервер в «мире» (`npm test`), дизайн-система (набор ↔ темы, контраст), приложение в Chrome
(`npm run screenshots`); новые проверки падают на прежнем коде.

## Phase 1: Setup

- [ ] T001 Спецификация, план, решения, контракт, проверка, задачи — `specs/038-emoji-postcards/`; `.specify/feature.json`

## Phase 2: Foundational — схема и набор

- [ ] T002 `migrations/0010_looks.sql` (`users.emoji`, `members.card` — `TEXT NOT NULL DEFAULT ''`, `settings.schema` →
  13); `src/db.js` — `REQUIRED_SCHEMA = 13`, `REGISTRY.members.personal` — группы `['wishlist', 'wishlist_updated_at',
  'card']`, `['delivery', 'delivery_updated_at']` (сброс и слияние — по группам); `src/looks.js` — `EMOJIS` (40),
  `POSTCARDS` (15), `validEmoji`, `validCard`
- [ ] T003 [P] `tests/migrations.test.mjs`: 0010 — две колонки с умолчанием `''` и версия 13; база с данными «до 0010» —
  строки прежние

## Phase 3: User Story 1 — значок у имени (P1) 🎯 MVP

**Goal**: участник выбирает значок; он виден в списках, у Санты — со скрытым именем; в переписке, боте и журнале — нет.

**Independent Test**: `emoji.set` → значок в `me`, `roster`, `admin.state`, `admin.users`, `ward.get`; не в `chat.get`;
отказ на значок не из набора.

- [ ] T004 [P] [US1] `tests/looks.test.mjs` (новый, + в скрипт `test`): `emoji.set` — из набора, `''`, не из набора
  (отказ, прежний значок), незарегистрированный; значок в `me`, `roster` (люди и организаторы), `admin.state` (участники,
  заявки, удалённые), `admin.users`, `ward.get`; ответы `chat.get` обеих сторон и сообщения бота — без значков; журнал не
  пишется
- [ ] T005 [US1] `src/api.js` — `emoji.set`; `src/participant.js` — `setEmoji`, `homeView` (`me.emoji`, `looks`),
  `rosterView` (`emoji`), `wardView` (`ward.emoji`); `src/db.js` — `u.emoji` в `peopleQuery`, `panelMembersQuery`;
  `src/panel.js` — `emoji` в `users`, `requests`, `removed`, `usersList`
- [ ] T006 [US1] Дизайн-система: `ds-choices`, `ds-choice` (токены размеров → `components.css` → `preview.html` →
  `design-system/README.md`); `src/app/03-home.js.txt` — `state.looks`, «Профиль» со значком, `openEmojiSheet`, значок в
  списке администраторов; `src/app/05-admin.js.txt` — `personTitle` со значком; `src/app/04-event.js.txt` — значок внутри
  скрытого имени на «Подопечный»

## Phase 4: User Story 2 — открытка для письма (P1)

**Goal**: участник выбирает открытку письма; письмо на ней у него, у Санты и у организатора.

**Independent Test**: `card.set` → `member.card`, `ward.card`, `admin.wishlist.card`; без уведомления и без смены времени
письма; отказ в завершённом и не из набора; перенос и сброс — вместе с письмом; набор ↔ дизайн-система, контраст.

- [ ] T007 [P] [US2] `tests/looks.test.mjs`: `card.set` — сохраняет, `''` убирает, не из набора и в завершённом — отказ;
  очередь бота пуста, `wishlist_updated_at` прежний; открытка в `event.get`, `ward.get` (Санте), `admin.wishlist`; перенос
  участия (письмо нового аккаунта пустое / не пустое) и полный сброс; набор `POSTCARDS` ↔ классы, токены, витрина;
  контраст чернил и бумаги ≥ 4.5
- [ ] T008 [US2] `src/api.js` — `card.set`; `src/participant.js` — `setCard`, `member.card`, `ward.card`; `src/panel.js` —
  `card` в `adminWishlist`
- [ ] T009 [US2] Дизайн-система: токены `--ds-postcard-*` (15 тем), `ds-postcard` (рамка, бумага, наклейка, мини-вид,
  поле на бумаге), все темы в `preview.html`, README дизайн-системы
- [ ] T010 [US2] `src/app/02-core.js.txt` — `postcard(card, ...content)`; `src/app/04-event.js.txt` — кнопка «🖼 Открытка:
  …», `openPostcardSheet`, редактор и просмотр на открытке, письмо подопечного (и изменения) на открытке;
  `src/app/05-admin.js.txt` — письмо участника на открытке

## Phase 5: User Story 3 — «сделать позже» (P3)

- [ ] T011 [US3] `docs/todo.md` — «Маска Санты в переписке» и «Значок стажа» в «Сделать позже» (правила тайны)

## Phase 6: Polish & Cross-Cutting

- [ ] T012 [P] Эталон отказов: `NEW_ACTIONS_038` в `tests/support/refusals-scenario.mjs` (проход «038 …», extra: значок и
  открытка не из набора, открытка в завершённом), новые ключи в `tests/fixtures/api-refusals.json`, список в заголовке
  `tests/api-refusals.test.mjs`; прежние ключи — те же
- [ ] T013 [P] `tests/screenshots.mjs` — `checkLooks` (значок из профиля — в профиле, на «Инфо», у Санты скрыт до «Показать
  имя»; открытка — шторка, выбранная отмечена, редактор на открытке, несохранённый текст цел, у Санты письмо на открытке,
  в завершённом — без кнопки), снимки 35-emoji, 36-postcards, 37-ward-postcard (светлые и тёмные)
- [ ] T014 [P] `docs/api.md` — `emoji.set`, `card.set`, поля `me`, `event.get`, `ward.get`, `admin.state`,
  `admin.wishlist`, `admin.users`; 63 действия
- [ ] T015 [P] `README.md` — значок в «Профиле», открытка письма, «Обновление бота» — миграция 0010 до выката
- [ ] T016 `CLAUDE.md` — строка 038, миграции (0010, схема 13, файлов 10), `src/looks.js`, приложение, дизайн-система,
  тесты (`looks`, 63 действия, эталон отказов «038»)
- [ ] T017 Новые тесты падают на прежнем коде; `npm test`, `npm run test:e2e`, `npm run screenshots` — зелёные; статус
  spec; коммиты; влить в `main`, push

## Dependencies

T001 → T002 → (T003, T004) → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012–T016 → T017.

## Parallel

- T003 и T004 — разные файлы тестов; T012–T015 — разные файлы.

## Implementation Strategy

MVP — US1 (значок). Затем US2 (открытка: сервер → дизайн-система → приложение), US3 (запись «на потом»). Тест — до кода.

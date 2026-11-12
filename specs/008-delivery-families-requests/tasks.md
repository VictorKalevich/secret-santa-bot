---

description: "Задачи: адрес доставки, семьи, заявки"
---

# Tasks: Адрес доставки, семьи и заявки на вступление

**Input**: `/specs/008-delivery-families-requests/` · **Tests**: да (принцип VI)

## Phase 1: Foundational

- [ ] T801 `migrations/0004_delivery_families_requests.sql`: поля `members.delivery`, `members.delivery_updated_at`,
  `events.delivery_on`, `events.families_on`, `events.approval`; таблицы `families`, `family_members`, `join_requests`
  (+ индексы); `schema = '8'`
- [ ] T802 `src/db.js`: `REQUIRED_SCHEMA = 8`; `EVENT_FIELDS`; `addMemberStmt` с предзаполнением адреса;
  `familyExclusions(db, ev, ids)`
- [ ] T803 `.specify/memory/constitution.md` 1.3.0: адрес — только участнику и Санте; список хранимых данных

## Phase 2: US1 — Адрес доставки (P1)

- [ ] T804 [US1] `src/api.js`: `delivery.save`; `event.get` (+ `delivery_on`, `approval`, `member.delivery`);
  `ward.get.ward.delivery`; `admin.state` `has_delivery`; `admin.game` `delivery_on`
- [ ] T805 [US1] `src/cron.js`: уведомление по `MAX(wishlist_updated_at, delivery_updated_at)`, текст «письмо или адрес»;
  `src/game.js`: `notified_at` новых пар с учётом адреса
- [ ] T806 [US1] `src/app.html`: «Письмо» — карточка «📍 Как передать подарок»; «Подопечный» — адрес; «Админ» — метка
  «📍 адрес указан/нет», переключатель «Спрашивать адрес доставки»

## Phase 3: US2 — Семьи (P1)

- [ ] T807 [US2] `src/game.js`: семьи в `checkDraw` (с объяснением причины), `removeMember`, `insertMember`;
  `saveFamily`, `deleteFamily` с журналом; перенос членства в `transferAccount`
- [ ] T808 [US2] `src/api.js`: `admin.families`, `admin.family.save`, `admin.family.delete`; `admin.state.families`;
  `admin.game` `families_on` (до жеребьёвки)
- [ ] T809 [US2] `src/app.html`: главный экран — раздел «Семьи» (список, шторка создания/изменения с выбором людей);
  «Админ» → «Исключения» — семьи эвента и переключатель «Учитывать семьи»

## Phase 4: US3 — Заявки (P2)

- [ ] T810 [US3] `src/game.js`: `requestJoin(env, ev, user)`, `decideRequest(env, id, actor, approve)` атомарно;
  удаление заявок в `deleteEvent`/`resetEvent`; перенос заявок
- [ ] T811 [US3] `src/bot.js`: вступление с одобрением (после ввода имени — заявка), кнопки `req:<id>:a|r`
- [ ] T812 [US3] `src/api.js`: `admin.request.decide`; `admin.state.requests`; `admin.game` `approval`
- [ ] T813 [US3] `src/app.html`: «Админ» — раздел «Заявки» (✅/❌), переключатель «Вступление по одобрению»

## Phase 5: Tests & Polish

- [ ] T814 `tests/e2e.test.mjs`: сценарии `quickstart.md`
- [ ] T815 `tests/screenshots.mjs`: адрес в «Письме» и «Подопечном», «Семьи», заявки
- [ ] T816 [P] contracts 007 → ссылка на 008; CLAUDE.md (фича 008, схема 8, правило адреса)
- [ ] T822 [P] README: адрес доставки, семьи, заявки; хранимые данные
- [ ] T823 `npm test`, `npm run test:e2e`, `npm run screenshots`

## Dependencies

Phase 1 → все истории. Истории независимы, кроме общих файлов `src/api.js`, `src/app.html` (последовательно).

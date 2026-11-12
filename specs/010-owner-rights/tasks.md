# Tasks: Права владельца и закрытие открытых вопросов 009

**Input**: `specs/010-owner-rights/` — spec.md, plan.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: да — сквозные тесты на каждую историю (принцип VI) и автотест «владелец ⊇ админ» (FR-1007).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Создать миграцию `migrations/0005_owner_rights.sql`: `ALTER TABLE events ADD COLUMN rejoin INTEGER NOT NULL DEFAULT 1`; таблица `removed_members (event_id INTEGER NOT NULL, user_id INTEGER NOT NULL, removed_by INTEGER NOT NULL DEFAULT 0, removed_at INTEGER NOT NULL, PRIMARY KEY (event_id, user_id))`; `settings.schema = '9'`
- [X] T002 В `src/db.js`: `REQUIRED_SCHEMA = 9`, `rejoin` в `EVENT_FIELDS`, помощники `markRemovedStmt(db, eventId, userId, actor, guard, ...args)`, `clearRemovedStmt(db, eventId, userId, guard?, ...args)`, `isRemoved(db, eventId, userId)`; комментарий схемы «Схема 9»

## Phase 2: Foundational

- [X] T003 В `tests/harness.mjs` `setup()` отправляет ключ формой (`POST /setup`, `application/x-www-form-urlencoded`) — нужно всем e2e после US2

## Phase 3: US1 — перенос только владельцем (P1)

**Independent test**: админ → `admin.transfer` → `403`; владелец — работает.

- [X] T004 [US1] `src/api.js` `admin.transfer`: `if (!isOwner) return ownerOnly('Переносить участие на новый аккаунт')` (текст FR-1001)
- [X] T005 [US1] `src/app.html`: кнопка «Перенести на новый аккаунт» только у владельца (`canTransfer`), подсказка для админа «Удалять администраторов и переносить участие может только владелец.»
- [X] T006 [US1] e2e в `tests/e2e.test.mjs` (блок 010): админ не может перенести участника (403, ничего не изменилось)

## Phase 4: US2 — ключ формой, одноразовая ссылка владельца (P1)

**Independent test**: GET с ключом в адресе → форма; POST → ссылка; переход дважды → второй отказ; POST после перехода → 423; «смена секрета» → снова работает.

- [X] T007 [US2] `src/index.js` `setup(request, url, env)`: GET — форма; POST — ключ из `formData()`, сравнение через HMAC; блокировка при `settings.owner_link_used === derivedSecret('owner-used:'+ADMIN_SECRET)` → `423` с инструкцией; заголовки `referrer-policy: no-referrer`, `content-security-policy: frame-ancestors 'none'`, `x-robots-tag: noindex`, `cache-control: no-store`; `<meta name="referrer">`; тексты страницы про одноразовость
- [X] T008 [US2] `src/bot.js`: ссылка владельца — атомарный захват `settings.owner_link_used` (UPSERT … WHERE value != excluded.value); повторно — «Ссылка владельца уже использована. Чтобы получить новую — смени ADMIN_SECRET и снова открой страницу настройки.»; текст предупреждения прежнему владельцу в `src/roles.js` — «смени ADMIN_SECRET и забери права по новой ссылке»
- [X] T009 [US2] e2e: GET `/setup?key=…` → форма без настройки; POST с неверным ключом → 403; повторное использование ссылки → отказ, владелец не сменился; POST после использования → 423; удаление отметки (как смена секрета) → ссылка снова работает. Поправить тест 002 «ссылка владельца возвращает права» в `tests/e2e.test.mjs`

## Phase 5: US3 — максимальные права владельца и служебный просмотр (P1)

**Independent test**: владелец открывает просмотр участника и все пары; журнал; статусы не меняются; админу — 403; автотест всех действий.

- [X] T010 [US3] Новый модуль `src/vault.js`: `vaultPerson(env, ev, id, actor)` и `vaultPairs(env, ev, actor)` — запись журнала (`vault.person` — имя, `vault.pairs` — `пар: N`), затем чтение; без UPDATE статусов; переписка — последние 200 сообщений каждой стороны
- [X] T011 [US3] `src/api.js`: действия `admin.vault.person`, `admin.vault.pairs` (только владелец, 403 «Служебный просмотр доступен только владельцу бота.»), добавить в `FINISHED_OK`
- [X] T012 [US3] `src/api.js`: освобождения владельца — `admin.exclusion.*` после жеребьёвки (без SQL-условия «до жеребьёвки»), `admin.insert` себя; `src/membership.js` `saveFamily`/`deleteFamily` с `{ owner }` пропускают `frozenFamilyEvent`
- [X] T013 [US3] `src/app.html`: раздел «🔐 Служебный просмотр» внизу панели эвента (только владелец) → ввод «ОТКРЫТЬ» (предупреждение, если владелец участник) → полноэкранный лист: выбор участника → карточка (подопечный, Санта, письмо, адрес, переписка с датами); «Показать все пары» с подтверждением → список «Санта → подопечный»; подписи журнала `vault.person`, `vault.pairs`, `member.allow`
- [X] T014 [US3] `src/app.html`: владельцу доступны исключения после жеребьёвки, семьи при идущей жеребьёвке, «Вписать» себя; тексты «Как это работает» (FR-1015) и подсказка у жеребьёвки (админ / владелец)
- [X] T015 [US3] e2e: просмотр участника и всех пар; журнал без пар; `seen_text`/`read_at` не изменились, отмена жеребьёвки доступна; админ → 403; завершённый эвент — работает; освобождения владельца (исключение после жеребьёвки, вписать себя, семья при идущей жеребьёвке) и отказ админу
- [X] T016 [US3] e2e-автотест FR-1007: собрать `case 'admin.…'` из `src/api.js`, вызвать каждое от владельца на отдельном эвенте — ни одного 403

## Phase 6: US4 — закрытый набор и семьи в жеребьёвке (P2)

- [X] T017 [US4] `src/membership.js` `decideRequest`: принять при закрытой регистрации → отказ (текст FR-1016), условие и в захвате; `src/events.js` `inviteFromEvent`: закрытая регистрация → отказ «Регистрация закрыта — открой её, чтобы приглашать.»
- [X] T018 [US4] `src/db.js` `familySnapshot(rows, ids)` + `familyExclusions` по загруженным строкам; `src/pairs.js` `checkDraw` — снимок `families`, `runDraw` — сравнение в захвате при `families_on`, текст «Участники, исключения или семьи изменились во время жеребьёвки — попробуй ещё раз.»
- [X] T019 [P] [US4] Юнит-тест `familySnapshot` в `tests/unit.test.mjs` (порядок не важен, смена семьи меняет снимок, не-участники не влияют)
- [X] T020 [US4] e2e: заявка при закрытой регистрации (панель и кнопка в чате) → отказ, «Отклонить» работает, после открытия — принять; приглашение из эвента при закрытой → отказ; «Я участвую» при закрытой — работает

## Phase 7: US5 — возврат удалённых (P2)

- [X] T021 [US5] `src/pairs.js` `removeMember(…, { mark })`: отметка «удалён» в том же batch по условию версии; `src/api.js` `admin.remove` передаёт `mark: true`
- [X] T022 [US5] Снятие отметки при вступлении: `joinByInvite`, `decideRequest` (принять), вход до имени в `src/bot.js`, `admin.participate` (вкл.)
- [X] T023 [US5] Запрет возврата: `joinByInvite` → `'removed'` при `!ev.rejoin` и отметке; `src/bot.js` — ответ «Организатор удалил тебя из эвента «…» — вернуться по ссылке нельзя. Если это ошибка — напиши ему.» (и до ввода имени, без добавления в эвент); `inviteFromEvent` пропускает отмеченных при `!ev.rejoin`
- [X] T024 [US5] `src/api.js`: `admin.removed.allow` (журнал `member.allow`), `rejoin` в `admin.game`, `publicEvent`, `admin.state` (`removed`); `src/events.js`: `createEvent` копирует `rejoin`, `resetEvent` — `rejoin = 1` и стирает отметки, `deleteEvent` стирает; `src/roles.js` `transferAccount` переносит отметки
- [X] T025 [US5] `src/app.html`: переключатель «Удалённые могут вернуться по ссылке» (карточка регистрации) и список «Удалённые» с «Разрешить вернуться» при выключенном
- [X] T026 [US5] e2e: по умолчанию включено; выключено → удалённый по ссылке (до и после имени) получает отказ, админам ничего; приглашение из эвента его пропускает; «Разрешить вернуться» → входит; включено → возвращается, пропадает из списка; «Я участвую» выкл. — не отметка; эвент по образцу копирует

## Phase 8: US6 — атомарное удаление эвента (P3)

- [X] T027 [US6] `src/events.js` `deleteEvent`: уведомления и журнал по условию «эвент существует», `DELETE FROM events` последним, `changes = 0` → `{ ok: false, error: 'Эвент уже удалён.' }`; `src/api.js` возвращает ошибку
- [X] T028 [US6] e2e: два одновременных удаления → одно успешно, второе «Эвент уже удалён.»; одно уведомление каждому, одна запись журнала

## Phase 9: Polish

- [X] T029 `README.md`: настройка через форму, одноразовая ссылка владельца и разблокировка сменой `ADMIN_SECRET`, роли (перенос — владелец, служебный просмотр, освобождения), честный текст о просмотре, закрытая регистрация, возврат удалённых, миграция 0005, таблица ошибок
- [X] T030 `CLAUDE.md`: строка 010, ссылка на контракт `specs/010-owner-rights/contracts/api.md`, миграции (9, `0005`), правило «Тайна» — исключение `admin.vault.*`, `src/vault.js` в структуре
- [X] T031 `tests/screenshots.mjs`: экраны служебного просмотра и списка «Удалённые»
- [X] T032 Прогнать `npm test`, `npm run test:e2e`, `npm run screenshots`; проверить скриншоты; отметить задачи

## Dependencies

- T001–T002 → всё остальное; T003 → e2e задачи (T006, T009, …).
- US1, US2, US6 независимы; US3 зависит от T002 (журнал/помощники не нужны) — независима; US5 зависит от T001–T002.
- T013/T014/T025 (app.html) — последовательно (один файл); `src/api.js` правки — последовательно.

## Parallel Execution Examples

- T019 (юнит) параллельно с T017/T018.
- README (T029) и CLAUDE.md (T030) — параллельно после реализации.

## Implementation Strategy

MVP — US1 + US2 (закрывают обход тайны и защищают права владельца), затем US3 (служебный просмотр), US4–US6.
Один коммит на историю; перед каждым — `npm test`; в конце — e2e, скриншоты, push всех веток.

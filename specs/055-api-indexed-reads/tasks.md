# Задачи 055: чтения API по индексам

**Tests**: да — планы запросов вызовов и миграция (принцип VI).

## Phase 1: Тесты (сначала падают)

- [x] T001 `tests/support/plans.mjs`: `tablesOf(sql)`, `fullScans(sqlite, sql, allow)` (полный просмотр таблицы или
  индекса, кроме разрешённых), `statementsDuring(w, fn)` (тексты всех операторов вызова, в том числе внутри пакетов);
  `tests/cron-reads.test.mjs` берёт их оттуда, проверки прежние
- [x] T002 `tests/api-reads.test.mjs` (+ в скрипт `test` в `package.json`): мир открытого бота с чужой историей (другая
  компания с людьми, завершённое событие с парами, перепиской, обращением, отклонённой заявкой, семьёй); вызовы обычных
  людей — участника, организатора, владельца компании, новичка: `me`, `event.get`, `ward.get`, `chat.get`,
  `message.send`, `wishlist.save`, `admin.state`, `admin.families`, `admin.family.save`, `support.send`,
  `admin.support.take`/`send`/`get`, заявка на вступление (`/start inv_` при одобрении), `company.create`,
  `company.label.set`, `/start` (меню), вступление по ссылке и имя после неё, ссылка владельца компании `own_`: полный
  просмотр только у `settings`, `outbox` и ветки «все компании владельцу бота»; первый пакет обычного человека — только
  его компании (владельцу бота — все, без вызывающего — ни одной); «от противного»: прежние запросы компаний, людей
  компании, событий главного экрана и база без индексов `0018` находятся
- [x] T003 [P] `tests/migrations.test.mjs`: `0018` — только пять `CREATE INDEX IF NOT EXISTS` (список), без данных и
  версии схемы; база с данными после применения и повтора — те же строки

## Phase 2: Реализация (US1, US2)

- [x] T004 [US1] `migrations/0018_read_indexes.sql` — `companies_owner`, `support_threads_user`, `support_threads_taken`
  (частичный: `status = 'open' AND assignee != 0`), `join_requests_event`, `families_company` (комментарий как у `0017`)
- [x] T005 [US1] `src/db.js`: `companiesQuery(db, userId)` (свои + все владельцу бота, условие до чтения), `companyQuery`,
  `companyUsersQuery` от строк компании (поля и порядок прежние), `myEventsQuery`
- [x] T006 [US1] `src/context.js`: первый пакет — `companiesQuery(db, userId)`; `companies()` — свои / все владельцу
  бота (дочитать, если владелец найден запасным поиском; без вызывающего — пусто); `company(id)`; `in(id)` — через неё;
  `read({ inCompany: id })` вместо `companies: true`; `forgetUsers` сбрасывает и их
- [x] T007 [US1] `src/participant.js` (`homeView`): события — `myEventsQuery` (владельцу бота — `eventsQuery`), владельцы —
  своих компаний; `src/companies.js`: `companyOwnersQuery(db, botOwnerId, meId)`, создание компании — поиск строки с
  `owner_id`, ссылка владельца компании — `owner_code != ''`
- [x] T008 [US1] `src/roles.js`: `resolveOwner` и `botAdminsQuery` — от компаний с `owner_id = 0`; `setOwner` — компании
  журнала точным запросом; `src/support.js`: часть 3 счётчика — `t.assignee != 0`
- [x] T009 [US1] `src/bot.js`: `onInvite` и `signUp` — участник и компания события одним пакетом (`inCompany`)
- [x] T010 [US2] `npm test` — прежние тесты без изменения ожиданий, `queries` — не больше базового, эталон отказов прежний

## Phase 3: Polish

- [x] T011 [P] Контракт контекста `specs/050-company-scope/contracts/company-scope.md`: первый пакет, `companies()`,
  `company(id)`, `read({ inCompany })`, люди компании
- [x] T012 [P] README «Обновление бота»: `0018` — только индексы (как `0008`), в обе базы, порядок с выкатом не важен;
  `CLAUDE.md`: строка 055, миграция в списке (файлов 18), контекст, тесты `api-reads`, `plans.mjs`
- [ ] T013 `npm run test:all`; статус в `spec.md`; `quickstart.md` — выкат и проверка планов на базе бота

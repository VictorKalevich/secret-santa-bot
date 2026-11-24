---

description: "Задачи фичи 060 — тексты из словаря (шаг 1 локализации)"
---

# Tasks: Тексты — из словаря (шаг 1 локализации)

**Input**: `specs/060-i18n-dictionary/` — spec.md, plan.md, research.md (R1–R14), data-model.md, contracts/i18n.md,
quickstart.md

**Tests**: нужны — спецификация требует проверок словаря (FR-6009, SC-6001–SC-6005) и псевдоязыка (US3).

**Правило каждой задачи переноса**: итог для людей побайтно прежний; ожидаемые тексты тестов поведения не меняются;
проверки, которые искали текст в исходном коде, ищут ключ в коде и текст в словаре (R11); в конце задачи — `npm test`
зелёный. Как писать — `contracts/i18n.md`, раздел 7.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы кода и словаря, нет зависимости от незавершённых задач)
- **[Story]**: US1 — для людей ничего не меняется, US2 — каждый текст в словаре, US3 — язык у вызова и получателя

---

## Phase 1: Setup

- [ ] T001 Миграция `migrations/0021_user_lang.sql`: `ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT '';` и
  `settings.schema = '21'` (вид — как `0019`/`0020`, комментарий «применяется до выката кода, прежний код колонку не
  читает»); `REQUIRED_SCHEMA = 21` в `src/db.js`; в `tests/migrations.test.mjs` — 0021: колонка `lang` с `''` у всех
  строк, версия 21, остальные строки прежние
- [ ] T002 Модуль `src/i18n/index.js` по `contracts/i18n.md`, раздел 1–2: `DEFAULT_LANG`, `LANGUAGES = ['ru']`,
  `DICTIONARIES` (`{ ru: { server, app, locale: 'ru-RU' } }` из `src/i18n/ru/index.js`), `langOf`, `t` (поиск
  `server` → `app` → русский → ключ; формы числа по `Intl.PluralRules(plural ?? lang)` и `params.n`; подстановки
  `{имя}`, вложенные отложенные тексты в `params` собираются тем же языком; нехватка/лишнее — `console.error('i18n: …')`),
  `tl`, `translator`, `tx`, `tdate`, `tjoin`, `render`, `appTexts` (версия `<язык>:<FNV-1a 32 hex>` и словарь `app.*`,
  раз на экземпляр), `bootTexts`
- [ ] T003 Папка `src/i18n/ru/`: `index.js` (`{ server, app }` из файлов: `app-*.js` → `app`) и пустые файлы
  `export default {};` всех областей из `data-model.md` (`common`, `api`, `bot`, `chat`, `companies`, `constraints`,
  `cron`, `db`, `event-params`, `events`, `index`, `looks`, `membership`, `pairs`, `panel`, `participant`, `roles`,
  `setup`, `shipment`, `stale`, `support`, `vault`, `app-boot`, `app-core`, `app-home`, `app-companies`, `app-event`,
  `app-admin`, `app-vault`, `app-sheet`)

---

## Phase 2: Foundational

**⚠️ До переноса текстов (Phase 3)**

- [ ] T004 Тесты основы в `tests/i18n.test.mjs`: `t` (подстановки, вложенные, нет ключа → русский → ключ, нехватка и
  лишнее → `console.error`), формы числа `ru` = прежний `plural(n, one, few, many)` на 0–1000, `render` (строки как
  есть, `$t`/`$d`/`$j`, вложенность, кнопки), `langOf` (пусто, неизвестный, есть), `appTexts` (версия меняется со
  словарём, один объект на экземпляр); каждое — «от противного»; файл — в скрипт `test` `package.json`
- [ ] T005 Строгий «мир»: в `tests/support/world.mjs` `console.error`, начинающийся с `i18n:`, бросает исключение
  (вызов Worker падает — тест видит); в `tests/e2e.test.mjs` и `tests/queries.test.mjs` журнал проверяется и на `i18n:`
  (как `budget exceeded`)
- [ ] T006 Контекст: `ctx.lang = langOf(me)` и `ctx.t` в `makeContext` (`src/context.js`), привязанный контекст
  (`ctx.in`) наследует; без человека — `DEFAULT_LANG`
- [ ] T007 Очередь: `src/outbox.js` — оператор захвата `RETURNING *, (SELECT lang FROM users u WHERE u.tg_id =
  outbox.chat_id) AS lang`, перед `sendMessage` — `render(payload, langOf({ lang }))`; тест в `tests/unit.test.mjs`:
  готовый текст (прежний вид) уходит как есть, отложенный — собирается на языке получателя
- [ ] T008 Журнал: `auditStmt`/`auditIfStmt` (`src/db.js`) собирают подробность `render(detail, DEFAULT_LANG)` перед
  записью; `atomic(...).audit` (`src/claim.js`) передаёт как есть
- [ ] T009 Общие тексты `src/format.js` → `src/i18n/ru/common.js`: месяцы (`common.monthsGen`), `formatDate(iso, lang)`,
  `formatMs(ms, offset, lang)` (по умолчанию `DEFAULT_LANG`), `displayName` («Кто-то» — `common.someone`), `ownerWord`
  (формы — ключи `common.owner.*`/`common.botOwner.*`, возвращает отложенные тексты), `openAppButton` (подпись по
  умолчанию), общие отказы `NOT_REGISTERED`, `ADMIN_ONLY`, `NO_DRAW`, `PAIRS_RACE`, `NOT_MEMBER`, `COMPANY_NOT_FOUND` —
  константы-ключи; `CHAT_READ_ONLY`, `SUPPORT_READ_ONLY` — ключи `app.sheet.*` (тот же текст у приложения, 034); места
  вызова в модулях — `ctx.t(КЛЮЧ)` (`no(ctx.t(NOT_MEMBER))`); `render`/`t` для дат-маркеров
- [ ] T010 API `src/api.js` → `src/i18n/ru/api.js`: конвейер (`fail(ctx.t(…))`, отказ до контекста —
  `t(DEFAULT_LANG, …)`), `ACTIONS` — `finished` и `confirm` (`[ключ слова, ключ отказа]`) и отказы не владельцу —
  ключи, конвейер собирает `ctx.t`, слово — `confirmed(body, ctx.t(row.confirm[0]))`; прочие тексты обработчиков;
  `me` (`run: (ctx, body)`) добавляет `lang`, `texts_version` и `texts` (если `body.texts` ≠ версии) — и
  незарегистрированному; адаптация `tests/api-table.test.mjs`, `tests/api-doc.test.mjs` (сверка с `docs/api.md` —
  через русский словарь), `tests/server-shape.test.mjs` (литерал отказа в модуле — по-прежнему нарушение)
- [ ] T011 Страница: `src/index.js` — метка `/*@boot-texts*/null` → JSON `bootTexts(DEFAULT_LANG)` (замена через функцию,
  как `/*@design-system*/`), тексты маршрутов → `src/i18n/ru/index.js`; `design-system/clearable-input.js.txt` —
  `bindClearableInput(box, ariaLabel)` без текста (подпись даёт вызывающий), витрина `design-system/preview.html` и
  `design-system/README.md` — новая подпись функции; `tests/app-csp.test.mjs`, `tests/world.test.mjs` — страница =
  склейка с подстановками
- [ ] T012 Ядро приложения: `src/app/02-core.js.txt` — `const BOOT_TEXTS = /*@boot-texts*/null;`, `let TEXTS`,
  `t(key, params)` и `tl(key)` по правилам `contracts/i18n.md` (раздел 2, 6), `setTexts(d)`; `ownerWord()` — ключи
  `app.core.owner.*`; месяцы, время (`toLocaleTimeString` с `app.core.locale`), `clearable` → `bindClearableInput(…,
  t('app.core.clearField', { label }))`, прочие тексты `02-core` → `src/i18n/ru/app-core.js`; `01-shell.html` и
  `09-start.html` без текстов — заголовок, «Загрузка…», подпись «‹», экраны `start()` — из `app.boot.*`
  (`src/i18n/ru/app-boot.js`), ставит скрипт до первого рендера; `reloadMe` (`03-home`) передаёт `{ texts:
  state.textsVersion }` и вызывает `setTexts(d)` первым; `state.lang`, `state.textsVersion` — в начальном состоянии

**Checkpoint**: основа готова; `npm test` зелёный (тексты, ещё не перенесённые, работают как прежде).

---

## Phase 3: User Story 2 — каждый текст для людей в словаре (Priority: P1) 🎯 MVP

**Goal**: тексты всех модулей сервера и частей приложения — в файлах словаря своей области; код — ключи.

**Independent Test**: `npm test` — эталоны прежние; после T036 проверка «кириллица вне словарей» даёт 0.

### Сервер (каждая задача — модуль → свой файл `src/i18n/ru/<модуль>.js`; ответы — `ctx.t`, очередь — `tx`/`tdate`, журнал — `tx`)

- [ ] T013 [P] [US2] `src/bot.js` → `src/i18n/ru/bot.js`: ответы в чате и `answerCallbackQuery` — `c.t`/`ctx.t`,
  сообщения другим — `tx`; тексты кнопок бота
- [ ] T014 [P] [US2] `src/events.js` → `src/i18n/ru/events.js` (объявления, напоминания, раскрытие, завершение, сброс,
  приглашение, параметры; даты в сообщениях — `tdate`)
- [ ] T015 [P] [US2] `src/pairs.js` → `src/i18n/ru/pairs.js`: причины отказа жеребьёвки — `pairs.reason.<причина>`,
  правила обмена `SWAP_RULES` — `pairs.swapRule.<правило>`, сообщения жеребьёвки, замен, отмен, подробности журнала;
  адаптация `tests/swap.test.mjs` (тексты правил — по ключам)
- [ ] T016 [P] [US2] `src/constraints.js` → `src/i18n/ru/constraints.js`
- [ ] T017 [P] [US2] `src/chat.js` → `src/i18n/ru/chat.js`
- [ ] T018 [P] [US2] `src/support.js` → `src/i18n/ru/support.js`
- [ ] T019 [P] [US2] `src/membership.js` → `src/i18n/ru/membership.js`
- [ ] T020 [P] [US2] `src/participant.js` и `src/panel.js` → `src/i18n/ru/participant.js`, `src/i18n/ru/panel.js`
- [ ] T021 [P] [US2] `src/roles.js` → `src/i18n/ru/roles.js`
- [ ] T022 [P] [US2] `src/companies.js` → `src/i18n/ru/companies.js` («Комната N» — ключ с `{n}`)
- [ ] T023 [P] [US2] `src/stale.js`, `src/shipment.js`, `src/vault.js`, `src/cron.js`, `src/db.js`,
  `src/event-params.js` → файлы своих областей (`EVENT_PARAMS.beforeDraw` — ключ `eventParams.*`); `server-shape` —
  литерал отказа по-прежнему нарушение
- [ ] T024 [P] [US2] `src/looks.js` → `src/i18n/ru/looks.js`: у `POSTCARDS`/`MASKS` нет `title` — названия
  `looks.card.<id>`, `looks.mask.<id>`; `maskLabel(id, t)`; `me.looks` — названия на языке вызывающего; адаптация
  `tests/looks.test.mjs`, `tests/mask.test.mjs` (набор и названия — через словарь)
- [ ] T025 [P] [US2] `src/setup.js` → `src/i18n/ru/setup.js`: страница, шаги, команды, описание, короткое описание,
  кнопка меню — `t(DEFAULT_LANG, …)`

### Приложение (каждая задача — часть → свой `src/i18n/ru/app-<часть>.js`; `t('app.<часть>.…')`, формы числа — набор форм)

- [ ] T026 [P] [US2] `src/app/03-home.js.txt` → `app-home.js`; адаптация `tests/names.test.mjs`
- [ ] T027 [P] [US2] `src/app/04-companies.js.txt` → `app-companies.js`; адаптация `tests/app-companies.test.mjs`
  (слово «комната» — по словарю, места — ключи)
- [ ] T028 [P] [US2] `src/app/05-event.js.txt` → `app-event.js`; адаптация `tests/donate.test.mjs` (тексты дословно —
  значения ключей `donateSection`), `tests/app-tweaks.test.mjs` (подсказки — по словарю)
- [ ] T029 [P] [US2] `src/app/06-admin.js.txt` → `app-admin.js` (`plural(...)` → набор форм `{n}`); адаптация
  `tests/app-panel.test.mjs`, `tests/app-ui.test.mjs` (если читают тексты)
- [ ] T030 [P] [US2] `src/app/07-vault-audit.js.txt` → `app-vault.js`: подписи журнала `AUDIT_LABELS` →
  `app.vault.audit.<код>` (код → ключ шаблоном), неизвестный код — сам код, как раньше
- [ ] T031 [P] [US2] `src/app/08-sheet-chat.js.txt` → `app-sheet.js` (`CHAT_READ_ONLY`, `SUPPORT_READ_ONLY` — те же
  ключи, что у сервера); адаптация `tests/behavior.test.mjs` (034: один ключ вместо сверки копий)
- [ ] T032 [US2] Остаток `src/app/02-core.js.txt` и `plural` — упразднить, если вызовов не осталось (после T026–T031)

### Проверки словаря (`tests/i18n.test.mjs`, R9)

- [ ] T033 [US2] Кириллица вне словарей: модули `src/**/*.js` кроме `src/i18n/`, склейка (`APP`, место —
  `where`), `design-system/clearable-input.js.txt`; вне комментариев; исключения — аргументы `new Error(…)` и
  `console.*(…)`, явный список с причинами; «от противного» (текст в части, в модуле; комментарий и `new Error` — нет)
- [ ] T034 [US2] Ключи и семейства: ключи вызовов `t`/`ctx.t`/`c.t`/`tx`/`tl` и строк-ключей таблиц — есть в словаре;
  каждый ключ словаря — в коде строкой или членом семейства; семейства (`looks.card.`, `looks.mask.`,
  `app.vault.audit.`, `pairs.reason.`, `pairs.swapRule.`, прочие, найденные при переносе) — с источником кодов (`POSTCARDS`,
  `MASKS`, коды журнала `docs/api.md`, списки причин и правил), у каждого кода ключ; «от противного»
- [ ] T035 [US2] Подстановки, формы, файлы, сборка: у вызова с литералом объекта имена = подстановкам текста; набор
  форм — все категории языка на 0–1000 и `{n}`; префикс ключа = файл, у языков списка — тот же набор файлов, значения
  непустые; `t` приложения (функция из склейки) = `t` сервера на всех ключах `app.*`; «от противного»
- [ ] T036 [US2] Слова — `tests/wording.test.mjs` по значениям словарей (место — ключ): «событие»/роли (013, 044),
  «комната» (059), кнопки без «＋», «владелец бота» — список разрешённых мест ключами (051); «от противного» — по
  словарю

**Checkpoint**: в коде нет текстов для людей; `npm test` зелёный.

---

## Phase 4: User Story 1 — для людей ничего не меняется (Priority: P1)

**Goal**: доказать побайтную неизменность.

**Independent Test**: эталоны и ожидания тестов не тронуты, e2e и Chrome зелёные.

- [ ] T037 [US1] `git diff main -- tests/fixtures/` пуст; в диффе `tests/` нет правок ожидаемых текстов поведения
  (только проверки исходного кода из R11) — просмотреть и перечислить в отчёте
- [ ] T038 [US1] `npm test`, `npm run test:e2e` (журнал без `i18n:` и `budget exceeded`), `npm run screenshots` —
  все прежние проверки Chrome зелёные; число запросов `queries` — прежнее

---

## Phase 5: User Story 3 — язык у вызова и получателя (Priority: P2)

**Goal**: доказать, что язык берётся у вызывающего и у получателя, а приложение получает только свой словарь.

**Independent Test**: псевдоязык у одного человека — он видит только помеченные тексты, остальные — прежние.

- [ ] T039 [US3] `tests/support/pseudo.mjs`: `pseudoLanguage()` добавляет в `DICTIONARIES` язык `xx` (`plural: 'ru'`,
  `locale: 'ru-RU'`) — каждая строка русского словаря транслитом в `⟪…⟫`, подстановки `{имя}` и HTML-теги целы,
  списки — по элементам; `LANGUAGES` для `langOf` — с `xx` на время теста
- [ ] T040 [US3] Сценарий в `tests/i18n.test.mjs` на «мире»: люди и названия латиницей, одному `users.lang = 'xx'`;
  регистрация, событие, жеребьёвка, письмо, переписка, обращение, объявление, раскрытие, завершение, отказы API и
  бота — всё, что получает он (ответы, сообщения и кнопки бота), без кириллицы и с `⟪`; остальные — без `⟪`; `me` —
  `lang: 'xx'`, `texts` только `xx`, повтор с той же версией — без `texts`; «от противного» (текст вызывающего в
  очереди другому — тест падает)
- [ ] T041 [US3] Chrome: `checkPseudo` в `tests/screenshots.mjs` — человек с `xx` проходит главный экран, событие
  (вкладки), панель организатора, шторки — в тексте страницы нет кириллицы

**Checkpoint**: US1–US3 проверены.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T042 [P] `docs/api.md`: `me` — запрос `texts`, поля `lang`, `texts_version`, `texts`; «Отказы и тексты ответов —
  на языке вызывающего, сообщения бота — на языке получателя»; `api-doc` зелёный
- [ ] T043 [P] Конституция 3.2.0 (`.specify/memory/constitution.md`): «Безопасность и данные» — хранится язык
  интерфейса человека; Sync Impact Report
- [ ] T044 [P] `CLAUDE.md`: строка 060 в таблице фич; структура `src/i18n/`; жёсткое правило «тексты для людей —
  только в словаре» (как добавить текст, ключи таблиц и семейств, `ctx.t`/`tx`); миграции — `0021`, схема 21; тесты —
  `i18n`; README по пункту 8
- [ ] T045 [P] `README.md`: миграция `0021` в разделе обновления, язык в описании хранимых данных
- [ ] T046 Прогон `quickstart.md` (локальная часть) и `npm run test:all`; коммит, `git push -u origin 060-i18n-dictionary`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 и Phase 5 → Phase 6.
- T004 зависит от T002–T003; T006–T012 — от T002–T003; T010 — от T009 (общие ключи).
- Phase 3: T013–T031 независимы между собой (разные файлы кода и словаря), каждая зависит только от Phase 2; T032 —
  после T026–T031; T033–T036 — после всех переносов.
- Phase 5 — после Phase 3 (псевдоязык проверяет и полноту).

## Parallel Example: User Story 2

```text
Task: "T014 src/events.js → src/i18n/ru/events.js"
Task: "T015 src/pairs.js → src/i18n/ru/pairs.js"
Task: "T028 src/app/05-event.js.txt → src/i18n/ru/app-event.js"
Task: "T029 src/app/06-admin.js.txt → src/i18n/ru/app-admin.js"
```

Общий для задач — только `src/i18n/ru/common.js` и `app-core.js` (готовы в Phase 2): новые общие ключи задача не
добавляет туда, а держит в своей области.

## Implementation Strategy

1. Phase 1–2: основа и общие тексты — сервер и приложение работают на словаре, остальное по-прежнему литералы.
2. Phase 3 по областям: после каждой — `npm test` (эталоны ловят расхождение побайтно), коммит.
3. Проверки словаря (T033–T036) — когда перенесено всё.
4. Phase 4–5: доказательства US1 и US3; Phase 6 — документы.

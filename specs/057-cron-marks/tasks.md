# Tasks: 057. Минутная проверка по отметкам

**Input**: `specs/057-cron-marks/` — spec.md, plan.md, research.md, data-model.md, contracts/cron-marks.md, quickstart.md

**Tests**: нужны (Конституция VI, правила проекта: `npm test` перед коммитом, «от противного» у каждого правила).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Один Worker: `src/`, `migrations/`, `tools/`, `tests/`, `docs/` в корне репозитория.

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Миграция `migrations/0020_cron_marks.sql`: комментарий (057, применять до выката кода, прежний код колонки не
  читает; после выката — `tools/notify-reconcile.sql`); `ALTER TABLE members ADD COLUMN notify_at INTEGER NOT NULL DEFAULT
  0`; `ALTER TABLE events ADD COLUMN checked_on TEXT NOT NULL DEFAULT ''`; `CREATE INDEX IF NOT EXISTS members_notify ON
  members (notify_at) WHERE notify_at > 0`; `CREATE INDEX IF NOT EXISTS events_unchecked ON events (checked_on) WHERE
  status = 'active'`; отметки ждущих правок — `UPDATE members SET notify_at = MAX(wishlist_updated_at,
  delivery_updated_at) WHERE EXISTS (SELECT 1 FROM pairs p JOIN events e ON e.id = p.event_id WHERE p.event_id =
  members.event_id AND p.ward = members.user_id AND e.status = 'active' AND p.notified_at <
  MAX(members.wishlist_updated_at, members.delivery_updated_at))`; версия схемы 20 (`INSERT INTO settings … ON CONFLICT`)
- [X] T002 `REQUIRED_SCHEMA = 20` в `src/db.js`; `REGISTRY.members.notify = 'notify_at'` с комментарием (057: правка
  ждёт уведомления Санте — сброс обнуляет, слияние ставит, перенос переносит со строкой)
- [X] T003 [P] `EVENT_STATE_RESET.checked_on = ''` в `src/event-params.js` (комментарий: отметка «на сегодня проверено»
  ежедневного шага, 057; сброс снимает, образец не копирует)

## Phase 2: User Story 1 — уведомление о правке по отметке (P1) 🎯 MVP

**Goal**: Санта получает прежнее уведомление; минутная проверка не перебирает пары и события.

**Independent Test**: после жеребьёвки правка письма → через задержку одно сообщение; в минуты без правок запрос
уведомлений находит 0 строк по индексу `members_notify`.

- [X] T004 [US1] `src/participant.js`: `NOTIFY_MARK` — `notify_at = CASE WHEN EXISTS (SELECT 1 FROM pairs WHERE
  pairs.event_id = members.event_id AND pairs.ward = members.user_id) THEN ? ELSE notify_at END`; добавить в `UPDATE`
  `saveWishlist` (параметр — `now`), `saveDelivery` (`now`), `writeLetterDraft` при публикации изменённого текста
  (`updated`); публикация неизменённого — только `draft_text = NULL` (время не меняется, отметки нет)
- [X] T005 [US1] `src/cron.js` `notifyWishlistChanges`: запрос от отметок (`research.md` R5: `FROM members w LEFT JOIN
  pairs p … LEFT JOIN events e … LEFT JOIN users s … WHERE w.notify_at > 0 AND w.notify_at <= ?`); для каждой строки —
  `UPDATE members SET notify_at = 0 WHERE event_id = ? AND user_id = ? AND notify_at = ?`; уведомление — только событие
  `active`, есть Санта, `upd > notified_at` (прежние `UPDATE pairs SET notified_at`, текст, кнопка, режим); настройки —
  только если есть кому писать; один пакет; комментарий над функцией — по-новому (057)
- [X] T006 [US1] `src/db.js`: сброс (`eventDataDeleteStmts`, `keepMember`) обнуляет `REGISTRY.members.notify`; слияние —
  поле `notify` в списке полей `personTransferStmts` (merge) и в `mergeMembership`: время последней правки объединённых
  письма и адреса (`Math.max` двух времён группы `personal`)
- [X] T007 [US1] `tests/cron-marks.test.mjs` (новый, в скрипт `test` в `package.json`; «мир» с `notifyDelay`): правка после
  жеребьёвки → отметка = время правки; до задержки — ни сообщения, отметка стоит; после — одно сообщение прежнего текста с
  кнопкой, отметка 0, `notified_at` = время; серия правок — одно сообщение; адрес — «письмо или адрес доставки»; `off` —
  без сообщения, правка учтена; `silent` — без звука; до жеребьёвки и черновик, открытка, сохранение без изменений — без
  отметки; публикация черновика — отметка и уведомление; правка во время обработки (`beforeWrite` на снятие) — отметка
  остаётся, второе сообщение после задержки; завершённое событие и участник без Санты (удалён после правки) — снятие
  молча; полный сброс — отметки 0; перенос участия — отметка у нового аккаунта, уведомление его Санте; слияние участий —
  отметка по объединённому письму
- [X] T008 [US1] В `tests/cron-marks.test.mjs` — статическое правило контракта: каждый литерал `src/*.js` с
  `wishlist_updated_at = ?` или `delivery_updated_at = ?` содержит `${NOTIFY_MARK}`; «от противного» — литерал без
  отметки находится; поведенческое «от противного» — без `NOTIFY_MARK` в одной из трёх записей уведомление не приходит
  (подмена текста оператора)
- [X] T009 [US1] `tests/cron-reads.test.mjs`: запрос уведомлений — план `SEARCH w USING … INDEX members_notify
  (notify_at>? AND notify_at<?)`, пара — по `(event_id=? AND ward=?)`, событие и Санта — по ключу; к полному просмотру
  допускаются только `settings` и `outbox` (`events_active` больше не допускается); «от противного» — запрос 054
  (`FROM events e CROSS JOIN pairs p …`) просматривает индекс идущих событий, база без `members_notify` — просмотр
  `members`

## Phase 3: User Story 2 — ежедневный шаг раз в день (P1)

**Goal**: событие читается ежедневным шагом раз в сутки; автодействия после проверки — в следующую минуту; напоминания
не повторяются.

**Independent Test**: второй ежедневный шаг за день не находит событий; `admin.game` с автожеребьёвкой «сегодня» →
жеребьёвка в следующую минуту; напоминание не повторяется.

- [X] T010 [US2] `src/stale.js`: `dailyEventsQuery` — `FROM events WHERE status = 'active' AND checked_on < ?2`
  (комментарий: индекс `events_unchecked`, 057); `warnStale` — `checked_on = ?` в захвате вместе с `last_daily`
- [X] T011 [US2] `src/cron.js` `dailyStep`: тихие и события с `last_daily` = сегодня без автодействия — один список,
  `markDaily(db, 'last_daily = ?, checked_on = ?', …)`; снятие отметки 056 — `last_daily = ?, finish_warned = '',
  checked_on = ?`; пакет напоминания — `updateEventStmt(…, { last_daily, checked_on })`; `markDaily` принимает значения
  `SET` списком; комментарий `dailyStep` — 057
- [X] T012 [P] [US2] Снятие отметки: `saveEventSettings` (`src/events.js`) — `checked_on: ''` в полях записи; захват
  `runDraw` (`src/pairs.js`) — `checked_on = ''`
- [X] T013 [US2] В `tests/cron-marks.test.mjs`: два события — первый ежедневный шаг отмечает оба `checked_on` = сегодня,
  второй — запрос ежедневного шага возвращает 0 строк и минута — 3 запроса; `admin.game` с `draw_auto_date` = сегодня →
  жеребьёвка в следующую минуту; ручная жеребьёвка при `reveal_auto` и прошедшей дате → автораскрытие в следующие
  минуты; сброс → событие снова проверяется; напоминание сегодня → `admin.game` → событие перечитано, второго напоминания
  нет; несколько напоминаний — по одному в минуту, отмечаются по мере выполнения; «от противного» — без снятия в
  `saveEventSettings` / `runDraw` автодействие в этот день не наступает
- [X] T014 [P] [US2] `tests/auto-finish.test.mjs`: «перемотка» `z.set` снимает и `checked_on`; `tests/cron-reads.test.mjs`
  — правка `draw_auto_date` прямым SQL заменена на `admin.game` (как делает организатор); план ежедневного шага —
  `SEARCH events USING INDEX events_unchecked (checked_on<?)`

## Phase 4: User Story 3 — обновление без потерь (P2)

**Goal**: ждущие уведомления не теряются при миграции и выкате; откат безопасен.

**Independent Test**: база «до 0020» с ждущей правкой → миграция → уведомление; правка прежним кодом → сверка → отметка;
повтор сверки — без изменений.

- [X] T015 [US3] `tools/notify-reconcile.sql`: комментарий (057: после выката и после возврата нового кода; схему не
  меняет; повтор ничего не меняет) и тот же `UPDATE`, что в `0020_cron_marks.sql`
- [X] T016 [US3] `tests/migrations.test.mjs`: 0020 — две колонки с умолчаниями, два частичных индекса, версия 20; база с
  данными «до 0020» — отметка только у подопечного с неучтённой правкой в идущем событии, остальные строки прежние;
  сверка — оператор побайтно как в миграции, без версии схемы, на базе после «прежнего кода» ставит отметку, повтор ничего
  не меняет; после миграции новый cron шлёт ждущее уведомление

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T017 [P] `docs/api.md`: раздел cron — уведомления по отметке участника, ежедневный шаг по отметке события и что её
  снимает; `wishlist.save`/`wishlist.publish`/`delivery.save` — отметка при наличии Санты (без изменений ответа)
- [ ] T018 [P] `README.md`: «Обновление бота» — миграция `0020_cron_marks.sql` (схема 20) в обе базы до выката и сверка
  `tools/notify-reconcile.sql` после выката; дерево `tools/`
- [ ] T019 [P] `CLAUDE.md`: строка 057 в таблице фич, миграции (`0020`, схема 20), `src/cron.js`, `src/participant.js`
  (`NOTIFY_MARK`), `src/stale.js`, `tools/`, тесты (`cron-marks`, `cron-reads`, `migrations`)
- [ ] T020 [P] `docs/todo.md`: пункты 1 и 3 «Важного» — сделаны в 057 (убрать), оценки расхода — по замерам и после 057;
  группы оставшихся (2 + 4 — следующая фича, 5 — только при упоре в лимит запросов)
- [ ] T021 `npm run test:all` зелёный; задачи отмечены; спецификация — статус «Реализовано»

## Dependencies & Execution Order

- Phase 1 → всё остальное (схема 20 нужна «миру»: он применяет `migrations/`).
- US1 (T004–T009) и US2 (T010–T014) независимы друг от друга; внутри — код, затем тесты.
- US3 (T015–T016) — после T001.
- Polish — после всех историй.

## Parallel Opportunities

- T003 параллельно T001–T002.
- T012 параллельно T010–T011 (разные файлы).
- T017–T020 параллельно друг другу.

## Implementation Strategy

MVP — Phase 1 + US1 (главная статья расхода: ≈ 3 000 строк в сутки на участника). Затем US2, US3, документация. Выкат —
по команде владельца, `quickstart.md`.

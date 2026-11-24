# Tasks: 056. Автозавершение брошенных событий в открытом боте

**Input**: `specs/056-auto-finish-stale/` — spec.md, plan.md, research.md, data-model.md, contracts/auto-finish.md,
quickstart.md

**Tests**: нужны (Конституция VI, правила проекта: `npm test` перед коммитом, «от противного» у каждого правила).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Один Worker: `src/`, `migrations/`, `tests/`, `docs/` в корне репозитория.

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Миграция `migrations/0019_finish_warned.sql`: комментарий (056, применять до выката кода, прежний код колонку
  не читает), `ALTER TABLE events ADD COLUMN finish_warned TEXT NOT NULL DEFAULT ''` и
  `INSERT INTO settings (key, value) VALUES ('schema', '19') ON CONFLICT(key) DO UPDATE SET value = excluded.value`
- [X] T002 `REQUIRED_SCHEMA = 19` в `src/db.js`
- [X] T003 [P] `EVENT_STATE_RESET.finish_warned = ''` в `src/event-params.js` (полный сброс снимает отметку; образец не
  копирует — служебная колонка)

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 Новый модуль `src/stale.js` (056): пороги `STALE = { afterDate: 7, empty: 23, age: 113, wait: 7 }`; чистые
  `staleReason(ev, today, created)` → `'date' | 'empty' | 'age' | null` (дата есть → только А; даты нет → Г при
  `draw_done = 0` и `outsiders === 0`, иначе Б; сравнение местных дат через `addDays`) и `staleStep(ev, today, created)`
  → `{ act: 'warn', reason, until } | { act: 'finish' } | { act: 'clear' } | null` по `ev.finish_warned`;
  `dailyEventsQuery(db, { open, today, since })` — идущие события (`WHERE e.status = 'active'`, индекс `events_active`)
  с колонкой `outsiders` по `contracts/auto-finish.md` («Запросы»)
- [X] T005 В `src/stale.js` — `warnStale(ctx, ev, step, today)`: получатели `adminRecipients(await ctx.users())`,
  тексты и кнопка «⚙️ Открыть событие» дословно по контракту, `atomic` по прежнему состоянию (`status = 'active' AND
  finish_warned = ''`): `enqueue` и `audit(ev.id, 0, 'finish.warn', '<причина>; завершится <дата>')` перед захватом
  `UPDATE events SET finish_warned = ?, last_daily = ? …`
- [X] T006 `src/cron.js` `dailyStep`: запрос событий — `dailyEventsQuery` (`open = openBot(env)`, `since` = сейчас − 22
  дня); порядок для события без автодействия и с `last_daily != сегодня`: завершение по правилам (`finishEvent(ctx, ev,
  0)`) → напоминание → предупреждение (`warnStale`) → снятие отметки (пакетом `UPDATE events SET last_daily = ?,
  finish_warned = '' WHERE id IN (…)`, по 90) → «тихое»; кандидаты — общий список, один за запуск

## Phase 3: User Story 1 — с прошедшей датой (P1) 🎯 MVP

- [X] T007 [US1] `tests/auto-finish.test.mjs` (новый, в скрипт `test` в `package.json`): мир открытого бота с
  компанией и событием; правило А — дата 6 дней назад → нет; 7 дней → одно предупреждение каждому организатору (текст по
  контракту, кнопка), журнал `finish.warn` «дата вручения прошла; завершится <дата>», `finish_warned = сегодня`;
  повторный шаг в тот же день — ничего; перенос даты в будущее → отметка снята тихо; отметка 6 дней назад → ничего, 7 —
  завершено прежним сообщением, журнал `finish` от бота

## Phase 4: User Story 2 — пустое без даты (P1)

- [X] T008 [US2] В `tests/auto-finish.test.mjs`: правило Г — только организаторы (в т.ч. «Я участвую») или никого, 22
  дня → нет, 23 → предупреждение «никто не вступил»; вступил участник → отметка снята; жеребьёвка проведена → не Г;
  отметка 7 дней назад → завершено

## Phase 5: User Story 3 — без даты 120 дней (P2)

- [X] T009 [US3] В `tests/auto-finish.test.mjs`: правило Б — событие с участником, 112 дней → нет, 113 →
  предупреждение «нет даты вручения»; дата в будущем → снята; через 7 дней без даты → завершено

## Phase 6: User Story 4 — закрытый бот и обычная работа (P1)

- [X] T010 [US4] В `tests/auto-finish.test.mjs`: закрытый бот — те же события ни предупреждений, ни завершения,
  `finish_warned` пусто; два одновременных запуска (`together`) → одно предупреждение и одна запись; полный сброс снимает
  отметку; планы всех операторов вызова cron без полных просмотров (кроме `settings`, `outbox`, `events_active`) и с
  кандидатами Г; обычная минута — 3 запроса; чистые `staleReason`/`staleStep` на границах; «от противного» — старый
  запрос событий не даёт `outsiders`
- [X] T011 [P] [US4] `tests/migrations.test.mjs`: `0019` — ровно колонка `events.finish_warned TEXT NOT NULL DEFAULT ''`
  и версия 19

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T012 [P] `src/app/07-vault-audit.js.txt`: `AUDIT_LABELS['finish.warn'] = '⏳ Предупреждение об автозавершении'`
- [X] T013 [P] `docs/api.md`, «Коды журнала»: строка `finish.warn`; у `finish` — «cron: автозавершение брошенных событий
  в открытом боте (056)»
- [X] T014 README: «Открытый бот» — правила автозавершения (пороги, предупреждение, как оставить событие); «Обновление
  бота» — миграция `0019` в обе базы до выката
- [X] T015 `CLAUDE.md` (строка 056 в таблице фич, `src/stale.js` в «Структура», миграция `0019` и схема 19, тест
  `auto-finish`), `docs/todo.md` (пункт 1 раздела «Важное» — сделан, убрать), статус спецификации
- [X] T016 `npm test` и `npm run test:all` зелёные; отметить задачи

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → Phase 3–6 (тесты одного файла — по порядку) → Phase 7.

### User Story Dependencies

- Все истории опираются на T004–T006; между собой независимы (разные правила в одном тестовом файле).

### Within Each User Story

- Сначала модуль и cron (Phase 2), затем тесты истории; при падении — правка `src/stale.js`/`src/cron.js`.

### Parallel Opportunities

- T003 параллельно T001–T002; T011, T012, T013 — разные файлы.

## Parallel Example: User Story 4

```text
T011 tests/migrations.test.mjs  ‖  T012 src/app/07-vault-audit.js.txt  ‖  T013 docs/api.md
```

## Implementation Strategy

### MVP First (User Story 1 Only)

Phase 1–2 и правило А — уже самостоятельная польза (праздник прошёл — событие закрывается).

### Incremental Delivery

Г и Б добавляют тесты к тому же модулю; выкат — одной версией с миграцией (`quickstart.md`).

### Parallel Team Strategy

Не нужна: фича небольшая.

## Notes

- Коммит — после каждой логической единицы, перед коммитом `npm test`.
- Тексты и пороги — только по контракту; новые — сначала в контракт.

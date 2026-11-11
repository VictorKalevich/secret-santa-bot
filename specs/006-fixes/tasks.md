---

description: "Задачи: исправления по ревью и миграции базы"
---

# Tasks: Исправления по ревью и миграции базы

**Input**: `/specs/006-fixes/` · **Tests**: да (принцип VI конституции)

Формат: `[ID] [P?] [Story] Описание (файлы)`. `[P]` — можно делать параллельно (разные файлы, нет зависимостей).

## Phase 1: Setup — миграции (US7, блокирует остальное)

- [ ] T601 Создать `migrations/0001_initial.sql`: схема 005 из `src/db.js` (`SCHEMA`) один в один —
  `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` для `settings`, `users`, `events`, `members`, `exclusions`,
  `pairs`, `messages`, `outbox` + `INSERT INTO settings (key, value) VALUES ('schema','5') ON CONFLICT(key) DO UPDATE
  SET value = excluded.value`
- [ ] T602 Создать `migrations/0002_fixes.sql`: `ALTER TABLE users ADD COLUMN blocked_at INTEGER NOT NULL DEFAULT 0`;
  `ALTER TABLE outbox ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0`;
  `ALTER TABLE events ADD COLUMN draw_token TEXT NOT NULL DEFAULT ''`;
  `CREATE INDEX IF NOT EXISTS outbox_chat ON outbox (chat_id, id)`; `schema = '6'`
- [ ] T603 `wrangler.toml`: `migrations_dir = "migrations"` в блоке `[[d1_databases]]`
- [ ] T604 `src/db.js`: заменить `ensureSchema` на `checkSchema(db)` — один раз на isolate читает `settings.schema`;
  если таблицы нет или номер < 6 — `throw new SchemaError()`; удалить `SCHEMA`, `LEGACY_TABLES` и пересоздание.
  Экспорт `REQUIRED_SCHEMA = 6`
- [ ] T605 `src/index.js`: `fetch` ловит `SchemaError` → 500 «База не подготовлена: примени миграции (см. README)»
  (JSON для `/api/*`); `scheduled` — `console.log` и выход
- [ ] T606 `tests/harness.mjs`: перед `wrangler dev` выполнять `npx wrangler d1 migrations apply DB --local
  --persist-to <dir>`; опция `startWorld({ migrate: false })` для теста неготовой базы; помощник `world.migrate()`

## Phase 2: US1 — Перенос участия не раскрывает пары (P1)

- [ ] T607 [US1] `src/api.js` `admin.transfer`: 400 «Переносить участие на аккаунт администратора нельзя», если
  `to` — админ или владелец
- [ ] T608 [US1] `src/game.js` `transferAccount(env, fromId, toId, actor)`: в том же batch — сообщение прежнему аккаунту
  («🔁 Твоё участие в «Тайном Санте» перенесено на аккаунт <имя>. Если это не ты — напиши организатору.») и всем
  администраторам, кроме `actor` и `toId` («🔁 <актор> перенёс участие <from> на аккаунт <to>.»), `disable_notification`
- [ ] T609 [P] [US1] `src/app.html`: `transferTargets` исключает администраторов

## Phase 3: US2 — Сообщения переписки доходят всегда (P1)

- [ ] T610 [US2] `src/game.js`: `shortTitle(title, max = 40)` — обрезка по единицам UTF-16 без разрыва суррогатной пары,
  с «…»; использовать в заголовке `sendChatMessage`
- [ ] T611 [P] [US2] `tests/mock-telegram.mjs`: `sendMessage` с текстом длиннее 4096 после удаления тегов и
  раскрытия `&amp;/&lt;/&gt;/&quot;` → 400 «Bad Request: message is too long»

## Phase 4: US3 — Жеребьёвка в лимите CPU (P1)

- [ ] T612 [US3] `src/draw.js` `findAssignment`: индексы 0..n−1 и матрица допустимости; общий счётчик шагов (по
  умолчанию 150 000, параметр `budget`), исключение-сигнал при исчерпании; порядок: `diagnose` → одно паросочетание
  (нет → `too_strict`) → без кольцевой вернуть его → кольцевая: `findCycle`, затем повторы паросочетаний без взаимных пар →
  иначе `search_exhausted` (если бюджет кончился) или `ring_impossible`
- [ ] T613 [US3] `src/game.js` `describeProblem`: текст для `search_exhausted`
- [ ] T614 [P] [US3] `tests/draw.test.mjs`: замер `performance.now()` ≤ 10 мс для 50 участников — невыполнимые
  ограничения (кольцевая и обычная), почти невозможные; 100 жеребьёвок по 50 участников без ограничений успешны;
  прежние тесты зелёные

## Phase 5: US4 — Двойная жеребьёвка невозможна (P2)

- [ ] T615 [US4] `src/game.js` `runDraw`: первый оператор batch —
  `UPDATE events SET draw_done=1, draw_at=?, draw_token=?, registration_open=0, revealed=0 WHERE id=? AND draw_done=0`;
  вставки пар и уведомлений — `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM events WHERE id=? AND draw_token=?)`;
  `meta.changes = 0` → «Жеребьёвка уже проведена.»; `resetEvent` сбрасывает `draw_token = ''`; `db.js` `EVENT_FIELDS`
  + `draw_token`

## Phase 6: US5 — Админ видит, кому не доходят сообщения (P2)

- [ ] T616 [US5] `src/game.js` `flushOutbox`: захват (`locked_until`, без более старого захваченного тому же `chat_id`),
  отправка, пропуск остальных сообщений человеку после его сбоя, остаток пачки после 429; итоговый batch: удаление
  отправленных/окончательно отклонённых/старше 2 суток, `locked_until = 0` для повторных, `users.blocked_at = now` для 403
- [ ] T617 [US5] Снятие отметки: `src/bot.js` (сообщение или нажатие от человека с `blocked_at > 0`), `src/api.js`
  (любой запрос такого человека); `src/db.js` `eventMembers` выбирает `u.blocked_at`; `USER_FIELDS` + `blocked_at`
- [ ] T618 [US5] `src/api.js` `admin.state`: поле `blocked`; `src/app.html`: метка `ui.chip('🚫 не получает сообщения',
  'warning')` в списке участников

## Phase 7: US6 — Мелкие исправления (P3)

- [ ] T619 [P] [US6] `src/api.js`: `admin.reveal` — 400 «Тайна уже раскрыта» при `revealed`; `admin.remove` — 400
  «Человек не участвует в этом эвенте»; `admin.exclusion.add` — 400 «Исключение можно задать только между участниками
  эвента»; `admin.rename` — «Участник не найден» / 403 «Переименовать администратора может только владелец бота»
- [ ] T620 [P] [US6] `src/app.html`: «Переименовать» для администраторов показывать только владельцу (и себе)

## Phase 8: Tests & Polish

- [ ] T621 `tests/e2e.test.mjs`: сценарии из `quickstart.md` — перенос (отказ и уведомления), длинное название +
  4000 символов, два одновременных `admin.draw`, `blocked` и его снятие, повторное раскрытие, отказы мелочей,
  неготовая база, миграция с базы 0001 с данными
- [ ] T622 [P] README: шаг «Создайте базу» — применить миграции (`--remote`); раздел «Обновление бота» (pull → migrations
  apply → deploy); «Резервная копия» (`wrangler d1 export`, Time Travel); «Для разработки» — `--local` миграции;
  «Если что-то не так» — «База не подготовлена» (`README.md`)
- [ ] T623 [P] CLAUDE.md: миграции (`migrations/`, схема 6, новые поля), строка фичи 006; контракт 005
  (`specs/005-events-history/contracts/events.md`) — ссылка на изменения 006
- [ ] T624 `npm test`, `npm run test:e2e`, `npm run screenshots`; прогон `quickstart.md`

## Dependencies

- Phase 1 (T601–T606) — до всего остального: код требует схему 6, e2e — миграции.
- US1, US2, US3, US6 независимы друг от друга. US4 и US5 зависят только от T602 (новые поля).
- T621 — после всех историй; T622–T623 — в любой момент после Phase 1.

## Parallel Example

```text
После Phase 1: T607–T609 (US1) ‖ T610–T611 (US2) ‖ T612–T614 (US3) ‖ T619–T620 (US6)
```

## Implementation Strategy

MVP — Phase 1 + US1 (тайна) + US2 + US3: без них нельзя выкатываться. US4–US6 в той же ветке, одним выкатом.
Коммиты по логическим единицам: миграции; тайна и переписка; жеребьёвка; очередь и отметка блокировки; мелочи; тесты
и документация.

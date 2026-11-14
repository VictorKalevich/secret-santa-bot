# Tasks: Повторные нажатия — одно действие, один результат

**Input**: Design documents from `specs/024-repeat-press/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: проверки одновременных вызовов и тест кнопок — требование спецификации (SC-2401–SC-2403); пишутся до правки
и сначала падают.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: история спецификации (US1–US4)

---

## Phase 1: Setup

- [X] T001 Снять «до»: `npm test` (185, зелёные, время), `node tests/bench/queries.mjs` — строки `admin.announce`,
  `admin.remind.*`, `admin.event.invite_from`, `admin.reset.full`, `admin.role.*`, `admin.owner.transfer`,
  `admin.family.save`

---

## Phase 2: Foundational

- [X] T002 `src/db.js`: `updateEventIfStmt(db, id, fields, guard, ...args)` — как `updateEventStmt`, условие
  `AND (guard)`, те же проверки полей (research R2)

---

## Phase 3: User Story 1 — Рассылка уходит один раз (Priority: P1) 🎯 MVP

**Goal**: объявление, ручные напоминания, приглашение — один раз за минуту (research R1).

**Independent Test**: `node --test tests/atomic.test.mjs` — проверки рассылок блока 024.

- [X] T003 [US1] `tests/atomic.test.mjs`: блок `describe('атомарность: повторные нажатия (024)', …)`, вызовы в одну
  миллисекунду (`sameMoment`): `admin.announce` ×2 с одним текстом — ответы 200/400 «Это объявление уже отправлено.»,
  у участника одно объявление, строк `announcements` 1, запись `announce` 1; два разных текста одновременно — оба 200;
  то же объявление после сдвига времени записей на 61 с назад — 200; `admin.remind.unfilled` ×2 — по одному
  напоминанию, запись одна, отказ «Напоминание уже отправлено — повторить можно через минуту.»;
  `admin.remind.santas` ×2 (после жеребьёвки) — то же; `admin.event.invite_from` ×2 (новое событие, приглашение из
  первого) — по одному приглашению, запись одна, отказ «Приглашения уже отправлены — повторить можно через минуту.»
  Запустить — падают
- [X] T004 [US1] `src/events.js`: `REPEAT_MS = 60 * 1000`; `announce` — `atomic` с условием «нет объявления с тем же
  текстом новее `now − REPEAT_MS`», сообщения и журнал — перед захватом, захват — `INSERT INTO announcements … SELECT
  …` последним; проигрыш — отказ; `remindUnfilled`/`remindSantas` при `actor` — `atomic` с условием «нет записи
  журнала этого кода в событии новее `now − REPEAT_MS`», сообщения перед захватом, захват — запись журнала; плановый
  путь (`actor = 0`, `extra`) — прежний; `inviteFromEvent` — то же с кодом `invite.from`. API-строки напоминаний
  передают отказ (`count` → `out`), объявление и приглашение — уже через `out`. T003 — зелёный

---

## Phase 4: User Story 2 — Роли, владение и сброс — один раз (Priority: P1)

**Goal**: назначение, снятие, передача владения, полный сброс — один результат (research R2, R3).

**Independent Test**: `node --test tests/atomic.test.mjs` — проверки ролей и сброса.

- [X] T005 [US2] `tests/atomic.test.mjs`, тот же блок (`sameMoment`): `admin.role.grant` ×2 — 200/400 «Он(а) уже
  администратор.», назначенному одно сообщение, другому админу одно, `role.grant` +1; `admin.role.revoke` ×2 у админа
  со взятым обращением — 200/400 «Он(а) не администратор.», ему одно сообщение, автору обращения одно «снова ждёт
  ответа», `role.revoke` +1, `support.return` +1; `admin.owner.transfer` ×2 — 200/400 «Права владельца уже
  переданы.», новому владельцу одно сообщение, `owner.transfer` 1; `admin.reset.full` ×2 — 200/400 «Событие уже
  сброшено или изменилось одновременно со сбросом — обнови экран.», каждому удалённому одно уведомление, `reset` 1.
  Запустить — падают
- [X] T006 [US2] `src/roles.js`: `grantAdmin` и `revokeAdmin` — `atomic` «по прежнему состоянию» (`is_admin = 0` /
  `= 1`), сообщения, возврат обращений и журнал — перед захватом, захват — `UPDATE users … AND is_admin = …`
  последним, проигрыш — прежние тексты; `setOwner` при `via: 'transfer'` — условие «владелец прежний», захват —
  `UPDATE settings SET value = ? WHERE key = 'owner_id' AND value = ?` последним, возвращает `{ won }`; ссылка
  (`via: 'link'`) — прежний порядок; `transferOwnership` — отказ «Права владельца уже переданы.»
- [X] T007 [US2] `src/support.js`: `returnThreadsStmts(db, settings, users, adminId, guard = ['1'])` — условие у
  `UPDATE support_threads`, сообщений и журнала (по умолчанию — прежнее поведение)
- [X] T008 [US2] `src/events.js`, `resetEvent`: захват первым — `updateEventIfStmt(…, 'invite_code = ?',
  ev.invite_code)` с новым кодом; уведомления, `eventDataDeleteStmts(…, { keepMember, keepEvent: true }, ...guard)` и
  журнал — после, с условием «код события — новый»; проигрыш — `{ ok: false, error }`; `src/api.js`, строка
  `admin.reset.full` — отказ через `refuse`. T005 — зелёный

---

## Phase 5: User Story 3 — Семья: отказ вместо ошибки сервера (Priority: P2)

**Goal**: второе одновременное сохранение новой семьи — 400 «… уже в семье «…».» (research R4).

**Independent Test**: `node --test tests/atomic.test.mjs` — проверка семьи.

- [X] T009 [US3] `tests/atomic.test.mjs`, тот же блок: `admin.family.save` ×2 (новая, один состав, `sameMoment`) —
  200/400, текст отказа `… уже в семье «…».`, семей 1, `family.save` 1. Запустить — падает (500)
- [X] T010 [US3] `src/membership.js`, `saveFamily`: запрос «кто уже в семье» — функцией; пакет в `try`; ошибка
  `UNIQUE constraint failed: family_members` — повторить запрос и вернуть прежний отказ; иначе — пробросить. T009 —
  зелёный

---

## Phase 6: User Story 4 — Кнопки блокируются на время запроса (Priority: P2)

**Goal**: ни одного вызова «занято» без кнопки (research R5).

**Independent Test**: `node --test tests/app-buttons.test.mjs`.

- [X] T011 [P] [US4] `tests/app-buttons.test.mjs`: склейка приложения (`tests/support/app-source.mjs`) — нет
  `busy(null` и `busy(undefined`, место нарушения — часть и строка (`where`); «от противного» — искусственный текст с
  `busy(null, …)` даёт нарушение; `package.json` — файл в скрипт `test`. Запустить — 6 нарушений
- [X] T012 [US4] `src/app/02-core.js.txt`: `busy(btn, fn)` — `btn` кнопка, список или `null` (все блокируются и
  разблокируются); `src/app/03-home.js.txt`: режимы уведомлений — все кнопки переключателя, строка администратора —
  обе кнопки; `src/app/05-admin.js.txt`: заявка — обе кнопки, удаление исключения и закреплённой пары —
  `e.currentTarget`. T011 — зелёный
- [X] T013 [US4] `design-system/components.css`: `.ds-icon-btn:disabled, .ds-segmented__item:disabled { opacity:
  var(--ds-opacity-disabled); cursor: default; }`; `design-system/preview.html` — недоступная круглая кнопка и пункт
  переключателя; `design-system/README.md` — строка о состоянии; `tests/design-system.test.mjs` зелёный

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T014 [P] `tests/atomic.test.mjs`: заголовок — 32 → 43 проверки «один результат» (+11, 024); снять фразу
  «случаи без захвата … — решения владельца, здесь их нет»
- [ ] T015 [P] `docs/api.md`: отказы повтора в разделах `admin.announce`, `admin.remind.unfilled`,
  `admin.remind.santas`, `admin.event.invite_from`, `admin.reset.full`, `admin.role.grant`, `admin.role.revoke`,
  `admin.owner.transfer`, `admin.family.save`; в «Порядке проверок» — абзац про окно повтора
- [ ] T016 [P] `CLAUDE.md`: строка 024; в правиле «Одно действие — один результат» — рассылки по желанию (окно
  минута), роли, владение, сброс; `atomic` — 43 проверки; `app-buttons` в списке тестов; `updateEventIfStmt` в
  описании `src/db.js`
- [ ] T017 [P] `docs/refactoring-roadmap.md` — пункты «рассылки без защиты», «двойное сохранение семьи», кнопки
  `busy(null…)` — сделано (024); `docs/refactoring/baseline.md`, раздел 4 — строки «решение владельца» → «исправлено
  (024)», таблица «один результат» + новые строки; `docs/refactoring/step-6-app-split.md` — пункт `busy(null…)` —
  сделано (024)
- [ ] T018 `npm test` (3 прогона, время; `queries` — прежние числа), `npm run test:e2e`, `npm run screenshots`
  (экраны с режимами уведомлений и панелью — вид прежний); `git diff main --stat`
- [ ] T019 Отметки задач, статус spec/plan — «реализовано»; коммиты; слияние в `main` (`--ff-only`), `git push`;
  память проекта — план решений владельца

---

## Dependencies & Execution Order

- T001 → T002 → истории. В каждой истории тест (T003, T005, T009, T011) — до правки и падает.
- US1 (T003–T004), US2 (T005–T008), US3 (T009–T010), US4 (T011–T013) независимы, кроме общего файла
  `tests/atomic.test.mjs` и `src/events.js` (US1 и US2) — последовательно.
- Polish — после историй; T014–T017 — разные файлы.

## Implementation Strategy

1. MVP — US1 (рассылки видят все участники).
2. US2, US3 — сервер; US4 — приложение и дизайн-система.
3. Документы, замеры, слияние.

Коммиты: сервер с тестами (US1–US3) — один; приложение и дизайн-система (US4) — один; документы — один; приёмка —
один. Перед коммитами с кодом — `npm test`.

---

description: "Задачи: инструменты организатора"
---

# Tasks: Инструменты организатора

**Input**: `/specs/007-admin-tools/` · **Tests**: да (принцип VI)

## Phase 1: Foundational

- [X] T701 `migrations/0003_admin_tools.sql`: таблицы `announcements`, `audit` (+ индексы `(event_id, id)`), поля
  `events.draw_auto_date TEXT NOT NULL DEFAULT ''`, `events.reveal_auto INTEGER NOT NULL DEFAULT 0`,
  `events.finish_auto INTEGER NOT NULL DEFAULT 0`, `pairs.gift_received INTEGER NOT NULL DEFAULT 0`,
  `pairs.gift_received_at INTEGER NOT NULL DEFAULT 0`; `schema = '7'`
- [X] T702 `src/db.js`: `REQUIRED_SCHEMA = 7`; `EVENT_FIELDS` + поля расписания; `auditStmt(db, eventId, actor, action,
  details)`; `getAudit(db, eventId|null, limit)` с именем автора
- [X] T703 Журнал во всех действиях админа (`src/api.js`, `src/game.js`): коды из `contracts/api.md`; `src/bot.js` —
  `owner.link`; `deleteEvent`/`resetEvent` удаляют объявления, журнал не трогают

## Phase 2: US1 — Объявление (P1)

- [X] T704 [US1] `src/game.js` `announce(env, ev, actor, text)`: проверка 1–2000, сохранение, рассылка через outbox,
  журнал; `src/api.js` `admin.announce`; `event.get` + `announcements`
- [X] T705 [US1] `src/app.html`: «Админ» → карточка «📣 Объявление» (textarea + кнопка); «Инфо» → раздел «Объявления»

## Phase 3: US2 — Расписание (P1)

- [X] T706 [US2] `src/api.js` `admin.game`: `draw_auto_date` (дата или ''; запрет менять после жеребьёвки),
  `reveal_auto`, `finish_auto`; `admin.state.settings` + эти поля
- [X] T707 [US2] `src/game.js` `autoActions(env, ev, today)` + `src/cron.js`: порядок жеребьёвка → раскрытие →
  завершение; ≤ 1 эвент с автодействием за вызов; неудача автожеребьёвки — сообщение админам, дата снимается, журнал
- [X] T708 [US2] `src/app.html`: в «Параметры эвента» поле «Автожеребьёвка» (дата, до жеребьёвки) и два переключателя
  с подсказкой про час напоминаний

## Phase 4: US3–US4 — «Получил» и «не открыл» (P2)

- [X] T709 [US3] `src/api.js` `ward.received`; уведомление Санте при первой отметке; `event.get.member.gift_received`
- [X] T710 [US3/US4] `admin.state`: `gift_received`, `ward_seen`; `src/app.html`: переключатель «🎁 Я получил(а)
  подарок» во «Письме» (если есть Санта), метки «📦 получил», «👀 не открыл подопечного», счётчик «получено X из N»

## Phase 5: US5 — Эвент по образцу (P2)

- [X] T711 [US5] `src/game.js` `createEvent(env, title, by, { from, invite })`: копия параметров и исключений,
  приглашение; `admin.state.exclusions` — только между участниками
- [X] T712 [US5] `src/app.html`: в шторке «Новый эвент» — выбор образца и «пригласить его участников»

## Phase 6: US6 — Отмена жеребьёвки (P2)

- [X] T713 [US6] `src/game.js` `cancelDraw(env, ev, actor)` атомарно (research R3); `src/api.js` `admin.draw.cancel`;
  `admin.state.settings.draw_cancelable`
- [X] T714 [US6] `src/app.html`: кнопка «↩️ Отменить жеребьёвку» при `draw_cancelable` с подтверждением

## Phase 7: US7 — Журнал (P2)

- [X] T715 [US7] `src/api.js` `admin.audit` (по эвенту — в `FINISHED_OK`; общий — без `event`)
- [X] T716 [US7] `src/app.html`: «📜 Журнал действий» в панели эвента и в разделе «Администраторы» (шторка со списком)

## Phase 8: Tests & Polish

- [X] T717 `tests/e2e.test.mjs`: сценарии `quickstart.md`
- [X] T718 `tests/screenshots.mjs`: объявления в «Инфо», отметка «получил», журнал
- [X] T719 [P] `specs/005-events-history/contracts/events.md` — ссылка на контракт 007; CLAUDE.md (фича 007, схема 7)
- [X] T720 [P] README: объявления, расписание, «получил», «не открыл», образец, отмена жеребьёвки, журнал
- [X] T721 `npm test`, `npm run test:e2e`, `npm run screenshots`

## Dependencies

Phase 1 → все истории. Истории независимы друг от друга, кроме общего файла `src/app.html` (последовательно).

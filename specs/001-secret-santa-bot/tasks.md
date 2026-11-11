---

description: "Задачи реализации: Telegram-бот «Тайный Санта»"
---

# Tasks: Telegram-бот «Тайный Санта»

**Input**: Design documents from `/specs/001-secret-santa-bot/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: да — юнит-тесты жеребьёвки, проверка дизайн-системы, сквозной сценарий (Конституция, принцип VI).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно делать параллельно (разные файлы, нет зависимостей)
- **[Story]**: к какой пользовательской истории относится (US1…US8)

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Конфигурация Worker: `wrangler.toml` (D1, cron раз в минуту, vars, Text-правила для HTML/CSS), `package.json` (скрипты dev/deploy/test)
- [X] T002 [P] `.gitignore`, `.gitattributes` (LF, CRLF для `.ps1`), секреты вне репозитория
- [X] T003 [P] Токены дизайн-системы в `design-system/tokens.css`
- [X] T004 Компоненты дизайн-системы в `design-system/components.css` (только токены)
- [X] T005 [P] Витрина `design-system/preview.html` (светлая и тёмная тема)
- [X] T006 [P] Правила и каталог компонентов `design-system/README.md`
- [X] T007 Автотест правил дизайн-системы `tests/design-system.test.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T008 Схема D1 и запросы в `src/db.js` (авто-создание таблиц)
- [X] T009 [P] Bot API, проверка `initData`, производные секреты в `src/telegram.js`
- [X] T010 Маршрутизация Worker и страница настройки `/setup` в `src/index.js` (встраивание дизайн-системы)
- [X] T011 Очередь сообщений `outbox` и пачечная отправка в `src/game.js` (`flushOutbox`)
- [X] T012 Каркас мини-приложения в `src/app.html`: `h()`, `api()`, вкладки, toast, confirm, шторка

**Checkpoint**: основа готова — можно делать истории.

---

## Phase 3: User Story 1 — Регистрация и письмо (P1) 🎯 MVP

- [X] T013 [US1] `/start` с `inv_`/`adm_`, ввод имени, меню в `src/bot.js`
- [X] T014 [US1] API `me`, `wishlist.save` (≤1000 слов, только своё) в `src/api.js`
- [X] T015 [US1] Вкладка «Моё письмо» со счётчиком и защитой от потери изменений в `src/app.html`

## Phase 4: User Story 2 — Исключения и жеребьёвка (P1)

- [X] T016 [US2] Алгоритм жеребьёвки и диагностика в `src/draw.js`
- [X] T017 [P] [US2] Юнит-тесты жеребьёвки в `tests/draw.test.mjs`
- [X] T018 [US2] `checkDraw`/`runDraw` (закрытие регистрации, рассылка) в `src/game.js`
- [X] T019 [US2] API исключений и жеребьёвки (`admin.exclusion.*`, `admin.draw.check`, `admin.draw`) в `src/api.js`
- [X] T020 [US2] Блоки «Исключения» и «Жеребьёвка» во вкладке «Админ» в `src/app.html`

## Phase 5: User Story 3 — Подопечный и тайна (P1)

- [X] T021 [US3] `ward.get` с запоминанием просмотренной версии (`pairs.seen_text`) в `src/api.js`
- [X] T022 [US3] Вкладка «Подопечный»: скрытое имя, письмо, пословная подсветка изменений в `src/app.html`
- [X] T023 [US3] `admin.state` без пар и текстов писем в `src/api.js`

## Phase 6: User Story 4 — Уведомления (P2)

- [X] T024 [US4] Отложенные уведомления без спойлеров в `src/cron.js`
- [X] T025 [US4] Режимы уведомлений: `notify.set`, кнопки в чате, сегменты во вкладке «Инфо»

## Phase 7: User Story 5 — Панель администратора (P2)

- [X] T026 [US5] Приглашение (копировать/отправить/перевыпустить), регистрация, участники (статусы, 👁 с подтверждением, переименование, удаление), параметры игры
- [X] T027 [US5] Напоминания: вручную (`admin.remind.*`) и ежедневно в 10:00 по Минску (`src/cron.js`)

## Phase 8: User Story 6 — Анонимные вопросы (P3)

- [X] T028 [US6] Анонимные сообщения Санта ⇄ подопечный: чат (`msg:*`, `pending`) и мини-приложение (`message.send`)

## Phase 9: User Story 7 — Изменения после жеребьёвки (P3)

- [X] T029 [US7] Удаление/вписывание с минимальными изменениями пар (`removeFromAssignment`, `insertIntoAssignment`, `admin.remove`, `admin.insert`)

## Phase 10: User Story 8 — Финал (P3)

- [X] T030 [P] [US8] «Подарок готов» (`ward.gift`) и счётчик в админке
- [X] T031 [P] [US8] Раскрытие Сант (`admin.reveal`)
- [X] T032 [US8] Новая игра с историей пар и неповторением (`admin.newgame`, `avoid_previous`)

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T033 Имитация Telegram Bot API `tests/mock-telegram.mjs` и сквозной тест `tests/e2e.test.mjs` (US1–US8, проверки тайны и безопасности)
- [ ] T034 [P] Скриншоты мини-приложения `tests/screenshots.py` (Playwright) и визуальная проверка
- [ ] T035 [P] Пошаговая инструкция выката для Windows в `README.md`
- [ ] T036 [P] Контекст агента и правила работы в `CLAUDE.md`
- [ ] T037 Прогон `quickstart.md` (все тесты зелёные)

## Dependencies & Execution Order

- Phase 1 → Phase 2 → истории. US1 → US2 → US3 (последовательно: нужны участники и пары);
  US4–US8 зависят от US2/US3 и независимы между собой. Phase 11 — после всех историй.

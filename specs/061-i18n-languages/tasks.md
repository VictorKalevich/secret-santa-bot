---
description: "Задачи 061 — бот на языке человека (шаг 2 локализации)"
---

# Tasks: Бот на языке человека (шаг 2 локализации)

**Input**: `specs/061-i18n-languages/` — spec.md, plan.md, research.md (R1–R11), data-model.md,
contracts/language.md, contracts/translation.md, quickstart.md

**Tests**: да — спецификация требует проверок (SC-002, SC-004–SC-006, R11).

## Phase 1: Setup

- [ ] T001 Миграция `migrations/0022_languages.sql`: `users.tg_lang`, `users.menu_lang`, `audit.details_tx` (TEXT NOT
  NULL DEFAULT ''), схема 22; `REQUIRED_SCHEMA = 22` в `src/db.js`; `tests/migrations.test.mjs` — колонки и версия,
  строки прежние
- [ ] T002 Проверка словаря языка `tests/support/i18n-lang-check.mjs <язык>` по `contracts/translation.md` (ключи,
  виды значений, подстановки и формы `owner`, наборы форм числа по `Intl.PluralRules`, списки, кириллица, теги, слова
  подтверждения, пределы Telegram, `app.core.locale`); общие правила — в `tests/support/i18n-rules.mjs` для
  `tests/i18n.test.mjs`
- [ ] T003 Заготовки словарей `src/i18n/<язык>/index.js` (en, es, pt, fr, de, zh, it, tr, id, pl) — тот же `AREAS`, что у
  русского, комментарии по-английски

## Phase 2: Foundational

- [ ] T004 `src/i18n/index.js`: `LANGUAGES` (11), `RUSSIAN_SPEAKING`, `FALLBACK_LANG`, `telegramLanguage(code)`,
  `langOf(user, telegram)`, `foldWord(s, lang)`, `bootTexts()` — `{ texts: { <язык>: app.boot.* }, rule }`;
  `src/i18n/languages.js` — `LANGUAGE_NAMES`
- [ ] T005 `src/context.js`: `openContext(env, id, { telegramLang })` → `ctx.telegramLang`, `ctx.lang = langOf(me,
  telegramLang)`; `src/db.js` `createUserStmt` — `tg_lang`; `src/outbox.js` — язык получателя `langOf({ lang, tg_lang })`

## Phase 3: User Story 1 — язык без настройки (P1) 🎯 MVP

**Goal**: человек видит бота на языке Telegram по правилу; сообщения — на языке получателя.

**Independent Test**: `tests/i18n-languages.test.mjs` — коды `en`, `pt-br`, `zh-hant`, `uk`, `ka` → язык; игра целиком
для каждого из 10 языков без кириллицы у человека этого языка.

- [ ] T006 [P] [US1] Переводы: `src/i18n/<язык>/*.js` для 10 языков (исполнитель на язык, проверка T002, глоссарий
  `contracts/glossary/<язык>.md`)
- [ ] T007 [US1] `src/language.js` `syncLanguage(ctx)` — запись `tg_lang` при изменении; вызов во всех точках входа
  (`src/api.js` `handleApi`, `src/bot.js` `openChat`, `handleCallback`, `onSignupButton`), язык Telegram из `initData`
  и `from`; бот создаёт запись с `tg_lang`
- [ ] T008 [US1] Приложение: `BOOT` в странице (`src/index.js`), язык загрузки по `telegramLanguage` (`02-core`),
  `document.documentElement.lang`
- [ ] T009 [US1] Регистрация словарей в `src/i18n/index.js` (`DICTIONARIES` всех языков) после T006
- [ ] T010 [US1] `tests/i18n-languages.test.mjs`: правило кодов (таблица), язык из обращения (бот, кнопка, API), запись
  только при изменении, новый человек, отсутствие `language_code`; игра целиком на каждом из 10 языков
  (`langProblems` — кириллица у человека языка, ⟪…⟫ не нужна), русские получатели — прежнее; `tests/i18n.test.mjs` —
  полнота всех языков, `t` приложения = сервера на всех языках, `telegramLanguage` приложения = сервера

## Phase 4: User Story 2 — выбор языка (P1)

**Goal**: «🌐 Язык» в «Профиле» и `/language`.

**Independent Test**: выбор English у русского — экран и сообщения по-английски; «Как в Telegram» — обратно.

- [ ] T011 [US2] `src/language.js` `setLanguage(ctx, choice)`, `languagesView`; `src/api.js` `lang.set` (роль `USER`);
  `me` — `lang_choice`, `lang_auto`, `languages` (`src/participant.js`)
- [ ] T012 [US2] Бот: `/language` (`onLanguage`), кнопки `lang:auto|<код>` до проверки «зарегистрирован», ответ и меню /
  просьба имени на новом языке (`src/bot.js`, словарь `bot.lang.*`)
- [ ] T013 [US2] Приложение: «🌐 Язык» в `personalSections`, `openLangSheet` (`03-home`), после выбора — `reloadMe()` и
  перестройка с прежней прокруткой; словарь `app.home.lang.*`
- [ ] T014 [US2] Тесты: `lang.set` (коды, отказ, «как в Telegram»), `/language` и кнопки, выбор важнее Telegram, эталон
  отказов — проход `061 …` (`NEW_ACTIONS_061` в `tests/support/refusals-scenario.mjs`)

## Phase 5: User Story 3 — слова подтверждения и длины (P2)

- [ ] T015 [US3] `foldWord` в `confirmed` (`src/api.js`) и в `typedSheet` (`08-sheet-chat`); тест: слово языка,
  русское слово англичанину — отказ со словом его языка; сверка `foldWord` приложения и сервера
- [ ] T016 [US3] Длины: сообщения с текстом 4000 символов (переписка, обращения, объявление) ≤ 4096 на каждом языке;
  `app-ui` — худший случай подтверждений ≤ `CONFIRM_MAX` на каждом языке

## Phase 6: User Story 4 — профиль бота и кнопка меню (P2)

- [ ] T017 [US4] `src/bot-profile.js` — цели, вызовы, версия, `profileFrom`, `sendProfile`; `src/context.js` отмечает
  профиль; `src/index.js` `afterRequest` — отправка после очереди; `src/setup.js` — профиль в бюджете, `/language` в
  командах
- [ ] T018 [US4] Кнопка меню чата (`menu_lang`) в `syncLanguage` и `setLanguage`; команды чата при ручном выборе
- [ ] T019 [US4] Тесты: части по бюджету, версия и повтор при смене текстов, ошибка части, `/setup`, пределы Telegram;
  кнопка меню (en → кнопка, ru → общая, без повторов), команды чата; тестовый мир — профиль отмечен отправленным после
  `setup()`

## Phase 7: User Story 5 — журнал на языке смотрящего (P3)

- [ ] T020 [US5] `src/db.js`: `details_tx` в `auditStmt`/`auditIfStmt`, `getAudit` собирает на языке смотрящего; тест:
  русский и английский организаторы, прежние записи, длинный JSON

## Phase 8: User Story 6 — русскоязычные без перемен (P1)

- [ ] T021 [US6] `npm test`, эталоны без правок русских ожиданий (кроме `/language`, «🌐 Язык», описание бота); сверка
  с `main` сценарием сервера и экранов (как в 060)

## Phase 9: Polish

- [ ] T022 [P] Chrome: `tests/i18n-languages.ui.mjs` — en и zh без кириллицы на экранах и в шторках, смена языка в
  «Профиле»; `npm run screenshots`
- [ ] T023 [P] `docs/api.md` (`lang.set`, `me`, `/language`, `lang:`, профиль, журнал), README (языки, `/language`,
  миграция 0022), `CLAUDE.md` (строка 061, структура, правило, тесты), Конституция 4.0.0 (принцип II)
- [ ] T024 `npm run test:all`; коммит; push; слияние в `main`; выкат второго, проверка, выкат первого (quickstart)

## Dependencies

- T001–T005 → всё остальное; T006 идёт параллельно с T007–T008, T011–T020; T009 и игра на языках в T010 — после T006.
- US2 (T011–T014) и US4 (T017–T019) зависят от `src/language.js` (T007).

## Implementation Strategy

Переводы (самый длинный путь) — запустить сразу после T002–T003; инфраструктура (US1 без словарей, US2–US5) — в это
время на псевдоязыке; после переводов — регистрация, игра на 10 языках, Chrome, документация, выкат.

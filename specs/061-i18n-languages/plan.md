# Implementation Plan: Бот на языке человека (шаг 2 локализации)

**Branch**: `061-i18n-languages` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/061-i18n-languages/spec.md`

## Summary

Словари 10 новых языков (`src/i18n/<язык>/`, тот же набор ключей, что русский — R10) переводятся параллельно с
инфраструктурой, каждый проверяется `i18n-lang-check`. Язык человека — выбор (`users.lang`) → язык Telegram обращения →
запомненный язык Telegram (`users.tg_lang`) → русский (R1, R2); правило приведения кода Telegram — одно на сервере и в
приложении (R2, R7). Выбор — `lang.set` в «Профиле» и `/language` с кнопками в боте (R3); после выбора — кнопка меню и
команды чата на языке человека (R5, R6, `users.menu_lang`). Профиль бота (команды, описание, краткое описание для 20
кодов языка Telegram) — 60 вызовов, частями в конце обычных обращений по версии в настройках, `/setup` — в своём
бюджете (R4). Журнал хранит прежний русский текст и отложенный текст подробностей (`audit.details_tx`) — показ на языке
смотрящего (R8). Слова подтверждения сравниваются без регистра и диакритики на языке человека (R9). Миграция `0022`
(схема 22). Конституция 4.0.0 (принцип II переопределён).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет; `Intl.PluralRules`, `String.prototype.toLocaleUpperCase`, `normalize('NFD')` — встроенные

**Storage**: D1 — `users.tg_lang`, `users.menu_lang`, `audit.details_tx` (миграция `0022_languages.sql`, схема 22);
`settings.bot_profile` (без миграции)

**Testing**: `node:test` — `tests/i18n.test.mjs` (все языки), новый `tests/i18n-languages.test.mjs`, проход `061 …` эталона
отказов, `app-ui` (подтверждения на всех языках); Chrome — `tests/i18n-languages.ui.mjs`; проверка словаря языка —
`tests/support/i18n-lang-check.mjs`

**Target Platform**: Cloudflare Workers + Telegram Bot API + Telegram Mini App (iOS WebKit)

**Project Type**: веб-сервис (Worker) + мини-приложение (`src/app/`)

**Performance Goals**: обычное обращение — прежнее число запросов (язык Telegram пишется только при изменении,
профиль — только пока не отправлен); cron — прежние 3 запроса; словари всех языков в модуле Worker — подготовка раз на
экземпляр, `me` — словарь только своего языка

**Constraints**: ≤ 50 внешних запросов на вызов (профиль — по остатку, запас 4); ≤ 10 мс CPU; сообщение ≤ 4096
символов на каждом языке; подтверждение ≤ `CONFIRM_MAX`; русские тексты побайтно прежние (кроме «🌐 Язык», `/language`
в командах и описании бота)

**Scale/Scope**: 10 словарей × 30 файлов (≈ 1180 ключей каждый); `src/i18n/index.js`, `src/i18n/languages.js`,
`src/language.js`, `src/bot-profile.js`, `src/context.js`, `src/api.js`, `src/bot.js`, `src/index.js`, `src/setup.js`,
`src/outbox.js`, `src/db.js`, `src/participant.js`, части `02-core`, `03-home`, `08-sheet-chat`, `09-start`; миграция;
тесты; `docs/api.md`, README, `CLAUDE.md`, Конституция

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Переводы несут те же подстановки (нет имён подопечных и писем в уведомлениях — проверка подстановок); журнал на языке смотрящего — те же подробности, что раньше видел смотрящий; язык человека не связан с парами. | ✅ |
| II. Проще некуда для участника | Переопределяется: интерфейс — на языке человека (11 языков), по умолчанию русский; выбор — одна строка в «Профиле» и `/language`. Конституция 4.0.0 (MAJOR — переопределение принципа). | ✅ (с правкой) |
| III. Спецификация до кода | spec → plan → tasks; контракты `language.md`, `translation.md`. | ✅ |
| IV. Только дизайн-система | Новая шторка и строка — существующие `ds-*` (`ds-list-item`, `ds-card`, `ds-btn`); без новых стилей. | ✅ |
| V. Бесплатно и без своего сервера | Профиль — по остатку бюджета вызова; запись языка — только при изменении; cron без новых запросов; без внешних сервисов перевода. | ✅ |
| VI. Проверено до выката | Проверка словаря каждого языка, игра на 10 языках в быстрых тестах, Chrome, эталоны для русского без правок. | ✅ |
| VII. Владелец — максимальные права | Права не меняются; `lang.set` — личное действие любого человека. | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/061-i18n-languages/
├── plan.md
├── research.md          # R1–R11
├── data-model.md        # users.tg_lang, users.menu_lang, audit.details_tx, settings.bot_profile
├── quickstart.md
├── contracts/
│   ├── language.md      # правило, точки входа, API, бот, кнопка меню, профиль, журнал, приложение
│   ├── translation.md   # формат и правила словаря языка, глоссарий-ориентир
│   └── glossary/<язык>.md   # термины переводчиков
└── tasks.md
```

### Source Code (repository root)

```text
src/i18n/<язык>/         # en, es, pt, fr, de, zh, it, tr, id, pl — словари (как ru)
src/i18n/index.js        # LANGUAGES, telegramLanguage, langOf(user, telegram), foldWord, bootTexts() всех языков
src/i18n/languages.js    # LANGUAGE_NAMES — названия языков на самих языках
src/language.js          # syncLanguage, setLanguage, languagesView, кнопка меню, команды чата
src/bot-profile.js       # PROFILE_TARGETS, вызовы, версия, profileFrom, sendProfile
src/context.js           # openContext(env, id, { telegramLang }), ctx.telegramLang, отметка профиля
src/api.js, src/bot.js   # lang.set, /language, кнопки lang:, syncLanguage в точках входа, foldWord в confirmed
src/index.js, src/setup.js  # профиль после ответа; /setup — профиль в бюджете; BOOT всех языков в странице
src/db.js, src/outbox.js # createUserStmt(tg_lang), details_tx, getAudit на языке смотрящего, язык получателя
src/participant.js       # me: lang_choice, lang_auto, languages
src/app/02-core.js.txt   # BOOT, telegramLanguage, foldWord
src/app/03-home.js.txt   # «🌐 Язык» в «Профиле», openLangSheet
src/app/08-sheet-chat.js.txt  # typedSheet — foldWord
migrations/0022_languages.sql
tests/support/i18n-lang-check.mjs, tests/i18n-languages.test.mjs, tests/i18n-languages.ui.mjs
```

**Structure Decision**: прежняя структура Worker и частей приложения; два новых модуля сервера по областям
(`language.js`, `bot-profile.js`) — со своими словарями областей `language`, `botProfile` не нужны (тексты — в `bot.*`,
`api.*`, `setup.*`, `app.home.*`).

## Complexity Tracking

Нарушений нет.

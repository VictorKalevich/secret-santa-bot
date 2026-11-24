# Implementation Plan: «Комната» вместо «компании» в текстах для людей

**Branch**: `059-room-wording` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/059-room-wording/spec.md`

## Summary

Только тексты, как в 013. Во всех строках, которые видит человек (сообщения бота, отказы API, мини-приложение, подписи
журнала, `/setup` и описание бота), «компания» заменяется на «комната» в той же форме (оба слова женского рода —
согласование не меняется; падежи — research R1, полный список «было → стало» — `contracts/texts.md`). Значок кнопки
создания 🏢 → 🚪 (R2). Где «компания» значит «круг людей», текст переписан без слова (R3). Проверка слов
`tests/wording.test.mjs` не пропускает «компани…» в текстах для людей (комментарии и `new Error(…)` не в счёт, R4);
правило «слово видят только …» теста `app-companies` — по слову «комната» (R5). Эталон отказов — точечно, список в
заголовке теста (R6). README и цитаты `docs/api.md` — в новых словах (R7). Имена действий и полей API, коды журнала,
`callback_data`, база — прежние.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей

**Storage**: D1 — без изменений (миграций нет, версия схемы 20)

**Testing**: `node:test` — `tests/wording.test.mjs` (новое правило), `tests/app-companies.test.mjs` (слово «комната»),
эталон `tests/fixtures/api-refusals.json` (тексты по списку), ожидания текстов в `companies-manage`, `open-bot`,
`companies` и др.; e2e и `tests/screenshots.mjs` — новые подписи кнопок

**Target Platform**: Cloudflare Workers + Telegram Bot API + Telegram Mini App

**Project Type**: веб-сервис (Worker) + мини-приложение (`src/app/`)

**Performance Goals**: без изменений (≤ 10 мс CPU, ≤ 50 запросов; число запросов сценариев прежнее)

**Constraints**: поведение не меняется (FR-5905); имена в коде, API, журнале и базе — прежние; дизайн-система — только
тексты, классы не меняются; длина текстов почти прежняя («комнат…» на 1 букву короче «компани…»), лимиты Telegram
(4096, `CONFIRM_MAX` = 250) не задеты

**Scale/Scope**: ≈ 60 строк текстов в 9 файлах `src/` (`api.js`, `bot.js`, `companies.js`, `format.js`, `setup.js`,
части `03-home`, `04-companies`, `06-admin`, `07-vault-audit`), эталон отказов (53 ответа), ожидания в тестах, README,
`docs/api.md`, `CLAUDE.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Меняются только слова; ни в один текст не добавляются имена, письма, пары или названия чужих комнат. Правило личных названий (051/052) не меняется. | ✅ |
| II. Проще некуда для участника | «Комната» — домашнее слово вместо делового «компания»; подписи той же длины. | ✅ |
| III. Спецификация до кода | spec → plan → tasks; правила замены — research R1–R3, список текстов — `contracts/texts.md`. | ✅ |
| IV. Только дизайн-система | Классы и разметка не меняются; значок 🚪 — текст кнопки того же компонента. | ✅ |
| V. Бесплатно и без своего сервера | Без новых запросов и сервисов; миграций нет. | ✅ |
| VI. Проверено до выката | Правило слов в `npm test` (с «от противного»), эталон отказов по списку; e2e и Chrome-проверки с новыми подписями. | ✅ |
| VII. Владелец — максимальные права | Права не меняются. | ✅ |

Поправка Конституции не нужна: внутренний термин документов разработки («компания») Конституцией не регулируется,
правила и роли прежние (как в 013).

**Post-design re-check**: правила R1–R7 касаются только текстов и проверок; поведение, данные и ответы (кроме слова) —
прежние. ✅

## Project Structure

### Documentation (this feature)

```text
specs/059-room-wording/
├── spec.md
├── plan.md              # этот файл
├── research.md          # R1–R7: падежи, значок, «круг людей», проверка слов, правило 051, эталон, документы
├── contracts/
│   └── texts.md         # все тексты «было → стало»
├── quickstart.md        # проверка в Chrome и на iPhone
└── tasks.md             # /speckit-tasks
```

Данных не меняется — `data-model.md` нет (как у 013).

### Source Code (repository root)

```text
src/
├── api.js               # «Удалить комнату может только …», «Выбери комнату.»
├── bot.js               # меню без событий, ссылка владельца у владельца бота
├── companies.js         # отказы, «Комната N», сообщения о передаче и удалении
├── format.js            # COMPANY_NOT_FOUND = «Комната не найдена.»
├── setup.js             # краткое описание бота (R3)
└── app/
    ├── 03-home.js.txt   # плашка гостя, 👑 владельца бота
    ├── 04-companies.js.txt  # экран «Комнаты» и шторки
    ├── 06-admin.js.txt  # «тех же людей на следующий год» (R3)
    └── 07-vault-audit.js.txt  # записи журнала бота

tests/
├── wording.test.mjs     # правило «компани…» (R4), места «владелец бота» — по новым текстам
├── app-companies.test.mjs  # слово «комната» (R5)
├── api-refusals.test.mjs + fixtures/api-refusals.json  # R6
├── companies-manage / open-bot / companies / … .test.mjs  # ожидаемые тексты
├── e2e.test.mjs, screenshots.mjs  # подписи кнопок и экранов
docs/api.md, README.md, CLAUDE.md
```

**Structure Decision**: прежняя структура; файлы не добавляются и не переименовываются (`04-companies.js.txt`,
`companies.js` — внутренние имена).

## Complexity Tracking

Нарушений Конституции нет.

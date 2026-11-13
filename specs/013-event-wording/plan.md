# Implementation Plan: Терминология «событие» и подписи

**Branch**: `013-event-wording` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-event-wording/spec.md`

## Summary

Только тексты. Во всех строках, которые видит человек (сообщения и кнопки бота, ошибки API, мини-приложение, `/setup`,
подписи журнала), «эвент» заменяется по правилам research R1: название отдельно — слово убирается, иначе — «событие» в
нужной форме и роде. Одиннадцать подписей приложения — в форме из FR-1305, плюсы с кнопок убраны. Новый автотест
`tests/wording.test.mjs` (в `npm test`) не пропускает «эвент» в строках кода бота и приложения (комментарии не в счёт).
Ожидаемые тексты в e2e и скриншотах обновлены, README — в новых словах.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей

**Storage**: D1 — без изменений (миграций нет)

**Testing**: `node:test` — новый `tests/wording.test.mjs`; e2e (обновлённые ожидания текстов); скриншоты

**Target Platform**: Cloudflare Workers + Telegram Bot API + Telegram Mini App

**Project Type**: веб-сервис (Worker) + мини-приложение (`src/app.html`)

**Performance Goals**: без изменений (≤ 10 мс CPU, ≤ 50 запросов)

**Constraints**: поведение не меняется (FR-1307); `callback_data`, ссылки, поля API, имена в коде и базе — прежние;
дизайн-система — только тексты, классы не меняются

**Scale/Scope**: ≈ 190 строк в 11 файлах `src/`, README, ожидания в `tests/e2e.test.mjs` и `tests/screenshots.mjs`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Меняются только слова; ни в один текст не добавляются имена подопечных, письма или пары. | ✅ |
| II. Проще некуда для участника | Одно понятное слово «событие» вместо заимствования; короткие подписи кнопок. | ✅ |
| III. Спецификация до кода | spec → plan → tasks; правила замены — research R1, перечень подписей — `contracts/texts.md`. | ✅ |
| IV. Только дизайн-система | Классы и разметка не меняются; кнопки без «＋» — тот же компонент. | ✅ |
| V. Бесплатно и без своего сервера | Без новых запросов и сервисов. | ✅ |
| VI. Проверено до выката | Новый автотест терминологии в `npm test`; e2e и скриншоты с новыми текстами. | ✅ |
| VII. Владелец — максимальные права | Права не меняются. | ✅ |

Поправка Конституции не нужна: внутренний термин документов разработки («эвент») не регулируется Конституцией, правила
не меняются.

**Post-design re-check**: правила R1 касаются только формы слов; поведение и данные — без изменений. ✅

## Project Structure

### Documentation (this feature)

```text
specs/013-event-wording/
├── plan.md              # этот файл
├── research.md          # R1 правила замены, R2 автотест, R3 охват (что не меняем)
├── quickstart.md        # как проверить
├── contracts/texts.md   # подписи приложения и образцы сообщений бота (было → стало)
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

Модели данных нет (`data-model.md` не нужен): хранимые данные не меняются.

### Source Code (repository root)

```text
src/
├── api.js, bot.js, chat.js, cron.js, events.js, index.js,
│   membership.js, pairs.js, roles.js, support.js   # тексты сообщений, кнопок и ошибок
└── app.html                                         # подписи, подсказки, подтверждения, подписи журнала
tests/
├── wording.test.mjs     # новый: «эвент» в строках кода — ошибка
├── e2e.test.mjs         # ожидаемые тексты
└── screenshots.mjs      # селекторы по подписям («🎄 Создать», «Полный сброс»…)
README.md, CLAUDE.md
```

**Structure Decision**: правки по месту, без вынесения текстов в словарь — проект маленький, строки рядом с логикой
читаются проще (как и раньше).

## Complexity Tracking

Нарушений Конституции нет.

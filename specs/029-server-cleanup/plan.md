# Implementation Plan: Порядок на сервере — параметры события, бот, отказы

**Branch**: `029-server-cleanup` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md) | **Статус**: выполнен (2026-11-16)

**Input**: Feature specification from `specs/029-server-cleanup/spec.md`.

## Summary

Три правки сервера без изменения поведения. (1) Новый модуль без импортов `src/event-params.js`: `EVENT_PARAMS` (вид,
предел, умолчание, «из образца», «только до жеребьёвки», «своё действие») и `EVENT_SERVICE` (служебные колонки); из них
строятся `createEvent`, `resetEvent`, `saveEventSettings` (`src/events.js`) и `EVENT_FIELDS` (`src/db.js`). (2)
`src/bot.js`: `handleUpdate` и `handleCallback` — диспетчеры, у каждой команды и вида кнопки свой обработчик с общим
объектом чата; три запроса уходят в модули (`menuEvents` — `src/participant.js`, `threadById` — `src/support.js`);
условия ответа в обращение — `replyBlocks` в `src/support.js`. (3) Общий помощник отказа `no` в новом `src/result.js`
вместо литералов и локальных `no`/`fail`. Новый тест `tests/server-shape.test.mjs`; прежние тесты — без правок ожиданий.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; Node 22.15+ для тестов

**Primary Dependencies**: нет новых

**Storage**: D1 — схема не меняется (версия 11); тест читает колонки `events` из схемы миграций (`PRAGMA table_info`)

**Testing**: `npm test` (+ `tests/server-shape.test.mjs`), `npm run test:e2e` перед слиянием

**Target Platform**: Cloudflare Workers (бесплатный тариф)

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: запросов к базе на действие — не больше прежнего, к Telegram — столько же
(`tests/queries.test.mjs`); CPU — тот же порядок (списки из 14 строк)

**Constraints**: ответы и тексты побайтно прежние (`tests/fixtures/api-refusals.json` не пересоздаётся); порядок
обращений к базе в обработчиках бота — прежний (тесты одновременных вызовов опираются на «все читают, затем пишут»);
`src/app/` и `docs/api.md` не меняются

**Scale/Scope**: 2 новых модуля (`event-params.js`, `result.js`), правки в `events.js`, `db.js`, `bot.js`,
`support.js`, `participant.js` и замена литералов в 9 модулях; 1 новый тестовый файл

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы не меняются; списки показа (`publicEvent`, `admin.state`) остаются явными — новый параметр не попадает людям сам собой. Правило обращений то же: кто видит и кто пишет. | ✅ |
| II. Проще некуда для участника | Участник ничего не замечает. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `029-server-cleanup`; `CLAUDE.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно и без своего сервера | Число запросов не растёт (`tests/queries.test.mjs`); новых зависимостей нет. | ✅ |
| VI. Проверено до выката | Новые проверки (у каждой — «от противного»), `npm test` и `npm run test:e2e` до слияния. | ✅ |
| VII. Владелец — максимальные права | Права не меняются (тест прав и e2e «владелец ⊇ админ» — без правок). | ✅ |

Нарушений нет; Complexity Tracking не нужен.

## Decisions (research)

- **R1. Где живёт список параметров.** Новый модуль без импортов `src/event-params.js`: его берут `db.js` (перечень
  полей записи) и `events.js` (создание, сброс, сохранение). В `db.js` — нельзя: виды и пределы — предметные правила; в
  `events.js` — нельзя: `db.js` импортировал бы модуль логики. Отвергнуто: класть в `status.js` (он про состояние
  события, а не про параметры).
- **R2. Строка списка.** `{ kind: 'text' | 'date' | 'flag', max?, default, template?, beforeDraw?, own? }`. Порядок строк
  = порядок проверок `saveEventSettings`: `draw_auto_date` раньше `families_on` — при двух причинах отказа текст
  прежний. `own: true` (`ring`, `avoid_previous`) — общим сохранением не меняется (как сейчас: поле в теле запроса
  игнорируется). `beforeDraw` — текст отказа; поле пишется, только если значение меняется (как сейчас).
- **R3. Служебные колонки.** `EVENT_SERVICE = { fixed: [...], state: {...} }`: `fixed` — `id`, `title`, `created_at`,
  `created_by` (сброс не трогает; `title` меняется сохранением со своей проверкой); `state` — имя → значение при сбросе
  (`status`, `finished_at`, `draw_done`, `draw_at`, `draw_token`, `revealed`, `registration_open`, `last_daily`;
  `invite_code` — новым кодом, в `state` помечен `undefined` и задаётся сбросом). `EVENT_FIELDS` = `title` + ключи
  `state` + ключи `EVENT_PARAMS` — тот же набор из 24 полей.
- **R4. Создание по образцу.** Вставляются `title`, `created_at`, `created_by`, `invite_code` и параметры с
  `template: true` — значения образца (`?? умолчание`, как прежний `t.rejoin ?? 1`) или умолчания; остальные параметры —
  умолчания схемы. Тест сверяет умолчания списка со схемой, поэтому результат тот же, что у прежнего явного списка.
- **R5. Обработчики бота.** Общий объект чата `c`: `{ env, db, ctx, from, text, settings, user, reply, sendMenu,
  writeLetter, replyJoin }`; `c.user` обновляется там же, где раньше `user = ctx.me = …`. Порядок обращений к базе в
  каждом пути — прежний. Кнопки: массив `[шаблон, обработчик]`, первый подошедший; общие `refuse` (сбрасывает режим
  ответа) и `REPLY_HINT`.
- **R6. Правило обращения.** `replyBlocks(t, me, ev)` → `{ closed, own, other, readOnly }` (без обращений к базе).
  `adminThread.writable` = ни одного; `sendFromAdmin` и бот берут признаки в своём прежнем порядке со своими прежними
  текстами. Отвергнуто: одна функция «первая причина» — изменила бы текст отказа в углу «чужое обращение в событии
  только для чтения».
- **R7. Помощник отказа.** `src/result.js`: `no(error, status)` → `{ ok: false, error }`, а со `status` —
  `{ ok: false, error, status }`. В `support.js` прежний `fail` всегда добавлял `status: 400`; `api.js` (`out` →
  `refuse(error, status)`) и бот читают только `error` и `status ?? 400` — ответ тот же. Отказы с добавочными полями —
  `{ ...no(текст), pairChanged: true }`. HTTP-ответы `index.js` и `api.js` (`fail`, `Refusal`) — не отказы модулей, не
  трогаются.
- **R8. Тесты.** `tests/server-shape.test.mjs`: (а) колонки `events` схемы ↔ `EVENT_PARAMS` ∪ `EVENT_SERVICE` в обе
  стороны, умолчания ↔ схема, каждый параметр есть в `settings` ответа `admin.state`; (б) сброс → умолчания, образец →
  копируемые; (в) в `src/bot.js` нет `.prepare(`; (г) в `src/*.js`, кроме `result.js`, `index.js`, `api.js`, нет
  `ok: false`; (д) самая длинная функция `bot.js` ≤ 60 строк. У статических правил — «от противного» на подставном
  тексте.

## Project Structure

### Documentation (this feature)

```text
specs/029-server-cleanup/
├── spec.md
├── plan.md              # решения — раздел «Decisions» (отдельного research.md нет)
├── tasks.md
└── checklists/requirements.md
```

`data-model.md`, `contracts/`, `quickstart.md` не нужны: схема, API и порядок выката не меняются.

### Source Code (repository root)

```text
src/
├── event-params.js   # новый: EVENT_PARAMS, EVENT_SERVICE, eventDefaults, templateValues
├── result.js         # новый: no(error, status)
├── events.js         # createEvent, resetEvent, saveEventSettings — из списка
├── db.js             # EVENT_FIELDS — из списка
├── bot.js            # диспетчеры и обработчики; без SQL
├── support.js        # threadById, replyBlocks
├── participant.js    # menuEvents
└── chat.js, constraints.js, membership.js, pairs.js, panel.js, roles.js, vault.js   # no(…)
tests/
└── server-shape.test.mjs   # новый; в скрипт test
```

**Structure Decision**: прежняя структура; два маленьких модуля без импортов.

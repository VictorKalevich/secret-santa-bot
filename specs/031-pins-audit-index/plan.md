# Implementation Plan: Честный отказ при одновременных закреплениях, журнал ответов в обращения, индекс непрочитанных

**Branch**: `031-pins-audit-index` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-pins-audit-index/spec.md`; три пункта «Решено: не делаем» из
`docs/todo.md`, которые владелец 2026-11-16 решил сделать (главное — стабильность и сохранность данных).

## Summary

Три правки по месту (research R1–R5). Закрепление пары (`changeFixed`) получает условие пакета «закрепление возможно»
(по каждой стороне: пара уже есть или Санта и подопечный свободны; при кольцевой — без встречной), оператор исхода
`SELECT` и чтение пар в том же пакете: проигравший спор получает отказ обычной проверки (`fixedRefusal`), взаимная пара —
целиком или никак. Ответ организатора (`sendFromAdmin`) пишет `support.reply` под условием своей вставки. Миграция
`0008_unread_index.sql` — два индекса `messages (santa, read_at)` и `messages (ward, read_at)`, версия схемы не
поднимается (код от индексов не зависит). Число запросов, схема данных и остальные ответы — прежние.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; Node 24 (минимум 22.15) для тестов

**Primary Dependencies**: нет новых

**Storage**: D1 — новая миграция `0008` только с индексами (`CREATE INDEX IF NOT EXISTS`), версия схемы остаётся 11,
данные не меняются; `REGISTRY` не меняется (новых таблиц и колонок нет)

**Testing**: `npm test` (правки `atomic`, `behavior`; новый `migrations`; `api-doc` по документу), `npm run test:e2e`
(журнал обращений, миграции через Wrangler)

**Target Platform**: Cloudflare Workers (бесплатный тариф) + мини-приложение Telegram

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: число запросов на вызов — прежнее (`tests/queries.test.mjs`): новые операторы — в тех же пакетах;
«мои события» — поиск по индексам вместо просмотра таблицы сообщений

**Constraints**: тайна (журнал без пар и текстов; закреплённые пары — только владельцу), одно действие — один результат
(`atomic`), слова (013), дизайн-система (в приложении — одна строка подписи журнала), откат кода безопасен для базы

**Scale/Scope**: `src/constraints.js` (`changeFixed`, `fixedRefusal`), `src/support.js` (`sendFromAdmin`),
`src/app/06-vault-audit.js.txt` (подпись), `migrations/0008_unread_index.sql`; тесты; `docs/api.md`, `docs/todo.md`,
`CLAUDE.md`, README

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Отказ проигравшему — тот же текст, что у обычной проверки, и только владельцу (`admin.fixed.*` — 403 админу). `support.reply` — без текста ответа, подробности как у `support.take` (имя автора обращения, которое админы и так видят в списке). Индексы данных не раскрывают. | ✅ |
| II. Проще некуда для участника | Для участника ничего не меняется; приложение открывается с теми же числами непрочитанных. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `031-pins-audit-index`; `docs/api.md`, README, `CLAUDE.md`, `docs/todo.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | В приложении — одна строка в словаре подписей журнала, новых элементов нет. | ✅ |
| V. Бесплатно и без своего сервера | Число запросов к базе и Telegram прежнее; подсчёт непрочитанных дешевле. | ✅ |
| VI. Проверено до выката | Тесты до правки (падают на одновременных закреплениях и `support.reply`), `npm test`, e2e с настоящими миграциями, проверка, что миграция не меняет данные. | ✅ |
| VII. Владелец — максимальные права | Права не меняются; владелец получает честный ответ вместо ложного «успеха». | ✅ |

Нарушений нет; Complexity Tracking не нужен. Отступление от рабочего правила `CLAUDE.md` «новая схема → новая версия»
(не принцип Конституции) обосновано в research R5 и записывается в `CLAUDE.md` и README.

## Project Structure

### Documentation (this feature)

```text
specs/031-pins-audit-index/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

`data-model.md` и `contracts/` не нужны: таблиц и колонок не добавляется (только два индекса — research R4); контракт
API, бота и журнала — `docs/api.md` (`admin.fixed.add`, `admin.support.send`, коды журнала).

### Source Code (repository root)

```text
migrations/0008_unread_index.sql   # новый: два индекса messages, версию схемы не меняет
src/constraints.js                 # changeFixed: условие FREE, оператор исхода, чтение пар в пакете; fixedRefusal
src/support.js                     # sendFromAdmin: support.reply под условием своей вставки
src/app/06-vault-audit.js.txt      # AUDIT_LABELS: 'support.reply'
tests/atomic.test.mjs              # 023-блок: ответы [200, 400], встречные при кольцевой, взаимная против одиночной;
                                   # два админа отвечают в ничьё
tests/behavior.test.mjs            # support.reply: взятое, ничьё, бот, отказы; FIXED_CHANGED
tests/migrations.test.mjs          # новый: 0008 — только индексы, данные те же, план запроса, версия схемы
tests/e2e.test.mjs                 # support.reply в журнале обращений
package.json                       # migrations.test.mjs в npm test
docs/api.md, docs/todo.md, CLAUDE.md, README.md
```

**Structure Decision**: правки по месту; помощник `atomic` (020) — без изменений: оператор исхода `claim` уже
понимает `SELECT`, вернувший строку (как `INSERT … RETURNING`).

## Post-design Constitution Check

Схема данных, права, тексты людям (кроме нового отказа `FIXED_CHANGED` владельцу) и число запросов прежние; добавлены
условие записи закреплённых пар, одна запись журнала на ответ организатора и два индекса — все принципы выполнены.

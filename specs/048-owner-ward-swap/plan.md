# Implementation Plan: 048. Обмен подопечных после жеребьёвки (владелец)

**Branch**: `048-owner-ward-swap` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

Владелец (и только он) меняет подопечных у двух участников жеребьёвки, не видя пар. Сервер: два действия по образцу
`admin.draw.check` / `admin.draw` — `admin.draw.swap.check` (можно ли и какие правила нарушает, коды и тексты без имён,
версия пар) и `admin.draw.swap` (обмен при той же версии пар и согласии на каждое нарушенное правило). Пары переписываются
готовым `applyPairsChange` (`src/pairs.js`) в пакете `atomic` с условием версии пар, «не раскрыта, идёт» и снимком
правил жеребьёвки. Приложение: секция `adminSwap(p)` перед служебным просмотром и шторка `openSwapSheet` — список
участников с флажками, предупреждение с новым компонентом дизайн-системы «Подробнее» (`ds-details`) и галочкой.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей; Wrangler 4 для dev/deploy

**Storage**: Cloudflare D1 (SQLite); схема не меняется (версия 16), миграций нет

**Testing**: `node:test` (Node 22.15+, «мир» `tests/support/world.mjs`), e2e `wrangler dev` + имитация Telegram, Chrome —
`tests/screenshots.mjs`

**Target Platform**: Telegram Mini App (iOS WebKit, Android, десктоп), Worker на бесплатном тарифе

**Project Type**: веб-сервис (Worker) + мини-приложение без сборщика

**Performance Goals**: проверка и обмен — один пакет чтений и один пакет записи; ≤ 50 внешних запросов, ≤ 10 мс CPU при 200
участниках (вычисление — две связки, без поиска)

**Constraints**: тайна (принцип I): ни пар, ни имён в ответах и журнале; дизайн-система (IV); «одно действие — один результат»
(`atomic`, версия пар)

**Scale/Scope**: группа до сотен человек; 2 новых действия API (66 → 68, `admin.*` 46 → 48), 1 код журнала, 1 компонент
дизайн-системы, 1 секция панели и 1 шторка

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы обоих действий — коды и тексты правил без имён, `possible`, версия; пар нет. Журнал `draw.swap` — «пар изменено: 2», без имён. Сообщения — только Сантам А и Б, без имени подопечного. Действия — только владельцу: подсказки о парах выбранных двоих (отказ «сам себе», пункты «Подробнее») получает только он, на владельца ограничения «чтобы админ не вычислил» не распространяются. Ход подарка в предупреждение не входит (по отметке «получил» владелец вычислил бы Санту). | ✅ |
| II. Проще некуда для участника | Участнику — одно сообщение «новый подопечный» с кнопкой в приложение; всё по-русски. | ✅ |
| III. Спецификация до кода | spec → plan → tasks → implement в ветке `048-owner-ward-swap`; `docs/api.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | Новый компонент `ds-details` (раскрывающийся блок): `components.css` → `preview.html` → README дизайн-системы; список — `ds-card--flush` + `ds-list-item` + `ds-check`, предупреждение — `ds-notice--error`. | ✅ |
| V. Бесплатно и без сервера | Один пакет чтений, один пакет записи (≤ 8 операторов на пару + сообщения + журнал), сообщения через `outbox`; тест числа запросов. | ✅ |
| VI. Проверено до выката | Быстрые тесты нового файла `swap`, атомарность, права, эталон отказов, `docs/api.md`; e2e «владелец ⊇ админ» — 48 действий; Chrome — `checkSwap`. | ✅ |
| VII. Владелец — максимальные права | Действия только владельца (`role: OWNER`), админу 403 — как вписывание и принудительная отмена (012). | ✅ |

Нарушений нет — Complexity Tracking пуст. Повторная проверка после проектирования — без изменений (контракт не добавил
ни пар, ни имён в ответы).

## Project Structure

### Documentation (this feature)

```text
specs/048-owner-ward-swap/
├── spec.md
├── plan.md              # этот файл
├── research.md          # решения R1–R8
├── contracts/
│   └── draw-swap.md     # API, сообщения, журнал, интерфейс шторки, компонент ds-details
├── quickstart.md        # проверка: тесты, Chrome, iPhone
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

`data-model.md` не нужен: схема и `REGISTRY` не меняются, обмен переписывает строки `pairs` и удаляет `messages` двух пар
тем же путём, что вписывание и удаление участника.

### Source Code (repository root)

```text
src/
├── pairs.js                 # swapRules (чистая), checkSwap, swapWards; applyPairsChange — текст сообщения параметром
├── api.js                   # строки ACTIONS: admin.draw.swap.check, admin.draw.swap (OWNER, event, finished: CLOSED)
└── app/
    ├── 05-admin.js.txt      # секция adminSwap(p) перед adminVault в renderAdmin
    └── 06-vault-audit.js.txt # шторка openSwapSheet, подпись журнала 'draw.swap'
design-system/
├── components.css           # ds-details, ds-details__summary
├── preview.html             # пример «Подробнее» в плашке
└── README.md                # строка компонента, версия 1.8.0
docs/api.md                  # 2 раздела, 2 строки сводной таблицы, код журнала, 66 → 68
tests/
├── swap.test.mjs            # новый: правила, отказы, данные, сообщения, журнал, тайна ответов, запросы, склейка
├── atomic.test.mjs          # обмен ×2 в одну миллисекунду, обмен ↔ вписывание, повтор после успеха
├── rights.test.mjs, api-table.test.mjs, api-doc.test.mjs, e2e.test.mjs  # 46 → 48, 66 → 68, списки владельца
├── api-refusals.test.mjs, support/refusals-scenario.mjs, fixtures/api-refusals.json  # NEW_ACTIONS_048, ключи «048 …»
└── screenshots.mjs          # checkSwap в Chrome
README.md, CLAUDE.md, package.json (swap.test.mjs в скрипте test)
```

**Structure Decision**: логика обмена — в `src/pairs.js` рядом с вписыванием и удалением (общие `pairsVersion`,
`applyPairsChange`, `previousPairs`); API — строки таблицы `ACTIONS`; интерфейс — секция панели в `05-admin` и шторка в
`06-vault-audit` (инструменты владельца рядом со служебным просмотром).

## Complexity Tracking

Нарушений Конституции нет.

# Implementation Plan: Стабильные проверки — быстрая жеребьёвка и надёжная имитация Telegram

**Branch**: `015-test-stability` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-test-stability/spec.md`

## Summary

(1) Поиск жеребьёвки в `src/draw.js` ускоряется без изменения результата: `range` — простой цикл вместо
`Array.from` с функцией (по профилю — треть времени), списки кандидатов в `findMatching` — циклами, запреты в
`pairRules` — `Map<кто, Set<кому>>` вместо строк «кто:кому» (ещё ~17%). Порядок вызовов генератора случайных чисел
прежний — пары те же. (2) `tests/mock-telegram.mjs` отвечает с `connection: close`, чтобы workerd не отправлял запрос
в соединение, закрытое Node по таймауту keep-alive.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей; Wrangler 4

**Storage**: Cloudflare D1 — без изменений (схема 11)

**Testing**: `node:test` (`tests/draw.test.mjs`), e2e — `wrangler dev` + `tests/mock-telegram.mjs`

**Target Platform**: Cloudflare Workers (бесплатный тариф); разработка — Windows-ноутбук (в т.ч. от батареи)

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: худший случай проверки жеребьёвки < 10 мс CPU с запасом (первый вызов ≤ 8 мс на ноутбуке от
батареи)

**Constraints**: результат жеребьёвки и замен не меняется (FR-1501); пороги тестов не ослабляются (FR-1504)

**Scale/Scope**: два файла кода/обвязки, документация

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы API и тексты не меняются. | ✅ |
| II. Проще некуда для участника | Участник ничего нового не видит. | ✅ |
| III. Спецификация до кода | spec → plan → tasks в этой ветке; контракты не меняются. | ✅ |
| IV. Только дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно и без своего сервера | Лимит CPU соблюдается с запасом (было впритык и выше на медленной машине). | ✅ |
| VI. Проверено до выката | Проверки становятся стабильными, пороги прежние; равенство результатов проверено сравнением старой и новой версии. | ✅ |
| VII. Владелец — максимальные права | Права не меняются. | ✅ |

Поправка Конституции не нужна.

## Research

- **R1 — где время.** Профиль (`node --cpu-prof`) худшего случая: `range` (`Array.from({ length: n }, fn)`) — 33%,
  `pairRules` (сборка `Set` из строк и шаблонная строка на каждую проверку) — ~17%, остальное — сборка мусора и сам
  поиск. **Решение**: простые циклы и `Map<кто, Set<кому>>`. **Отклонено**: уменьшить `DEFAULT_BUDGET` (чаще
  «попробуй ещё раз», меняется поведение); переписать `findCycle` без промежуточных массивов (сложнее сохранить тот же
  порядок случайных чисел, а запаса и так хватает).
- **R2 — равенство результатов.** Те же массивы в том же порядке, `shuffle` вызывается в том же порядке → та же
  последовательность случайных чисел. Строковые ключи давали бы совпадение `1` и `"1"`, но id везде числа из D1, а
  остальной код уже сравнивает их строго (`a !== b`, `wardOf.get(a) === b`, `set.has`).
- **R3 — «Network connection lost».** Node `http.Server` закрывает простаивающее keep-alive соединение через 5 с
  (`keepAliveTimeout`), а между запросами e2e бывают паузы дольше (SQL через `wrangler d1 execute`). workerd изредка
  отправляет запрос в соединение, закрытие которого ещё не заметил. **Решение**: `connection: close` в ответах имитации —
  соединения не переиспользуются, гонки нет. **Отклонено**: `keepAliveTimeout = 0` (соединения висят бесконечно, но
  гонка при закрытии остаётся возможной); повтор отправки сразу в `src/outbox.js` (в проде повтор уже есть — очередь и
  cron; менять код бота ради тестовой обвязки незачем); дёргать cron в тесте (прячет причину).

## Project Structure

### Documentation (this feature)

```text
specs/015-test-stability/
├── spec.md
├── plan.md        # этот файл (research — раздел выше)
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/draw.js               # range, findMatching, pairRules — быстрее, результат тот же
tests/mock-telegram.mjs   # connection: close
CLAUDE.md                 # строка 015
```

**Structure Decision**: существующая структура; новых модулей, данных и контрактов нет (data-model и contracts не нужны).

## Complexity Tracking

Нет нарушений.

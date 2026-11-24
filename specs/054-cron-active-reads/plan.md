# План 054: минутная проверка читает только идущие события

**Branch**: `054-cron-active-reads` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Замер на базе второго бота (`EXPLAIN QUERY PLAN` в D1) и аудит планов всех запросов cron на тестовой базе показали три
полных просмотра в каждую минуту: пары (`notifyWishlistChanges` — `SCAN p`), события (`dailyStep` — `SELECT * FROM
events WHERE status = 'active'`) и компании (`dailyStep` — `companies: true` в пакете). Решение:

1. Миграция `0017_active_events_index.sql`: частичный индекс `events_active ON events (id) WHERE status = 'active'` —
   только индекс, строки и версия схемы не меняются (как `0008`), код от него не зависит.
2. `notifyWishlistChanges`: `FROM events e CROSS JOIN pairs p … CROSS JOIN members w … JOIN users s … WHERE e.status =
   'active' AND …` — порядок соединения закреплён: идущие события (по индексу) → их пары (индекс `(event_id, ward)`) →
   участник-подопечный (ключ) → Санта (ключ). До жеребьёвки пар нет — участники не перебираются. Условия и результат —
   прежние.
3. `dailyStep`: `ctx.read({ events })` без `companies: true` — компании читает `ctx.in()` только когда есть действие.
   В обычную минуту запросов столько же (3), в минуту с действием — на один больше (компании отдельным чтением).

## Technical Context

**Language/Version**: JavaScript ES2022 (Worker), SQL SQLite (D1)
**Storage**: D1 — новая миграция только с индексом
**Testing**: `node:test` на `node:sqlite` («мир»): `tests/cron-reads.test.mjs` (планы всех запросов cron на базе с
историей), `tests/migrations.test.mjs` (0017 — только индекс); прежние тесты уведомлений и расписания; e2e
**Performance Goals**: чтения cron не растут с числом завершённых событий
**Constraints**: ≤ 50 внешних запросов и ≤ 10 мс CPU на вызов; число запросов cron в обычную минуту — 3 (`queries`)

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Запросы читают те же поля, сообщения те же (без имени подопечного и текста). | ✅ |
| II. Проще некуда | Для людей ничего не меняется. | ✅ |
| III. Спецификация до кода | `specs/054-cron-active-reads/`, запись в `CLAUDE.md`. | ✅ |
| IV. Дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно | Цель фичи — меньше чтений D1 на бесплатном тарифе; число запросов на вызов прежнее. | ✅ |
| VI. Проверено до выката | Тест планов cron с «от противного», тест миграции, `npm run test:all`; после выката — план на базе бота. | ✅ |
| VII. Владелец | Права не затронуты. | ✅ |
| Безопасность и данные | Новых данных нет; миграция не меняет строк. | ✅ |

## Project Structure

```text
migrations/0017_active_events_index.sql   # частичный индекс идущих событий
src/cron.js                               # notifyWishlistChanges, dailyStep
tests/cron-reads.test.mjs                 # новый: планы запросов cron (в скрипт test)
tests/migrations.test.mjs                 # 0017 — только индекс, строки прежние
README.md, CLAUDE.md
```

## Complexity Tracking

Нет отступлений.

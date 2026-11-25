# План 066: одно напоминание о письме

**Branch**: `066-one-letter-reminder` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Summary

`dailyReminder` (`src/cron.js`) возвращает `remindUnfilled`, только когда `daysUntil(deadline) === 2` (было `0…2`).
Из `adminParams` (`src/app/06-admin.js.txt`) убирается `ui.hint(t('app.admin.params.remindersHint'))`, ключ — из 11
словарей. Тесты, где срок письма «сегодня» включал напоминание (`e2e`, `auto-finish`, `cron-marks`), ставят срок через
2 дня; новый случай в `texts-cleanup` проверяет дни 2, 1, 0. Документация — `docs/api.md`, README, `CLAUDE.md`.

## Technical Context

JavaScript ES2022, Worker + мини-приложение, словари 11 языков; тесты `node:test`. Миграций нет, схема 24. Число запросов
cron не меняется (то же условие, другая граница).

## Constitution Check

| Принцип | Итог |
|---|---|
| I. Тайна | Не меняется ✅ |
| II. Проще некуда | Одно напоминание вместо трёх, подсказкой меньше ✅ |
| III. Спецификация до кода | spec/plan/tasks, `docs/api.md` ✅ |
| IV. Дизайн-система | Новых элементов нет ✅ |
| V. Бесплатный тариф | Меньше сообщений ✅ |
| VI. Проверено до выката | `npm test`, e2e, Chrome ✅ |
| VII. Владелец — максимум | Права прежние ✅ |

## Project Structure

`src/cron.js`, `src/app/06-admin.js.txt`, `src/i18n/*/app-admin.js`, `tests/texts-cleanup.test.mjs`,
`tests/e2e.test.mjs`, `tests/auto-finish.test.mjs`, `tests/cron-marks.test.mjs`, `docs/api.md`, `README.md`, `CLAUDE.md`.

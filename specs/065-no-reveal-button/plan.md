# План 065: без кнопки «Раскрыть Сант»

**Branch**: `065-no-reveal-button` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Summary

Из `adminDraw` (`src/app/06-admin.js.txt`) убирается кнопка раскрытия (`app.admin.draw.reveal`, `.revealed`,
`.revealConfirm`, `.revealSent` — из 11 словарей `src/i18n/<язык>/app-admin.js`). `again` в `adminDraw` больше не нужен.
Сервер, API (`admin.reveal` остаётся, в `docs/api.md` — пометка «кнопки нет с 065»), база, cron (автораскрытие
`reveal_auto`) — без изменений. Проверка: правило в `tests/texts-cleanup.test.mjs` — в склейке нет `'admin.reveal'` и
ключей `app.admin.draw.reveal`, «от противного».

## Technical Context

JavaScript ES2022, мини-приложение (части `src/app/`), словари 11 языков; тесты `node:test`; Chrome — `tests/screenshots.mjs`
(кнопку не нажимает: раскрытие — через API). Миграций нет, схема 24.

## Constitution Check

| Принцип | Итог |
|---|---|
| I. Тайна | Не меняется: раскрытие — те же сообщения по расписанию ✅ |
| II. Проще некуда | Одной кнопкой меньше ✅ |
| III. Спецификация до кода | spec/plan/tasks, `docs/api.md` ✅ |
| IV. Дизайн-система | Новых элементов нет ✅ |
| V. Бесплатный тариф | Не меняется ✅ |
| VI. Проверено до выката | `npm test`, e2e, Chrome ✅ |
| VII. Владелец — максимум | Права прежние (`admin.reveal` в API) ✅ |

## Project Structure

`src/app/06-admin.js.txt`, `src/i18n/*/app-admin.js`, `tests/texts-cleanup.test.mjs`, `docs/api.md`, `README.md`,
`CLAUDE.md`.

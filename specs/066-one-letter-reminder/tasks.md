# Задачи 066: одно напоминание о письме

## Фаза 1: История 1 — без подсказки (P1)

- [x] T001 [US1] Убрать `ui.hint(t('app.admin.params.remindersHint'))` из `src/app/06-admin.js.txt` и ключ из `src/i18n/*/app-admin.js` (11 языков)

## Фаза 2: История 2 — одно напоминание за 2 дня (P1)

- [x] T002 [US2] `dailyReminder` в `src/cron.js`: только `daysUntil(deadline) === 2`, комментарий
- [x] T003 [US2] Тест в `tests/texts-cleanup.test.mjs`: срок через 2 дня — одно напоминание (повтор в тот же день — нет), через 1 и 0 дней — нет; в склейке нет `remindersHint`
- [x] T004 [US2] Тесты со сроком «сегодня» ради напоминания — срок через 2 дня: `tests/e2e.test.mjs`, `tests/auto-finish.test.mjs`, `tests/cron-marks.test.mjs`

## Фаза 3: Документация и проверка

- [x] T005 [P] `docs/api.md` (`remind.unfilled`, ежедневные действия), `README.md`, `CLAUDE.md` (строка 066)
- [x] T006 `npm test`, `npm run test:e2e`, `npm run screenshots`; отметить задачи

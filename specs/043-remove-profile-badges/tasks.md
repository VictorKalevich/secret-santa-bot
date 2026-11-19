# Задачи удаления отдельного значка

## US1. Упростить профиль

- [x] T001 [US1] Удалить кнопку, экран выбора и подстановку значка в имена в `src/app/02-core.js.txt`, `src/app/03-home.js.txt`, `src/app/04-event.js.txt`, `src/app/05-admin.js.txt` и `src/app/07-sheet-chat.js.txt`.
- [x] T002 [US1] Проверить редактирование имени с эмодзи в `tests/names.test.mjs` и `tests/screenshots.mjs`.

## US2. Очистить старые значки

- [x] T003 [US2] Удалить действие, поля и набор из `src/api.js`, `src/participant.js`, `src/looks.js`, `src/panel.js`, `src/db.js` и `src/support.js`.
- [x] T004 [US2] Очистить значения `users.emoji` в `migrations/0014_remove_profile_badges.sql`. Проверить старую базу, сохранение имён и повторное применение в `tests/migrations.test.mjs`.
- [x] T005 [US2] Обновить тесты контракта в `tests/looks.test.mjs`, `tests/roster.test.mjs`, `tests/mask.test.mjs`, `tests/e2e.test.mjs`, `tests/api-refusals.test.mjs`, `tests/support/refusals-scenario.mjs` и `tests/fixtures/api-refusals.json`.

## Документация и проверка

- [x] T006 Обновить `README.md`, `docs/api.md`, `CLAUDE.md`, `design-system/README.md`, `design-system/preview.html` и контракты `specs/038-emoji-postcards`, `specs/039-names-emoji-keyboard`, `specs/040-santa-mask`.
- [x] T007 Прогнать `npm test` и `npm run test:e2e`, проверить профиль в `tests/screenshots.mjs`.

## Порядок

T001 и T003 независимы до совместных проверок T002 и T005. T004 можно проверить вместе с T003. T007 завершает обе истории.

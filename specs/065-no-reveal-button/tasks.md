# Задачи 065: без кнопки «Раскрыть Сант»

## Фаза 1: История 1 — кнопки раскрытия нет (P1)

- [ ] T001 [US1] Убрать кнопку раскрытия и `again` из `adminDraw` в `src/app/06-admin.js.txt`
- [ ] T002 [US1] Удалить `app.admin.draw.reveal`, `.revealed`, `.revealConfirm`, `.revealSent` из `src/i18n/*/app-admin.js` (11 языков)
- [ ] T003 [US1] Правило в `tests/texts-cleanup.test.mjs`: в склейке нет `'admin.reveal'` и `app.admin.draw.reveal`; «от противного»

## Фаза 2: Документация и проверка

- [ ] T004 [P] `docs/api.md`: у `admin.reveal` — «кнопки в приложении нет с 065, раскрытие — по расписанию»
- [ ] T005 [P] README (`README.md`): без кнопки «🎅 Раскрыть Сант», раскрытие — галочкой в «Параметрах»
- [ ] T006 [P] `CLAUDE.md`: строка 065
- [ ] T007 `npm test`, `npm run test:e2e`, `npm run screenshots`; отметить задачи

# Quickstart: проверка шага 3 (018)

Все команды — из корня проекта, PowerShell или Git Bash. Node 22.15+.

## 1. Быстрые тесты

```powershell
npm test
```

Ожидается: 0 упавших; `todo` — 2 (обе с пометкой «шаг 5»); тестов больше, чем 113 (новый файл
`tests/data-registry.test.mjs`).

Отдельно:

```powershell
node --test tests/atomic.test.mjs          # 19 проверок «один результат» + 2 todo «шаг 5»
node --test tests/data-registry.test.mjs   # тест схемы, «от противного», остатки после пяти действий
```

## 2. Проверка «от противного» вручную

Тест схемы уже содержит три проверки на изменённой базе. Дополнительно можно убедиться руками: временно добавить в
конец `migrations/0007_fixed_pairs.sql` строку `ALTER TABLE settings ADD COLUMN event_id INTEGER;`, запустить
`node --test tests/data-registry.test.mjs` — тест схемы падает и называет `settings.event_id`. Вернуть файл
(`git checkout migrations/0007_fixed_pairs.sql`).

## 3. Число запросов

```powershell
node tests/bench/queries.mjs
```

Ожидается: таблица совпадает с `docs/refactoring/baseline.md`, раздел 3 (ни одно число к базе не выросло, к Telegram —
те же). То же проверяет `tests/queries.test.mjs` в `npm test`.

## 4. Поиск каскадов вне построителей

```bash
grep -nE "DELETE FROM|UPDATE( OR IGNORE)? [a-z_]+ SET (user_id|santa|ward|giver|receiver|sender|assignee|tg_id)" src/*.js
```

Ожидается — только:

| Где | Что | Почему не каскад |
|---|---|---|
| `src/db.js` — построители `eventDataDeleteStmts`, `memberDataDeleteStmts`, `personTransferStmts` и `REGISTRY` (`transferBefore`/`transferAfter`) | каскады | это и есть один список |
| `src/db.js` — `clearRemovedStmt` | снять отметку «удалён» одного человека | действие «вернулся / разрешить вернуться» |
| `src/api.js` — `admin.exclusion.del`, `admin.fixed.del` | одно исключение, одна закреплённая пара | действие над одной строкой |
| `src/membership.js` — `saveFamily`, `deleteFamily` | состав одной семьи | действие над семьёй |
| `src/outbox.js` — `flushOutbox` | отправленные сообщения | очередь |
| `src/pairs.js` — `runDraw`, `applyPairsChange`, `cancelDraw`, `forceCancelDraw` | пары и переписка пар | жеребьёвка и перестройка пар |
| `src/support.js` — `take`, `pass`, `returnThreadsStmts` | ответственный за обращение | смена ответственного, не перенос человека |

В `src/events.js`, `src/roles.js` и в ветке `admin.participate` `src/api.js` операторов `DELETE FROM` нет.

## 5. Перед слиянием

```powershell
npm run test:e2e
```

Ожидается: 8 сценариев зелёные без правок, в журнале нет `budget exceeded`.

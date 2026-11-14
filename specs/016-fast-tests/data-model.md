# Data Model: Быстрые тесты всего Worker

Данных приложения и схемы базы фича не меняет (схема 11, `migrations/` без изменений). Ниже — сущности тестовой
обвязки.

## Мир (`tests/support/world.mjs`)

Весь Worker в одном процессе.

| Поле | Что это |
|---|---|
| `DB` | подмена D1 (`createD1`) с применёнными `migrations/*.sql` по порядку имён; `DB.sqlite` — сама база |
| `calls` | все вызовы Bot API: `{ method, params }`, включая отвергнутые |
| `last` | запросы последнего вызова: `{ db, tg, sql[] }` (вместе с отправкой очереди из `waitUntil`) |
| `env` | `BOT_TOKEN`, `ADMIN_SECRET` из `auth.mjs`, `TG_API = http://tg<N>.test`, `TIMEZONE_OFFSET_HOURS=3`, `REMINDER_HOUR`, `NOTIFY_DELAY_MINUTES` |

Правила:

- Вызов Worker завершается, когда закончены и ответ, и всё, что ушло в `ctx.waitUntil` (тестам не нужен `sleep`).
- Миры независимы: своя база, свой хост Telegram. Общее на процесс — кэш «схема готова» (`src/db.js:16`) и перехватчик
  `fetch`.

## Подмена D1 (`tests/support/d1-sqlite.mjs`)

| Поле | Что это |
|---|---|
| `prepare(sql)` → оператор `{ sql, args, bind, first, all, run, raw }` | как D1 |
| `batch(list)` | одна транзакция; результат по оператору |
| `exec(sql)` | как D1 |
| `stats` | `{ queries, statements, log[] }` — запросы считаются как в `metered` (`batch` = 1) |
| `gate` | функция-барьер перед первой записью (ставит `together`) |
| `sqlite` | `node:sqlite` база для прямого SQL в тестах |

## Правила поддельного Telegram (`tests/support/telegram-rules.mjs`)

`telegramReply(method, params, nextMessageId) → { status, body }`:

| Условие | Ответ |
|---|---|
| `sendMessage` в `BLOCKED_CHAT` (555000555) | 403 `Forbidden: bot was blocked by the user` |
| видимая длина текста (без тегов HTML, сущность = 1) > 4096 | 400 `Bad Request: message is too long` |
| одиночная половинка суррогатной пары в тексте или кнопках | 400 `Bad Request: strings must be encoded in UTF-8` |
| `sendMessage` иначе | 200, `result.message_id` — следующий номер |
| `getMe` | 200, `{ id: 1, is_bot: true, first_name: 'Santa', username: 'test_santa_bot' }` |
| остальное | 200, `result: true` |

## Эталон жеребьёвки (`tests/fixtures/draw-golden.json`)

```json
{ "note": "…", "count": 400, "cases": ["<строка случая 1>", "…"] }
```

- Случай `k` — вход из `drawCases()` (`tests/support/draw-cases.mjs`), строка — `JSON.stringify` результатов
  `planDraw`, `findAssignment` (правила и функция), `removeFromAssignment`, `insertIntoAssignment` (без ранга и с
  рангом); `Map`/`Set` — массивы в порядке обхода.
- Создаётся один раз `node tests/fixtures/make-draw-golden.mjs`; в шагах плана рефакторинга не пересоздаётся.

## Базовые числа запросов (`tests/queries.test.mjs`)

Таблица «действие → `[запросов к базе, запросов к Telegram]`» — 46 строк сценария (`baseline.md`, раздел 3).
Проверка: база — не больше, Telegram — ровно; набор действий — тот же.

## Состав проверок

| Файл | Проверок | Пометки |
|---|---|---|
| `d1-sqlite.test.mjs` | свойства из `prototypes/README.md` («Что учтено в подмене D1») | — |
| `world.test.mjs` | `/app`, правила Telegram, ожидание `waitUntil` | — |
| `secrecy.test.mjs` | перестановка пар, замена писем/адресов, `fixed`, 403 не-участникам, тексты сообщений, обращения | — |
| `rights.test.mjs` | 46 действий × 3 роли, вход без регистрации/подписи/POST | — |
| `atomic.test.mjs` | 16 «один результат» + 5 дефектов | 5 × `todo: 'шаг 3'`/`'шаг 5'` |
| `queries.test.mjs` | 46 действий сценария, жеребьёвка 40 человек | — |
| `draw-golden.test.mjs` | 400 случаев | — |

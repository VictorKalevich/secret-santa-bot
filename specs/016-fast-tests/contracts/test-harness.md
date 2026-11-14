# Контракт: тестовая обвязка «мир»

API приложения эта фича не меняет. Контракт ниже — интерфейс, на который опираются тесты следующих шагов плана
рефакторинга (017–022): менять его можно только вместе со всеми тестами, которые им пользуются.

## `tests/support/world.mjs`

```js
import { startWorld, restoreFetch } from './support/world.mjs';
const w = await startWorld({ notifyDelay = 0, reminderHour = 0 } = {});
after(restoreFetch);
```

Совместим с `tests/harness.mjs` (сценарии e2e переносятся почти дословно):

| Метод | Результат |
|---|---|
| `api(user, action, body = {}, raw = false)` | `raw=false`: данные ответа, при `ok: false` — исключение `"<action>: <ошибка>"`; `raw=true`: `{ status, data, text }` |
| `setup(key = ADMIN_SECRET)` | `{ status, headers, html, adminCode, inviteCode }`; запоминает секрет webhook |
| `update(payload, secret?)` | статус ответа `/tg` |
| `say(user, text)`, `press(user, data)` | сообщение / нажатие кнопки боту |
| `cron()` | один вызов `scheduled` |
| `page()` | `{ status, headers, text }` ответа `GET /app` |
| `request(path, init)` | любой запрос к Worker → `Response` |
| `sql(command)` | прямой SQL (несколько операторов) |
| `query(command, ...params)` | строки результата |
| `texts(user)`, `lastText(user)` | тексты `sendMessage` этому человеку (в том числе отвергнутые Telegram) |
| `calls` | все вызовы Bot API |
| `last` | `{ db, tg, sql }` последнего вызова |
| `log()` | строки `console.log` Worker с начала мира |
| `together(thunks, { writeOrder, sameMoment })` | одновременные вызовы: все читают, затем пишут в порядке `writeOrder`; `sameMoment` — одно `Date.now()` на всех |
| `beforeWrite(marker, inject)` | выполнить `inject()` перед первым `batch`, где есть оператор с подстрокой `marker` |

`restoreFetch()` — вернуть исходный `globalThis.fetch` (вызывать в `after` каждого файла).

## `tests/support/d1-sqlite.mjs`

`createD1(sqlite?) → D1` — см. `data-model.md`. Отличие от настоящей D1, о котором надо помнить: всё выполняется
синхронно внутри `await`, поэтому без `together`/`beforeWrite` вызовы из `Promise.all` идут по очереди.

## `tests/support/auth.mjs`

`TOKEN`, `ADMIN_SECRET`, `initData(user, { authDate, token })` — подпись как у Telegram. Без `child_process`;
`tests/harness.mjs` реэкспортирует их.

## `tests/support/telegram-rules.mjs`

`BLOCKED_CHAT`, `visibleLength(params)`, `brokenUtf16(params)`, `telegramReply(method, params, nextMessageId)` — общие
для `tests/mock-telegram.mjs` и «мира».

## Команды

| Команда | Что делает |
|---|---|
| `npm test` | все быстрые тесты (юнит, дизайн-система, слова, жеребьёвка, эталон, мир, тайна, права, атомарность, запросы) |
| `npm run test:e2e` | сквозной тест на `wrangler dev` |
| `npm run bench:draw [-- <путь к draw.js>]` | замер жеребьёвки 50–200 человек, холодный и прогретый |
| `node tests/bench/queries.mjs [sql]` | таблица запросов на действие (и их SQL) |
| `node tests/fixtures/make-draw-golden.mjs` | создать эталон жеребьёвки (только в шаге 1) |

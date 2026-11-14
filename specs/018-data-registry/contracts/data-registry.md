# Контракт: список данных и построители (`src/db.js`, 018)

Внутренний контракт модулей Worker. Внешние интерфейсы (API мини-приложения, бот, `/setup`, тексты, журнал) не
меняются — их контракты прежние (`specs/005-events-history/contracts/events.md` и дополнения 006–014).

## `REGISTRY`

```js
export const REGISTRY = {
  <таблица>: {
    event?: '<колонка события>',               // 'event_id'; у events — 'id'
    via?: { column: '<колонка>', parent: '<таблица>' },   // строки принадлежат событию/человеку через родителя (его id)
    people?: { <колонка>: MEMBER | ACTOR | ACTOR_MOVED | RECIPIENT | SELF | NOT_PERSON },
    anchor?: 'event' | 'member' | 'person',      // строка-опора действия: оператор с ней — последний
    onEventDelete?: 'delete' | 'keep',           // обязательно у таблиц с event (кроме якоря events)
    onLeave?: 'delete' | 'keep' | 'rebuild',     // обязательно у таблиц с event и колонкой MEMBER (кроме якоря members)
    onTransfer?: 'update' | 'dedupe' | 'merge',  // обязательно у таблиц с колонкой MEMBER или ACTOR_MOVED
    noSelf?: true,                               // строка «сам себе» недопустима — удалить после переноса
    personal?: [['<значение>', '<время изменения>'], …],   // members: что стирает сброс и что берёт слияние
    transferBefore?: [{ sql, args: (from, to) => [...] }], // свои правила таблицы до переноса колонок
    transferAfter?:  [{ sql, args: (from, to) => [...] }], // …и после; sql оканчивается условием WHERE
    note?: '<пояснение>',
  },
};
```

- В списке все таблицы схемы, порядок ключей — порядок операторов; дочерняя таблица (`via`) стоит раньше родителя.
- Константы ролей экспортируются: `MEMBER`, `ACTOR`, `ACTOR_MOVED`, `RECIPIENT`, `SELF`, `NOT_PERSON`.
- Колонки `ACTOR` и `RECIPIENT` построители не трогают ни в одном действии.

## Построители

Общее для всех: возвращают массив подготовленных операторов (не выполняют их); последние аргументы — условие `guard`
(SQL-выражение) и его параметры `...args`, как у `enqueueIfStmt`; каждый оператор получает `AND (guard)`, параметры
условия — в конце `bind`. По умолчанию `guard = '1'`. Якорь действия — последний оператор массива.

### `eventDataDeleteStmts(db, eventId, { keepMember = 0, keepEvent = false } = {}, guard = '1', ...args)`

Удаляет данные события: строки всех таблиц с колонкой события и `onEventDelete: 'delete'` и их дочерних (`via`).
`keepMember` — участие этого человека остаётся, у него стираются `members.personal` (`''`, `0`). `keepEvent` — строка
события остаётся; иначе `DELETE FROM events WHERE id = ?` — последним оператором.

### `memberDataDeleteStmts(db, eventId, userId, guard = '1', ...args)`

Удаляет данные участника в событии: строки таблиц с колонкой события, колонкой `MEMBER` и `onLeave: 'delete'`, где
любая колонка `MEMBER` равна `userId`, и их дочерние (`via`); последним — `DELETE FROM members WHERE event_id = ? AND
user_id = ? AND (guard)`. Таблицы `onLeave: 'keep'` и `'rebuild'` не трогаются (пары перестраивает
`applyPairsChange`, отметку «удалён» ставит `markRemovedStmt`).

### `personTransferStmts(db, fromId, toId, { merge = [] } = {}, guard = '1', ...args)`

Переносит человека: для каждой таблицы с колонками `MEMBER`/`ACTOR_MOVED` — `transferBefore`, затем политика
`onTransfer`, затем `transferAfter`. `merge` — решения слияния участий из `mergeMembership`. Последними —
`transferBefore` записи человека (права админа: `MAX` текущих значений) и `DELETE FROM users WHERE tg_id = ?`.

### `mergeMembership(fromRow, toRow)`

Чистая функция: `{ event_id, set }`, где `set` — `members.personal` нового аккаунта, если значение не пусто
(`String(v || '').trim()`), иначе старого — каждое со своим временем изменения.

## Условия, которые используют действия

| Действие | `guard` | Где |
|---|---|---|
| Удаление события | `EXISTS (SELECT 1 FROM events WHERE id = ?)` | `src/events.js` |
| Удаление участника | `<версия пар> AND EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)` | `src/pairs.js` |
| Выход админа | `EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 0)` | `src/api.js` |
| Перенос | `EXISTS (SELECT 1 FROM users WHERE tg_id = ?)` (старый аккаунт) | `src/roles.js` |
| Сброс | `'1'` (захвата нет — решение владельца) | `src/events.js` |

## Что удаляется из `src/db.js`

`supportDeleteStmts` и `supportTransferStmts` — их правила стали частью списка (`support_threads`,
`support_messages`) и построителей.

## Проверка

`tests/data-registry.test.mjs`: тест схемы (`registryGaps`, обе стороны, обязательные политики, три проверки «от
противного») и «после действия не остаётся строк» для пяти действий.

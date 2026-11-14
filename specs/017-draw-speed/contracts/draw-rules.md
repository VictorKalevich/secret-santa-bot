# Контракт: функция правил жеребьёвки (`src/draw.js`)

Внешние интерфейсы (API мини-приложения, бот, `/setup`, cron) не меняются — актуальные контракты прежние
(`CLAUDE.md`, раздел «Фичи»). Здесь — внутренний контракт чистых функций жеребьёвки после 017.

## `pairRules(bans = [], fixed = [])` → `rule`

- `rule(a, b)` → `boolean` — как в 014: закреплённая пара важнее запретов (см. `data-model.md`). Запрет «самому себе»
  `rule` не проверяет — это делает `findAssignment` (и `allowedFn` в заменах).
- `rule.fillMatrix(ids, adj)` → `undefined`. Заполняет все `ids.length²` клеток `adj` (`Uint8Array`, длина `n²`):
  `adj[i * n + j] = ids[i] !== ids[j] && rule(ids[i], ids[j]) ? 1 : 0`. Не вызывает `rng`, не тратит бюджет.
  Предусловие: id в `ids` различны. Люди из `bans`/`fixed`, которых нет в `ids`, допустимы.

## `findAssignment(ids, isAllowed, rng, { ring, budget })`

- Интерфейс и результат прежние: `{ ok: true, pairs, singleCycle }` или `{ ok: false, problems }`.
- Матрица: если у `isAllowed` есть свойство-функция `fillMatrix` — `isAllowed.fillMatrix(ids, adj)`; иначе — перебор
  `ok(ids[i], ids[j])` для всех клеток. Результат обоих путей при том же `rng` одинаков (эталон, `findFnSame`).
- Обёртка `(a, b) => rule(a, b)` теряет `fillMatrix` и работает перебором — медленнее, результат тот же.

## `planDraw(ids, { own, families, history, fixed }, rng, { ring, budget })`

- Без изменений. Передаёт `pairRules(…)` в `findAssignment` напрямую — быстрая часть используется во всех попытках.

## `removeFromAssignment`, `insertIntoAssignment`, `diagnose`, `hasMutual`

- Без изменений: матрицу не строят; используют `rule(a, b)`. `shuffle` в них — та же перестановка с тем же
  порядком вызовов `rng`.

## Неизменные константы

`DEFAULT_BUDGET = 150000`; 30 случайных кругов; до 5 попыток перебора круга (вместе — половина бюджета);
60 паросочетаний без взаимных пар (вторая половина); деление бюджета в `planDraw` (история / без истории /
закреплённые / семьи).

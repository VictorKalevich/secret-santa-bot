# Quickstart: проверка фичи 020

Требования: Node 22.15+ (замеры — на той же машине, от сети), `npm install` выполнен.

## 1. Быстрые тесты

```powershell
npm test
```

Ожидается: 0 упавших, 0 `todo` (было 2 — `шаг 5`). Новое: `tests/claims.test.mjs` (помощник, нет SQL с незакрытой
скобкой), `tests/snapshots.test.mjs` (паритет четырёх снимков, перестановка партнёров, гонка с перестановкой),
`tests/atomic.test.mjs` — +5 проверок «один человек дважды в одну миллисекунду».

Только атомарность и снимки:

```powershell
node --test tests/atomic.test.mjs tests/snapshots.test.mjs tests/claims.test.mjs
```

## 2. «От противного»

- Новые проверки `sameMoment` в `tests/atomic.test.mjs` и гонка с перестановкой исключений падают на коде до
  исправления (проверяется при реализации: тест пишется первым).
- Статическая проверка на коде до фичи находит `THREAD` и `MINE_SENT` в `src/support.js`.

## 3. Запросы

```powershell
node tests/bench/queries.mjs
```

Числа к базе — не больше таблицы `tests/queries.test.mjs` (после 019), к Telegram — те же.

## 4. Жеребьёвка

```powershell
npm run bench:draw
npm run bench:draw
```

Медианы — в пределах разброса двух прогонов «до» (`research.md`, R10). Эталон `tests/fixtures/draw-golden.json` не
пересоздаётся (`tests/draw-golden.test.mjs` зелёный).

## 5. Сквозной тест

```powershell
npm run test:e2e
```

Зелёный без правок; в журнале нет `budget exceeded`.

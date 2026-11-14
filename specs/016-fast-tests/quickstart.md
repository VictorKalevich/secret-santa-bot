# Quickstart: проверка фичи 016

Все команды — из корня проекта, Node 22.15+ (у разработчика 24.21).

## 1. Быстрые тесты

```powershell
Measure-Command { npm test } | Select-Object TotalSeconds
npm test 2>&1 | Select-String -Pattern '# шаг|ℹ (tests|pass|fail|todo)'
```

Ожидается: `fail 0`; `todo 5`, у каждого `# шаг 3` или `# шаг 5`; время ≤ 5 с.

## 2. Код приложения не тронут

```powershell
git diff main --stat -- src
```

Ожидается: пусто.

## 3. Атомарность стабильна

```powershell
1..3 | ForEach-Object { node --test tests/atomic.test.mjs 2>&1 | Select-String 'ℹ (pass|fail|todo)' }
```

Ожидается: три одинаковых результата (`pass 16`, `todo 5`, `fail 0`).

## 4. Тесты ловят поломки (проверка «не пустые», правки не коммитить)

- Добавить в ответ `admin.state` поле с подопечным любого Санты → падает `secrecy.test.mjs`.
- Убрать проверку владельца у `admin.reset.full` → падает `rights.test.mjs`.
- Поменять в `shuffle` (`src/draw.js`) направление обхода → падает `draw-golden.test.mjs` и называет случаи.
- Добавить лишнее чтение в `admin.game` → падает `queries.test.mjs`.

После проверки — `git checkout -- src`.

## 5. Сквозной тест

```powershell
npm run test:e2e
```

Ожидается: зелёный; автотест «владелец может всё, что админ» находит 46 действий.

## 6. Замер жеребьёвки и таблица запросов

```powershell
npm run bench:draw
node tests/bench/queries.mjs
```

Ожидается: числа в пределах `docs/refactoring/baseline.md` (разделы 2 и 3).

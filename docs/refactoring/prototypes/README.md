# Прототипы и замерные скрипты

Вспомогательные файлы к плану рефакторинга (`docs/refactoring-roadmap.md`). Приложение их не использует, в
`npm test` они не входят, в сборку Worker не попадают. Все команды — из корня проекта.

| Файл | Что это | Команда |
|---|---|---|
| `draw-equivalence.mjs` | Сверка двух вариантов `draw.js` на 6000 случайных случаях | см. заголовок файла |
| `draw-speedup.patch` | Проверенная правка `src/draw.js` для шага 2 | `git apply docs/refactoring/prototypes/draw-speedup.patch` |

## Что уже перенесено (шаг 1, фича 016)

| Был прототип | Стал | Команда |
|---|---|---|
| `d1-shim.mjs` | `tests/support/d1-sqlite.mjs` (подмена D1 на `node:sqlite`) | `node --test tests/d1-sqlite.test.mjs` |
| `text-hooks.mjs` | `tests/support/text-hooks.mjs` | — |
| `world.mjs` | `tests/support/world.mjs` («мир»: весь Worker в одном процессе) | — |
| `queries.mjs` | `tests/support/queries-scenario.mjs` + `tests/queries.test.mjs` + `tests/bench/queries.mjs` | `node tests/bench/queries.mjs [sql]` |
| `atomic.mjs` | `tests/atomic.test.mjs` (16 проверок + 5 `todo`; 6 случаев «решение владельца» не перенесены) | `node --test tests/atomic.test.mjs` |
| `bench-draw.mjs`, `bench-draw-cold.mjs`, `draw-scenario.mjs` | `tests/bench/` | `npm run bench:draw [-- <путь к draw.js>]` |

Свойства подмены D1 и «мира» описаны в `specs/016-fast-tests/research.md` (R2–R6) и
`specs/016-fast-tests/contracts/test-harness.md`. Прежние версии файлов — в git, коммит `b4d4c80`.

## Что с ними делать

- **Шаг 2** применяет `draw-speedup.patch` и проверяет его `draw-equivalence.mjs` (и эталоном
  `tests/draw-golden.test.mjs`), после чего оба файла удалить.
- Когда папка опустеет — удалить её целиком.

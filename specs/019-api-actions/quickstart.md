# Quickstart: как проверить шаг 4 (019)

Из корня проекта, Windows / PowerShell. Замеры «до» сняты на `main` (`c8d1cf9`) перед ветвлением — `baseline.md`.

## 1. Эталон отказов (до изменений кода)

```powershell
node tests/fixtures/make-api-refusals.mjs     # один раз, на коде до изменений; пишет tests/fixtures/api-refusals.json
node --test tests/api-refusals.test.mjs       # ответы = эталон (59 действий + неизвестные)
```

Эталон не пересоздаётся: если тест упал — изменилось поведение (стоп, разобраться).

## 2. Быстрые тесты

```powershell
npm test
```

Ожидается: всё зелёное, 2 `todo` (шаг 5). Новые файлы: `tests/api-table.test.mjs` (59 строк, правила строки),
`tests/api-refusals.test.mjs`; паритет пустоты — в `tests/unit.test.mjs`; пакет чтений — в `tests/d1-sqlite.test.mjs`.
`tests/rights.test.mjs` и `tests/secrecy.test.mjs` — без правки ожиданий.

## 3. Запросы на действие

```powershell
node tests/bench/queries.mjs          # таблица; сравнить с baseline.md, раздел 3, и research.md, R10
node tests/bench/queries.mjs sql      # SQL каждого действия: повторов «SELECT key, value FROM settings» и
                                      # «SELECT * FROM users ORDER BY created_at» в одном действии нет
```

Пороги: `admin.state` ≤ 6, `admin.draw.check` ≤ 6, `admin.draw` ≤ 10, `admin.remove` ≤ 12, `admin.insert` ≤ 11,
обращения — на 2 меньше базовых, остальные — не больше; к Telegram — то же.

## 4. Жеребьёвка

```powershell
npm run bench:draw     # дважды; медианы не выше «до» больше разброса (до: 200 человек — 3,69–3,76 мс холодный)
node --test tests/draw-golden.test.mjs
```

## 5. Слои и SQL

```powershell
Select-String -Path src/api.js -Pattern 'db\.prepare|\.prepare\('        # пусто
Select-String -Path src/status.js -Pattern '^import'                     # пусто
```

## 6. Сквозной тест

```powershell
npm run test:e2e       # 8 сценариев; автотест «владелец ⊇ админ» берёт список из ACTIONS; budget exceeded нет
```

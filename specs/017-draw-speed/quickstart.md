# Quickstart: проверка фичи 017

Все команды — из корня проекта, PowerShell или Git Bash. Замеры — от сети, без тяжёлых программ рядом.

## 1. Результат не изменился

```powershell
npm test                                   # эталон жеребьёвки (400 случаев) + тест «fillMatrix = перебор» + всё остальное
node --test tests/draw-golden.test.mjs     # только эталон
git diff main --stat -- src                # меняется только src/draw.js
git diff main -- tests/fixtures            # пусто: эталон не пересоздан
```

Сверка двух вариантов файла на 6000 случаях (до удаления прототипа, задача в `tasks.md`):

```bash
git show b9fe434:src/draw.js > "$TEMP/draw-old.mjs"   # main до 017
node docs/refactoring/prototypes/draw-equivalence.mjs "$TEMP/draw-old.mjs" src/draw.js
# ожидается: «расхождений: 0», код выхода 0
```

Выполнено (T014): 6000 случаев, 0 расхождений. Затем прототип удалён (T016); вернуть его для повторной сверки:
`git checkout 18a9398 -- docs/refactoring/prototypes/draw-equivalence.mjs` (после — удалить снова).

## 2. Быстрее

```powershell
npm run bench:draw          # дважды; сравнить медианы с research.md (R6) и baseline.md (раздел 2)
```

Ожидается: холодная медиана на 200 человек ≤ 4,27 мс (−25% от 5,69); ни одна медиана не выше «до».
Вариант файла без замены `src/`: `npm run bench:draw -- <путь к draw.js>`.

## 3. Проверка перед коммитом стабильна

```bash
for i in $(seq 1 30); do node --test tests/queries.test.mjs > /dev/null 2>&1 || echo "упал: $i"; done
```

Ожидается: ни одной строки «упал».

## 4. Перед слиянием

```powershell
npm run test:e2e            # 8 сценариев зелёные, в журнале нет «budget exceeded»
```

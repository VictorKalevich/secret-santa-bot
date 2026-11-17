# Quickstart: 040 — проверка, выкат, откат

## Локально

```powershell
npm test               # mask, migrations (0011), api-refusals («040 …»), queries, api-doc, design-system, wording …
npm run screenshots    # checkMask, снимки 38-mask-sheet, 38-mask-chat
npm run test:e2e       # wrangler dev сам применяет все миграции
```

Ожидается: всё зелёное; в `test-results/` — шторка «Маска в переписке» с выбранным «🐉 Дракон» и переписка подопечного с
заголовком «Твой Тайный Санта · 🐉 Дракон».

## Выкат (владелец) — сначала миграция, потом код

Новый код требует схему 14: выкат кода до миграции остановит бота до её применения.

```powershell
git checkout main
git pull
npx wrangler deployments list                               # запишите Version ID текущей версии — к ней откат
npx wrangler d1 migrations list secret-santa-db --remote    # покажет 0011_santa_mask.sql
npx wrangler d1 export secret-santa-db --remote --output "$HOME\Documents\secret-santa-backups\backup-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 migrations apply secret-santa-db --remote
npm run deploy
```

Миграция только добавляет колонку `pairs.mask` (пустую у всех пар) и версию схемы.

## Проверка на iPhone

1. Участник с подопечным → событие → «Подопечный» → «🎭 Маска: без маски» → «🐉 Дракон»: кнопка и подсказка — с маской.
2. Его подопечный → «Письмо» → «Переписка с Сантой»: «Твой Санта — в маске «🐉 Дракон».»; шторка переписки —
   «Твой Тайный Санта · 🐉 Дракон».
3. Санта пишет подопечному — у подопечного в чате бота «💬 Твой Тайный Санта «🐉 Дракон» (…) пишет:».
4. Организатор: панель, журнал, «Инфо» — масок нет.

## Откат

```powershell
npx wrangler rollback <Version ID> -m "откат 040"
```

База остаётся со схемой 14 — прежний код с ней работает (требует не ниже 13), новая колонка ему не мешает.

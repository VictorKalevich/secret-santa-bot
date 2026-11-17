# Quickstart: 038 — проверка, выкат, откат

## Локально

```powershell
npm test               # looks, migrations (0010), api-refusals (038), secrecy, queries, design-system, api-doc …
npm run screenshots    # checkLooks, снимки 35-emoji, 36-postcards, 37-ward-postcard (+ тёмные)
npm run test:e2e       # wrangler dev сам применяет все миграции
```

Витрина всех открыток — `design-system/preview.html` в браузере.

## Выкат (владелец) — сначала миграция, потом код

Новый код требует схему 13: выкат кода до миграции остановит бота до её применения.

```powershell
git checkout main
git pull
npx wrangler deployments list                               # запишите Version ID текущей версии — к ней откат
npx wrangler d1 migrations list secret-santa-db --remote    # покажет 0010_looks.sql
npx wrangler d1 export secret-santa-db --remote --output "..\backup-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 migrations apply secret-santa-db --remote
npm run deploy
```

Миграция только добавляет две колонки (пустые у всех) и версию схемы.

## Проверка на iPhone

1. Главный экран → «Профиль» → «😀 Значок у имени» → выбрать значок: он в профиле и в списке на «Инфо».
2. Событие → «Письмо» → «🖼 Открытка: …» → выбрать открытку: редактор на открытке, текст читается в светлой и тёмной теме.
3. Если есть подопечный с открыткой — «Подопечный»: письмо на открытке, значок открывается вместе с именем.

## Откат

```powershell
npx wrangler rollback <Version ID> -m "откат 038"
```

База остаётся со схемой 13 — прежний код с ней работает (требует не ниже 12), новые колонки ему не мешают.

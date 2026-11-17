# Quickstart: 037 — проверка, выкат, откат

## Локально

```powershell
npm test               # roster, migrations (0009), secrecy, server-shape, queries, app-ui …
npm run screenshots    # checkInfoPeople, снимки 34-info-people(-dark).png
npm run test:e2e       # wrangler dev сам применяет все миграции
```

## Выкат (владелец) — сначала миграция, потом код

Новый код требует схему 12: выкат кода до миграции остановит бота до её применения.

```powershell
git checkout main
git pull
npx wrangler deployments list                               # запишите Version ID текущей версии — к ней откат
npx wrangler d1 migrations list secret-santa-db --remote    # покажет 0009_contacts.sql
npx wrangler d1 export secret-santa-db --remote --output "backup-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 migrations apply secret-santa-db --remote
npm run deploy
```

Копию базы — вне папки проекта. Миграция только добавляет колонку (у всех событий — «выключено») и версию схемы.

## Проверка на iPhone

1. Событие, где вы участник → «Инфо»: в «О событии» — «Организаторы», до жеребьёвки — «Автожеребьёвка»; ниже —
   «Участники · N» с прогрессом; своя строка — «(ты)».
2. «Админ» → «Параметры» → «Участники могут писать друг другу» → «Сохранить» → «Инфо»: у людей появились @username;
   нажатие на чужое имя → вопрос → «Да» открывает чат. Выключите обратно, если не нужно.
3. Регистрация открыта → под списком «📨 Пригласить друга» открывает выбор чата (можно отменить).

## Откат

```powershell
npx wrangler rollback <Version ID> -m "откат 037"
```

База остаётся со схемой 12 — прежний код с ней работает (требует не ниже 11); колонка ему не мешает.

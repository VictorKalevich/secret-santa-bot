# Quickstart 064: проверка и выкат

## Локально

```powershell
npm test             # весь Worker, словари 11 языков, дизайн-система
npm run test:e2e     # сквозной сценарий
npm run screenshots  # Chrome: экраны и проверки (test-results/)
```

## До выката (каждый бот)

Миграций нет (`npx wrangler d1 migrations list <db> <env> --remote` — пусто). Посмотреть, что завершится и кого
предупредят при первом ежедневном шаге:

```powershell
npx wrangler d1 execute <db> <env> --remote --command "SELECT id, title, event_date, created_at FROM events WHERE status = 'active' AND event_date != '' AND event_date <= date('now', '+3 hours', '-3 days')"
npx wrangler d1 execute <db> <env> --remote --command "SELECT COUNT(*) AS n FROM events WHERE status = 'active' AND event_date = '' AND created_at <= (strftime('%s','now') - 23*86400) * 1000"
```

## Выкат

«Оба» — сначала второй (`npm run deploy:second`), проверка, потом первый (`npm run deploy`); точка отката — Version ID
из `npx wrangler deployments list <env>`. Откат на 063 — `wrangler rollback`, база не меняется (данные адреса, отметок и
параметров на месте).

## На iPhone

1. ⚙️ «Настройки»: нет «О боте» и подписи под «Уведомлениями».
2. «🎄 Создать событие»: «Напиши название события», подсказка поля «Новый год 2027 — семья».
3. «Письмо»: «🎨 Раскрасить письмо» (после выбора открытки текст тот же), в шторке нет подсказки; нет адреса и «Я
   получил(а) подарок»; под перепиской — «Хочешь что-то уточнить или ответить на вопрос?».
4. «Подопечный»: нет «Подарок готов» и адреса; «Есть вопрос?».
5. «Инфо»: весь список с @username, нажатие ничего не открывает; «Задай вопрос по событию.»; нет «Как это работает».
6. «Управление»: выключить регистрацию — поле ссылки бледное, кнопок нет, включить — вернулись; подсказки и блоки по
   `contracts/texts.md`; нет «Завершить», «Полный сброс», галочек адреса, контактов и автозавершения.

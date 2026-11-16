# Quickstart: 031 — проверка, выкат и откат

## 1. Локальная проверка (разработчик)

```powershell
npm test            # быстрые тесты: atomic (одновременные закрепления, ответы в ничьё), behavior (support.reply),
                    # migrations (0008 не меняет данные, план запроса непрочитанных), api-doc (код support.reply)
npm run test:e2e    # настоящий wrangler dev: миграции 0001–0008 применяет Wrangler, журнал обращений с support.reply
```

Ожидается: всё зелёное; в журнале e2e нет `budget exceeded`.

## 2. Выкат (владелец)

Порядок прежний — README, «Обновление бота». Миграция `0008` только добавляет два индекса: ни одна строка в базе не
меняется, а бот работает и до неё, и после (версия схемы остаётся 11), поэтому ошибка в порядке шагов бота не уронит.

```powershell
git pull
npm install
npx wrangler d1 migrations list secret-santa-db --remote     # должна быть видна 0008_unread_index.sql
npx wrangler d1 export secret-santa-db --remote --output "backup-$(Get-Date -Format yyyy-MM-dd-HHmm).sql"
npx wrangler d1 execute secret-santa-db --remote --command "SELECT (SELECT COUNT(*) FROM messages) AS messages, (SELECT COUNT(*) FROM members) AS members, (SELECT COUNT(*) FROM audit) AS audit"
npx wrangler d1 migrations apply secret-santa-db --remote
npx wrangler d1 execute secret-santa-db --remote --command "SELECT (SELECT COUNT(*) FROM messages) AS messages, (SELECT COUNT(*) FROM members) AS members, (SELECT COUNT(*) FROM audit) AS audit"
npm run deploy
npx wrangler deployments list                                  # записать id новой версии
```

Числа до и после миграции совпадают (пока в боте никто ничего не делает, `audit` тоже не растёт). Копию базы храните у
себя — в ней все пары и письма (README, «Резервная копия»).

## 3. Проверка после выката (владелец, телефон или ПК)

1. Открыть бота → «Открыть приложение»: «Мои события» на месте, точки непрочитанных — как были.
2. В событии с открытым обращением ответить участнику (в приложении или кнопкой «↩️ Ответить» в чате бота) → «Админ» →
   «📜 Журнал действий»: запись «💬 Ответ в обращение» с именем участника, без текста ответа.
3. (Необязательно) закрепление пар работает как раньше: «Закрепить пару» → пара в блоке; повторное закрепление другой
   пары с тем же Сантой — прежний отказ «У «…» уже есть закреплённый подопечный…».

## 4. Откат (если что-то не так)

```powershell
npx wrangler deployments list
npx wrangler rollback <id прежней версии> -m "откат 031"
```

Прежний код с базой после `0008` работает (он требует версию схемы не ниже 11, индексы ему не мешают). Индексы
удалять не нужно. Возвращать базу из копии не нужно: миграция данных не меняла.

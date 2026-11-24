# План 055: чтения API по индексам

**Branch**: `055-api-indexed-reads` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Summary

Аудит планов всех запросов кода (research.md) показал полные просмотры на горячих путях: все компании в первом пакете
каждого вызова, все люди в списке людей компании, все события и владельцы всех компаний на главном экране, обращения,
заявки, семьи и компании по владельцу — без индексов. Решение:

1. Миграция `0018_read_indexes.sql` — только индексы: `companies (owner_id)`, `support_threads (user_id)`, открытые
   взятые обращения `support_threads (assignee) WHERE status = 'open' AND assignee != 0`, `join_requests (event_id,
   user_id)`, `families (company_id)`.
2. Контекст (`src/context.js`, `src/db.js`): первый пакет — компании вызывающего (все — только владельцу бота, условие до
   чтения); `ctx.company(id)` — одна компания по номеру; `ctx.in(id)` берёт её; пакет чтений — `inCompany: id` вместо
   `companies: true`; люди компании — от строк компании.
3. `homeView`: события и владельцы — только свои (владельцу бота — все); счётчики обращений — по индексам.
4. Запасной поиск владельца бота и администраторы компаний владельца бота — от компаний с `owner_id = 0`; передача прав
   владельца бота — компании журнала точным запросом.
5. Создание компании и ссылка владельца компании — запросы, которые берут индексы.
6. Бот: вступление по ссылке и имя после ссылки читают участника и компанию события одним пакетом (`inCompany`).

## Technical Context

**Language/Version**: JavaScript ES2022 (Worker), SQL SQLite (D1)
**Storage**: D1 — новая миграция только с индексами
**Testing**: `node:test` на `node:sqlite`: `tests/api-reads.test.mjs` (планы всех запросов вызовов обычных людей на базе
с чужой историей), `tests/support/plans.mjs` (общий разбор планов, его берёт и `cron-reads`), `tests/migrations.test.mjs`
(0018 — только индексы); прежние тесты без изменения ожиданий, `queries` — не больше базового; e2e
**Performance Goals**: строки, которые читает вызов обычного человека, не растут с числом чужих людей, компаний, событий
**Constraints**: ≤ 50 внешних запросов и ≤ 10 мс CPU на вызов; число запросов на действие — не больше базового

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Запросы читают те же поля или меньше; ответы и сообщения прежние; пар нигде не прибавилось. | ✅ |
| II. Проще некуда | Для людей ничего не меняется. | ✅ |
| III. Спецификация до кода | `specs/055-api-indexed-reads/`, контракт контекста 050 обновлён, строка в `CLAUDE.md`. | ✅ |
| IV. Дизайн-система | Интерфейс не меняется. | ✅ |
| V. Бесплатно | Цель — меньше чтений D1; число запросов на вызов не растёт (`queries`). | ✅ |
| VI. Проверено до выката | Тест планов вызовов с «от противного», тест миграции, `npm run test:all`; после выката — планы на базе бота. | ✅ |
| VII. Владелец | Владелец бота по-прежнему видит все компании и события; права не меняются (`rights`, `companies`, `open-bot`). | ✅ |
| Компании (050–052) | Видимость компаний прежняя: видимая компания — со строкой человека (I3, I5); названия — те же правила. | ✅ |
| Безопасность и данные | Новых данных нет; миграция не меняет строк. | ✅ |

## Project Structure

```text
migrations/0018_read_indexes.sql   # пять индексов
src/db.js                          # companiesQuery(db, userId), companyQuery, companyUsersQuery, myEventsQuery
src/context.js                     # первый пакет, companies(), company(id), in(), read({ inCompany })
src/participant.js                 # homeView: свои события и владельцы
src/companies.js                   # companyOwnersQuery, создание, ссылка владельца компании
src/roles.js                       # resolveOwner, botAdminsQuery, setOwner
src/support.js                     # supportUnreadQuery: часть 3 — по частичному индексу
src/bot.js                         # onInvite, signUp: участник и компания одним пакетом
tests/support/plans.mjs            # новый: разбор планов (tablesOf, fullScans, statementsDuring)
tests/api-reads.test.mjs           # новый: планы вызовов обычных людей (в скрипт test)
tests/cron-reads.test.mjs          # помощники — из plans.mjs
tests/migrations.test.mjs          # 0018 — только индексы, строки прежние
specs/050-company-scope/contracts/company-scope.md, README.md, CLAUDE.md
```

## Complexity Tracking

Нет отступлений.

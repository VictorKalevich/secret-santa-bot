# Data Model: 050. Компании, шаг 1

Схема 16 → 17, миграция `migrations/0015_companies.sql`. Применяется **до** выката кода; прежний код на схеме 17
работает (R14).

## Новые таблицы

### `companies`

| Колонка | Тип | Смысл |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | компания; №1 — «Основная» |
| `name` | TEXT NOT NULL DEFAULT '' | название владельца бота; людям компании не отдаётся |
| `owner_id` | INTEGER NOT NULL DEFAULT 0 | назначенный владелец компании; 0 — компанию ведёт владелец бота (в 050 всегда 0) |
| `owner_code` | TEXT NOT NULL DEFAULT '' | одноразовый код ссылки владельца компании (051); в 050 не используется; уникальный индекс `companies_owner_code (owner_code) WHERE owner_code != ''` |
| `created_by` | INTEGER NOT NULL DEFAULT 0 | кто создал (0 — миграция) |
| `created_at` | INTEGER NOT NULL DEFAULT 0 | мс |

### `company_members`

| Колонка | Тип | Смысл |
|---|---|---|
| `company_id` | INTEGER NOT NULL | компания |
| `user_id` | INTEGER NOT NULL | человек (`users.tg_id`) |
| `is_admin` | INTEGER NOT NULL DEFAULT 0 | администратор этой компании (у владельца компании — тоже 1) |
| `label` | TEXT NOT NULL DEFAULT '' | своё название компании, видно только этому человеку (051); в 050 не используется |
| `joined_at` | INTEGER NOT NULL DEFAULT 0 | мс |

`PRIMARY KEY (company_id, user_id)`, индекс `company_members_user (user_id)`.

## Изменения прежних таблиц

| Таблица | Изменение |
|---|---|
| `events` | `company_id INTEGER NOT NULL DEFAULT 1`; индекс `events_company (company_id)` |
| `families` | `company_id INTEGER NOT NULL DEFAULT 1` |
| `family_members` | пересборка: `company_id INTEGER NOT NULL DEFAULT 1`, `user_id`, `family_id`; `PRIMARY KEY (company_id, user_id)`; индекс `family_members_family (family_id)` — прежний |
| `audit` | `company_id INTEGER NOT NULL DEFAULT 1`; индекс `audit_company (company_id, event_id, id)` |
| `users` | без изменений схемы; `is_admin` — теперь производный признак (R4) |
| `settings` | `schema = 17` |

## Перенос данных (в той же миграции)

1. `INSERT INTO companies (id, name, created_at) VALUES (1, 'Основная', <сейчас, мс>)`.
2. `INSERT INTO company_members (company_id, user_id, is_admin, joined_at) SELECT 1, tg_id, is_admin, created_at FROM users`
   — все строки `users`, включая не закончивших регистрацию.
3. События, семьи, журнал получают `company_id = 1` умолчанием колонки.
4. `family_members`: новая таблица, `INSERT … SELECT 1, user_id, family_id`, удаление старой, переименование, индекс.

Пустая база (свежая установка): компания №1 создаётся без людей; первый владелец бота получает в ней строку
администратора при переходе по ссылке владельца (`setOwner`).

## `REGISTRY` (`src/db.js`) — 19 таблиц

Новый ключ описания: `company: '<колонка компании>'` (у `companies` — `'id'`). Тест схемы считает колонку компании
описанной, как колонку события.

| Таблица | Компания | Колонки человека | Перенос человека |
|---|---|---|---|
| `companies` | `id` | `owner_id` ACTOR, `created_by` ACTOR | `update` |
| `company_members` | `company_id` | `user_id` MEMBER | до переноса: права нового аккаунта = `MAX` своих и старого в той же компании; затем `dedupe` (у нового уже есть строка — остаётся его, с его `label`) |
| `events` | `company_id` | прежние | прежний |
| `families` | `company_id` | прежние | прежний |
| `family_members` | `company_id` (и через `family_id`) | `user_id` MEMBER | `dedupe` — теперь в пределах компании: в каждой компании у нового остаётся его семья |
| `audit` | `company_id` | прежние | прежний |

Удаление события, сброс, удаление участника — без изменений: `companies` и `company_members` событию не принадлежат
(`onEventDelete` у них нет), `onLeave` у `company_members` нет (человек остаётся человеком компании). `users`:
прежний `transferBefore` (`is_admin = MAX`) остаётся — он поддерживает общий признак.

## Инварианты

| № | Инвариант | Кто поддерживает |
|---|---|---|
| I1 | у каждого события, семьи и строки семьи `company_id` — существующая компания; у строки семьи он равен компании семьи | создание события и семьи |
| I2 | у владельца бота есть строка `is_admin = 1` в каждой компании с `owner_id = 0` | `setOwner`, сверка |
| I3 | назначенный владелец компании имеет в ней строку `is_admin = 1` | 051 |
| I4 | `users.is_admin = 1` ⇔ есть строка `company_members.is_admin = 1` или человек — владелец бота | `adminFlagStmt`, перенос |
| I5 | каждый участник события (`members`) — человек компании события | `joinCompanyStmt` рядом с `addMemberStmt`, вход по ссылке, сверка |
| I6 | члены семьи — люди компании семьи | `saveFamily` |

Проверка инвариантов — функция `invariants(w)` в `tests/support/companies.mjs` (список нарушений, пустой — всё верно);
вызывается в конце сценариев `queries`, `companies`, `atomic`.

## Сверка (`tools/companies-reconcile.sql`)

Идемпотентна; выполняется после выката и после возврата с прежней версии кода.

1. I5: `INSERT OR IGNORE INTO company_members (company_id, user_id, is_admin, joined_at) SELECT e.company_id, m.user_id,
   0, m.joined_at FROM members m JOIN events e ON e.id = m.event_id`; так же — для авторов заявок (`join_requests`) и
   людей с ожиданием имени по ссылке события.
2. I2: строка `is_admin = 1` владельцу бота в компаниях с `owner_id = 0` (вставка или обновление).
3. Только при одной компании в базе: `company_members.is_admin` этой компании := `users.is_admin` того же человека.
4. I4: пересчёт `users.is_admin` по строкам компаний и владельцу бота.

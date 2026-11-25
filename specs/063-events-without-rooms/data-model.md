# 063. Модель данных

## Схема 24 — миграция `0024_events_without_rooms.sql` (до выката кода)

| Что | Тип | Смысл |
|---|---|---|
| `events.owner_id` | `INTEGER NOT NULL DEFAULT 0` | владелец события; 0 — владелец бота (только старые данные бота без владельца) |
| `users.can_create` | `INTEGER NOT NULL DEFAULT 0` | закрытый бот: разрешение создавать события |
| `event_admins (event_id, user_id, created_at)` | ключ `(event_id, user_id)` | организаторы события, владелец — тоже (E1) |
| `event_creations (event_id, user_id, created_at)` | ключ `event_id` | факт создания события (лимит, R5) |

Индексы: `event_admins_user (user_id)`, `event_creations_user (user_id, created_at)`, `events_owner (owner_id,
created_at)`. Журнал бота (`event_id = 0`) читается по прежнему индексу `audit_event (event_id, id)` (0003) — своего не нужно.

Заполнение (порядок важен — организаторы до владельца не зависят):

1. `events.owner_id` = `companies.owner_id` компании события, если не 0; иначе `settings.owner_id`; иначе 0.
2. `event_admins` = для каждого события — администраторы его комнаты (`company_members.is_admin = 1`) и его владелец
   (`owner_id != 0`), `INSERT OR IGNORE`, `created_at` — время вступления в комнату / создания события.
3. `event_creations` = `SELECT id, created_by, created_at FROM events WHERE created_by != 0` (`INSERT OR IGNORE`).
4. `users.can_create = 1` — у администраторов комнат и назначенных владельцев комнат.
5. `settings.schema = 24`.

Таблицы и колонки комнат (`companies`, `company_members`, `events.company_id`, `audit.company_id`, `families`,
`family_members`) остаются ради отката; новый код их не пишет (кроме `company_id = 0` в новых строках `events` и
`audit`) и не читает (кроме `audit.company_id` прежних записей — нет: журнал бота — по `event_id = 0`).

## Инварианты

- **E1.** Если `events.owner_id != 0`, строка `event_admins (event.id, owner_id)` есть.
- **E2.** `users.is_admin = 1` ⇔ есть строка `event_admins` с этим человеком или он владелец бота (`settings.owner_id`).
- **E3.** У каждого события, созданного после миграции, есть строка `event_creations`; строки не удаляются.
- **E4.** Новые строки `events` и `audit` — с `company_id = 0`.

Тесты `event-owners`, `event-create`, `bot-owner`, `rights`, `atomic` проверяют E1–E4 после своих сценариев (`invariants`,
`tests/support/events.mjs`; как в 050).

## REGISTRY

- `events.people` — `{ created_by: ACTOR, owner_id: ACTOR }` (перенос переносит владение).
- `event_admins` — `{ event: 'event_id', people: { user_id: MEMBER }, onEventDelete: 'delete', onReset: 'keep',
  onLeave: 'keep', onTransfer: 'dedupe' }` — уход из участия права не снимает (их снимает владелец).
- `event_creations` — `{ event: 'event_id', people: { user_id: ACTOR }, onEventDelete: 'keep', onTransfer: 'update' }`.
- `users.transferBefore` — ещё `can_create = MAX(...)`.
- `companies`, `company_members` — без использования кодом; `onCompanyDelete` и `companyDataDeleteStmts` убираются,
  ключ `company` у таблиц остаётся описанием колонки (тест схемы).

## Роли (вычисляются)

| Роль в событии | Условие |
|---|---|
| владелец | `ev.owner_id = me` (или `owner_id = 0` и я владелец бота) |
| организатор | строка `event_admins` (владелец — тоже) |
| гость | владелец бота без строки `event_admins` и без участия |
| участник | строка `members` |

Права: владелец бота ⊇ владелец события ⊇ организатор события. «Может создавать события»: владелец бота; открытый бот —
любой зарегистрированный; закрытый — `can_create = 1`. Лимит (кроме владельца бота): `COUNT(event_creations за 365
суток) < 10`.

## Переходы

- **Создание события** (пакет): вставка события (условия «может» и лимит) → строка `event_admins` создателя → факт
  создания → участие (если «Я тоже участвую») → журнал события и журнал бота `event.create` → `adminFlagStmt`.
- **Назначение** (по прежнему состоянию «нет строки»): сообщения, журнал → вставка строки (захват) → `adminFlagStmt`.
- **Снятие** (по прежнему состоянию «строка есть», не владелец): обращения снова ничьи, сообщения, журнал → удаление
  строки (захват) → `adminFlagStmt`.
- **Передача владения** (по прежнему владельцу): строка `event_admins` нового → сообщения, журнал `event.owner` →
  `owner_id` (захват) → `adminFlagStmt` нового (прежний остаётся организатором).
- **Удаление события**: прежний пакет + журнал бота `event.delete` (вместо общего журнала комнаты) + `adminFlagStmt`
  организаторов (после удаления строк `event_admins`).
- **Разрешение на создание** (`bot.creator.set`, по прежнему значению): сообщение, журнал бота → `can_create` (захват).

# Data Model: 012

## Миграция `migrations/0006_support.sql` (схема 9 → 10)

### support_threads — обращение участника к организаторам

| Поле | Тип | Смысл |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| event_id | INTEGER NOT NULL | эвент |
| user_id | INTEGER NOT NULL | автор-участник (`users.tg_id`) |
| status | TEXT NOT NULL DEFAULT 'open' | `open` / `closed` |
| assignee | INTEGER NOT NULL DEFAULT 0 | ответственный админ; 0 — ничьё |
| created_at | INTEGER NOT NULL | мс |
| taken_at | INTEGER NOT NULL DEFAULT 0 | когда взято/передано последний раз (метка для условий batch) |
| closed_at | INTEGER NOT NULL DEFAULT 0 | |
| closed_by | INTEGER NOT NULL DEFAULT 0 | кто закрыл (участник, админ или владелец) |

Индексы: `UNIQUE (event_id, user_id) WHERE status = 'open'` — одно открытое обращение участника в эвенте;
`(event_id, id)` — список эвента.

Переходы: `open, assignee=0` —взять/ответить→ `open, assignee=A` —передать→ `open, assignee=B`;
`open` —закрыть→ `closed` (необратимо; следующее сообщение участника создаёт новое обращение).
Снятие прав A: `open, assignee=A` → `open, assignee=0`.

### support_messages — сообщения обращения

| Поле | Тип | Смысл |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| thread_id | INTEGER NOT NULL | обращение |
| sender | INTEGER NOT NULL | кто написал (`users.tg_id`) |
| from_admin | INTEGER NOT NULL | 1 — организатор, 0 — участник |
| text | TEXT NOT NULL | ≤ `MAX_CHARS` (4000) |
| created_at | INTEGER NOT NULL | мс |
| read_at | INTEGER NOT NULL DEFAULT 0 | прочитано другой стороной (участником / ответственным) |

Индекс `(thread_id, id)`.

`settings.schema = '10'`, `REQUIRED_SCHEMA = 10`.

## Непрочитанные

- Участник: сообщения `from_admin = 1 AND read_at = 0` в его обращениях эвента.
- Админ: ничьи открытые обращения эвента (кроме своих как автора) + сообщения `from_admin = 0 AND read_at = 0` в
  открытых обращениях, где он ответственный.

## Ранг связки при вписывании (без хранения)

| Ранг | Условие для Санты А пары «А → Б» |
|---|---|
| 0 | `seen_text IS NULL`, в `messages` нет строк пары А–Б, `gift_ready = 0`, `gift_received = 0` |
| 1 | не ранг 0, `gift_ready = 0`, `gift_received = 0` |
| — | иначе — не выбирается |

## Журнал (audit), без текстов

| action | details |
|---|---|
| `member.insert` | имя вписанного (как раньше) |
| `draw.cancel.force` | `пар удалено: N` |
| `support.open` | имя участника (actor — участник) |
| `support.take` | имя участника |
| `support.pass` | `Участник → Админ` |
| `support.close` | имя участника (actor — кто закрыл) |
| `support.return` | `Участник` (actor — бот: права ответственного сняты) |

## Удаление/перенос

| Событие | Обращения |
|---|---|
| удаление участника из эвента, «Я участвую» выкл. | обращения участника в эвенте и их сообщения удаляются |
| сброс эвента, удаление эвента | все обращения эвента удаляются |
| перенос участия A → B | `user_id`, `assignee`, `sender` A → B; открытое обращение A закрывается, если у B уже есть открытое в том же эвенте |
| снятие прав админа | его открытые обращения → ничьи |

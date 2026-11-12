# Data Model: 008-delivery-families-requests

Миграция `0004_delivery_families_requests.sql`, схема `8`.

## Новые поля

| Таблица | Поле | Тип / по умолчанию | Смысл |
|---|---|---|---|
| `members` | `delivery` | TEXT '' | «Как передать подарок», до 500 символов |
| `members` | `delivery_updated_at` | INTEGER 0 | время изменения адреса (для уведомления Санте) |
| `events` | `delivery_on` | INTEGER 0 | спрашивать адрес доставки |
| `events` | `families_on` | INTEGER 1 | учитывать семьи в жеребьёвке и заменах |
| `events` | `approval` | INTEGER 0 | вступление по одобрению |

## Новые таблицы

**families**: `id` PK, `name` TEXT (1–40), `created_by` INTEGER, `created_at` INTEGER.

**family_members**: `family_id` INTEGER, `user_id` INTEGER **PRIMARY KEY** (человек — не больше одной семьи).
Индекс `family_members_family (family_id)`.

**join_requests**: `id` PK, `event_id`, `user_id`, `status` TEXT ('pending' | 'approved' | 'rejected'),
`created_at`, `decided_by` INTEGER 0, `decided_at` INTEGER 0.
Уникальный частичный индекс `join_requests_pending (event_id, user_id) WHERE status = 'pending'`.

## Правила

- Адрес отдаётся только самому участнику (`event.get`) и его Санте (`ward.get`), и только если `delivery_on`.
- Семья действует в эвенте, только если `families_on` и в эвенте не меньше двух её членов.
- Удаление семьи удаляет её `family_members`; проведённые пары не меняются.
- Удаление эвента и сброс удаляют `join_requests` эвента.

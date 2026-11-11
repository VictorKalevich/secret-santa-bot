# Data Model: 005 (заменяет модели 001–004)

## users — человек

`tg_id` PK · `name` · `username` · `is_admin` · `registered` · `notify_mode` · `pending` (`''`, `name`, `name:<event>`,
`msg_ward:<event>`, `msg_santa:<event>`) · `created_at`

## events — эвент

| Поле | Значение |
|---|---|
| `id` | PK |
| `title` | 1–80 символов |
| `status` | `active` / `finished` |
| `created_at`, `created_by`, `finished_at` | время, автор, время завершения (0 — идёт) |
| `invite_code` | код ссылки `t.me/<bot>?start=inv_<code>` (уникален) |
| `registration_open`, `draw_done`, `draw_at`, `revealed` | как в 001 |
| `ring` | 1 — кольцевая (по умолчанию), 0 — взаимные пары допустимы |
| `avoid_previous` | 1 — не повторять пары прошлого эвента |
| `budget`, `event_date`, `place`, `deadline`, `notes`, `last_daily` | как в 001 |

## members — участие

PK (`event_id`, `user_id`) · `wishlist` (≤ 4000 символов) · `wishlist_updated_at` · `joined_at`.
Участник жеребьёвки = член эвента с `users.registered = 1`.

## exclusions, pairs, messages

Как в 001/003, плюс `event_id` в ключах: `exclusions` PK (`event_id`, `giver`, `receiver`); `pairs` PK (`event_id`, `santa`),
UNIQUE (`event_id`, `ward`); `messages` индекс (`event_id`, `santa`, `ward`, `id`).

## settings

`owner_id`, `bot_username`, `base_url`, `schema` (`5`).

## Переходы эвента

```text
active ──(Завершить)──▶ finished        (обратно нельзя)
active/finished ──(Полный сброс, владелец)──▶ active, пустой
любой ──(Удалить, владелец)──▶ (нет)
```

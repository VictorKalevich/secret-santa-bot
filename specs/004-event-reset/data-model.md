# Data Model: 004

Схема не меняется ([001](../001-secret-santa-bot/data-model.md), [003](../003-santa-ward-chat/data-model.md)).

## Полный сброс — состояние после

| Таблица | Состояние |
|---|---|
| users | только владелец; `wishlist = ''`, `pending = ''` |
| pairs, exclusions, history, messages, outbox | пусто (в outbox — только уведомления о сбросе) |
| settings | `draw_done=0`, `revealed=0`, `registration_open=1`, новый `invite_code`, `avoid_previous=1`; `budget`, `event_date`, `place`, `deadline`, `notes`, `last_daily`, `draw_at` пустые; `owner_id`, `bot_username`, `base_url` без изменений |

## Перенос `from` → `to`

| Что | Как |
|---|---|
| pairs | `santa = to WHERE santa = from`; `ward = to WHERE ward = from` |
| messages | то же для `santa`/`ward` |
| history | то же |
| exclusions | `UPDATE OR IGNORE` giver/receiver; удалить остатки с `from` и строки `giver = receiver` |
| users[to] | `is_participant` = from; `is_admin` = from OR to; письмо и время — от `from`, если у `to` пусто |
| users[from] | удаляется |

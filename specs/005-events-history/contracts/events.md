# Contract: эвенты (005)

Все игровые действия теперь принимают `event` (ID эвента). Доступ: участник эвента или админ (для `admin.*`).

## Пользователь

| Action | Тело | Ответ |
|---|---|---|
| `me` | — | `registered`, `me{id,name,is_admin,is_owner,notify_mode}`, `events[{id,title,status,finished_at,event_date,draw_done,member,unread}]` (админ — все эвенты, остальные — свои), `limits.chars` |
| `notify.set` | `{mode}` | — |
| `event.get` | `{event}` | `event{…параметры, ring, status, finished_at, chat_until, participants}`, `member{wishlist, wishlist_updated_at, has_ward, has_santa, unread}` или `null`, `can{edit_letter, chat_write}` |
| `wishlist.save`, `ward.get`, `ward.gift`, `chat.get`, `message.send` | + `event` | как в 001/003; отказ 403, если не участник; `wishlist.save`/`ward.gift` — 400 после завершения; `message.send` — 400 через 7 суток после завершения |

## Админ

| Action | Тело | Эффект |
|---|---|---|
| `admin.events.create` | `{title}` | новый эвент; ответ `{event}` |
| `admin.users` | — | все зарегистрированные (для ролей) + `owner_id` |
| `admin.state` | `{event}` | участники эвента и статусы, исключения, параметры (`ring`, `avoid_previous`, `invite_link`, …), список других эвентов для приглашения |
| `admin.game` | `{event, title, budget, event_date, place, deadline, notes, ring?}` | `ring` — только до жеребьёвки |
| `admin.participate` | `{event, on}` | админ вступает/выходит (до жеребьёвки) |
| `admin.event.finish` | `{event}` | завершить; сообщение участникам |
| `admin.event.invite_from` | `{event, from}` | сообщение со ссылкой участникам эвента `from`, кого нет в `event`; ответ `{count}` |
| `admin.event.delete` | `{event, confirm: "УДАЛИТЬ"}` | только владелец; удаляет эвент и все его данные |
| `admin.reset.full` | `{event, confirm: "СБРОС"}` | только владелец; сбрасывает один эвент; завершённый — 400 (только удалить) |
| `admin.transfer` | `{from, to}` | перенос во всех эвентах; отказ, если в каком-то эвенте `to` уже в жеребьёвке |
| остальные `admin.*` из 001–004 | + `event` | в пределах эвента; отказ для завершённого эвента, кроме `admin.reveal`, `admin.wishlist`, `admin.state` |

Удалено: `admin.newgame`, `admin.invite.regen` без `event`.

## Бот

| Ввод | Поведение |
|---|---|
| `/start inv_<code>` | найти эвент; закрыт/завершён → объяснение; зарегистрирован → вступить и меню; новый → спросить имя, затем вступить |
| `/start adm_<код>` | владелец (002); эвентов может не быть |
| Меню | список своих эвентов (идущие), кнопки «💬 Подопечному / Санте · <эвент>» (`msg:ward:<id>`) |
| `/app?event=<id>&chat=ward\|santa` | открыть эвент (и переписку) |

## Сообщения (добавлено название эвента)

«🎄 Жеребьёвка в эвенте «X» проведена!», «📝 Твой подопечный в эвенте «X» обновил письмо», «💬 Твой Тайный Санта («X») пишет:»,
«🏁 Эвент «X» завершён…», «📨 Приглашение в эвент «X»» + кнопка вступления, «Эвент «X» удалён организатором».

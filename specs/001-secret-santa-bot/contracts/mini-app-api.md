> История фичи 001. Актуальное описание API, бота и журнала — [docs/api.md](../../../docs/api.md) (с фичи 022).

# Contract: JSON API мини-приложения

> **С фичи 005** действия привязаны к эвенту (поле `event`), см. [`specs/005-events-history/contracts/events.md`](../../005-events-history/contracts/events.md).
> Этот контракт описывает поведение внутри одного эвента.


Все запросы: `POST /api/<action>`, тело — JSON, заголовок `X-Init-Data: <Telegram.WebApp.initData>`.
Ответ: `{ "ok": true, ... }` или `{ "ok": false, "error": "текст для человека" }`.

| Код | Когда |
|---|---|
| 401 | подпись `initData` неверна или старше 24 ч |
| 403 | пользователь не зарегистрирован / действие только для админа |
| 404 | неизвестное действие |
| 400 | ошибка проверки данных (текст в `error`) |

## Участник

| Action | Тело | Ответ | Требования |
|---|---|---|---|
| `me` | — | `registered`; если `true`: `me{id,name,is_admin,is_participant,notify_mode,wishlist,wishlist_updated_at,has_ward,has_santa}`, `game{budget,event_date,place,deadline,notes,draw_done,revealed,participants}`, `limits{words,chars}` | FR-001, FR-025 |
| `wishlist.save` | `{text}` | `{updated_at}` | FR-006–FR-008 (меняет только своё). **Изменено в 003:** ≤ 4000 символов — см. [003/contracts/chat.md](../../003-santa-ward-chat/contracts/chat.md) |
| `ward.get` | — | `state: no_draw \| waiting \| ok`; при `ok`: `ward{name,wishlist,updated_at}`, `previous` (текст прошлого просмотра или `null`), `first_view`, `gift_ready`. Запоминает просмотр. | FR-014, FR-017 |
| `ward.gift` | `{ready: bool}` | — | FR-028 |
| `message.send` | `{to: "ward"\|"santa", text}` | — | FR-027. **Изменено в 003:** сохраняется в переписке, ≤ 4000 символов, есть `chat.get` — см. [003/contracts/chat.md](../../003-santa-ward-chat/contracts/chat.md) |
| `notify.set` | `{mode: "sound"\|"silent"\|"off"}` | — | FR-020 |

## Администратор (`is_admin = 1`)

> **Изменено в 002:** роли владелец/админ, новые действия `admin.role.*`, `admin.owner.transfer` и ограничения
> `admin.remove` — см. [002/contracts/roles.md](../../002-admin-roles/contracts/roles.md).

| Action | Тело | Ответ / эффект | Требования |
|---|---|---|---|
| `admin.state` | — | `users[{id,name,username,registered,is_admin,is_participant,has_wishlist,in_draw,gift_ready}]`, `exclusions[{giver,receiver}]`, `settings{…, registration_open, avoid_previous, has_history, invite_link, draw_at}`. **Без пар и без текстов писем.** | FR-015, FR-016 |
| `admin.wishlist` | `{id}` | `{name, wishlist, updated_at}` — UI вызывает только после подтверждения | FR-016 |
| `admin.game` | `{budget, event_date, place, deadline, notes}` | сохраняет параметры | FR-025 |
| `admin.registration` | `{open}` | открывает/закрывает регистрацию | FR-022 |
| `admin.invite.regen` | — | новый код приглашения | FR-022 |
| `admin.avoid_previous` | `{on}` | учитывать прошлые пары | FR-013 |
| `admin.participate` | `{on}` | админ участвует или нет (только до жеребьёвки) | FR-005 |
| `admin.rename` | `{id, name}` | — | FR-023 |
| `admin.remove` | `{id}` | удаляет участника; после жеребьёвки — минимальная перестройка пар | FR-023 |
| `admin.insert` | `{id}` | вписывает опоздавшего в жеребьёвку | FR-024 |
| `admin.exclusion.add` | `{giver, receiver, mutual}` | — | FR-009 |
| `admin.exclusion.del` | `{giver, receiver, mutual}` | — | FR-009 |
| `admin.draw.check` | — | `{possible, count, problems[], empty_wishlists[], history_used, history_ignored}` | FR-010 |
| `admin.draw` | — | `{count, single_cycle, history_ignored}`; закрывает регистрацию, рассылает уведомления | FR-011, FR-012 |
| `admin.remind.unfilled` | — | `{count}` | FR-021 |
| `admin.remind.santas` | — | `{count}` | FR-021 |
| `admin.reveal` | — | `{count}`; каждый подопечный получает имя Санты | FR-026 |
| `admin.newgame` | — | пары → история, регистрация открыта | FR-026 |

## Служебные адреса

| Адрес | Назначение |
|---|---|
| `GET /app` | страница мини-приложения (с встроенным CSS дизайн-системы) |
| `POST /tg` | webhook Telegram; требует `X-Telegram-Bot-Api-Secret-Token` |
| `GET /setup?key=<ADMIN_SECRET>` | настройка webhook, команд, кнопки меню; показывает ссылки админа и приглашения |

# Contract: адрес доставки, семьи, заявки (008)

Дополняет [007 api.md](../../007-admin-tools/contracts/api.md).

## Участник

| Action | Тело | Ответ / эффект |
|---|---|---|
| `event.get` | `{event}` | `event` + `delivery_on`, `approval`; `member` + `delivery` (свой адрес) |
| `delivery.save` | `{event, text}` | до 500 символов; 400, если эвент не спрашивает адрес или завершён; ответ `{updated_at}` |
| `ward.get` | `{event}` | + `ward.delivery` (только если `delivery_on`) |

## Админ

| Action | Тело | Ответ / эффект |
|---|---|---|
| `admin.game` | меняет только переданные поля (кроме `title`, по умолчанию прежний); + `delivery_on`, `families_on`, `approval` | `families_on` после жеребьёвки → 400 «После жеребьёвки правило семей не изменить» (если меняется) |
| `admin.state` | `{event}` | + у участника `has_delivery` (если `delivery_on`); + `families[{id, name, members[ids]}]` (≥ 2 участника эвента); + `requests[{id, user_id, name, username, created_at}]` (ожидающие); + `settings.delivery_on`, `families_on`, `approval` |
| `admin.request.decide` | `{event, id, approve}` | принять/отклонить; 400 «Заявка уже рассмотрена» |
| `admin.families` | `{}` | `families[{id, name, members[{id, name}]}]`, `users[{id, name, family_id}]` (зарегистрированные) |
| `admin.family.save` | `{id?, name, members[ids]}` | создать (без `id`) или изменить; 2–20 человек; 400 «<имя> уже в семье «…»» |
| `admin.family.delete` | `{id}` | удалить семью |

Ни один ответ админу не содержит адреса доставки (`admin.wishlist` — только письмо).

## Бот

| Событие | Действие |
|---|---|
| `/start inv_…`, эвент с `approval`, не админ | регистрация имени (если новый) → заявка; «⏳ Заявка отправлена организатору»; админам — «🙋 <имя> просится в эвент «…»» с кнопками |
| повторный переход при ожидающей заявке | «Заявка уже отправлена, ждём решения организатора» |
| кнопка `req:<id>:a` / `req:<id>:r` (админ) | решение заявки; человеку — «🎉 Тебя приняли…» / «Организатор не одобрил заявку…»; остальным админам — тихое уведомление |
| cron: подопечный изменил адрес | Санте «📝 Твой подопечный в эвенте «…» обновил письмо или адрес» |

## Журнал: новые коды

`family.save`, `family.delete`, `request.approve`, `request.reject` (параметры 008 — `event.settings`).

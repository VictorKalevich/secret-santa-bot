# Контракт 064: сервер и API

## 1. Действия

Уходят из `ACTIONS` (вызов — путь неизвестного действия, 400 «Неизвестное действие.», данные не меняются):
`delivery.save`, `ward.gift`, `ward.received`, `ward.shipment`, `admin.remind.santas`. Действий — 64 (было 69),
`admin.*` — 42. `admin.event.finish` и `admin.reset.full` остаются (в приложении кнопок нет).

## 2. Ответы

| Ответ | Убирается |
|---|---|
| `event.get` → `event` (`publicEvent`) | `delivery_on`, `contacts_on` |
| `event.get` → `member` | `gift_received`, `delivery`, `shipment` |
| `event.get` → `roster` | `progress` после жеребьёвки → `null` (до — `{ letters, of }`); `username` — у каждого, у кого он есть |
| `ward.get` | `ward.delivery`, `gift_ready`, `shipment`, `timezone_offset_hours` |
| `admin.state` → `users[]` | `gift_ready`, `gift_sent`, `gift_received`, `has_delivery` |
| `admin.state` → `settings` | `finish_auto`, `delivery_on`, `contacts_on` (`reveal_auto` остаётся) |
| `admin.vault.person` | `gift_sent`, `delivery` |

`admin.game`: поля `delivery_on`, `contacts_on`, `finish_auto` в теле не читаются (колонки не меняются).

## 3. Параметры события

`EVENT_PARAMS` без `delivery_on`, `contacts_on`, `finish_auto`; `EVENT_RETIRED = ['families_on', 'delivery_on',
'contacts_on', 'finish_auto']`. Новое событие (и по образцу), полный сброс — колонки не трогают (значения схемы или
прежние). Вступление и создание события адрес из прошлых событий не копируют.

## 4. cron

- **Уведомление о правке письма** — всегда `cron.wishlistChanged`; запрос не читает `e.delivery_on`.
- **Ежедневный шаг**: `dailyReminder` — только `remindUnfilled` до жеребьёвки (за 2 дня, за день, в день срока письма);
  после жеребьёвки напоминаний нет.
- **Автодействия**: `'finish'` — у идущего события с датой D при `D + 3 <= сегодня` (без `finish_auto`); `'reveal'` — как
  раньше (`reveal_auto`, D + 1).
- **Брошенные события** (`src/stale.js`), оба бота: только без даты; Г — нет жеребьёвки, `outsiders = 0`, 23 дня от
  создания; Б — 53 дня; предупреждение → через 7 дней `finishEvent(…, 0)`; дата появилась — отметка снимается молча.
  `dailyEventsQuery(db, { today, now })` — без признака бота.
- Обычная минута — 3 запроса, как раньше.

## 5. Журнал

`remind.santas` не пишется — «Прежние коды» в `docs/api.md`; `finish` — `admin.event.finish`, cron (D + 3; брошенное —
через 7 дней после `finish.warn`); `finish.warn` — cron, оба бота, только событие без даты.

## 6. Ссылка `/app`

Параметр `shipment=1` больше не обрабатывается (прежние сообщения открывают событие как обычно).

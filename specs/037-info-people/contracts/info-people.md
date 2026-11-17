# Contract: список участников на «Инфо» (037)

## Параметр события `contacts_on`

| | |
|---|---|
| Колонка | `events.contacts_on INTEGER NOT NULL DEFAULT 0` (`migrations/0009_contacts.sql`, схема 12) |
| `EVENT_PARAMS` | `{ kind: 'flag', default: 0, template: true }` — без `beforeDraw`, без `own` |
| Меняет | `admin.game` с полем `contacts_on` (журнал `event.settings`, «параметры») |
| Отдаётся | `publicEvent` → `event.contacts_on` в `event.get` и `settings.contacts_on` в `admin.state` |

## `event.get` — новое поле `roster`

```js
roster: {
  people: [{ id, name, role, username? }],        // зарегистрированные участники события
  organizers: [{ id, name, owner, username? }],   // все организаторы бота (is_admin, registered)
  progress: { letters, of }                       // жеребьёвки нет: of — участники, letters — с непустым письмом
          | { ready, received, of },              // жеребьёвка есть: по парам события, of — число пар
  invite_link: '',                                // ссылка события при registration_open и status = 'active', иначе ''
}
```

- `people`: `role` — `'owner'` (владелец бота), `'admin'` (другой организатор), `''`; порядок — имя по-русски
  (`localeCompare('ru')`), при равенстве — `id`. Только `registered = 1`.
- `username` (в `people` и `organizers`) — только при `contacts_on = 1` и непустом @username; иначе ключа нет.
- `organizers`: владелец первым, остальные по имени.
- Больше ничего: ни отметок по людям, ни адресов, семей, исключений, закреплённых пар, пар. Одинаково для участника и
  организатора-не участника.
- `event.participants` — как раньше (число зарегистрированных участников); новые поля `event`: `contacts_on`,
  `draw_auto_date`.

## Приложение — «Инфо»

1. «О событии»: строка «Участников» убрана; «Организаторы» — имена `roster.organizers` через запятую (нет организаторов —
   строки нет); пока `!draw_done` и событие идёт — «Автожеребьёвка»: дата (`fmtDate`) или «не установлена».
2. Раздел «Участники · N» (N = `people.length`) сразу после «О событии»:
   - подсказка (`ds-hint--inset`): `progress.of` = 0 — нет; до жеребьёвки — «Письма написали X из N»; после —
     «🎁 Подарки готовы: X из N · 📦 получено: Y из N»;
   - карточка-список (`ds-card ds-card--flush`), строка (`ds-list-item`): заголовок `ds-list-item__title` — имя, у своей
     « (ты)», при `username` — серым «  @username»; справа метка `ds-chip` «👑 владелец» / «🛠 организатор»;
   - строка нажимается (`ds-list-item--link`, `ds-list-item__chevron` «›»), только если `event.contacts_on`, есть
     `username` и это не своя строка: `confirmBox('Открыть чат с <имя> в Telegram?')` → да — `https://t.me/<username>`
     (`openTelegramLink`, без SDK — `window.open`);
   - пустой список — строка «Пока никого нет»;
   - больше 8 — первые 8 и строка-кнопка «Показать всех (N)»; раскрытие — `state.rosterOpen = id события`.
3. Приглашение (только при `roster.invite_link`): карточка с подсказкой «Позови друга — по ссылке он сразу вступит в
   событие.» (при `event.approval` — «Позови друга — он отправит заявку, организатор её подтвердит.») и кнопкой
   «📨 Пригласить друга» → `shareInvite(link, title)`.

## Приложение — «Параметры» (панель)

Флажок `contacts_on` после «Подарки отправляют…»: «Участники могут писать друг другу» + подсказка «В списке на «Инфо»
появятся @username, нажатие на имя откроет чат в Telegram. Санта, который напишет подопечному сам, раскроет себя.»
Сохраняется кнопкой «Сохранить» вместе с остальными параметрами (черновик — как у остальных).

## `shareInvite(link, title)` (`02-core`)

Открывает `https://t.me/share/url?url=<link>&text=🎄 Играем в Тайного Санту — «<title>»! Заходи по ссылке:` —
«📤 Отправить в чат» в панели и «📨 Пригласить друга» на «Инфо» (одна копия текста).

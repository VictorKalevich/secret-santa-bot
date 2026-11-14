# Data Model: Таблица действий API и контекст запроса

Схема базы не меняется. Ниже — внутренние структуры фичи.

## 1. Таблица действий `ACTIONS` (`src/api.js`)

Роли: `ANY` — любой с подписью; `USER` — зарегистрированный; `VIEWER` — участник события или админ; `MEMBER` — участник
события; `ADMIN` — админ; `OWNER` — владелец (с текстом отказа). «Событие»: да / нет / если передано. «В завершённом»:
`CLOSED` — общий отказ 400 «Событие завершено — менять его уже нельзя (доступны просмотр, раскрытие и удаление).»;
текст — свой отказ 400; «да» — разрешено (в скобках — что проверяет обработчик). Порядок строк — порядок прежних `case`.

### Действия участника (13)

| Действие | Роль | Событие | В завершённом |
|---|---|---|---|
| `me` | ANY | нет | — |
| `notify.set` | USER | нет | — |
| `event.get` | VIEWER | да | да (только чтение) |
| `wishlist.save` | MEMBER | да | «Событие завершено: письмо теперь только для чтения.» |
| `delivery.save` | MEMBER | да | да (сначала «адрес не нужен», затем «Событие завершено: адрес теперь только для чтения.») |
| `ward.get` | MEMBER | да | да (только чтение) |
| `ward.gift` | MEMBER | да | «Событие завершено: отметка только для чтения.» |
| `ward.received` | MEMBER | да | «Событие завершено: отметка только для чтения.» |
| `message.send` | MEMBER | да | да (переписка — 7 суток, `chat.js`) |
| `chat.get` | MEMBER | да | да (только чтение) |
| `support.get` | MEMBER | да | да (только чтение) |
| `support.send` | MEMBER | да | да (7 суток, `support.js`) |
| `support.close` | MEMBER | да | да (7 суток, `support.js`) |

### Общие действия админа (11)

| Действие | Роль | Текст отказа владельца | Событие |
|---|---|---|---|
| `admin.events.create` | ADMIN | — | нет |
| `admin.families` | ADMIN | — | нет |
| `admin.family.save` | ADMIN | — (заморозка состава — не для владельца, в модуле) | нет |
| `admin.family.delete` | ADMIN | — (то же) | нет |
| `admin.audit` | ADMIN | — | если передано (тогда «в завершённом» — да) |
| `admin.users` | ADMIN | — | нет |
| `admin.rename` | ADMIN | — (админа и владельца — только владелец, в обработчике) | нет |
| `admin.transfer` | OWNER | «Переносить участие на новый аккаунт может только владелец бота.» | нет |
| `admin.role.grant` | OWNER | «Назначать и снимать администраторов может только владелец бота.» | нет |
| `admin.role.revoke` | OWNER | то же | нет |
| `admin.owner.transfer` | OWNER | «Передать права владельца может только владелец бота.» | нет |

### Действия админа в событии (35)

| Действие | Роль | Текст отказа владельца | В завершённом | Слово |
|---|---|---|---|---|
| `admin.state` | ADMIN | — | да | — |
| `admin.wishlist` | ADMIN | — | да | — |
| `admin.game` | ADMIN | — | CLOSED | — |
| `admin.ring` | ADMIN | — | CLOSED | — |
| `admin.registration` | ADMIN | — | CLOSED | — |
| `admin.invite.regen` | ADMIN | — | CLOSED | — |
| `admin.avoid_previous` | ADMIN | — | CLOSED | — |
| `admin.participate` | ADMIN | — | CLOSED | — |
| `admin.remove` | ADMIN | — (админа — только владелец, в обработчике) | CLOSED | — |
| `admin.removed.allow` | ADMIN | — | CLOSED | — |
| `admin.insert` | OWNER | «Вписывать в жеребьёвку после неё может только владелец бота.» | CLOSED | — |
| `admin.exclusion.add` | ADMIN | — (после жеребьёвки — только владелец, в модуле) | CLOSED | — |
| `admin.exclusion.del` | ADMIN | — (то же) | CLOSED | — |
| `admin.fixed.add` | OWNER | «Закреплять пары может только владелец бота.» | CLOSED | — |
| `admin.fixed.del` | OWNER | то же | CLOSED | — |
| `admin.draw.check` | ADMIN | — | CLOSED | — |
| `admin.draw` | ADMIN | — | CLOSED | — |
| `admin.draw.cancel` | ADMIN | — | CLOSED | — |
| `admin.draw.cancel.force` | OWNER | «Принудительно отменить жеребьёвку может только владелец бота.» | CLOSED | `ОТМЕНА` — «Для отмены введи слово ОТМЕНА.» |
| `admin.support.get` | ADMIN | — (взятое — ответственный и владелец, в модуле) | да | — |
| `admin.support.take` | ADMIN | — | да (7 суток, в модуле) | — |
| `admin.support.send` | ADMIN | — | да (7 суток, в модуле) | — |
| `admin.support.pass` | ADMIN | — (ответственный или владелец, в модуле) | да (7 суток, в модуле) | — |
| `admin.support.close` | ADMIN | — (то же) | да (7 суток, в модуле) | — |
| `admin.announce` | ADMIN | — | CLOSED | — |
| `admin.request.decide` | ADMIN | — | CLOSED | — |
| `admin.remind.unfilled` | ADMIN | — | CLOSED | — |
| `admin.remind.santas` | ADMIN | — | CLOSED | — |
| `admin.reveal` | ADMIN | — | да | — |
| `admin.event.finish` | ADMIN | — | CLOSED | — |
| `admin.event.invite_from` | ADMIN | — | да (сначала «Выбери другое событие.», затем свой отказ) | — |
| `admin.event.delete` | OWNER | «Удалить событие может только владелец бота.» | да | `УДАЛИТЬ` — «Для удаления введи слово УДАЛИТЬ.» |
| `admin.vault.person` | OWNER | «Служебный просмотр доступен только владельцу бота.» | да | — |
| `admin.vault.pairs` | OWNER | то же | да | — |
| `admin.reset.full` | OWNER | «Полный сброс может только владелец бота.» | CLOSED | `СБРОС` — «Для полного сброса введи слово СБРОС.» |

Заглушки: `UNKNOWN_ADMIN` (любое неизвестное `admin.*`: ADMIN, событие да, CLOSED) и `UNKNOWN` (любое неизвестное
действие участника: MEMBER, событие да, «да»); обработчик — 404 «Неизвестное действие».

**Правила строки** (проверяет `tests/api-table.test.mjs`): роль — из списка; `owner` есть тогда и только тогда, когда
роль `OWNER`; у действия события поле «в завершённом» задано явно (`true` или непустая строка); `confirm` — пара
«слово, текст»; `run` — функция; действия `admin.*` — роль `ADMIN` или `OWNER`, остальные — не `ADMIN`/`OWNER`.

## 2. Контекст вызова (`src/context.js`)

| Поле | Что | Когда читается |
|---|---|---|
| `env` | окружение со счётчиком запросов (`metered`) | — |
| `db` | `env.DB` | — |
| `me` | запись пользователя или `null` | API и сообщение боту — в начальном пакете с настройками; нажатие кнопки — до создания контекста; cron — `null` |
| `settings()` | настройки бота | API и сообщение боту — в начальном пакете; иначе при первом вызове |
| `users()` | все пользователи (`ORDER BY created_at`) | при первом вызове или в пакете `ctx.read({ users: true, … })` |
| `ownerId()` | `resolveOwner(db, settings, users)` — может записать нового владельца | `admin.*` — сразу после проверки «админ»; `me` админа; функциям ролей |
| `isOwner()` | `me` — владелец | из `ownerId()` |
| `read(named)` | пакет именованных чтений (+ `users`/`settings` из кэша или в пакете) | по требованию |
| `forgetUsers()` | сбросить кэш пользователей и владельца | после `createUser` в ссылке владельца |

Кэш — на один вызов; ошибка чтения кэш сбрасывает.

## 3. Пакет чтений (`readMany`, `src/db.js`)

Вход — объект «имя → оператор `SELECT` или ложь»; выход — «имя → строки» (`[]` у пропущенных). Один `db.batch` на все
заданные операторы, ни одного — если заданных нет. Для «первая строка или `null`» — `rows[0] ?? null`.

## 4. Эталон отказов (`tests/fixtures/api-refusals.json`)

```text
{
  "actions": [59 имён в порядке прежних case],
  "cases": { "<ситуация> <действие>": { "status": число, "error": текст | null }, … }
}
```

Ситуации — research R3 (`stranger`, `outsider`, `member`, `admin`, `missing`, `finished`, `finished-admin`,
`finished-delivery`); неизвестные действия — `admin.nope`, `nope`.

## 5. Признак «пусто» в базе

`BLANK_SQL(col)` — `trim(col, <25 символов>) = ''`; совпадает с `!text.trim()` (research R6). Используется в выборках
`drawMembersQuery` (`wishlist_blank`), `panelMembersQuery` (`has_wishlist`, `has_delivery` — через `NOT`),
`unfilledIdsQuery`.

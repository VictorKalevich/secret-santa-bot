# Research: Список участников на «Инфо» (037)

## R1. Что отдавать участнику

- **Decision**: `roster.people` — `{ id, name, role, username? }` по зарегистрированным участникам (`role`: `'owner'`,
  `'admin'`, `''`); `username` — только при `contacts_on`. Сортировка — `name.localeCompare(…, 'ru')`, при равенстве — `id`.
- **Rationale**: «кто играет» без отметок; порядок не связан с парами и временем вступления.
- **Alternatives considered**: порядок вступления (`joined_at`, как в панели) — безопасен, но в длинном списке своё имя
  искать дольше; отдавать @username всегда и прятать в приложении — нарушило бы решение «выключено — сервер не отдаёт».

## R2. Прогресс — только суммы

- **Decision**: до жеребьёвки — `{ letters, of }`: из зарегистрированных участников, у кого письмо не пустое (`BLANK_SQL`,
  то же правило, что «письма нет» в панели); после — `{ ready, received, of }` по парам события
  (`COUNT(*)`, `SUM(gift_ready)`, `SUM(gift_received)`).
- **Rationale**: суммы не зависят от того, кто кому дарит: при перестановке пар колонка Санты (`gift_ready`) остаётся у
  Санты, подопечного (`gift_received`) — у подопечного, суммы те же (так переставляет тест `secrecy`). Отметки по людям
  по времени изменения выдали бы пару подопечному.
- **Alternatives considered**: «письмо есть / нет» у каждого — для пар безопасно, но это публичное давление; владелец
  выбрал общий прогресс.

## R3. Организаторы

- **Decision**: `roster.organizers` — все `is_admin` и `registered` из `users` (права в боте общие): `{ id, name, owner,
  username? }`, владелец первым, остальные по алфавиту; `username` — по тому же параметру.
- **Rationale**: участнику ясно, к кому уходит «Написать организатору»; те же люди получают обращения
  (`adminRecipients`).

## R4. Параметр `contacts_on`

- **Decision**: колонка `events.contacts_on INTEGER NOT NULL DEFAULT 0` (`0009_contacts.sql`, `settings.schema` → 12,
  `REQUIRED_SCHEMA = 12`); строка `EVENT_PARAMS`: `{ kind: 'flag', default: 0, template: true }` — сохранение через
  `admin.game` (журнал «параметры»), образец копирует, сброс — умолчание; панель получает его через `publicEvent`
  (`settings` в `admin.state`).
- **Rationale**: тот же путь, что у остальных флажков (`delivery_on`, `approval`) — тест `server-shape` сверяет схему,
  умолчание, сброс и образец.
- **Alternatives considered**: общий параметр бота (в `settings`) — владелец сказал «в настройках события»; разные
  компании в разных событиях.
- **Выкат**: код требует схему 12 — миграция до выката кода; откат кода безопасен (старый код требует ≥ 11).

## R5. Приглашение у участника

- **Decision**: `roster.invite_link` — `inviteLink(settings, ev)` только при `registration_open` и `status = 'active'`,
  иначе `''`. Приложение — «📨 Пригласить друга» → `shareInvite(link, title)` (`https://t.me/share/url?…` через
  `openTelegramLink`, как «📤 Отправить в чат» в панели; помощник общий).
- **Rationale**: вступление по ссылке проверяет сервер (закрытая регистрация, одобрение, `rejoin`) — у участника та же
  ссылка, правила не меняются.

## R6. Число запросов

- **Decision**: `peopleQuery` заменяет `participantCountQuery` в пакете `eventView`; `giftTotalsQuery` и `users: true` —
  в том же пакете. Пакет — один запрос к базе: `event.get` — по-прежнему 4 (тест `queries`).

## R7. Чат в Telegram

- **Decision**: нажатие на строку (при `contacts_on`, есть `username`, не своя) — `confirmBox('Открыть чат с <имя> в
  Telegram?')` → `openTelegramLink('https://t.me/<username>')` (без SDK — `window.open`). Имя — до 40 символов (правило
  имени), текст помещается в окно (`CONFIRM_MAX`, тест `app-ui`).
- **Rationale**: тот же механизм, что пересылка ссылки; CSP — навигация, не запрос со страницы.

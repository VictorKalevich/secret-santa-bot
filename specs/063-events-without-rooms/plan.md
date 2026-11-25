# Implementation Plan: 063. События без комнат

**Branch**: `063-events-without-rooms` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Summary

Комнаты (050–052) убираются: у события свой владелец (`events.owner_id`) и свои организаторы (`event_admins`, владелец —
там же). Права модулей переводятся с контекста компании `ctx.in(companyId)` на контекст события `ctx.at(ev)` с тем же
набором (`users()`, `ownerId()`, `isOwner()`, `me.is_admin`, `ownerWord()`), поэтому предметные модули меняются мало.
Создать событие может любой (открытый бот) или владелец бота и люди с разрешением (`users.can_create`, закрытый бот);
лимит 10 созданий за 365 суток — по фактам `event_creations` в условии пакета вставки. История пар — по владельцу.
Журналы — события и бота. Приложение: главный экран — «Мои события» с закреплённой кнопкой «Создать», экран «Настройки»
(вместо «Компаний»), «Владелец и администраторы» — секция панели события.

- **Данные.** Миграция `0024_events_without_rooms.sql` (схема 24), сверка `tools/rooms-reconcile.sql`; `REGISTRY` —
  `event_admins`, `event_creations`, `events.owner_id`, `users.can_create`.
- **Сервер.** `src/context.js` (`ctx.at`), `src/api.js` (69 действий, конвейер без компаний), новые модули
  `src/creation.js` (`openBot`, лимит, `createView`) и `src/bot-owner.js` (`bot.events`, `bot.people`,
  `bot.creator.set`, журнал бота); `src/companies.js` удаляется; правки `roles.js`, `events.js`, `participant.js`,
  `panel.js`, `membership.js`, `support.js`, `pairs.js`, `stale.js`, `cron.js`, `bot.js`, `db.js`.
- **Приложение.** `02-core`, `03-home` (список, создание, `enterEvent`), `04-settings` (вместо `04-companies`),
  `05-event`, `06-admin` (`adminOrganizers`), `07-vault-audit`, `09-start`; дизайн-система — `ds-bottom-bar`,
  `ds-page--bar`, `ds-hero__action`.
- **Тексты.** Словари 11 языков: новые и изменённые ключи, удалённые ключи комнат.
- **Документы.** `docs/api.md`, README, `CLAUDE.md`, Конституция 5.0.0, `docs/todo.md`.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей; Wrangler 4

**Storage**: Cloudflare D1, схема 24 (миграция 0024)

**Testing**: `node:test` («мир»), e2e (`wrangler dev` + имитация Telegram), Chrome (`tests/screenshots.mjs`)

**Target Platform**: Telegram Mini App (iOS WebKit, Android, десктоп), Worker на бесплатном тарифе

**Project Type**: веб-сервис (Worker) + мини-приложение без сборщика

**Performance Goals**: `me`, `event.get`, `admin.state` — не больше запросов, чем в 062 (таблица `tests/queries.test.mjs`);
`event.create` — пакет чтений контекста + 1 пакет записи (+1 чтение при отказе); обычный вызов не читает таблицы
целиком (тест `api-reads`)

**Constraints**: тайна (организатор не видит чужих событий, пар — только владелец события и владелец бота); `atomic` для
всех новых меняющих действий; лимит — в условии записи; дизайн-система; тексты — только из словарей, 11 языков, без
слова «комната» (кроме подписей прежних кодов журнала)

**Scale/Scope**: 8 действий убрано, 4 добавлено, 6 изменено (73 → 69); 1 миграция; 7 частей приложения; ~14 модулей
сервера; тесты комнат заменяются тестами событий

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Пары — только Санте, владельцу события (служебный просмотр в своём событии) и владельцу бота; «тайна между компаниями» → «между событиями»: организатор видит только события, где он организатор (404 на чужие — тест перебором всех `admin.*`). История пар — только события того же владельца (R7), предупреждения обмена не выдают чужих пар. Названий комнат больше нет — правило «названия личные» снимается. | ⚠️ поправка 5.0.0 — Complexity Tracking |
| II. Проще некуда для участника | Первый экран — свои события; путь новичка открытого бота до ссылки — 5 действий; регистрация без ссылки в открытом боте — «заводит своё событие» вместо «своей компании». | ⚠️ поправка 5.0.0 |
| III. Спецификация до кода | spec → plan → tasks → implement в ветке; `docs/api.md`, README, `CLAUDE.md`, Конституция — в той же ветке. | ✅ |
| IV. Только дизайн-система | Новые `ds-bottom-bar`, `ds-page--bar`, `ds-hero__action` — токены → компонент → `preview.html` → README дизайн-системы; остальное — существующие (`ds-details`, `ds-switch`, `openSheet`, `typedSheet`). | ✅ |
| V. Бесплатно и без сервера | Новые чтения — по индексам (`event_admins_user`, `events_owner`, `event_creations_user`, `audit_bot`); лимит 10 созданий за год ограничивает рост данных открытого бота сильнее прежних «двух комнат во владении» (события в комнате не ограничивались). Сообщения — через `outbox`. | ✅ |
| VI. Проверено до выката | Тесты событий (права, лимит, одновременность, перенос на копии «как у 062»), e2e, Chrome. | ✅ |
| VII. Владелец — максимальные права | «Владелец бота ⊇ владелец события ⊇ администратор события» — тест прав по `ACTIONS` для трёх ролей и «администратора другого события»; только владельцу бота: перенос участия, переименование, передача прав владельца бота, журнал бота, «Все события», разрешения на создание (закрытый бот). | ⚠️ поправка 5.0.0 |

**Поправка Конституции 5.0.0 (MAJOR)** — переопределены I (тайна между событиями, без названий комнат), II (регистрация
без ссылки в открытом боте — своё событие), VII (иерархия «владелец бота ⊇ владелец события ⊇ администратор события»,
кто создаёт события, лимит); «Безопасность и данные» — организаторы события, факты создания, разрешение на создание,
комнаты не используются (таблицы — ради отката), журнал бота.

После дизайна (Phase 1): нарушений без обоснования нет.

## Project Structure

### Documentation (this feature)

```text
specs/063-events-without-rooms/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/events-without-rooms.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
migrations/0024_events_without_rooms.sql      # новая
tools/rooms-reconcile.sql                     # новая
src/
├── context.js        # ctx.at(ev) вместо ctx.in
├── api.js            # 69 действий, конвейер без компаний
├── creation.js       # новая: openBot, лимит, createView
├── bot-owner.js      # новая: bot.events, bot.people, bot.creator.set, журнал бота
├── companies.js      # удаляется
├── db.js             # запросы людей и событий, журнал, REGISTRY, adminFlagStmt
├── roles.js, events.js, participant.js, panel.js, membership.js, support.js, pairs.js, stale.js, cron.js, bot.js
├── i18n/<11 языков>/ # companies.js, app-companies.js → app-settings.js, bot-owner.js; правки остальных
└── app/
    ├── 02-core.js.txt, 03-home.js.txt, 05-event.js.txt, 06-admin.js.txt, 07-vault-audit.js.txt, 09-start.html
    └── 04-settings.js.txt  # вместо 04-companies.js.txt
design-system/          # ds-bottom-bar, ds-page--bar, ds-hero__action
tests/                  # event-owners, event-create, bot-owner, app-home (вместо companies, companies-manage,
                        # open-bot, app-companies); правки rights, atomic, api-refusals, migrations, wording, …
```

**Structure Decision**: прежняя структура проекта; новые модули — по одной области ответственности, как `stale.js`.

## Complexity Tracking

| Нарушение | Зачем | Почему не проще |
|---|---|---|
| Переопределение принципов I, II, VII (Конституция 5.0.0) | Решение владельца 2026-11-25: комнат нет, событие — единица прав | Оставить комнаты скрытыми («комната на событие») — сохранило бы весь код комнат и усложнило бы образцы и историю пар (R3) |
| Таблицы и колонки комнат остаются без использования | Откат на 062 без восстановления базы | Удаление — отдельной фичей, когда откат не нужен (`docs/todo.md`, как семьи в 062) |

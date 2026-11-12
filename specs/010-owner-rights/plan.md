# Implementation Plan: Права владельца и закрытие открытых вопросов 009

**Branch**: `010-owner-rights` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-owner-rights/spec.md`

## Summary

Владелец бота получает максимальные права и служебный просмотр пар (отдельный экран, вход словом «ОТКРЫТЬ», журнал без
пар, без смены статусов). Путь к правам владельца защищается: ключ `/setup` только из формы (POST), ссылка владельца
одноразовая, после неё `/setup` заблокирована до смены `ADMIN_SECRET`. Перенос участия — только владелец. Закрываются
открытые вопросы 009: атомарное удаление эвента, семьи в условии записи жеребьёвки, «закрытая регистрация = никто»
(заявки и приглашения), настройка эвента «удалённые могут вернуться по ссылке» с отметками «удалён организатором».

Технически: одна миграция `0005` (колонка `events.rejoin`, таблица `removed_members`, схема 9); отметка «ссылка владельца
использована» — строка в `settings` (производная от текущего секрета, без миграции); новые действия API `admin.vault.person`,
`admin.vault.pairs`, `admin.removed.allow`; остальное — правки существующих функций и мини-приложения.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей; Wrangler 4 (dev/deploy/миграции)

**Storage**: Cloudflare D1 (SQLite); схема меняется только миграциями (`migrations/0005_owner_rights.sql`, `REQUIRED_SCHEMA = 9`)

**Testing**: `node:test` (юнит + правила дизайн-системы), e2e — `wrangler dev` + `tests/mock-telegram.mjs`, скриншоты — `playwright-core`

**Target Platform**: Cloudflare Workers (бесплатный тариф) + Telegram Bot API + Telegram Mini App

**Project Type**: веб-сервис (Worker) + одностраничное мини-приложение (`src/app.html`)

**Performance Goals**: ≤ 10 мс CPU и ≤ 50 внешних запросов (включая D1) на вызов; новые действия — единицы запросов

**Constraints**: тайна пар (принцип I), владелец ⊇ админ (принцип VII), только дизайн-система в `app.html`, рассылки —
только через `outbox`, атомарность «одно действие — один результат» (захват + операторы по условию в одном batch)

**Scale/Scope**: одна небольшая группа (десятки человек, единицы эвентов)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию (2.0.0) | Пары отдаёт только `ward.get` Санте и `admin.vault.*` владельцу. Служебный просмотр: только владелец, отдельный экран, вход словом, журнал без пар, статусы не меняются; честный текст в «Как это работает» и README. Админ теряет перенос участия (обход тайны). Ограничения против косвенного вычисления остаются для админов, сняты для владельца (он видит пары и так). Адрес доставки — участнику, его Санте и владельцу в служебном просмотре. | ✅ |
| II. Проще некуда для участника | Участнику ничего не добавлено, кроме понятных отказов («удалил организатор», «регистрация закрыта»). | ✅ |
| III. Спецификация до кода | spec → plan → tasks; контракт изменений — `contracts/api.md`; конституция обновлена до 2.0.0 в этой ветке. | ✅ |
| IV. Только дизайн-система | Новые экраны собираются из существующих компонентов (`ds-card`, `ds-list-item`, `ds-notice`, `ds-chat`, `ds-letter`, `ds-sheet--full`, `ds-switch`); новых классов не требуется; при необходимости — токен → компонент → превью → README. Страница `/setup` — серверная, вне мини-приложения (как и раньше). | ✅ |
| V. Бесплатно и без своего сервера | Новые действия — 3–8 запросов к D1; удаление эвента — один batch; миграция без новых сервисов. | ✅ |
| VI. Проверено до выката | e2e на каждую историю + автотест «владелец проходит все действия админа» (FR-1007) + проверка журнала на `budget exceeded`. | ✅ |
| VII. Владелец — максимальные права | Все `admin.*` доступны владельцу; owner-only: роли, владение, перенос, сброс, удаление, служебный просмотр. Ключ `/setup` только формой; ссылка владельца одноразовая; блокировка до смены секрета. Автотест перебирает действия из `src/api.js`. | ✅ |

Нарушений нет — Complexity Tracking пуст.

**Post-design re-check**: дизайн (research R1–R8, data-model, contracts) не вводит новых исключений из принципов;
служебный просмотр — единственное место, где API отдаёт пары не Санте, и оно ограничено владельцем. ✅

## Project Structure

### Documentation (this feature)

```text
specs/010-owner-rights/
├── plan.md              # этот файл
├── research.md          # решения R1–R8
├── data-model.md        # removed_members, events.rejoin, settings.owner_link_used, записи журнала
├── quickstart.md        # как проверить
├── contracts/api.md     # изменения API, бота и /setup
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/0005_owner_rights.sql   # новое: events.rejoin, removed_members, schema 9
src/
├── index.js        # /setup: GET — форма, POST — ключ из формы, блокировка, no-referrer
├── bot.js          # ссылка владельца — одноразовая; отказ «удалил организатор»; заявки при закрытой регистрации
├── api.js          # перенос — владелец; освобождения владельца; admin.vault.*; admin.removed.allow; rejoin в admin.game/state
├── db.js           # REQUIRED_SCHEMA 9; rejoin в EVENT_FIELDS; familyRows/familySnapshot; помощники removed_members
├── events.js       # deleteEvent атомарно; createEvent/resetEvent — rejoin; inviteFromEvent — закрытая регистрация, удалённые
├── pairs.js        # снимок семей в условии записи жеребьёвки; removeMember пишет отметку «удалён»
├── membership.js   # joinByInvite — запрет возврата; decideRequest — закрытая регистрация; семьи — без заморозки для владельца
├── roles.js        # transferAccount переносит отметки «удалён»
├── vault.js        # новое: служебный просмотр владельца (участник, все пары)
└── app.html        # служебный просмотр, «Удалённые» + «Разрешить вернуться», переключатель возврата, честные тексты
tests/
├── harness.mjs     # setup() — POST формы
├── e2e.test.mjs    # блок 010
└── unit.test.mjs   # familySnapshot
```

**Structure Decision**: существующая структура (Worker + мини-приложение); служебный просмотр — отдельный модуль
`src/vault.js`, чтобы единственное место, где пары читаются для не-Санты, было видно и проверяемо.

## Complexity Tracking

Нет нарушений.

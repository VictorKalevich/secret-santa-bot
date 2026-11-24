# Implementation Plan: 052. Открытый бот — свою компанию создаёт каждый

**Branch**: `052-open-bot` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Один код — два бота (`wrangler.toml`); второй получает признак `OPEN_BOT`. В открытом боте человек без ссылки
регистрируется, видит экран «Компании» и создаёт компанию, где становится владельцем (права владельца компании — из 051).
Лимит — две компании во владении, проверяется в пакете записи. Название компании, созданной человеком, общее для её
людей (колонка `companies.shared`, миграция 0016). Владелец удаляет свою пустую компанию. Экран «Компании» доступен в
открытом боте каждому (у кого компания одна — через «‹»), в закрытом — владельцу бота (теперь всегда через «‹», раздел
«Компании» с главного экрана компании убран) и людям с двумя и больше компаниями.

- **Сервер.** `src/companies.js`: `openBot`, `createOwnCompany` (лимит, R3), общее название в `visibleCompanies` и
  `setLabel`, удаление владельцем в `deleteCompany`. Два новых действия API (74 → 76): `company.create`,
  `company.delete` (роль `USER`). `me` — поля `open`, `create`, `shared`/`rename`/`deletable` у компаний (только где
  нужны).
- **Бот.** Незнакомец в открытом боте → просьба имени (047) → меню; текст меню без событий в открытом боте.
- **Приложение.** `withList()`; корневой экран, «‹», шапка; экран «Компании» с созданием для людей, лимитом, шторками
  «Название компании» и удаления; после создания — экран новой компании.
- **Данные.** Миграция `0016_open_bot.sql` (схема 18), `REQUIRED_SCHEMA = 18`.
- **Документы.** README (открытый и закрытый бот, честность), `docs/api.md`, `CLAUDE.md`, Конституция 3.1.0,
  `docs/todo.md` (видимые компании — уже записано).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей; Wrangler 4

**Storage**: Cloudflare D1, схема 18 (`companies.shared`); `REGISTRY` без изменений

**Testing**: `node:test` («мир», `startWorld({ open })`), e2e, Chrome (`tests/screenshots.mjs`: `checkCompanies`,
`checkOpenBot` — второй `wrangler dev` с `--var OPEN_BOT:1`)

**Target Platform**: Telegram Mini App (iOS WebKit, Android, десктоп), Worker на бесплатном тарифе

**Project Type**: веб-сервис (Worker) + мини-приложение без сборщика

**Performance Goals**: `me` — прежнее число запросов; `company.create` — 1 пакет чтений контекста + 1 пакет записи (+1
чтение при отказе); `company.delete` — как `bot.company.delete`

**Constraints**: закрытый бот для всех, кроме владельца бота, — прежние ответы и экраны (эталон отказов, проверки
интерфейса); `atomic` для новых меняющих действий; названия: общее — только людям компании и владельцу бота; дизайн-система;
слова

**Scale/Scope**: 2 новых действия (76), 1 изменённое (`company.label.set`), 1 миграция, правки частей `02-core`,
`03-home`, `04-companies`, `09-start`, Конституция 3.1.0

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Пары, служебный просмотр, статусы — без изменений: создатель — владелец компании (права 051 в своей компании). Новое исключение «названия личные»: общее название компании человека видят её люди и владелец бота; в ответы людям вне компании не попадает — тест перебором ответов и сообщений. README честно: в открытом боте владелец любой компании может открыть её пары, владелец бота — любой компании. | ⚠️ поправка 3.1.0 — см. Complexity Tracking |
| II. Проще некуда для участника | «Регистрация только по пригласительной ссылке» — в открытом боте и без неё (имя одним нажатием, 047). В закрытом боте — без изменений. Путь новичка — 6 действий до ссылки события. | ⚠️ поправка 3.1.0 |
| III. Спецификация до кода | spec → plan → tasks → implement в ветке `052-open-bot`; `docs/api.md`, README, `CLAUDE.md`, Конституция — в той же ветке. | ✅ |
| IV. Только дизайн-система | Новые элементы — из существующих (`ds-list-item`, `ds-btn`, `ds-hint`, `openSheet`, `typedSheet`); новых компонентов нет. | ✅ |
| V. Бесплатно и без сервера | Новые действия — ≤ 4 запроса; `me` не дороже; сообщения — через `outbox`. Лимит 2 компании на человека ограничивает рост данных открытого бота. | ✅ |
| VI. Проверено до выката | `open-bot` (новый), `atomic`, эталон отказов (`NEW_ACTIONS_052`, «052 extra»), `api-table`, `api-doc`, `migrations`, `app-companies`, `queries`, Chrome `checkCompanies`/`checkOpenBot`, e2e. | ✅ |
| VII. Владелец — максимальные права | Владелец бота ⊇ владелец компании ⊇ админ — без изменений (создатель — обычный владелец компании 051). «Создавать и удалять компании — только владелец бота» — в открытом боте создаёт любой (≤ 2 во владении), удаляет свою пустую — её владелец. Остальное «только владельцу бота» (ссылки владельца, «Вести самому», перенос, журнал бота, `/setup`) — прежнее. | ⚠️ поправка 3.1.0 |

## Точечные изменения прежнего поведения

1. Закрытый бот, владелец бота с одной компанией: главный экран со «‹» и названием компании в шапке; раздела «Компании»
   внизу нет; после создания компании — экран новой компании (а не список). Остальные люди закрытого бота — без изменений.
2. `me` владельца бота — новое поле `create: { bot: true }`; у компании с общим названием — `shared`.
3. Эталон отказов: новые ключи «052 …» для `company.create`, `company.delete` (закрытый мир) и «052 extra …» (открытый
   мир); прежние ключи не меняются.
4. `tests/api-table.test.mjs`: 76 действий; слова подтверждения — плюс `company.delete: УДАЛИТЬ`.
5. `tests/app-companies.test.mjs`: правило корневого экрана — через `withList()`; Chrome `checkCompanies` — владелец бота
   создаёт компанию через «‹».

## Project Structure

### Documentation (this feature)

```text
specs/052-open-bot/
├── spec.md
├── plan.md               # этот файл
├── research.md           # решения R1–R12
├── data-model.md         # companies.shared, владение и лимит, название для человека
├── contracts/
│   └── open-bot.md       # признак, API, бот, приложение, журнал, тайна
├── quickstart.md         # проверка и выкат (миграция в обе базы, сначала второй бот)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
migrations/0016_open_bot.sql    # companies.shared, схема 18
wrangler.toml                   # [env.second.vars] OPEN_BOT = "1"
src/
├── db.js               # REQUIRED_SCHEMA = 18; companiesQuery — shared
├── context.js          # companiesFrom — shared
├── companies.js        # openBot, createOwnCompany (лимит), visibleCompanies/companiesView (общее название, rename,
│                       # deletable), setLabel (общее название), deleteCompany (владелец компании), тексты
├── api.js              # company.create, company.delete
├── participant.js      # homeView: open, create; незарегистрированному — open
├── bot.js              # незнакомец в открытом боте; текст меню без событий
└── app/
    ├── 02-core.js.txt      # withList, companyTitle
    ├── 03-home.js.txt      # state.open/create; goBack, syncBack, renderHome — «‹» по withList; без companiesTools
    ├── 04-companies.js.txt # renderCompanies (пусто, создание людьми, лимит), goRoot, companyRow, openLabelSheet,
    │                       # openCreateCompany, openOwnCompanySheet
    └── 09-start.html       # корневой экран; экран «сначала назови себя» в открытом боте
docs/api.md, README.md, CLAUDE.md, .specify/memory/constitution.md (3.1.0)
tests/
├── open-bot.test.mjs   # новый
├── support/world.mjs   # startWorld({ open })
├── harness.mjs         # startWorld({ vars })
├── atomic.test.mjs, api-refusals.test.mjs, support/refusals-scenario.mjs, fixtures/api-refusals.json
├── api-table.test.mjs, migrations.test.mjs, app-companies.test.mjs
└── screenshots.mjs     # checkCompanies (правка), checkOpenBot
package.json            # open-bot.test.mjs в npm test
```

**Structure Decision**: всё о компаниях — в `src/companies.js` и части `04-companies`; открытость читается одной
функцией `openBot(env)`; новых модулей и частей нет.

## Complexity Tracking

| Поправка | Зачем | Почему не проще |
|---|---|---|
| Принцип II: регистрация без ссылки в открытом боте | Запрос владельца: во втором боте человек приходит сам и заводит свою компанию | Без регистрации нельзя стать владельцем компании; ссылку человеку без компании дать некому |
| Принцип VII: компании создаёт не только владелец бота | Тот же запрос; лимит 2 во владении — решение владельца | Через владельца бота (ссылка владельца, 051) — каждый новичок ждал бы владельца бота |
| Принцип I: общее название компании человека | Решение владельца: «название видят все вступившие» | «Компания N» у людей компании, которую назвал её же владелец, только путает |

Поправка Конституции (MINOR 3.1.0) — первая задача; код, открывающий создание людям, сливается только вместе с ней.

# Implementation Plan: Значок у имени и открытка для письма

**Branch**: `038-emoji-postcards` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/038-emoji-postcards/spec.md`

## Summary

Новый модуль без импортов `src/looks.js` — набор значков (`EMOJIS`, 40) и открыток (`POSTCARDS`, 15: `{ id, title }`).
Миграция `0010_looks.sql`: `users.emoji`, `members.card`, схема 13. Действия API: `emoji.set` (USER) и `card.set`
(MEMBER, событие, в завершённом — отказ как у письма); `me` отдаёт `me.emoji` и набор `looks`; значок — в `roster`,
`admin.state` (участники, заявки, удалённые), `admin.users`, `ward.get` (у подопечного); открытка — в `event.get`
(`member.card`), `ward.get`, `admin.wishlist`. Открытка — часть письма в `REGISTRY.members.personal` (перенос и сброс —
вместе с письмом). Дизайн-система: `ds-postcard` (рамка-узор, «бумага», наклейка-эмодзи, 15 тем на токенах, мини-вид),
`ds-choices`/`ds-choice` (сетка выбора). Приложение: «Профиль» — шторка «Значок у имени»; «Письмо» — кнопка «🖼 Открытка:
…», шторка «Открытка для письма», редактор и просмотр на открытке; «Подопечный» — значок внутри скрытого имени, письмо на
открытке; панель — `personTitle` со значком, письмо в шторке на открытке. `docs/todo.md` — «маска Санты», «значок стажа».

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers; мини-приложение — части `src/app/*.js.txt`

**Primary Dependencies**: нет новых

**Storage**: D1 — `users.emoji TEXT NOT NULL DEFAULT ''`, `members.card TEXT NOT NULL DEFAULT ''` (миграция
`0010_looks.sql`, версия схемы 12 → 13)

**Testing**: `npm test` — новый `tests/looks.test.mjs` (сервер, тайна, перенос и сброс, набор ↔ дизайн-система, контраст),
эталон отказов (второй проход новых действий, ключи «038 …»), `migrations` (0010), `secrecy`, `queries`, `api-doc`,
`design-system`; `npm run screenshots` — `checkLooks`, снимки 35–37; `npm run test:e2e`

**Target Platform**: Telegram iOS / Desktop / веб; Worker на бесплатном тарифе

**Project Type**: Cloudflare Worker + мини-приложение Telegram

**Performance Goals**: число запросов к базе у `me`, `event.get`, `ward.get`, `admin.state` — прежнее (новые поля — в
прежних выборках); `emoji.set` и `card.set` — один `UPDATE`

**Constraints**: тайна — значок не в переписке, не в сообщениях бота и не в журнале; у Санты значок подопечного — внутри
скрытого имени; дизайн-система — сырые цвета только в `tokens.css`; CSP — без картинок и внешних адресов (только
градиенты CSS и эмодзи)

**Scale/Scope**: 40 значков, 15 открыток, 2 действия API (всего 63), 1 миграция, 3 компонента дизайн-системы

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Значок — свойство человека (как имя), не пары; в `chat.get`, `message.send`, сообщениях бота, журнале его нет; у Санты значок подопечного скрыт вместе с именем; открытка видна только тем, кто видит письмо; тест `secrecy` (перестановка пар) — прежний; новый тест: ответы подопечному о переписке без значка Санты | ✅ |
| II. Проще некуда | Выбор — шторка с сеткой, одно нажатие; без настроек и загрузок | ✅ |
| III. Спецификация до кода | spec → plan → tasks; `docs/api.md`, README, CLAUDE.md, `docs/todo.md` — в ветке | ✅ |
| IV. Дизайн-система | Токены (`--ds-postcard-*`, размеры) → компоненты `ds-postcard`, `ds-choices`, `ds-choice` → `preview.html` (все 15 тем) → README дизайн-системы; тест: каждая открытка набора ↔ класс, токены, витрина; контраст ≥ 4.5 | ✅ |
| V. Бесплатно | Запросов не больше прежнего (тест `queries`); набор — константа в ответе `me` | ✅ |
| VI. Проверено до выката | Новые тесты падают на прежнем коде; Chrome — `checkLooks`; выкат — миграция до кода (`quickstart.md`) | ✅ |
| VII. Владелец | Новые действия — участника; права организаторов не меняются | ✅ |

Повторная проверка после дизайна — без изменений.

## Project Structure

### Documentation (this feature)

```text
specs/038-emoji-postcards/
├── spec.md
├── plan.md
├── research.md
├── contracts/looks.md   # набор, действия, поля ответов, компоненты, правила приложения
├── quickstart.md        # проверка, выкат (миграция → код), откат
└── tasks.md
```

### Source Code (repository root)

```text
migrations/0010_looks.sql        # users.emoji, members.card, schema 13
src/looks.js                     # EMOJIS, POSTCARDS, validEmoji, validCard (без импортов)
src/db.js                        # REQUIRED_SCHEMA 13; personal: письмо + открытка; emoji в выборках людей
src/api.js                       # emoji.set, card.set
src/participant.js               # homeView (me.emoji, looks), eventView (member.card, roster emoji), wardView, setEmoji, setCard
src/panel.js                     # adminState (emoji), adminWishlist (card), usersList (emoji)
design-system/tokens.css         # --ds-postcard-* (15 тем × рамка, бумага, чернила), размеры
design-system/components.css     # ds-postcard, ds-choices, ds-choice
design-system/preview.html       # витрина: все открытки, сетки выбора
design-system/README.md          # строки компонентов
src/app/02-core.js.txt           # postcard(card, ...content), looksTitle
src/app/03-home.js.txt           # state.looks; «Профиль» — значок, openEmojiSheet; список администраторов
src/app/04-event.js.txt          # «Письмо» — открытка (кнопка, шторка, редактор), «Подопечный» — значок и открытка
src/app/05-admin.js.txt          # personTitle со значком; письмо участника на открытке
docs/api.md, docs/todo.md, README.md, CLAUDE.md
tests/looks.test.mjs             # новый (в скрипт test)
tests/support/refusals-scenario.mjs, tests/api-refusals.test.mjs, tests/fixtures/api-refusals.json  # «038 …»
tests/migrations.test.mjs        # 0010
tests/screenshots.mjs            # checkLooks, снимки 35-emoji, 36-postcards, 37-ward-postcard
```

**Structure Decision**: набор — отдельный модуль без импортов (его читают `participant.js`, `api.js`, тест дизайн-системы);
данные людей — в прежних выборках; компоненты — в дизайн-системе по её порядку.

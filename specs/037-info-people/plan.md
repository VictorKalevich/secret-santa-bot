# Implementation Plan: Список участников на «Инфо»

**Branch**: `037-info-people` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/037-info-people/spec.md`

## Summary

`event.get` отдаёт новое поле `roster`: строки участников (id, имя, роль, @username — только при включённом параметре),
организаторы бота, общий прогресс (письма до жеребьёвки, подарки после — только суммы) и ссылку-приглашение (только при
открытой регистрации в идущем событии). Новый параметр события `contacts_on` (миграция `0009`, схема 12, строка в
`EVENT_PARAMS`: флажок, умолчание 0, копируется из образца). Приложение: в «О событии» — «Организаторы» и
«Автожеребьёвка» вместо «Участников»; под ним — раздел «Участники · N» (строки списка панели в одну линию, свёрнут после
8, нажатие на имя при включённом параметре — вопрос и чат в Telegram), подсказка и «📨 Пригласить друга»; в «Параметрах» —
флажок «Участники могут писать друг другу». Чтения — в том же пакете `event.get` (число запросов прежнее).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers; мини-приложение — части `src/app/*.js.txt`

**Primary Dependencies**: нет новых (Telegram Bot API / Mini Apps SDK, D1)

**Storage**: D1 — колонка `events.contacts_on INTEGER NOT NULL DEFAULT 0` (миграция `0009_contacts.sql`, версия схемы
11 → 12)

**Testing**: `npm test` (новый `tests/roster.test.mjs`; `secrecy`, `server-shape`, `queries`, `migrations`,
`app-ui` — прежние правила по-новому покрывают поля), `npm run screenshots` (`checkInfoPeople`), `npm run test:e2e`

**Target Platform**: Telegram iOS / Desktop / веб; Worker на бесплатном тарифе

**Project Type**: Cloudflare Worker + мини-приложение Telegram

**Performance Goals**: `event.get` — прежнее число запросов к базе (4): новые чтения в том же пакете `ctx.read`;
сортировка ≤ 200 строк на сервере

**Constraints**: тайна (только имена, роли, суммы); @username — только при `contacts_on`; дизайн-система без новых
элементов; CSP — новых адресов нет (чат и пересылка — `openTelegramLink`, как «📤 Отправить в чат»)

**Scale/Scope**: до 200 участников в событии; 1 миграция, 1 параметр, 1 поле ответа, 1 раздел приложения

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | В `roster` — имена, роли, @username (по решению организатора), суммы «готово / получено» и «писем написано»; перестановка пар сумм не меняет (тест `secrecy` сравнивает `event.get` побайтно); отметок по людям, адресов, семей, исключений и пар нет; порядок — по имени | ✅ |
| II. Проще некуда | Состав события и приглашение друга — на «Инфо», без обращения к организатору | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке; `docs/api.md`, README, CLAUDE.md — в той же ветке | ✅ |
| IV. Дизайн-система | Строка — `ds-list-item` с `ds-list-item__title`, `ds-chip`, `ds-list-item--link` + `ds-list-item__chevron` (есть); новых компонентов нет | ✅ |
| V. Бесплатно | Чтения — в пакете `event.get` (запросов прежнее число, тест `queries`); сортировка до 200 строк | ✅ |
| VI. Проверено до выката | Новые тесты падают на прежнем коде; Chrome — `checkInfoPeople`; выкат — миграция до кода (`quickstart.md`) | ✅ |
| VII. Владелец | Параметр меняет любой организатор (как остальные параметры); владелец ⊇ админ — без изменений | ✅ |

Повторная проверка после дизайна — без изменений.

## Project Structure

### Documentation (this feature)

```text
specs/037-info-people/
├── spec.md
├── plan.md
├── research.md
├── contracts/info-people.md   # поле roster, параметр, правила раздела «Участники»
├── quickstart.md              # проверка, выкат (миграция → код), откат
└── tasks.md
```

### Source Code (repository root)

```text
migrations/0009_contacts.sql     # events.contacts_on, schema 12
src/db.js                        # REQUIRED_SCHEMA 12; peopleQuery, giftTotalsQuery (вместо participantCountQuery)
src/event-params.js              # contacts_on: flag, 0, template
src/status.js                    # publicEvent: contacts_on, draw_auto_date
src/panel.js                     # settings без повтора draw_auto_date (он в publicEvent)
src/participant.js               # eventView: roster (rosterView — чистая функция)
src/app/02-core.js.txt           # shareInvite(link, title) — общий для панели и «Инфо»
src/app/03-home.js.txt           # state.roster, state.rosterOpen; reloadEvent берёт roster
src/app/04-event.js.txt          # «О событии» (Организаторы, Автожеребьёвка), peopleSection
src/app/05-admin.js.txt          # флажок contacts_on в «Параметрах»; «Отправить в чат» через shareInvite
docs/api.md                      # event.get roster, admin.game contacts_on, admin.state
tests/roster.test.mjs            # новый (в скрипт test)
tests/migrations.test.mjs        # 0009: колонка, умолчание, строки не меняются
tests/screenshots.mjs            # checkInfoPeople, снимок 34-info-people
README.md, CLAUDE.md
```

**Structure Decision**: сервер — `participant.js` (данные экрана участника), чтения — построители в `db.js`; приложение —
часть `04-event` (вкладка «Инфо»), параметр — `05-admin` («Параметры»), общая пересылка — `02-core`.

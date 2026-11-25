# План 064: тексты и упрощение

**Branch**: `064-texts-cleanup` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Summary

Список правок владельца — одной фичей (`research.md` R1):

1. **Завершение** — событие с датой вручения завершается само на D+3 (`dueAutoAction` не читает `finish_auto`); правила
   «брошенных» событий (`src/stale.js`) — в обоих ботах и только для событий без даты: Г (никто не вступил) — 23 + 7 дней,
   Б — 53 + 7 дней (было 113); правило А («дата прошла 7 дней») убрано (R2, R3). Кнопки «Завершить» и галочки нет.
2. **Адрес, отправка, отметки подарка, напоминания Сантам** — действия `delivery.save`, `ward.gift`, `ward.received`,
   `ward.shipment`, `admin.remind.santas` уходят (путь неизвестного действия), модуль `src/shipment.js` и его словари —
   тоже; поля адреса, отметок и отправки уходят из ответов (`event.get`, `ward.get`, `admin.state`, `admin.vault.person`);
   cron не напоминает Сантам; уведомление о правке письма — один текст (R4, R5).
3. **Участники на «Инфо»** — @username всегда (`rosterView` не читает `contacts_on`), сводка после жеребьёвки не
   отдаётся (`giftTotalsQuery` не читается), в приложении — полный список без нажатия (R6).
4. **Параметры** `delivery_on`, `contacts_on`, `finish_auto` → `EVENT_RETIRED` (колонки остаются ради отката, R7).
5. **Тексты** — по таблице `contracts/texts.md` на 11 языках; ненужные ключи удаляются (R8, R9).
6. **Ссылка при закрытой регистрации** — `disabled` у поля (новое состояние `.ds-input:disabled`, дизайн-система 1.11.0) и
   скрытый ряд кнопок, обновление по `p.watch('registration_open')` (R10).

Схема прежняя (24), миграции нет. Действий API — 64 (было 69). Конституция 5.1.0 (принцип I и «Безопасность и данные»).

## Technical Context

**Language/Version**: JavaScript ES2022 (Cloudflare Worker), SQL SQLite (D1)
**Primary Dependencies**: нет новых
**Storage**: D1 — без миграции; колонки `members.delivery*`, `pairs.gift_*`, `sent_date`, `carrier`, `tracking`,
`shipment_version`, `events.delivery_on`, `contacts_on`, `finish_auto` остаются ради отката (код их не пишет, кроме
каскадов `REGISTRY` — перенос, сброс, удаление)
**Testing**: `node:test` на `node:sqlite` («мир»): новый `tests/texts-cleanup.test.mjs` (вместо удаляемого
`shipment.test.mjs` с `support/shipment-world.mjs`), правки `auto-finish`, `roster`, `secrecy`, `atomic`, `queries`
(+`support/queries-scenario.mjs`), `api-refusals` (эталон — без ответов удалённых действий), `cron-marks`, `cron-reads`,
`i18n-lang`, `i18n-languages`, `swap`, `data-registry`, `migrations`, `server-shape`, `rights`, `api-doc`, `donate`,
`app-*`, `design-system`, `e2e`; Chrome — `tests/screenshots.mjs` (сценарии адреса, отметок и контактов), `shipment.ui.mjs`
удаляется
**Target Platform**: Cloudflare Workers Free, мини-приложение Telegram (iOS/Android/ПК), оба бота
**Project Type**: Telegram-бот + мини-приложение (один Worker)
**Performance Goals**: не хуже прежнего: «Инфо» после жеребьёвки — на одно чтение меньше; cron обычной минуты — 3 запроса
**Constraints**: ≤ 50 внешних запросов и ≤ 10 мс CPU на вызов; тексты — только в словарях 11 языков; дизайн-система
**Scale/Scope**: обе базы; 23 текста меняются, ~70 ключей удаляются из каждого языка

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Ответы теряют поля, новых нет. @username на «Инфо» всегда (решение владельца): имя подопечного Санта знает и так; Санта, написавший сам, раскрывает себя сам — тайна пар в ответах не меняется (тест `secrecy`: перестановка пар не меняет ответы организаторам). Принцип I правится: из статусов администратора убираются «подарок готов», «получен ли подарок», «указан ли адрес», пункт об адресе — история | ✅ (5.1.0) |
| II. Проще некуда | Меньше подсказок и полей; язык — 11 словарей, слова подтверждения прежние | ✅ |
| III. Спецификация до кода | spec/plan/tasks в `specs/064-texts-cleanup/`, `docs/api.md` в той же ветке | ✅ |
| IV. Дизайн-система | Новое состояние `.ds-input:disabled` — компонент → витрина → README (1.11.0); остальное — существующие классы | ✅ |
| V. Бесплатный тариф | Чтений меньше (`giftTotalsQuery`, `has_delivery`); cron — те же 3 запроса в обычную минуту; ежедневный шаг в закрытом боте считает `outsiders` только у кандидатов Г (как в открытом) | ✅ |
| VI. Проверено до выката | `npm test`, e2e, Chrome-проверки; quickstart — выкат обоих ботов и проверка на iPhone | ✅ |
| VII. Владелец — максимум | Права не меняются; `admin.event.finish`, `admin.reset.full` остаются в API (кнопок нет); `admin.remind.santas` уходит у всех ролей | ✅ |
| Безопасность и данные | Адрес больше не собирается и не отдаётся; хранимые прежние данные — ради отката (`docs/todo.md`) | ✅ (5.1.0) |

После дизайна (Phase 1) — без изменений: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/064-texts-cleanup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── texts.md      # тексты: изменить, удалить (ключи словаря, русский образец)
│   └── removal.md    # сервер и API: действия, поля ответов, cron, автозавершение
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── api.js              # −5 действий, импорты
├── participant.js      # eventView/wardView/rosterView без адреса, отметок, отправки; −saveDelivery, −setGift*
├── shipment.js         # удаляется
├── panel.js            # admin.state без отметок, адреса, finish_auto/delivery_on/contacts_on
├── vault.js            # без gift_sent и адреса
├── events.js           # −remindSantas; createEvent без копирования адреса
├── db.js               # вступление без копирования адреса; panelMembersQuery без has_delivery; −giftTotalsQuery
├── cron.js             # уведомление одним текстом; без напоминаний Сантам; dueAutoAction без finish_auto; stale в обоих ботах
├── stale.js            # только «без даты»: Г 23, Б 53; dailyEventsQuery без признака открытого бота
├── status.js           # publicEvent без delivery_on, contacts_on
├── event-params.js     # delivery_on, contacts_on, finish_auto → EVENT_RETIRED
├── i18n/<11 языков>/   # тексты по contracts/texts.md; shipment.js удаляется (AREAS)
└── app/                # 03-home (шторка создания, rosterOpen), 04-settings, 05-event, 06-admin, 07-vault-audit, 09-start
design-system/          # .ds-input:disabled, витрина, README 1.11.0
tests/                  # см. Technical Context
docs/api.md, docs/todo.md, README.md, CLAUDE.md, .specify/memory/constitution.md
```

**Structure Decision**: прежняя структура одного Worker; новый тест `tests/texts-cleanup.test.mjs` — в скрипт `test`.

## Complexity Tracking

Нарушений Конституции нет.

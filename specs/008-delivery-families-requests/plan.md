# Implementation Plan: Адрес доставки, семьи и заявки на вступление

**Branch**: `008-delivery-families-requests` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

## Summary

Миграция `0004_delivery_families_requests.sql` добавляет:
- в `members` — `delivery`, `delivery_updated_at`;
- в `events` — `delivery_on`, `families_on`, `approval`;
- таблицы `families`, `family_members` (человек — не больше одной семьи) и `join_requests`.

Изменения:
- адрес сохраняется действием `delivery.save`, отдаётся только в `event.get` (самому) и `ward.get` (Санте);
  админу — только `has_delivery`; отложенное уведомление Санте учитывает и адрес;
- семьи — общие для бота (`admin.families`, `admin.family.save`, `admin.family.delete`); при `families_on` пары внутри
  семьи добавляются к исключениям в жеребьёвке, проверке и заменах;
- заявки: при `approval` переход по ссылке создаёт заявку вместо участия; админы решают кнопками в чате
  (`req:<id>:a|r`) или в панели (`admin.request.decide`); решение атомарно;
- журнал 007 пополняется кодами `family.save`, `family.delete`, `request.approve`, `request.reject`.

Решения — [research.md](./research.md), данные — [data-model.md](./data-model.md), API — [contracts/api.md](./contracts/api.md).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers · **Primary Dependencies**: без новых

**Storage**: D1, миграция `0004`, схема 8 (`REQUIRED_SCHEMA = 8`)

**Testing**:
- e2e: адрес (виден Санте, не виден админу ни в одном ответе, предзаполнение, уведомление), семьи (20 жеребьёвок,
  выключатель, замены, перенос, «уже в семье», понятная причина), заявки (заявка, принять/отклонить из чата и панели,
  повторное нажатие, повторная заявка);
- скриншоты: «Письмо» с адресом, «Подопечный» с адресом, «Семьи», заявки в панели.

**Target Platform**: Cloudflare Workers (бесплатный тариф) + Telegram Mini App · **Project Type**: web-service

**Performance Goals / Constraints**: ≤ 10 мс CPU, ≤ 50 запросов на вызов. Семьи — один дополнительный запрос к D1 на
жеребьёвку/замену. Повторный поиск «без семей» для объяснения причины — только при неудаче и в пределах бюджета
шагов жеребьёвки.

**Scale/Scope**: до 50 участников, единицы семей, десятки заявок в год.

## Constitution Check (1.3.0)

| Принцип | Как соблюдается | Статус |
|---|---|---|
| I. Тайна | Адрес — только участнику и его Санте (`ward.get`); админу — `has_delivery`; «Открыть письмо» адрес не отдаёт; журнал и уведомления без адреса. Семьи и заявки пар не касаются | ✅ |
| II. Проще некуда | Участнику — одно поле, только если эвент его спрашивает; заявка — тот же переход по ссылке | ✅ |
| III. Спецификация до кода | `specs/008-delivery-families-requests/` | ✅ |
| IV. Дизайн-система | Существующие `ds-card`, `ds-field`, `ds-input`, `ds-check`, `ds-list-item`, `ds-chip`, `ds-switch`, шторка | ✅ |
| V. Бесплатно | Уведомления админам о заявках и решения — через `outbox` | ✅ |
| VI. Проверено | e2e на каждую историю и на отсутствие адреса в ответах админу | ✅ |
| Безопасность и данные | Список хранимых данных дополнен (поправка 1.3.0) | ✅ |
| Процесс: README | Задача T822 | ✅ |

## Project Structure

```text
migrations/0004_delivery_families_requests.sql
src/db.js        # REQUIRED_SCHEMA = 8; EVENT_FIELDS; addMemberStmt с предзаполнением адреса; familyExclusions
src/game.js      # семьи в checkDraw/removeMember/insertMember; заявки (requestJoin, decideRequest); перенос; сброс/удаление
src/api.js       # delivery.save; поля event.get/ward.get/admin.state; admin.families/family.save/family.delete;
                 # admin.request.decide; admin.game: delivery_on, families_on, approval
src/bot.js       # вступление по ссылке с одобрением; кнопки решения req:<id>:a|r
src/cron.js      # уведомление Санте учитывает изменение адреса
src/app.html     # «Письмо»: адрес; «Подопечный»: адрес; «Админ»: заявки, параметры, семьи в исключениях, метка адреса;
                 # главный экран: раздел «Семьи»
tests/e2e.test.mjs, tests/screenshots.mjs, tests/draw.test.mjs (без изменений)
README.md, CLAUDE.md, .specify/memory/constitution.md (1.3.0)
```

## Complexity Tracking

Нарушений нет.

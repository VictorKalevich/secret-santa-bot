# Implementation Plan: Инструменты организатора

**Branch**: `007-admin-tools` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

## Summary

Миграция `0003_admin_tools.sql` добавляет:
- таблицы `announcements` и `audit`;
- в `events` — поля расписания (`draw_auto_date`, `reveal_auto`, `finish_auto`);
- в `pairs` — `gift_received`, `gift_received_at`.

Новые действия API:
- `admin.announce`, `admin.draw.cancel`, `admin.audit`;
- `ward.received`;
- образец в `admin.events.create`;
- новые поля в `admin.game` и `admin.state`.

Ежедневный cron выполняет автодействия. Каждое действие админа и бота пишется в журнал через `auditStmt` в том же batch,
что и само действие. В интерфейсе всё собирается из существующих компонентов дизайн-системы. Решения —
[research.md](./research.md), данные — [data-model.md](./data-model.md), API — [contracts/api.md](./contracts/api.md).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers · **Primary Dependencies**: без новых

**Storage**: D1, миграция `0003`, схема 7 (`REQUIRED_SCHEMA = 7`)

**Testing**:
- e2e: объявление, автодействия (перемотка дат через SQL), «получил», «не открыл», образец, отмена жеребьёвки, журнал,
  отсутствие пар в ответах;
- скриншоты: «Инфо» с объявлениями, «Письмо» с отметкой, журнал.

**Target Platform**: Cloudflare Workers (бесплатный тариф) + Telegram Mini App · **Project Type**: web-service

**Performance Goals / Constraints**:
- ≤ 10 мс CPU;
- ≤ 50 запросов на вызов: ежедневный cron делает автодействия максимум для одного эвента за вызов. Если эвентов с
  наступившими действиями больше, остальные — в следующую минуту: `last_daily` ставится только обработанному.

**Scale/Scope**: до 50 участников в эвенте, журнал — сотни записей в год.

## Constitution Check

| Принцип | Как соблюдается | Статус |
|---|---|---|
| I. Тайна | Новые поля админа — по человеку, без пар: «получил» (как подопечный), «не открыл» (как Санта). Уведомление Санте — без имени. Журнал — без пар и текстов писем; просмотр письма админом теперь виден всем админам | ✅ |
| II. Проще некуда | Для участника — одна отметка и блок объявлений. Организатору — меньше ручных шагов | ✅ |
| III. Спецификация до кода | `specs/007-admin-tools/` | ✅ |
| IV. Дизайн-система | Только существующие компоненты: `ds-card`, `ds-list-item`, `ds-chip`, `ds-switch`, `ds-field`, `ds-input`, `ds-notice`, шторка | ✅ |
| V. Бесплатно | Рассылки через `outbox`, автодействия cron — по одному эвенту за вызов | ✅ |
| VI. Проверено | e2e на каждую историю и на отсутствие пар в ответах | ✅ |
| Процесс: README | Задача T720 | ✅ |

## Project Structure

```text
migrations/0003_admin_tools.sql
src/db.js        # REQUIRED_SCHEMA = 7; поля событий; auditStmt
src/game.js      # announce, cancelDraw, autoActions, received, createEvent(from), записи журнала в действиях
src/api.js       # новые действия, поля state/event.get, журнал во всех admin-действиях
src/cron.js      # автодействия в ежедневном проходе
src/bot.js       # журнал для ссылки владельца
src/app.html     # «Инфо»: объявления; «Письмо»: «получил»; «Админ»: объявление, расписание, отмена, отметки, журнал;
                 # новый эвент по образцу; общий журнал в «Администраторы»
tests/e2e.test.mjs, tests/screenshots.mjs
README.md, CLAUDE.md
```

## Complexity Tracking

Нарушений нет.

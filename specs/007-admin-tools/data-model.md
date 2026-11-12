# Data Model: 007-admin-tools

Миграция `0003_admin_tools.sql`, схема `7`.

## Новые таблицы

**announcements** — объявления эвента

| Поле | Тип | Смысл |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `event_id` | INTEGER NOT NULL | эвент |
| `author` | INTEGER NOT NULL | Telegram ID админа |
| `text` | TEXT NOT NULL | 1–2000 символов |
| `created_at` | INTEGER NOT NULL | мс |

Индекс `announcements_event (event_id, id)`. Удаляются вместе с эвентом (удаление и сброс).

**audit** — журнал действий

| Поле | Тип | Смысл |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `event_id` | INTEGER NOT NULL DEFAULT 0 | эвент; `0` — общее действие (роли, перенос, удаление эвента) |
| `actor` | INTEGER NOT NULL DEFAULT 0 | Telegram ID админа; `0` — бот |
| `action` | TEXT NOT NULL | код действия (`draw`, `draw.cancel`, `announce`, `wishlist.view`, …) |
| `details` | TEXT NOT NULL DEFAULT '' | человекочитаемое пояснение без пар и текстов писем |
| `created_at` | INTEGER NOT NULL | мс |

Индекс `audit_event (event_id, id)`. Записи не удаляются при сбросе и удалении эвента.

## Новые поля

| Таблица | Поле | Тип / по умолчанию | Смысл |
|---|---|---|---|
| `events` | `draw_auto_date` | TEXT '' | `YYYY-MM-DD` — автожеребьёвка; `''` — выкл |
| `events` | `reveal_auto` | INTEGER 0 | раскрыть на следующий день после `event_date` |
| `events` | `finish_auto` | INTEGER 0 | завершить через 3 дня после `event_date` |
| `pairs` | `gift_received` | INTEGER 0 | подопечный отметил «получил» |
| `pairs` | `gift_received_at` | INTEGER 0 | время первой отметки (для «уведомить Санту один раз») |

## Правила

- `draw_auto_date` меняется только до жеребьёвки; неудачная автожеребьёвка обнуляет его.
- Сброс эвента (004/005) обнуляет поля расписания и удаляет объявления; журнал сохраняется.
- Образец копирует `budget`, `place`, `notes`, `ring`, `avoid_previous`, `reveal_auto`, `finish_auto` и строки
  `exclusions`.

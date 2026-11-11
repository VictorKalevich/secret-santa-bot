# Data Model: Telegram-бот «Тайный Санта»

База: Cloudflare D1 (SQLite). Схема создаётся автоматически (`src/db.js → ensureSchema`). Время — Unix ms.

## users — участники и администраторы

| Поле | Тип | Описание / правила |
|---|---|---|
| `tg_id` | INTEGER PK | Telegram ID |
| `name` | TEXT | Имя для Санты и админа, 1–40 символов (FR-003) |
| `username` | TEXT | Ник Telegram без `@`, может быть пустым |
| `is_admin` | 0/1 | Выдаётся по ссылке администратора (FR-004) |
| `is_participant` | 0/1 | Участвует в жеребьёвке (FR-005) |
| `registered` | 0/1 | Имя введено, регистрация завершена |
| `wishlist` | TEXT | Письмо Санте: ≤ 1000 слов и ≤ 15 000 символов (FR-007) |
| `wishlist_updated_at` | INTEGER | Время последнего изменения письма |
| `notify_mode` | TEXT | `sound` / `silent` / `off` (FR-020) |
| `pending` | TEXT | Ожидаемый ввод в чате: `''` / `name` / `msg_ward` / `msg_santa` |
| `created_at` | INTEGER | Время первого обращения |

**Состояния**: `new (pending=name)` → `registered` → (`in draw` — есть строка в `pairs` как santa) → удалён.
«Не в жеребьёвке» = `registered && is_participant` и нет строки в `pairs` после жеребьёвки.

## exclusions — исключения

| Поле | Тип | Описание |
|---|---|---|
| `giver` | INTEGER | Кто дарит |
| `receiver` | INTEGER | Кому не может дарить |

PK (`giver`, `receiver`). Взаимное исключение = две строки. Удаляются вместе с участником.

## pairs — результат жеребьёвки

| Поле | Тип | Описание |
|---|---|---|
| `santa` | INTEGER PK | Санта |
| `ward` | INTEGER UNIQUE | Подопечный |
| `seen_text` | TEXT NULL | Версия письма, которую Санта видел последней; NULL — ещё не открывал (FR-017) |
| `notified_at` | INTEGER | `wishlist_updated_at` подопечного на момент последнего уведомления (FR-018) |
| `gift_ready` | 0/1 | «Подарок готов» (FR-028) |

**Инварианты**: каждый участник жеребьёвки ровно один раз `santa` и ровно один раз `ward`; `santa ≠ ward`;
нет пары из `exclusions`. При смене подопечного строка пересоздаётся (`seen_text = NULL`, `gift_ready = 0`).
**Доступ**: читать пару может только сам Санта (`ward.get`); админ получает лишь признаки `in_draw` и `gift_ready`.

## history — пары прошлой игры

`santa`, `ward`. Заполняется при «Новой игре», используется как мягкие исключения, если включено
`avoid_previous` (FR-013).

## settings — параметры игры (ключ-значение)

| Ключ | Значение |
|---|---|
| `invite_code` | код пригласительной ссылки `t.me/<bot>?start=inv_<code>` |
| `registration_open` | `'1'` / `'0'` (по умолчанию открыта) |
| `draw_done`, `draw_at` | жеребьёвка проведена и когда |
| `revealed` | Санты раскрыты |
| `avoid_previous` | не повторять прошлые пары (по умолчанию `'1'`) |
| `budget`, `place`, `notes` | текст, видят все |
| `event_date`, `deadline` | дата `YYYY-MM-DD` |
| `bot_username`, `base_url` | заполняются на `/setup` |
| `last_daily` | дата последних ежедневных напоминаний (Минск) |

## outbox — очередь исходящих сообщений

`id` (PK, autoincrement), `chat_id`, `payload` (JSON параметров `sendMessage`), `created_at`.
Забирается атомарно `DELETE … RETURNING` пачками; повтор при 429 и сетевых ошибках; сброс при 400/403 и старше 2 суток.

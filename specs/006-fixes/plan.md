# Implementation Plan: Исправления по ревью и миграции базы

**Branch**: `006-fixes` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

## Summary

Закрываем найденные при ревью баги:
- перенос участия на аккаунт администратора, через который админ мог получить чужие пары;
- длинный заголовок уведомления переписки;
- выход жеребьёвки за лимит CPU;
- гонка двойной жеребьёвки;
- молчаливая блокировка бота участником;
- мелочи: повторное раскрытие, удаление не-участника, исключения, переименование админов, надёжность очереди.

Схему базы переводим на миграции D1 (`migrations/`): код только проверяет номер схемы и больше не создаёт и не удаляет
таблицы. Решения описаны в [research.md](./research.md), данные — в [data-model.md](./data-model.md), изменения API —
в [contracts/api-changes.md](./contracts/api-changes.md).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers (workerd).

**Primary Dependencies**: новых нет. Wrangler 4 — `d1 migrations apply`, `d1 export`.

**Storage**: D1. Миграции:
- `0001_initial.sql` — схема 005, `IF NOT EXISTS`;
- `0002_fixes.sql` — `users.blocked_at`, `outbox.locked_until`, `events.draw_token`, индекс очереди, схема `6`.

**Testing**:
- юнит: `draw` — бюджет вычислений, замер ≤ 10 мс для 50 участников, качество на типичных наборах;
- e2e: перенос, длинный заголовок, двойная жеребьёвка, отметка блокировки, мелочи, миграция с базы 005;
- `tests/harness.mjs` применяет миграции перед `wrangler dev`.

**Target Platform**: Cloudflare Workers, бесплатный тариф; Telegram Bot API и Mini Apps.

**Project Type**: web-service (Worker) + мини-приложение.

**Performance Goals**: проверка или проведение жеребьёвки ≤ 10 мс CPU для любого набора ограничений до 50 участников.

**Constraints**:
- ≤ 50 внешних запросов на вызов;
- `flushOutbox` делает 3 запроса к D1 плюс до 35 отправок;
- в Workers `Date.now()` не идёт во время вычислений, поэтому бюджет жеребьёвки считается в шагах, а не во времени.

**Scale/Scope**: небольшая группа (до 50 человек в эвенте), правки в 7 файлах `src/` и 3 тестовых.

## Constitution Check

| Принцип | Как соблюдается | Статус |
|---|---|---|
| I. Тайна | Закрыта единственная найденная лазейка: перенос на аккаунт админа запрещён, перенос виден прежнему аккаунту и всем админам. Отметка «не получает сообщения» пар не раскрывает | ✅ |
| II. Проще некуда | Для участника ничего не меняется. Админ видит понятные отказы вместо ошибок сервера | ✅ |
| III. Спецификация до кода | `specs/006-fixes/`. Контракт 005 обновляется в местах изменений | ✅ |
| IV. Дизайн-система | Отметка «не получает сообщения» — существующая метка `ds-chip--warning`; новых классов нет | ✅ |
| V. Бесплатно | CPU жеребьёвки ограничен бюджетом; очередь не превышает лимит запросов; миграции — штатный инструмент Wrangler | ✅ |
| VI. Проверено | Юнит-замер CPU, e2e каждого бага, e2e миграции с базы 005 | ✅ |
| Безопасность и данные | Миграции никогда не удаляют данные; README описывает резервную копию | ✅ |
| Процесс: README | Отдельная задача в `tasks.md` (миграции, обновление бота, резервная копия) | ✅ |

Повторная проверка после дизайна: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/006-fixes/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api-changes.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
migrations/0001_initial.sql   # схема 005 (IF NOT EXISTS)
migrations/0002_fixes.sql     # blocked_at, locked_until, draw_token, индекс outbox, схема 6
wrangler.toml                 # migrations_dir
src/db.js                     # checkSchema вместо ensureSchema; blocked_at в eventMembers; SchemaError
src/index.js                  # понятный ответ при неготовой базе; cron молча пропускает
src/draw.js                   # матрица допустимости, общий бюджет шагов, тип проблемы search_exhausted
src/game.js                   # атомарная жеребьёвка, очередь с захватом, отметка блокировки, заголовок переписки,
                              # перенос (запреты, уведомления), раскрытие один раз
src/api.js                    # transfer, rename, remove, exclusion.add, reveal; снятие отметки; blocked в admin.state
src/bot.js                    # снятие отметки при сообщении или нажатии
src/app.html                  # отметка «не получает сообщения» в списке участников
tests/draw.test.mjs           # бюджет и замер
tests/harness.mjs             # применение миграций
tests/mock-telegram.mjs       # 400 «message is too long» для текста > 4096
tests/e2e.test.mjs            # сценарии 006
README.md, CLAUDE.md          # миграции, обновление, резервная копия
```

**Structure Decision**: структура проекта прежняя, добавляется только папка `migrations/`.

## Complexity Tracking

Нарушений нет.

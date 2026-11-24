# План 057: минутная проверка по отметкам

**Branch**: `057-cron-marks` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Пункты 1 и 3 «Важного» `docs/todo.md` одной фичей (группировка пунктов — `research.md` R1, замеры — R2). Минутная
проверка перестаёт перебирать идущие события и их пары:

1. **Уведомление «обновил письмо»** — по отметке участника `members.notify_at` (время правки, ждущей уведомления; индекс
   только по отмеченным). Ставят три записи письма и адреса, если у участника есть Санта (`NOTIFY_MARK`,
   `src/participant.js`). Минутная проверка начинает с отметок старше задержки, решает «слать ли» по прежнему правилу и
   снимает отметку условно (если не было новой правки).
2. **Ежедневный шаг** — по отметке события `events.checked_on` (местная дата «на сегодня проверено»; индекс по идущим).
   Ставится вместе с прежней `last_daily`; снимают сохранение параметров, жеребьёвка и полный сброс — автодействие,
   заданное после проверки, выполняется в следующую минуту, как раньше; `last_daily` не снимается — напоминание не
   повторяется.

Технически:

1. Миграция `0020_cron_marks.sql`: две колонки, два частичных индекса, отметки уже ждущих правок, схема 20
   (`REQUIRED_SCHEMA`); в обе базы до выката кода. Сверка `tools/notify-reconcile.sql` — тот же `UPDATE`, после выката.
2. `src/participant.js`: `NOTIFY_MARK` в `saveWishlist`, `writeLetterDraft` (публикация изменённого), `saveDelivery`;
   публикация неизменённого — только снятие черновика.
3. `src/cron.js`: `notifyWishlistChanges` — запрос от `members` по `members_notify`, снятие отметок; `dailyStep` —
   `checked_on` вместе с `last_daily` (тихие, снятые, напоминание), события с `last_daily` = сегодня без автодействия —
   в тот же `UPDATE`. `src/stale.js`: `dailyEventsQuery` — `checked_on < ?2`; `warnStale` — `checked_on` в захвате.
4. Снятие `checked_on`: `saveEventSettings` (`src/events.js`), захват `runDraw` (`src/pairs.js`),
   `EVENT_STATE_RESET.checked_on = ''` (`src/event-params.js`).
5. `src/db.js`: `REQUIRED_SCHEMA = 20`; `REGISTRY.members.notify = 'notify_at'` — сброс обнуляет
   (`eventDataDeleteStmts`), слияние ставит (`mergeMembership`, поля `personTransferStmts`).

Обычная минута — 3 запроса, ни одной строки событий, пар, участников и людей.

## Technical Context

**Language/Version**: JavaScript ES2022 (Cloudflare Worker), SQL SQLite (D1)
**Primary Dependencies**: нет новых
**Storage**: D1 — `members.notify_at`, `events.checked_on`, индексы `members_notify`, `events_unchecked` (миграция `0020`,
схема 20)
**Testing**: `node:test` на `node:sqlite` («мир»): новый `tests/cron-marks.test.mjs` (поведение, отметки, «от
противного», статическое правило `NOTIFY_MARK`), `cron-reads` (планы — по новым индексам, `events_active` больше не
допускается к просмотру), `migrations` (0020, сверка), `auto-finish` (перемотка снимает и `checked_on`), прежние
`queries`, `server-shape`, `data-registry`, `api-reads`; e2e — прежний
**Target Platform**: Cloudflare Workers Free, cron раз в минуту, оба бота
**Project Type**: Telegram-бот + мини-приложение (один Worker)
**Performance Goals**: обычная минута — 3 запроса и 0 строк событий, пар, участников, людей; событие — 1 чтение в сутки
ежедневным шагом; участник — строки только при правках
**Constraints**: ≤ 50 внешних запросов и ≤ 10 мс CPU на вызов; записи — не больше пары строк индекса на правку и на
событие в сутки
**Scale/Scope**: открытый бот — тысячи людей и событий; закрытый — десятки

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Тексты, получатели и кнопки уведомлений прежние (без имени подопечного и текста письма). Отметки — время и дата, без людей и текстов; ответы API не меняются. | ✅ |
| II. Проще некуда | Для людей ничего не меняется. | ✅ |
| III. Спецификация до кода | `specs/057-cron-marks/`, строка в `CLAUDE.md`, `docs/todo.md`. | ✅ |
| IV. Дизайн-система | Приложение не меняется. | ✅ |
| V. Бесплатно | Цель фичи — расход чтений D1 перестаёт расти с числом людей и событий; обычная минута — те же 3 запроса; записи растут на строку индекса. | ✅ |
| VI. Проверено до выката | Тесты поведения и планов с «от противного», миграция на базе с данными, сверка, `npm run test:all`; выкат и откат — `quickstart.md`. | ✅ |
| VII. Владелец | Права не меняются. | ✅ |
| Безопасность и данные | Новые колонки — служебные (время, дата); `REGISTRY` описывает, что с отметкой при сбросе, слиянии и переносе. | ✅ |
| Процесс | README (обновление бота: миграция 0020 и сверка в обе базы) — отдельная задача. | ✅ |

Пост-дизайн: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/057-cron-marks/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/cron-marks.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
migrations/0020_cron_marks.sql   # колонки, индексы, отметки ждущих правок, схема 20
tools/notify-reconcile.sql       # сверка после выката — тот же UPDATE
src/db.js                        # REQUIRED_SCHEMA = 20; REGISTRY.members.notify; сброс и слияние
src/event-params.js              # EVENT_STATE_RESET.checked_on = ''
src/participant.js               # NOTIFY_MARK в записи письма и адреса
src/cron.js                      # уведомления по отметкам; checked_on в ежедневном шаге
src/stale.js                     # dailyEventsQuery: checked_on < сегодня; warnStale: checked_on
src/events.js                    # saveEventSettings: checked_on = ''
src/pairs.js                     # runDraw: checked_on = '' в захвате
docs/api.md                      # раздел cron
tests/cron-marks.test.mjs        # новый (в скрипт test)
tests/cron-reads.test.mjs        # планы по новым индексам
tests/migrations.test.mjs        # 0020, сверка
tests/auto-finish.test.mjs       # перемотка — и checked_on
README.md, CLAUDE.md, docs/todo.md
```

## Complexity Tracking

Нет отступлений.

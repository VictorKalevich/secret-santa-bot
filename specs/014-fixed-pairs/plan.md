# Implementation Plan: Закреплённые пары владельца

**Branch**: `014-fixed-pairs` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-fixed-pairs/spec.md`

## Summary

Владелец бота закрепляет пары «кто кому дарит» в событии до жеребьёвки; жеребьёвка их соблюдает (закреплённая пара
важнее исключений, семей и истории). При кольцевой — только в одну сторону. Хранение — новая таблица `fixed_pairs`
(миграция `0007`, схема 11). Правило допустимости `pairRules` в `src/draw.js` общее для жеребьёвки и замен после неё;
`planDraw` даёт одну общую причину без имён, если мешают закреплённые пары. API — `admin.fixed.add`/`admin.fixed.del`
(только владелец), поле `fixed` в `admin.state` только владельцу. В приложении — блок «Закреплённые пары» под
«Исключениями» из тех же элементов; дизайн-система не меняется.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Cloudflare Workers, workerd)

**Primary Dependencies**: нет рантайм-зависимостей; Wrangler 4

**Storage**: Cloudflare D1 (SQLite); новая миграция `migrations/0007_fixed_pairs.sql`, `REQUIRED_SCHEMA = 11`

**Testing**: `node:test` (юнит: `tests/draw.test.mjs`), e2e — `wrangler dev` + `tests/mock-telegram.mjs` (блок 014),
скриншоты — `playwright-core`

**Target Platform**: Cloudflare Workers (бесплатный тариф) + Telegram Mini App (iOS WebKit, Android, ПК)

**Project Type**: веб-сервис (Worker) + одностраничное мини-приложение (`src/app.html`)

**Performance Goals**: прежний бюджет поиска жеребьёвки (`DEFAULT_BUDGET`, ≤ 10 мс CPU); закрепление — ≤ 10 запросов

**Constraints**: тайна пар (I), владелец ⊇ админ (VII), только дизайн-система без новых элементов, «одно действие — один
результат», остальной интерфейс не меняется

**Scale/Scope**: одна группа (десятки человек); закреплённых пар — единицы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Закреплённые пары видит только владелец (поле `fixed` в `admin.state` — только ему; действия — только ему). Журнал без имён, причина отказа жеребьёвки без имён и посчитана так, чтобы имена в обычных причинах не намекали на закреплённых. Участникам уведомлений нет. Поправка 2.3.0 фиксирует это в принципе I. | ✅ |
| II. Проще некуда для участника | Участник ничего нового не видит и не делает. | ✅ |
| III. Спецификация до кода | spec → plan → tasks; контракт — `contracts/api.md`; поправка Конституции и CLAUDE.md — в этой ветке. | ✅ |
| IV. Только дизайн-система | Блок из существующих компонентов (`ds-card`, `ds-list-item`, `ds-icon-btn`, `ds-input`, `ds-check`, `ds-btn`, `ds-hint`, `ds-notice`); новых элементов нет. | ✅ |
| V. Бесплатно и без своего сервера | Поиск в прежнем бюджете (доля на проверку «без закреплённых» — из него же); +1 запрос к D1 в проверке жеребьёвки. | ✅ |
| VI. Проверено до выката | Юнит: закреплённые пары в результате (сотни прогонов, с кольцевой и без), приоритет над исключениями, `fixed_block`, замены. e2e: права, видимость, журнал, направление, заморозка, жизненный цикл, бюджет. | ✅ |
| VII. Владелец — максимальные права | Новые действия — только владельца, у админов таких возможностей нет; автотест «владелец ⊇ админ» проходит, `admin.fixed.*` добавлены в список отказов админу. Запрет изменений после жеребьёвки — по смыслу, не ради тайны, действует и на владельца. | ✅ |

Поправка Конституции 2.2.0 → 2.3.0 (MINOR): принцип I — закреплённые пары владельца (решение владельца до жеребьёвки)
видит и меняет только он в панели события; админам — ни в интерфейсе, ни в API, журнал без имён.

**Post-design re-check**: research R1–R9 и контракт не добавляют путей к парам для кого-либо, кроме владельца;
`admin.ring` не проверяет закреплённые пары (иначе отказ выдал бы админу их наличие). ✅

## Project Structure

### Documentation (this feature)

```text
specs/014-fixed-pairs/
├── plan.md              # этот файл
├── research.md          # решения R1–R9
├── data-model.md        # fixed_pairs, жизненный цикл, снимок, журнал
├── quickstart.md        # как проверить
├── contracts/api.md     # admin.state, admin.fixed.add/del, причины жеребьёвки
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/0007_fixed_pairs.sql   # новое: fixed_pairs, schema 11
src/
├── draw.js      # pairRules (запреты + закреплённые пары), planDraw: fixed, fixed_block
├── pairs.js     # checkDraw/runDraw: закреплённые пары и снимок; замены — pairRules; удаление участника чистит пары
├── db.js        # REQUIRED_SCHEMA 11, getFixedPairs, FIXED_SNAPSHOT_SQL, fixedSnapshot
├── api.js       # admin.state: fixed (владельцу); admin.fixed.add/del; «Я участвую» выкл. чистит пары
├── events.js    # сброс и удаление события — fixed_pairs
├── roles.js     # перенос участия — fixed_pairs
└── app.html     # блок «Закреплённые пары» под «Исключениями»; подписи журнала; кольцевая перестраивает форму блока
tests/
├── draw.test.mjs    # закреплённые пары в жеребьёвке и заменах
├── e2e.test.mjs     # блок 014; список отказов админу (010)
└── screenshots.mjs  # закреплённая пара в данных скриншотов
.specify/memory/constitution.md, CLAUDE.md, README.md
```

**Structure Decision**: существующая структура; новых модулей нет — закреплённые пары живут рядом с исключениями
(те же файлы и места).

## Complexity Tracking

Нет нарушений.

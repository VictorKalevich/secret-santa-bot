# План 062: без масок Санты и семей

**Branch**: `062-remove-masks-families` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Summary

Три удаления одной фичей (`research.md` R1):

1. **Подсказка «Уведомлений»** — `app.home.notify.hint` уходит из `personalSections` (`03-home`) и 11 словарей.
2. **Маски Санты (040)** — действие `mask.set`, набор `MASKS` (`src/looks.js`), поле маски в ответах (`me.looks.masks`,
   `event.get` → `santa_mask`, `ward.get`, `chat.get`), варианты текстов с маской в переписке, боте и раскрытии; в приложении
   — кнопка и шторка маски, строки на «Письме» и «Подопечном», шапка переписки. Везде — прежний текст без маски (R7).
3. **Семьи (008)** — действия `admin.families`, `admin.family.save`, `admin.family.delete`, параметр `families_on`, учёт семей в
   жеребьёвке, удалении и вписывании, обмене подопечных, снимке жеребьёвки и условиях захвата (R5), правило обмена `family`
   (R9), отказ «Мешают семьи»; в приложении — раздел «Семьи» главного экрана и переключатель «Учитывать семьи» в
   «Управлении». `src/draw.js` не меняется (R4).

Данные (R2, R3): миграция `0023_remove_masks_families.sql` (схема 23, `REQUIRED_SCHEMA = 23`) до выката — семьи событий с
`families_on = 1` (все, и завершённые) → взаимные исключения участников, маски стёрты, записи семей удалены; сверка
`tools/masks-families-reconcile.sql` после выката — те же операторы. Таблицы и колонки остаются ради отката.

Действий API — 73 (было 77). Прежние записи журнала о семьях показываются (R8).

## Technical Context

**Language/Version**: JavaScript ES2022 (Cloudflare Worker), SQL SQLite (D1)
**Primary Dependencies**: нет новых
**Storage**: D1 — миграция `0023` (данные: `exclusions` +, `pairs.mask` → `''`, `families`/`family_members` → пусто; схема 23);
сверка `tools/masks-families-reconcile.sql`
**Testing**: `node:test` на `node:sqlite` («мир»): новый `tests/masks-families.test.mjs` (вместо удаляемого `mask.test.mjs`),
правки `migrations`, `api-refusals` (эталон — удалённые действия по списку), `swap`, `snapshots`, `atomic`, `behavior`,
`companies`, `data-registry`, `secrecy`, `server-shape`, `api-reads`, `unit`, `i18n`, `e2e`; Chrome — `tests/screenshots.mjs`
(`checkNoMasksFamilies`, сценарии маски и семей убраны)
**Target Platform**: Cloudflare Workers Free, мини-приложение Telegram (iOS/Android/ПК), оба бота
**Project Type**: Telegram-бот + мини-приложение (один Worker)
**Performance Goals**: не хуже прежнего — чтений семей больше нет (жеребьёвка, удаление, вписывание, обмен, панель)
**Constraints**: ≤ 50 внешних запросов и ≤ 10 мс CPU на вызов; тексты — только в словарях 11 языков; дизайн-система
**Scale/Scope**: обе базы; семей и масок — единицы–десятки строк

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Перенос добавляет только исключения (организаторы видели семьи и раньше), пары не меняются и никому не отдаются; после жеребьёвки админы исключения не меняют (миграция — не действие админа); маска не участвовала в тайне пар. Тексты уведомлений — прежние варианты без маски, без имён. | ✅ |
| II. Проще некуда | Меньше настроек: одно место для правила «кто кому не дарит». Тексты убираются из всех 11 языков, оставшиеся — прежние. | ✅ |
| III. Спецификация до кода | `specs/062-remove-masks-families/`, `docs/api.md`, строка в `CLAUDE.md`, `docs/todo.md` (удалить пустые таблицы и колонки позже). | ✅ |
| IV. Дизайн-система | Только удаление элементов; новых компонентов нет. Тест `design-system` по склейке. | ✅ |
| V. Бесплатно | Чтений меньше (семьи не читаются); перенос — миграция D1, не вызов Worker. | ✅ |
| VI. Проверено до выката | Перенос на «мире» с данными и повтор сверки, жеребьёвка/вписывание/обмен после переноса, «от противного», `npm run test:all`, Chrome; выкат и откат — `quickstart.md`. | ✅ |
| VII. Владелец | Права не меняются; удалённые действия были админскими — `rights` берёт список из `ACTIONS`. | ✅ |
| Безопасность и данные | Хранимых данных меньше: без семей (Конституция 4.0.0 → 4.1.0, R13) и масок; журнал — прежние записи остаются. | ✅ |
| Процесс | README (маски, семьи, обновление бота: миграция 0023 и сверка) — отдельная задача. | ✅ |

Пост-дизайн: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/062-remove-masks-families/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/removal.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
migrations/0023_remove_masks_families.sql  # перенос семей, маски, удаление семей, схема 23
tools/masks-families-reconcile.sql         # сверка после выката — те же операторы
src/db.js                # REQUIRED_SCHEMA = 23; pairLinksQuery без mask; без familyRowsQuery; AUDIT_HISTORY
src/event-params.js      # families_on → EVENT_RETIRED
src/api.js               # −4 строки ACTIONS (mask.set, admin.families, admin.family.save, admin.family.delete)
src/looks.js             # без MASKS, validMask, maskLabel; looksView без masks
src/participant.js       # без setMask, santa_mask, mask в ward.get
src/chat.js              # santaTitle() без маски; chat.get без mask
src/bot.js               # подсказка ответа без маски
src/events.js            # раскрытие без маски
src/pairs.js             # без семей в checkDraw, runDraw, removeMember, insertMember, swapData/swapRules; без families_on в условиях
src/constraints.js       # без familyExclusions
src/snapshots.js         # без SNAPSHOTS.families
src/membership.js        # без saveFamily, deleteFamily, familiesList, заморозки семьи
src/panel.js             # admin.state без families и settings.families_on
src/companies.js         # ownerChange — без условия «в семьях»
src/draw.js              # только комментарий planDraw (R4)
src/app/03-home.js.txt   # без подсказки «Уведомлений», без renderFamiliesSection; state.looks без masks
src/app/05-event.js.txt  # без масок («Письмо», «Подопечный», шторка); app.event.santa
src/app/06-admin.js.txt  # без переключателя и строк семей
src/app/08-sheet-chat.js.txt  # шапка и подсказка переписки без маски
src/i18n/<11 языков>/    # удалённые ключи (contracts/removal.md), app.event.mask.santa → app.event.santa
docs/api.md, README.md, CLAUDE.md, docs/todo.md, .specify/memory/constitution.md
tests/masks-families.test.mjs  # новый (в скрипт test); tests/mask.test.mjs — удаляется
tests/…                  # правки по списку Testing; fixtures/api-refusals.json — удалённые действия
```

## Complexity Tracking

| Отступление | Почему | Проще — почему нет |
|---|---|---|
| Пустые таблицы `families`, `family_members` и колонки `events.families_on`, `pairs.mask` остаются в схеме, `REGISTRY` их описывает | откат кода на 061 без восстановления базы (FR-012); прежний код в окне «миграция → выкат» читает их | удалить сразу — откат невозможен, прежний код падает в окне; удаление — `docs/todo.md` |
| Параметр `families` у `planDraw` (`src/draw.js`) остаётся, сервер его не передаёт | эталон жеребьёвки «не пересоздавать» хранит `familiesBlock` в каждом результате | удалить параметр — пересоздать эталон и потерять гарантию «результаты прежние» |

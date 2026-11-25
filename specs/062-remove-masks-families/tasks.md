# Tasks: 062. Без масок Санты и семей

**Input**: `specs/062-remove-masks-families/` — spec.md, plan.md, research.md, data-model.md, contracts/removal.md, quickstart.md

**Tests**: нужны (Конституция VI, правила проекта: `npm test` перед коммитом, «от противного» у каждого правила).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Один Worker: `src/`, `migrations/`, `tools/`, `tests/`, `docs/` в корне репозитория. Словари — `src/i18n/<язык>/` (11 языков:
ru, en, es, pt, fr, de, zh, it, tr, id, pl); ключ удаляется или переименовывается во всех 11.

## Phase 1: Setup (данные)

- [X] T001 Миграция `migrations/0023_remove_masks_families.sql`: комментарий (062: применять до выката кода, прежний код со
  схемой 23 работает; после выката — `tools/masks-families-reconcile.sql`; таблицы и колонки остаются ради отката); перенос
  семей — оператор `research.md` R2 (`INSERT OR IGNORE INTO exclusions … WHERE e.families_on = 1 AND EXISTS (members a) AND
  EXISTS (members b)`); `UPDATE pairs SET mask = '' WHERE mask <> ''`; `DELETE FROM family_members`; `DELETE FROM families`;
  версия схемы 23 (`INSERT INTO settings … ON CONFLICT`)
- [X] T002 `tools/masks-families-reconcile.sql`: комментарий (сверка после выката 062 и после возврата к 062 с прежнего кода;
  идемпотентна) и те же четыре оператора побайтно, без версии схемы
- [X] T003 `src/db.js`: `REQUIRED_SCHEMA = 23`

## Phase 2: Foundational

- [X] T004 `tests/support/world.mjs` и помощники: проверить, что «мир» применяет `0023` (все файлы `migrations/`); помощник
  для тестов переноса — база «как у 061» (миграции до `0022` включительно, затем данные, затем `0023`) — в
  `tests/masks-families.test.mjs` по образцу `tests/migrations.test.mjs` (как там строится база до миграции)

## Phase 3: User Story 1 — семьи становятся исключениями (P1) 🎯 MVP

**Goal**: правило семей сохранено исключениями; в приложении и на сервере семей нет.

**Independent Test**: база 061 с семьёй, событиями X (правило, до жеребьёвки), Y (без правила), Z (завершённое), W (после
жеребьёвки), второй комнатой → после `0023` исключения по `data-model.md`, пары W прежние, журнал и очередь не выросли, семей нет;
сверка — 0 изменений; жеребьёвка X не ставит членов семьи друг к другу.

- [X] T005 [US1] `src/event-params.js`: строка `families_on` уходит из `EVENT_PARAMS`; новый `export const EVENT_RETIRED =
  ['families_on']` с комментарием (062: колонка осталась в схеме ради отката на 061, код её не читает и не пишет); комментарий
  вверху — «Новая колонка… или в служебных/удалённых»
- [X] T006 [US1] `src/snapshots.js`: без `SNAPSHOTS.families`; `drawSnapshot` и `snapshotGuard` — `members`, `exclusions`,
  `fixed` (параметры условия по порядку); комментарий `data` — без семей
- [X] T007 [US1] `src/constraints.js`: удалить `familyExclusions` и упоминание семей в заголовке
- [X] T008 [US1] `src/pairs.js`: без `familyRowsQuery`/`familyExclusions`; `checkDraw` — `planDraw(ids, { own, history, fixed
  }, …)` (признак `familiesBlock` не читается, в `res` не попадает), причины — только `describeProblem`, снимок без семей;
  захват `runDraw` — без `AND families_on = ?`; `removeMember`, `insertMember` — правила только из исключений и закреплённых
  пар; `SWAP_RULES` без `family`, `swapRules` без параметра `families`; `swapData` — без чтения семей, снимок без семей;
  `swapWards` — условие без `families_on = ?`; комментарии (008, 010) — по-новому
- [X] T009 [US1] `src/draw.js`: только комментарий `planDraw` — `families` — дополнительные запреты с отдельной причиной
  `familiesBlock`; сервер с 062 их не передаёт, параметр остаётся ради эталона `draw-golden` (R4)
- [X] T010 [US1] `src/membership.js`: удалить `saveFamily`, `deleteFamily`, `familiesList`, `frozenFamilyEvent`,
  `familyMembers`, `familyChanges`, `familyFrozen`, `FAMILY_NOT_FOUND`, `FAMILY_MAX` и ставшие ненужными импорты; заголовок
  модуля и CLAUDE-описание — без семей
- [X] T011 [US1] `src/panel.js`: `adminState` без чтения `famRows`, без `families` в ответе и `families_on` в `settings`
- [X] T012 [US1] `src/api.js`: удалить строки `admin.families`, `admin.family.save`, `admin.family.delete` и их импорты
- [X] T013 [US1] `src/db.js`: удалить `familyRowsQuery`; `REGISTRY.families`/`family_members` — оставить с комментарием
  (062: таблицы пусты, код их не пишет; описание нужно схеме и откату); `AUDIT_HISTORY` — ключи
  `membership.audit.familySave`, `membership.audit.familyDelete` с комментарием (прежние записи журнала с `details_tx`
  показываются по ним; код их больше не пишет) рядом с `getAudit`
- [X] T014 [US1] `src/companies.js` `ownerChange`: условие «участвует в её семьях» (`family_members`) уходит из удаления строки
  владельца бота; комментарий — «участвует в её событиях»
- [X] T015 [US1] `src/app/03-home.js.txt`: удалить `renderFamiliesSection` (с `openFamily`) и его место в списке разделов
  (остаётся `renderAdminsSection`; `people` — его `load`)
- [X] T016 [US1] `src/app/06-admin.js.txt`: удалить `famCard` (переключатель «Учитывать семьи», `bindToggle` на
  `families_on`, строки `d.families`) из секции исключений; разметка секции — прежняя без карточки
- [X] T017 [US1] Словари 11 языков: удалить `app.home.families.*`, `app.admin.families.*`, `pairs.familiesBlock`,
  `pairs.swapRule.family`, `eventParams.familiesAfterDraw`, `membership.familyNameRule`, `membership.familySize`,
  `membership.familyNotFound`, `membership.alreadyInFamily`, `membership.familyFrozen`; оставить
  `membership.audit.familySave`, `membership.audit.familyDelete`, `app.vault.audit.family.*`; подсказки, где упомянуто
  «Учитывать семьи» (например `app.home.*`, `app.admin.*`, `pairs.*`), — проверить поиском по `семь`/`famil` во всех языках
- [X] T018 [US1] `tests/masks-families.test.mjs` (новый, в скрипт `test` в `package.json`), часть «перенос»: база 061 с
  данными (`research.md` R2: комната 1 — семья Аня/Боря/Вика и Гоша без семьи; X — правило, до жеребьёвки, Аня/Боря/Гоша;
  Y — без правила; Z — завершённое с правилом, Аня/Боря/Вика; W — после жеребьёвки с правилом, Аня/Вика/Гоша, переписка; V —
  с правилом и уже исключением Аня → Боря; комната 2 — своя семья и событие, где участвуют люди семьи комнаты 1) →
  применить `0023`: исключения ровно по правилу (в X — Аня ↔ Боря; Y — нет; Z — три пары; W — Аня ↔ Вика; V — добавлено
  Боря → Аня; комната 2 — только своя семья), остальное в `exclusions` прежнее; `pairs` (кроме `mask`), `members`,
  `messages`, `outbox`, `audit` — побайтно прежние; `families`, `family_members` — пусто; схема 23; сверка
  `tools/masks-families-reconcile.sql` дважды — 0 изменений строк; «от противного» — без условия `families_on = 1`
  появляются исключения в Y, без условия участия — с Викой в X
- [X] T019 [US1] `tests/masks-families.test.mjs`, часть «после переноса» (обычный «мир» с 0023): жеребьёвка с бывшими
  семейными исключениями не ставит членов семьи друг к другу (100 прогонов с зерном), невозможная — причина без «семей»;
  вписывание и удаление после жеребьёвки соблюдают исключения; обмен с бывшей семейной связкой — правило `exclusion`, кода
  `family` нет, лишний `family` в `agree` не мешает; `admin.families`, `admin.family.save`, `admin.family.delete` — отказ
  неизвестного действия (организатор без события — 404 «Событие не найдено.», участник — 403), строк нет; `admin.state` без
  `families`, `settings.families_on`; `admin.game` с `families_on` ничего не пишет; журнал с прежней записью `family.save`
  (с `details_tx`) показывается текстом на русском и английском; по склейке приложения — нет `admin.famil`,
  `renderFamiliesSection`, `families_on`, ключей `app.home.families`/`app.admin.families`, «от противного»
- [X] T020 [P] [US1] Тесты сервера по семьям: `tests/snapshots.test.mjs` (паритет без `families`), `tests/swap.test.mjs`
  (без правила `family`; бывшие семьи — исключения), `tests/atomic.test.mjs` (убрать случаи семей: новая семья ×2, сохранение
  семьи с изменением — с пометкой 062), `tests/behavior.test.mjs` (034 — журнал семьи: убрать), `tests/companies.test.mjs`
  и `tests/support/companies.mjs` (статическое правило `familyRowsQuery`, семьи по комнатам — убрать; инварианты без семей),
  `tests/companies-manage.test.mjs`, `tests/data-registry.test.mjs` (сценарии без действий семей; таблицы семей — в
  `REGISTRY`), `tests/api-reads.test.mjs`, `tests/secrecy.test.mjs`, `tests/unit.test.mjs`, `tests/server-shape.test.mjs`
  (колонки `events` = параметры + служебные + `EVENT_RETIRED`; «от противного» — колонка ни в одном списке), `tests/queries.test.mjs`
  и `tests/support/queries-scenario.mjs` (сценарий без `admin.family.save`; пороги — не больше прежних)
- [X] T021 [US1] Эталон отказов: `tests/support/refusals-scenario.mjs` — без `admin.families`, `admin.family.save`,
  `admin.family.delete` в списке прежних действий; `tests/fixtures/api-refusals.json` — удалить эти три действия из
  `actions` и все ответы с ними (скриптом по ключу «<ситуация> <действие>»); заголовок `tests/api-refusals.test.mjs` —
  строка 062 с числом удалённых ответов; утверждение «прежние 59 действий» → «прежние 56»
- [X] T022 [US1] `tests/e2e.test.mjs`: сценарий без семей (семьи → исключения в событии, где они нужны сценарию)

## Phase 4: User Story 2 — маски убраны и стёрты (P1)

**Goal**: маски нет нигде; у пар — пусто.

**Independent Test**: после `0023` маски пустые; «Подопечный», «Письмо», переписка, сообщения бота, подсказка ответа и
раскрытие — тексты без маски; `mask.set` — «Неизвестное действие».

- [X] T023 [US2] `src/looks.js`: удалить `MASKS`, `validMask`, `maskLabel`; `looksView` — только `postcards`; комментарии
- [X] T024 [US2] `src/participant.js`: удалить `setMask`, `MASK_REVEALED`, `santa_mask` (в `eventView`), `mask` (в
  `wardView`), импорт `validMask`
- [X] T025 [US2] `src/chat.js`: пара без `mask`; `santaTitle` — константа/функция без параметра (`chat.santaTitle`); ответ
  `chat.get` без `mask`; комментарии (040)
- [X] T026 [US2] `src/bot.js`: подсказка ответа — `bot.reply.toWard`/`bot.reply.toSanta` без маски, импорт `maskLabel`
  убрать; `src/events.js`: раскрытие — только `events.revealed`, импорт `maskLabel` убрать; `src/db.js`: `pairLinksQuery`
  — `SELECT santa, ward`
- [X] T027 [US2] `src/api.js`: удалить строку `mask.set` и импорт `setMask`
- [X] T028 [US2] `src/app/03-home.js.txt`: `state.looks` — `{ postcards: [] }`; `src/app/05-event.js.txt`: удалить
  `maskLabel`, `maskedSanta`, `openMaskSheet`, `santaMask` на «Письме», `maskCtl`/`showMask` на «Подопечном» — подсказка
  `app.event.chat.wardHint` с `{ santa: t('app.event.santa') }` один раз; `src/app/08-sheet-chat.js.txt`: шапка — 
  `app.sheet.chat.yourSanta`, подсказка Санте — `app.sheet.chat.youAre` с `t('app.event.santa')`, без `showMask` и маски из
  опроса
- [X] T029 [US2] Словари 11 языков: `app.event.mask.santa` → `app.event.santa` (значение прежнее); удалить остальные
  `app.event.mask.*`, `app.sheet.chat.yourMasked`, `looks.mask.*`, `looks.maskLabel`, `chat.santaTitleMask`,
  `bot.reply.toWardMasked`, `bot.reply.toSantaMasked`, `events.revealedMask`, `participant.noMask`,
  `participant.maskRevealed`, `api.maskClosed`; комментарии словарей про маски
- [X] T030 [US2] `tests/masks-families.test.mjs`, часть «маски»: база 061 с маской у пары → после `0023` у всех пар `mask =
  ''`; после переноса — `me` без `looks.masks`, `event.get` без `santa_mask`, `ward.get` и `chat.get` без `mask`; сообщение
  Санты подопечному — «Твой Тайный Санта», подсказка ответа — без маски, раскрытие — `events.revealed`; `mask.set` —
  404 «Неизвестное действие», пара не меняется; по склейке — нет `mask`/`Mask` (кроме CSS не бывает), `openMaskSheet`,
  `maskedSanta`, `santa_mask`; «от противного»
- [X] T031 [US2] Удалить `tests/mask.test.mjs` (и из скрипта `test`); `tests/secrecy.test.mjs`, `tests/swap.test.mjs`,
  `tests/i18n.test.mjs`, `tests/migrations.test.mjs` — убрать проверки масок, которые больше неприменимы (миграция `0011` —
  её тест остаётся); эталон отказов — `NEW_ACTIONS_040` и ответы «040 …» удалить (`refusals-scenario.mjs`, фикстура,
  заголовок теста, импорт в `api-refusals.test.mjs`)

## Phase 5: User Story 3 — «Уведомления» без подсказки (P2)

**Goal**: в карточке «Уведомлений» только кнопки режима.

**Independent Test**: склейка — `personalSections` без `app.home.notify.hint`; словари — ключа нет ни в одном языке.

- [X] T032 [US3] `src/app/03-home.js.txt` `personalSections`: карточка «Уведомлений» — `ui.card(seg)`; удалить
  `app.home.notify.hint` из 11 словарей
- [X] T033 [US3] `tests/masks-families.test.mjs`, часть «подсказка»: склейка без `app.home.notify.hint`, ни в одном словаре
  ключа нет; «от противного»

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 `docs/api.md`: 73 действия; удалить разделы `mask.set`, `admin.families`, `admin.family.save`,
  `admin.family.delete` и строки сводной таблицы; поля `me.looks.masks`, `santa_mask`, `mask` (`ward.get`, `chat.get`),
  `admin.state.families`, `settings.families_on`, правило обмена `family`; коды `family.save`/`family.delete` — из таблицы
  «Коды журнала» в абзац «Прежние коды»; ссылка на 062
- [X] T035 `.specify/memory/constitution.md` 4.0.0 → 4.1.0 (R13): Sync Impact Report; «Тайна между компаниями», «Храним
  минимум данных», «События… принадлежат компании» — без семей
- [X] T036 README (`README.md`): масок и семей нет (возможности, роли «Подопечный», раздел «Адрес доставки, семьи, заявки»,
  закреплённые пары «важнее исключений», отмены жеребьёвки, обмен, «по образцу»); обновление бота — миграция `0023` до
  выката, сверка после (`specs/062-remove-masks-families/quickstart.md`)
- [X] T037 `CLAUDE.md`: строка 062 в таблице фич; правки описаний (`src/looks.js`, `participant`, `chat`, `pairs`,
  `constraints`, `membership`, `snapshots`, `db.js` REGISTRY, миграции — `0023`, схема 23, 73 действия, жёсткие правила
  про семьи и маски, тесты — `masks-families`, `mask` удалён); `docs/todo.md` — пункт «удалить таблицы `families`,
  `family_members`, колонки `events.families_on`, `pairs.mask`, когда откат на 061 не нужен»
- [X] T038 `tests/screenshots.mjs`: убрать сценарии семей и масок (`checkMask`, «Семьи» в `checkNames`, `admin.family.save`
  в подготовке); `checkNoMasksFamilies` — главный экран (нет «Семьи», в «Уведомлениях» нет подсказки), «Подопечный» (нет
  «🎭»), переписка подопечного («Твой Тайный Санта»), «Управление» (нет «Учитывать семьи»), обе темы; `npm run screenshots`
- [X] T039 `npm test`, `npm run test:all`; `node tests/support/i18n-check.mjs` по изменённым файлам; сверка `quickstart.md`
  локально (миграция на копии базы «мира»)

## Dependencies

- T001–T003 → всё остальное (схема 23 нужна «миру»).
- US1 (T005–T022) и US2 (T023–T031) независимы, кроме общих файлов (`src/api.js`, `src/db.js`, `src/app/03-home.js.txt`,
  словари, эталон отказов) — правки в них последовательно.
- US3 (T032–T033) независима.
- Polish (T034–T039) — после всех историй.

## Parallel Example

```text
US1: T006 (snapshots.js) ∥ T007 (constraints.js) ∥ T010 (membership.js) ∥ T011 (panel.js) ∥ T014 (companies.js)
US2: T023 (looks.js) ∥ T025 (chat.js) ∥ T026 (bot.js, events.js)
```

## Implementation Strategy

MVP — US1 (семьи → исключения): единственная часть, где ошибка ломает правило жеребьёвки. Затем US2 и US3, документы, полный
прогон тестов и Chrome. Выкат — по команде владельца, `quickstart.md`.

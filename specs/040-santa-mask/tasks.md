# Tasks: Маска Санты в переписке (040)

**Input**: `specs/040-santa-mask/` — spec.md, plan.md, research.md, data-model.md, contracts/mask.md, quickstart.md

**Tests**: да — сервер в «мире» (`npm test`), набор ↔ значки, правила склейки приложения, приложение в Chrome
(`npm run screenshots`); новые проверки падают на прежнем коде.

## Phase 1: Setup

- [X] T001 Спецификация, план, решения, модель данных, контракт, проверка, задачи — `specs/040-santa-mask/`;
  `.specify/feature.json`

## Phase 2: Foundational — схема и набор

- [ ] T002 `migrations/0011_santa_mask.sql` — `ALTER TABLE pairs ADD COLUMN mask TEXT NOT NULL DEFAULT ''`,
  `settings.schema` → 14; `src/db.js` — `REQUIRED_SCHEMA = 14`; `src/looks.js` — `MASKS` (20 `{ id, emoji, title }` в
  порядке data-model.md), `validMask` («`''` или `id` из набора; иначе `null`»), `maskLabel(id)` («<emoji> <title>» или
  `''`)
- [ ] T003 [P] `tests/migrations.test.mjs`: 0011 — колонка `pairs.mask` с умолчанием `''` и версия 14; база с данными
  «до 0011» — строки прежние, у пар `mask = ''`
- [ ] T004 [P] `tests/mask.test.mjs` (новый, + в скрипт `test` в `package.json`): набор — 20 масок, `id` уникальны,
  эмодзи — одна графема, нет пересечения со значками `EMOJIS` ни по эмодзи без `U+FE0E`/`U+FE0F`, ни по кодовым точкам
  значка внутри маски, названия не содержат слов `BADGE_MEANINGS` (у каждого значка — слово в списке); «от противного» —
  проверка ловит маску «🦊 Лис», «🐻‍❄️ Белый мишка», «⛄ Снеговик»; `validMask`, `maskLabel`; заголовок уведомления с
  самой длинной маской и названием в 40 символов + `MAX_CHARS` ≤ 4096

## Phase 3: User Story 1 — Санта выбирает маску (P1) 🎯 MVP

**Goal**: Санта выбирает маску своей пары на «Подопечном»; маска своя в каждом событии.

**Independent Test**: `mask.set` → `ward.get.mask`; другое событие — без маски; отказы: не из набора, нет подопечного,
после раскрытия, в завершённом.

- [ ] T005 [P] [US1] `tests/mask.test.mjs`: `mask.set` — сохраняет, `''` снимает, повтор — тот же ответ; маска в
  `ward.get` и `chat.get` (`with: 'ward'`) Санты; в другом событии того же Санты — `''`; отказы «Такой маски нет — выбери
  из списка.» (маска прежняя), «У тебя пока нет подопечного.» (до жеребьёвки и у вписанного без пары), «Тайна уже
  раскрыта — маску больше не сменить.», «Событие завершено: маску больше не сменить.»; очередь бота и журнал не растут
- [ ] T006 [US1] `src/api.js` — строка `mask.set` (`MEMBER`, `event: true`, `finished: 'Событие завершено: маску больше не
  сменить.'`) после `ward.received`; `src/participant.js` — `setMask(ctx, ev, raw)` (порядок: набор → `ev.revealed` →
  `UPDATE pairs SET mask = ? WHERE event_id = ? AND santa = ? AND EXISTS (SELECT 1 FROM events WHERE id = ? AND revealed
  = 0)` → 0 строк: событие заново — раскрыта / нет подопечного), `homeView` — `looks.masks`, `wardView` — `mask`;
  `src/chat.js` — `chatPair` отдаёт `mask`, `chatHistory` — `mask`
- [ ] T007 [US1] Дизайн-система: `.ds-choices--labeled`, `.ds-choice__label` в `design-system/components.css`, витрина в
  `design-system/preview.html` («Без маски», «🐉 Дракон» выбрана, «🕵️ Тайный агент»), строка в
  `design-system/README.md`
- [ ] T008 [US1] `src/app/04-event.js.txt` — `maskLabel(id)` по `state.looks.masks`; «Подопечный»: подсказка с маской,
  кнопка «🎭 Маска: …» пока `!finished() && !state.ev.revealed` (иначе подсказка «Маска в переписке: …» при маске),
  `openMaskSheet(current, saved)` (21 плитка, `busy` на плитки, «Маска выбрана» / «Маска снята», обновление кнопки и
  подсказки на месте, `d.mask` в кэше вкладки); `src/app/07-sheet-chat.js.txt` — подсказка Санты в `openChat` из `mask`
  ответа

## Phase 4: User Story 2 — подопечный видит Санту в маске (P1)

**Goal**: маска — в «Письме», заголовке переписки и сообщениях бота подопечному.

**Independent Test**: `event.get.member.santa_mask`, `chat.get` (`with: 'santa'`) → `mask`; уведомление и просьба бота
с маской; без маски — прежние тексты; Санте о сообщении подопечного — без маски.

- [ ] T009 [P] [US2] `tests/mask.test.mjs`: подопечному — `member.santa_mask`, `chat.get.mask`; сообщение Санты (из
  приложения и ответом в боте) — у подопечного «💬 <b>Твой Тайный Санта «🐉 Дракон» (…) пишет:</b>»; ответ подопечного —
  у Санты прежний заголовок, без маски; кнопка «↩️ Ответить» подопечного — «своему Санте «🐉 Дракон»», Санты — «от имени
  «Тайного Санты · 🐉 Дракон»»; без маски — все тексты прежние; число запросов `event.get`, `ward.get`, `chat.get`,
  `message.send` — как у пары без маски
- [ ] T010 [US2] `src/participant.js` — `eventView`: `member.santa_mask`; `src/chat.js` — заголовок уведомления
  подопечному с `maskLabel`; `src/bot.js` — `onReplyButton`: обе просьбы с маской
- [ ] T011 [US2] `src/app/04-event.js.txt` — «Письмо» → «Переписка с Сантой»: «Твой Санта — в маске «…».»;
  `src/app/07-sheet-chat.js.txt` — `openChat('santa')`: заголовок-узел «Твой Тайный Санта · …» (сначала
  `state.member.santa_mask`, затем `mask` каждого ответа `chat.get`)

## Phase 5: User Story 3 — маска при раскрытии (P2)

**Independent Test**: раскрытие — у подопечного Санты с маской «твой Тайный Санта «🐉 Дракон» — <b>Боря</b>», без маски —
прежний текст.

- [ ] T012 [P] [US3] `tests/mask.test.mjs`: раскрытие (`admin.reveal`) — тексты подопечным с маской и без
- [ ] T013 [US3] `src/db.js` — `pairLinksQuery` → `santa, ward, mask`; `src/events.js` — `revealAll`: маска в сообщении

## Phase 6: User Story 4 — тайна не страдает (P1)

**Independent Test**: на событии, где маски у всех Сант, ответы организаторам и журнал — без масок.

- [ ] T014 [P] [US4] `tests/mask.test.mjs`: у всех Сант маски; ответы `admin.state`, `admin.audit`, `admin.wishlist`,
  `admin.users`, `admin.vault.person`, `admin.vault.pairs`, `event.get` админа-неучастника и `roster` — без `id`,
  эмодзи и названий масок; «Инфо» участника — без маски его Санты (`roster`); по склейке: в `05-admin` и
  `06-vault-audit` нет `mask`; «от противного» — проверка ловит маску, подложенную в ответ

## Phase 7: User Story 5 — маска и изменения пар (P2)

**Independent Test**: вписывание и удаление после жеребьёвки, перенос, отмены, сброс.

- [ ] T015 [US5] `tests/mask.test.mjs`: вписывание (`admin.insert`) и удаление (`admin.remove`) после жеребьёвки — у
  новых пар `mask = ''`, у неизменных — прежняя; перенос участия Санты и подопечного (`admin.transfer`) — маска пары
  прежняя; отмена жеребьёвки, повторная жеребьёвка, полный сброс — масок нет (кода не требует — проверка R1)

## Phase 8: User Story 6 — «сделано» записано (P3)

- [ ] T016 [US6] `docs/todo.md` — убрать «Маска Санты в переписке»; `README.md` — маска в разделе о переписке (выбор на
  «Подопечном», кто видит, раскрытие), «Обновление бота» — миграция 0011 до выката

## Phase 9: Polish & Cross-Cutting

- [ ] T017 [P] Эталон отказов: `NEW_ACTIONS_040 = ['mask.set']` в `tests/support/refusals-scenario.mjs` (проход «040 …»,
  extra: маска не из набора, в завершённом, без подопечного, после раскрытия), новые ключи в
  `tests/fixtures/api-refusals.json`, список в заголовке `tests/api-refusals.test.mjs`; прежние ключи — те же
- [ ] T018 [P] `tests/screenshots.mjs` — `checkMask` (Санта: кнопка → шторка 21 плитки, выбор «🐉 Дракон» — кнопка и
  подсказка; подопечный: «Письмо» с маской, заголовок переписки; после раскрытия — без кнопки), снимки `38-mask-sheet`,
  `38-mask-chat`
- [ ] T019 [P] `docs/api.md` — `mask.set`, поля `me.looks.masks`, `event.get.member.santa_mask`, `ward.get.mask`,
  `chat.get.mask`, тексты бота; 64 действия
- [ ] T020 `CLAUDE.md` — строка 040, миграции (0011, схема 14, файлов 11), `src/looks.js` (`MASKS`), приложение
  (`maskLabel`, `openMaskSheet`), дизайн-система, тесты (`mask`, 64 действия, эталон «040»)
- [ ] T021 Новые тесты падают на прежнем коде; `npm test`, `npm run test:e2e`, `npm run screenshots` — зелёные; статус
  spec; коммиты; влить в `main`, push

## Dependencies

T001 → T002 → (T003, T004) → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 →
T017–T020 → T021.

## Parallel

- T003 и T004 — разные файлы тестов; T017–T019 — разные файлы.

## Implementation Strategy

MVP — US1 (выбор маски) и US2 (подопечный её видит): без них маска бесполезна. Затем US3 (раскрытие), US4 и US5 —
проверки тайны и изменений пар (кода почти не требуют), US6 — документы. Тест — до кода.

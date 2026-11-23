---
description: "Задачи фичи 049"
---

# Tasks: 049. «Не открыл подопечного» при обмене — отметка в шторке и без сообщения

**Input**: `specs/049-swap-unopened-mark/` — spec.md, plan.md, research.md, contracts/swap-marks.md, quickstart.md

**Tests**: обязательны по Конституции (принцип VI) — `npm test` перед коммитом, проверка в Chrome.

## Phase 1: Setup

- [X] T001 Убедиться, что `npm test` на ветке `049-swap-unopened-mark` зелёный до изменений (точка отсчёта).

## Phase 2: Foundational

Нет общих блокирующих задач: обе части (сервер и шторка) независимы.

## Phase 3: User Story 2 — не открывший подопечного Санта без сообщения (Priority: P1) 🎯

**Goal**: сообщение о смене при обмене — только Санте, открывшему прежнего подопечного; решение в момент записи.

**Independent Test**: А открыл, Б — нет: обмен — сообщение только А; никто не открыл — сообщений нет, обмен и журнал есть.

- [X] T002 [US2] `src/pairs.js`: `swapWards` — после `pairsVersion` для каждого из двоих
  `change.and('EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND santa = ? AND ward = ? AND seen_text IS NOT NULL)',
  ev.id, santa, прежний подопечный).enqueue(santa, msg(SWAP_TEXT(ev), appKeyboard(settings, '🎁 Посмотреть', { event }))
  )` до `applyPairsChange`; `applyPairsChange(ctx, ev, change, d.rows, next, [], d.members)`; параметр `text` у
  `applyPairsChange` убрать (вернуть сигнатуру до 048 и комментарий).
- [X] T003 [P] [US2] `tests/swap.test.mjs`: оба открыли — по сообщению (как было); открыл один — сообщение только ему;
  никто — 0 сообщений, обмен и запись `draw.swap` есть; Санта открыл подопечного прямо перед записью (`w.beforeWrite`
  по `UPDATE events SET draw_token`) — сообщение есть.
- [X] T004 [P] [US2] `tests/atomic.test.mjs`: обмен ×2 в одну миллисекунду — перед обменом оба Санты открыли
  подопечных (`seen_text`), по одному сообщению каждому.

## Phase 4: User Story 1 — отметка «не открыл подопечного» в шторке (Priority: P1)

**Goal**: под именем в шторке — метка, как в «Участниках».

**Independent Test**: часть Сант открыла подопечных — метки в шторке совпадают с «Участниками».

- [X] T005 [US1] `src/app/06-vault-audit.js.txt`: `openSwapSheet` — строка `label.ds-list-item.ds-check`: флажок и
  `ds-grow` (имя, « (ты)»; ниже `ds-chips` с `ui.chip('👀 не открыл подопечного', 'warning')` при `u.ward_seen ===
  false`); метки строки — своим узлом, чтобы перерисовать.
- [X] T006 [US2] `src/app/06-vault-audit.js.txt`: тексты окна подтверждения и строки плашки нарушений — «Тем, кто уже
  открыл подопечного, бот напишет, что он сменился. …» / «Если поменять, тем, кто уже открыл подопечного, бот напишет,
  что он сменился. …» (контракт); окно ≤ 250 символов (тест `app-ui`).

## Phase 5: User Story 3 — отметка после обмена (Priority: P2)

- [X] T007 [US3] `src/app/06-vault-audit.js.txt`: после успешного `admin.draw.swap` (оба пути — окно и плашка) у двоих
  `ward_seen = false` и перерисовка их меток; при отказе — без изменений.
- [X] T008 [P] [US1] [US3] `tests/swap.test.mjs` (склейка): в `openSwapSheet` метка по `ward_seen === false` тем же
  текстом, что в `adminMembers`; после успеха `ward_seen = false`; тексты окна и плашки — без «обоим».
- [X] T009 [US1] [US3] `tests/screenshots.mjs`, `checkSwap`: метки при открытии совпадают с сервером (открывший — без
  метки); обмен открывшего и не открывшего — метка у обоих в той же шторке, сообщение — только открывшему; снимок
  `48-swap-sheet` с метками.

## Phase 6: Polish

- [X] T010 [P] Описание 048: `specs/048-owner-ward-swap/spec.md` (FR-10 и сценарии о сообщениях — указатель на 049),
  `specs/048-owner-ward-swap/contracts/draw-swap.md` (сообщения, тексты окна и плашки, строка списка — по 049).
- [X] T011 [P] `docs/api.md`, раздел `admin.draw.swap`: сообщения — только Сантам, открывшим прежнего подопечного.
- [X] T012 [P] README: раздел «Управление жеребьёвкой» — метка «не открыл» и сообщения только открывшим.
- [X] T013 `CLAUDE.md`: заметка о фиче 049 (сервер `swapWards`, шторка, тесты).
- [X] T014 `npm test`, `npm run test:e2e`, `npm run screenshots`; коммит, push ветки; слияние в `main` (`--ff-only`).

## Dependencies & Execution Order

- T001 → остальные. T002 → T003, T004. T005 → T007 → T008, T009. T006 — вместе с T005 (тот же файл, последовательно).
- Документы (T010–T013) — после кода; T014 — последним.

## Parallel Example

- T003 и T004 (разные файлы тестов) — параллельно после T002.
- T010, T011, T012 — параллельно.

## Implementation Strategy

MVP — US2 (строгое правило о сообщениях, сервер) и US1 (метка); US3 — тут же, в той же функции шторки. Одна ветка,
один коммит после зелёных тестов.

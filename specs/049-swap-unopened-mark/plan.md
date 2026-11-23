# Implementation Plan: 049. «Не открыл подопечного» при обмене — отметка в шторке и без сообщения

**Branch**: `049-swap-unopened-mark` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

## Summary

Две части. **Приложение**: в шторке обмена (`openSwapSheet`, `src/app/06-vault-audit.js.txt`, 048) под именем участника —
метка `ui.chip('👀 не открыл подопечного', 'warning')`, как в «Участниках» (`adminMembers`, `05-admin`), по полю
`ward_seen` из `admin.state` (`false` — не открыл); после успешного обмена у двоих `ward_seen = false`, их строки
перерисовываются; тексты окна подтверждения и плашки — «тем, кто уже открыл подопечного, бот напишет…». **Сервер**:
`swapWards` (`src/pairs.js`) ставит сообщение о смене каждому из двоих в очередь сам, в том же пакете `atomic` перед
удалением прежних пар, с добавочным условием «прежняя пара этого Санты открыта» (`seen_text IS NOT NULL`) — решение по
состоянию в момент записи; `applyPairsChange` для обмена сообщений не ставит (параметр `text` из 048 убирается). Ответы
API, журнал и число запросов не меняются.

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули (Worker) и часть мини-приложения (кусок одного `<script>`)

**Primary Dependencies**: нет

**Storage**: D1, схема не меняется; признак — `pairs.seen_text IS NOT NULL` (как `seen` в `panelPairsQuery`)

**Testing**: `node:test` — `tests/swap.test.mjs` (сообщения по признаку, запись в момент записи через `beforeWrite`,
склейка), `tests/atomic.test.mjs` (×2 в одну миллисекунду — по одному сообщению открывшим); Chrome — `checkSwap`

**Target Platform**: Cloudflare Worker (бесплатный тариф) + Telegram Mini App

**Project Type**: веб-сервис + мини-приложение без сборщика

**Performance Goals**: операторов в пакете записи — столько же (два условных сообщения вместо двух безусловных), 0 новых
запросов

**Constraints**: тайна — ответы без пар и имён; «одно действие — один результат» (`atomic`); дизайн-система — только
существующие `ds-chips`, `ds-chip--warning`; `CONFIRM_MAX = 250`

**Scale/Scope**: одна функция сервера, одна функция приложения, тесты, документы 048/049, `docs/api.md`, README, CLAUDE.md

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Метка — статус Санты, который владелец и админы уже видят в «Участниках»; пар нет; шторка — только владельцу. Сообщений становится меньше (не открывшим — нет); тексты без имён; ответы не меняются. | ✅ |
| II. Проще некуда для участника | Не открывший подопечного Санта не получает лишнего сообщения. | ✅ |
| III. Спецификация до кода | spec → plan → tasks → implement в ветке `049-swap-unopened-mark`; описание 048 (spec, контракт), `docs/api.md`, README — в той же ветке. | ✅ |
| IV. Только дизайн-система | Существующие `ds-chips` и `ds-chip--warning` (через `ui.chip`), без новых классов. | ✅ |
| V. Бесплатно и без сервера | Тот же пакет записи, сообщения — через `outbox`; новых запросов нет. | ✅ |
| VI. Проверено до выката | Тесты сообщений по признаку (в т.ч. в момент записи), атомарность, склейка, Chrome. | ✅ |
| VII. Владелец — максимальные права | Доступ прежний (владелец). | ✅ |

Нарушений нет. Повторная проверка после проектирования — без изменений.

## Project Structure

### Documentation (this feature)

```text
specs/049-swap-unopened-mark/
├── spec.md
├── plan.md
├── research.md
├── contracts/swap-marks.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/pairs.js                     # swapWards: сообщения только открывшим (условие в пакете); applyPairsChange без text
src/app/06-vault-audit.js.txt    # openSwapSheet: метка под именем, обновление после обмена, тексты о сообщениях
tests/swap.test.mjs              # сообщения по признаку, в момент записи; склейка — метка и тексты
tests/atomic.test.mjs            # ×2 в одну миллисекунду — по одному сообщению открывшим
tests/screenshots.mjs            # checkSwap: метки при открытии и после обмена
specs/048-owner-ward-swap/       # spec.md, contracts/draw-swap.md — указатели на 049
docs/api.md, README.md, CLAUDE.md
```

**Structure Decision**: сервер — только `swapWards`/`applyPairsChange` в `src/pairs.js`; приложение — только шторка обмена.

## Complexity Tracking

Нарушений Конституции нет.

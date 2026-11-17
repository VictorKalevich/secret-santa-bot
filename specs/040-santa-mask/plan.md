# Implementation Plan: Маска Санты в переписке

**Branch**: `040-santa-mask` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/040-santa-mask/spec.md`

## Summary

Набор масок — третий список модуля `src/looks.js`: `MASKS` (20 `{ id, emoji, title }`), `validMask`, `maskLabel(id)` →
«🐉 Дракон» или `''`. Миграция `0011_santa_mask.sql`: `pairs.mask TEXT NOT NULL DEFAULT ''`, схема 14. Действие
`mask.set` (MEMBER, событие, в завершённом — отказ): один `UPDATE pairs … WHERE santa = я AND тайна не раскрыта`, без
журнала и сообщений. Маска в ответах: `me.looks.masks`, `ward.get` → `mask` (своя), `chat.get` → `mask` (пары: Санте —
своя, подопечному — его Санты), `event.get` → `member.santa_mask` (подопечному). В текстах бота для подопечного:
уведомление о сообщении Санты, просьба «Напиши своему Санте…», раскрытие; для Санты — просьба «Напиши подопечному…».
Пары, которые пересоздаёт `applyPairsChange` (вписывание, удаление), жеребьёвка и отмены вставляют строки без маски —
маска по умолчанию пуста; перенос (`REGISTRY.pairs.onTransfer: 'update'`) строку не пересоздаёт — маска остаётся.
Дизайн-система: `ds-choices--labeled` и `ds-choice__label` (плитка «эмодзи над названием»). Приложение: «Подопечный» —
кнопка «🎭 Маска: …» и шторка «Маска в переписке» (`openMaskSheet`), подсказки с маской; «Письмо» — «Твой Санта — в маске
«…».»; шторка переписки — заголовок и подсказка из `maskLabel`, обновляются опросом `chat.get`.

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers; мини-приложение — части `src/app/*.js.txt`

**Primary Dependencies**: нет новых

**Storage**: D1 — `pairs.mask TEXT NOT NULL DEFAULT ''` (миграция `0011_santa_mask.sql`, версия схемы 13 → 14);
`REGISTRY` не меняется (колонка — не человек; строка пары уже описана)

**Testing**: `npm test` — новый `tests/mask.test.mjs` (набор и пересечение со значками, `mask.set` и отказы, где видна
маска и где нет, бот, раскрытие, изменения пар, перенос, длина уведомления, правила склейки); эталон отказов (проход
«040 …»); `migrations` (0011); `queries` (число запросов прежнее); `api-doc`; `design-system`; `npm run screenshots` —
`checkMask`, снимок `38-mask`; `npm run test:e2e`

**Target Platform**: Telegram iOS / Desktop / веб; Worker на бесплатном тарифе

**Project Type**: Cloudflare Worker + мини-приложение Telegram

**Performance Goals**: `event.get`, `ward.get`, `chat.get`, `message.send`, раскрытие — без новых запросов (маска — в
прежних `SELECT *` пар); `mask.set` — один `UPDATE` (и одно чтение события при отказе)

**Constraints**: тайна — маска только Санте этой пары и его подопечному; организаторам (панель, журнал, «Инфо», письмо,
пользователи, служебный просмотр) — нет; набор не пересекается со значками; тексты без прошедшего времени; заголовок
уведомления с самой длинной маской и названием в 40 символов + 4000 символов ≤ 4096

**Scale/Scope**: 20 масок, 1 действие API (всего 64), 1 миграция, 1 модификатор дизайн-системы

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Маска — у пары, видят только её Санта и подопечный (оба знают о паре ровно то, что знали: Санта — подопечного, подопечный — что у него есть Санта); организаторам — ни в одном ответе (явные списки полей панели, журнала, служебного просмотра не меняются; тест по значениям на событии с масками); смена — без журнала и сообщений; набор не пересекается со значками (иначе маска выдала бы Санту по списку участников) — тест; у новых пар маски нет | ✅ |
| II. Проще некуда | Одна кнопка на «Подопечном», шторка с плитками, одно нажатие | ✅ |
| III. Спецификация до кода | spec → plan → tasks; `docs/api.md`, README, CLAUDE.md, `docs/todo.md` — в ветке | ✅ |
| IV. Дизайн-система | Модификатор `ds-choices--labeled` и элемент `ds-choice__label` — в `components.css` (токены — существующие), `preview.html`, README дизайн-системы; тест `design-system` | ✅ |
| V. Бесплатно | Новых запросов на чтение нет (тест `queries`), `mask.set` — один запрос | ✅ |
| VI. Проверено до выката | Новые тесты падают на прежнем коде; Chrome — `checkMask`; выкат — миграция до кода (`quickstart.md`) | ✅ |
| VII. Владелец | Новое действие — участника; права организаторов не меняются; владелец маску не видит и в служебном просмотре (ему не нужна — пары он видит и так) | ✅ |

Поправка Конституции не нужна: новые данные — оформление переписки, не пары и не текст организаторам.

Повторная проверка после дизайна — без изменений.

## Project Structure

### Documentation (this feature)

```text
specs/040-santa-mask/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/mask.md    # набор, действие, поля ответов, тексты бота, дизайн-система, правила приложения
├── quickstart.md        # проверка, выкат (миграция → код), откат
└── tasks.md
```

### Source Code (repository root)

```text
migrations/0011_santa_mask.sql   # pairs.mask, schema 14
src/looks.js                     # MASKS, validMask, maskLabel
src/db.js                        # REQUIRED_SCHEMA 14
src/api.js                       # mask.set
src/participant.js               # homeView (looks.masks), eventView (member.santa_mask), wardView (mask), setMask
src/chat.js                      # chatPair → mask; уведомление подопечному с маской; chatHistory → mask
src/events.js                    # revealAll: маска в сообщении подопечному
src/bot.js                       # onReplyButton: просьба с маской
design-system/components.css     # ds-choices--labeled, ds-choice__label
design-system/preview.html       # витрина: плитки масок
design-system/README.md          # строка компонента
src/app/04-event.js.txt          # maskLabel, «Письмо» — подсказка, «Подопечный» — кнопка, openMaskSheet
src/app/07-sheet-chat.js.txt     # openChat: заголовок и подсказка с маской, обновление из chat.get
docs/api.md, docs/todo.md, README.md, CLAUDE.md
tests/mask.test.mjs              # новый (в скрипт test)
tests/support/refusals-scenario.mjs, tests/api-refusals.test.mjs, tests/fixtures/api-refusals.json  # «040 …»
tests/migrations.test.mjs        # 0011
tests/screenshots.mjs            # checkMask, снимок 38-mask
```

**Structure Decision**: набор — в `src/looks.js` рядом со значками (тест пересечения читает оба списка из одного
модуля); маска — колонка пары, поэтому все места, где пары пересоздаются, сбрасывают её без отдельного кода, а перенос
сохраняет.

## Complexity Tracking

Нарушений нет.

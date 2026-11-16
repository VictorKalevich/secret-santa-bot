# Implementation Plan: Один текст «только для чтения» и журнал семьи только при изменении (034)

**Branch**: `034-small-consistency` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

## Summary

1. Тексты «только для чтения» — общие константы `CHAT_READ_ONLY` и `SUPPORT_READ_ONLY` в `src/format.js` (вариант с
   тире — его уже видят люди в боте и приложении); `src/chat.js`, `src/support.js`, `src/bot.js` берут их оттуда, своих
   литералов нет. Приложение (`07-sheet-chat`) держит свои копии — равенство сверяет тест `behavior`. Эталон отказов —
   1 ответ, точечно со строкой в заголовке `tests/api-refusals.test.mjs`.
2. `saveFamily` (`src/membership.js`): без изменений (то же название, тот же набор людей) — `{ ok: true }` без записи (как
   `renameUser`, 025); у существующей семьи с изменением — пакет `atomic` с условием «по прежнему состоянию»
   `familyChanges(n)` (другое название, другое число людей или человек не из нового состава): запись журнала ПЕРЕД
   изменением, остальные операторы — прежние, без условия. Второе из одинаковых одновременных сохранений видит уже
   сохранённую семью — записи нет. Новая семья — прежний пакет (024: второму — «уже в семье»).

## Technical Context

**Language/Version**: JavaScript ES2022 (Worker), Node 22.15+ для тестов

**Primary Dependencies**: нет новых · **Storage**: схема не меняется

**Testing**: `npm test` (`behavior` — тексты в API/боте/приложении и журнал семьи; `atomic` — два сохранения в одну
миллисекунду; `api-refusals` — эталон по списку; `api-doc`), e2e — без изменений

**Constraints**: одно действие — один результат только через `atomic` (020); запросов к базе не больше (`queries`);
журнал без пар и текстов писем; слова — «событие»

**Scale/Scope**: `src/format.js`, `src/chat.js`, `src/support.js`, `src/bot.js`, `src/membership.js`; тесты; `docs/api.md`,
`CLAUDE.md`

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Ответы и журнал без пар; текст отказа не зависит от данных | ✅ |
| II. Проще некуда | Одна фраза везде; журнал без шума | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `034-small-consistency` | ✅ |
| IV. Дизайн-система | Приложение не меняется | ✅ |
| V. Бесплатно | Тот же пакет; сохранение без изменений — на 1 пакет меньше | ✅ |
| VI. Проверено до выката | Новые тесты падают на прежнем коде; `npm test`, e2e | ✅ |
| VII. Владелец | Права не меняются | ✅ |

## Project Structure

```text
specs/034-small-consistency/ spec.md, plan.md, tasks.md, checklists/
src/format.js        # CHAT_READ_ONLY, SUPPORT_READ_ONLY
src/chat.js, src/support.js, src/bot.js   # отказы — из format.js
src/membership.js    # saveFamily: без изменений — без записи; familyChanges + atomic
tests/behavior.test.mjs, tests/atomic.test.mjs, tests/api-refusals.test.mjs, tests/fixtures/api-refusals.json
docs/api.md, CLAUDE.md
```

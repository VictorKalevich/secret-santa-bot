# Implementation Plan: Значок после имени, значок в обращениях, имя на главном экране сразу, клавиатура

**Branch**: `039-names-emoji-keyboard` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/039-names-emoji-keyboard/spec.md`

## Summary

Приложение: одно правило «имя и значок» — `withEmoji(name, emoji)` в `02-core` («Аня 🦊», без значка — «Аня»),
`emojiName(u, name)` — через него; все места со значком (038) переходят на новый порядок без правок у вызывающих.
Обращения: сервер (`src/support.js`) отдаёт значок рядом с каждым именем человека — `emoji` автора обращения,
`assignee_emoji`, `closed_by_emoji`, `author_emoji` у сообщений и в счётчиках `event.get` (`support.assignee_emoji`);
приложение показывает их через `withEmoji` в списке «Обращения» панели (`05-admin`), шторке обращения и «Организатору»
(`07-sheet-chat`), на «Инфо» (`04-event`). Переписка Санты и подопечного (`openChat`) — без значков (тест). Главный экран
(`03-home`): приветствие — `emojiName(me)`; после смены имени или значка «Профиль», приветствие и разделы с именами
(«Администраторы», «Семьи») обновляются на месте — разделы перечитывают свои данные без загрузчика (`load` каждого
раздела), только пока открыт тот же главный экран. Клавиатура: в `02-core` один обработчик касаний на документе —
тап (касание без сдвига больше 10 px, без `pointercancel`) по месту вне полей, кнопок, ссылок, списков, флажков и подписей
снимает фокус с поля ввода (`blur`).

## Technical Context

**Language/Version**: JavaScript ES2022, Cloudflare Workers; мини-приложение — части `src/app/*.js.txt`

**Primary Dependencies**: нет новых

**Storage**: без изменений (значок — `users.emoji` из 038); схема, миграции — прежние

**Testing**: `npm test` — новый `tests/names.test.mjs` (значки в ответах обращений, их нет в переписке, боте и журнале;
по склейке — порядок «имя значок» одним правилом, переписка без значков, приветствие, обработчик касаний; «от
противного»); `looks` — правило части 07 сужается до `openChat`; `queries` — число запросов прежнее; `api-doc`;
`npm run screenshots` — `checkLooks` (порядок), новые `checkNames` (главный экран, обращения) и `checkKeyboard`

**Target Platform**: Telegram iOS / Desktop / веб; Worker на бесплатном тарифе

**Project Type**: Cloudflare Worker + мини-приложение Telegram

**Performance Goals**: число запросов к базе у `event.get`, `admin.state`, `support.get`, `admin.support.get` — прежнее
(значок — из тех же выборок: `users` контекста и тот же оператор счётчиков); обновление главного экрана — два чтения
(`admin.users`, `admin.families`) только у организатора и только после сохранения

**Constraints**: тайна — значка и имени Санты нет в ответах подопечному о переписке, сообщениях бота и журнале;
дизайн-система — без новых классов (текст в прежних элементах); CSP — без изменений (обработчик — в том же встроенном
скрипте, через `addEventListener`)

**Scale/Scope**: 1 серверный модуль (`support.js`), 5 частей приложения, без новых действий API (63)

## Constitution Check

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Значок — свойство человека, как имя; в обращениях имена людей видны и сейчас (автор, организаторы), значок добавляет то же, что имя; переписка Санты и подопечного, бот и журнал — без значков (тесты `looks`, `names`); у Санты значок подопечного — внутри скрытого имени (как в 038); правила видимости обращений не меняются | ✅ |
| II. Проще некуда | Ни одной новой кнопки; клавиатура прячется привычным тапом | ✅ |
| III. Спецификация до кода | spec → plan → tasks; `docs/api.md`, README, контракт 038, CLAUDE.md — в ветке | ✅ |
| IV. Дизайн-система | Новых элементов нет; текст — в прежних `ds-*` | ✅ |
| V. Бесплатно | Запросов к базе на вызов не больше (тест `queries`); обновление главного экрана — только после действия человека | ✅ |
| VI. Проверено до выката | Новые тесты падают на прежнем коде; Chrome — `checkNames`, `checkKeyboard`; iPhone — по `quickstart.md` | ✅ |
| VII. Владелец | Права не меняются | ✅ |

Повторная проверка после дизайна — без изменений.

## Project Structure

### Documentation (this feature)

```text
specs/039-names-emoji-keyboard/
├── spec.md
├── plan.md
├── research.md
├── contracts/names.md   # порядок «имя значок», поля значков в обращениях, главный экран, правило касаний
├── quickstart.md        # проверка в Chrome и на iPhone, выкат и откат (без миграции)
└── tasks.md
```

### Source Code (repository root)

```text
src/support.js                   # emoji рядом с именами: participantView, adminListView, adminThread, ответ sendFromAdmin, supportCountsQuery/View
src/app/02-core.js.txt           # withEmoji, emojiName (имя, затем значок); обработчик касаний (blurOnTap)
src/app/03-home.js.txt           # приветствие со значком; «Профиль» → обновление главного экрана; load у «Администраторов»
src/app/04-event.js.txt          # «Твоё обращение ведёт …» со значком
src/app/05-admin.js.txt          # «Обращения»: автор и «ведёт …» со значком
src/app/07-sheet-chat.js.txt     # шторка обращения и «Организатору» со значками; openChat — без
docs/api.md, README.md, specs/038-emoji-postcards/contracts/looks.md, CLAUDE.md
tests/names.test.mjs             # новый (в скрипт test)
tests/looks.test.mjs             # правило части 07 → только openChat
tests/screenshots.mjs            # checkLooks (порядок), checkNames, checkKeyboard
```

**Structure Decision**: правило «имя + значок» — одна функция в ядре приложения (её проверяет тест), значки обращений —
отдельные поля рядом с именами (имена остаются строками: бот и журнал пишут их без значков, приложение ставит значок само).

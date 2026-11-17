# Tasks: Значок после имени, значок в обращениях, имя на главном экране сразу, клавиатура

**Input**: `specs/039-names-emoji-keyboard/` — spec.md, plan.md, research.md, contracts/names.md, quickstart.md

**Tests**: да — правило проекта (Конституция VI): новые проверки падают на прежнем коде.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Новый тестовый файл `tests/names.test.mjs` (заголовок-комментарий 039, «мир» как в `tests/looks.test.mjs`) и его строка в скрипте `test` в `package.json`

## Phase 2: Foundational

- [ ] T002 Правило «имя и значок» в `src/app/02-core.js.txt`: `withEmoji(name, emoji)` → `emoji ? name + ' ' + emoji : name`, `emojiName(u, name = u.name)` = `withEmoji(name, u.emoji)`; комментарий — где значка нет (переписка Санты и подопечного)

## Phase 3: User Story 1 — значок после имени (P1)

**Goal**: везде, где значок уже есть, — «Аня 🦊».
**Independent Test**: по склейке `withEmoji` даёт «Аня 🦊» и «Аня»; в Chrome «Профиль», «Инфо», панель, у Санты — «Пётр 🦊».

- [ ] T003 [US1] Тест в `tests/names.test.mjs`: `withEmoji` из склейки (`topBlock`, вычисление) — «Аня 🦊», без значка «Аня»; в склейке нет другого соединения значка с именем (строки с `.emoji +` / `+ ' ' + … emoji` вне `withEmoji`); «от противного»
- [ ] T004 [US1] Подсказка шторки «Значок у имени» в `src/app/03-home.js.txt` — текст из `contracts/names.md`
- [ ] T005 [US1] `tests/screenshots.mjs` → `checkLooks`: ожидания «Пётр 🦊» (профиль, имя подопечного, «Инфо»), «Пётр 🦊  @petr» (панель)

## Phase 4: User Story 2 — значок в обращениях (P1)

**Goal**: каждое имя человека в обращениях — со значком; переписка Санты и подопечного, бот, журнал — без.
**Independent Test**: ответы `event.get` (`support`), `support.get`, `admin.state` (`support`), `admin.support.get`,
`admin.support.send` несут значки по таблице контракта; в Chrome — список, шторка, «Инфо», «Организатору».

- [ ] T006 [US2] Тест в `tests/names.test.mjs`: участник 🦊 пишет, организатор 🐻 берёт и отвечает, закрывает — поля `emoji`, `assignee_emoji`, `closed_by_emoji`, `author_emoji` во всех ответах таблицы `contracts/names.md`; без значка — `''`; `admins` без значков; сообщения бота и журнал без значков; `chat.get` обеих сторон — без значков (падает на прежнем коде)
- [ ] T007 [US2] Сервер `src/support.js`: `participantView` (`assignee_emoji`, `author_emoji`), `adminListView` (`emoji`, `assignee_emoji`), `adminThread` (`emoji`, `assignee_emoji`, `closed_by_emoji`, `author_emoji`), ответ `sendFromAdmin` (`author_emoji`), `supportCountsQuery` (подзапрос `assignee_emoji` в том же операторе) и `supportCountsView`
- [ ] T008 [P] [US2] Панель `src/app/05-admin.js.txt` → `adminSupport`: заголовок строки `withEmoji(t.name || 'без имени', t.emoji)`, метка «🙋 ведёт <withEmoji(assignee_name, assignee_emoji)>»
- [ ] T009 [P] [US2] `src/app/07-sheet-chat.js.txt`: `supportBubble` — подпись `withEmoji(m.author, m.author_emoji)`; `openSupport` — «Обращение ведёт …»; `openSupportThread` — заголовок, «ведёт», «закрыто — кто» через `withEmoji`; `openChat` не трогать
- [ ] T010 [P] [US2] `src/app/04-event.js.txt`: «Твоё обращение ведёт <withEmoji(sup.assignee_name, sup.assignee_emoji)>.»
- [ ] T011 [US2] `tests/looks.test.mjs`: правило «нет значков» — только для функции `openChat` части `07-sheet-chat` (`topBlock`), «от противного» прежнее; заголовок-комментарий файла — обращения со значками (039)
- [ ] T012 [US2] Тест в `tests/names.test.mjs` по склейке: имена обращений в частях 05 и 07 и на «Инфо» идут через `withEmoji` (у `assignee_name`, `t.name` в `adminSupport`, `m.author` — рядом поле значка); «от противного»

## Phase 5: User Story 3 — главный экран обновляется сразу (P1)

**Goal**: после смены имени или значка — «Профиль», приветствие, «Администраторы», «Семьи» новые, без загрузчика.
**Independent Test**: Chrome — организатор меняет значок и имя, все места главного экрана новые, прокрутка на месте.

- [ ] T013 [US3] `src/app/03-home.js.txt`: приветствие `'Привет, ' + emojiName(me) + '!'` (одна функция `greet`); `renderAdminsSection` и `renderFamiliesSection` → `{ box, load }` (повторный `load` заменяет содержимое по ответу, без загрузчика); `renderHome` — `profileChanged()` после `openNameSheet` и `openEmojiSheet`: «Профиль», приветствие, `load` разделов — только при прежнем `state.nav`
- [ ] T014 [US3] Тест в `tests/names.test.mjs` по склейке: приветствие — через `emojiName(me)`; колбэки `openNameSheet`/`openEmojiSheet` в `renderHome` вызывают одно обновление (`profileChanged`); «от противного»
- [ ] T015 [US3] `tests/screenshots.mjs` → `checkNames` (главный экран): организатор в семье прокручивает вниз, меняет значок — «Профиль», приветствие, «Администраторы» со значком, `scrollY` прежний, загрузчика нет; меняет имя — «Администраторы» и «Семьи» с новым именем; участник — «Профиль» и приветствие

## Phase 6: User Story 4 — тап мимо поля прячет клавиатуру (P2)

**Goal**: тап по месту вне полей и кнопок снимает фокус; прокрутка — нет.
**Independent Test**: Chrome, синтетические события указателя — заголовок: фокус снят; сдвиг, `pointercancel`, кнопка: фокус остаётся.

- [ ] T016 [US4] `src/app/02-core.js.txt`: обработчик касаний на документе по `contracts/names.md` (`TAP_SLOP = 10`, `KEEPS_FOCUS`, `pointerdown`/`pointerup`/`pointercancel`, фаза захвата), комментарий — почему (iOS)
- [ ] T017 [US4] Тест в `tests/names.test.mjs` по склейке: обработчик один, в `02-core`, слушает `pointerdown`, `pointerup`, `pointercancel`, исключает поля, кнопки, ссылки, списки, подписи; «от противного»
- [ ] T018 [US4] `tests/screenshots.mjs` → `checkKeyboard`: письмо (тап по заголовку — фокус снят, текст цел; сдвиг 30 px; `pointercancel`; тап по кнопке «Сохранить» без клика — фокус остаётся), переписка (тап по ленте — снят), шторка имени (тап по подсказке — снят)

## Phase 7: Polish

- [ ] T019 [P] `docs/api.md`: поля значков в `event.get` (`support`), `support.get`, `admin.state` (`support`), `admin.support.get`, `admin.support.send`; в `emoji.set` — «после имени», обращения со значками
- [ ] T020 [P] `README.md` («Значок у имени»: после имени, обращения со значками, приветствие); `specs/038-emoji-postcards/contracts/looks.md` — указатель на 039 (порядок и обращения изменены)
- [ ] T021 [P] `CLAUDE.md`: строка 039 в таблице фич, `withEmoji` и обработчик касаний в описании `02-core`, тест `names`
- [ ] T022 `npm test`, `npm run screenshots`, `npm run test:e2e` — зелёные; задачи отмечены; `spec.md` → «Реализовано»

## Dependencies

- T002 → все истории приложения; T001 → тесты.
- US1, US2, US3, US4 независимы друг от друга после T002; в US2 T007 до T008–T010 по смыслу (поля ответа).
- Polish — после историй.

## Parallel Example

- US2: T008, T009, T010 — разные части приложения.
- Polish: T019, T020, T021.

## Implementation Strategy

MVP — US1 (одна функция). Затем US2 (сервер + три части), US3, US4; документация и полный прогон в конце; коммит —
одна логическая единица (реализация 039), спецификация — отдельным коммитом до неё.

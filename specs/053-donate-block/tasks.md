# Задачи 053: «Нравится бот?» — поддержать проект

**Input**: `specs/053-donate-block/` — spec.md, plan.md, research.md, contracts/donate-block.md, quickstart.md
**Tests**: да — правила по склейке (`tests/donate.test.mjs`) и проверка в Chrome (`checkDonate`), как требует принцип VI.

## Phase 1: Setup

- [ ] T001 Новый тест `tests/donate.test.mjs` в скрипт `test` в `package.json` (файлы перечислены явно)

## Phase 2: Foundational — дизайн-система (блокирует все истории)

- [ ] T002 [P] Токены `--ds-color-donate: #ed8224` и `--ds-color-on-donate: #ffffff` (фирменные DonationAlerts,
  одинаковые в обеих темах, 053) рядом с праздничным брендом в `design-system/tokens.css`
- [ ] T003 Вариант кнопки `.ds-btn--donate` (фон `--ds-color-donate`, текст `--ds-color-on-donate`) и карточка `.ds-donate`
  (`__icon` — `--ds-text-icon`, `__title` — `lg`/`bold`, `__text` — `md`/приглушённый/`leading-base`, `__note` —
  `sm`/приглушённый; колонка по центру, отступы из шкалы, кнопка с отступом сверху) в `design-system/components.css`
- [ ] T004 [P] Раздел «Поддержка проекта» с карточкой `ds-card ds-donate` и кнопкой `ds-btn--donate` в
  `design-system/preview.html`
- [ ] T005 [P] README дизайн-системы: токены, строка «Поддержка проекта» в «Компоненты», `--donate` в строке «Кнопки»,
  принцип «оранжевый DonationAlerts — только кнопка поддержки проекта», версия 1.9.0 — `design-system/README.md`

## Phase 3: User Story 1 — поддержать проект в открытом боте (P1) 🎯 MVP

**Goal**: на «Инфо» открытого бота под «Нужна помощь?» — карточка по контракту, кнопка открывает ссылку в браузере.
**Independent Test**: `checkDonate` — участник с «Нужна помощь?»: порядок разделов, состав карточки, `openLink` с адресом.

- [ ] T006 [US1] Тест правил 1–6 контракта (раздел 6) с «от противного» — `tests/donate.test.mjs`; до T007–T009 падает
- [ ] T007 [US1] `openWebLink(url)` рядом с `openTgLink`: `tg` → `tg.openLink(url)`, иначе `window.open(url, '_blank',
  'noopener')` — `src/app/02-core.js.txt`
- [ ] T008 [US1] `DONATE_URL` и `donateSection()` (пусто без `state.open`; раздел «Нравится бот?» и карточка с текстами
  контракта дословно, кнопка «❤️ Поддержать через DonationAlerts» → `openWebLink(DONATE_URL)`) — `src/app/05-event.js.txt`
- [ ] T009 [US1] Вызов `nodes.push(...donateSection())` в `renderInfo` сразу после подсказки неучастнику, перед «Как это
  работает» — `src/app/05-event.js.txt`
- [ ] T010 [US1] `checkDonate` в `tests/screenshots.mjs`: мир открытого бота, участник с «Нужна помощь?» — порядок
  разделов, состав карточки, цвет кнопки в обеих темах, нажатие → заглушка `Telegram.WebApp.openLink` получила
  `https://dalink.to/trivial_no`, запросов `/api/*` при нажатии нет; ширина 320 — без горизонтальной прокрутки и обрезки
  подписи; снимки `53-donate`, `53-donate-dark`, `53-donate-320`

## Phase 4: User Story 2 — блок у всех ролей и в завершённом событии (P2)

**Independent Test**: `checkDonate` — организатор события и завершённое событие: блок есть, перед «Как это работает».

- [ ] T011 [US2] В `checkDonate`: владелец-организатор события (без «Нужна помощь?») и событие после
  `admin.event.finish` — блок перед «Как это работает», кнопка работает — `tests/screenshots.mjs`

## Phase 5: User Story 3 — в закрытом боте ничего не меняется (P1)

**Independent Test**: `checkDonate` — основной мир (закрытый бот): на «Инфо» нет «Нравится бот?» и `.ds-donate`.

- [ ] T012 [US3] В `checkDonate`: закрытый бот — «Инфо» без раздела и карточки — `tests/screenshots.mjs`

## Phase 6: Polish

- [ ] T013 [P] README: во втором (открытом) боте на «Инфо» — блок «Нравится бот?» со ссылкой на DonationAlerts, где
  поменять ссылку (`DONATE_URL`, `src/app/05-event.js.txt`) — `README.md`
- [ ] T014 [P] Строка 053 в таблице фич, `openWebLink` и `donateSection` в описании частей, тест `donate` — `CLAUDE.md`
- [ ] T015 `npm test`, `npm run screenshots` (просмотр снимков `53-donate*`), `npm run test:all`; статус в `spec.md`

## Dependencies

- T001 → T006. T002 → T003 → T004/T005 (витрина и README описывают готовый компонент).
- Phase 2 → US1 (классы должны существовать — тест `design-system`). T006 до T007–T009 (тест сначала падает).
- US2 и US3 — проверки поверх US1 (тот же `checkDonate`), код не добавляют.
- Polish — после историй.

## Parallel

- T002 ‖ T004-заготовка ‖ T005 — разные файлы; T013 ‖ T014.

## Implementation Strategy

MVP — Phase 1–3 (блок в открытом боте). US2 и US3 — только проверки того же кода. Выкат — только во второй бот и только
по команде владельца (`quickstart.md`).

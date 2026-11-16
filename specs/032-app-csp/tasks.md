# Tasks: Заголовок Content-Security-Policy для мини-приложения

**Input**: Design documents from `specs/032-app-csp/`
**Prerequisites**: plan.md, spec.md, research.md, contracts/app-csp.md, quickstart.md

**Tests**: проверки — требование спецификации (FR-3211–FR-3214, SC-3201–SC-3205); быстрые тесты пишутся до кода и сначала
падают.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: история спецификации (US1–US4)

---

## Phase 1: Setup

- [X] T001 Снять «до»: `npm test` (число тестов, зелёные); заголовки `GET /app` «мира» — `content-type`, `cache-control`
  и нет `content-security-policy`

---

## Phase 2: Foundational — политика у `/app` (блокирует все истории)

**Goal**: заголовок по контракту `contracts/app-csp.md`, отпечаток — по отдаваемой странице (research R1, R2, R4).

- [X] T002 `tests/app-csp.test.mjs` (новый) и `package.json` (файл в скрипт `test` после `migrations.test.mjs`): блок
  «заголовок /app»: `GET /app` «мира» — `content-security-policy` равна строке контракта, где отпечаток — base64 SHA-256
  (`node:crypto`) текста единственного `<script>` без атрибутов из тела ответа (CRLF/CR → LF); `content-type`,
  `cache-control: no-store` и тело (склейка со стилями) — прежние; у `/setup` (GET) — прежняя
  `frame-ancestors 'none'`. Запустить — падает
- [X] T003 `src/csp.js` (новый, без импортов; комментарий в начале — 032 и путь контракта): `TELEGRAM_SCRIPT`,
  `inlineScripts(page)` (`/<script>([\s\S]*?)<\/script>/g`, CRLF/CR → LF), `appPolicy(page)` (`crypto.subtle.digest`
  SHA-256 от `TextEncoder`, base64 через `btoa`; директивы в порядке контракта через `; `); `src/index.js`: импорт,
  `let appCsp;` у `APP_PAGE` с комментарием (один раз на экземпляр), в `/app` — `appCsp ??= appPolicy(APP_PAGE)` и
  заголовок `'content-security-policy': await appCsp`. T002 — зелёный; `tests/world.test.mjs` — зелёный

---

## Phase 3: User Story 1 — Приложение работает как раньше во всех клиентах (Priority: P1) 🎯 MVP

**Goal**: ни одного нарушения политики на всех экранах в Chrome; веб-клиент во фрейме работает и получает тему.

**Independent Test**: `npm run screenshots` — строка `✔ CSP (032): …`, код выхода 0.

- [X] T004 [US1] `tests/screenshots.mjs`: помощник `openPage(viewport)` — `browser.newPage`, перехват
  `https://telegram.org/**` → `abort`, сборщик нарушений (`exposeFunction` + `addInitScript` с обработчиком
  `securitypolicyviolation`: вид директивы, адрес, начало кода) в массив страницы; все четыре места `browser.newPage`
  (`checkSheetScroll`, `checkDateFields`, `onPage`, `shot`) — через него; нарушения обычных страниц — в `colorProblems`
  с префиксом `CSP:` и названием страницы. Заголовок итоговой ошибки — не только про цвета («Проверки не прошли»)
- [X] T005 [US1] `tests/screenshots.mjs`: `checkCsp()` — часть «фрейм веб-клиента»: перехват `https://santa.test/**` →
  `route.fetch` к `w.base` того же пути (ответ с заголовками Worker), `https://web.telegram.org/**` → страница-родитель
  с `<iframe src="https://santa.test/app#tgWebAppData=…">`; во фрейме приложение загрузилось (главный экран), блок
  `<style>`, созданный в фрейме (как скрипт Telegram), применён (вычисленный стиль), нарушений 0. Настоящий скрипт
  Telegram: в начале прогона Node скачивает `TELEGRAM_SCRIPT` (таймаут 10 с); если скачан — повтор фрейма, где
  `https://telegram.org/js/telegram-web-app.js` отдаётся скачанным текстом, родитель на `iframe_ready` шлёт
  `set_custom_style` — стиль применён, `window.Telegram.WebApp` есть, нарушений 0; не скачан — `⚠` с причиной, без
  ошибки. Вызов `checkCsp()` — после `checkRegistration()`; итог `✔ CSP (032): …`

---

## Phase 4: User Story 2 — Чужой код не выполняется и ничего не отправляет (Priority: P1)

**Goal**: «от противного» в Chrome — каждое внедрение заблокировано и замечено.

**Independent Test**: `npm run screenshots` — `checkCsp` без ошибок.

- [X] T006 [US2] `tests/screenshots.mjs`, `checkCsp()` — часть «от противного» на главном экране приложения
  (`openPage`, свои нарушения не в общий список): встроенный `<script>` (`script-src-elem`, `window` без отметки),
  `onclick` в разметке + `click()` (`script-src-attr`), `eval('1')` — исключение и нарушение `script-src`,
  `<script src="https://csp-check.example/x.js">` и `<script src="https://telegram.org/js/other.js">`
  (`script-src-elem`, адрес в нарушении), `fetch('https://csp-check.example/')` — отказ и нарушение `connect-src`;
  фрейм на родителе `https://csp-check.example/` (перехват) — приложение во фрейме не загрузилось (адрес фрейма —
  страница ошибки, `#main` нет). Каждое «не заблокировано» или «нет нарушения» — ошибка с названием пробы

---

## Phase 5: User Story 3 — Правка приложения не ломает политику (Priority: P2)

**Goal**: правила страницы и кода (контракт, «Правила страницы») — быстрые тесты с местом нарушения.

**Independent Test**: `node --test tests/app-csp.test.mjs`.

- [X] T007 [US3] `tests/app-csp.test.mjs`, блок «отпечаток»: `inlineScripts` и `appPolicy` из `src/csp.js` — CRLF, CR и
  LF дают один отпечаток, изменённый на символ скрипт — другой, страница с двумя встроенными скриптами — два отпечатка
  по порядку, `<script src>` в отпечатки не попадает
- [X] T008 [US3] `tests/app-csp.test.mjs`, блок «правила страницы»: функция `pageProblems(page)` — каждый `<script…>`
  либо `<script>` (встроенный, ровно один), либо `<script src="TELEGRAM_SCRIPT">`; на странице `/app` — `[]`; «от
  противного»: второй встроенный, `<script type="module">`, `<script src="https://cdn.example/x.js">`,
  `<script src="TELEGRAM_SCRIPT" defer>`, без встроенного — каждое замечено
- [X] T009 [US3] `tests/app-csp.test.mjs`, блок «код приложения»: функция `codeProblems(text, name)` по строкам склейки
  (`APP`, место — `where`; комментарии — `code`): `eval(`, `new Function`, `setTimeout`/`setInterval` со строкой первым
  аргументом, `javascript:`, `setAttribute('on…'`; в HTML-частях (`PARTS`, `.html`) — атрибуты `on…=` в тегах; на
  склейке — `[]`; «от противного» — по примеру на каждое правило (с местом), и пример без нарушений (`addEventListener`,
  `setTimeout(() => …)`, `h('button', { onclick: fn })`) — `[]`

---

## Phase 6: User Story 4 — Выкат с проверкой на iPhone и откатом (Priority: P2)

**Goal**: заголовок отдаёт настоящий workerd; инструкция выката и README.

**Independent Test**: `npm run test:e2e`; `quickstart.md` и README читаются от выката до отката.

- [ ] T010 [P] [US4] `tests/e2e.test.mjs`: тест «032: политика безопасности /app» — `fetch(BASE + '/app')`: 200,
  `content-security-policy` есть, `script-src` содержит `'sha256-<B64>'` встроенного скрипта отданной страницы
  (`node:crypto`) и `https://telegram.org/js/telegram-web-app.js`, `frame-ancestors https://*.telegram.org`; заголовок
  файла (список сценариев) — 032
- [ ] T011 [P] [US4] `README.md`: раздел «Обновление бота» — после обновления открыть приложение и проверить; пустой
  экран или без оформления — откат `npx wrangler rollback <прежняя версия>` (база не меняется), номер версии записывать
  до `npm run deploy` (`npx wrangler deployments list`); строка в «Если что-то не так» (приложение пустое после
  обновления); «Для разработки» — `npm test` проверяет политику страницы (`src/csp.js`), `npm run screenshots` — нарушения
  политики на всех экранах; про защиту (раздел о тайне/безопасности, если есть) — страница приложения не выполняет
  чужие скрипты и не отправляет данные на чужие адреса
- [ ] T012 [US4] `specs/032-app-csp/quickstart.md`: сверить шаги проверки на iPhone с приложением (названия кнопок и
  вкладок по `src/app/`), команды — с README

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T013 [P] `docs/api.md`: строка `/app` в таблице адресов — `content-security-policy` (032, `src/csp.js`, контракт
  `specs/032-app-csp/contracts/app-csp.md`)
- [ ] T014 [P] `docs/todo.md`: убрать раздел «Ждёт проверки на iPhone» (пункт CSP сделан в 032); вводный абзац — 031 и
  032 сделаны, осталось «Решено: не делаем»
- [ ] T015 [P] `CLAUDE.md`: строка 032 в таблице фич; «Отложено» — 032 сделана; «Структура» — `src/csp.js`, `/app` в
  `src/index.js` с политикой; тесты — `app-csp`, `screenshots` (`openPage`, `checkCsp`); правило: новый внешний
  скрипт/адрес — правка контракта 032 и проверка на iPhone
- [ ] T016 `npm test` ×3, `npm run test:e2e`, `npm run screenshots`; `git diff main --stat` — `src/` меняется только
  `csp.js` и `index.js`
- [ ] T017 Отметки задач, статус spec/plan — «реализовано»; коммиты; слияние в `main` (`--ff-only`), `git push`; память
  проекта (32-я фича, выкат 031+032 — по `quickstart.md`)

---

## Dependencies & Execution Order

- T001 → T002 → T003 (Foundational) → истории.
- US1 (T004–T005) и US2 (T006) — один файл `tests/screenshots.mjs`: последовательно (T004 → T005 → T006).
- US3 (T007–T009) — один файл `tests/app-csp.test.mjs`, после T002; независим от US1/US2.
- US4: T010 ∥ T011 (разные файлы), T012 — после T011.
- Polish — после историй; T013 ∥ T014 ∥ T015.

## Parallel Example

```text
После T003: US3 (tests/app-csp.test.mjs) ∥ US1+US2 (tests/screenshots.mjs) ∥ T010 (tests/e2e.test.mjs)
После историй: T013 ∥ T014 ∥ T015
```

## Implementation Strategy

1. MVP — заголовок (T002–T003) и проверка всех экранов в Chrome без нарушений (US1).
2. US2 — «от противного»; US3 — правила для будущих правок; US4 — e2e, README, инструкция.
3. Документы, полный прогон, слияние; выкат и проверка на iPhone — владелец по `quickstart.md`.

Коммиты: spec/plan/tasks — один; заголовок и быстрые тесты (T002–T003, T007–T009) — один; проверки в Chrome (T004–T006)
— один; e2e и документы — один; приёмка — один. Перед коммитами с кодом — `npm test`.

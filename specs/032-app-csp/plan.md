# Implementation Plan: Заголовок Content-Security-Policy для мини-приложения

**Branch**: `032-app-csp` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/032-app-csp/spec.md`; пункт `docs/todo.md` «Ждёт проверки на iPhone» → 1,
решение владельца 2026-11-16.

## Summary

Ответ `/app` получает действующую политику безопасности содержимого (research R4, контракт `contracts/app-csp.md`):
скрипты — только встроенный скрипт страницы по отпечатку SHA-256 и файл `telegram-web-app.js`, стили — встроенные
(скрипт Telegram в веб-клиенте создаёт блок темы), запросы и прочие загрузки — свой адрес, без плагинов, `<base>` и
форм, встраивание — только `*.telegram.org`. Политику строит новый модуль `src/csp.js` по отдаваемой странице (отпечаток
— один раз на экземпляр Worker, R1–R2), страница побайтно прежняя. Проверки: быстрый тест (заголовок, отпечаток, правила
страницы и кода с «от противного»), Chrome (все экраны без нарушений, «от противного», фреймы, при сети — настоящий
скрипт Telegram), e2e; выкат — с проверкой на iPhone и откатом (`quickstart.md`).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; Node 24 (минимум 22.15) для тестов

**Primary Dependencies**: нет новых (`crypto.subtle` — в workerd и Node; `playwright-core` — уже в devDependencies)

**Storage**: не меняется (ни миграций, ни `REGISTRY`)

**Testing**: `npm test` (новый `tests/app-csp.test.mjs`), `npm run test:e2e` (тест заголовка `/app`),
`npm run screenshots` (`openPage` со сбором нарушений, `checkCsp`)

**Target Platform**: Cloudflare Workers (бесплатный тариф) + мини-приложение Telegram (iOS WebKit, Android WebView,
Desktop, веб-клиент во фрейме)

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: отпечаток — один раз на экземпляр (замер: ~0,4 мс, первый вызов ~3 мс на Node), запросов к базе
и Telegram не прибавляется

**Constraints**: страница побайтно прежняя; приложение не меняется; политика не должна блокировать ничего из того, что
нужно приложению и скрипту Telegram (R3); проверка iOS — только на телефоне владельца

**Scale/Scope**: `src/csp.js` (новый, ~30 строк), `src/index.js` (заголовок `/app`), тесты (`app-csp`, e2e,
`screenshots`), `package.json`; документы — `docs/api.md`, `docs/todo.md`, `CLAUDE.md`, README

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Ответы API не меняются; политика не даёт внедрённому коду выполниться и отправить данные (пары, письма) на чужой адрес — дополнительная защита тайны. | ✅ |
| II. Проще некуда для участника | Приложение выглядит и работает как раньше во всех клиентах (US1); вне Telegram — прежнее «Открой через Telegram». | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `032-app-csp`; README, `docs/api.md`, `CLAUDE.md`, `docs/todo.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | Приложение и стили не меняются; правило «без `style` в разметке» прежнее. | ✅ |
| V. Бесплатно и без своего сервера | Ни новых вызовов Worker (скрипт остаётся встроенным, отчётов о нарушениях нет — R5), ни запросов к базе; CPU — доли миллисекунды раз на экземпляр. | ✅ |
| VI. Проверено до выката | Быстрые тесты, e2e на `wrangler dev`, Chrome со всеми экранами и «от противного»; iOS — проверка по `quickstart.md` сразу после выката и откат. | ✅ |
| VII. Владелец — максимальные права | Права не меняются. | ✅ |

«Безопасность и данные»: правило «пользовательский текст — только как текст» остаётся; политика — второй рубеж.
Нарушений нет; Complexity Tracking не нужен; Конституция не меняется.

## Project Structure

### Documentation (this feature)

```text
specs/032-app-csp/
├── spec.md
├── plan.md
├── research.md
├── contracts/app-csp.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

`data-model.md` не нужен: данных фича не хранит и не меняет.

### Source Code (repository root)

```text
src/csp.js                 # новый: TELEGRAM_SCRIPT, inlineScripts(page), appPolicy(page)
src/index.js               # /app: content-security-policy — appCsp ??= appPolicy(APP_PAGE)
tests/app-csp.test.mjs     # новый: заголовок = контракт, правила страницы, отпечаток (CRLF/LF), правила кода
tests/e2e.test.mjs         # 032: заголовок /app у wrangler dev, отпечаток = встроенный скрипт
tests/screenshots.mjs      # openPage: сбор нарушений на всех страницах; checkCsp: «от противного», фреймы
package.json               # app-csp.test.mjs в npm test
docs/api.md, docs/todo.md, CLAUDE.md, README.md
```

**Structure Decision**: политика — отдельный модуль без импортов (как `src/status.js`, `src/result.js`): его берут
`index.js` и тесты; порядок частей приложения (`src/app-page.js`) и сами части не меняются.

## Post-design Constitution Check

Страница, приложение, API, база и число запросов прежние; добавлен один заголовок у `/app`, его модуль и проверки. Все
принципы выполнены; риск для iOS закрыт инструкцией проверки и отката (`quickstart.md`).

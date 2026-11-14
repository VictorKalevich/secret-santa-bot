# Implementation Plan: Повторные нажатия — одно действие, один результат

**Branch**: `024-repeat-press` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/024-repeat-press/spec.md`; «Решения владельца» плана рефакторинга
(пункты 6, 7, кнопки из 11), `docs/refactoring/baseline.md` раздел 4.

## Summary

Девять действий получают защиту от двойного вызова помощником `atomic` (research R1–R4): объявление, ручные
напоминания и приглашение из события — окно в минуту «по прежнему состоянию» (опора — объявление или запись журнала,
захват последним); полный сброс — «захват мой» по новому коду приглашения (новый `updateEventIfStmt`); назначение и
снятие админа, передача владения — «по прежнему состоянию» (роль, владелец), `returnThreadsStmts` — с условием; новая
семья — перехват ошибки ключа в откатившемся пакете и прежний отказ «уже в семье». Приложение: `busy` принимает кнопку
или список, шесть вызовов без кнопки получают кнопки; у `ds-icon-btn` и `ds-segmented__item` — вид `:disabled` (R5).
Тесты: блок «повторные нажатия» в `tests/atomic.test.mjs`, новый `tests/app-buttons.test.mjs` (R6).

## Technical Context

**Language/Version**: JavaScript ES2022, ES-модули; Node 24.21 (минимум 22.15) для тестов

**Primary Dependencies**: нет новых

**Storage**: D1 — схема не меняется (версия 11); опоры — `announcements`, `audit`, `users.is_admin`,
`settings.owner_id`, `events.invite_code`, `family_members` (первичный ключ `user_id`)

**Testing**: `npm test` (`atomic` — новый блок, новый `app-buttons`; прочие без правок), `npm run test:e2e` (без
правок)

**Target Platform**: Cloudflare Workers (бесплатный тариф) + мини-приложение Telegram (iOS, Android, ПК)

**Project Type**: веб-сервис (Worker) + мини-приложение

**Performance Goals**: число запросов на вызов — прежнее (`tests/queries.test.mjs`); CPU — тот же порядок

**Constraints**: тексты людям и прочие отказы — прежние; новые отказы — по правилам слов (013); стили — только
дизайн-система (`:disabled` по образцу `ds-btn`)

**Scale/Scope**: `src/events.js` (сброс, приглашение, напоминания, объявление), `src/roles.js` (назначение, снятие,
владелец), `src/support.js` (`returnThreadsStmts` с условием), `src/membership.js` (семья), `src/db.js`
(`updateEventIfStmt`), `src/api.js` (строка `admin.reset.full`), `src/app/02-core.js.txt`, `03-home.js.txt`,
`05-admin.js.txt`, `design-system/` (3 файла); тесты; документы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна по умолчанию | Пары и письма не затрагиваются; новые отказы — без имён подопечных (у семьи — прежний текст с именем человека, который уже в семье, как сейчас); журнал — прежние подробности. Сброс по-прежнему стирает данные события по `REGISTRY`. | ✅ |
| II. Проще некуда для участника | Участник получает каждое сообщение один раз; кнопки отвечают на нажатие (приглушаются). | ✅ |
| III. Спецификация до кода | spec → plan → tasks в ветке `024-repeat-press`; `docs/api.md` — в той же ветке. | ✅ |
| IV. Только дизайн-система | Вид `:disabled` — правило в `components.css` по образцу `ds-btn`, показ в `preview.html`, строка в README дизайн-системы; в частях приложения — только классы `ds-*`. | ✅ |
| V. Бесплатно и без своего сервера | Те же чтения и один пакет записи на вызов; сообщения — через `outbox`. | ✅ |
| VI. Проверено до выката | Проверки одновременных вызовов (падают до правки), тест кнопок, `npm test` и e2e до слияния. | ✅ |
| VII. Владелец — максимальные права | Права не меняются; передача владения и роли — по-прежнему только владелец. | ✅ |

Нарушений нет; Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/024-repeat-press/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

`data-model.md` и `contracts/` не нужны: схема и интерфейсы прежние, новые отказы описывает `docs/api.md`.

### Source Code (repository root)

```text
src/events.js        # resetEvent (захват по коду), inviteFromEvent, remindUnfilled/remindSantas (ручные), announce
src/roles.js         # grantAdmin, revokeAdmin, setOwner (передача)
src/support.js       # returnThreadsStmts(…, guard)
src/membership.js    # saveFamily — отказ вместо 500
src/db.js            # updateEventIfStmt
src/api.js           # admin.reset.full — отказ сброса
src/app/02-core.js.txt, 03-home.js.txt, 05-admin.js.txt   # busy с кнопками
design-system/components.css, preview.html, README.md     # :disabled у ds-icon-btn, ds-segmented__item
tests/atomic.test.mjs, tests/app-buttons.test.mjs, package.json
docs/api.md, CLAUDE.md, docs/refactoring-roadmap.md, docs/refactoring/baseline.md
```

**Structure Decision**: правки по месту в модулях; общий помощник и вид условий — из 020.

## Post-design Constitution Check

Таблиц, текстов людям и прав не добавилось; добавлены только отказы повторному вызову и вид `:disabled` по правилам
дизайн-системы — все принципы выполнены.

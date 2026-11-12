---

description: "Задачи: исправление багов и рефакторинг перед первым выкатом"
---

# Tasks: Исправление багов и рефакторинг перед первым выкатом

**Input**: `/specs/009-fix-refactor/` · **Tests**: да (принцип VI)

## Phase 1: Foundational — рефакторинг без изменения поведения (US10)

Цель: разбить `src/game.js` на модули, не меняя поведения. Проверка: `npm test` и `npm run test:e2e` проходят без
изменения ожиданий.

- [X] T901 [US10] `src/format.js`: перенести из `src/game.js` `escapeHtml`, `msg`, `q`, `shortTitle`, `MONTHS`,
  `formatDate`, `formatMs`, `addDays`, `ISO_DATE`, `appUrl`, `openAppButton`, `inviteLink`, `randomCode`; добавить
  `displayName(u)` (одна версия вместо двух в game.js/api.js), `cleanText(s)` (`\r\n`→`\n` + `trim`), `localDate(env)`
  (из cron.js), `adminRecipients(users, exclude)` — зарегистрированные админы кроме перечисленных
- [X] T902 [US10] `src/outbox.js`: перенести `flushOutbox`/`flushRound` (OUTBOX_LOCK_MS, OUTBOX_TTL_MS)
- [X] T903 [US10] `src/chat.js`: перенести `MAX_CHARS`, `TELEGRAM_MESSAGE_LIMIT`, `chatPair`, `chatButtons`,
  `sendChatMessage`, `unreadCounts`, `unreadByEvent`
- [X] T904 [US10] `src/events.js`: перенести `CHAT_GRACE_MS`, `isFinished`, `chatUntil`, `chatWritable`, `createEvent`,
  `finishEvent`, `deleteEvent`, `resetEvent`, `inviteFromEvent`, `revealAll`, `remindUnfilled`, `remindSantas`,
  `ANNOUNCE_MAX`, `announce`, `dueAutoAction`, `runAutoAction` (по факту: `dueAutoAction`/`runAutoAction` — в
  `src/cron.js`, их единственном потребителе, чтобы не было цикла импортов `events.js` ↔ `pairs.js`;
  `TELEGRAM_MESSAGE_LIMIT` не использовался — удалён)
- [X] T905 [US10] `src/pairs.js`: перенести `buildIsAllowed`, `drawParticipants`, `previousPairs`, `describeProblem`,
  `checkDraw`, `runDraw`, `lastUpdate`, `applyPairsChange`, `removeMember`, `insertMember`, `drawCancelable`, `cancelDraw`
  (по факту: `drawParticipants` — в `src/db.js`, им пользуются и `events.js`, и `pairs.js`)
- [X] T906 [US10] `src/roles.js`: перенести `resolveOwner`, `setOwner`, `grantAdmin`, `revokeAdmin`,
  `transferOwnership`, `transferAccount` (адресаты — через `adminRecipients`)
- [X] T907 [US10] `src/membership.js`: перенести `FAMILY_MAX`, `saveFamily`, `deleteFamily`, `requestJoin`,
  `decideRequest`; `src/db.js`: `addMemberStmt(db, ev, userId, guard, ...args)` — одна вставка участника для вступления
  по ссылке, `admin.participate` и решения по заявке
- [X] T908 [US10] `src/bot.js`: перенести `menuMessage`; `sendAnonymous` убрать — `src/api.js` вызывает
  `sendChatMessage` из `src/chat.js`; `src/api.js`: `nameOf` → `displayName`; `DELIVERY_MAX` после импортов
- [X] T909 [US10] Обновить импорты в `src/index.js`, `src/cron.js`, `src/bot.js`, `src/api.js`; удалить `src/game.js`;
  `npm test` + `npm run test:e2e` — зелёные; коммит «Refactor 009: split game.js into modules (no behavior change)»

## Phase 2: Foundational — счётчик запросов и единая точка отправки (US2)

- [X] T910 [US2] `src/budget.js`: `SUBREQUEST_LIMIT = 50`; `metered(env)` → `{ ...env, DB: обёртка, meter }`,
  обёртка считает `first/all/run/raw` и `batch` (+1 за вызов), `bind` возвращает обёрнутый оператор, `batch` разворачивает
  исходные операторы; `budgetLeft(env)`; `reportBudget(env, where)` → `console.log('budget exceeded', …)` при `used > 50`
- [X] T911 [US2] `src/telegram.js`: `tgApi` считает каждый `fetch` в `env.meter`; `signal: AbortSignal.timeout(10000)`;
  `src/db.js`: `enqueueStmt`/`enqueueIfStmt` ставят `db.meter.enqueued = true`
- [X] T912 [US2] `src/outbox.js`: перед каждым кругом брать не больше `budgetLeft − 2` (захват + завершающий `batch`)
  и не больше запрошенного; круг не начинается, если места нет
- [X] T913 [US2] `src/index.js`: `env = metered(env)` в `fetch` и `scheduled`; после `/tg` и `/api/*` —
  `ctx.waitUntil(flushOutbox(env, 25).finally(() => reportBudget(env, …)))`, если `meter.enqueued`; убрать
  `ctx.waitUntil(flushOutbox…)` из `src/bot.js`, `src/api.js` и модулей логики
- [X] T914 [P] [US2] `tests/unit.test.mjs` (новый, добавить в `npm test`): обёртка считает запросы и `batch` как один;
  `flushOutbox` при `used = 40` делает не больше 10 запросов (фейковая база + подменённый `fetch`)

## Phase 3: US1 — Админ не может вычислить пары (P1)

- [ ] T915 [US1] `src/api.js`: `admin.exclusion.add/del` при `ev.draw_done` → 400 (текст из contracts/api-changes.md)
- [ ] T916 [US1] `src/membership.js`: `saveFamily`/`deleteFamily` — затронутые люди (добавленные ∪ удалённые; при удалении
  — все члены); если кто-то в эвенте `status='active' AND draw_done=1 AND families_on=1` → отказ с названием эвента;
  переименование без смены состава — разрешено
- [ ] T917 [US1] `src/api.js`: `admin.insert` с `id === me.tg_id` → 400 «Вписать себя нельзя — попроси другого
  администратора.»
- [ ] T918 [US1] `src/api.js`: `admin.draw.check` без `history_used`/`history_ignored`; `admin.draw` без
  `history_ignored`; `src/pairs.js`: `checkDraw`/`runDraw` не возвращают эти признаки наружу
- [ ] T919 [US1] `src/db.js`: `addMemberStmt` копирует последний адрес только при `ev.delivery_on`; все вызовы передают эвент
- [ ] T920 [US1] `src/app.html`: исключения после жеребьёвки — только чтение с пояснением; убрать строку «Не повторять
  прошлые пары не получится…» из подтверждения жеребьёвки
- [ ] T921 [US1] `tests/e2e.test.mjs`: убрать проверку `history_used` в блоке 005 (сохранить проверку «пары не повторились»);
  блок «009 / тайна»: исключение после жеребьёвки → 400; семья участника идущего эвента с жеребьёвкой → 400, после
  завершения → 200; самовписывание → 400; ответ проверки без `history_*`; адрес не копируется без `delivery_on`

## Phase 4: US2 — Рассылка: cron (P1)

- [ ] T922 [US2] `src/cron.js`: `runScheduled` — шаги `notify` и `daily` в `try/catch` с журналом; отправка очереди
  всегда в конце; `getSettings` внутри шага
- [ ] T923 [US2] `src/cron.js`: `daily` — кандидаты (автодействия, затем эвенты с рассылкой сегодня); эвенты без рассылки —
  один `UPDATE events SET last_daily = ? WHERE id IN (…)`; выполнить одного кандидата `candidates[minuteOfDay % N]`
- [ ] T924 [US2] `src/events.js`: `remindUnfilled`/`remindSantas` принимают дополнительные операторы и выполняют их в
  одном `batch` с рассылкой (отметка `last_daily` вместе с напоминаниями)
- [ ] T925 [US2] `src/bot.js`: меню одним запросом (`EXISTS` по `pairs` как Санта/подопечный)
- [ ] T926 [P] [US2] `tests/unit.test.mjs`: падающий шаг cron (фейковая база кидает исключение на выборке эвентов) →
  отправка очереди всё равно выполнена
- [ ] T927 [US2] `tests/e2e.test.mjs` блок «009 / рассылка»: три эвента с напоминаниями в один день → после нескольких
  запусков cron ровно одно напоминание каждому; `tests/harness.mjs`: доступ к журналу Worker; в журнале нет
  `budget exceeded` после сценариев /setup-ссылки и приглашения при 5 эвентах

## Phase 5: US3 — Случайный текст не уходит в переписку (P1)

- [ ] T928 [US3] `src/bot.js`: любая команда при `pending` `msg_*` сбрасывает режим до обработки команды; отказ нажатия
  `msg:` сбрасывает прежний режим; режим `msg_ward:<eid>:<id>:<ms>` / `msg_santa:<eid>:<id>:<ms>`
- [ ] T929 [US3] `src/bot.js` + `src/chat.js`: текст в режиме ответа — старый формат или > 60 мин → «⌛ Время ответа
  истекло…»; `sendChatMessage(…, { expectOther })` — собеседник сменился → «🔄 Пара изменилась…»; ничего не пересылается
- [ ] T930 [US3] `tests/e2e.test.mjs` блок «009 / режим ответа»: /start сбрасывает; истечение (сдвиг времени через SQL);
  смена пары (удаление после «Ответить»); отказ нажатия сбрасывает режим; обычный ответ доставляется

## Phase 6: US4 — Вход по ссылке и меню (P2)

- [ ] T931 [US4] `src/membership.js`: `joinByInvite(env, ev, user)` → `already` | `joined` | `closed` | `request_sent` |
  `request_pending` | `request_rejected`; при `joined` — участник и уведомление админам в одном `batch`
- [ ] T932 [US4] `src/membership.js`: `requestJoin` — отклонённая < 24 ч заявка того же человека в тот же эвент →
  `request_rejected` без новой заявки и сообщений
- [ ] T933 [US4] `src/bot.js`: `/start inv_` — сначала членство («Ты уже участвуешь»), затем `joinByInvite`; регистрация —
  `pending = name:<eid>:<invite_code>`; после имени: член эвента → приветствие + «присоединяется»; иначе код приглашения
  совпадает → `joinByInvite`; не совпадает / эвента нет → «ссылка устарела»
- [ ] T934 [US4] `src/bot.js`: кнопки меню — `shortTitle` вместо `.slice(0, 60)`
- [ ] T935 [P] [US4] `tests/mock-telegram.mjs`: 400 на текст или текст кнопки с одиночным суррогатом
- [ ] T936 [US4] `tests/e2e.test.mjs` блок «009 / вход»: повторная ссылка после жеребьёвки; удалённый до имени при
  закрытой регистрации — «закрыта», без «присоединяется»; отклонённый повторно — без новой заявки; меню с эмодзи-названием

## Phase 7: US5 — Одно действие — один результат (P2)

- [ ] T937 [US5] `src/events.js`: `revealAll` — захват `UPDATE … SET revealed = <now> WHERE revealed = 0 AND draw_done = 1`,
  рассылка и журнал по условию; повтор → `{ ok:false, error:'Тайна уже раскрыта.' }`; `src/api.js` возвращает ошибку
- [ ] T938 [US5] `src/events.js`: `finishEvent` — захват `WHERE status = 'active'`, условие `finished_at = <now>`;
  повтор → «Эвент уже завершён.»
- [ ] T939 [US5] `src/pairs.js`: `removeMember`/`insertMember` после жеребьёвки — новый `draw_token` по условию прежнего,
  все операторы (включая `applyPairsChange`) — по условию нового; иначе «Пары изменились одновременно…»
- [ ] T940 [US5] `src/pairs.js`: `runDraw` — условие захвата: число и сумма id зарегистрированных участников, число
  исключений, `ring`, `families_on` как при расчёте; иначе «Состав эвента изменился во время жеребьёвки — попробуй ещё раз.»
- [ ] T941 [US5] `tests/e2e.test.mjs` блок «009 / атомарность»: параллельные раскрытия и завершения → одно сообщение
  каждому; параллельные удаления после жеребьёвки → корректная перестановка у оставшихся

## Phase 8: US6 — Жеребьёвка в лимите CPU (P2)

- [ ] T942 [US6] `src/draw.js`: `planDraw(ids, { own, families, history }, rng, { ring, budget })` — попытки с общим
  бюджетом (семьи `B/4`, остальное — основной поиск, при истории пополам); `src/pairs.js` `checkDraw` использует его
- [ ] T943 [US6] `src/pairs.js`: текст `ring_impossible` — «Похоже, без взаимных пар с такими исключениями не обойтись.
  Попробуй ещё раз; если не выйдет — убери часть исключений или выключи кольцевую жеребьёвку.»
- [ ] T944 [P] [US6] `tests/draw.test.mjs`: `planDraw` на 50 участниках (кольцевая, семьи + история делают невозможным) —
  худшее время < 10 мс; обычный случай — находит распределение, история учитывается

## Phase 9: US7 — Мини-приложение (P2)

- [ ] T945 [US7] `src/app.html`: `state.nav` — `goHome`, `openEvent`, переключение вкладок и все `render*` берут номер;
  после `await` и в `refresh` — выход, если номер устарел; `renderAdmin`/`renderWard` вызывают API с `evId` экрана
- [ ] T946 [US7] `src/app.html`: `showError(e, retry)` — повтор переданной загрузки (`start`, `goHome`, `openEvent`);
  при ошибке открытия эвента — ещё кнопка «К списку эвентов»
- [ ] T947 [US7] `src/app.html`: переписка — `lastId` только из `chat.get`, после отправки `load()`, вставка по id;
  закрытие с непустым черновиком — подтверждение
- [ ] T948 [US7] `src/app.html`: журнал — обычная шторка (без `full`)
- [ ] T949 [US7] `src/app.html`: `bindToggle(input, fn)` — блокировка и откат; применить ко всем переключателям и
  флажкам с немедленным сохранением (регистрация, одобрение, «Я участвую», семьи, кольцевая, прошлые пары, «подарок
  готов», «получил подарок»); `aria-label` переключателя из `toggleRow`
- [ ] T950 [US7] `src/app.html`: письмо — снимок текста до запроса; `reloadEvent` обновляет `state.member` на месте;
  адрес участвует в «несохранённом»; `state.drafts[evId]` — черновики объявления и параметров переживают перерисовку
- [ ] T951 [US7] `src/app.html`: админ по умолчанию — «Письмо» (участник) или «Админ»; после `busy` — `update()` у
  письма и переписки; кэш `ward.get` — перерисовка «Подопечного» после закрытия чата без нового запроса
- [ ] T952 [US7] `src/app.html`: подтверждение жеребьёвки ≤ 250 символов, важное сначала, число вместо имён;
  системная «Назад» Telegram — один обработчик: шторка → закрыть, экран эвента → к списку (с проверкой несохранённого)

## Phase 10: US8 — Тексты (P3), US9 — перенос (P3)

- [ ] T953 [US8] `src/app.html`: «Письмо увидит твой Санта; организатор может открыть его — это записывается в журнал»
  (вкладка «Письмо» и «Как это работает»); подтверждение жеребьёвки — «отменить можно, пока никто не открыл подопечного»;
  удаление после жеребьёвки — «у одного-трёх участников сменится подопечный»; напоминания — «за 2 дня, за день и в день
  срока»; «Санта получит уведомление через несколько минут»; предупреждение об авто-раскрытии/завершении без даты;
  копирование без ссылки — подсказка открыть /setup
- [ ] T954 [US9] `src/roles.js`: `transferAccount` — при слиянии адрес нового аккаунта, если не пустой (с его
  `delivery_updated_at`), иначе старого
- [ ] T955 [US9] `tests/e2e.test.mjs` блок «009 / перенос»: адрес нового аккаунта сохраняется

## Phase 11: Polish

- [ ] T956 `README.md`: режим ответа (час, сброс командой), исключения и семьи после жеребьёвки, раскрытие/завершение;
  `CLAUDE.md`: структура модулей вместо `game.js`, фича 009 в таблице, счётчик запросов, правила тайны 009
- [ ] T957 Контракты: ссылка на `specs/009-fix-refactor/contracts/api-changes.md` из `CLAUDE.md`
- [ ] T958 `npm test`, `npm run test:e2e`, `npm run screenshots` — зелёные; просмотреть скриншоты; отметить задачи

## Dependencies

- Phase 1 (рефакторинг) — первым: все исправления делаются уже в новых модулях.
- Phase 2 (счётчик) — до Phase 4 (cron использует остаток бюджета).
- Phases 3, 5–10 независимы между собой после Phase 1; Phase 9 (мини-приложение) не зависит от сервера, кроме T920.
- Polish — последним.

## Parallel Opportunities

- T914, T926, T935, T944 — разные тестовые файлы.
- Phase 9 (`src/app.html`) можно вести параллельно с серверными фазами 3–8.

## Implementation Strategy

1. Рефакторинг → прогон всех тестов → коммит.
2. P1: тайна (US1), рассылка (US2), режим ответа (US3) → коммиты по истории.
3. P2: вход (US4), атомарность (US5), CPU (US6), мини-приложение (US7).
4. P3: тексты, перенос, документация.

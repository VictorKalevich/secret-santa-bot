# Contract: таблица действий, контекст вызова, сигнатуры модулей (019)

Внутренний контракт. Внешний API (пути `/api/<действие>`, тела, ответы) не меняется — актуальный контракт по-прежнему
`specs/005-events-history/contracts/events.md` и изменения 006–014; сводный контракт — шаг 7.

## 1. `ACTIONS` и конвейер (`src/api.js`)

```js
export const ACTIONS = {
  'имя': { role, owner?, event?, finished?, confirm?, run },
  …
};
// role: ANY | USER | VIEWER | MEMBER | ADMIN | OWNER (экспортируются как ROLES)
// owner: текст 403 (только у OWNER)
// event: true | 'given' | (нет)
// finished: true | 'текст 400' (обязателен при event)
// confirm: ['СЛОВО', 'текст 400']
// run(ctx, body, ev, member) → данные ответа | refuse(текст, код = 400)
```

Порядок конвейера (`handleApi`) — `research.md`, R2. Ответ: данные → `{ ok: true, ...данные }`; отказ → `{ ok: false,
error }` с кодом; заголовки — `content-type: application/json; charset=utf-8`, `cache-control: no-store` (как сейчас).

Добавить действие = добавить строку: роль, событие, «в завершённом», при необходимости владелец и слово; тест таблицы,
тест прав и автотест e2e подхватят её сами. Условное право (зависит от данных) — в обработчике или модуле.

## 2. Контекст (`src/context.js`)

```js
makeContext(env, { me = null, settings = null } = {}) → ctx
openContext(env, userId) → ctx              // пользователь и настройки одним пакетом
ctx.env, ctx.db, ctx.me
await ctx.settings()                         // одно чтение на вызов
await ctx.users()                            // одно чтение на вызов
await ctx.ownerId()                          // resolveOwner; в admin.* — сразу после проверки «админ»
await ctx.isOwner()
await ctx.read({ имя: оператор | null, users?: true, settings?: true }) → { имя: строки, users?, settings? }
ctx.forgetUsers()
```

Создают: `handleApi` (`openContext`), `handleUpdate` — сообщение (`openContext`), нажатие кнопки
(`makeContext(env, { me })`), `runScheduled` (`makeContext(env)`).

## 3. Сигнатуры функций модулей

Контекст — первым параметром; «я» и «владелец ли я» — из контекста.

| Модуль | Функции |
|---|---|
| `events.js` | `createEvent(ctx, title, createdBy, { from, invite })`, `finishEvent(ctx, ev, actor)`, `deleteEvent(ctx, ev, actor)`, `resetEvent(ctx, ev, ownerId, actor)`, `inviteFromEvent(ctx, ev, fromEv, actor)`, `revealAll(ctx, ev, actor)`, `remindUnfilled(ctx, ev, actor, extra)`, `remindSantas(ctx, ev, actor, extra)`, `announce(ctx, ev, actor, text)`, `saveEventSettings(ctx, ev, body, actor)`, `setRing(ctx, ev, on, actor)`, `setRegistration(ctx, ev, open, actor)`, `regenInvite(ctx, ev, actor)`, `setAvoidPrevious(ctx, ev, on, actor)` |
| `pairs.js` | `checkDraw(ctx, ev)`, `runDraw(ctx, ev, { actor, action })`, `removeMember(ctx, ev, userId, { notify, actor, mark })`, `insertMember(ctx, ev, userId, actor)`, `cancelDraw(ctx, ev, actor)`, `forceCancelDraw(ctx, ev, actor)`; `cancelableQuery(db, ev)` (`null` — отменить нельзя без запроса), `insertRank`, `INSERT_BLOCKED`; внутри — `previousPairsQuery(db, ev)` + `previousPairs(rows, ids)` |
| `constraints.js` | `changeExclusions(ctx, ev, { add, giver, receiver, mutual })`, `changeFixed(ctx, ev, { add, giver, receiver, mutual })`, `familyExclusions(ev, ids, rows)`, `familySnapshot`, `FAMILY_SNAPSHOT_SQL`, `fixedSnapshot`, `FIXED_SNAPSHOT_SQL` |
| `participant.js` | `homeView(ctx)`, `eventView(ctx, ev, member)`, `saveWishlist(ctx, ev, member, text)`, `saveDelivery(ctx, ev, member, text)`, `wardView(ctx, ev)`, `setGiftReady(ctx, ev, ready)`, `setGiftReceived(ctx, ev, received)` |
| `panel.js` | `adminState(ctx, ev)`, `memberLetter(ctx, ev, id)`, `usersList(ctx)` |
| `chat.js` | `sendChatMessage(ctx, ev, fromId, to, text, { expectOther })`, `chatHistory(ctx, ev, withWhom, after)`, `chatPair(db, …)`, `unreadQuery(db, eventId, userId)` + `unreadFrom(rows)`, `unreadByEventQuery(db, userId)` + `unreadByEventFrom(rows)`, `tooLong(n)`, `MAX_CHARS` |
| `support.js` | `participantView(ctx, ev)`, `sendFromUser(ctx, ev, text)`, `closeByUser(ctx, ev)`, `adminListQuery(db, ev)`, `adminListView(rows, users, me, isOwner)`, `adminThread(ctx, ev, id)`, `take(ctx, ev, id)`, `sendFromAdmin(ctx, ev, id, text)`, `pass(ctx, ev, id, to)`, `closeByAdmin(ctx, ev, id)`, `supportCountsQuery(db, ev, me)`, `supportCountsView(rows, { member, admin })`, `supportUnreadQuery(db, me)` + `supportUnreadFrom(rows)`, `returnThreadsStmts(db, settings, users, adminId)`, `supportAvailable(users, userId)` |
| `membership.js` | `saveFamily(ctx, actor, { id, name, members })`, `deleteFamily(ctx, actor, id)`, `familiesList(ctx)`, `participate(ctx, ev, on, actor)`, `allowRemoved(ctx, ev, id, actor)`, `joinByInvite(ctx, ev, user)`, `decideRequest(ctx, id, actor, approve, { inEvent })`, `joinedNoticeStmts(db, users, user, ev)`, `requestRejected(ev)`, `rejoinBlocked(db, ev, userId)` |
| `roles.js` | `resolveOwner(db, settings, users)`, `setOwner(ctx, id, { via, prevOwnerId, newOwnerLabel })`, `grantAdmin(ctx, id, actor)`, `revokeAdmin(ctx, id, actor)`, `transferOwnership(ctx, fromId, toId)`, `transferAccount(ctx, fromId, toId, actorId)`; `ownerLinkCode(env)`, `ownerLinkUsed(env, settings)`, `claimOwnerLink(env)` — без изменений |
| `vault.js` | `vaultPerson(ctx, ev, id, actor)`, `vaultPairs(ctx, ev, actor)` |
| `status.js` | `CHAT_GRACE_MS`, `isFinished(ev)`, `chatUntil(ev)`, `chatWritable(ev, now)`, `publicEvent(ev)` — без импортов |
| `format.js` | прежние + `appKeyboard(settings, text, params)` (одна кнопка приложения), `NOT_REGISTERED`, `ADMIN_ONLY`, `NO_DRAW`, `PAIRS_RACE` |
| `setup.js` | `setup(request, url, env)` — страница `/setup` из `index.js` без правок текста и заголовков |
| `bot.js` (внутри) | `registrationClosed(ev)`, `REPLY_EXPIRED`, `parsePending(pending)` (старый `msg_<сторона>:<событие>` — `since = 0`, «время ответа истекло»), `replyPending(side, eventId, otherId)`, `supportPending(who, id)` |

## 4. Чтения (`src/db.js`)

Построители операторов чтения (`…Query(db, …)`) — для пакетов; прежние асинхронные функции (`getUser`, `getEvent`,
`getMember`, …) читают тем же оператором. `readMany(db, named)`, `rowsOf(stmt)`, `settingsFrom(rows)`, `BLANK_SQL(col)`.
Прежние полные чтения, которые больше никто не вызывает (`eventMembers`, `drawParticipants`, `getPairs`, `getExclusions`,
`getFixedPairs`, `familyRows`, `getAnnouncements`, `allEvents`), удалены.

| Построитель | Колонки | Кто |
|---|---|---|
| `userQuery`, `settingsQuery`, `usersQuery`, `eventQuery`, `memberQuery` | как `getUser`, `getSettings`, `allUsers`, `getEvent`, `getMember` | контекст, конвейер |
| `drawMembersQuery(db, eventId)` | `user_id, name, username, registered, wishlist_updated_at, delivery_updated_at, wishlist_blank` | `checkDraw`, `removeMember`, `insertMember`, `changeFixed`, `vaultPairs` |
| `panelMembersQuery(db, eventId)` | `user_id, name, username, registered, is_admin, blocked_at, has_wishlist, has_delivery` | `adminState` |
| `participantCountQuery(db, eventId)` | `n` | `eventView` |
| `memberIdsQuery(db, eventId)`, `participantIdsQuery(db, eventId)`, `unfilledIdsQuery(db, eventId)` | `user_id` | рассылки, сброс и удаление события, приглашение из события |
| `pairsQuery`, `pairLinksQuery`, `panelPairsQuery`, `pairOfSantaQuery`, `pairOfWardQuery` | все / `santa, ward` / `santa, ward, gift_ready, gift_received, seen` / все | пары |
| `exclusionsQuery`, `fixedPairsQuery`, `familyRowsQuery`, `announcementsQuery` | как прежние чтения | жеребьёвка, панель, перестройка пар, `eventView` |

Порядок строк каждой выборки — прежний (`ORDER BY` и `FROM`/`WHERE` без изменений).

## 5. Подмена D1 (`tests/support/d1-sqlite.mjs`)

`batch(list)` ждёт барьер `gate` (см. `world.together`), только если в `list` есть оператор записи
(`INSERT|UPDATE|DELETE`); пакет чтений выполняется сразу. Закреплено в `tests/d1-sqlite.test.mjs`; контракт быстрых
тестов — `specs/016-fast-tests/contracts/test-harness.md`.

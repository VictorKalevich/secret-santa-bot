# Контракт 064: тексты

Русский — образец; на остальных 10 языках (en, es, pt, fr, de, zh, it, tr, id, pl) — тот же смысл по глоссариям
`specs/061-i18n-languages/contracts/glossary/`, те же подстановки. Удалённый ключ удаляется из всех 11 словарей вместе с
вызовом. Проверка — тест `i18n` (`languageProblems`, «ключи словаря используются», «ключи вызовов есть»).

## 1. Изменить

| Ключ | Было (ru) | Стало (ru) |
|---|---|---|
| `app.home.create.hint` | «У события будут свои участники, … назначить администраторов.» | «Напиши название события» |
| `app.home.create.placeholder` | «Например: Новый год {year} — семья» | «Новый год {year} — семья» |
| `app.home.unsaved` | «Письмо или адрес не сохранены. Уйти без сохранения?» | «Письмо не сохранено. Уйти без сохранения?» |
| `app.event.chat.santaHint` | «Хочешь что-то уточнить или ответить на вопрос? Напиши своему Тайному Санте. …» | «Хочешь что-то уточнить или ответить на вопрос?» |
| `app.event.chat.wardHint` | «Есть вопрос? Напиши подопечному — для него ты «{santa}», …» | «Есть вопрос?» (без подстановки) |
| `app.event.card.button` | «🖼 Открытка: {title}» | «🎨 Раскрасить письмо» (без подстановки) |
| `app.event.support.hint` | «Задай вопрос по событию. Ответ придёт сюда и в чат бота. …» | «Задай вопрос по событию.» |
| `app.event.leave.lostLetter` | «твоё письмо Санте и адрес доставки;» | «твоё письмо Санте;» |
| `app.admin.support.titleCount` | «Обращения · {n}» | «Обращения участников · {n}» |
| `app.admin.announce.hint` | «Сообщение всем участникам от бота. Оно останется во вкладке «Инфо».» | «Сообщение всем участникам от бота.» |
| `app.admin.members.title` | «Участники · {n}» | «Участники» (без подстановки) |
| `app.admin.members.letters` | «Письма написали {filled} из {total}. Письмо участника открывается только через «⋯» → «Открыть письмо».» | «Письма написали {filled} из {total}.» |
| `app.admin.members.insertConfirm` | «… у того, кто его ещё не открыл, а если таких нет — у того, чей подарок не готов. …» | «Вписать «{name}» в жеребьёвку? Подопечный сменится у одного Санты — по возможности у того, кто его ещё не открыл. Бот его предупредит.» |
| `app.admin.params.remindersHint` | «Бот сам напомнит: за 2 дня, за день и в день срока письма — тем, у кого его нет; за 2 дня и в день вручения — Сантам …» | «Бот сам напомнит за 2 дня, за день и в день срока письма тем, у кого его нет.» |
| `app.admin.params.noDate` | «⚠️ Авто-раскрытие и автозавершение сработают, только когда указана дата вручения.» | «⚠️ Авто-раскрытие сработает, только когда указана дата вручения.» |
| `app.admin.swap.title` | «Управление жеребьёвкой» | «Обмен подопечными» |
| `app.admin.swap.hint` | «Только для {owner.gen}: поменять подопечных … Кто кому дарит, не видно и здесь.» | «Кто кому дарит, здесь не видно.» (без подстановки) |
| `app.admin.swap.open` | «🔀 Открыть управление жеребьёвкой» | «🔀 Открыть меню обмена» |
| `app.vault.swap.title` | «🔀 Управление жеребьёвкой» | «🔀 Обмен подопечными» |
| `app.admin.vault.hint` | «Только для {owner.gen}: кто кому дарит, письма, адреса и переписка — … журнал …» | «Здесь видно, кто кому дарит, и переписку.» (без подстановки) |
| `app.admin.danger.cancelLines` | 3 строки, вторая — «отметки «подарок готов» и «получил»;» | 2 строки: «кто кому дарит — все пары этого события;», «вся переписка Сант и подопечных в этом событии.» |
| `app.admin.danger.cancelKeep` | «Останутся письма, адреса, участники и исключения. …» | «Останутся письма, участники и исключения. Регистрация снова откроется, участники получат уведомление.» |
| `stale.why.age` | «У него нет даты вручения, а создано оно больше трёх месяцев назад.» | «У него нет даты вручения, а создано оно больше семи недель назад.» |

## 2. Добавить

| Ключ | ru |
|---|---|
| `app.admin.support.title` | «Обращения участников» (заголовок панели без открытых; `app.sheet.support.title` остаётся у шторки) |

## 3. Удалить

- **Настройки**: `app.settings.notify.hint`, `app.settings.about`.
- **Письмо и подопечный**: `app.event.card.none`, `app.event.card.hint`, `app.event.delivery.*` (7), `app.event.received.*`
  (3), `app.event.gift.*` (3), `app.event.markRemoved`, `app.event.santa`, `app.event.shipment.*` (20).
- **Инфо**: `app.event.people.gifts`, `app.event.people.showAll`, `app.event.people.openChat`, `app.event.how.*` (4).
- **Управление**: `app.admin.invite.regHint`, `app.admin.invite.approvalHint`, `app.admin.invite.rejoinHint`,
  `app.admin.support.hint`, `app.admin.members.ready`, `.notReady`, `.sent`, `.received`, `.address`, `.noAddress`,
  `app.admin.exclusions.frozen`, `app.admin.exclusions.afterDraw`, `app.admin.draw.progress`, `.remindSantas`, `.allReady`,
  `app.admin.finish.*` (4), `app.admin.params.delivery`, `.contacts`, `.contactsHint`, `.finishAuto`, `.autoHint`,
  `app.admin.admins.ownerHint`, `app.admin.danger.finishedHint`, `.hint`, `.hintForce`, `.reset`, `.resetTitle`,
  `.resetLines`, `.resetGo`, `.resetDone`.
- **Служебный просмотр**: `app.vault.person.shipping`, `.giftSent`, `.notMarked`, `.address`.
- **Сервер**: `api.markClosed`, `participant.noDelivery`, `participant.deliveryClosed`, `participant.unmarkSentFirst`,
  `participant.noSanta`, `participant.giftReceived`, `events.remindSantas`, `events.remindSantasDated`,
  `cron.wishlistOrDeliveryChanged`, `stale.why.date`, `stale.keep.date`, область `shipment` целиком (файл словаря и
  строка `AREAS`).

## 4. Остаются (история и общие)

`stale.logged.date` (подробности прежних `finish.warn`), `app.vault.audit.remind.santas` (прежние записи журнала),
`app.core.word.reset` (слово проверяет сервер у `admin.reset.full`), `app.sheet.support.title`, `events.openButton`,
`chat.noWard`, `app.admin.remindSent`.

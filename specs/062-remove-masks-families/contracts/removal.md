# Контракт 062: что убирается и что остаётся

Источник истины после фичи — `docs/api.md` (сводный контракт API, бота и журнала). Здесь — разница с 061.

## 1. API (77 → 73 действия)

Удаляются строки `ACTIONS` и разделы `docs/api.md`:

| Действие | Было | Стало (общий путь неизвестного действия, `src/api.js`) |
|---|---|---|
| `mask.set` | смена маски Сантой | участник в событии — 404 «Неизвестное действие» (до этого — прежние общие отказы: не зарегистрирован, нет события, не участник) |
| `admin.families` | семьи и люди комнаты | организатор без события — 404 «Событие не найдено.»; не организатор — 403 «Только для администраторов.» |
| `admin.family.save` | сохранение семьи | то же |
| `admin.family.delete` | удаление семьи | то же |

Поля ответов, которых больше нет:

| Действие | Поле |
|---|---|
| `me` | `looks.masks` (остаётся `looks.postcards`) |
| `event.get` | `member.santa_mask` |
| `ward.get` | `mask` |
| `chat.get` | `mask` |
| `admin.state` | `families`, `settings.families_on` |

`admin.game` не принимает `families_on` (поле тела игнорируется, как любое неизвестное). Обмен подопечных (`admin.draw.swap.check`,
`admin.draw.swap`): правила `self`, `exclusion`, `ring`, `fixed`, `history` — без `family`; лишний код в `agree` не мешает.
Проверка жеребьёвки (`admin.draw.check` и др.): причины без «Мешают семьи…».

## 2. Бот и очередь сообщений

| Место | Текст после 062 (прежний вариант без маски) |
|---|---|
| сообщение Санты подопечному | `chat.fromSanta` с `chat.santaTitle` («Твой Тайный Санта») |
| подсказка ответа (кнопка «Ответить») | `bot.reply.toWard` / `bot.reply.toSanta` |
| раскрытие тайны | `events.revealed` |

Удаляемые ключи (во всех 11 словарях): `chat.santaTitleMask`, `bot.reply.toWardMasked`, `bot.reply.toSantaMasked`,
`events.revealedMask`, `looks.mask.*` (20), `looks.maskLabel`, `participant.noMask`, `participant.maskRevealed`,
`api.maskClosed`, `pairs.familiesBlock`, `pairs.swapRule.family`, `eventParams.familiesAfterDraw`,
`membership.familyNameRule`, `membership.familySize`, `membership.familyNotFound`, `membership.alreadyInFamily`,
`membership.familyFrozen`.

Остаются ради истории журнала (R8): `membership.audit.familySave`, `membership.audit.familyDelete`,
`app.vault.audit.family.save`, `app.vault.audit.family.delete`.

## 3. Приложение

| Экран | Убирается |
|---|---|
| главный экран комнаты (или «Комнаты») → «Уведомления» | подсказка `app.home.notify.hint` (кнопки режима остаются) |
| главный экран комнаты (организатор) | раздел «Семьи», шторка «Новая семья» / «Семья» (`renderFamiliesSection`) |
| «Управление» → «Исключения» | переключатель «👪 Учитывать семьи» и строки семей |
| «Подопечный» | кнопка «🎭 Маска: …», строка «Маска в переписке: …», шторка выбора (`openMaskSheet`) |
| «Письмо» (подопечный) | строка «Твой Санта — в маске «…».» |
| переписка | шапка — `app.sheet.chat.yourSanta`; подсказка Санте — `app.sheet.chat.youAre` с «Тайный Санта» |

Удаляемые ключи приложения (11 словарей): `app.home.notify.hint`, `app.home.families.*`, `app.admin.families.*`,
`app.event.mask.*` (кроме переименованного, ниже), `app.sheet.chat.yourMasked`. Ключ `app.event.mask.santa` («Тайный Санта»)
переименовывается в `app.event.santa` — значения прежние.

## 4. Данные

Миграция `0023_remove_masks_families.sql` — до выката (схема 23), сверка `tools/masks-families-reconcile.sql` — после выката;
операторы переноса, стирания масок и удаления семей в обоих файлах побайтно одинаковые (тест `migrations`). Правила — `data-model.md`.

## 5. Журнал

Коды `family.save`, `family.delete` сервер больше не пишет; в `docs/api.md` — абзац «Прежние коды» под таблицей «Коды
журнала». Запись о переносе не пишется.

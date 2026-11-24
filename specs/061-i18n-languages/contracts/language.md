# Контракт 061: язык человека, выбор, профиль бота, журнал

Дополняет `specs/060-i18n-dictionary/contracts/i18n.md` (устройство словаря, сборка строки, где какой язык).

## 1. Языки и правило

- `LANGUAGES = ['ru', 'en', 'es', 'pt', 'fr', 'de', 'zh', 'it', 'tr', 'id', 'pl']` (`src/i18n/index.js`), `DEFAULT_LANG =
  'ru'`; `RUSSIAN_SPEAKING = ['be', 'uk', 'kk', 'ky', 'tg', 'uz', 'hy', 'az', 'tk']`; `FALLBACK_LANG = 'en'`.
- `telegramLanguage(code)`: нет/пусто → `''`; иначе основной код (нижний регистр, до `-`/`_`): в `LANGUAGES` → он; в
  `RUSSIAN_SPEAKING` → `ru`; иначе `en`.
- `langOf(user, telegram = '')`: `user.lang` в словарях → он; иначе `telegram` → `user.tg_lang` (в словарях) → `ru`.
- Приложение (`02-core`): та же `telegramLanguage` по данным `BOOT.rule` (`languages`, `russian`, `fallback`) — сверяется
  тестом с сервером на таблице кодов.

## 2. Где язык берётся и запоминается

- Точки входа: `handleApi` (`initData` → `user.language_code`), `openChat` и `handleCallback` бота (`from.language_code`),
  `onSignupButton`. Каждая: `openContext(env, id, { telegramLang })` → `await syncLanguage(ctx)`.
- `openContext`: `ctx.telegramLang = telegramLanguage(code)`, `ctx.lang = langOf(me, ctx.telegramLang)`.
- `syncLanguage(ctx)`: запись есть, `telegramLang` не пуст и ≠ `tg_lang` → `UPDATE users SET tg_lang`; затем кнопка меню
  (раздел 5). Ни одного запроса, если ничего не изменилось.
- `createUserStmt(db, id, username, { …, tg_lang })` — бот передаёт `ctx.telegramLang`.
- Очередь: `flushOutbox` выбирает `lang` и `tg_lang` получателя, собирает на `langOf(r)`.

## 3. API

`lang.set` — роль `USER`, без события. Запрос: `lang` — `''` (как в Telegram) или код из `LANGUAGES`. Ответ: `lang` — язык
человека после выбора. Отказ: 400 `api.lang.unknown` («Такого языка нет.»). Журнал — нет. Сообщений — нет.

`me` (зарегистрированному) — добавляется:
- `me.lang_choice` — `users.lang` (`''` — как в Telegram);
- `me.lang_auto` — язык по Telegram (`telegramLang || tg_lang || 'ru'`) — для подписи «Как в Telegram (…)»;
- `languages` — `[{ code, name }]` в порядке `LANGUAGES`, `name` — на самом языке.

Слово подтверждения: `confirmed` сравнивает `foldWord(body.confirm, lang) === foldWord(слово языка, lang)`;
`foldWord(s, lang) = String(s).trim().toLocaleUpperCase(lang).normalize('NFD').replace(/\p{M}/gu, '')`. Приложение
(`typedSheet`) — та же функция.

## 4. Бот

- `/language` — любой человек с записью (до регистрации тоже): сообщение `bot.lang.choose` с кнопками: первая строка —
  `bot.lang.auto` («Как в Telegram (<название>)», `lang:auto`), далее языки по 2 в ряд (`lang:<код>`, название; у
  текущего выбора — «✓ » перед названием). Без записи — как прочий текст незнакомца.
- Кнопка `lang:auto` | `lang:<код>` — до проверки «зарегистрирован»; неизвестный код — ответ `api.lang.unknown`; иначе
  `setLanguage`, ответ на нажатие `bot.lang.saved` на новом языке, затем: зарегистрированному — меню на новом языке; с
  ожиданием имени — просьба имени на нём.
- Команды бота: `start`, `language`, `cancel` (описания — `setup.command.*`).

## 5. Кнопка меню и команды чата

- Кнопка меню (`syncLanguage`, после записи `tg_lang` и в `setLanguage`): запись есть и `settings.base_url` задан;
  `L = langOf(me, telegramLang)`; `L ≠ 'ru'` и `menu_lang ≠ L` → `setChatMenuButton { chat_id, menu_button: { type:
  'web_app', text: setup.menuButton (L), web_app: { url: base_url + '/app' } } }`, `menu_lang = L`; `L = 'ru'` и
  `menu_lang ≠ ''` → `setChatMenuButton { chat_id, menu_button: { type: 'default' } }`, `menu_lang = ''`. Ошибка —
  журнал Worker, `menu_lang` всё равно пишется.
- Команды чата — только в `setLanguage`: выбор `X ≠ ''` → `setMyCommands { commands (X), scope: { type: 'chat', chat_id
  } }`; `''` → `deleteMyCommands { scope: { type: 'chat', chat_id } }`.

## 6. Профиль бота

- `PROFILE_TARGETS` — `[[language_code, язык текстов]]`: `['', 'en']`, `ru`, `es`, `pt`, `fr`, `de`, `zh`, `it`, `tr`,
  `id`, `pl` (сами на себя), `be`…`tk` → `ru`. Вызовы цели: `setMyCommands { commands, language_code? }`,
  `setMyDescription { description, language_code? }`, `setMyShortDescription { short_description, language_code? }`
  (`language_code` не передаётся у `''`).
- `PROFILE_VERSION` — отпечаток JSON списка вызовов. `profileFrom(settings)`: нет `base_url` → не нужно; `bot_profile` с
  этой версией и следующим = числу вызовов → не нужно; та же версия → следующий; иначе 0.
- Обращение (API, `/tg`): `openContext` по прочитанным настройкам отмечает `env.meter.profile = from`; `afterRequest` —
  после отправки очереди `sendProfile(env, from)`: вызовы по порядку, пока `budgetLeft(env) > 4`; ошибка вызова — журнал
  Worker `bot profile: <метод> <код>: <описание>`, дальше; в конце одна запись `bot_profile`.
- `/setup`: после `getMe`, `setWebhook`, `setChatMenuButton` (общая, русская) — `sendProfile(env, 0)`; шаг «Команды» —
  результат первого вызова (`setMyCommands` по умолчанию); строка `setup.profileLater`, если отправлено не всё.
- Пределы Telegram (тест): описание команды 1…256, описание ≤ 512, краткое ≤ 120.

## 7. Журнал

- `auditStmt`/`auditIfStmt`: `details` — как прежде (`render(…, 'ru')`, ≤ 500); `details_tx` — `JSON.stringify(details)`,
  если `details` — отложенный текст и JSON ≤ 2000, иначе `''`.
- `getAudit(db, sphere, t, limit)` — `details` записи = `render(JSON.parse(details_tx), t.lang)` (≤ 500) или `details`.

## 8. Приложение

- Страница: `BOOT = { texts: { <язык>: { app.boot.* } }, rule: { languages, russian, fallback } }`; язык загрузки —
  `telegramLanguage(tg.initDataUnsafe?.user?.language_code || navigator.language)`.
- «Профиль» (`personalSections`, `03-home`): карточка «🌐 Язык» (`app.home.lang.button`, подпись — название языка или «Как
  в Telegram (…)») → `openLangSheet` (`03-home`): строки «Как в Telegram (…)» и языки, ✓ у выбора; нажатие —
  `api('lang.set')`, `closeSheet()`, `reloadMe()` (новый словарь), `render()` с прежней прокруткой.
- `typedSheet` — `foldWord`.

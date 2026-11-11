---

description: "Задачи: переписка Санты и подопечного; лимит по символам"
---

# Tasks: Переписка Санты и подопечного; лимит письма по символам Telegram

**Input**: `/specs/003-santa-ward-chat/` · **Tests**: да

## Phase 1: Foundational

- [X] T301 Таблица `messages` и индекс в `src/db.js`
- [X] T302 `MAX_CHARS = 4000`, функции переписки (сохранить + уведомить, удалить при смене пар/удалении/новой игре) в `src/game.js`

## Phase 2: User Story 3 — Лимит по символам (P1)

- [X] T303 [US3] Лимит 4000 символов в `wishlist.save`, `limits.chars` в `me` (`src/api.js`)
- [X] T304 [US3] Счётчик «N / 4000 символов» во вкладке «Письмо» (`src/app.html`)

## Phase 3: User Story 1 — Переписка (P1) 🎯

- [X] T305 [P] [US1] Компоненты `ds-chat`, `ds-composer`, `ds-badge`, `ds-sheet--full` + токены, витрина, README дизайн-системы
- [X] T306 [US1] `chat.get`, обновлённый `message.send` (`src/api.js`), `sendAnonymous` пишет в переписку (`src/bot.js`)
- [X] T307 [US1] Экран переписки, кнопки «💬 Написать Санте/подопечному» вместо старых форм (`src/app.html`)

## Phase 4: User Story 2 — Уведомления и непрочитанные (P1)

- [X] T308 [US2] Уведомление с кнопками «↩️ Ответить» и «💬 Вся переписка»; меню бота (`src/bot.js`, `src/game.js`)
- [X] T309 [US2] `unread` в `me`, отметка прочтения, числа на кнопках и точки на вкладках, открытие по `?chat=` (`src/api.js`, `src/app.html`)
- [X] T310 [US2] Опрос новых сообщений каждые 6 с в открытой переписке (`src/app.html`)

## Phase 5: Polish

- [X] T311 e2e: переписка, ответ через бота, непрочитанные, изоляция пар, лимиты (`tests/e2e.test.mjs`)
- [X] T312 [P] Скриншоты переписки (`tests/screenshots.mjs`)
- [X] T313 [P] README: переписка, лимит 4000 символов; CLAUDE.md: фича 003; контракты 001 → ссылка на 003
- [X] T314 Прогон quickstart

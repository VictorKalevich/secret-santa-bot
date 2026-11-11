---

description: "Задачи: роли владелец/админ и читаемость выбранных элементов"
---

# Tasks: Роли «владелец» и «администратор»; читаемость выбранных элементов

**Input**: Design documents from `/specs/002-admin-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/roles.md

**Tests**: да — правило специфичности, e2e-сценарий ролей, проверка вычисленных цветов.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T101 Пометить в контрактах 001 (`bot-chat.md`, `mini-app-api.md`) изменения ролей ссылкой на `specs/002-admin-roles/contracts/roles.md`

## Phase 2: Foundational

- [X] T102 `resolveOwner` и `setOwner` (FR-101, FR-109) в `src/game.js`

## Phase 3: User Story 4 — Читаемые выбранные вкладки и кнопки (P1, исправление)

- [X] T103 [US4] Базовые стили элементов через `:where()`; подпись вкладки 13 px в `design-system/components.css`
- [X] T104 [P] [US4] Тест «базовые селекторы элементов только в `:where()`» в `tests/design-system.test.mjs`
- [X] T105 [P] [US4] Проверка вычисленных цветов вкладки и кнопок (светлая и тёмная тема) в `tests/screenshots.mjs`
- [X] T106 [P] [US4] Правило специфичности в `design-system/README.md`

## Phase 4: User Story 1 — Назначение и снятие админов (P1) 🎯

- [X] T107 [US1] `grantAdmin`, `revokeAdmin` + сообщения (FR-103, FR-104, FR-107) в `src/game.js`
- [X] T108 [US1] API `admin.role.grant`, `admin.role.revoke`; `is_owner` в `me` и `admin.state` в `src/api.js`
- [X] T109 [US1] Раздел «Администраторы» (список, назначить, снять) в `src/app.html`

## Phase 5: User Story 2 — Защита от «захвата» (P1)

- [X] T110 [US2] Запрет удаления владельца и удаления админов не-владельцем (FR-106) в `src/api.js`
- [X] T111 [US2] Скрыть 🗑 у владельца и у админов для не-владельца; подсказка для админов в `src/app.html`

## Phase 6: User Story 3 — Передача владения и восстановление (P2)

- [X] T112 [US3] `admin.owner.transfer` (FR-105) в `src/api.js` / `src/game.js`
- [X] T113 [US3] Ссылка `adm_` делает владельцем, предупреждение прежнему (FR-102); текст меню в `src/bot.js`
- [X] T114 [US3] «Ссылка владельца» на странице `/setup` в `src/index.js`
- [X] T115 [US3] Кнопка «Передать владение» в разделе «Администраторы» в `src/app.html`

## Phase 7: Polish

- [X] T116 e2e-сценарий ролей в `tests/e2e.test.mjs` (US1–US3, защита, ссылка владельца, сообщения)
- [X] T117 [P] README: раздел «Роли»; CLAUDE.md: фича 002
- [X] T118 Прогон quickstart: `npm test`, `npm run test:e2e`, `npm run screenshots`

## Dependencies

T102 → T107–T115. US4 независима (можно первой). T116 — после US1–US3.

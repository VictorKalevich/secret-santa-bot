# Quickstart: проверка фичи 025

## Быстрые тесты

```powershell
npm test                                   # всё, в т.ч. новый tests/behavior.test.mjs
node --test tests/behavior.test.mjs        # слово служебного просмотра, журнал rename, заявка в завершённом, перенос
node --test tests/data-registry.test.mjs   # «кто сделал» переносится, у старого аккаунта — только очередь
node --test tests/api-refusals.test.mjs    # эталон: изменены 10 ответов (research R5), добавлены 4 случая
node --test tests/atomic.test.mjs          # admin.rename ×2 в одну миллисекунду — одна запись (44 проверки)
node tests/bench/queries.mjs               # число запросов admin.rename, admin.transfer, admin.vault.* — прежнее
```

Ожидается: всё зелёное; `queries` — прежние числа.

## Сквозной сценарий и экран

```powershell
npm run test:e2e      # служебный просмотр со словом, перенос, заявки
npm run screenshots   # 19-vault-gate, 20-vault-person, 21-vault-pairs — данные открываются после ввода слова
```

Вручную (по желанию, `npm run dev`): завершить событие с ожидающей заявкой — в панели раздел «Заявки» с одной кнопкой
«Отклонить»; переименовать участника — в общем журнале «✏️ Переименован: старое → новое».

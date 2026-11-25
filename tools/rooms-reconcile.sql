-- 063: сверка после выката кода 063 (specs/063-events-without-rooms/quickstart.md) и после возврата к нему с прежней
-- версии. Прежний код между миграцией 0024 и выкатом мог создать событие в комнате: у такого события нет ни одной строки
-- event_admins, а company_id != 0 (новый код пишет 0). Ему — организаторы и владелец по правилу миграции, всем событиям —
-- факт создания. Уже перенесённые события не трогает (снятых владельцем организаторов не возвращает), разрешения на
-- создание не меняет. Схему не меняет; повтор ничего не меняет.
-- npx wrangler d1 execute <база> [--env second] --remote --file tools/rooms-reconcile.sql

INSERT OR IGNORE INTO event_admins (event_id, user_id, created_at)
SELECT e.id, cm.user_id, cm.joined_at
  FROM events e
  JOIN company_members cm ON cm.company_id = e.company_id AND cm.is_admin = 1
 WHERE e.company_id != 0
   AND e.owner_id = 0
   AND NOT EXISTS (SELECT 1 FROM event_admins a WHERE a.event_id = e.id);

UPDATE events
   SET owner_id = COALESCE(
         NULLIF((SELECT c.owner_id FROM companies c WHERE c.id = events.company_id), 0),
         (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'),
         0)
 WHERE owner_id = 0 AND company_id != 0;

INSERT OR IGNORE INTO event_admins (event_id, user_id, created_at)
SELECT id, owner_id, created_at FROM events WHERE owner_id != 0;

INSERT OR IGNORE INTO event_creations (event_id, user_id, created_at)
SELECT id, created_by, created_at FROM events WHERE created_by != 0;

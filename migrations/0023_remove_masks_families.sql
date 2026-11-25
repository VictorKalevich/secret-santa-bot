-- 062: без масок Санты и семей (specs/062-remove-masks-families/). Семьи событий с «Учитывать семьи» (идущих и
-- завершённых) становятся взаимными исключениями участников, маски Санты стираются, записи семей удаляются. Таблицы
-- families, family_members и колонки events.families_on, pairs.mask остаются: прежний код (061) их читает — откат возможен.
-- Применяется ДО выката кода (код 062 требует схему 23, прежний — не ниже 22). После выката — та же сверка
-- tools/masks-families-reconcile.sql (то, что прежний код успел создать между миграцией и выкатом).

INSERT OR IGNORE INTO exclusions (event_id, giver, receiver)
SELECT e.id, a.user_id, b.user_id
  FROM events e
  JOIN family_members a ON a.company_id = e.company_id
  JOIN family_members b ON b.family_id = a.family_id AND b.user_id <> a.user_id
 WHERE e.families_on = 1
   AND EXISTS (SELECT 1 FROM members m WHERE m.event_id = e.id AND m.user_id = a.user_id)
   AND EXISTS (SELECT 1 FROM members m WHERE m.event_id = e.id AND m.user_id = b.user_id);

UPDATE pairs SET mask = '' WHERE mask <> '';

DELETE FROM family_members;

DELETE FROM families;

INSERT INTO settings (key, value) VALUES ('schema', '23') ON CONFLICT(key) DO UPDATE SET value = excluded.value;

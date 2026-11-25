-- 062: сверка после выката кода 062 (specs/062-remove-masks-families/quickstart.md) и после возврата к нему с прежней
-- версии. Прежний код между миграцией 0023 и выкатом мог создать семью или надеть маску: семьи событий с «Учитывать
-- семьи» становятся исключениями, маски стираются, семьи удаляются — те же операторы, что в 0023_remove_masks_families.sql.
-- Схему не меняет; повтор ничего не меняет.
-- npx wrangler d1 execute <база> [--env second] --remote --file tools/masks-families-reconcile.sql

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

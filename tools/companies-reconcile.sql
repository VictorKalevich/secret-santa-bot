-- Сверка компаний (050, specs/050-company-scope/data-model.md, «Сверка»). Идемпотентна: повтор ничего не меняет.
-- Выполнять после выката кода 050 и после возврата с прежней версии кода (прежний код не пишет строк компаний и меняет
-- только общий признак users.is_admin):
--   npx wrangler d1 execute secret-santa-db --remote --file tools/companies-reconcile.sql
-- Это не копия базы и не миграция: версия схемы не меняется.

-- 1. I5: участники событий, авторы заявок и ждущие имени по ссылке события (pending = 'name:<событие>:<код>') —
--    люди компании этого события
INSERT OR IGNORE INTO company_members (company_id, user_id, is_admin, joined_at)
  SELECT e.company_id, m.user_id, 0, m.joined_at FROM members m JOIN events e ON e.id = m.event_id
  UNION ALL
  SELECT e.company_id, r.user_id, 0, r.created_at FROM join_requests r JOIN events e ON e.id = r.event_id
  UNION ALL
  SELECT e.company_id, u.tg_id, 0, u.created_at FROM users u
    JOIN events e ON e.id = CAST(substr(u.pending, 6, instr(substr(u.pending, 6) || ':', ':') - 1) AS INTEGER)
   WHERE u.pending LIKE 'name:%';

-- 2. I2: владелец бота — администратор каждой компании, которую он ведёт (owner_id = 0)
INSERT INTO company_members (company_id, user_id, is_admin, joined_at)
  SELECT c.id, u.tg_id, 1, u.created_at FROM companies c
    JOIN users u ON u.tg_id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id')
   WHERE c.owner_id = 0
  ON CONFLICT (company_id, user_id) DO UPDATE SET is_admin = 1 WHERE is_admin != 1;

-- 3. Только при одной компании в базе: права в ней = общий признак, который менял прежний код. Человек с признаком без
--    строки компании (назначен прежним кодом, не участвуя в событиях) получает строку администратора
INSERT INTO company_members (company_id, user_id, is_admin, joined_at)
  SELECT (SELECT MIN(id) FROM companies), u.tg_id, u.is_admin, u.created_at FROM users u
   WHERE (SELECT COUNT(*) FROM companies) = 1
     AND (u.is_admin = 1 OR EXISTS (SELECT 1 FROM company_members cm WHERE cm.user_id = u.tg_id))
  ON CONFLICT (company_id, user_id) DO UPDATE SET is_admin = excluded.is_admin WHERE is_admin != excluded.is_admin;

-- 4. I4: общий признак — «администратор хотя бы в одной компании или владелец бота» (как adminFlagStmt в src/db.js)
UPDATE users SET is_admin = (
    EXISTS (SELECT 1 FROM company_members WHERE user_id = users.tg_id AND is_admin = 1)
    OR tg_id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'))
 WHERE is_admin != (
    EXISTS (SELECT 1 FROM company_members WHERE user_id = users.tg_id AND is_admin = 1)
    OR tg_id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'));

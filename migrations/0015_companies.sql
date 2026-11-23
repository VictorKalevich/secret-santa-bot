-- 050: компании, шаг 1 — данные и права в пределах компании. Применяется ДО выката кода: прежний код на схеме 17
-- работает (новые колонки — с умолчанием 1, прежние колонки на месте). Все прежние данные — в компании №1 «Основная».

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL DEFAULT 0,
  owner_code TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_owner_code ON companies (owner_code) WHERE owner_code != '';

-- Человек компании; is_admin — права в этой компании (users.is_admin — производный общий признак)
CREATE TABLE IF NOT EXISTS company_members (
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  joined_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS company_members_user ON company_members (user_id);

INSERT INTO companies (id, name, created_at) VALUES (1, 'Основная', CAST(strftime('%s', 'now') AS INTEGER) * 1000);

INSERT INTO company_members (company_id, user_id, is_admin, joined_at)
  SELECT 1, tg_id, is_admin, created_at FROM users;

ALTER TABLE events ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS events_company ON events (company_id);

ALTER TABLE families ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;

ALTER TABLE audit ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS audit_company ON audit (company_id, event_id, id);

-- Человек — не больше чем в одной семье в каждой компании
CREATE TABLE family_members_new (
  company_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL,
  family_id INTEGER NOT NULL,
  PRIMARY KEY (company_id, user_id)
);

INSERT INTO family_members_new (company_id, user_id, family_id) SELECT 1, user_id, family_id FROM family_members;

DROP TABLE family_members;

ALTER TABLE family_members_new RENAME TO family_members;

CREATE INDEX IF NOT EXISTS family_members_family ON family_members (family_id);

UPDATE settings SET value = '17' WHERE key = 'schema';

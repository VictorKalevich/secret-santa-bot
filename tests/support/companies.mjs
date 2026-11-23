// Компании в тестах (050, specs/050-company-scope/contracts/company-scope.md, раздел 8).
//   addCompany(w, name) → id: единственная прямая запись в базу — строка companies; дальше компания наполняется
//     настоящими действиями (владелец бота создаёт в ней событие с { company }, люди входят по ссылке, администратор
//     назначается admin.role.grant { company, id });
//   invariants(w, { guests }) → список нарушений инвариантов I1–I6 (data-model.md); пустой — всё верно. guests — компании,
//     где владелец бота намеренно гость (строки нет): I2 для них не проверяется (research.md, R15).

export function addCompany(w, name = 'Вторая') {
  return w.query('INSERT INTO companies (name, created_at) VALUES (?, ?) RETURNING id', name, Date.now())[0].id;
}

export function invariants(w, { guests = [] } = {}) {
  const out = [];
  const add = (code, rows, text) => {
    for (const r of rows) out.push(`${code}: ${text(r)}`);
  };
  const companies = 'SELECT id FROM companies';
  // I1: события, семьи и строки семей — в существующей компании; строка семьи — в компании своей семьи
  add('I1', w.query(`SELECT id, company_id FROM events WHERE company_id NOT IN (${companies})`), (r) => `событие ${r.id} в компании ${r.company_id}`);
  add('I1', w.query(`SELECT id, company_id FROM families WHERE company_id NOT IN (${companies})`), (r) => `семья ${r.id} в компании ${r.company_id}`);
  add('I1', w.query(
    `SELECT fm.user_id, fm.family_id, fm.company_id, f.company_id AS family_company
       FROM family_members fm LEFT JOIN families f ON f.id = fm.family_id
      WHERE f.id IS NULL OR fm.company_id != f.company_id OR fm.company_id NOT IN (${companies})`
  ), (r) => `строка семьи ${r.family_id} человека ${r.user_id}: компания ${r.company_id}, у семьи — ${r.family_company}`);
  // I2: владелец бота — администратор каждой компании, которую он ведёт
  const owner = Number(w.query("SELECT value FROM settings WHERE key = 'owner_id'")[0]?.value || 0);
  if (owner) {
    add('I2', w.query(
      `SELECT c.id FROM companies c WHERE c.owner_id = 0
          AND NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id AND cm.user_id = ? AND cm.is_admin = 1)`,
      owner
    ).filter((r) => !guests.includes(r.id)), (r) => `у владельца бота нет прав в компании ${r.id}`);
  }
  // I3: назначенный владелец компании — её администратор
  add('I3', w.query(
    `SELECT c.id, c.owner_id FROM companies c WHERE c.owner_id != 0
        AND NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id AND cm.user_id = c.owner_id AND cm.is_admin = 1)`
  ), (r) => `владелец ${r.owner_id} компании ${r.id} не её администратор`);
  // I4: общий признак = «админ хотя бы где-то или владелец бота»
  add('I4', w.query(
    `SELECT tg_id, is_admin FROM users u
      WHERE is_admin != (EXISTS (SELECT 1 FROM company_members cm WHERE cm.user_id = u.tg_id AND cm.is_admin = 1) OR u.tg_id = ?)`,
    owner
  ), (r) => `у ${r.tg_id} users.is_admin = ${r.is_admin}`);
  // I5: участник события — человек компании события
  add('I5', w.query(
    `SELECT m.event_id, m.user_id, e.company_id FROM members m JOIN events e ON e.id = m.event_id
      WHERE NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = e.company_id AND cm.user_id = m.user_id)`
  ), (r) => `участник ${r.user_id} события ${r.event_id} не человек компании ${r.company_id}`);
  // I6: члены семьи — люди компании семьи
  add('I6', w.query(
    `SELECT fm.user_id, fm.family_id, f.company_id FROM family_members fm JOIN families f ON f.id = fm.family_id
      WHERE NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = f.company_id AND cm.user_id = fm.user_id)`
  ), (r) => `член семьи ${r.family_id} ${r.user_id} не человек компании ${r.company_id}`);
  return out;
}

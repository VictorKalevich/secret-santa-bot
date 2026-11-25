// События и их организаторы в тестах (063, specs/063-events-without-rooms/data-model.md). Всё — настоящими действиями:
//   newEvent(w, owner, title, { participate }) → id: event.create (по умолчанию владелец не участвует);
//   inviteCode(w, admin, id) → код ссылки inv_… из admin.state;
//   join(w, user, code): переход по ссылке (новый человек пишет имя);
//   grant(w, owner, id, user): user вступает (если ещё не участник) и владелец назначает его администратором события;
//   allowCreate(w, boss, user): владелец бота разрешает создавать события (закрытый бот);
//   invariants(w) → список нарушений инвариантов E1–E4; пустой — всё верно.

export async function newEvent(w, owner, title, { participate = false } = {}) {
  return (await w.api(owner, 'event.create', { participate, title })).event.id;
}

export async function inviteCode(w, admin, id) {
  return /start=(inv_[a-z0-9]+)/.exec((await w.api(admin, 'admin.state', { event: id })).settings.invite_link)[1];
}

export async function join(w, user, code) {
  const known = w.query('SELECT registered FROM users WHERE tg_id = ?', user.id)[0]?.registered;
  await w.say(user, '/start ' + code);
  if (!known) await w.say(user, user.name);
}

export async function grant(w, owner, id, user) {
  if (!w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', id, user.id).length) await join(w, user, await inviteCode(w, owner, id));
  await w.api(owner, 'admin.role.grant', { event: id, id: user.id });
}

export async function allowCreate(w, boss, user) {
  await w.api(boss, 'bot.creator.set', { id: user.id, on: true });
}

export function invariants(w) {
  const out = [];
  const add = (code, rows, text) => {
    for (const r of rows) out.push(`${code}: ${text(r)}`);
  };
  // E1: владелец события — его организатор
  add('E1', w.query(
    `SELECT id, owner_id FROM events e WHERE owner_id != 0
        AND NOT EXISTS (SELECT 1 FROM event_admins a WHERE a.event_id = e.id AND a.user_id = e.owner_id)`
  ), (r) => `владелец ${r.owner_id} события ${r.id} не его организатор`);
  // E2: общий признак = «организатор хотя бы одного события или владелец бота»
  const owner = Number(w.query("SELECT value FROM settings WHERE key = 'owner_id'")[0]?.value || 0);
  add('E2', w.query(
    `SELECT tg_id, is_admin FROM users u
      WHERE is_admin != (EXISTS (SELECT 1 FROM event_admins a WHERE a.user_id = u.tg_id) OR u.tg_id = ?)`,
    owner
  ), (r) => `у ${r.tg_id} users.is_admin = ${r.is_admin}`);
  // E3: у события, созданного новым кодом, есть факт создания
  add('E3', w.query(
    `SELECT id FROM events e WHERE company_id = 0 AND NOT EXISTS (SELECT 1 FROM event_creations c WHERE c.event_id = e.id)`
  ), (r) => `у события ${r.id} нет факта создания`);
  // E4: новые события и записи журнала — вне комнат
  add('E4', w.query('SELECT id, company_id FROM events WHERE company_id != 0'), (r) => `событие ${r.id} в комнате ${r.company_id}`);
  add('E4', w.query('SELECT id, company_id FROM audit WHERE company_id != 0'), (r) => `запись журнала ${r.id} в комнате ${r.company_id}`);
  return out;
}

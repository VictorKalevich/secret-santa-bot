// Компании (051, specs/051-companies/): создание, названия, владелец компании (назначение, передача, «Вести самому» —
// одно правило ownerChange; одноразовая ссылка владельца own_<код>), удаление пустой компании, журнал бота, список
// компаний человека. Действия bot.* вызывает только владелец бота (конвейер api.js). Названия компаний (владельца бота —
// companies.name, свои — company_members.label) и ссылка владельца не уходят никому, кроме автора (Конституция 3.0.0).

import { readMany, adminFlagStmt, companyDataDeleteStmts, getAudit, BOT_LOG } from './db.js';
import { msg, escapeHtml, displayName, appKeyboard, adminRecipients, oneLine, randomCode, COMPANY_NOT_FOUND } from './format.js';
import { atomic } from './claim.js';
import { no } from './result.js';

const NAME_MAX = 40;
// Своих компаний во владении у человека открытого бота (052)
const OWN_MAX = 2;
const OWN_LIMIT = 'Вести можно не больше двух своих комнат — передай или удали одну из них.';
const RECENT = 'Комната с таким названием только что создана.';
const NAME_RULE = 'Название комнаты — от 1 до 40 символов.';
const LABEL_RULE = 'Название — до 40 символов.';
const HAS_EVENTS = 'В комнате есть события — сначала удали их.';
const OWN_DELETE = 'Удалить комнату может только её владелец.';
const SETUP_FIRST = 'Сначала открой страницу настройки /setup (см. README).';
// Двойное нажатие «Создать» (опора — запись журнала бота, как у рассылок 024)
const REPEAT_MS = 60 * 1000;
const RECENT_CREATE = `NOT EXISTS (SELECT 1 FROM audit WHERE company_id = 0 AND event_id = 0 AND action = 'company.create'
  AND actor = ? AND details = ? AND created_at > ?)`;
export const OWNER_LINK_GONE = 'Эта ссылка владельца уже использована или отозвана. Попроси новую.';
export const NEW_COMPANY_OWNER = '👑 Ты — владелец своей комнаты в «Тайном Санте»: создаёшь события, приглашаешь людей, назначаешь администраторов.';
const TRANSFER_TARGET = 'Передать права владельца можно только зарегистрированному человеку.';

// Открытый бот (052): создавать компании может любой человек. Признак — настройка выката (vars окружения), читается
// только здесь
export const openBot = (env) => env.OPEN_BOT === '1';

const NUMBERED = (n) => `Комната ${n}`;
const linkOf = (settings, code) => `https://t.me/${settings.bot_username}?start=own_${code}`;
const quoted = (name) => `«${escapeHtml(name)}»`;

// ---------- список компаний человека ----------

// Видимые компании и их названия (data-model 051, «Видимость компании», «Название»). companies — ctx.companies(), mine —
// ctx.mine() (свои строки со временем вступления), memberOf — компании событий, где он участник. Порядок: владельцу бота —
// по id, остальным — по времени вступления; номер «Компания N» — среди всех его строк и не меняется, когда другая компания
// пропадает из видимых. Общее название (052, shared) люди компании видят вместо «Компания N»; своё важнее
export function visibleCompanies({ companies, mine, memberOf, botOwner, meId }) {
  const order = [...mine].sort(([ia, a], [ib, b]) => a.joined_at - b.joined_at || ia - ib).map(([id]) => id);
  const number = new Map(order.map((id, i) => [id, i + 1]));
  const ids = botOwner
    ? [...companies.keys()].sort((a, b) => a - b)
    : order.filter((id) => companies.has(id) && (mine.get(id).is_admin || companies.get(id).owner_id === meId || memberOf.has(id)));
  return ids.map((id) => {
    const c = companies.get(id);
    const label = mine.get(id)?.label || '';
    return { id, title: botOwner ? c.name : label || (c.shared ? c.name : NUMBERED(number.get(id))), named: botOwner || !!label };
  });
}

// Названия видимых компаний для меню бота (051, FR-5126): компаний две и больше — id → название, иначе null
export async function menuCompanyTitles(ctx, meId, memberOf) {
  const [companies, mine, botOwnerId] = await Promise.all([ctx.companies(), ctx.mine(), ctx.botOwnerId()]);
  const list = visibleCompanies({ companies, mine, memberOf, botOwner: botOwnerId === meId, meId });
  return list.length >= 2 ? new Map(list.map((c) => [c.id, c.title])) : null;
}

// Чтения для me (в пакете homeView): имена владельцев компаний — его компаний (055; meId — 0: владельцу бота — всех);
// владельцу бота — число людей в компаниях
export const companyOwnersQuery = (db, botOwnerId, meId = 0) => (meId
  ? db.prepare(
    `SELECT tg_id, name FROM users
      WHERE tg_id IN (SELECT c.owner_id FROM company_members cm JOIN companies c ON c.id = cm.company_id WHERE cm.user_id = ?)
         OR tg_id = ?`
  ).bind(meId, botOwnerId || 0)
  : db.prepare('SELECT tg_id, name FROM users WHERE tg_id IN (SELECT owner_id FROM companies) OR tg_id = ?').bind(botOwnerId || 0));
export const companyPeopleQuery = (db) => db.prepare('SELECT company_id, COUNT(*) AS n FROM company_members GROUP BY company_id');

// me.companies (контракт 051, раздел 2): роль, признаки прав, владелец по имени, события, видимые человеку, и непрочитанное.
// events — события, видимые человеку (с company и unread), owners — строки companyOwnersQuery, people — companyPeopleQuery.
// 052 (контракт specs/052-open-bot/contracts/open-bot.md, раздел 2): shared — название общее, rename — он меняет общее
// название, deletable — он удаляет свою компанию (открытый бот, open); поля — только когда верны
export function companiesView({ companies, mine, memberOf, botOwner, botOwnerId, meId, events, owners, people, open = false }) {
  const names = new Map(owners.map((u) => [u.tg_id, u.name]));
  const count = new Map(people.map((r) => [r.company_id, r.n]));
  return visibleCompanies({ companies, mine, memberOf, botOwner, meId }).map(({ id, title, named }) => {
    const c = companies.get(id);
    const row = mine.get(id);
    const ownerId = c.owner_id || botOwnerId;
    const role = ownerId === meId ? 'owner' : row?.is_admin ? 'admin' : row ? 'member' : 'guest';
    const own = events.filter((e) => e.company === id);
    return {
      id, title, named, role,
      organizer: botOwner || role === 'owner' || role === 'admin',
      owner: botOwner || role === 'owner',
      bot_run: !c.owner_id,
      owner_name: names.get(ownerId) || '',
      events: own.length,
      active: own.filter((e) => e.status === 'active').length,
      unread: own.reduce((n, e) => n + e.unread, 0),
      ...(botOwner ? { people: count.get(id) || 0, owner_id: c.owner_id, link: c.link } : {}),
      ...(c.shared ? { shared: true } : {}),
      ...(c.shared && !botOwner && c.owner_id === meId ? { rename: true } : {}),
      ...(open && !botOwner && c.owner_id === meId ? { deletable: true } : {}),
    };
  });
}

// ---------- создание и названия ----------

const companyName = (raw) => {
  const name = oneLine(raw);
  return name && name.length <= NAME_MAX ? name : '';
};

// bot.company.create: компания, строка владельца бота в ней (администратор — инвариант I2), запись журнала бота. По
// прежнему состоянию (020): всё — пока за минуту не было записи «создана» с тем же названием от него, запись — последней
export async function createCompany(ctx, raw) {
  const { db, me } = ctx;
  const name = companyName(raw);
  if (!name) return no(NAME_RULE);
  const now = Date.now();
  const details = `«${name}»`;
  const a = atomic(db, RECENT_CREATE, me.tg_id, details, now - REPEAT_MS);
  a.add(db.prepare(`INSERT INTO companies (name, created_by, created_at) SELECT ?, ?, ? WHERE ${a.sql} RETURNING id`)
    .bind(name, me.tg_id, now, ...a.args));
  a.select('INSERT INTO company_members (company_id, user_id, is_admin, joined_at) SELECT (SELECT MAX(id) FROM companies WHERE owner_id = 0 AND created_by = ? AND created_at = ?), ?, 1, ?',
    me.tg_id, now, me.tg_id, now);
  a.claim(a.audit(BOT_LOG, me.tg_id, 'company.create', details));
  const r = await a.run();
  if (!r.won) return no(RECENT);
  return { ok: true, company: r.results[0].results[0].id };
}

// company.create человеком открытого бота (052, research R3): компания с владельцем-создателем и общим названием. Лимит
// OWN_MAX — условие только самой вставки (она сама меняет счёт); строка человека компании (администратор — I3), общий
// признак (I4) и запись журнала бота (захват) — пока «эта вставка состоялась» и за минуту не было такой же записи.
// Проигравшему — отказ по свежему состоянию в порядке контракта: лимит, затем повтор
export async function createOwnCompany(ctx, raw) {
  const { db, me } = ctx;
  const name = companyName(raw);
  if (!name) return no(NAME_RULE);
  const now = Date.now();
  const details = `«${name}»`;
  const a = atomic(db, RECENT_CREATE, me.tg_id, details, now - REPEAT_MS);
  a.add(db.prepare(
    `INSERT INTO companies (name, owner_id, shared, created_by, created_at) SELECT ?, ?, 1, ?, ?
      WHERE ${a.sql} AND (SELECT COUNT(*) FROM companies WHERE owner_id = ?) < ? RETURNING id`
  ).bind(name, me.tg_id, me.tg_id, now, ...a.args, me.tg_id, OWN_MAX));
  const made = a.and('EXISTS (SELECT 1 FROM companies WHERE owner_id = ? AND created_by = ? AND created_at = ? AND name = ?)',
    me.tg_id, me.tg_id, now, name);
  made.select(
    `INSERT INTO company_members (company_id, user_id, is_admin, joined_at)
     SELECT (SELECT MAX(id) FROM companies WHERE owner_id = ? AND created_by = ? AND created_at = ? AND name = ?), ?, 1, ?`,
    me.tg_id, me.tg_id, now, name, me.tg_id, now,
  );
  made.add(adminFlagStmt(db, me.tg_id));
  made.claim(made.audit(BOT_LOG, me.tg_id, 'company.create', details));
  const r = await made.run();
  if (r.won) return { ok: true, company: r.results[0].results[0].id };
  const { owned } = await readMany(db, { owned: db.prepare('SELECT COUNT(*) AS n FROM companies WHERE owner_id = ?').bind(me.tg_id) });
  return no(owned[0].n >= OWN_MAX ? OWN_LIMIT : RECENT);
}

// me.create (052): владельцу бота — { bot: true }; человеку открытого бота — сколько ещё своих компаний он может создать;
// иначе null
export function createView({ companies, botOwner, open, meId }) {
  if (botOwner) return { bot: true };
  if (!open) return null;
  const owned = [...companies.values()].filter((c) => c.owner_id === meId).length;
  return { left: Math.max(0, OWN_MAX - owned) };
}

// Человек участвует хотя бы в одном событии компании
const memberInQuery = (db, companyId, userId) => db.prepare(
  'SELECT 1 AS yes FROM members m JOIN events e ON e.id = m.event_id WHERE e.company_id = ? AND m.user_id = ? LIMIT 1'
).bind(companyId, userId);

// Компания видна человеку (не владельцу бота) — правило visibleCompanies для одной компании
async function seenBy(ctx, companies, mine, id) {
  const row = mine.get(id);
  return !!row && (!!row.is_admin || companies.get(id).owner_id === ctx.me.tg_id
    || (await readMany(ctx.db, { m: memberInQuery(ctx.db, id, ctx.me.tg_id) })).m.length > 0);
}

// company.label.set: владельцу бота — название компании (1–40), остальным — своё название (до 40, пустое — сброс), только
// видимой компании. 052: владелец компании с общим названием меняет общее (1–40), своё название в том же пакете стирается.
// Без журнала и сообщений. → { title } — как её теперь покажет me
export async function setLabel(ctx, companyId, raw) {
  const { db, me } = ctx;
  const id = Number(companyId) || 0;
  const [companies, mine, botOwner] = await Promise.all([ctx.companies(), ctx.mine(), ctx.isBotOwner()]);
  if (!companies.has(id)) return no(COMPANY_NOT_FOUND, 404);
  const text = oneLine(raw);
  if (botOwner) {
    if (!text || text.length > NAME_MAX) return no(NAME_RULE);
    const a = atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ?)', id);
    a.claim(a.where('UPDATE companies SET name = ? WHERE id = ?', text, id));
    return (await a.run()).won ? { ok: true, title: text } : no(COMPANY_NOT_FOUND, 404);
  }
  const c = companies.get(id);
  if (c.shared && c.owner_id === me.tg_id) {
    if (!text || text.length > NAME_MAX) return no(NAME_RULE);
    const a = atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ? AND owner_id = ? AND shared = 1)', id, me.tg_id);
    a.where("UPDATE company_members SET label = '' WHERE company_id = ? AND user_id = ?", id, me.tg_id);
    a.claim(a.where('UPDATE companies SET name = ? WHERE id = ?', text, id));
    return (await a.run()).won ? { ok: true, title: text } : no(COMPANY_NOT_FOUND, 404);
  }
  const row = mine.get(id);
  if (!(await seenBy(ctx, companies, mine, id))) return no(COMPANY_NOT_FOUND, 404);
  if (text.length > NAME_MAX) return no(LABEL_RULE);
  const a = atomic(db, 'EXISTS (SELECT 1 FROM company_members WHERE company_id = ? AND user_id = ?)', id, me.tg_id);
  a.claim(a.where('UPDATE company_members SET label = ? WHERE company_id = ? AND user_id = ?', text, id, me.tg_id));
  if (!(await a.run()).won) return no(COMPANY_NOT_FOUND, 404);
  const [title] = visibleCompanies({ companies, mine: new Map([...mine, [id, { ...row, label: text }]]), memberOf: new Set([id]), botOwner, meId: me.tg_id })
    .filter((c) => c.id === id).map((c) => c.title);
  return { ok: true, title };
}

// ---------- владелец компании ----------

// Смена владельца компании — одно правило для назначения, передачи, «Вести самому» и ссылки (051, R2, R4). ctx — контекст
// компании. next — новый owner_id (0 — ведёт владелец бота), target — его запись (для 0 — владелец бота), actor — кто
// сменил (по ссылке — сам новый владелец), code — переход по ссылке. По прежнему состоянию (020): строки прав, сообщения
// и журнал — пока у компании прежний владелец (и, по ссылке, тот же код), смена — последней (захват). → won
async function ownerChange(ctx, { next, target, actor, code = '' }) {
  const { db } = ctx;
  const company = ctx.company;
  const cid = company.id;
  const [users, settings, botOwnerId] = await Promise.all([ctx.users(), ctx.settings(), ctx.botOwnerId()]);
  const prev = company.owner_id;
  const now = Date.now();
  const a = code
    ? atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ? AND owner_code = ? AND owner_id = ?)', cid, code, prev)
    : atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ? AND owner_id = ?)', cid, prev);
  // Новый владелец (или владелец бота, который снова ведёт компанию, — I2) — администратор компании
  const ownerRow = next || botOwnerId;
  a.add(db.prepare(
    `INSERT INTO company_members (company_id, user_id, is_admin, joined_at) SELECT ?, ?, 1, ? WHERE ${a.sql}
     ON CONFLICT(company_id, user_id) DO UPDATE SET is_admin = 1`
  ).bind(cid, ownerRow, now, ...a.args));
  // Компания уходит от владельца бота: дальше он в ней гость (строки нет), а если участвует в её событиях или семьях —
  // обычный человек компании
  if (!prev && next && botOwnerId) {
    a.where('UPDATE company_members SET is_admin = 0 WHERE company_id = ? AND user_id = ?', cid, botOwnerId);
    a.where(
      `DELETE FROM company_members WHERE company_id = ?1 AND user_id = ?2
          AND NOT EXISTS (SELECT 1 FROM members m JOIN events e ON e.id = m.event_id WHERE e.company_id = ?1 AND m.user_id = ?2)
          AND NOT EXISTS (SELECT 1 FROM family_members WHERE company_id = ?1 AND user_id = ?2)`,
      cid, botOwnerId,
    );
  }
  const who = `<b>${escapeHtml(displayName(target))}</b>`;
  const by = `<b>${escapeHtml(displayName(actor))}</b>`;
  const fromBot = actor.tg_id === botOwnerId;
  // Новому владельцу (по ссылке он получает ответ в чате сам); владельцу бота — только если компанию вернул ему другой
  if (next && !code) {
    const wasOrganizer = !!users.find((u) => u.tg_id === next)?.is_admin;
    a.enqueue(next, msg(wasOrganizer
      ? '👑 <b>Тебе переданы права владельца комнаты.</b> Теперь ты назначаешь и снимаешь администраторов, сбрасываешь и удаляешь события, открываешь служебный просмотр — всё в приложении.'
      : NEW_COMPANY_OWNER, appKeyboard(settings, '🛠 Открыть')));
  }
  if (!next && !fromBot) a.enqueue(botOwnerId, msg(`👑 ${by} передал(а) тебе комнату ${quoted(company.name)}: её снова ведёшь ты.`));
  // Прежний назначенный владелец остаётся администратором (передал сам — видит итог в приложении)
  if (prev && prev !== actor.tg_id) {
    a.enqueue(prev, msg(next
      ? `ℹ️ Права владельца комнаты теперь у ${who}. Ты остаёшься администратором.`
      : 'ℹ️ Комнату снова ведёт владелец бота. Ты остаёшься администратором.'));
  }
  // Владельцу бота — кто стал владельцем, если сменил не он (по ссылке — всегда)
  if (next && botOwnerId && (code || !fromBot)) {
    a.enqueue(botOwnerId, msg(code
      ? `👑 ${who}${target.username ? ` (@${escapeHtml(target.username)})` : ''} — теперь владелец комнаты ${quoted(company.name)}.`
      : `ℹ️ ${by} передал(а) права владельца комнаты ${quoted(company.name)}: теперь владелец — ${who}.`));
  }
  // Остальным администраторам компании — без звука
  for (const u of adminRecipients(users, [actor.tg_id, next, prev, botOwnerId])) {
    a.enqueue(u.tg_id, msg(`ℹ️ ${who} теперь владелец.`, { disable_notification: true }));
  }
  const name = displayName(target);
  const details = code ? `по ссылке: ${name}` : next ? `→ ${name}` : '→ владелец бота';
  a.audit({ company: cid }, actor.tg_id, 'company.owner', details);
  a.audit(BOT_LOG, actor.tg_id, 'company.owner', `«${company.name}»: ${details}`);
  a.claim(code
    ? db.prepare("UPDATE companies SET owner_id = ?, owner_code = '' WHERE id = ? AND owner_code = ? AND owner_id = ?").bind(next, cid, code, prev)
    : db.prepare('UPDATE companies SET owner_id = ? WHERE id = ? AND owner_id = ?').bind(next, cid, prev));
  if (next) a.add(adminFlagStmt(db, next));
  return (await a.run()).won;
}

// admin.owner.transfer (051): владельцем компании вызова становится id — человек компании или владелец бота (тогда
// компанию снова ведёт он: owner_id = 0). Вызывает владелец компании или владелец бота (конвейер)
export async function setCompanyOwner(ctx, rawId) {
  const { me } = ctx;
  const id = Number(rawId) || 0;
  const [users, botOwnerId, ownerId] = await Promise.all([ctx.users(), ctx.botOwnerId(), ctx.ownerId()]);
  const target = users.find((u) => u.tg_id === id && (id === botOwnerId || !u.guest));
  if (!target || !target.registered) return no(TRANSFER_TARGET);
  if (id === ownerId) return no(id === me.tg_id ? 'Ты и так владелец.' : 'Он(а) уже владелец.');
  const won = await ownerChange(ctx, { next: id === botOwnerId ? 0 : id, target, actor: me });
  return won ? { ok: true } : no('Права владельца уже переданы.');
}

// bot.company.link: новая ссылка владельца (прежняя перестаёт действовать) или отзыв. Журнал бота — только при изменении.
// Одновременные нажатия «создать» дают одну ссылку: проигравший отдаёт ту, что действует
export async function ownerLink(ctx, companyId, on) {
  const { db, me } = ctx;
  const id = Number(companyId) || 0;
  const companyQuery = () => db.prepare('SELECT id, name, owner_code FROM companies WHERE id = ?').bind(id);
  const r = await ctx.read({ company: companyQuery(), settings: true });
  const [c] = r.company;
  if (!c) return no(COMPANY_NOT_FOUND, 404);
  if (!on) {
    const a = atomic(db, "EXISTS (SELECT 1 FROM companies WHERE id = ? AND owner_code != '')", id);
    a.audit(BOT_LOG, me.tg_id, 'company.link', `«${c.name}»: отозвана`);
    a.claim(a.where("UPDATE companies SET owner_code = '' WHERE id = ?", id));
    await a.run();
    return { ok: true, link: '' };
  }
  if (!r.settings.bot_username) return no(SETUP_FIRST);
  // Новый код — пока код тот, что прочитан. Проиграл одновременному «создать» — отдаёт его ссылку; проиграл переходу по
  // прежней ссылке (код стёрт) — создаёт ещё раз: владелец бота просил действующую ссылку
  let prev = c.owner_code;
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = randomCode(16);
    const a = atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ? AND owner_code = ?)', id, prev);
    a.audit(BOT_LOG, me.tg_id, 'company.link', `«${c.name}»: создана`);
    a.claim(a.where('UPDATE companies SET owner_code = ? WHERE id = ?', code, id));
    if ((await a.run()).won) return { ok: true, link: linkOf(r.settings, code) };
    const [cur] = (await readMany(db, { c: companyQuery() })).c;
    if (!cur) return no(COMPANY_NOT_FOUND, 404);
    if (cur.owner_code) return { ok: true, link: linkOf(r.settings, cur.owner_code) };
    prev = '';
  }
  return { ok: true, link: '' };
}

// Компания по коду ссылки владельца (бот: /start own_<код>, ввод имени после неё)
export async function companyByOwnerCode(db, code) {
  if (!code) return null;
  // owner_code != '' — по частичному индексу companies_owner_code (055)
  return (await readMany(db, { c: db.prepare("SELECT id, name, owner_id FROM companies WHERE owner_code = ? AND owner_code != ''").bind(code) })).c[0] ?? null;
}

// Переход по ссылке владельца компании (контракт 051, раздел 4). ctx — общий контекст человека, user — его запись (с
// именем). → 'gone' (кода нет), 'bot' (перешёл владелец бота), 'already' (уже владелец), 'owner' (стал владельцем).
// Из одновременных переходов владельцем становится один, второму — 'gone'
export async function claimCompanyOwner(ctx, code, user) {
  const found = await companyByOwnerCode(ctx.db, code);
  if (!found) return 'gone';
  if (await ctx.isBotOwner()) return 'bot';
  const c = await ctx.in(found.id);
  if (!c) return 'gone';
  if ((await c.ownerId()) === user.tg_id) return 'already';
  return (await ownerChange(c, { next: user.tg_id, target: user, actor: user, code })) ? 'owner' : 'gone';
}

// ---------- удаление и журнал бота ----------

// bot.company.delete: только компания без событий (условие пакета; R11). Сообщения её владельцу и администраторам,
// запись журнала бота, пересчёт общего признака users.is_admin её администраторам (без этой компании), данные — по списку
// REGISTRY, строка компании — последней (захват). Проигравшему одновременный вызов — отказ по свежему состоянию.
// own (052, company.delete владельца компании в открытом боте): компания видна ему (иначе 404), в условии пакета — ещё
// «владелец — он»
export async function deleteCompany(ctx, companyId, own = false) {
  const { db, me } = ctx;
  const id = Number(companyId) || 0;
  if (own) {
    const [companies, mine] = await Promise.all([ctx.companies(), ctx.mine()]);
    if (!companies.has(id) || !(await seenBy(ctx, companies, mine, id))) return no(COMPANY_NOT_FOUND, 404);
  }
  const state = () => ({
    company: db.prepare('SELECT id, name, owner_id FROM companies WHERE id = ?').bind(id),
    events: db.prepare('SELECT COUNT(*) AS n FROM events WHERE company_id = ?').bind(id),
  });
  const r = await ctx.read({
    ...state(),
    people: db.prepare(
      'SELECT u.tg_id, u.registered, cm.is_admin FROM company_members cm JOIN users u ON u.tg_id = cm.user_id WHERE cm.company_id = ?'
    ).bind(id),
  });
  const refusal = (s) => (!s.company.length ? no(COMPANY_NOT_FOUND, 404)
    : own && s.company[0].owner_id !== me.tg_id ? no(OWN_DELETE, 403)
    : s.events[0].n ? no(HAS_EVENTS) : null);
  const early = refusal(r);
  if (early) return early;
  const [c] = r.company;
  const a = own
    ? atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ? AND owner_id = ?) AND NOT EXISTS (SELECT 1 FROM events WHERE company_id = ?)', id, me.tg_id, id)
    : atomic(db, 'EXISTS (SELECT 1 FROM companies WHERE id = ?) AND NOT EXISTS (SELECT 1 FROM events WHERE company_id = ?)', id, id);
  for (const u of adminRecipients(r.people, [me.tg_id])) {
    a.enqueue(u.tg_id, msg(own ? 'Владелец удалил комнату, в которой ты был администратором: событий в ней не было.'
      : u.tg_id === c.owner_id ? 'Владелец бота удалил комнату, которую ты вёл: событий в ней не было.'
      : 'Владелец бота удалил комнату, в которой ты был администратором: событий в ней не было.'));
  }
  a.audit(BOT_LOG, me.tg_id, 'company.delete', `«${c.name}», людей: ${r.people.length}`);
  a.where(
    `UPDATE users SET is_admin = (
       EXISTS (SELECT 1 FROM company_members WHERE user_id = users.tg_id AND is_admin = 1 AND company_id != ?)
       OR tg_id = COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'), 0))
      WHERE tg_id IN (SELECT user_id FROM company_members WHERE company_id = ? AND is_admin = 1)`,
    id, id,
  );
  a.claim(a.add(...companyDataDeleteStmts(db, id, ...a.guard)));
  if ((await a.run()).won) return { ok: true };
  return refusal(await readMany(db, state())) || no(COMPANY_NOT_FOUND, 404);
}

// bot.audit: последние записи журнала бота
export async function botAudit(ctx) {
  return { entries: await getAudit(ctx.db, BOT_LOG) };
}

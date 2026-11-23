// Роли (002): владелец и администраторы; перенос участия на новый аккаунт (004 → 005: во всех эвентах).
// 050: права администратора — строка company_members компании вызова; общий признак users.is_admin пересчитывает
// adminFlagStmt. Владелец бота — администратор каждой компании, которую он ведёт (owner_id = 0, инвариант I2).

import {
  setSettings, setSettingStmt, allUsers, getEvent, userQuery, adminFlagStmt,
  mergeMembership, personTransferStmts,
} from './db.js';
import { msg, escapeHtml, appKeyboard, displayName, adminRecipients } from './format.js';
import { derivedSecret } from './telegram.js';
import { returnThreadsStmts } from './support.js';
import { atomic } from './claim.js';
import { no } from './result.js';

// Сообщение остальным админам (без звука): получатели — adminRecipients(users, кроме перечисленных)
const adminNotice = (text) => msg(text, { disable_notification: true });

// ---------- ссылка владельца (010, FR-1004–FR-1006) ----------

// Код ссылки владельца — производная от текущего ADMIN_SECRET: после смены секрета старая ссылка не совпадает
export async function ownerLinkCode(env) {
  return 'adm_' + (await derivedSecret(env, 'admin:' + (env.ADMIN_SECRET || ''), 24));
}

// Отметка «ссылка использована» для текущего секрета (сама ссылка из неё не восстанавливается)
const usedMark = (env) => derivedSecret(env, 'owner-used:' + (env.ADMIN_SECRET || ''), 24);

export async function ownerLinkUsed(env, settings) {
  return settings.owner_link_used === (await usedMark(env));
}

// Захват ссылки: true — только у первого перехода для этого секрета (один оператор — атомарно)
export async function claimOwnerLink(env) {
  const r = await env.DB
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('owner_link_used', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value != excluded.value`
    )
    .bind(await usedMark(env))
    .run();
  return r.meta.changes > 0;
}

// Владелец бота: settings.owner_id; если не задан или недействителен — самый ранний админ (FR-109).
export async function resolveOwner(db, settings, users) {
  users = users || (await allUsers(db));
  const current = Number(settings.owner_id || 0);
  if (users.some((u) => u.tg_id === current && u.is_admin)) return current;
  const fallback = users.filter((u) => u.is_admin).sort((a, b) => a.created_at - b.created_at)[0];
  const id = fallback ? fallback.tg_id : 0;
  if (id !== current) await setSettings(db, { owner_id: String(id || '') });
  settings.owner_id = String(id || '');
  return id || null;
}

// Владелец бота (050): запись по настройке owner_id действительна, если она есть и users.is_admin = 1 (owner — эта
// запись или null); иначе — самый ранний по времени регистрации администратор компаний, которые ведёт владелец бота.
export async function resolveBotOwner(db, settings, owner) {
  const current = Number(settings.owner_id || 0);
  if (owner && owner.tg_id === current && owner.is_admin) return current;
  const fallback = await db
    .prepare(
      `SELECT u.tg_id FROM users u
        WHERE EXISTS (SELECT 1 FROM company_members cm JOIN companies c ON c.id = cm.company_id
                       WHERE cm.user_id = u.tg_id AND cm.is_admin = 1 AND c.owner_id = 0)
        ORDER BY u.created_at, u.tg_id LIMIT 1`
    )
    .first();
  const id = fallback ? fallback.tg_id : 0;
  if (id !== current) await setSettings(db, { owner_id: String(id || '') });
  settings.owner_id = String(id || '');
  return id || null;
}

// Сделать пользователя владельцем. via: 'link' (ссылка /setup) или 'transfer' (передал прежний владелец).
// Передача (024) — по прежнему состоянию: всё — пока владелец прежний, смена владельца — последней (захват); второй
// из одновременных вызовов ничего не меняет — { won: false }. Ссылка (via: 'link') — без условия: её захват — claimOwnerLink.
// Администраторы компаний, которые ведёт владелец бота: им — сообщение о новом владельце бота
const botAdminsQuery = (db) => db.prepare(
  `SELECT u.* FROM users u
    WHERE EXISTS (SELECT 1 FROM company_members cm JOIN companies c ON c.id = cm.company_id
                   WHERE cm.user_id = u.tg_id AND cm.is_admin = 1 AND c.owner_id = 0)
    ORDER BY u.created_at, u.tg_id`
);

export async function setOwner(ctx, newOwnerId, { via, prevOwnerId, newOwnerLabel } = {}) {
  const db = ctx.db;
  const { settings, companies, target: [target], admins } = await ctx.read({
    settings: true, companies: true, target: userQuery(db, newOwnerId), admins: botAdminsQuery(db),
  });
  const label = escapeHtml(newOwnerLabel || displayName(target));
  const transfer = via === 'transfer';
  const a = transfer
    ? atomic(db, "EXISTS (SELECT 1 FROM settings WHERE key = 'owner_id' AND value = ?)", String(prevOwnerId))
    : atomic(db, '1 = 1');
  a.where('UPDATE users SET is_admin = 1 WHERE tg_id = ?', newOwnerId);
  // Строка администратора в каждой компании, которую ведёт владелец бота (I2)
  a.add(db.prepare(
    `INSERT INTO company_members (company_id, user_id, is_admin, joined_at) SELECT id, ?, 1, ? FROM companies WHERE owner_id = 0 AND ${a.sql}
     ON CONFLICT(company_id, user_id) DO UPDATE SET is_admin = 1`
  ).bind(newOwnerId, Date.now(), ...a.args));
  for (const c of companies.values()) {
    if (c.owner_id) continue;
    if (transfer) a.audit({ company: c.id }, prevOwnerId, 'owner.transfer', `→ ${newOwnerLabel || displayName(target)}`);
    else a.audit({ company: c.id }, newOwnerId, 'owner.link', newOwnerLabel || displayName(target));
  }
  if (prevOwnerId && prevOwnerId !== newOwnerId) {
    if (via === 'link') {
      a.enqueue(prevOwnerId, msg(
        `⚠️ Права владельца бота перешли к <b>${label}</b> по ссылке со страницы настройки. Ты остаёшься администратором.\n\n` +
        'Если это не ты и не по договорённости — смени ADMIN_SECRET (см. README), открой страницу настройки и перейди по новой ссылке владельца.'
      ));
    }
    if (via === 'transfer') {
      a.enqueue(newOwnerId, msg(
        '👑 <b>Тебе переданы права владельца бота.</b> Теперь ты назначаешь и снимаешь администраторов — раздел «Владелец и администраторы» на главном экране приложения.',
        appKeyboard(settings, '🛠 Открыть')
      ));
    }
    for (const u of adminRecipients(admins, [newOwnerId, prevOwnerId])) a.enqueue(u.tg_id, adminNotice(`ℹ️ <b>${label}</b> теперь владелец бота.`));
  }
  if (transfer) a.claim(db.prepare("UPDATE settings SET value = ? WHERE key = 'owner_id' AND value = ?").bind(String(newOwnerId), String(prevOwnerId)));
  else a.add(setSettingStmt(db, 'owner_id', String(newOwnerId)));
  return { won: (await a.run()).won !== false };
}

const ALREADY_ADMIN = 'Он(а) уже администратор.';
const NOT_ADMIN = 'Он(а) не администратор.';

// Права в компании вызова (050): условие и захват — строка company_members; общий признак — после захвата (I4)
export async function grantAdmin(ctx, id, actor = 0) {
  const db = ctx.db;
  const cid = ctx.company.id;
  const [settings, users, ownerId] = await Promise.all([ctx.settings(), ctx.users(), ctx.ownerId()]);
  const u = users.find((x) => x.tg_id === id && !x.guest);
  if (!u || !u.registered) return no('Назначить можно только зарегистрированного человека.');
  if (u.is_admin) return no(ALREADY_ADMIN);
  // По прежнему состоянию (024): сообщения и журнал — пока он не админ, назначение — последним (захват)
  const a = atomic(db, 'EXISTS (SELECT 1 FROM company_members WHERE company_id = ? AND user_id = ? AND is_admin = 0)', cid, id);
  a.enqueue(id, msg(
    '🛠 <b>Владелец назначил тебя администратором.</b>\n\nТеперь ты можешь создавать события и вести их: приглашения, исключения, жеребьёвка, напоминания. Пары может открыть только владелец в служебном просмотре.',
    appKeyboard(settings, '🛠 Открыть')
  ));
  for (const r of adminRecipients(users, [id, ownerId])) a.enqueue(r.tg_id, adminNotice(`ℹ️ <b>${escapeHtml(displayName(u))}</b> теперь администратор.`));
  a.audit({ company: cid }, actor || ownerId, 'role.grant', displayName(u));
  a.claim(db.prepare('UPDATE company_members SET is_admin = 1 WHERE company_id = ? AND user_id = ? AND is_admin = 0').bind(cid, id));
  a.add(adminFlagStmt(db, id));
  if (!(await a.run()).won) return no(ALREADY_ADMIN);
  return { ok: true };
}

export async function revokeAdmin(ctx, id, actor = 0) {
  const db = ctx.db;
  const cid = ctx.company.id;
  const [settings, users, ownerId] = await Promise.all([ctx.settings(), ctx.users(), ctx.ownerId()]);
  const u = users.find((x) => x.tg_id === id && !x.guest);
  if (!u || !u.is_admin) return no(NOT_ADMIN);
  if (id === ownerId) return no('Нельзя снять права владельца. Сначала передай права владельца.');
  // По прежнему состоянию (024): всё — пока он админ в этой компании, снятие прав — последним (захват)
  const a = atomic(db, 'EXISTS (SELECT 1 FROM company_members WHERE company_id = ? AND user_id = ? AND is_admin = 1)', cid, id);
  // 012: обращения событий этой компании, которые он вёл, снова ничьи — остальные админы получают их с кнопкой «Взять»
  a.add(...(await returnThreadsStmts(db, settings, users, id, cid, a.guard)));
  a.enqueue(id, msg('Владелец снял с тебя права администратора. Как участник событий ты продолжаешь играть как обычно.'));
  for (const r of adminRecipients(users, [id, ownerId])) a.enqueue(r.tg_id, adminNotice(`ℹ️ <b>${escapeHtml(displayName(u))}</b> больше не администратор.`));
  a.audit({ company: cid }, actor || ownerId, 'role.revoke', displayName(u));
  a.claim(db.prepare('UPDATE company_members SET is_admin = 0 WHERE company_id = ? AND user_id = ? AND is_admin = 1').bind(cid, id));
  a.add(adminFlagStmt(db, id));
  if (!(await a.run()).won) return no(NOT_ADMIN);
  return { ok: true };
}

// Цель — зарегистрированный человек компании вызова (050); смысл прежний — права владельца бота
export async function transferOwnership(ctx, fromId, toId) {
  const users = await ctx.users();
  const u = users.find((x) => x.tg_id === toId && !x.guest);
  if (!u || !u.registered) return no('Передать права владельца можно только зарегистрированному человеку.');
  if (toId === fromId) return no('Ты и так владелец.');
  if (!(await setOwner(ctx, toId, { via: 'transfer', prevOwnerId: fromId })).won) return no('Права владельца уже переданы.');
  return { ok: true };
}

// ---------- перенос участия на новый аккаунт ----------

// Организаторы компаний человека (050): администраторы, владелец компании и владелец бота — им сообщение о переносе
const staffOfQuery = (db, userId) => db.prepare(
  `SELECT u.* FROM users u
    WHERE u.tg_id IN (SELECT a.user_id FROM company_members a JOIN company_members p ON p.company_id = a.company_id
                       WHERE p.user_id = ?1 AND a.is_admin = 1)
       OR u.tg_id IN (SELECT c.owner_id FROM companies c JOIN company_members p ON p.company_id = c.id WHERE p.user_id = ?1)
       OR (u.is_admin = 1 AND u.tg_id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id'))`
).bind(userId);

// Перенос человека целиком (050): участия во всех компаниях. Цель — не владелец бота, не администратор где-нибудь
// (users.is_admin), не владелец компании; сообщения и запись transfer — организаторам и в журнал каждой компании
// старой записи. Все чтения — одним пакетом; порядок отказов прежний (цель → две записи → старая → регистрация)
export async function transferAccount(ctx, fromId, toId, actorId = 0) {
  const db = ctx.db;
  if (!toId) return no('Выбери две разные записи.');
  const r = await ctx.read({
    from: userQuery(db, fromId || 0),
    to: userQuery(db, toId),
    fromMembers: db.prepare('SELECT * FROM members WHERE user_id = ?').bind(fromId || 0),
    toMembers: db.prepare('SELECT * FROM members WHERE user_id = ?').bind(toId),
    toPairs: db.prepare('SELECT event_id FROM pairs WHERE santa = ? OR ward = ?').bind(toId, toId),
    fromCompanies: db.prepare('SELECT company_id FROM company_members WHERE user_id = ?').bind(fromId || 0),
    staff: staffOfQuery(db, fromId || 0),
    settings: true,
  });
  const [from, to] = [r.from[0], r.to[0]];
  const botOwnerId = await ctx.botOwnerId();
  const companyOwner = [...(await ctx.companies()).values()].some((c) => c.owner_id === toId);
  // Иначе админ получил бы чужие пары и переписку (Конституция, принцип I; 006, FR-601)
  if (to?.is_admin || toId === botOwnerId || companyOwner) return no('Переносить участие на аккаунт владельца или администратора нельзя.');
  if (!fromId || fromId === toId) return no('Выбери две разные записи.');
  if (!from) return no('Старая запись не найдена.');
  if (!to || !to.registered) return no('Новый аккаунт должен завершить регистрацию (написать боту имя).');
  const { fromMembers, toMembers, settings } = r;
  const toByEvent = new Map(toMembers.map((m) => [m.event_id, m]));
  const toInDraw = new Set(r.toPairs.map((p) => p.event_id));
  for (const m of fromMembers) {
    if (toByEvent.has(m.event_id) && toInDraw.has(m.event_id)) {
      const ev = await getEvent(db, m.event_id);
      return no(`Новый аккаунт уже участвует в жеребьёвке события «${ev?.title || ''}» — выбери другую запись.`);
    }
  }
  const actor = ctx.me?.tg_id === actorId ? ctx.me : r.staff.find((u) => u.tg_id === actorId);
  // Запись без компаний — в журнал компании вызова, чтобы перенос не прошёл без записи
  const companies = r.fromCompanies.length ? r.fromCompanies.map((c) => c.company_id) : [ctx.company.id];
  // Новый аккаунт уже вступил в эвент: остаётся одно участие (письмо и адрес — нового, если не пусты; 009, FR-938)
  const merge = fromMembers.filter((m) => toByEvent.has(m.event_id)).map((m) => mergeMembership(m, toByEvent.get(m.event_id)));
  // Атомарно (018): всё — только пока старая запись существует, она удаляется последней. Второй из двух одновременных
  // переносов ничего не меняет и не рассылает (иначе он удалил бы участие, только что перенесённое первым).
  const fromExists = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ?)', fromId);
  fromExists.enqueue(toId, msg(
    '🔁 Владелец перенёс на этот аккаунт твоё участие в «Тайном Санте»: письма, подопечные, переписка и история событий сохранены.',
    appKeyboard(settings, '🎁 Открыть')
  ));
  // Перенос не должен быть незаметным (006, FR-602): прежний аккаунт и остальные админы узнают о нём
  fromExists.enqueue(fromId, msg(
    `🔁 Твоё участие в «Тайном Санте» перенесено на аккаунт <b>${escapeHtml(displayName(to))}</b>. Если ты не просил о переносе, свяжись с владельцем.`
  ));
  const notice = adminNotice(
    `🔁 <b>${escapeHtml(displayName(actor))}</b> перенёс участие <b>${escapeHtml(displayName(from))}</b> на аккаунт <b>${escapeHtml(displayName(to))}</b>.`
  );
  for (const u of adminRecipients(r.staff, [actorId, toId, fromId])) fromExists.enqueue(u.tg_id, notice);
  for (const id of companies) fromExists.audit({ company: id }, actorId, 'transfer', `${displayName(from)} → ${displayName(to)}`);
  // Участия, письма, пары, переписка, исключения, семья, заявки, отметки «удалён», обращения — по списку REGISTRY
  // (018); ссылки «кто сделал» переходят тоже (025); запись старого аккаунта удаляется последней: она и есть захват
  fromExists.claim(fromExists.add(...personTransferStmts(db, fromId, toId, { merge }, ...fromExists.guard)));
  if (!(await fromExists.run()).won) return no('Старая запись не найдена.');
  return { ok: true, events: fromMembers.length };
}

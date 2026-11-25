// Роли (002): владелец бота, владелец и организаторы события; перенос участия на новый аккаунт (004 → 005: во всех
// эвентах). 063: организатор — строка event_admins события (владелец события — тоже, инвариант E1), владелец события —
// events.owner_id; общий признак users.is_admin пересчитывает adminFlagStmt (E2).

import {
  setSettings, setSettingStmt, getEvent, userQuery, adminFlagStmt,
  mergeMembership, personTransferStmts, BOT_LOG,
} from './db.js';
import { msg, escapeHtml, appKeyboard, displayName, adminRecipients, q } from './format.js';
import { tx } from './i18n/index.js';
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

// Владелец бота: settings.owner_id; если не задан или недействителен — самый ранний админ (FR-109). 050: запись по
// настройке действительна, если она есть и users.is_admin = 1 (owner — эта запись или null); иначе — самый ранний по
// времени регистрации организатор событий без владельца (063: такие события ведёт владелец бота — только прежние данные;
// организатор чужого события владельцем бота не становится; пока запись недействительна, поиск идёт на каждом вызове).
export async function resolveOwner(db, settings, owner) {
  const current = Number(settings.owner_id || 0);
  if (owner && owner.tg_id === current && owner.is_admin) return current;
  const fallback = await db
    .prepare(
      `SELECT u.tg_id FROM events e
         JOIN event_admins a ON a.event_id = e.id
         JOIN users u ON u.tg_id = a.user_id
        WHERE e.owner_id = 0
        ORDER BY u.created_at, u.tg_id LIMIT 1`
    )
    .first();
  const id = fallback ? fallback.tg_id : 0;
  if (id !== current) await setSettings(db, { owner_id: String(id || '') });
  settings.owner_id = String(id || '');
  return id || null;
}

// Сделать пользователя владельцем бота. via: 'link' (ссылка /setup) или 'transfer' (передал прежний владелец).
// Передача (024) — по прежнему состоянию: всё — пока владелец прежний, смена владельца — последней (захват); второй
// из одновременных вызовов ничего не меняет — { won: false }. Ссылка (via: 'link') — без условия: её захват — claimOwnerLink.
// 063: события и организаторство не меняются (они принадлежат человеку), запись — в журнале бота; сообщение о новом
// владельце бота — организаторам событий прежнего владельца бота и событий без владельца
const botAdminsQuery = (db, prevOwnerId) => db.prepare(
  `SELECT u.* FROM users u
    WHERE u.tg_id IN (SELECT a.user_id FROM event_admins a JOIN events e ON e.id = a.event_id WHERE e.owner_id IN (0, ?))
    ORDER BY u.created_at, u.tg_id`
).bind(prevOwnerId || 0);

export async function setOwner(ctx, newOwnerId, { via, prevOwnerId, newOwnerLabel } = {}) {
  const db = ctx.db;
  const { settings, target: [target], admins } = await ctx.read({
    settings: true,
    target: userQuery(db, newOwnerId),
    admins: botAdminsQuery(db, prevOwnerId),
  });
  const label = escapeHtml(newOwnerLabel || displayName(target));
  const transfer = via === 'transfer';
  const a = transfer
    ? atomic(db, "EXISTS (SELECT 1 FROM settings WHERE key = 'owner_id' AND value = ?)", String(prevOwnerId))
    : atomic(db, '1 = 1');
  const who = newOwnerLabel || displayName(target);
  if (transfer) a.audit(BOT_LOG, prevOwnerId, 'owner.transfer', tx('roles.audit.newOwner', { name: who }));
  else a.audit(BOT_LOG, newOwnerId, 'owner.link', who);
  if (prevOwnerId && prevOwnerId !== newOwnerId) {
    if (via === 'link') {
      a.enqueue(prevOwnerId, msg(tx('roles.botOwner.byLink', { name: label })));
    }
    if (via === 'transfer') {
      a.enqueue(newOwnerId, msg(tx('roles.botOwner.transferred'), appKeyboard(settings, tx('roles.openButton'))));
    }
    for (const u of adminRecipients(admins, [newOwnerId, prevOwnerId])) a.enqueue(u.tg_id, adminNotice(tx('roles.botOwner.notice', { name: label })));
  }
  if (transfer) a.claim(db.prepare("UPDATE settings SET value = ? WHERE key = 'owner_id' AND value = ?").bind(String(newOwnerId), String(prevOwnerId)));
  else a.add(setSettingStmt(db, 'owner_id', String(newOwnerId)));
  // Общий признак обоих — по новой настройке (пересчёт безусловный: при проигрыше он ничего не меняет)
  a.add(adminFlagStmt(db, newOwnerId));
  if (prevOwnerId && prevOwnerId !== newOwnerId) a.add(adminFlagStmt(db, prevOwnerId));
  return { won: (await a.run()).won !== false };
}

const ALREADY_ADMIN = tx('roles.alreadyAdmin');
const NOT_ADMIN = tx('roles.notAdmin');
const ALREADY_PASSED = tx('roles.owner.alreadyPassed');
const GRANT_MEMBER = tx('roles.grantMember');

// Организатор события (063): условие и захват — строка event_admins; общий признак — после захвата (E2). ctx — контекст
// события (ctx.at): назначить можно только зарегистрированного участника
export async function grantAdmin(ctx, id, actor = 0) {
  const db = ctx.db;
  const ev = ctx.event;
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  // Люди события — участники и организаторы: человек события без прав организатора — участник
  const u = users.find((x) => x.tg_id === id && !x.guest);
  if (u?.is_admin) return no(ALREADY_ADMIN);
  if (!u || !u.registered) return no(GRANT_MEMBER);
  // По прежнему состоянию (024): сообщения и журнал — пока он участник и не организатор, назначение — последним (захват)
  const a = atomic(db, `EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)
    AND NOT EXISTS (SELECT 1 FROM event_admins WHERE event_id = ? AND user_id = ?)`, ev.id, id, ev.id, id);
  a.enqueue(id, msg(tx('roles.granted', { title: q(ev) }), appKeyboard(settings, tx('roles.openButton'), { event: ev.id })));
  const notice = adminNotice(tx('roles.grantedNotice', { name: escapeHtml(displayName(u)), title: q(ev) }));
  for (const r of adminRecipients(users, [id, actor])) a.enqueue(r.tg_id, notice);
  a.audit(ev.id, actor, 'role.grant', displayName(u));
  a.claim(a.select('INSERT OR IGNORE INTO event_admins (event_id, user_id, created_at) SELECT ?, ?, ?', ev.id, id, Date.now()));
  a.add(adminFlagStmt(db, id));
  if (!(await a.run()).won) {
    // Проигравшему — по свежему состоянию: назначил другой вызов или человек одновременно вышел из события
    const { row } = await ctx.read({ row: db.prepare('SELECT 1 FROM event_admins WHERE event_id = ? AND user_id = ?').bind(ev.id, id) });
    return no(row.length ? ALREADY_ADMIN : GRANT_MEMBER);
  }
  ctx.forgetUsers();
  return { ok: true };
}

export async function revokeAdmin(ctx, id, actor = 0) {
  const db = ctx.db;
  const ev = ctx.event;
  const [settings, users, ownerId] = await Promise.all([ctx.settings(), ctx.users(), ctx.ownerId()]);
  const u = users.find((x) => x.tg_id === id && !x.guest);
  if (id === ownerId) return no(tx('roles.revokeOwner'));
  if (!u || !u.is_admin) return no(NOT_ADMIN);
  // По прежнему состоянию (024): всё — пока он организатор и не владелец события, снятие — последним (захват)
  const a = atomic(db, `EXISTS (SELECT 1 FROM event_admins WHERE event_id = ? AND user_id = ?)
    AND NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND owner_id = ?)`, ev.id, id, ev.id, id);
  // 012: обращения этого события, которые он вёл, снова ничьи — остальные организаторы получают их с кнопкой «Взять»
  a.add(...(await returnThreadsStmts(db, settings, users, id, ev.id, a.guard)));
  a.enqueue(id, msg(tx('roles.revoked', { title: q(ev) })));
  const notice = adminNotice(tx('roles.revokedNotice', { name: escapeHtml(displayName(u)), title: q(ev) }));
  for (const r of adminRecipients(users, [id, actor])) a.enqueue(r.tg_id, notice);
  a.audit(ev.id, actor, 'role.revoke', displayName(u));
  a.claim(a.where('DELETE FROM event_admins WHERE event_id = ? AND user_id = ?', ev.id, id));
  a.add(adminFlagStmt(db, id));
  if (!(await a.run()).won) {
    // Проигравшему — по свежему состоянию: снял другой вызов или ему одновременно передали владение
    const { row } = await ctx.read({ row: db.prepare('SELECT 1 FROM events WHERE id = ? AND owner_id = ?').bind(ev.id, id) });
    return no(row.length ? tx('roles.revokeOwner') : NOT_ADMIN);
  }
  ctx.forgetUsers();
  return { ok: true };
}

// Передать владение событием (063): новому — строка организатора (если её нет), прежний остаётся организатором. По
// прежнему владельцу: всё — пока владелец прежний, смена — последней (захват). ctx — контекст события
export async function transferEventOwner(ctx, id, actor = 0) {
  const db = ctx.db;
  const ev = ctx.event;
  const [settings, users, ownerId] = await Promise.all([ctx.settings(), ctx.users(), ctx.ownerId()]);
  const u = users.find((x) => x.tg_id === id && !x.guest);
  if (id === ownerId) return no(tx(id === actor ? 'roles.alreadyOwnerSelf' : 'roles.owner.already'));
  if (!u || !u.registered) return no(tx('roles.owner.target'));
  const a = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ? AND owner_id = ?)', ev.id, ev.owner_id);
  a.select('INSERT OR IGNORE INTO event_admins (event_id, user_id, created_at) SELECT ?, ?, ?', ev.id, id, Date.now());
  const who = escapeHtml(displayName(u));
  a.enqueue(id, msg(tx('roles.owner.toNew', { title: q(ev) }), appKeyboard(settings, tx('roles.openButton'), { event: ev.id })));
  if (ownerId && ownerId !== actor) a.enqueue(ownerId, msg(tx('roles.owner.toPrev', { title: q(ev), who })));
  const notice = adminNotice(tx('roles.owner.notice', { title: q(ev), who }));
  for (const r of adminRecipients(users, [id, actor, ownerId])) a.enqueue(r.tg_id, notice);
  a.audit(ev.id, actor, 'event.owner', tx('roles.audit.newOwner', { name: displayName(u) }));
  a.claim(a.where('UPDATE events SET owner_id = ? WHERE id = ?', id, ev.id));
  a.add(adminFlagStmt(db, id));
  if (!(await a.run()).won) return no(ALREADY_PASSED);
  ctx.forgetUsers();
  return { ok: true };
}

// bot.owner.transfer (051): права владельца бота. Цель — любой зарегистрированный человек (063)
const registeredQuery = (db, id) => db.prepare('SELECT tg_id FROM users WHERE tg_id = ? AND registered = 1').bind(id);

export async function transferBotOwnership(ctx, fromId, toId) {
  const { u } = await ctx.read({ u: registeredQuery(ctx.db, toId || 0) });
  if (!u.length) return no(tx('roles.transferTarget'));
  if (toId === fromId) return no(tx('roles.alreadyOwnerSelf'));
  if (!(await setOwner(ctx, toId, { via: 'transfer', prevOwnerId: fromId })).won) return no(tx('roles.alreadyTransferred'));
  return { ok: true };
}

// ---------- перенос участия на новый аккаунт ----------

// Организаторы событий человека (063: участник или организатор) и владелец бота — им сообщение о переносе
const staffOfQuery = (db, userId) => db.prepare(
  `SELECT u.* FROM users u
    WHERE u.tg_id IN (SELECT a.user_id FROM event_admins a
                       WHERE a.event_id IN (SELECT event_id FROM members WHERE user_id = ?1
                                            UNION SELECT event_id FROM event_admins WHERE user_id = ?1))
       OR u.tg_id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id')`
).bind(userId);

const TWO_RECORDS = tx('roles.transfer.twoRecords');
const NO_OLD_RECORD = tx('roles.transfer.noOld');

// Перенос человека целиком: участия, владение и организаторство во всех событиях (063). Цель — не владелец бота, не
// организатор где-нибудь (users.is_admin; владелец события — тоже организатор, E1); сообщения — организаторам событий
// старой записи, запись transfer — в журнал бота. Все чтения — одним пакетом; порядок отказов прежний (цель → две
// записи → старая → регистрация)
export async function transferAccount(ctx, fromId, toId, actorId = 0) {
  const db = ctx.db;
  if (!toId) return no(TWO_RECORDS);
  const r = await ctx.read({
    from: userQuery(db, fromId || 0),
    to: userQuery(db, toId),
    fromMembers: db.prepare('SELECT * FROM members WHERE user_id = ?').bind(fromId || 0),
    toMembers: db.prepare('SELECT * FROM members WHERE user_id = ?').bind(toId),
    toPairs: db.prepare('SELECT event_id FROM pairs WHERE santa = ? OR ward = ?').bind(toId, toId),
    staff: staffOfQuery(db, fromId || 0),
    settings: true,
  });
  const [from, to] = [r.from[0], r.to[0]];
  const botOwnerId = await ctx.botOwnerId();
  // Иначе админ получил бы чужие пары и переписку (Конституция, принцип I; 006, FR-601)
  if (to?.is_admin || toId === botOwnerId) return no(tx('roles.transfer.staffTarget'));
  if (!fromId || fromId === toId) return no(TWO_RECORDS);
  if (!from) return no(NO_OLD_RECORD);
  if (!to || !to.registered) return no(tx('roles.transfer.unregistered'));
  const { fromMembers, toMembers, settings } = r;
  const toByEvent = new Map(toMembers.map((m) => [m.event_id, m]));
  const toInDraw = new Set(r.toPairs.map((p) => p.event_id));
  for (const m of fromMembers) {
    if (toByEvent.has(m.event_id) && toInDraw.has(m.event_id)) {
      const ev = await getEvent(db, m.event_id);
      return no(tx('roles.transfer.inDraw', { title: ev?.title || '' }));
    }
  }
  const actor = ctx.me?.tg_id === actorId ? ctx.me : r.staff.find((u) => u.tg_id === actorId);
  // Новый аккаунт уже вступил в эвент: остаётся одно участие (письмо и адрес — нового, если не пусты; 009, FR-938)
  const merge = fromMembers.filter((m) => toByEvent.has(m.event_id)).map((m) => mergeMembership(m, toByEvent.get(m.event_id)));
  // Атомарно (018): всё — только пока старая запись существует, она удаляется последней. Второй из двух одновременных
  // переносов ничего не меняет и не рассылает (иначе он удалил бы участие, только что перенесённое первым).
  const fromExists = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ?)', fromId);
  fromExists.enqueue(toId, msg(tx('roles.transfer.toNew'), appKeyboard(settings, tx('events.openButton'))));
  // Перенос не должен быть незаметным (006, FR-602): прежний аккаунт и остальные админы узнают о нём
  fromExists.enqueue(fromId, msg(tx('roles.transfer.toOld', { to: escapeHtml(displayName(to)) })));
  const notice = adminNotice(tx('roles.transfer.notice', {
    actor: escapeHtml(displayName(actor)), from: escapeHtml(displayName(from)), to: escapeHtml(displayName(to)),
  }));
  for (const u of adminRecipients(r.staff, [actorId, toId, fromId])) fromExists.enqueue(u.tg_id, notice);
  fromExists.audit(BOT_LOG, actorId, 'transfer', tx('roles.audit.accountMoved', { from: displayName(from), to: displayName(to) }));
  // Участия, письма, пары, переписка, исключения, заявки, отметки «удалён», обращения, владение и организаторство
  // событий, факты создания — по списку REGISTRY (018, 063); ссылки «кто сделал» переходят тоже (025); запись старого аккаунта удаляется последней: она и есть захват
  fromExists.claim(fromExists.add(...personTransferStmts(db, fromId, toId, { merge }, ...fromExists.guard)));
  if (!(await fromExists.run()).won) return no(NO_OLD_RECORD);
  return { ok: true, events: fromMembers.length };
}

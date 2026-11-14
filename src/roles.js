// Роли (002): владелец и администраторы; перенос участия на новый аккаунт (004 → 005: во всех эвентах).

import {
  setSettings, setSettingStmt, allUsers, getUser, getEvent,
  mergeMembership, personTransferStmts,
} from './db.js';
import { msg, escapeHtml, appKeyboard, displayName, adminRecipients } from './format.js';
import { derivedSecret } from './telegram.js';
import { returnThreadsStmts } from './support.js';
import { atomic } from './claim.js';

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

// Сделать пользователя владельцем. via: 'link' (ссылка /setup) или 'transfer' (передал прежний владелец).
// Передача (024) — по прежнему состоянию: всё — пока владелец прежний, смена владельца — последней (захват); второй
// из одновременных вызовов ничего не меняет — { won: false }. Ссылка (via: 'link') — без условия: её захват — claimOwnerLink.
export async function setOwner(ctx, newOwnerId, { via, prevOwnerId, newOwnerLabel } = {}) {
  const db = ctx.db;
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const target = users.find((u) => u.tg_id === newOwnerId);
  const label = escapeHtml(newOwnerLabel || displayName(target));
  const transfer = via === 'transfer';
  const a = transfer
    ? atomic(db, "EXISTS (SELECT 1 FROM settings WHERE key = 'owner_id' AND value = ?)", String(prevOwnerId))
    : atomic(db, '1 = 1');
  a.where('UPDATE users SET is_admin = 1 WHERE tg_id = ?', newOwnerId);
  if (transfer) a.audit(0, prevOwnerId, 'owner.transfer', `→ ${newOwnerLabel || displayName(target)}`);
  else a.audit(0, newOwnerId, 'owner.link', newOwnerLabel || displayName(target));
  if (prevOwnerId && prevOwnerId !== newOwnerId) {
    if (via === 'link') {
      a.enqueue(prevOwnerId, msg(
        `⚠️ Права владельца бота перешли к <b>${label}</b> по ссылке со страницы настройки. Ты остаёшься администратором.\n\n` +
        'Если это не ты и не по договорённости — смени ADMIN_SECRET (см. README), открой страницу настройки и перейди по новой ссылке владельца.'
      ));
    }
    if (via === 'transfer') {
      a.enqueue(newOwnerId, msg(
        '👑 <b>Тебе переданы права владельца бота.</b> Теперь ты назначаешь и снимаешь администраторов — раздел «Администраторы» на главном экране приложения.',
        appKeyboard(settings, '🛠 Открыть')
      ));
    }
    for (const u of adminRecipients(users, [newOwnerId, prevOwnerId])) a.enqueue(u.tg_id, adminNotice(`ℹ️ <b>${label}</b> теперь владелец бота.`));
  }
  if (transfer) a.claim(db.prepare("UPDATE settings SET value = ? WHERE key = 'owner_id' AND value = ?").bind(String(newOwnerId), String(prevOwnerId)));
  else a.add(setSettingStmt(db, 'owner_id', String(newOwnerId)));
  return { won: (await a.run()).won !== false };
}

const ALREADY_ADMIN = 'Он(а) уже администратор.';
const NOT_ADMIN = 'Он(а) не администратор.';

export async function grantAdmin(ctx, id, actor = 0) {
  const db = ctx.db;
  const [settings, users, ownerId] = await Promise.all([ctx.settings(), ctx.users(), ctx.ownerId()]);
  const u = users.find((x) => x.tg_id === id);
  if (!u || !u.registered) return { ok: false, error: 'Назначить можно только зарегистрированного человека.' };
  if (u.is_admin) return { ok: false, error: ALREADY_ADMIN };
  // По прежнему состоянию (024): сообщения и журнал — пока он не админ, назначение — последним (захват)
  const a = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND is_admin = 0)', id);
  a.enqueue(id, msg(
    '🛠 <b>Владелец назначил тебя администратором.</b>\n\nТеперь ты можешь создавать события и вести их: приглашения, исключения, жеребьёвка, напоминания. Кто кому дарит, админы не видят.',
    appKeyboard(settings, '🛠 Открыть')
  ));
  for (const r of adminRecipients(users, [id, ownerId])) a.enqueue(r.tg_id, adminNotice(`ℹ️ <b>${escapeHtml(displayName(u))}</b> теперь администратор.`));
  a.audit(0, actor || ownerId, 'role.grant', displayName(u));
  a.claim(db.prepare('UPDATE users SET is_admin = 1 WHERE tg_id = ? AND is_admin = 0').bind(id));
  if (!(await a.run()).won) return { ok: false, error: ALREADY_ADMIN };
  return { ok: true };
}

export async function revokeAdmin(ctx, id, actor = 0) {
  const db = ctx.db;
  const [settings, users, ownerId] = await Promise.all([ctx.settings(), ctx.users(), ctx.ownerId()]);
  const u = users.find((x) => x.tg_id === id);
  if (!u || !u.is_admin) return { ok: false, error: NOT_ADMIN };
  if (id === ownerId) return { ok: false, error: 'Нельзя снять права владельца. Сначала передай владение другому.' };
  // По прежнему состоянию (024): всё — пока он админ, снятие прав — последним (захват)
  const a = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ? AND is_admin = 1)', id);
  // 012: обращения, которые он вёл, снова ничьи — остальные админы получают их с кнопкой «Взять»
  a.add(...(await returnThreadsStmts(db, settings, users, id, a.guard)));
  a.enqueue(id, msg('Владелец снял с тебя права администратора. Как участник событий ты продолжаешь играть как обычно.'));
  for (const r of adminRecipients(users, [id, ownerId])) a.enqueue(r.tg_id, adminNotice(`ℹ️ <b>${escapeHtml(displayName(u))}</b> больше не администратор.`));
  a.audit(0, actor || ownerId, 'role.revoke', displayName(u));
  a.claim(db.prepare('UPDATE users SET is_admin = 0 WHERE tg_id = ? AND is_admin = 1').bind(id));
  if (!(await a.run()).won) return { ok: false, error: NOT_ADMIN };
  return { ok: true };
}

export async function transferOwnership(ctx, fromId, toId) {
  const users = await ctx.users();
  const u = users.find((x) => x.tg_id === toId);
  if (!u || !u.registered) return { ok: false, error: 'Передать владение можно только зарегистрированному человеку.' };
  if (toId === fromId) return { ok: false, error: 'Ты и так владелец.' };
  if (!(await setOwner(ctx, toId, { via: 'transfer', prevOwnerId: fromId })).won) return { ok: false, error: 'Права владельца уже переданы.' };
  return { ok: true };
}

// ---------- перенос участия на новый аккаунт ----------

export async function transferAccount(ctx, fromId, toId, actorId = 0) {
  const db = ctx.db;
  if (!fromId || !toId || fromId === toId) return { ok: false, error: 'Выбери две разные записи.' };
  const from = await getUser(db, fromId);
  const to = await getUser(db, toId);
  if (!from) return { ok: false, error: 'Старая запись не найдена.' };
  if (!to || !to.registered) return { ok: false, error: 'Новый аккаунт должен завершить регистрацию (написать боту имя).' };
  const { results: fromMembers } = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(fromId).all();
  const { results: toMembers } = await db.prepare('SELECT * FROM members WHERE user_id = ?').bind(toId).all();
  const toByEvent = new Map(toMembers.map((m) => [m.event_id, m]));
  const { results: toPairs } = await db.prepare('SELECT event_id FROM pairs WHERE santa = ? OR ward = ?').bind(toId, toId).all();
  const toInDraw = new Set(toPairs.map((p) => p.event_id));
  for (const m of fromMembers) {
    if (toByEvent.has(m.event_id) && toInDraw.has(m.event_id)) {
      const ev = await getEvent(db, m.event_id);
      return { ok: false, error: `Новый аккаунт уже участвует в жеребьёвке события «${ev?.title || ''}» — выбери другую запись.` };
    }
  }
  const [settings, users] = await Promise.all([ctx.settings(), ctx.users()]);
  const actor = users.find((u) => u.tg_id === actorId);
  // Новый аккаунт уже вступил в эвент: остаётся одно участие (письмо и адрес — нового, если не пусты; 009, FR-938)
  const merge = fromMembers.filter((m) => toByEvent.has(m.event_id)).map((m) => mergeMembership(m, toByEvent.get(m.event_id)));
  // Атомарно (018): всё — только пока старая запись существует, она удаляется последней. Второй из двух одновременных
  // переносов ничего не меняет и не рассылает (иначе он удалил бы участие, только что перенесённое первым).
  const fromExists = atomic(db, 'EXISTS (SELECT 1 FROM users WHERE tg_id = ?)', fromId);
  fromExists.enqueue(toId, msg(
    '🔁 Организатор перенёс на этот аккаунт твоё участие в «Тайном Санте»: письма, подопечные, переписка и история событий сохранены.',
    appKeyboard(settings, '🎁 Открыть')
  ));
  // Перенос не должен быть незаметным (006, FR-602): прежний аккаунт и остальные админы узнают о нём
  fromExists.enqueue(fromId, msg(
    `🔁 Твоё участие в «Тайном Санте» перенесено на аккаунт <b>${escapeHtml(displayName(to))}</b>. Если это не ты — напиши организатору.`
  ));
  const notice = adminNotice(
    `🔁 <b>${escapeHtml(displayName(actor))}</b> перенёс участие <b>${escapeHtml(displayName(from))}</b> на аккаунт <b>${escapeHtml(displayName(to))}</b>.`
  );
  for (const u of adminRecipients(users, [actorId, toId, fromId])) fromExists.enqueue(u.tg_id, notice);
  fromExists.audit(0, actorId, 'transfer', `${displayName(from)} → ${displayName(to)}`);
  // Участия, письма, пары, переписка, исключения, семья, заявки, отметки «удалён», обращения — по списку REGISTRY
  // (018); ссылки «кто сделал» переходят тоже (025); запись старого аккаунта удаляется последней: она и есть захват
  fromExists.claim(fromExists.add(...personTransferStmts(db, fromId, toId, { merge }, ...fromExists.guard)));
  if (!(await fromExists.run()).won) return { ok: false, error: 'Старая запись не найдена.' };
  return { ok: true, events: fromMembers.length };
}

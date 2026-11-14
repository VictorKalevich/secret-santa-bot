// Роли (002): владелец и администраторы; перенос участия на новый аккаунт (004 → 005: во всех эвентах).

import {
  getSettings, setSettings, setSettingStmt, allUsers, getUser, getEvent, enqueueStmt, auditStmt, mergeMembership, personTransferStmts,
} from './db.js';
import { msg, escapeHtml, openAppButton, displayName, adminRecipients } from './format.js';
import { derivedSecret } from './telegram.js';
import { returnThreadsStmts } from './support.js';

// Сообщение остальным админам (без звука) — кроме перечисленных
function otherAdminsNotice(db, users, exclude, text) {
  return adminRecipients(users, exclude).map((u) => enqueueStmt(db, u.tg_id, msg(text, { disable_notification: true })));
}

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
export async function setOwner(env, newOwnerId, { via, prevOwnerId, newOwnerLabel } = {}) {
  const db = env.DB;
  const settings = await getSettings(db);
  const users = await allUsers(db);
  const target = users.find((u) => u.tg_id === newOwnerId);
  const label = escapeHtml(newOwnerLabel || displayName(target));
  const stmts = [
    db.prepare('UPDATE users SET is_admin = 1 WHERE tg_id = ?').bind(newOwnerId),
    setSettingStmt(db, 'owner_id', String(newOwnerId)),
    via === 'transfer'
      ? auditStmt(db, 0, prevOwnerId, 'owner.transfer', `→ ${newOwnerLabel || displayName(target)}`)
      : auditStmt(db, 0, newOwnerId, 'owner.link', newOwnerLabel || displayName(target)),
  ];
  if (prevOwnerId && prevOwnerId !== newOwnerId) {
    if (via === 'link') {
      stmts.push(enqueueStmt(db, prevOwnerId, msg(
        `⚠️ Права владельца бота перешли к <b>${label}</b> по ссылке со страницы настройки. Ты остаёшься администратором.\n\n` +
        'Если это не ты и не по договорённости — смени ADMIN_SECRET (см. README), открой страницу настройки и перейди по новой ссылке владельца.'
      )));
    }
    if (via === 'transfer') {
      stmts.push(enqueueStmt(db, newOwnerId, msg(
        '👑 <b>Тебе переданы права владельца бота.</b> Теперь ты назначаешь и снимаешь администраторов — раздел «Администраторы» на главном экране приложения.',
        { reply_markup: { inline_keyboard: [[openAppButton(settings, '🛠 Открыть')]] } }
      )));
    }
    stmts.push(...otherAdminsNotice(db, users, [newOwnerId, prevOwnerId], `ℹ️ <b>${label}</b> теперь владелец бота.`));
  }
  await db.batch(stmts);
}

export async function grantAdmin(env, id, actor = 0) {
  const db = env.DB;
  const settings = await getSettings(db);
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === id);
  if (!u || !u.registered) return { ok: false, error: 'Назначить можно только зарегистрированного человека.' };
  if (u.is_admin) return { ok: false, error: 'Он(а) уже администратор.' };
  const ownerId = await resolveOwner(db, settings, users);
  await db.batch([
    db.prepare('UPDATE users SET is_admin = 1 WHERE tg_id = ?').bind(id),
    enqueueStmt(db, id, msg(
      '🛠 <b>Владелец назначил тебя администратором.</b>\n\nТеперь ты можешь создавать события и вести их: приглашения, исключения, жеребьёвка, напоминания. Кто кому дарит, админы не видят.',
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🛠 Открыть')]] } }
    )),
    ...otherAdminsNotice(db, users, [id, ownerId], `ℹ️ <b>${escapeHtml(displayName(u))}</b> теперь администратор.`),
    auditStmt(db, 0, actor || ownerId, 'role.grant', displayName(u)),
  ]);
  return { ok: true };
}

export async function revokeAdmin(env, id, actor = 0) {
  const db = env.DB;
  const settings = await getSettings(db);
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === id);
  const ownerId = await resolveOwner(db, settings, users);
  if (!u || !u.is_admin) return { ok: false, error: 'Он(а) не администратор.' };
  if (id === ownerId) return { ok: false, error: 'Нельзя снять права владельца. Сначала передай владение другому.' };
  // 012: обращения, которые он вёл, снова ничьи — остальные админы получают их с кнопкой «Взять»
  const returned = await returnThreadsStmts(db, settings, users, id);
  await db.batch([
    db.prepare('UPDATE users SET is_admin = 0 WHERE tg_id = ?').bind(id),
    ...returned,
    enqueueStmt(db, id, msg('Владелец снял с тебя права администратора. Как участник событий ты продолжаешь играть как обычно.')),
    ...otherAdminsNotice(db, users, [id, ownerId], `ℹ️ <b>${escapeHtml(displayName(u))}</b> больше не администратор.`),
    auditStmt(db, 0, actor || ownerId, 'role.revoke', displayName(u)),
  ]);
  return { ok: true };
}

export async function transferOwnership(env, fromId, toId) {
  const db = env.DB;
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === toId);
  if (!u || !u.registered) return { ok: false, error: 'Передать владение можно только зарегистрированному человеку.' };
  if (toId === fromId) return { ok: false, error: 'Ты и так владелец.' };
  await setOwner(env, toId, { via: 'transfer', prevOwnerId: fromId });
  return { ok: true };
}

// ---------- перенос участия на новый аккаунт ----------

export async function transferAccount(env, fromId, toId, actorId = 0) {
  const db = env.DB;
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
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const actor = users.find((u) => u.tg_id === actorId);
  // Новый аккаунт уже вступил в эвент: остаётся одно участие (письмо и адрес — нового, если не пусты; 009, FR-938)
  const merge = fromMembers.filter((m) => toByEvent.has(m.event_id)).map((m) => mergeMembership(m, toByEvent.get(m.event_id)));
  await db.batch([
    enqueueStmt(db, toId, msg(
      '🔁 Организатор перенёс на этот аккаунт твоё участие в «Тайном Санте»: письма, подопечные, переписка и история событий сохранены.',
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть')]] } }
    )),
    // Перенос не должен быть незаметным (006, FR-602): прежний аккаунт и остальные админы узнают о нём
    enqueueStmt(db, fromId, msg(
      `🔁 Твоё участие в «Тайном Санте» перенесено на аккаунт <b>${escapeHtml(displayName(to))}</b>. Если это не ты — напиши организатору.`
    )),
    ...otherAdminsNotice(db, users, [actorId, toId, fromId],
      `🔁 <b>${escapeHtml(displayName(actor))}</b> перенёс участие <b>${escapeHtml(displayName(from))}</b> на аккаунт <b>${escapeHtml(displayName(to))}</b>.`),
    auditStmt(db, 0, actorId, 'transfer', `${displayName(from)} → ${displayName(to)}`),
    // Участия, письма, пары, переписка, исключения, семья, заявки, отметки «удалён», обращения — по списку REGISTRY
    // (018); ссылки «кто сделал» остаются; запись старого аккаунта удаляется последней
    ...personTransferStmts(db, fromId, toId, { merge }),
  ]);
  return { ok: true, events: fromMembers.length };
}

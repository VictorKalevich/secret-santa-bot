// Общая логика игры: тексты, меню, рассылки, жеребьёвка.

import {
  getSettings, setSettings, setSettingStmt, allUsers, getExclusions, getHistory, getPairs,
  enqueueStmt, updateUserStmt,
} from './db.js';
import { findAssignment, removeFromAssignment, insertIntoAssignment } from './draw.js';
import { tgApi } from './telegram.js';

export const MAX_WORDS = 1000;
export const MAX_CHARS = 15000;

export function countWords(text) {
  const m = String(text || '').trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function appUrl(settings) {
  return (settings.base_url || '') + '/app';
}

export function openAppButton(settings, text = '🎁 Открыть приложение') {
  return { text, web_app: { url: appUrl(settings) } };
}

export function randomCode(len = 10) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export function inviteLink(settings) {
  if (!settings.bot_username || !settings.invite_code) return '';
  return `https://t.me/${settings.bot_username}?start=inv_${settings.invite_code}`;
}

export function isRegistrationOpen(settings) {
  return settings.registration_open !== '0';
}

export function isDrawDone(settings) {
  return settings.draw_done === '1';
}

// ---------- меню в чате ----------

export function menuMessage(user, settings, pair, wardPair) {
  const lines = ['🎄 <b>Тайный Санта</b>', ''];
  if (user.is_participant) {
    lines.push(user.wishlist.trim() ? '✉️ Твоё письмо Санте: заполнено ✅' : '✉️ Твоё письмо Санте: пока пусто — заполни его в приложении');
    if (!isDrawDone(settings)) lines.push('🎲 Жеребьёвка ещё не проведена');
    else if (pair) lines.push('🎲 Жеребьёвка проведена — твой подопечный во вкладке «Подопечный»');
    else lines.push('🎲 Жеребьёвка проведена, организатор скоро добавит тебя');
  } else {
    lines.push('Ты организатор и не участвуешь в обмене подарками.');
  }
  if (user.is_admin) {
    const owner = Number(settings.owner_id || 0) === user.tg_id;
    lines.push('', owner
      ? '👑 Ты владелец игры — панель управления и назначение админов во вкладке «Админ».'
      : '🛠 Ты администратор — панель управления во вкладке «Админ».');
  }

  const kb = [[openAppButton(settings)]];
  const row = [];
  if (pair) row.push({ text: '✉️ Подопечному', callback_data: 'msg:ward' });
  if (wardPair) row.push({ text: '✉️ Своему Санте', callback_data: 'msg:santa' });
  if (row.length) kb.push(row);
  if (user.is_participant) kb.push([{ text: '🔔 Уведомления', callback_data: 'notify' }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- очередь сообщений ----------

// Атомарно забираем пачку сообщений из очереди и отправляем.
// Лимит небольшой: на бесплатном тарифе Cloudflare не больше 50 внешних запросов за вызов.
export async function flushOutbox(env, limit = 25) {
  const db = env.DB;
  const { results } = await db
    .prepare('DELETE FROM outbox WHERE id IN (SELECT id FROM outbox ORDER BY id LIMIT ?) RETURNING *')
    .bind(limit)
    .all();
  if (!results.length) return 0;
  results.sort((a, b) => a.id - b.id);
  const call = tgApi(env);
  const retry = [];
  let rateLimited = false;
  for (const r of results) {
    if (rateLimited || Date.now() - r.created_at > 2 * 24 * 3600 * 1000) {
      if (rateLimited) retry.push(r);
      continue;
    }
    const res = await call('sendMessage', { chat_id: r.chat_id, ...JSON.parse(r.payload) });
    if (res.ok) continue;
    if (res.error_code === 400 || res.error_code === 403) continue; // человек заблокировал бота и т.п.
    if (res.error_code === 429) rateLimited = true;
    retry.push(r);
  }
  if (retry.length) {
    await db.batch(
      retry.map((r) =>
        db.prepare('INSERT INTO outbox (chat_id, payload, created_at) VALUES (?, ?, ?)').bind(r.chat_id, r.payload, r.created_at)
      )
    );
  }
  return results.length;
}

export function msg(text, extra = {}) {
  return { text, parse_mode: 'HTML', ...extra };
}

// ---------- ограничения ----------

export function buildIsAllowed(exclusions, history = []) {
  const banned = new Set();
  for (const e of exclusions) banned.add(`${e.giver}:${e.receiver}`);
  for (const h of history) banned.add(`${h.santa}:${h.ward}`);
  return (a, b) => !banned.has(`${a}:${b}`);
}

export async function drawParticipants(db) {
  const users = await allUsers(db);
  return users.filter((u) => u.registered && u.is_participant);
}

// ---------- жеребьёвка ----------

export async function checkDraw(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  const people = await drawParticipants(db);
  const ids = people.map((u) => u.tg_id);
  const exclusions = (await getExclusions(db)).filter((e) => ids.includes(e.giver) && ids.includes(e.receiver));
  const history = settings.avoid_previous !== '0' ? await getHistory(db) : [];
  const relevantHistory = history.filter((h) => ids.includes(h.santa) && ids.includes(h.ward));

  let res = findAssignment(ids, buildIsAllowed(exclusions, relevantHistory));
  let historyUsed = relevantHistory.length > 0;
  if (!res.ok && relevantHistory.length) {
    res = findAssignment(ids, buildIsAllowed(exclusions));
    historyUsed = false;
  }
  const byId = Object.fromEntries(people.map((u) => [u.tg_id, u]));
  return {
    settings,
    people,
    byId,
    res,
    historyUsed,
    historyIgnored: relevantHistory.length > 0 && !historyUsed,
    emptyWishlists: people.filter((u) => !u.wishlist.trim()).map((u) => u.name),
    problems: res.ok ? [] : res.problems.map((p) => describeProblem(p, byId)),
  };
}

function describeProblem(p, byId) {
  const name = (id) => byId[id]?.name || 'кто-то';
  switch (p.type) {
    case 'too_few': return 'Нужно хотя бы 2 участника.';
    case 'no_receivers': return `${name(p.id)} не может дарить никому — проверь исключения.`;
    case 'no_givers': return `${name(p.id)} не может достаться никому — проверь исключения.`;
    default: return 'Слишком много исключений: распределить всех так, чтобы их соблюсти, не получается. Убери часть исключений.';
  }
}

export async function runDraw(env) {
  const db = env.DB;
  const check = await checkDraw(env);
  if (isDrawDone(check.settings)) return { ok: false, error: 'Жеребьёвка уже проведена.' };
  if (!check.res.ok) return { ok: false, error: check.problems.join('\n') };
  const now = Date.now();
  const stmts = [db.prepare('DELETE FROM pairs')];
  for (const [santa, ward] of check.res.pairs) {
    stmts.push(
      db.prepare('INSERT INTO pairs (santa, ward, seen_text, notified_at, gift_ready) VALUES (?, ?, NULL, ?, 0)')
        .bind(santa, ward, check.byId[ward].wishlist_updated_at || 0)
    );
  }
  stmts.push(setSettingStmt(db, 'draw_done', '1'));
  stmts.push(setSettingStmt(db, 'draw_at', String(now)));
  stmts.push(setSettingStmt(db, 'registration_open', '0'));
  stmts.push(setSettingStmt(db, 'revealed', '0'));
  for (const u of check.people) {
    stmts.push(enqueueStmt(db, u.tg_id, msg(
      '🎄 <b>Жеребьёвка проведена!</b>\n\nОткрой приложение и загляни во вкладку «Подопечный», чтобы узнать, кому ты даришь подарок. Никому не рассказывай 🤫',
      { reply_markup: { inline_keyboard: [[openAppButton(check.settings, '🎁 Узнать подопечного')]] } }
    )));
  }
  await db.batch(stmts);
  return { ok: true, count: check.people.length, singleCycle: check.res.singleCycle, historyIgnored: check.historyIgnored };
}

function pairsToMap(rows) {
  return new Map(rows.map((p) => [p.santa, p.ward]));
}

const NEW_WARD_TEXT =
  '🔄 Состав участников изменился, и у тебя теперь <b>новый подопечный</b>. Загляни во вкладку «Подопечный».';

// Применяем изменённое распределение: переписываем только изменившиеся пары.
async function applyPairsChange(env, oldRows, newMap, changed, users) {
  const db = env.DB;
  const settings = await getSettings(db);
  const oldMap = pairsToMap(oldRows);
  const byId = Object.fromEntries(users.map((u) => [u.tg_id, u]));
  const stmts = [];
  for (const santa of oldMap.keys()) {
    if (!newMap.has(santa)) stmts.push(db.prepare('DELETE FROM pairs WHERE santa = ?').bind(santa));
  }
  // Сначала удаляем изменившиеся пары (иначе сработает UNIQUE на ward), затем вставляем заново
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward && oldMap.has(santa)) stmts.push(db.prepare('DELETE FROM pairs WHERE santa = ?').bind(santa));
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward) {
      stmts.push(
        db.prepare('INSERT INTO pairs (santa, ward, seen_text, notified_at, gift_ready) VALUES (?, ?, NULL, ?, 0)')
          .bind(santa, ward, byId[ward]?.wishlist_updated_at || 0)
      );
    }
  }
  for (const santa of changed) {
    const isNew = !oldMap.has(santa);
    stmts.push(enqueueStmt(db, santa, msg(
      isNew
        ? '🎄 <b>Ты в игре!</b> Жеребьёвка для тебя проведена — загляни во вкладку «Подопечный», чтобы узнать, кому ты даришь подарок 🤫'
        : NEW_WARD_TEXT,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Посмотреть')]] } }
    )));
  }
  return stmts;
}

export async function removeUser(env, id) {
  const db = env.DB;
  const settings = await getSettings(db);
  const users = await allUsers(db);
  const stmts = [];
  if (isDrawDone(settings)) {
    const rows = await getPairs(db);
    const inDraw = rows.some((p) => p.santa === id || p.ward === id);
    if (inDraw) {
      const isAllowed = buildIsAllowed(await getExclusions(db));
      const r = removeFromAssignment(pairsToMap(rows), id, isAllowed);
      if (!r) {
        return { ok: false, error: 'Не получается убрать участника, не нарушив исключения. Ослабь исключения или проведи новую игру.' };
      }
      stmts.push(...(await applyPairsChange(env, rows, r.pairs, r.changed, users)));
    }
  }
  stmts.push(db.prepare('DELETE FROM exclusions WHERE giver = ? OR receiver = ?').bind(id, id));
  stmts.push(db.prepare('DELETE FROM users WHERE tg_id = ?').bind(id));
  stmts.push(enqueueStmt(db, id, msg('Организатор удалил тебя из игры «Тайный Санта». Если это ошибка — напиши ему.')));
  await db.batch(stmts);
  return { ok: true };
}

export async function insertUser(env, id) {
  const db = env.DB;
  const settings = await getSettings(db);
  if (!isDrawDone(settings)) return { ok: false, error: 'Жеребьёвка ещё не проведена.' };
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === id);
  if (!u || !u.registered || !u.is_participant) return { ok: false, error: 'Участник не найден.' };
  const rows = await getPairs(db);
  if (rows.some((p) => p.santa === id)) return { ok: false, error: 'Участник уже в жеребьёвке.' };
  const r = insertIntoAssignment(pairsToMap(rows), id, buildIsAllowed(await getExclusions(db)));
  if (!r) return { ok: false, error: 'Не получается вписать участника, не нарушив исключения.' };
  const stmts = await applyPairsChange(env, rows, r.pairs, r.changed, users);
  await db.batch(stmts);
  return { ok: true };
}

export async function revealAll(env) {
  const db = env.DB;
  const rows = await getPairs(db);
  const users = await allUsers(db);
  const byId = Object.fromEntries(users.map((u) => [u.tg_id, u]));
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.ward, msg(`🎅 <b>Тайна раскрыта!</b>\n\nТвой Тайный Санта — <b>${escapeHtml(byId[p.santa]?.name || '?')}</b>. С праздником! 🎄`))
  );
  stmts.push(setSettingStmt(db, 'revealed', '1'));
  await db.batch(stmts);
  return { ok: true, count: rows.length };
}

export async function newGame(env) {
  const db = env.DB;
  const rows = await getPairs(db);
  const stmts = [];
  if (rows.length) {
    stmts.push(db.prepare('DELETE FROM history'));
    for (const p of rows) stmts.push(db.prepare('INSERT INTO history (santa, ward) VALUES (?, ?)').bind(p.santa, p.ward));
  }
  stmts.push(db.prepare('DELETE FROM pairs'));
  stmts.push(setSettingStmt(db, 'draw_done', '0'));
  stmts.push(setSettingStmt(db, 'revealed', '0'));
  stmts.push(setSettingStmt(db, 'registration_open', '1'));
  await db.batch(stmts);
  return { ok: true };
}

export async function remindUnfilled(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  const people = (await drawParticipants(db)).filter((u) => !u.wishlist.trim());
  const deadline = settings.deadline ? ` до <b>${formatDate(settings.deadline)}</b>` : '';
  const stmts = people.map((u) =>
    enqueueStmt(db, u.tg_id, msg(
      `⏰ Напоминание: твоё письмо Санте пока пустое. Заполни его${deadline}, чтобы Санте было проще выбрать подарок.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо')]] } }
    ))
  );
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: people.length };
}

export async function remindSantas(env) {
  const db = env.DB;
  const settings = await getSettings(db);
  const rows = (await getPairs(db)).filter((p) => !p.gift_ready);
  const when = settings.event_date ? ` Вручение — <b>${formatDate(settings.event_date)}</b>.` : '';
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.santa, msg(
      `🎁 Напоминание для Санты: подарок для подопечного уже готов?${when}\nКогда будет готов — отметь это во вкладке «Подопечный».`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть')]] } }
    ))
  );
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: rows.length };
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

// ---------- роли: владелец и администраторы (002) ----------

// Владелец игры: settings.owner_id; если не задан или недействителен — самый ранний админ (FR-109).
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

function displayName(u) {
  return u?.name || (u?.username ? '@' + u.username : 'Кто-то');
}

function otherAdminsNotice(db, users, exclude, text) {
  return users
    .filter((u) => u.is_admin && u.registered && !exclude.includes(u.tg_id))
    .map((u) => enqueueStmt(db, u.tg_id, msg(text, { disable_notification: true })));
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
  ];
  if (prevOwnerId && prevOwnerId !== newOwnerId) {
    if (via === 'link') {
      stmts.push(enqueueStmt(db, prevOwnerId, msg(
        `⚠️ Права владельца игры перешли к <b>${label}</b> по ссылке со страницы настройки. Ты остаёшься администратором.\n\n` +
        'Если это не ты и не по договорённости — открой страницу настройки и перейди по ссылке владельца снова, а потом смени ADMIN_SECRET.'
      )));
    }
    if (via === 'transfer') {
      stmts.push(enqueueStmt(db, newOwnerId, msg(
        '👑 <b>Тебе переданы права владельца игры.</b> Теперь ты назначаешь и снимаешь администраторов — раздел «Администраторы» во вкладке «Админ».',
        { reply_markup: { inline_keyboard: [[openAppButton(settings, '🛠 Открыть')]] } }
      )));
    }
    stmts.push(...otherAdminsNotice(db, users, [newOwnerId, prevOwnerId], `ℹ️ <b>${label}</b> теперь владелец игры.`));
  }
  await db.batch(stmts);
}

export async function grantAdmin(env, id) {
  const db = env.DB;
  const settings = await getSettings(db);
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === id);
  if (!u || !u.registered) return { ok: false, error: 'Назначить можно только зарегистрированного участника.' };
  if (u.is_admin) return { ok: false, error: 'Он(а) уже администратор.' };
  const ownerId = await resolveOwner(db, settings, users);
  await db.batch([
    db.prepare('UPDATE users SET is_admin = 1 WHERE tg_id = ?').bind(id),
    enqueueStmt(db, id, msg(
      '🛠 <b>Владелец назначил тебя администратором игры.</b>\n\nВо вкладке «Админ» можно управлять приглашениями, исключениями, жеребьёвкой и напоминаниями. Кто кому дарит, админы не видят.',
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🛠 Открыть')]] } }
    )),
    ...otherAdminsNotice(db, users, [id, ownerId], `ℹ️ <b>${escapeHtml(displayName(u))}</b> теперь администратор.`),
  ]);
  return { ok: true };
}

export async function revokeAdmin(env, id) {
  const db = env.DB;
  const settings = await getSettings(db);
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === id);
  const ownerId = await resolveOwner(db, settings, users);
  if (!u || !u.is_admin) return { ok: false, error: 'Он(а) не администратор.' };
  if (id === ownerId) return { ok: false, error: 'Нельзя снять права владельца. Сначала передай владение другому.' };
  await db.batch([
    db.prepare('UPDATE users SET is_admin = 0 WHERE tg_id = ?').bind(id),
    enqueueStmt(db, id, msg('Владелец снял с тебя права администратора игры. Как участник ты продолжаешь играть как обычно.')),
    ...otherAdminsNotice(db, users, [id, ownerId], `ℹ️ <b>${escapeHtml(displayName(u))}</b> больше не администратор.`),
  ]);
  return { ok: true };
}

export async function transferOwnership(env, fromId, toId) {
  const db = env.DB;
  const users = await allUsers(db);
  const u = users.find((x) => x.tg_id === toId);
  if (!u || !u.registered) return { ok: false, error: 'Передать владение можно только зарегистрированному участнику.' };
  if (toId === fromId) return { ok: false, error: 'Ты и так владелец.' };
  await setOwner(env, toId, { via: 'transfer', prevOwnerId: fromId });
  return { ok: true };
}

export { setSettings, updateUserStmt };

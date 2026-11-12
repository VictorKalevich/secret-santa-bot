// Игровая логика: эвенты, меню, рассылки, жеребьёвка, переписка, роли.

import {
  getSettings, setSettings, setSettingStmt, allUsers, getUser, getExclusions, getPairs, enqueueStmt,
  updateUserStmt, pairOfSanta, pairOfWard, getEvent, updateEventStmt, eventMembers, addMemberStmt, enqueueIfStmt,
} from './db.js';
import { findAssignment, removeFromAssignment, insertIntoAssignment } from './draw.js';
import { tgApi } from './telegram.js';

// Лимит письма и сообщения переписки: одно сообщение Telegram вмещает 4096 символов (UTF-16, как String.length),
// 96 оставляем под заголовок уведомления (003, FR-309).
export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const MAX_CHARS = 4000;
// Переписка завершённого эвента открыта ещё 7 суток (005, FR-506)
export const CHAT_GRACE_MS = 7 * 24 * 3600 * 1000;

// ---------- общие помощники ----------

export function appUrl(settings, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return (settings.base_url || '') + '/app' + (q ? '?' + q : '');
}

export function openAppButton(settings, text = '🎁 Открыть приложение', params = {}) {
  return { text, web_app: { url: appUrl(settings, params) } };
}

export function randomCode(len = 10) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export function inviteLink(settings, ev) {
  if (!settings.bot_username || !ev?.invite_code) return '';
  return `https://t.me/${settings.bot_username}?start=inv_${ev.invite_code}`;
}

export const isFinished = (ev) => ev.status === 'finished';
export const chatUntil = (ev) => (isFinished(ev) ? ev.finished_at + CHAT_GRACE_MS : 0);
export const chatWritable = (ev, now = Date.now()) => !isFinished(ev) || now < chatUntil(ev);

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export const q = (ev) => `«${escapeHtml(ev.title)}»`;

// Короткое название для заголовков: не больше max единиц UTF-16, суррогатная пара не разрывается (006, FR-603).
export function shortTitle(title, max = 40) {
  const s = String(title ?? '');
  if (s.length <= max) return s;
  let out = '';
  for (const ch of s) {
    if (out.length + ch.length > max - 1) break;
    out += ch;
  }
  return out.trimEnd() + '…';
}

export function msg(text, extra = {}) {
  return { text, parse_mode: 'HTML', ...extra };
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

function formatMs(ms, offsetHours = 3) {
  const d = new Date(ms + offsetHours * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// ---------- меню в чате ----------

// items: [{ ev, member, pair, wardPair }] — идущие эвенты человека; finishedCount — сколько завершённых
export function menuMessage(user, settings, items, finishedCount = 0) {
  const lines = ['🎄 <b>Тайный Санта</b>', ''];
  if (!items.length) {
    lines.push(user.is_admin
      ? 'Идущих эвентов у тебя нет. Создай эвент в приложении — там появится пригласительная ссылка.'
      : 'Сейчас ты не участвуешь ни в одном идущем эвенте. Попроси у организатора пригласительную ссылку.');
  } else {
    lines.push('Твои эвенты:');
    for (const it of items) {
      const letter = it.member.wishlist.trim() ? 'письмо ✅' : 'письмо пустое ✏️';
      const draw = !it.ev.draw_done ? 'жеребьёвка впереди' : it.pair ? 'подопечный назначен 🎁' : 'ждёт добавления в жеребьёвку';
      lines.push(`• ${q(it.ev)} — ${letter}, ${draw}`);
    }
  }
  if (finishedCount) lines.push('', `📚 Завершённых эвентов: ${finishedCount} — их история в приложении.`);
  if (user.is_admin) {
    const owner = Number(settings.owner_id || 0) === user.tg_id;
    lines.push('', owner
      ? '👑 Ты владелец бота — эвенты и администраторы в приложении.'
      : '🛠 Ты администратор — эвенты в приложении.');
  }
  const kb = [[openAppButton(settings)]];
  for (const it of items.slice(0, 3)) {
    const row = [];
    if (it.pair) row.push({ text: `💬 Подопечному · ${it.ev.title}`.slice(0, 60), callback_data: `msg:ward:${it.ev.id}` });
    if (it.wardPair) row.push({ text: `💬 Санте · ${it.ev.title}`.slice(0, 60), callback_data: `msg:santa:${it.ev.id}` });
    if (row.length) kb.push(row);
  }
  kb.push([{ text: '🔔 Уведомления', callback_data: 'notify' }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } };
}

// ---------- очередь сообщений ----------

// Отправка очереди (006): пачку сообщений «захватываем» на минуту (locked_until), отправляем, затем удаляем
// отправленные и освобождаем неотправленные. Если вызов оборвётся, захват истечёт и сообщения уйдут позже — без потерь
// (редкий дубль допустим). Порядок сохраняется: id не меняются, а сообщение человеку не берётся, пока более старое
// сообщение ему же захвачено другим вызовом или не ушло в этой пачке.
// Лимит небольшой: на бесплатном тарифе Cloudflare не больше 50 внешних запросов за вызов.
const OUTBOX_LOCK_MS = 60 * 1000;
const OUTBOX_TTL_MS = 2 * 24 * 3600 * 1000;

export async function flushOutbox(env, limit = 25) {
  // Несколько кругов: пока этот вызов отправлял, другой мог поставить в очередь сообщения тем же людям и пропустить их
  // (их более старые сообщения были захвачены здесь). Забираем их сразу, а не через минуту, — если круг прошёл без сбоев.
  let total = 0;
  for (let round = 0; round < 3 && total < limit; round++) {
    const r = await flushRound(env, limit - total);
    total += r.claimed;
    if (!r.claimed || r.released) break;
  }
  return total;
}

async function flushRound(env, limit) {
  const db = env.DB;
  const now = Date.now();
  const { results } = await db
    .prepare(
      `UPDATE outbox SET locked_until = ?1 WHERE id IN (
         SELECT o.id FROM outbox o
          WHERE o.locked_until < ?2
            AND NOT EXISTS (SELECT 1 FROM outbox p WHERE p.chat_id = o.chat_id AND p.id < o.id AND p.locked_until >= ?2)
          ORDER BY o.id LIMIT ?3)
       RETURNING *`
    )
    .bind(now + OUTBOX_LOCK_MS, now, limit)
    .all();
  if (!results.length) return { claimed: 0, released: 0 };
  results.sort((a, b) => a.id - b.id);
  const call = tgApi(env);
  const done = [];
  const release = [];
  const blocked = new Set();
  const held = new Set(); // люди, чьё более старое сообщение не ушло: следующие ему его не обгоняют
  let rateLimited = false;
  for (const r of results) {
    if (now - r.created_at > OUTBOX_TTL_MS || blocked.has(r.chat_id)) { done.push(r.id); continue; }
    if (rateLimited || held.has(r.chat_id)) { release.push(r.id); continue; }
    const res = await call('sendMessage', { chat_id: r.chat_id, ...JSON.parse(r.payload) });
    if (res.ok) { done.push(r.id); continue; }
    // 403 — бот заблокирован или человек удалён: запоминаем, чтобы админ это видел (006, FR-608)
    if (res.error_code === 403) { blocked.add(r.chat_id); done.push(r.id); continue; }
    // 400 — сообщение некорректно, повтор не поможет (код и описание уже в журнале — см. tgApi)
    if (res.error_code === 400) { done.push(r.id); continue; }
    if (res.error_code === 429) rateLimited = true;
    held.add(r.chat_id);
    release.push(r.id);
  }
  const list = (ids) => ids.map(() => '?').join(',');
  const stmts = [];
  if (done.length) stmts.push(db.prepare(`DELETE FROM outbox WHERE id IN (${list(done)})`).bind(...done));
  if (release.length) stmts.push(db.prepare(`UPDATE outbox SET locked_until = 0 WHERE id IN (${list(release)})`).bind(...release));
  for (const chat of blocked) {
    stmts.push(db.prepare('UPDATE users SET blocked_at = ? WHERE tg_id = ? AND blocked_at = 0').bind(Date.now(), chat));
  }
  if (stmts.length) await db.batch(stmts);
  return { claimed: results.length, released: release.length };
}

// ---------- участники и ограничения ----------

export function buildIsAllowed(exclusions, extraPairs = []) {
  const banned = new Set();
  for (const e of exclusions) banned.add(`${e.giver}:${e.receiver}`);
  for (const h of extraPairs) banned.add(`${h.santa}:${h.ward}`);
  return (a, b) => !banned.has(`${a}:${b}`);
}

export async function drawParticipants(db, eventId) {
  return (await eventMembers(db, eventId)).filter((m) => m.registered);
}

// Пары прошлого эвента с наибольшим числом пар среди этих людей; при равенстве — последнего
// (для «не повторять пары», FR-510). Так параллельный эвент другой группы не подменяет «свой».
async function previousPairs(db, ev, ids) {
  const set = new Set(ids);
  const { results } = await db
    .prepare(
      `SELECT p.event_id, p.santa, p.ward FROM pairs p JOIN events e ON e.id = p.event_id
        WHERE p.event_id != ? AND e.created_at <= ? ORDER BY e.created_at DESC, e.id DESC`
    )
    .bind(ev.id, ev.created_at)
    .all();
  const byEvent = new Map();
  for (const r of results) {
    if (!set.has(r.santa) || !set.has(r.ward)) continue;
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }
  let best = [];
  for (const list of byEvent.values()) if (list.length > best.length) best = list; // Map хранит порядок «новые первыми»
  return best;
}

// ---------- жеребьёвка ----------

function describeProblem(p, byId) {
  const name = (id) => byId[id]?.name || 'кто-то';
  switch (p.type) {
    case 'too_few': return 'Нужно хотя бы 2 участника.';
    case 'ring_too_few': return 'Для кольцевой жеребьёвки нужно минимум 3 участника — или выключи кольцевую в параметрах эвента.';
    case 'ring_impossible': return 'С такими исключениями без взаимных пар не обойтись. Убери часть исключений или выключи кольцевую жеребьёвку.';
    case 'no_receivers': return `${name(p.id)} не может дарить никому — проверь исключения.`;
    case 'no_givers': return `${name(p.id)} не может достаться никому — проверь исключения.`;
    case 'search_exhausted': return 'Не удалось быстро подобрать распределение — попробуй ещё раз. Если не выйдет, убери часть исключений или выключи кольцевую жеребьёвку.';
    default: return 'Слишком много исключений: распределить всех так, чтобы их соблюсти, не получается. Убери часть исключений.';
  }
}

export async function checkDraw(env, ev) {
  const db = env.DB;
  const people = await drawParticipants(db, ev.id);
  const ids = people.map((u) => u.user_id);
  const exclusions = (await getExclusions(db, ev.id)).filter((e) => ids.includes(e.giver) && ids.includes(e.receiver));
  const prev = ev.avoid_previous ? await previousPairs(db, ev, ids) : [];
  const ring = !!ev.ring;
  let res = findAssignment(ids, buildIsAllowed(exclusions, prev), Math.random, { ring });
  let historyUsed = prev.length > 0;
  if (!res.ok && prev.length) {
    res = findAssignment(ids, buildIsAllowed(exclusions), Math.random, { ring });
    historyUsed = false;
  }
  const byId = Object.fromEntries(people.map((u) => [u.user_id, u]));
  return {
    people,
    byId,
    res,
    ring,
    historyUsed,
    historyIgnored: prev.length > 0 && !historyUsed,
    emptyWishlists: people.filter((u) => !u.wishlist.trim()).map((u) => u.name),
    problems: res.ok ? [] : res.problems.map((p) => describeProblem(p, byId)),
  };
}

export async function runDraw(env, ev) {
  const db = env.DB;
  if (ev.draw_done) return { ok: false, error: 'Жеребьёвка уже проведена.' };
  const settings = await getSettings(db);
  const check = await checkDraw(env, ev);
  if (!check.res.ok) return { ok: false, error: check.problems.join('\n') };
  // Атомарно (006, FR-607): batch D1 — одна транзакция. Первый оператор «занимает» жеребьёвку своим токеном;
  // остальные записи выполняются, только если токен в эвенте — наш. Вторая одновременная жеребьёвка ничего не запишет.
  const token = randomCode(16);
  const guard = 'EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_token = ?)';
  const stmts = [
    db.prepare('UPDATE events SET draw_done = 1, draw_at = ?, draw_token = ?, registration_open = 0, revealed = 0 WHERE id = ? AND draw_done = 0')
      .bind(Date.now(), token, ev.id),
    db.prepare(`DELETE FROM pairs WHERE event_id = ? AND ${guard}`).bind(ev.id, ev.id, token),
  ];
  for (const [santa, ward] of check.res.pairs) {
    stmts.push(
      db.prepare(`INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) SELECT ?, ?, ?, NULL, ?, 0 WHERE ${guard}`)
        .bind(ev.id, santa, ward, check.byId[ward].wishlist_updated_at || 0, ev.id, token)
    );
  }
  for (const u of check.people) {
    stmts.push(enqueueIfStmt(db, u.user_id, msg(
      `🎄 <b>Жеребьёвка в эвенте ${q(ev)} проведена!</b>\n\nОткрой приложение и загляни во вкладку «Подопечный», чтобы узнать, кому ты даришь подарок. Никому не рассказывай 🤫`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Узнать подопечного', { event: ev.id })]] } }
    ), guard, ev.id, token));
  }
  const [claim] = await db.batch(stmts);
  if (!claim.meta.changes) return { ok: false, error: 'Жеребьёвка уже проведена.' };
  return { ok: true, count: check.people.length, singleCycle: check.res.singleCycle, historyIgnored: check.historyIgnored };
}

function pairsToMap(rows) {
  return new Map(rows.map((p) => [p.santa, p.ward]));
}

// Применяем изменённое распределение эвента: переписываем только изменившиеся пары.
async function applyPairsChange(env, ev, oldRows, newMap, changed, members) {
  const db = env.DB;
  const settings = await getSettings(db);
  const oldMap = pairsToMap(oldRows);
  const byId = Object.fromEntries(members.map((u) => [u.user_id, u]));
  const stmts = [];
  for (const santa of oldMap.keys()) {
    if (!newMap.has(santa)) stmts.push(db.prepare('DELETE FROM pairs WHERE event_id = ? AND santa = ?').bind(ev.id, santa));
  }
  // Переписка исчезнувших пар удаляется: новая пара начинает разговор с чистого листа (003, FR-308)
  for (const [santa, ward] of oldMap) {
    if (newMap.get(santa) !== ward) {
      stmts.push(db.prepare('DELETE FROM messages WHERE event_id = ? AND santa = ? AND ward = ?').bind(ev.id, santa, ward));
    }
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward && oldMap.has(santa)) {
      stmts.push(db.prepare('DELETE FROM pairs WHERE event_id = ? AND santa = ?').bind(ev.id, santa));
    }
  }
  for (const [santa, ward] of newMap) {
    if (oldMap.get(santa) !== ward) {
      stmts.push(
        db.prepare('INSERT INTO pairs (event_id, santa, ward, seen_text, notified_at, gift_ready) VALUES (?, ?, ?, NULL, ?, 0)')
          .bind(ev.id, santa, ward, byId[ward]?.wishlist_updated_at || 0)
      );
    }
  }
  for (const santa of changed) {
    const isNew = !oldMap.has(santa);
    stmts.push(enqueueStmt(db, santa, msg(
      isNew
        ? `🎄 <b>Ты в игре!</b> Жеребьёвка эвента ${q(ev)} для тебя проведена — загляни во вкладку «Подопечный» 🤫`
        : `🔄 Состав эвента ${q(ev)} изменился, и у тебя теперь <b>новый подопечный</b>. Загляни во вкладку «Подопечный».`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Посмотреть', { event: ev.id })]] } }
    )));
  }
  return stmts;
}

// Убрать человека из эвента (после жеребьёвки — с минимальной перестройкой пар)
export async function removeMember(env, ev, userId, { notify = true } = {}) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  if (!members.some((m) => m.user_id === userId)) return { ok: false, error: 'Человек не участвует в этом эвенте.' };
  const stmts = [];
  if (ev.draw_done) {
    const rows = await getPairs(db, ev.id);
    if (rows.some((p) => p.santa === userId || p.ward === userId)) {
      const isAllowed = buildIsAllowed(await getExclusions(db, ev.id));
      const r = removeFromAssignment(pairsToMap(rows), userId, isAllowed, Math.random, { ring: !!ev.ring });
      if (!r) {
        return { ok: false, error: 'Не получается убрать участника, не нарушив исключения или кольцевую жеребьёвку. Ослабь исключения.' };
      }
      stmts.push(...(await applyPairsChange(env, ev, rows, r.pairs, r.changed, members)));
    }
  }
  stmts.push(db.prepare('DELETE FROM exclusions WHERE event_id = ? AND (giver = ? OR receiver = ?)').bind(ev.id, userId, userId));
  stmts.push(db.prepare('DELETE FROM messages WHERE event_id = ? AND (santa = ? OR ward = ?)').bind(ev.id, userId, userId));
  stmts.push(db.prepare('DELETE FROM members WHERE event_id = ? AND user_id = ?').bind(ev.id, userId));
  if (notify) stmts.push(enqueueStmt(db, userId, msg(`Организатор удалил тебя из эвента ${q(ev)}. Если это ошибка — напиши ему.`)));
  await db.batch(stmts);
  return { ok: true };
}

export async function insertMember(env, ev, userId) {
  const db = env.DB;
  if (!ev.draw_done) return { ok: false, error: 'Жеребьёвка ещё не проведена.' };
  const members = await eventMembers(db, ev.id);
  const u = members.find((x) => x.user_id === userId);
  if (!u || !u.registered) return { ok: false, error: 'Участник не найден.' };
  const rows = await getPairs(db, ev.id);
  if (rows.some((p) => p.santa === userId)) return { ok: false, error: 'Участник уже в жеребьёвке.' };
  const r = insertIntoAssignment(pairsToMap(rows), userId, buildIsAllowed(await getExclusions(db, ev.id)), Math.random, { ring: !!ev.ring });
  if (!r) return { ok: false, error: 'Не получается вписать участника, не нарушив исключения.' };
  await db.batch(await applyPairsChange(env, ev, rows, r.pairs, r.changed, members));
  return { ok: true };
}

export async function revealAll(env, ev) {
  const db = env.DB;
  const rows = await getPairs(db, ev.id);
  const users = await allUsers(db);
  const byId = Object.fromEntries(users.map((u) => [u.tg_id, u]));
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.ward, msg(`🎅 <b>Тайна раскрыта!</b>\n\nВ эвенте ${q(ev)} твой Тайный Санта — <b>${escapeHtml(byId[p.santa]?.name || '?')}</b>. С праздником! 🎄`))
  );
  stmts.push(updateEventStmt(db, ev.id, { revealed: 1 }));
  await db.batch(stmts);
  return { ok: true, count: rows.length };
}

export async function remindUnfilled(env, ev) {
  const db = env.DB;
  const settings = await getSettings(db);
  const people = (await drawParticipants(db, ev.id)).filter((u) => !u.wishlist.trim());
  const deadline = ev.deadline ? ` до <b>${formatDate(ev.deadline)}</b>` : '';
  const stmts = people.map((u) =>
    enqueueStmt(db, u.user_id, msg(
      `⏰ Напоминание: твоё письмо Санте в эвенте ${q(ev)} пока пустое. Заполни его${deadline}, чтобы Санте было проще выбрать подарок.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '✏️ Написать письмо', { event: ev.id })]] } }
    ))
  );
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: people.length };
}

export async function remindSantas(env, ev) {
  const db = env.DB;
  const settings = await getSettings(db);
  const rows = (await getPairs(db, ev.id)).filter((p) => !p.gift_ready);
  const when = ev.event_date ? ` Вручение — <b>${formatDate(ev.event_date)}</b>.` : '';
  const stmts = rows.map((p) =>
    enqueueStmt(db, p.santa, msg(
      `🎁 Напоминание для Санты (эвент ${q(ev)}): подарок для подопечного уже готов?${when}\nКогда будет готов — отметь это во вкладке «Подопечный».`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть', { event: ev.id })]] } }
    ))
  );
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: rows.length };
}

// ---------- жизненный цикл эвента (005) ----------

export async function createEvent(env, title, createdBy) {
  const db = env.DB;
  const clean = String(title || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 80) return { ok: false, error: 'Название эвента — от 1 до 80 символов.' };
  const row = await db
    .prepare('INSERT INTO events (title, created_at, created_by, invite_code) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(clean, Date.now(), createdBy, randomCode())
    .first();
  return { ok: true, event: row };
}

export async function finishEvent(env, ev) {
  const db = env.DB;
  if (isFinished(ev)) return { ok: false, error: 'Эвент уже завершён.' };
  const settings = await getSettings(db);
  const now = Date.now();
  const members = await drawParticipants(db, ev.id);
  const until = formatMs(now + CHAT_GRACE_MS, Number(env.TIMEZONE_OFFSET_HOURS ?? 3));
  await db.batch([
    updateEventStmt(db, ev.id, { status: 'finished', finished_at: now, registration_open: 0 }),
    ...members.map((m) => enqueueStmt(db, m.user_id, msg(
      `🏁 <b>Эвент ${q(ev)} завершён.</b> Спасибо за игру!\n\nПисьмо Санте теперь только для чтения. Переписка открыта ещё 7 дней (до ${until}), потом останется для чтения. История эвента сохранится в приложении.`,
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '📚 Открыть', { event: ev.id })]] } }
    ))),
  ]);
  return { ok: true };
}

export async function deleteEvent(env, ev) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  await db.batch([
    ...members.map((m) => enqueueStmt(db, m.user_id, msg(`🗑 Эвент ${q(ev)} удалён организатором вместе с письмами и перепиской.`))),
    db.prepare('DELETE FROM messages WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM exclusions WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM members WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM events WHERE id = ?').bind(ev.id),
  ]);
  return { ok: true, count: members.length };
}

// Полный сброс эвента (004 → 005: в пределах одного эвента). Владелец, если участвовал, остаётся.
export async function resetEvent(env, ev, ownerId) {
  const db = env.DB;
  const members = await eventMembers(db, ev.id);
  const removed = members.filter((m) => m.user_id !== ownerId);
  const inviteCode = randomCode();
  await db.batch([
    ...removed.map((m) => enqueueStmt(db, m.user_id, msg(
      `🎄 Организатор начал эвент ${q(ev)} заново. Прежние данные удалены. Чтобы участвовать, попроси новую пригласительную ссылку.`
    ))),
    db.prepare('DELETE FROM members WHERE event_id = ? AND user_id != ?').bind(ev.id, ownerId),
    db.prepare("UPDATE members SET wishlist = '', wishlist_updated_at = 0 WHERE event_id = ?").bind(ev.id),
    db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM exclusions WHERE event_id = ?').bind(ev.id),
    db.prepare('DELETE FROM messages WHERE event_id = ?').bind(ev.id),
    updateEventStmt(db, ev.id, {
      status: 'active', finished_at: 0, draw_done: 0, draw_at: 0, draw_token: '', revealed: 0, registration_open: 1, invite_code: inviteCode,
      ring: 1, avoid_previous: 1, budget: '', event_date: '', place: '', deadline: '', notes: '', last_daily: '',
    }),
  ]);
  return { removed: removed.length, inviteCode };
}

// Пригласить участников другого эвента: сообщение со ссылкой вступления (FR-509)
export async function inviteFromEvent(env, ev, fromEv) {
  const db = env.DB;
  const settings = await getSettings(db);
  const link = inviteLink(settings, ev);
  if (!link) return { ok: false, error: 'Сначала открой страницу настройки /setup (см. README).' };
  const current = new Set((await eventMembers(db, ev.id)).map((m) => m.user_id));
  const people = (await drawParticipants(db, fromEv.id)).filter((m) => !current.has(m.user_id));
  const stmts = people.map((m) => enqueueStmt(db, m.user_id, msg(
    `📨 <b>Приглашение в эвент ${q(ev)}</b> — Тайный Санта.\nНажми кнопку, чтобы участвовать.`,
    { reply_markup: { inline_keyboard: [[{ text: '🎄 Участвовать', url: link }]] } }
  )));
  if (stmts.length) await db.batch(stmts);
  return { ok: true, count: people.length };
}

// ---------- переписка Санты и подопечного (003, по эвентам) ----------

export async function chatPair(db, eventId, userId, withWhom) {
  if (withWhom === 'ward') {
    const p = await pairOfSanta(db, eventId, userId);
    return p ? { santa: userId, ward: p.ward, me: 'santa', other: p.ward } : null;
  }
  const p = await pairOfWard(db, eventId, userId);
  return p ? { santa: p.santa, ward: userId, me: 'ward', other: p.santa } : null;
}

export function chatButtons(settings, ev, recipientSide) {
  // recipientSide — кто получает: подопечный отвечает Санте, Санта — подопечному
  const replyTo = recipientSide === 'ward' ? 'santa' : 'ward';
  return {
    inline_keyboard: [[
      { text: '↩️ Ответить', callback_data: `msg:${replyTo}:${ev.id}` },
      { text: '💬 Вся переписка', web_app: { url: appUrl(settings, { event: ev.id, chat: replyTo }) } },
    ]],
  };
}

// Сохранить сообщение в переписке и поставить уведомление получателю в очередь.
export async function sendChatMessage(env, ev, fromId, to, rawText) {
  const db = env.DB;
  const text = String(rawText ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, error: 'Пустое сообщение.' };
  if (text.length > MAX_CHARS) {
    return { ok: false, error: `Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS} (лимит сообщения Telegram).` };
  }
  if (!chatWritable(ev)) return { ok: false, error: 'Эвент завершён больше недели назад: переписка доступна только для чтения.' };
  const pair = await chatPair(db, ev.id, fromId, to);
  if (!pair) return { ok: false, error: to === 'ward' ? 'У тебя пока нет подопечного.' : 'Жеребьёвка для тебя ещё не проведена.' };
  const settings = await getSettings(db);
  const now = Date.now();
  // Заголовок + текст до MAX_CHARS всегда помещаются в одно сообщение Telegram: название эвента сокращаем
  const t = q({ title: shortTitle(ev.title) });
  const header = pair.me === 'santa'
    ? `💬 <b>Твой Тайный Санта (${t}) пишет:</b>`
    : `💬 <b>Тебе пишет твой подопечный (${t}):</b>`;
  const [inserted] = await db.batch([
    db.prepare('INSERT INTO messages (event_id, santa, ward, sender, text, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, created_at')
      .bind(ev.id, pair.santa, pair.ward, pair.me, text, now),
    // Отвечая, человек видел сообщения собеседника — помечаем их прочитанными
    db.prepare('UPDATE messages SET read_at = ? WHERE event_id = ? AND santa = ? AND ward = ? AND sender != ? AND read_at = 0')
      .bind(now, ev.id, pair.santa, pair.ward, pair.me),
    enqueueStmt(db, pair.other, msg(header + '\n\n' + escapeHtml(text), {
      reply_markup: chatButtons(settings, ev, pair.me === 'santa' ? 'ward' : 'santa'),
    })),
  ]);
  const row = inserted.results[0];
  return { ok: true, message: { id: row.id, mine: true, text, created_at: row.created_at } };
}

const UNREAD_SQL = `
  SELECT m.event_id,
         SUM(CASE WHEN m.santa = ?1 AND m.sender = 'ward' THEN 1 ELSE 0 END) AS from_ward,
         SUM(CASE WHEN m.ward = ?1 AND m.sender = 'santa' THEN 1 ELSE 0 END) AS from_santa
    FROM messages m JOIN pairs p ON p.event_id = m.event_id AND p.santa = m.santa AND p.ward = m.ward
   WHERE m.read_at = 0 AND (m.santa = ?1 OR m.ward = ?1)`;

export async function unreadCounts(db, eventId, userId) {
  const r = await db.prepare(UNREAD_SQL + ' AND m.event_id = ?2 GROUP BY m.event_id').bind(userId, eventId).first();
  return { from_ward: r?.from_ward || 0, from_santa: r?.from_santa || 0 };
}

export async function unreadByEvent(db, userId) {
  const { results } = await db.prepare(UNREAD_SQL + ' GROUP BY m.event_id').bind(userId).all();
  return Object.fromEntries(results.map((r) => [r.event_id, (r.from_ward || 0) + (r.from_santa || 0)]));
}

// ---------- перенос участия на новый аккаунт (004 → 005: во всех эвентах) ----------

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
      return { ok: false, error: `Новый аккаунт уже участвует в жеребьёвке эвента «${ev?.title || ''}» — выбери другую запись.` };
    }
  }
  const [settings, users] = await Promise.all([getSettings(db), allUsers(db)]);
  const actor = users.find((u) => u.tg_id === actorId);
  const stmts = [];
  for (const m of fromMembers) {
    const t = toByEvent.get(m.event_id);
    if (t) {
      // Новый аккаунт уже вступил в этот эвент: оставляем одно участие; письмо — нового, если оно не пустое
      const keepNew = !!t.wishlist.trim();
      stmts.push(db.prepare('DELETE FROM members WHERE event_id = ? AND user_id = ?').bind(m.event_id, toId));
      stmts.push(db.prepare('UPDATE members SET user_id = ?, wishlist = ?, wishlist_updated_at = ? WHERE event_id = ? AND user_id = ?')
        .bind(toId, keepNew ? t.wishlist : m.wishlist, keepNew ? t.wishlist_updated_at : m.wishlist_updated_at, m.event_id, fromId));
    } else {
      stmts.push(db.prepare('UPDATE members SET user_id = ? WHERE event_id = ? AND user_id = ?').bind(toId, m.event_id, fromId));
    }
  }
  stmts.push(
    db.prepare('UPDATE pairs SET santa = ? WHERE santa = ?').bind(toId, fromId),
    db.prepare('UPDATE pairs SET ward = ? WHERE ward = ?').bind(toId, fromId),
    db.prepare('UPDATE messages SET santa = ? WHERE santa = ?').bind(toId, fromId),
    db.prepare('UPDATE messages SET ward = ? WHERE ward = ?').bind(toId, fromId),
    db.prepare('UPDATE OR IGNORE exclusions SET giver = ? WHERE giver = ?').bind(toId, fromId),
    db.prepare('UPDATE OR IGNORE exclusions SET receiver = ? WHERE receiver = ?').bind(toId, fromId),
    db.prepare('DELETE FROM exclusions WHERE giver = ? OR receiver = ? OR giver = receiver').bind(fromId, fromId),
    db.prepare('UPDATE users SET is_admin = ? WHERE tg_id = ?').bind(from.is_admin || to.is_admin ? 1 : 0, toId),
    db.prepare('DELETE FROM users WHERE tg_id = ?').bind(fromId),
    enqueueStmt(db, toId, msg(
      '🔁 Организатор перенёс на этот аккаунт твоё участие в «Тайном Санте»: письма, подопечные, переписка и история эвентов сохранены.',
      { reply_markup: { inline_keyboard: [[openAppButton(settings, '🎁 Открыть')]] } }
    )),
    // Перенос не должен быть незаметным (006, FR-602): прежний аккаунт и остальные админы узнают о нём
    enqueueStmt(db, fromId, msg(
      `🔁 Твоё участие в «Тайном Санте» перенесено на аккаунт <b>${escapeHtml(displayName(to))}</b>. Если это не ты — напиши организатору.`
    )),
    ...otherAdminsNotice(db, users, [actorId, toId, fromId],
      `🔁 <b>${escapeHtml(displayName(actor))}</b> перенёс участие <b>${escapeHtml(displayName(from))}</b> на аккаунт <b>${escapeHtml(displayName(to))}</b>.`),
  );
  await db.batch(stmts);
  return { ok: true, events: fromMembers.length };
}

// ---------- роли: владелец и администраторы (002) ----------

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
        `⚠️ Права владельца бота перешли к <b>${label}</b> по ссылке со страницы настройки. Ты остаёшься администратором.\n\n` +
        'Если это не ты и не по договорённости — открой страницу настройки и перейди по ссылке владельца снова, а потом смени ADMIN_SECRET.'
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

export async function grantAdmin(env, id) {
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
      '🛠 <b>Владелец назначил тебя администратором.</b>\n\nТеперь ты можешь создавать эвенты и вести их: приглашения, исключения, жеребьёвка, напоминания. Кто кому дарит, админы не видят.',
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
    enqueueStmt(db, id, msg('Владелец снял с тебя права администратора. Как участник эвентов ты продолжаешь играть как обычно.')),
    ...otherAdminsNotice(db, users, [id, ownerId], `ℹ️ <b>${escapeHtml(displayName(u))}</b> больше не администратор.`),
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

export { setSettings, updateUserStmt, addMemberStmt };

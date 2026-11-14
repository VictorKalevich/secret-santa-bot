// Анонимная переписка Санты и подопечного (003, по эвентам).

import { getSettings, pairOfSanta, pairOfWard, enqueueIfStmt } from './db.js';
import { msg, q, escapeHtml, shortTitle, appUrl, cleanText } from './format.js';
import { chatWritable } from './status.js';

// Лимит письма и сообщения переписки: одно сообщение Telegram вмещает 4096 символов (UTF-16, как String.length),
// 96 оставляем под заголовок уведомления (003, FR-309).
export const MAX_CHARS = 4000;

export async function chatPair(db, eventId, userId, withWhom) {
  if (withWhom === 'ward') {
    const p = await pairOfSanta(db, eventId, userId);
    return p ? { santa: userId, ward: p.ward, me: 'santa', other: p.ward } : null;
  }
  const p = await pairOfWard(db, eventId, userId);
  return p ? { santa: p.santa, ward: userId, me: 'ward', other: p.santa } : null;
}

function chatButtons(settings, ev, recipientSide) {
  // recipientSide — кто получает: подопечный отвечает Санте, Санта — подопечному
  const replyTo = recipientSide === 'ward' ? 'santa' : 'ward';
  return {
    inline_keyboard: [[
      { text: '↩️ Ответить', callback_data: `msg:${replyTo}:${ev.id}` },
      { text: '💬 Вся переписка', web_app: { url: appUrl(settings, { event: ev.id, chat: replyTo }) } },
    ]],
  };
}

const PAIR_CHANGED = '🔄 Пара изменилась после нажатия «Ответить» — сообщение не отправлено. Нажми «↩️ Ответить» ещё раз.';

// Сохранить сообщение в переписке и поставить уведомление получателю в очередь.
// expectOther — собеседник, которому человек собирался ответить (режим ответа в чате бота, 009): если пара с тех пор
// сменилась, сообщение не уходит новому собеседнику.
export async function sendChatMessage(env, ev, fromId, to, rawText, { expectOther = 0 } = {}) {
  const db = env.DB;
  const text = cleanText(rawText);
  if (!text) return { ok: false, error: 'Пустое сообщение.' };
  if (text.length > MAX_CHARS) {
    return { ok: false, error: `Слишком длинно: ${text.length} символов, максимум ${MAX_CHARS} (лимит сообщения Telegram).` };
  }
  if (!chatWritable(ev)) return { ok: false, error: 'Событие завершено больше недели назад: переписка доступна только для чтения.' };
  const pair = await chatPair(db, ev.id, fromId, to);
  if (!pair) return { ok: false, error: to === 'ward' ? 'У тебя пока нет подопечного.' : 'Жеребьёвка для тебя ещё не проведена.' };
  if (expectOther && pair.other !== expectOther) return { ok: false, error: PAIR_CHANGED, pairChanged: true };
  const settings = await getSettings(db);
  const now = Date.now();
  // Заголовок + текст до MAX_CHARS всегда помещаются в одно сообщение Telegram: название эвента сокращаем
  const t = q({ title: shortTitle(ev.title) });
  const header = pair.me === 'santa'
    ? `💬 <b>Твой Тайный Санта (${t}) пишет:</b>`
    : `💬 <b>Тебе пишет твой подопечный (${t}):</b>`;
  // Пара могла смениться (удаление или вписывание участника) между проверкой и записью: тогда ничего не пишем
  const pairAlive = 'EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND santa = ? AND ward = ?)';
  const alive = [ev.id, pair.santa, pair.ward];
  const [inserted] = await db.batch([
    db.prepare(`INSERT INTO messages (event_id, santa, ward, sender, text, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${pairAlive} RETURNING id, created_at`)
      .bind(ev.id, pair.santa, pair.ward, pair.me, text, now, ...alive),
    // Отвечая, человек видел сообщения собеседника — помечаем их прочитанными
    db.prepare('UPDATE messages SET read_at = ? WHERE event_id = ? AND santa = ? AND ward = ? AND sender != ? AND read_at = 0')
      .bind(now, ev.id, pair.santa, pair.ward, pair.me),
    enqueueIfStmt(db, pair.other, msg(header + '\n\n' + escapeHtml(text), {
      reply_markup: chatButtons(settings, ev, pair.me === 'santa' ? 'ward' : 'santa'),
    }), pairAlive, ...alive),
  ]);
  const row = inserted.results[0];
  if (!row) return { ok: false, error: expectOther ? PAIR_CHANGED : 'Пара изменилась — обнови экран.', pairChanged: true };
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

// chat.get: история переписки с подопечным или Сантой; сообщения собеседника помечаются прочитанными.
// Только текст и «моё/не моё» — без ID и имён собеседника (Конституция, принцип I).
export async function chatHistory(ctx, ev, withWhom, after) {
  const db = ctx.db;
  const pair = await chatPair(db, ev.id, ctx.me.tg_id, withWhom);
  if (!pair) return { state: 'no_pair' };
  const sql = after
    ? db.prepare('SELECT id, sender, text, created_at FROM messages WHERE event_id = ? AND santa = ? AND ward = ? AND id > ? ORDER BY id LIMIT 300')
        .bind(ev.id, pair.santa, pair.ward, after)
    : db.prepare('SELECT id, sender, text, created_at FROM messages WHERE event_id = ? AND santa = ? AND ward = ? ORDER BY id DESC LIMIT 300')
        .bind(ev.id, pair.santa, pair.ward);
  const { results } = await sql.all();
  if (!after) results.reverse();
  if (results.some((m) => m.sender !== pair.me)) {
    await db.prepare('UPDATE messages SET read_at = ? WHERE event_id = ? AND santa = ? AND ward = ? AND sender != ? AND read_at = 0')
      .bind(Date.now(), ev.id, pair.santa, pair.ward, pair.me).run();
  }
  return {
    state: 'ok',
    counterpart: withWhom,
    writable: chatWritable(ev),
    messages: results.map((m) => ({ id: m.id, mine: m.sender === pair.me, text: m.text, created_at: m.created_at })),
  };
}

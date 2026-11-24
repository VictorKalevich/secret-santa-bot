// Анонимная переписка Санты и подопечного (003, по эвентам).

import { pairOfSanta, pairOfWard, enqueueIfStmt } from './db.js';
import { msg, q, escapeHtml, shortTitle, appUrl, cleanText, CHAT_READ_ONLY } from './format.js';
import { tx } from './i18n/index.js';
import { chatWritable } from './status.js';
import { no } from './result.js';
import { maskLabel } from './looks.js';

// Лимит письма и сообщения переписки: одно сообщение Telegram вмещает 4096 символов (UTF-16, как String.length),
// 96 оставляем под заголовок уведомления (003, FR-309).
export const MAX_CHARS = 4000;
// Отказ «слишком длинно» для письма, переписки и обращений (019: один текст)
export const tooLong = (n) => tx('chat.tooLong', { n, max: MAX_CHARS });

// mask — маска пары (040): Санте — своя, подопечному — его Санты
export async function chatPair(db, eventId, userId, withWhom) {
  if (withWhom === 'ward') {
    const p = await pairOfSanta(db, eventId, userId);
    return p ? { santa: userId, ward: p.ward, me: 'santa', other: p.ward, mask: p.mask } : null;
  }
  const p = await pairOfWard(db, eventId, userId);
  return p ? { santa: p.santa, ward: userId, me: 'ward', other: p.santa, mask: p.mask } : null;
}

// «Твой Тайный Санта «🐉 Дракон»» — так подопечный видит Санту в сообщениях бота (040); без маски — как раньше
export const santaTitle = (mask) => {
  const label = maskLabel(mask);
  return label ? tx('chat.santaTitleMask', { mask: label }) : tx('chat.santaTitle');
};

function chatButtons(settings, ev, recipientSide) {
  // recipientSide — кто получает: подопечный отвечает Санте, Санта — подопечному
  const replyTo = recipientSide === 'ward' ? 'santa' : 'ward';
  return {
    inline_keyboard: [[
      { text: tx('chat.replyButton'), callback_data: `msg:${replyTo}:${ev.id}` },
      { text: tx('chat.historyButton'), web_app: { url: appUrl(settings, { event: ev.id, chat: replyTo }) } },
    ]],
  };
}

const PAIR_CHANGED = tx('chat.pairChangedReply');

// Сохранить сообщение в переписке и поставить уведомление получателю в очередь.
// expectOther — собеседник, которому человек собирался ответить (режим ответа в чате бота, 009): если пара с тех пор
// сменилась, сообщение не уходит новому собеседнику.
export async function sendChatMessage(ctx, ev, fromId, to, rawText, { expectOther = 0 } = {}) {
  const db = ctx.db;
  const text = cleanText(rawText);
  if (!text) return no(tx('chat.empty'));
  if (text.length > MAX_CHARS) {
    return no(tooLong(text.length));
  }
  if (!chatWritable(ev)) return no(CHAT_READ_ONLY);
  const pair = await chatPair(db, ev.id, fromId, to);
  if (!pair) return no(tx(to === 'ward' ? 'chat.noWard' : 'chat.noSanta'));
  if (expectOther && pair.other !== expectOther) return { ...no(PAIR_CHANGED), pairChanged: true };
  const settings = await ctx.settings();
  const now = Date.now();
  // Заголовок + текст до MAX_CHARS всегда помещаются в одно сообщение Telegram: название эвента сокращаем (и с самой
  // длинной маской, 040, — тест mask)
  const title = q({ title: shortTitle(ev.title) });
  const notice = pair.me === 'santa'
    ? tx('chat.fromSanta', { santa: santaTitle(pair.mask), title, text: escapeHtml(text) })
    : tx('chat.fromWard', { title, text: escapeHtml(text) });
  // Пара могла смениться (удаление или вписывание участника) между проверкой и записью: тогда ничего не пишем
  const pairAlive = 'EXISTS (SELECT 1 FROM pairs WHERE event_id = ? AND santa = ? AND ward = ?)';
  const alive = [ev.id, pair.santa, pair.ward];
  const [inserted] = await db.batch([
    db.prepare(`INSERT INTO messages (event_id, santa, ward, sender, text, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${pairAlive} RETURNING id, created_at`)
      .bind(ev.id, pair.santa, pair.ward, pair.me, text, now, ...alive),
    // Отвечая, человек видел сообщения собеседника — помечаем их прочитанными
    db.prepare('UPDATE messages SET read_at = ? WHERE event_id = ? AND santa = ? AND ward = ? AND sender != ? AND read_at = 0')
      .bind(now, ev.id, pair.santa, pair.ward, pair.me),
    enqueueIfStmt(db, pair.other, msg(notice, {
      reply_markup: chatButtons(settings, ev, pair.me === 'santa' ? 'ward' : 'santa'),
    }), pairAlive, ...alive),
  ]);
  const row = inserted.results[0];
  if (!row) return { ...no(expectOther ? PAIR_CHANGED : tx('chat.pairChanged')), pairChanged: true };
  return { ok: true, message: { id: row.id, mine: true, text, created_at: row.created_at } };
}

const UNREAD_SQL = `
  SELECT m.event_id,
         SUM(CASE WHEN m.santa = ?1 AND m.sender = 'ward' THEN 1 ELSE 0 END) AS from_ward,
         SUM(CASE WHEN m.ward = ?1 AND m.sender = 'santa' THEN 1 ELSE 0 END) AS from_santa
    FROM messages m JOIN pairs p ON p.event_id = m.event_id AND p.santa = m.santa AND p.ward = m.ward
   WHERE m.read_at = 0 AND (m.santa = ?1 OR m.ward = ?1)`;

// Непрочитанное в одном эвенте (от подопечного и от Санты) — для пакета чтений и его разбор
export const unreadQuery = (db, eventId, userId) => db.prepare(UNREAD_SQL + ' AND m.event_id = ?2 GROUP BY m.event_id').bind(userId, eventId);
export const unreadFrom = (rows) => ({ from_ward: rows[0]?.from_ward || 0, from_santa: rows[0]?.from_santa || 0 });

// Непрочитанное по эвентам — для «me»
export const unreadByEventQuery = (db, userId) => db.prepare(UNREAD_SQL + ' GROUP BY m.event_id').bind(userId);
export const unreadByEventFrom = (rows) => Object.fromEntries(rows.map((r) => [r.event_id, (r.from_ward || 0) + (r.from_santa || 0)]));

// chat.get: история переписки с подопечным или Сантой; сообщения собеседника помечаются прочитанными.
// Только текст и «моё/не моё» — без ID и имён собеседника (Конституция, принцип I); маска пары (040).
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
    mask: pair.mask,
    writable: chatWritable(ev),
    messages: results.map((m) => ({ id: m.id, mine: m.sender === pair.me, text: m.text, created_at: m.created_at })),
  };
}

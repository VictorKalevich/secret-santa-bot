// Очередь сообщений: всё, что бот пишет другим людям, сначала ставится в outbox, а отправляется здесь.

import { tgApi } from './telegram.js';
import { budgetLeft } from './budget.js';

// Отправка очереди (006): пачку сообщений «захватываем» на минуту (locked_until), отправляем, затем удаляем
// отправленные и освобождаем неотправленные. Если вызов оборвётся, захват истечёт и сообщения уйдут позже — без потерь
// (редкий дубль допустим). Порядок сохраняется: id не меняются, а сообщение человеку не берётся, пока более старое
// сообщение ему же захвачено другим вызовом или не ушло в этой пачке.
// На бесплатном тарифе Cloudflare не больше 50 внешних запросов за вызов: круг берёт не больше сообщений, чем
// осталось в бюджете вызова за вычетом двух запросов к базе (захват и итоговый batch). Остальное уйдёт в cron.
const OUTBOX_LOCK_MS = 60 * 1000;
const OUTBOX_TTL_MS = 2 * 24 * 3600 * 1000;
const ROUND_OVERHEAD = 2;

export async function flushOutbox(env, limit = 25) {
  // Несколько кругов: пока этот вызов отправлял, другой мог поставить в очередь сообщения тем же людям и пропустить их
  // (их более старые сообщения были захвачены здесь). Забираем их сразу, а не через минуту, — если круг прошёл без сбоев.
  let total = 0;
  for (let round = 0; round < 3 && total < limit; round++) {
    const room = Math.min(limit - total, budgetLeft(env) - ROUND_OVERHEAD);
    if (room <= 0) break;
    const r = await flushRound(env, room);
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

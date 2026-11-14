// Правила пар (019): исключения «кто кому не дарит», закреплённые пары владельца (014), семьи как исключения (008).
// Снимки этих правил для условия записи жеребьёвки — src/snapshots.js (020); жеребьёвка и замены — src/pairs.js.

import { getEvent, memberQuery, drawMembersQuery, fixedPairsQuery } from './db.js';
import { displayName } from './format.js';
import { atomic } from './claim.js';

const EXCLUSIONS_FROZEN =
  'После жеребьёвки исключения не меняются: иначе по заменам участников можно было бы вычислить пары. ' +
  'Чтобы поменять исключения, отмени жеребьёвку (пока никто не открыл подопечного).';
const FIXED_FROZEN = 'После жеребьёвки закреплённые пары не меняются. Чтобы поменять их, отмени жеребьёвку.'; // 014
const RING_ONE_WAY = 'При кольцевой жеребьёвке пару можно закрепить только в одну сторону';

const no = (error) => ({ ok: false, error });

// ---------- исключения ----------

// Добавить или убрать исключение (mutual — в обе стороны). После жеребьёвки исключения заморожены: по заменам при
// удалении/вписывании их можно было бы использовать, чтобы вычислить пары (009, FR-901). Условие повторено в SQL — на
// случай жеребьёвки в эту же секунду. Владелец пары видит и так — для него заморозки нет (010, FR-1008).
export async function changeExclusions(ctx, ev, { add, giver: rawGiver, receiver: rawReceiver, mutual }) {
  const { db, me } = ctx;
  const isOwner = await ctx.isOwner();
  if (ev.draw_done && !isOwner) return no(EXCLUSIONS_FROZEN);
  const giver = Number(rawGiver);
  const receiver = Number(rawReceiver);
  if (add) {
    if (!giver || !receiver || giver === receiver) return no('Выбери двух разных людей');
    const r = await ctx.read({ g: memberQuery(db, ev.id, giver), r: memberQuery(db, ev.id, receiver) });
    if (!r.g.length || !r.r.length) return no('Исключение можно задать только между участниками события.');
  }
  const beforeDraw = atomic(db, isOwner ? '? > 0' : 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)', ev.id);
  const links = mutual ? [[giver, receiver], [receiver, giver]] : [[giver, receiver]];
  // Имена для журнала — из уже прочитанного списка пользователей (019)
  const users = await ctx.users();
  const nameOf = (id) => displayName(users.find((u) => u.tg_id === id));
  const names = `${nameOf(giver)} ${mutual ? '↔' : '→'} ${nameOf(receiver)}`;
  // Журнал — по прежнему состоянию, перед изменением (020): пока хотя бы одной добавляемой строки нет (удаляемая —
  // есть). Второй из двух одновременных вызовов видит изменение первого и записи не пишет.
  const row = 'EXISTS (SELECT 1 FROM exclusions WHERE event_id = ? AND giver = ? AND receiver = ?)';
  beforeDraw
    .and(links.map(() => (add ? `NOT ${row}` : row)).join(' OR '), ...links.flatMap(([a, b]) => [ev.id, a, b]))
    .audit(ev.id, me.tg_id, add ? 'exclusion.add' : 'exclusion.del', names);
  for (const [a, b] of links) {
    if (add) beforeDraw.select('INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) SELECT ?, ?, ?', ev.id, a, b);
    else beforeDraw.where('DELETE FROM exclusions WHERE event_id = ? AND giver = ? AND receiver = ?', ev.id, a, b);
  }
  await beforeDraw.run();
  // Повторное чтение события — намеренно: жеребьёвка могла пройти в ту же секунду
  if (!isOwner && (await getEvent(db, ev.id))?.draw_done) return no(EXCLUSIONS_FROZEN);
  return { ok: true };
}

// ---------- закреплённые пары (014) ----------

// Будущие пары жеребьёвки; видит и меняет только владелец (админ узнал бы пары — проверка в api.js). Только до
// жеребьёвки — и для владельца: пары действуют лишь при её проведении (research R5).
export async function changeFixed(ctx, ev, { add, giver: rawGiver, receiver: rawReceiver, mutual }) {
  const { db, me } = ctx;
  if (ev.draw_done) return no(FIXED_FROZEN);
  const giver = Number(rawGiver);
  const receiver = Number(rawReceiver);
  const links = mutual ? [[giver, receiver], [receiver, giver]] : [[giver, receiver]];
  if (add) {
    if (!giver || !receiver || giver === receiver) return no('Выбери двух разных людей');
    const { members, fixed } = await ctx.read({ members: drawMembersQuery(db, ev.id), fixed: fixedPairsQuery(db, ev.id) });
    const byId = new Map(members.filter((m) => m.registered).map((m) => [m.user_id, m]));
    if (!byId.has(giver) || !byId.has(receiver)) return no('Закрепить пару можно только между участниками события.');
    const name = (id) => displayName(byId.get(id));
    // Кольцевая — без взаимных пар: закрепить можно только в одну сторону
    if (ev.ring) {
      if (mutual) return no(RING_ONE_WAY + '.');
      if (fixed.some((f) => f.giver === receiver && f.receiver === giver)) {
        return no(`${RING_ONE_WAY}: «${name(receiver)}» уже дарит «${name(giver)}».`);
      }
    }
    for (const [a, b] of links) {
      if (fixed.some((f) => f.giver === a && f.receiver === b)) continue; // уже закреплена
      if (fixed.some((f) => f.giver === a)) return no(`У «${name(a)}» уже есть закреплённый подопечный — сначала убери ту пару.`);
      if (fixed.some((f) => f.receiver === b)) return no(`Санта для «${name(b)}» уже закреплён — сначала убери ту пару.`);
    }
  }
  // Условие повторено в SQL — на случай жеребьёвки в эту же секунду (как у исключений)
  const beforeDraw = atomic(db, 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)', ev.id);
  // Журнал — по прежнему состоянию, перед изменением (023): пока хотя бы одна сторона действительно изменится.
  // Закрепление вставляется, если у Санты нет закреплённого подопечного и у подопечного — Санты (первичный ключ и
  // уникальный индекс fixed_pairs); стороны взаимной пары друг другу не мешают. Второй из двух одновременных вызовов
  // видит изменение первого и записи не пишет. Без имён и подробностей: журнал видят и админы.
  const change = add
    ? '(NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ?) AND NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND receiver = ?))'
    : 'EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?)';
  beforeDraw
    .and(links.map(() => change).join(' OR '), ...links.flatMap(([a, b]) => (add ? [ev.id, a, ev.id, b] : [ev.id, a, b])))
    .audit(ev.id, me.tg_id, add ? 'fixed.add' : 'fixed.del', '');
  for (const [a, b] of links) {
    if (add) beforeDraw.select('INSERT OR IGNORE INTO fixed_pairs (event_id, giver, receiver) SELECT ?, ?, ?', ev.id, a, b);
    else beforeDraw.where('DELETE FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?', ev.id, a, b);
  }
  await beforeDraw.run();
  if ((await getEvent(db, ev.id))?.draw_done) return no(FIXED_FROZEN);
  return { ok: true };
}

// ---------- семьи как исключения (008) ----------

// Пары «не дарят друг другу» между членами одной семьи среди ids — если в эвенте включено правило семей.
// rows — строки «человек — семья» (familyRowsQuery), прочитанные вызывающим в его пакете чтений (019).
export function familyExclusions(ev, ids, rows) {
  if (!ev.families_on || ids.length < 2) return [];
  const set = new Set(ids);
  const byFamily = new Map();
  for (const r of rows) {
    if (!set.has(r.user_id)) continue;
    if (!byFamily.has(r.family_id)) byFamily.set(r.family_id, []);
    byFamily.get(r.family_id).push(r.user_id);
  }
  const out = [];
  for (const list of byFamily.values()) {
    for (const a of list) for (const b of list) if (a !== b) out.push({ giver: a, receiver: b });
  }
  return out;
}

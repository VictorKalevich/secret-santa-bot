// Правила пар (019): исключения «кто кому не дарит», закреплённые пары владельца (014), семьи как исключения (008) и
// снимки этих правил для условия записи жеребьёвки (009/010/014). Жеребьёвка и замены — src/pairs.js.

import { getMember, getEvent, getFixedPairs, eventMembers, familyRows, auditIfStmt } from './db.js';
import { displayName } from './format.js';

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
    const [g, r] = await Promise.all([getMember(db, ev.id, giver), getMember(db, ev.id, receiver)]);
    if (!g || !r) return no('Исключение можно задать только между участниками события.');
  }
  const beforeDraw = isOwner ? '? > 0' : 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)';
  const change = (a, b) => add
    ? db.prepare(`INSERT OR IGNORE INTO exclusions (event_id, giver, receiver) SELECT ?, ?, ? WHERE ${beforeDraw}`).bind(ev.id, a, b, ev.id)
    : db.prepare(`DELETE FROM exclusions WHERE event_id = ? AND giver = ? AND receiver = ? AND ${beforeDraw}`).bind(ev.id, a, b, ev.id);
  const stmts = [change(giver, receiver)];
  if (mutual) stmts.push(change(receiver, giver));
  // Имена для журнала — из уже прочитанного списка пользователей (019)
  const users = await ctx.users();
  const nameOf = (id) => displayName(users.find((u) => u.tg_id === id));
  const names = `${nameOf(giver)} ${mutual ? '↔' : '→'} ${nameOf(receiver)}`;
  stmts.push(auditIfStmt(db, ev.id, me.tg_id, add ? 'exclusion.add' : 'exclusion.del', names, beforeDraw, ev.id));
  await db.batch(stmts);
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
    const [members, fixed] = await Promise.all([eventMembers(db, ev.id), getFixedPairs(db, ev.id)]);
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
  const beforeDraw = 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)';
  const stmts = links.map(([a, b]) => add
    ? db.prepare(`INSERT OR IGNORE INTO fixed_pairs (event_id, giver, receiver) SELECT ?, ?, ? WHERE ${beforeDraw}`).bind(ev.id, a, b, ev.id)
    : db.prepare(`DELETE FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ? AND ${beforeDraw}`).bind(ev.id, a, b, ev.id));
  // Журнал — без имён и подробностей: его видят и админы
  stmts.push(auditIfStmt(db, ev.id, me.tg_id, add ? 'fixed.add' : 'fixed.del', '', beforeDraw, ev.id));
  await db.batch(stmts);
  if ((await getEvent(db, ev.id))?.draw_done) return no(FIXED_FROZEN);
  return { ok: true };
}

// ---------- семьи как исключения (008) и снимки правил ----------

// Пары «не дарят друг другу» между членами одной семьи среди ids — если в эвенте включено правило семей.
// rows — уже прочитанные строки familyRows (необязательно).
export async function familyExclusions(db, ev, ids, rows = null) {
  if (!ev.families_on || ids.length < 2) return [];
  const set = new Set(ids);
  const byFamily = new Map();
  for (const r of rows || (await familyRows(db))) {
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

// Снимок семей участников (010, FR-1019): «число:Σ(человек×семья):Σ(семья)» по строкам семей людей ids.
// То же выражение считает SQL в условии записи жеребьёвки (FAMILY_SNAPSHOT_SQL) — пары пишутся, только если семьи те же.
export function familySnapshot(rows, ids) {
  const set = new Set(ids);
  let count = 0;
  let mixed = 0;
  let fams = 0;
  for (const r of rows) {
    if (!set.has(r.user_id)) continue;
    count += 1;
    mixed += r.user_id * r.family_id;
    fams += r.family_id;
  }
  return `${count}:${mixed}:${fams}`;
}

// Параметр — id эвента; учитываются зарегистрированные участники (как в жеребьёвке)
export const FAMILY_SNAPSHOT_SQL = `(SELECT COUNT(*) || ':' || COALESCE(SUM(fm.user_id * fm.family_id), 0) || ':' || COALESCE(SUM(fm.family_id), 0)
   FROM family_members fm
  WHERE fm.user_id IN (SELECT m.user_id FROM members m JOIN users u ON u.tg_id = m.user_id WHERE m.event_id = ? AND u.registered = 1))`;

// Снимок закреплённых пар (014, research R6): в отличие от сумм различает перестановку партнёров ({А→Б, В→Г} и
// {А→Г, В→Б}). Числа меньше 2^53 — одинаково точны в JS и в целых SQLite. Параметр SQL — id эвента.
const FIXED_MOD = 1000003;
export function fixedSnapshot(rows) {
  let g = 0;
  let r = 0;
  let mixed = 0;
  for (const p of rows) {
    g += p.giver;
    r += p.receiver;
    mixed += (p.giver % FIXED_MOD) * (p.receiver % FIXED_MOD);
  }
  return `${rows.length}:${g}:${r}:${mixed}`;
}
export const FIXED_SNAPSHOT_SQL = `(SELECT COUNT(*) || ':' || COALESCE(SUM(giver), 0) || ':' || COALESCE(SUM(receiver), 0) || ':' ||
     COALESCE(SUM((giver % ${FIXED_MOD}) * (receiver % ${FIXED_MOD})), 0) FROM fixed_pairs WHERE event_id = ?)`;

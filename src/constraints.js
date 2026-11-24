// Правила пар (019): исключения «кто кому не дарит», закреплённые пары владельца (014), семьи как исключения (008).
// Снимки этих правил для условия записи жеребьёвки — src/snapshots.js (020); жеребьёвка и замены — src/pairs.js.

import { getEvent, memberQuery, drawMembersQuery, fixedPairsQuery } from './db.js';
import { displayName } from './format.js';
import { tx, tjoin } from './i18n/index.js';
import { atomic } from './claim.js';
import { no } from './result.js';

const EXCLUSIONS_FROZEN = tx('constraints.exclusionsFrozen');
const FIXED_FROZEN = tx('constraints.fixedFrozen'); // 014
const FIXED_CHANGED = tx('constraints.fixedChanged'); // 031
const TWO_PEOPLE = tx('constraints.twoPeople');
// Сторона «Санта → подопечный» закрепления возможна (031): она уже есть или Санта и подопечный свободны (параметры: событие,
// Санта, подопечный; событие, Санта; событие, подопечный). При кольцевой — ещё без встречной (событие, подопечный, Санта).
const LINK_FREE = `(EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?)
  OR (NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ?) AND NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND receiver = ?)))`;
const NO_REVERSE = 'NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?)';

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
    if (!giver || !receiver || giver === receiver) return no(TWO_PEOPLE);
    const r = await ctx.read({ g: memberQuery(db, ev.id, giver), r: memberQuery(db, ev.id, receiver) });
    if (!r.g.length || !r.r.length) return no(tx('constraints.exclusionMembers'));
  }
  const beforeDraw = atomic(db, isOwner ? '? > 0' : 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)', ev.id);
  const links = mutual ? [[giver, receiver], [receiver, giver]] : [[giver, receiver]];
  // Имена для журнала — из уже прочитанного списка пользователей (019)
  const users = await ctx.users();
  const nameOf = (id) => displayName(users.find((u) => u.tg_id === id));
  const names = tjoin(' ', [nameOf(giver), mutual ? '↔' : '→', nameOf(receiver)]);
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

// Отказ закрепления сторон links при закреплённых парах fixed или null (014). Одно правило для проверки перед записью и
// для вызова, который проиграл спор одновременных закреплений (031): тексты одинаковые.
export function fixedRefusal(ev, fixed, links, name) {
  // Кольцевая — без взаимных пар (взаимную при кольцевой вызывающий отклоняет раньше: сторона одна)
  const [[giver, receiver]] = links;
  if (ev.ring && fixed.some((f) => f.giver === receiver && f.receiver === giver)) {
    return no(tx('constraints.ringReverse', { santa: name(receiver), ward: name(giver) }));
  }
  for (const [a, b] of links) {
    if (fixed.some((f) => f.giver === a && f.receiver === b)) continue; // уже закреплена
    if (fixed.some((f) => f.giver === a)) return no(tx('constraints.santaTaken', { name: name(a) }));
    if (fixed.some((f) => f.receiver === b)) return no(tx('constraints.wardTaken', { name: name(b) }));
  }
  return null;
}

// Будущие пары жеребьёвки; видит и меняет только владелец (админ узнал бы пары — проверка в api.js). Только до
// жеребьёвки — и для владельца: пары действуют лишь при её проведении (research R5).
export async function changeFixed(ctx, ev, { add, giver: rawGiver, receiver: rawReceiver, mutual }) {
  const { db, me } = ctx;
  if (ev.draw_done) return no(FIXED_FROZEN);
  const giver = Number(rawGiver);
  const receiver = Number(rawReceiver);
  const links = mutual ? [[giver, receiver], [receiver, giver]] : [[giver, receiver]];
  let name;
  if (add) {
    if (!giver || !receiver || giver === receiver) return no(TWO_PEOPLE);
    const { members, fixed } = await ctx.read({ members: drawMembersQuery(db, ev.id), fixed: fixedPairsQuery(db, ev.id) });
    const byId = new Map(members.filter((m) => m.registered).map((m) => [m.user_id, m]));
    if (!byId.has(giver) || !byId.has(receiver)) return no(tx('constraints.fixedMembers'));
    name = (id) => displayName(byId.get(id));
    if (ev.ring && mutual) return no(tx('constraints.ringOneWay'));
    const refusal = fixedRefusal(ev, fixed, links, name);
    if (refusal) return refusal;
  }
  // Условие повторено в SQL — на случай жеребьёвки в эту же секунду (как у исключений)
  const beforeDraw = atomic(db, 'NOT EXISTS (SELECT 1 FROM events WHERE id = ? AND draw_done = 1)', ev.id);
  // Добавление (031) — только если закрепление возможно и в момент записи: проверки выше шли по чтению до неё, и два
  // одновременных спорящих вызова прошли бы их оба. Стороны — через AND: взаимная пара целиком или никак; после своих
  // вставок условие остаётся истинным (сторона уже есть), повтор того же закрепления его тоже проходит.
  let target = beforeDraw;
  if (add) {
    const side = ev.ring ? `${LINK_FREE} AND ${NO_REVERSE}` : LINK_FREE;
    target = beforeDraw.and(
      links.map(() => side).join(' AND '),
      ...links.flatMap(([a, b]) => [ev.id, a, b, ev.id, a, ev.id, b, ...(ev.ring ? [ev.id, b, a] : [])])
    );
    // Исход — по прежнему состоянию, первым оператором пакета: строка есть — закрепление сохраняется
    target.claim(db.prepare(`SELECT 1 AS ok WHERE ${target.sql}`).bind(...target.args));
  }
  // Журнал — по прежнему состоянию, перед изменением (023): пока хотя бы одна сторона действительно изменится.
  // Закрепление вставляется, если у Санты нет закреплённого подопечного и у подопечного — Санты (первичный ключ и
  // уникальный индекс fixed_pairs); стороны взаимной пары друг другу не мешают. Второй из двух одновременных вызовов
  // видит изменение первого и записи не пишет. Без имён и подробностей: журнал видят и админы.
  const change = add
    ? '(NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ?) AND NOT EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND receiver = ?))'
    : 'EXISTS (SELECT 1 FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?)';
  target
    .and(links.map(() => change).join(' OR '), ...links.flatMap(([a, b]) => (add ? [ev.id, a, ev.id, b] : [ev.id, a, b])))
    .audit(ev.id, me.tg_id, add ? 'fixed.add' : 'fixed.del', '');
  for (const [a, b] of links) {
    if (add) target.select('INSERT OR IGNORE INTO fixed_pairs (event_id, giver, receiver) SELECT ?, ?, ?', ev.id, a, b);
    else target.where('DELETE FROM fixed_pairs WHERE event_id = ? AND giver = ? AND receiver = ?', ev.id, a, b);
  }
  // Пары после записи — для текста отказа проигравшему: та же транзакция, отдельного запроса нет
  if (add) target.add(fixedPairsQuery(db, ev.id));
  const { claim, results } = await target.run();
  if ((await getEvent(db, ev.id))?.draw_done) return no(FIXED_FROZEN);
  if (add && !claim.results.length) return fixedRefusal(ev, results.at(-1).results, links, name) || no(FIXED_CHANGED);
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

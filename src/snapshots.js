// Снимки жеребьёвки (020): по чему считались пары — участники, исключения, семьи (010) и закреплённые пары (014).
// Жеребьёвка записывается, только если снимок в базе в момент записи тот же, что при расчёте (009, FR-922): условие
// захвата в runDraw (src/pairs.js). У каждого снимка рядом формула в коде (js — по строкам, уже прочитанным checkDraw,
// без запросов) и то же выражение в запросе (sql, один параметр — id события); паритет — tests/snapshots.test.mjs.
// Меняется одна — меняется и другая.
//
// Числа меньше 2^53 по построению: JS считает в double, SQLite — в целых. Идентификатор Telegram — меньше 2^52, поэтому
// суммы берутся по модулю 2^52 (в JS — на каждом шаге: накопленное < 2^52, слагаемое < 2^52), а произведения — из
// сомножителей по модулю M (слагаемое < 2^40). SUM в SQLite точна, пока сумма меньше 2^63.

const M = 1000003;
const Q = 2 ** 52;
const add = (acc, x) => (acc + x) % Q;
const SUM = (x) => `(COALESCE(SUM(${x}), 0) % ${Q})`;
const PRODUCT = (a, b) => `(${a} % ${M}) * (${b} % ${M})`;

// Зарегистрированные участники события — как в жеребьёвке
const PARTICIPANTS = 'SELECT m.user_id FROM members m JOIN users u ON u.tg_id = m.user_id WHERE m.event_id = ? AND u.registered = 1';

// Связи «кто → кому» (исключения, закреплённые пары): число, суммы дарящих и получателей и сумма произведений — она
// различает перестановку партнёров ({А→Б, В→Г} и {А→Г, В→Б} дают одни и те же суммы)
function links(table) {
  return {
    js(rows) {
      let g = 0;
      let r = 0;
      let mixed = 0;
      for (const p of rows) {
        g = add(g, p.giver);
        r = add(r, p.receiver);
        mixed = add(mixed, (p.giver % M) * (p.receiver % M));
      }
      return `${rows.length}:${g}:${r}:${mixed}`;
    },
    sql: `(SELECT COUNT(*) || ':' || ${SUM('giver')} || ':' || ${SUM('receiver')} || ':' || ${SUM(PRODUCT('giver', 'receiver'))}
             FROM ${table} WHERE event_id = ?)`,
  };
}

const exclusions = links('exclusions');
const fixed = links('fixed_pairs');

// data = { ids — зарегистрированные участники, exclusions — все исключения события, families — все строки «человек —
// семья», fixed — закреплённые пары события }
export const SNAPSHOTS = {
  members: {
    js({ ids }) {
      let s = 0;
      for (const id of ids) s = add(s, id);
      return `${ids.length}:${s}`;
    },
    sql: `(SELECT COUNT(*) || ':' || ${SUM('m.user_id')} FROM members m JOIN users u ON u.tg_id = m.user_id
            WHERE m.event_id = ? AND u.registered = 1)`,
  },
  exclusions: { js: (data) => exclusions.js(data.exclusions), sql: exclusions.sql },
  // Строки семей участников: число, Σ(человек × семья), Σ семья — смена семьи меняет снимок
  families: {
    js({ ids, families }) {
      const set = new Set(ids);
      let count = 0;
      let mixed = 0;
      let fams = 0;
      for (const r of families) {
        if (!set.has(r.user_id)) continue;
        count += 1;
        mixed = add(mixed, (r.user_id % M) * (r.family_id % M));
        fams = add(fams, r.family_id);
      }
      return `${count}:${mixed}:${fams}`;
    },
    sql: `(SELECT COUNT(*) || ':' || ${SUM(PRODUCT('fm.user_id', 'fm.family_id'))} || ':' || ${SUM('fm.family_id')}
             FROM family_members fm WHERE fm.user_id IN (${PARTICIPANTS}))`,
  },
  fixed: { js: (data) => fixed.js(data.fixed), sql: fixed.sql },
};

// Снимок для записи жеребьёвки; семьи сравниваются, только если правило семей включено (010)
export function drawSnapshot(ev, data) {
  return {
    members: SNAPSHOTS.members.js(data),
    exclusions: SNAPSHOTS.exclusions.js(data),
    families: ev.families_on ? SNAPSHOTS.families.js(data) : '',
    fixed: SNAPSHOTS.fixed.js(data),
  };
}

// Условие «снимок в базе тот же» для захвата жеребьёвки: { sql, args }
export function snapshotGuard(eventId, snap) {
  const { members, exclusions: ex, families, fixed: fx } = SNAPSHOTS;
  return {
    sql: `${members.sql} = ? AND ${ex.sql} = ? AND (? = '' OR ${families.sql} = ?) AND ${fx.sql} = ?`,
    args: [eventId, snap.members, eventId, snap.exclusions, snap.families, eventId, snap.families, eventId, snap.fixed],
  };
}

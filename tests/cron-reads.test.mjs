// 054 (specs/054-cron-active-reads/): минутная проверка (cron) читает только идущие события — по индексу events_active
// (миграция 0017), их пары и участников; завершённые события, все компании и все люди не просматриваются. Проверка — по
// планам SQLite всех операторов вызова cron (и внутри пакетов) на базе с историей; поведение — прежнее.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

// Целиком можно просматривать только служебные таблицы (настройки — десяток строк, очередь — неотправленные сообщения)
// и частичный индекс идущих событий
const SERVICE = new Set(['settings', 'outbox']);
const ACTIVE_INDEX = 'events_active';

// Псевдоним → таблица: FROM/JOIN/UPDATE/INTO <таблица> [AS] <псевдоним>
const KEYWORD = /^(ON|WHERE|JOIN|CROSS|LEFT|INNER|SET|ORDER|GROUP|LIMIT|USING|VALUES|SELECT|AND|RETURNING)$/i;
function tablesOf(sql) {
  const names = new Map();
  for (const m of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi)) {
    names.set(m[1], m[1]);
    if (m[2] && !KEYWORD.test(m[2])) names.set(m[2], m[1]);
  }
  return names;
}

// Полные просмотры оператора, кроме разрешённых: ['таблица: строка плана']
function fullScans(sqlite, sql) {
  const names = tablesOf(sql);
  return sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((r) => r.detail).flatMap((d) => {
    const m = /^SCAN (\w+)(?: USING (?:COVERING )?INDEX (\w+))?/.exec(d);
    if (!m || m[1] === 'CONSTANT') return [];
    const table = names.get(m[1]) ?? m[1];
    return SERVICE.has(table) || m[2] === ACTIVE_INDEX ? [] : [`${table}: ${d}`];
  });
}

// Тексты всех операторов вызова cron (пакеты D1 выполняются оператор за оператором через тот же prepare)
async function cronStatements(w) {
  const seen = new Set();
  const { sqlite } = w.DB;
  const own = sqlite.prepare;
  sqlite.prepare = (sql) => {
    if (!/^\s*(BEGIN|COMMIT|ROLLBACK|SELECT total_changes\(\))/i.test(sql)) seen.add(sql.replace(/\s+/g, ' ').trim());
    return own.call(sqlite, sql);
  };
  try {
    await w.cron();
  } finally {
    sqlite.prepare = own;
  }
  return [...seen];
}

const NOTIFY = /MAX\(w\.wishlist_updated_at, w\.delivery_updated_at\) AS upd/;
const COMPANIES = /\bFROM companies\b/;

// История и два идущих события: H — завершённое с парами, A — идёт, до жеребьёвки, B — идёт, после жеребьёвки
async function historyWorld() {
  const w = await startWorld();
  const boss = { id: 7001, name: 'Владелец', username: 'boss' };
  const p = Array.from({ length: 9 }, (_, i) => ({ id: 7100 + i, name: 'Игрок' + (i + 1), username: 'g' + (i + 1) }));
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const event = async (title, people) => {
    const id = (await w.api(boss, 'admin.events.create', { title })).event.id;
    const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
    for (const u of people) {
      await w.say(u, '/start ' + code);
      if (!w.query('SELECT name FROM users WHERE tg_id = ?', u.id)[0]?.name) await w.say(u, u.name);
      await w.api(u, 'wishlist.save', { event: id, text: 'Хочу книгу' });
    }
    return id;
  };
  const H = await event('Прошлый год', p.slice(0, 4));
  await w.api(boss, 'admin.draw', { event: H });
  await w.api(boss, 'admin.event.finish', { event: H });
  const A = await event('До жеребьёвки', p.slice(4, 7));
  const B = await event('После жеребьёвки', [p[0], p[7], p[8]]);
  await w.api(boss, 'admin.draw', { event: B });
  await w.cron(); // отправить накопленные сообщения и уведомления о прошлых правках
  return { w, boss, p, H, A, B };
}

test('cron на базе с историей: только идущие события по индексу, их пары и участники; служебные таблицы', async () => {
  const { w, p, B } = await historyWorld();
  await w.api(p[7], 'wishlist.save', { event: B, text: 'Хочу шарф' }); // ждёт уведомления Санте
  const busy = await cronStatements(w);
  const quiet = await cronStatements(w);
  for (const [what, list] of [['минута с уведомлением', busy], ['обычная минута', quiet]]) {
    assert.ok(list.some((s) => NOTIFY.test(s)), `${what}: нет запроса уведомлений`);
    assert.deepEqual(list.flatMap((s) => fullScans(w.DB.sqlite, s).map((x) => `${x} ← ${s.slice(0, 90)}`)), [], what);
  }
  assert.ok(!quiet.some((s) => COMPANIES.test(s)), 'обычная минута: компании не читаются');
  assert.equal(w.last.db, 3, 'обычная минута — три запроса, как до 054');
});

test('уведомление: от идущих событий к их парам, затем подопечный — участники до жеребьёвки не перебираются', async () => {
  const { w } = await historyWorld();
  const sql = (await cronStatements(w)).find((s) => NOTIFY.test(s));
  const plan = w.DB.sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((r) => r.detail);
  assert.match(plan[0], /^SCAN e USING (?:COVERING )?INDEX events_active\b/, plan.join(' | '));
  assert.match(plan[1], /^SEARCH p USING (?:COVERING )?INDEX \w+ \(event_id=\?/, plan.join(' | '));
  assert.match(plan[2], /^SEARCH w USING (?:COVERING )?INDEX \w+ \(event_id=\? AND user_id=\?\)/, plan.join(' | '));
});

test('поведение прежнее: Санта получает «обновил письмо» один раз; автожеребьёвка — в контексте компании', async () => {
  const { w, p, A, B, H } = await historyWorld();
  const santa = w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', B, p[7].id)[0].santa;
  const notes = () => w.texts({ id: santa }).filter((t) => t.includes('обновил письмо') && t.includes('После жеребьёвки')).length;
  const before = notes();
  await w.api(p[7], 'wishlist.save', { event: B, text: 'Хочу шарф' });
  await w.cron();
  await w.cron();
  assert.equal(notes(), before + 1, 'одно уведомление');
  // Завершённое событие: пары и правки в нём уведомлений не дают (как до 054)
  w.sql(`UPDATE members SET wishlist_updated_at = ${Date.now() - 1000} WHERE event_id = ${H}`);
  const all = () => w.calls.filter((c) => c.method === 'sendMessage' && /Прошлый год/.test(c.params.text || '') && /обновил письмо/.test(c.params.text)).length;
  const fromHistory = all();
  await w.cron();
  assert.equal(all(), fromHistory, 'история — без уведомлений');
  // Минута с действием: компании читаются, жеребьёвка проведена
  w.sql(`UPDATE events SET draw_auto_date = '2000-01-01' WHERE id = ${A}`);
  const list = await cronStatements(w);
  assert.equal(w.query('SELECT draw_done FROM events WHERE id = ?', A)[0].draw_done, 1, 'автожеребьёвка');
  assert.ok(list.some((s) => COMPANIES.test(s)), 'в минуту с действием компании читаются');
});

test('от противного (054): прежние запросы и база без индекса находятся', async () => {
  const { w } = await historyWorld();
  const { sqlite } = w.DB;
  const OLD_NOTIFY = `SELECT p.event_id, p.santa, MAX(w.wishlist_updated_at, w.delivery_updated_at) AS upd, s.notify_mode, e.title, e.delivery_on
      FROM pairs p JOIN events e ON e.id = p.event_id AND e.status = 'active'
      JOIN members w ON w.event_id = p.event_id AND w.user_id = p.ward JOIN users s ON s.tg_id = p.santa
     WHERE MAX(w.wishlist_updated_at, w.delivery_updated_at) > p.notified_at AND MAX(w.wishlist_updated_at, w.delivery_updated_at) <= ?`;
  assert.ok(fullScans(sqlite, OLD_NOTIFY).some((x) => x.startsWith('pairs:')), 'прежний запрос уведомлений — все пары');
  assert.ok(fullScans(sqlite, "SELECT id, owner_id, name, owner_code != '' AS link, shared FROM companies").some((x) => x.startsWith('companies:')));
  const now = (await cronStatements(w)).filter((s) => NOTIFY.test(s) || /FROM events WHERE status = 'active'/.test(s));
  assert.equal(now.length, 2);
  sqlite.exec(`DROP INDEX ${ACTIVE_INDEX}`); // база, к которой 0017 ещё не применена: код работает, но читает все события
  for (const s of now) assert.ok(fullScans(sqlite, s).some((x) => x.startsWith('events:')), s.slice(0, 60));
  await w.cron();
});

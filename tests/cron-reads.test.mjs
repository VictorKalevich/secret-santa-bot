// 054 (specs/054-cron-active-reads/), 057 (specs/057-cron-marks/): минутная проверка (cron) читает только отметки —
// правки, ждущие уведомления Санте (members.notify_at, индекс members_notify), и идущие события, ещё не проверенные
// сегодня (events.checked_on, индекс events_unchecked); пары, участники, история и люди событий не перебираются.
// Проверка — по планам SQLite всех операторов вызова cron (и внутри пакетов) на базе с историей; поведение — прежнее.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { fullScans as scansOf, statementsDuring } from './support/plans.mjs';

after(restoreFetch);

// Целиком можно просматривать только служебные таблицы (настройки — десяток строк, очередь — неотправленные сообщения).
// Частичные индексы 057 — только поиском по диапазону; индекс идущих событий 054 больше не просматривается
const SERVICE = ['settings', 'outbox'];

const fullScans = (sqlite, sql) => scansOf(sqlite, sql, { tables: SERVICE });
const cronStatements = (w) => statementsDuring(w, () => w.cron());

const NOTIFY = /MAX\(w\.wishlist_updated_at, w\.delivery_updated_at\) AS upd/;
const DAILY = /FROM events WHERE status = 'active' AND checked_on < \?1/;
// Люди события (063: контекст события ctx.at — eventUsersQuery)
const PEOPLE = /\bFROM event_admins WHERE event_id = \?1\b/;
const plan = (w, sql) => w.DB.sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((r) => r.detail);

// История и два идущих события: H — завершённое с парами, A — идёт, до жеребьёвки, B — идёт, после жеребьёвки
async function historyWorld() {
  const w = await startWorld();
  const boss = { id: 7001, name: 'Владелец', username: 'boss' };
  const p = Array.from({ length: 9 }, (_, i) => ({ id: 7100 + i, name: 'Игрок' + (i + 1), username: 'g' + (i + 1) }));
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const event = async (title, people) => {
    const id = (await w.api(boss, 'event.create', { participate: false, title })).event.id;
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
  await w.cron(); // отправить накопленные сообщения, отметить события «на сегодня проверено»
  return { w, boss, p, H, A, B };
}

test('cron на базе с историей: только отметки по индексам и служебные таблицы', async () => {
  const { w, p, B } = await historyWorld();
  await w.api(p[7], 'wishlist.save', { event: B, text: 'Хочу шарф' }); // ждёт уведомления Санте
  const busy = await cronStatements(w);
  const quiet = await cronStatements(w);
  for (const [what, list] of [['минута с уведомлением', busy], ['обычная минута', quiet]]) {
    assert.ok(list.some((s) => NOTIFY.test(s)), `${what}: нет запроса уведомлений`);
    assert.ok(list.some((s) => DAILY.test(s)), `${what}: нет запроса ежедневного шага`);
    assert.deepEqual(list.flatMap((s) => fullScans(w.DB.sqlite, s).map((x) => `${x} ← ${s.slice(0, 90)}`)), [], what);
  }
  assert.ok(!quiet.some((s) => PEOPLE.test(s)), 'обычная минута: люди событий не читаются');
  assert.equal(w.last.db, 3, 'обычная минута — три запроса, как до 054');
  // В обычную минуту оба запроса ничего не находят: отметок старше задержки нет, все события проверены сегодня
  const [notify, daily] = [quiet.find((s) => NOTIFY.test(s)), quiet.find((s) => DAILY.test(s))];
  assert.equal(w.DB.sqlite.prepare(notify).all(Date.now()).length, 0, 'отметок нет');
  const today = w.query('SELECT checked_on FROM events WHERE id = ?', B)[0].checked_on;
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(w.DB.sqlite.prepare(daily).all(today, Date.now()).length, 0, 'непроверенных событий нет');
});

test('уведомление: от отметок к паре, событию и Санте — пары и участники без правок не перебираются', async () => {
  const { w } = await historyWorld();
  const sql = (await cronStatements(w)).find((s) => NOTIFY.test(s));
  const steps = plan(w, sql);
  assert.match(steps[0], /^SEARCH w USING (?:COVERING )?INDEX members_notify \(notify_at>\? AND notify_at<\?\)/, steps.join(' | '));
  assert.match(steps[1], /^SEARCH p USING (?:COVERING )?INDEX \w+ \(event_id=\? AND ward=\?\)/, steps.join(' | '));
  assert.match(steps[2], /^SEARCH e USING INTEGER PRIMARY KEY \(rowid=\?\)/, steps.join(' | '));
  assert.match(steps[3], /^SEARCH s USING INTEGER PRIMARY KEY \(rowid=\?\)/, steps.join(' | '));
});

test('ежедневный шаг: только не проверенные сегодня идущие события — поиском по индексу', async () => {
  const { w } = await historyWorld();
  const sql = (await cronStatements(w)).find((s) => DAILY.test(s));
  const steps = plan(w, sql);
  assert.match(steps[0], /^SEARCH events USING (?:COVERING )?INDEX events_unchecked \(checked_on<\?\)/, steps.join(' | '));
});

test('поведение прежнее: Санта получает «обновил письмо» один раз; автожеребьёвка — в контексте события', async () => {
  const { w, boss, p, A, B, H } = await historyWorld();
  const santa = w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', B, p[7].id)[0].santa;
  const notes = () => w.texts({ id: santa }).filter((t) => t.includes('обновил письмо') && t.includes('После жеребьёвки')).length;
  const before = notes();
  await w.api(p[7], 'wishlist.save', { event: B, text: 'Хочу шарф' });
  await w.cron();
  await w.cron();
  assert.equal(notes(), before + 1, 'одно уведомление');
  // Завершённое событие: отметка снимается молча (как до 054 — история уведомлений не даёт)
  w.sql(`UPDATE members SET wishlist_updated_at = ${Date.now() - 1000}, notify_at = ${Date.now() - 1000} WHERE event_id = ${H}`);
  const all = () => w.calls.filter((c) => c.method === 'sendMessage' && /Прошлый год/.test(c.params.text || '') && /обновил письмо/.test(c.params.text)).length;
  const fromHistory = all();
  await w.cron();
  assert.equal(all(), fromHistory, 'история — без уведомлений');
  assert.equal(w.query('SELECT COUNT(*) AS n FROM members WHERE notify_at > 0')[0].n, 0, 'отметки истории сняты');
  // Минута с действием: организатор задал автожеребьёвку после утренней проверки — жеребьёвка проведена в контексте события
  // (063: привязка к событию ничего не читает), таблицы целиком не читаются
  const today = w.query('SELECT checked_on FROM events WHERE id = ?', A)[0].checked_on;
  await w.api(boss, 'admin.game', { event: A, draw_auto_date: today });
  const list = await cronStatements(w);
  assert.equal(w.query('SELECT draw_done FROM events WHERE id = ?', A)[0].draw_done, 1, 'автожеребьёвка');
  assert.deepEqual(list.flatMap((s) => fullScans(w.DB.sqlite, s).map((x) => `${x} ← ${s.slice(0, 90)}`)), [], 'минута с действием');
});

test('от противного (054, 057): прежние запросы и база без индексов 0020 находятся', async () => {
  const { w } = await historyWorld();
  const { sqlite } = w.DB;
  const OLD_NOTIFY = `SELECT p.event_id, p.santa, MAX(w.wishlist_updated_at, w.delivery_updated_at) AS upd, s.notify_mode, e.title, e.delivery_on
      FROM pairs p JOIN events e ON e.id = p.event_id AND e.status = 'active'
      JOIN members w ON w.event_id = p.event_id AND w.user_id = p.ward JOIN users s ON s.tg_id = p.santa
     WHERE MAX(w.wishlist_updated_at, w.delivery_updated_at) > p.notified_at AND MAX(w.wishlist_updated_at, w.delivery_updated_at) <= ?`;
  assert.ok(fullScans(sqlite, OLD_NOTIFY).some((x) => x.startsWith('pairs:') || x.startsWith('events:')), 'запрос до 054 — все пары');
  const NOTIFY_054 = `SELECT p.event_id, p.santa, MAX(w.wishlist_updated_at, w.delivery_updated_at) AS upd, s.notify_mode, e.title, e.delivery_on
      FROM events e CROSS JOIN pairs p ON p.event_id = e.id CROSS JOIN members w ON w.event_id = p.event_id AND w.user_id = p.ward
      JOIN users s ON s.tg_id = p.santa
     WHERE e.status = 'active' AND MAX(w.wishlist_updated_at, w.delivery_updated_at) > p.notified_at AND MAX(w.wishlist_updated_at, w.delivery_updated_at) <= ?`;
  assert.ok(fullScans(sqlite, NOTIFY_054).some((x) => x.startsWith('events:')), 'запрос 054 — все идущие события каждую минуту');
  assert.ok(fullScans(sqlite, "SELECT * FROM events WHERE status = 'active'").some((x) => x.startsWith('events:')), 'ежедневный шаг до 057');
  assert.ok(fullScans(sqlite, "SELECT id, owner_id, name, owner_code != '' AS link, shared FROM companies").some((x) => x.startsWith('companies:')));
  const now = (await cronStatements(w)).filter((s) => NOTIFY.test(s) || DAILY.test(s));
  assert.equal(now.length, 2);
  sqlite.exec('DROP INDEX members_notify; DROP INDEX events_unchecked'); // индексы 0020 удалены: код работает, но читает всё
  const [notify, daily] = [now.find((s) => NOTIFY.test(s)), now.find((s) => DAILY.test(s))];
  assert.ok(fullScans(sqlite, notify).some((x) => x.startsWith('members:')), notify.slice(0, 60));
  assert.ok(fullScans(sqlite, daily).some((x) => x.startsWith('events:')), daily.slice(0, 60));
  await w.cron();
});

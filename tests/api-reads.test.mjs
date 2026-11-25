// 055 (specs/055-api-indexed-reads/), 063: вызовы обычных людей читают только своё — свои события, людей события,
// обращения и заявки своих событий, свои факты создания — по индексам. Чужие люди и события бота не просматриваются,
// сколько бы их ни было; владелец бота на главном экране тоже читает только свои события (063, решение владельца 1а).
// Проверка — по планам SQLite всех операторов каждого вызова (и внутри пакетов) на базе с чужой историей; поведение —
// прежнее (остальные тесты).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { fullScans, statementsDuring } from './support/plans.mjs';
import { organizerOfQuery } from '../src/db.js';

after(restoreFetch);

// Целиком — только служебные таблицы (настройки — десяток строк, очередь — неотправленные сообщения)
const SERVICE = ['settings', 'outbox'];
const INDEXES_0018 = ['support_threads_user', 'support_threads_taken', 'join_requests_event'];
const INDEXES_0024 = ['event_admins_user', 'event_creations_user', 'events_owner'];

const violations = (sqlite, sql) => fullScans(sqlite, sql, { tables: SERVICE });

const person = (id, name) => ({ id, name, username: 'u' + id });
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

// Открытый бот: владелец бота; чужая история — событие «Прошлое» Чужого (завершено: пары, переписка, обращение,
// отклонённая заявка) и событие соседки; своё событие «Ёлка» Хозяйки — вызовы его людей проверяются
async function historyWorld() {
  const w = await startWorld({ open: true });
  const boss = person(9501, 'Владелец');
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const signUp = async (u) => { await w.say(u, '/start'); await w.say(u, u.name); };
  const join = async (u, code) => {
    const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
    await w.say(u, '/start ' + code);
    if (!known) await w.say(u, u.name);
  };
  const event = async (owner, title, people) => {
    const id = (await w.api(owner, 'event.create', { participate: false, title })).event.id;
    const code = inviteOf(await w.api(owner, 'admin.state', { event: id }));
    for (const u of people) await join(u, code);
    for (const u of people) await w.api(u, 'wishlist.save', { event: id, text: 'Хочу книгу' });
    return { id, code };
  };

  // Чужая история
  const x = person(9510, 'Чужой');
  const f = Array.from({ length: 5 }, (_, i) => person(9520 + i, 'Сосед' + (i + 1)));
  await signUp(x);
  const old = await event(x, 'Прошлое', f.slice(0, 4));
  await w.api(x, 'admin.game', { event: old.id, approval: true });
  await join(f[4], old.code); // заявка
  const req = w.query('SELECT id FROM join_requests WHERE event_id = ? AND user_id = ?', old.id, f[4].id)[0].id;
  await w.api(x, 'admin.request.decide', { event: old.id, id: req, approve: false });
  await w.api(x, 'admin.draw', { event: old.id });
  await w.api(f[0], 'message.send', { event: old.id, to: 'ward', text: 'Привет' });
  await w.api(f[1], 'support.send', { event: old.id, text: 'Вопрос' });
  await w.api(x, 'admin.event.finish', { event: old.id });
  const y = person(9530, 'Соседка');
  await signUp(y);
  await event(y, 'У соседей', [person(9531, 'Гость1'), person(9532, 'Гость2')]);

  // Своё событие: владелец o, администратор p[0], участники p[1], p[2]
  const o = person(9540, 'Хозяйка');
  const p = Array.from({ length: 3 }, (_, i) => person(9550 + i, 'Игрок' + (i + 1)));
  await signUp(o);
  const own = await event(o, 'Ёлка', p);
  await w.api(o, 'admin.participate', { event: own.id, on: true });
  await w.api(o, 'wishlist.save', { event: own.id, text: 'Хочу шарф' });
  await w.api(o, 'admin.role.grant', { event: own.id, id: p[0].id });
  await w.cron();
  return { w, boss, x, y, o, p, own };
}

test('вызовы обычных людей и владельца бота на базе с чужой историей: только индексы, своё и служебные таблицы', async () => {
  const { w, boss, o, p, own } = await historyWorld();
  const calls = [];
  const run = async (name, fn) => calls.push({ name, list: await statementsDuring(w, fn) });
  const api = (u, action, body = {}) => run(`${u.name} ${action}`, () => w.api(u, action, body));

  for (const u of [o, ...p, boss]) await api(u, 'me');
  await api(p[1], 'event.get', { event: own.id });
  await api(p[1], 'wishlist.save', { event: own.id, text: 'Хочу книгу и шарф' });
  await api(p[0], 'admin.state', { event: own.id });
  await api(o, 'admin.state', { event: own.id });
  await api(o, 'admin.game', { event: own.id, approval: true });
  const q = person(9560, 'Новенький');
  await run('новичок: /start inv_ (заявка)', () => w.say(q, '/start ' + own.code));
  await run('новичок: имя (заявка)', () => w.say(q, q.name));
  const req = w.query('SELECT id FROM join_requests WHERE event_id = ? AND user_id = ?', own.id, q.id)[0].id;
  await api(p[0], 'admin.request.decide', { event: own.id, id: req, approve: false });
  await api(o, 'admin.game', { event: own.id, approval: false });
  const r = person(9561, 'Поздний');
  await run('новичок: /start inv_', () => w.say(r, '/start ' + own.code));
  await run('новичок: имя после ссылки', () => w.say(r, r.name));
  await api(o, 'admin.role.grant', { event: own.id, id: p[2].id });
  await api(o, 'admin.role.revoke', { event: own.id, id: p[2].id });
  await api(p[0], 'admin.draw', { event: own.id });
  await api(p[1], 'ward.get', { event: own.id });
  await api(p[1], 'message.send', { event: own.id, to: 'ward', text: 'Привет!' });
  const ward = w.query('SELECT ward FROM pairs WHERE event_id = ? AND santa = ?', own.id, p[1].id)[0].ward;
  await api([o, ...p, r].find((u) => u.id === ward), 'chat.get', { event: own.id, with: 'santa' });
  await api(p[2], 'support.send', { event: own.id, text: 'Помогите' });
  const th = w.query('SELECT id FROM support_threads WHERE event_id = ? AND user_id = ?', own.id, p[2].id)[0].id;
  await api(p[0], 'admin.support.take', { event: own.id, thread: th });
  await api(p[0], 'admin.support.send', { event: own.id, thread: th, text: 'Сейчас' });
  await api(p[0], 'admin.support.get', { event: own.id, thread: th });
  await api(p[0], 'me');
  await api(p[2], 'me');
  await run(`${p[1].name} /start (меню)`, () => w.say(p[1], '/start'));
  const n = person(9570, 'Основатель');
  await run('незнакомец: /start', () => w.say(n, '/start'));
  await run('незнакомец: имя', () => w.say(n, n.name));
  await api(n, 'event.create', { title: 'Новое' });
  await api(n, 'me');
  await run('прежняя ссылка владельца комнаты own_', () => w.say(p[2], '/start own_abc123'));
  await api(o, 'admin.owner.transfer', { event: own.id, id: p[0].id });
  await api(p[2], 'me');

  const bad = calls.flatMap(({ name, list }) => list.flatMap((s) => violations(w.DB.sqlite, s).map((v) => `${name}: ${v} ← ${s.slice(0, 120)}`)));
  assert.deepEqual(bad, []);
});

test('первый пакет: события, где вызывающий организатор; владелец бота на главном экране — только свои события', async () => {
  const { w, boss, o, p, x, own } = await historyWorld();
  const ids = async (u) => (await organizerOfQuery(w.DB, u).all()).results.map((r) => r.event_id);
  assert.deepEqual(await ids(o.id), [own.id]);
  assert.deepEqual(await ids(p[0].id), [own.id]);
  assert.deepEqual(await ids(p[1].id), []);
  assert.ok(!(await ids(x.id)).includes(own.id));
  assert.deepEqual(await ids(0), []);
  const roles = async (u) => (await w.api(u, 'me')).events.map((e) => [e.id, e.role]);
  assert.deepEqual(await roles(o), [[own.id, 'owner']]);
  assert.deepEqual(await roles(p[0]), [[own.id, 'admin']]);
  assert.deepEqual(await roles(p[1]), [[own.id, 'member']]);
  assert.deepEqual(await roles(boss), [], 'чужие события — только во «Всех событиях»');
});

test('от противного (055, 063): прежние запросы и база без индексов 0018 и 0024 находятся', async () => {
  const { w, o, p, own } = await historyWorld();
  const { sqlite } = w.DB;
  const OLD = {
    users: `SELECT u.*, COALESCE(cm.is_admin, 0) AS company_admin, cm.user_id IS NULL AS guest
              FROM users u LEFT JOIN company_members cm ON cm.company_id = ? AND cm.user_id = u.tg_id
             WHERE cm.user_id IS NOT NULL OR u.tg_id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'owner_id')
             ORDER BY u.created_at, u.tg_id`,
    events: 'SELECT * FROM events ORDER BY created_at DESC',
  };
  for (const [table, sql] of Object.entries(OLD)) {
    assert.ok(violations(sqlite, sql).some((v) => v.startsWith(table + ':')), `прежний запрос: ${table}`);
  }
  const list = [
    ...(await statementsDuring(w, () => w.api(p[1], 'me'))),
    ...(await statementsDuring(w, () => w.api(o, 'admin.game', { event: own.id, approval: true }))),
    ...(await statementsDuring(w, () => w.say(person(9599, 'Ещё'), '/start ' + own.code))),
    ...(await statementsDuring(w, () => w.say(person(9599, 'Ещё'), 'Ещё'))),
    ...(await statementsDuring(w, () => w.api(o, 'me'))),
    ...(await statementsDuring(w, () => w.api(o, 'admin.draw', { event: own.id }))),
  ];
  assert.deepEqual(list.flatMap((s) => violations(sqlite, s)), [], 'с индексами — без полных просмотров');
  // База, к которой 0018 и 0024 ещё не применены
  for (const name of [...INDEXES_0018, ...INDEXES_0024]) sqlite.exec(`DROP INDEX ${name}`);
  const scanned = new Set(list.flatMap((s) => violations(sqlite, s)).map((v) => v.split(':')[0]));
  // История пар без events_owner — проход по всем парам бота
  for (const table of ['support_threads', 'join_requests', 'event_admins', 'event_creations', 'pairs']) {
    assert.ok(scanned.has(table), `без индексов: ${table}`);
  }
  await w.api(p[1], 'me'); // код от индексов не зависит
});

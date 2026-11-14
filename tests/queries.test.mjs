// Число запросов на действие (016, FR-1610; Конституция, принцип V — не больше 50 внешних запросов на вызов).
// К базе — не больше базового замера (шаг 4 плана рефакторинга их сокращает, остальные шаги не добавляют);
// к Telegram — ровно столько же (сообщения — поведение). Таблица — docs/refactoring/baseline.md, раздел 3;
// посмотреть текущие числа и SQL: node tests/bench/queries.mjs [sql].
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { runQueriesScenario } from './support/queries-scenario.mjs';

after(restoreFetch);

// действие → [запросов к базе не больше, запросов к Telegram ровно] (вместе с отправкой очереди после ответа)
const BASELINE = {
  '/setup (POST)': [3, 6],
  'bot: /start adm_ (ссылка владельца)': [10, 1],
  'bot: ввод имени': [5, 2],
  'admin.events.create': [4, 0],
  'admin.state (пустое событие)': [14, 0],
  'bot: /start inv_ (новый человек)': [5, 1],
  'bot: имя после ссылки': [12, 3],
  'admin.role.grant': [9, 1],
  'admin.participate (вкл)': [5, 0],
  'wishlist.save': [5, 0],
  'me (участник)': [6, 0],
  'me (админ)': [7, 0],
  'event.get (участник, до жеребьёвки)': [9, 0],
  'admin.exclusion.add': [10, 0],
  'admin.fixed.add': [8, 0],
  'admin.family.save': [6, 0],
  'admin.game': [5, 0],
  'admin.draw.check': [9, 0],
  'admin.draw (14 человек)': [14, 14],
  'admin.state (админ, после жеребьёвки)': [14, 0],
  'admin.state (владелец)': [15, 0],
  'ward.get (первый раз)': [8, 0],
  'ward.get (повторно)': [7, 0],
  'ward.gift': [5, 0],
  'message.send': [10, 1],
  'chat.get': [7, 0],
  'ward.received': [9, 1],
  'event.get (участник, после жеребьёвки)': [10, 0],
  'support.send (новое обращение)': [12, 2],
  'support.get': [7, 0],
  'admin.support.take': [11, 2],
  'admin.support.send': [11, 1],
  'admin.support.get': [7, 0],
  'admin.support.close': [10, 1],
  'admin.announce (14 человек)': [10, 14],
  'admin.remind.santas': [10, 13],
  'admin.remove (после жеребьёвки)': [16, 2],
  'admin.registration': [5, 0],
  'admin.insert': [15, 2],
  'admin.vault.pairs': [7, 0],
  'admin.vault.person': [13, 0],
  'admin.audit (событие)': [5, 0],
  'admin.event.finish': [10, 14],
  'cron (обычная минута)': [4, 0],
  'admin.events.create (по образцу + приглашения)': [12, 14],
  'admin.event.delete': [9, 14],
};

test('запросы: каждое действие сценария не тяжелее базового замера', async () => {
  const { rows, world } = await runQueriesScenario();
  assert.deepEqual(rows.map((r) => r.name), Object.keys(BASELINE), 'тот же набор действий');
  assert.equal(rows.length, 46);
  const worse = [];
  for (const { name, db, tg } of rows) {
    const [maxDb, wantTg] = BASELINE[name];
    if (db > maxDb) worse.push(`${name}: к базе ${db}, было ${maxDb}`);
    if (tg !== wantTg) worse.push(`${name}: к Telegram ${tg}, было ${wantTg}`);
    if (db + tg > 50) worse.push(`${name}: ${db + tg} запросов за вызов — больше 50`);
  }
  assert.deepEqual(worse, []);
  assert.deepEqual(world.log().filter((l) => l.includes('budget exceeded')), []);
});

test('запросы: жеребьёвка на 40 человек вместе с отправкой очереди — не больше 50 за вызов', async () => {
  const w = await startWorld();
  const boss = { id: 9001, name: 'Владелец', username: 'boss' };
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'admin.events.create', { title: 'Большое' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev })).settings.invite_link)[1];
  const people = Array.from({ length: 40 }, (_, i) => ({ id: 1000 + i, name: 'Гость' + (i + 1), username: 'g' + (i + 1) }));
  for (const u of people) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  const d = await w.api(boss, 'admin.draw', { event: ev });
  assert.equal(d.count, 40);
  assert.ok(w.last.db + w.last.tg <= 50, `к базе ${w.last.db} + к Telegram ${w.last.tg}`);
  const waiting = w.query('SELECT COUNT(*) AS n FROM outbox')[0].n;
  assert.ok(waiting > 0, 'остальные сообщения ждут в очереди');
  assert.equal(w.last.tg + waiting, 40, 'по сообщению каждому');
  await w.cron();
  assert.equal(w.query('SELECT COUNT(*) AS n FROM outbox')[0].n, 0, 'следующий cron отправил остаток');
  for (const u of people) assert.equal(w.texts(u).filter((t) => t.includes('Жеребьёвка в событии')).length, 1, u.name);
  assert.deepEqual(w.log().filter((l) => l.includes('budget exceeded')), []);
});

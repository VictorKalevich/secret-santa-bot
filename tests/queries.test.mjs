// Число запросов на действие (016, FR-1610; Конституция, принцип V — не больше 50 внешних запросов на вызов).
// К базе — не больше базового замера (шаг 4 плана рефакторинга их сократил — числа ниже после 019, до него — в
// docs/refactoring/baseline.md, раздел 3; остальные шаги не добавляют); к Telegram — ровно столько же (сообщения —
// поведение). Посмотреть текущие числа и SQL: node tests/bench/queries.mjs [sql].
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { runQueriesScenario } from './support/queries-scenario.mjs';

after(restoreFetch);

// Пороги файла шага 4 (docs/refactoring/step-4-api-table-context.md, приёмка): до 019 → не больше. Таблица ниже их
// соблюдает; проверка — чтобы следующая правка таблицы не вернула прежние числа незаметно.
const STEP4 = {
  'admin.state (пустое событие)': 6,
  'admin.state (админ, после жеребьёвки)': 6,
  'admin.state (владелец)': 6,
  'admin.draw.check': 6,
  'admin.draw (14 человек)': 10,
  'admin.remove (после жеребьёвки)': 12,
  'admin.insert': 11,
  // действия обращений — базовое (до 019) минус 2
  'support.send (новое обращение)': 12 - 2,
  'support.get': 7 - 2,
  'admin.support.take': 11 - 2,
  'admin.support.send': 11 - 2,
  'admin.support.get': 7 - 2,
  'admin.support.close': 10 - 2,
};

// действие → [запросов к базе не больше, запросов к Telegram ровно] (вместе с отправкой очереди после ответа)
const BASELINE = {
  '/setup (POST)': [3, 6],
  'bot: /start adm_ (ссылка владельца)': [8, 1],
  'bot: ввод имени': [4, 2],
  'admin.events.create': [3, 0],
  'admin.state (пустое событие)': [4, 0],
  'bot: /start inv_ (новый человек)': [4, 1],
  'bot: имя после ссылки': [11, 3],
  'admin.role.grant': [6, 1],
  'admin.participate (вкл)': [4, 0],
  'wishlist.save': [4, 0],
  'me (участник)': [2, 0],
  'me (админ)': [2, 0],
  'event.get (участник, до жеребьёвки)': [4, 0],
  'admin.exclusion.add': [6, 0],
  'admin.fixed.add': [6, 0],
  'admin.family.save': [4, 0],
  'admin.game': [4, 0],
  'admin.draw.check': [4, 0],
  'admin.draw (14 человек)': [8, 14],
  'admin.state (админ, после жеребьёвки)': [4, 0],
  'admin.state (владелец)': [4, 0],
  'ward.get (первый раз)': [7, 0],
  'ward.get (повторно)': [6, 0],
  'ward.gift': [4, 0],
  'message.send': [8, 1],
  'chat.get': [6, 0],
  'ward.received': [8, 1],
  'event.get (участник, после жеребьёвки)': [4, 0],
  'support.send (новое обращение)': [9, 2],
  'support.get': [4, 0],
  'admin.support.take': [8, 2],
  'admin.support.send': [8, 1],
  'admin.support.get': [4, 0],
  'admin.support.close': [8, 1],
  'admin.announce (14 человек)': [8, 14],
  'admin.remind.santas': [8, 13],
  'admin.remove (после жеребьёвки)': [8, 2],
  'admin.registration': [4, 0],
  'admin.insert': [8, 2],
  'admin.vault.pairs': [5, 0],
  'admin.vault.person': [6, 0],
  'admin.audit (событие)': [4, 0],
  'admin.event.finish': [8, 14],
  'cron (обычная минута)': [3, 0],
  'admin.events.create (по образцу + приглашения)': [9, 14],
  'admin.event.delete': [8, 14],
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

test('запросы: пороги шага 4 (019) выполнены', () => {
  const over = Object.entries(STEP4).filter(([name, max]) => !(BASELINE[name][0] <= max)).map(([name, max]) => `${name}: ${BASELINE[name][0]} > ${max}`);
  assert.deepEqual(over, []);
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

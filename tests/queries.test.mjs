// Число запросов на действие (016, FR-1610; Конституция, принцип V — не больше 50 внешних запросов на вызов).
// К базе — не больше базового замера (шаг 4 плана рефакторинга их сократил — числа ниже после 019, до него — в
// git на 5d8cc0e: docs/refactoring/baseline.md, раздел 3; остальные фичи не добавляют; 047 — ввод имени без перечитывания
// пользователя; 063 — событие действия читается первым пакетом контекста, на запрос меньше у каждого действия события); к
// Telegram — ровно столько же (сообщения —
// поведение). Посмотреть текущие числа и SQL: node tests/bench/queries.mjs [sql].
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { runQueriesScenario } from './support/queries-scenario.mjs';

after(restoreFetch);

// Пороги шага 4 плана рефакторинга (019, приёмка): до 019 → не больше. Таблица ниже их
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
  '/setup (POST)': [4, 42], // 061: профиль бота на 11 языках — сколько помещается в бюджет вызова, место — в settings
  'bot: /start adm_ (ссылка владельца)': [8, 1],
  'bot: ввод имени': [3, 2],
  'event.create': [2, 0],
  'admin.state (пустое событие)': [2, 0],
  'bot: /start inv_ (новый человек)': [4, 1],
  'bot: имя после ссылки': [9, 3],
  'admin.role.grant': [6, 1],
  'admin.participate (вкл)': [2, 0],
  'wishlist.save': [3, 0],
  'me (участник)': [2, 0],
  'me (админ)': [2, 0],
  'event.get (участник, до жеребьёвки)': [3, 0],
  'admin.exclusion.add': [5, 0],
  'admin.fixed.add': [4, 0],
  'admin.game': [2, 0],
  'admin.draw.check': [2, 0],
  'admin.draw (14 человек)': [6, 14],
  'admin.state (админ, после жеребьёвки)': [2, 0],
  'admin.state (владелец)': [2, 0],
  'ward.get (первый раз)': [6, 0],
  'ward.get (повторно)': [5, 0],
  'ward.gift': [3, 0],
  'message.send': [7, 1],
  'chat.get': [5, 0],
  'ward.received': [7, 1],
  'event.get (участник, после жеребьёвки)': [3, 0],
  'support.send (новое обращение)': [8, 2],
  'support.get': [3, 0],
  'admin.support.take': [7, 2],
  'admin.support.send': [7, 1],
  'admin.support.get': [2, 0],
  'admin.support.close': [7, 1],
  'admin.announce (14 человек)': [6, 14],
  'admin.remind.santas': [6, 13],
  'admin.remove (после жеребьёвки)': [7, 2],
  'admin.registration': [2, 0],
  'bot: «Участвовать как …» (после ссылки)': [9, 5],
  'admin.insert': [6, 2],
  'admin.vault.pairs': [3, 0],
  'admin.vault.person': [4, 0],
  'admin.audit (событие)': [2, 0],
  'admin.event.finish': [6, 14],
  'cron (обычная минута)': [3, 0],
  'event.create (по образцу + приглашения)': [9, 14],
  'admin.event.delete': [6, 14],
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
  const ev = (await w.api(boss, 'event.create', { participate: false, title: 'Большое' })).event.id;
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

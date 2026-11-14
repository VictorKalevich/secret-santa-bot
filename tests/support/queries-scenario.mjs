// Сценарий из 46 действий через весь Worker (016): число запросов к базе и к Telegram на каждое действие.
// Пользуются tests/queries.test.mjs (не больше базового замера) и tests/bench/queries.mjs (печать таблицы и SQL).
// Базовые числа — docs/refactoring/baseline.md, раздел 3.
import assert from 'node:assert/strict';
import { startWorld } from './world.mjs';

export async function runQueriesScenario() {
  const t0 = performance.now();
  const w = await startWorld();
  const rows = [];
  const note = (name) => rows.push({ name, db: w.last.db, tg: w.last.tg, sql: w.last.sql });
  const boss = { id: 9001, name: 'Владелец', username: 'boss' };
  const adm = { id: 9002, name: 'Админ', username: 'adm' };
  const people = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));
  const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

  const s = await w.setup(); note('/setup (POST)');
  assert.equal(s.status, 200);
  assert.ok(s.adminCode, 'ссылка владельца на странице');
  await w.say(boss, '/start ' + s.adminCode); note('bot: /start adm_ (ссылка владельца)');
  await w.say(boss, 'Владелец'); note('bot: ввод имени');
  const ev = (await w.api(boss, 'admin.events.create', { title: 'Новый год 🎄' })).event; note('admin.events.create');
  let st = await w.api(boss, 'admin.state', { event: ev.id }); note('admin.state (пустое событие)');
  const code = inviteOf(st);
  for (const u of [adm, ...people]) {
    await w.say(u, '/start ' + code);
    if (u === people[0]) note('bot: /start inv_ (новый человек)');
    await w.say(u, u.name);
    if (u === people[0]) note('bot: имя после ссылки');
  }
  await w.api(boss, 'admin.role.grant', { id: adm.id }); note('admin.role.grant');
  await w.api(boss, 'admin.participate', { event: ev.id, on: true }); note('admin.participate (вкл)');
  for (const u of people) await w.api(u, 'wishlist.save', { event: ev.id, text: 'Хочу книгу. '.repeat(20) });
  note('wishlist.save');
  await w.api(people[0], 'me'); note('me (участник)');
  await w.api(adm, 'me'); note('me (админ)');
  await w.api(people[0], 'event.get', { event: ev.id }); note('event.get (участник, до жеребьёвки)');
  await w.api(adm, 'admin.exclusion.add', { event: ev.id, giver: people[0].id, receiver: people[1].id, mutual: true }); note('admin.exclusion.add');
  await w.api(boss, 'admin.fixed.add', { event: ev.id, giver: people[2].id, receiver: people[3].id }); note('admin.fixed.add');
  await w.api(boss, 'admin.family.save', { name: 'Ивановы', members: [people[4].id, people[5].id] }); note('admin.family.save');
  await w.api(adm, 'admin.game', { event: ev.id, title: 'Новый год 🎄', budget: '50 р.', event_date: '2026-12-31' }); note('admin.game');
  await w.api(adm, 'admin.draw.check', { event: ev.id }); note('admin.draw.check');
  const d = await w.api(adm, 'admin.draw', { event: ev.id }); note('admin.draw (14 человек)');
  assert.equal(d.count, 14);
  st = await w.api(adm, 'admin.state', { event: ev.id }); note('admin.state (админ, после жеребьёвки)');
  assert.ok(!('fixed' in st), 'админ не видит закреплённых пар');
  st = await w.api(boss, 'admin.state', { event: ev.id }); note('admin.state (владелец)');
  assert.equal(st.fixed.length, 1);
  const wg = await w.api(people[2], 'ward.get', { event: ev.id }); note('ward.get (первый раз)');
  assert.equal(wg.ward.name, people[3].name, 'закреплённая пара соблюдена');
  await w.api(people[2], 'ward.get', { event: ev.id }); note('ward.get (повторно)');
  await w.api(people[2], 'ward.gift', { event: ev.id, ready: true }); note('ward.gift');
  await w.api(people[2], 'message.send', { event: ev.id, to: 'ward', text: 'Привет!' }); note('message.send');
  await w.api(people[3], 'chat.get', { event: ev.id, with: 'santa' }); note('chat.get');
  await w.api(people[3], 'ward.received', { event: ev.id, received: true }); note('ward.received');
  await w.api(people[0], 'event.get', { event: ev.id }); note('event.get (участник, после жеребьёвки)');
  await w.api(people[6], 'support.send', { event: ev.id, text: 'Помогите' }); note('support.send (новое обращение)');
  await w.api(people[6], 'support.get', { event: ev.id }); note('support.get');
  const th = (await w.api(adm, 'admin.state', { event: ev.id })).support.threads[0];
  await w.api(adm, 'admin.support.take', { event: ev.id, thread: th.id }); note('admin.support.take');
  await w.api(adm, 'admin.support.send', { event: ev.id, thread: th.id, text: 'Сейчас' }); note('admin.support.send');
  await w.api(adm, 'admin.support.get', { event: ev.id, thread: th.id }); note('admin.support.get');
  await w.api(adm, 'admin.support.close', { event: ev.id, thread: th.id }); note('admin.support.close');
  await w.api(adm, 'admin.announce', { event: ev.id, text: 'Всем привет' }); note('admin.announce (14 человек)');
  await w.api(adm, 'admin.remind.santas', { event: ev.id }); note('admin.remind.santas');
  await w.api(adm, 'admin.remove', { event: ev.id, id: people[7].id }); note('admin.remove (после жеребьёвки)');
  const late = { id: 777, name: 'Опоздавший', username: 'late' };
  await w.api(adm, 'admin.registration', { event: ev.id, open: true }); note('admin.registration');
  st = await w.api(boss, 'admin.state', { event: ev.id });
  await w.say(late, '/start ' + inviteOf(st));
  await w.say(late, late.name);
  await w.api(boss, 'admin.insert', { event: ev.id, id: late.id }); note('admin.insert');
  await w.api(boss, 'admin.vault.pairs', { event: ev.id }); note('admin.vault.pairs');
  await w.api(boss, 'admin.vault.person', { event: ev.id, id: people[2].id }); note('admin.vault.person');
  await w.api(adm, 'admin.audit', { event: ev.id }); note('admin.audit (событие)');
  const two = await w.together([1, 2].map(() => () => w.api(adm, 'admin.reveal', { event: ev.id }, true)));
  assert.deepEqual(two.map((r) => r.status).sort(), [200, 400], 'раскрытие: один из двух одновременных вызовов');
  await w.api(adm, 'admin.event.finish', { event: ev.id }); note('admin.event.finish');
  await w.cron(); note('cron (обычная минута)');
  await w.api(boss, 'admin.events.create', { title: 'Второе', from: ev.id, invite: true }); note('admin.events.create (по образцу + приглашения)');
  await w.api(boss, 'admin.event.delete', { event: ev.id, confirm: 'УДАЛИТЬ' }); note('admin.event.delete');
  return { rows, world: w, ms: performance.now() - t0 };
}

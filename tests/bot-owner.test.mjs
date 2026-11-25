// 063 (specs/063-events-without-rooms/, контракт — contracts/events-without-rooms.md, раздел 2): раздел «Владелец бота» —
// кто может создавать события (закрытый бот), все события страницами, владелец бота в чужом событии — гость, журнал бота
// (новые коды и прежние записи общих журналов комнат), передача прав владельца бота. Действия bot.* — только ему.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { newEvent, inviteCode, join, allowCreate, invariants } from './support/events.mjs';

after(restoreFetch);

const boss = { id: 9501, name: 'Владелец', username: 'boss' };
const anya = { id: 9502, name: 'Аня', username: 'anya' };
const bora = { id: 9503, name: 'Боря', username: 'bora' };
const vera = { id: 9504, name: 'Вера', username: 'vera' };

const BOT_ONLY = '403 Только для владельца бота.';
const BOT_ACTIONS = [['bot.events', {}], ['bot.people', {}], ['bot.creator.set', { id: 9502, on: true }], ['bot.audit', {}],
  ['bot.owner.transfer', { id: 9502 }]];

// Закрытый бот: событие A владельца бота (Аня, Боря — участники), Вере разрешено создавать, её событие B (Боря участвует)
async function world({ open = false } = {}) {
  const w = await startWorld({ open });
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const A = await newEvent(w, boss, 'Семья');
  const code = await inviteCode(w, boss, A);
  for (const u of [anya, bora, vera]) await join(w, u, code);
  await allowCreate(w, boss, vera);
  const B = await newEvent(w, vera, 'Работа', { participate: true });
  await join(w, bora, await inviteCode(w, vera, B));
  return { w, A, B };
}
const call = async (w, u, action, body) => {
  const r = await w.api(u, action, body, true);
  return r.data.ok ? r.data : `${r.status} ${r.data.error}`;
};
const botLog = (w) => w.query('SELECT action, details FROM audit WHERE event_id = 0 ORDER BY id').map((x) => [x.action, x.details]);

describe('действия bot.* — только владельцу бота', () => {
  it('владелец события и участник — 403 на каждом', async () => {
    const { w } = await world();
    for (const u of [vera, anya]) {
      for (const [action, body] of BOT_ACTIONS) assert.equal(await call(w, u, action, body), BOT_ONLY, `${u.name}: ${action}`);
    }
  });
});

describe('кто может создавать события (US5, T053)', () => {
  it('bot.people: закрытый бот — все зарегистрированные по имени, кроме себя; признак разрешения', async () => {
    const { w } = await world();
    assert.deepEqual((await w.api(boss, 'bot.people')).people.map((u) => [u.name, u.can_create]),
      [['Аня', false], ['Боря', false], ['Вера', true]]);
  });

  it('bot.people: открытый бот — люди событий владельца бота', async () => {
    const w = await startWorld({ open: true });
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    for (const u of [anya, bora]) {
      await w.say(u, '/start');
      await w.say(u, u.name);
    }
    const A = await newEvent(w, boss, 'Своё');
    await join(w, anya, await inviteCode(w, boss, A));
    await newEvent(w, bora, 'Чужое', { participate: true });
    assert.deepEqual((await w.api(boss, 'bot.people')).people.map((u) => u.name), ['Аня']);
  });

  it('снятие разрешения — созданные события остаются за владельцем; повтор — «Уже не разрешено.»', async () => {
    const { w, B } = await world();
    await w.api(boss, 'bot.creator.set', { id: vera.id, on: false });
    assert.match(w.lastText(vera), /больше не разрешает тебе создавать/);
    assert.equal((await w.api(vera, 'me')).events.find((e) => e.id === B).role, 'owner');
    assert.equal(await call(w, boss, 'bot.creator.set', { id: vera.id, on: false }), '400 Уже не разрешено.');
    assert.equal(await call(w, boss, 'bot.creator.set', { id: 1, on: true }), '400 Назначить можно только зарегистрированного человека.');
  });

  it('разрешение ×2 одновременно — одно сообщение и одна запись журнала', async () => {
    const { w } = await world();
    const before = w.texts(anya).length;
    const rs = await w.together([0, 1].map(() => () => w.api(boss, 'bot.creator.set', { id: anya.id, on: true }, true)));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 400]);
    assert.equal(w.texts(anya).length - before, 1);
    assert.equal(botLog(w).filter(([a, d]) => a === 'creator.grant' && d === 'Аня').length, 1);
  });
});

describe('все события, гость, журнал бота (US6, T057)', () => {
  it('bot.events: новые первыми, по 50, more; название, владелец, участников', async () => {
    const { w } = await world();
    for (let i = 1; i <= 50; i++) await newEvent(w, boss, 'Пачка ' + i);
    const p1 = await w.api(boss, 'bot.events');
    assert.equal(p1.events.length, 50);
    assert.equal(p1.more, true);
    assert.equal(p1.events[0].title, 'Пачка 50');
    const p2 = await w.api(boss, 'bot.events', { offset: 50 });
    assert.deepEqual(p2.events.map((e) => [e.title, e.owner_name, e.people, e.status]),
      [['Работа', 'Вера', 2, 'active'], ['Семья', 'Владелец', 3, 'active']]);
    assert.equal(p2.more, false);
  });

  it('владелец бота в чужом событии — гость: не в списках и не среди получателей; действие — в журнале события под его именем', async () => {
    const { w, B } = await world();
    const ev = await w.api(boss, 'event.get', { event: B });
    assert.equal(ev.event.role, 'guest');
    const st = await w.api(boss, 'admin.state', { event: B });
    assert.ok(!st.users.some((u) => u.id === boss.id));
    assert.ok(!(await w.api(boss, 'me')).events.some((e) => e.id === B));
    const before = w.texts(boss).length;
    await w.api(bora, 'support.send', { event: B, text: 'Вопрос' });
    assert.equal(w.texts(boss).length, before, 'обращение — организаторам события, не гостю');
    assert.match(w.lastText(vera), /Вопрос/);
    await w.api(boss, 'admin.registration', { event: B, open: false });
    const log = await w.api(vera, 'admin.audit', { event: B });
    assert.equal(log.entries[0].actor_name, 'Владелец');
  });

  it('журнал бота: создания, разрешения, переименование, удаление события и прежние записи комнат', async () => {
    const { w, A } = await world();
    await w.api(boss, 'admin.rename', { id: anya.id, name: 'Анна' });
    await w.api(boss, 'admin.event.delete', { event: A, confirm: 'УДАЛИТЬ' });
    // Прежняя запись общего журнала комнаты (до 063): event_id = 0, company_id — комната
    w.sql("INSERT INTO audit (event_id, company_id, actor, action, details, created_at) VALUES (0, 1, 9501, 'company.owner', '→ Вера', 1)");
    const codes = (await w.api(boss, 'bot.audit')).entries.map((e) => e.action);
    assert.deepEqual([...new Set(codes)].sort(), ['company.owner', 'creator.grant', 'event.create', 'event.delete', 'owner.link', 'rename']);
    assert.deepEqual(botLog(w).filter(([a]) => a === 'event.delete'), [['event.delete', '«Семья», участников: 3']]);
    // Журнал удалённого события открыть негде
    assert.equal(await call(w, boss, 'admin.audit', { event: A }), '404 Событие не найдено.');
  });

  it('прежние записи комнат с отложенным текстом (061–062) — текстом на языке смотрящего, без ошибок словаря', async () => {
    const { w } = await world();
    const owner = { $t: 'companies.audit.ownerChanged', $p: { title: 'Работа', details: { $t: 'companies.audit.byLink', $p: { name: 'Вера' } } } };
    const deleted = { $t: 'companies.audit.roomDeleted', $p: { title: 'Старая', n: 3 } };
    for (const [action, details, tx] of [['company.owner', '«Работа»: по ссылке: Вера', owner], ['company.delete', '«Старая», людей: 3', deleted]]) {
      w.sql(`INSERT INTO audit (event_id, company_id, actor, action, details, details_tx, created_at)
        VALUES (0, 0, ${boss.id}, '${action}', '${details}', '${JSON.stringify(tx)}', 1)`);
    }
    const shown = async (u) => Object.fromEntries((await w.api(u, 'bot.audit')).entries
      .filter((e) => e.action.startsWith('company.')).map((e) => [e.action, e.details]));
    assert.deepEqual(await shown(boss), { 'company.owner': '«Работа»: по ссылке: Вера', 'company.delete': '«Старая», людей: 3' });
    assert.deepEqual(await shown({ ...boss, language_code: 'en' }), { 'company.owner': '“Работа”: via link: Вера', 'company.delete': '“Старая”, people: 3' });
  });

  it('передача прав владельца бота: лимит появляется у прежнего, пропадает у нового; события остаются', async () => {
    const { w, A } = await world();
    assert.deepEqual((await w.api(boss, 'me')).create, { bot: true });
    await w.api(boss, 'bot.owner.transfer', { id: anya.id });
    assert.match(w.lastText(anya), /Тебе переданы права владельца бота/);
    assert.deepEqual((await w.api(anya, 'me')).create, { bot: true });
    // Прежний владелец бота создаёт по-прежнему — с лимитом (его событие A — уже одно из десяти)
    assert.deepEqual((await w.api(boss, 'me')).create, { left: 9, limit: 10 });
    assert.equal((await w.api(boss, 'me')).events.find((e) => e.id === A).role, 'owner');
    assert.equal(await call(w, boss, 'bot.events', {}), BOT_ONLY);
    assert.deepEqual(botLog(w).filter(([a]) => a === 'owner.transfer'), [['owner.transfer', '→ Аня']]);
    assert.deepEqual(invariants(w), []);
  });
});

// 063 (specs/063-events-without-rooms/, контракт — contracts/events-without-rooms.md, event.create): кто создаёт события
// и лимит «10 за 365 суток». Открытый бот — любой зарегистрированный, закрытый — владелец бота и те, кому он разрешил;
// создатель — владелец (и участник при «Я тоже участвую»); образец — только своё событие; лимит считается по фактам
// создания (удаление и передача место не освобождают), у владельца бота его нет; me.create — во всех случаях.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { newEvent, inviteCode, join, allowCreate, invariants } from './support/events.mjs';
import { LIMIT_MS } from '../src/creation.js';

after(restoreFetch);

const boss = { id: 9401, name: 'Владелец', username: 'boss' };
const anya = { id: 9402, name: 'Аня', username: 'anya' };
const bora = { id: 9403, name: 'Боря', username: 'bora' };

const RIGHT = 'Создавать события в этом боте может владелец бота и те, кому он разрешил.';
const LIMIT = /^За 12 месяцев можно создать не больше 10 событий\. Следующее — с \d+ \S+\.$/;

async function world({ open }) {
  const w = await startWorld({ open });
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  return w;
}
// Незнакомец открытого бота: /start без ссылки → имя
async function stranger(w, u) {
  await w.say(u, '/start');
  await w.say(u, u.name);
}
const create = async (w, u, body) => {
  const r = await w.api(u, 'event.create', body, true);
  return r.data.ok ? r.data : `${r.status} ${r.data.error}`;
};
const createOf = async (w, u) => (await w.api(u, 'me')).create;

describe('открытый бот: создаёт любой (US2)', () => {
  it('незнакомец → имя → создание: владелец, участие по флажку, ссылка, журналы', async () => {
    const w = await world({ open: true });
    await stranger(w, anya);
    assert.match(w.texts(anya).join('\n'), /Создай первое событие в приложении/);
    assert.deepEqual(await createOf(w, anya), { left: 10, limit: 10 });
    const r = await create(w, anya, { title: 'Друзья' });
    assert.equal(r.event.role, 'owner');
    const A = r.event.id;
    assert.deepEqual((await w.api(anya, 'me')).events.map((e) => [e.id, e.role, e.member]), [[A, 'owner', true]]);
    assert.match((await w.api(anya, 'admin.state', { event: A })).settings.invite_link, /start=inv_/);
    const B = (await create(w, anya, { title: 'Без меня', participate: false })).event.id;
    assert.deepEqual((await w.api(anya, 'me')).events.find((e) => e.id === B).member, false);
    assert.deepEqual(w.query("SELECT event_id, details FROM audit WHERE action = 'event.create' ORDER BY id").map((x) => [x.event_id, x.details]),
      [[A, ''], [0, '«Друзья»'], [B, ''], [0, '«Без меня»']]);
    assert.deepEqual(await createOf(w, anya), { left: 8, limit: 10 });
    assert.deepEqual(invariants(w), []);
  });

  it('образец — только своё событие (владельцу бота — любое); исключения образца копируются', async () => {
    const w = await world({ open: true });
    await stranger(w, anya);
    await stranger(w, bora);
    const A = await newEvent(w, anya, 'Прошлый год', { participate: true });
    const code = await inviteCode(w, anya, A);
    const vera = { id: 9404, name: 'Вера', username: 'vera' };
    await join(w, vera, code);
    await join(w, bora, code);
    await w.api(anya, 'admin.exclusion.add', { event: A, giver: vera.id, receiver: bora.id });
    assert.equal(await create(w, bora, { title: 'Чужой образец', from: A }), '400 Образец не найден.');
    const own = await create(w, anya, { title: 'Этот год', from: A, invite: true });
    assert.equal(own.invited, 2);
    const st = await w.api(anya, 'admin.state', { event: own.event.id });
    assert.equal(st.users.filter((u) => u.registered).length, 1, 'приглашённые ещё не вступили');
    assert.match(w.query("SELECT details FROM audit WHERE event_id = ? AND action = 'event.create'", own.event.id)[0].details, /по образцу «Прошлый год»/);
    assert.equal(typeof (await create(w, boss, { title: 'Владелец бота', from: A })), 'object', 'владельцу бота — любой образец');
    assert.deepEqual(invariants(w), []);
  });
});

describe('лимит: 10 за 365 суток (US2)', () => {
  it('10 проходят, 11-е — отказ с датой; удалённые считаются; через 365 суток — снова можно', async () => {
    const w = await world({ open: true });
    await stranger(w, anya);
    const ids = [];
    for (let i = 1; i <= 10; i++) ids.push((await create(w, anya, { title: 'Событие ' + i })).event.id);
    assert.match(await create(w, anya, { title: 'Одиннадцатое' }), new RegExp('^400 ' + LIMIT.source.slice(1)));
    const full = await createOf(w, anya);
    assert.equal(full.left, 0);
    assert.ok(full.next > Date.now() + LIMIT_MS - 60_000, 'место освободится через год после первого');
    // Удаление места не освобождает
    await w.api(anya, 'admin.event.delete', { event: ids[0], confirm: 'УДАЛИТЬ' });
    assert.match(await create(w, anya, { title: 'После удаления' }), /^400 За 12 месяцев/);
    // Первое создание вышло из окна
    w.sql(`UPDATE event_creations SET created_at = created_at - ${LIMIT_MS + 1000} WHERE event_id = ${ids[0]}`);
    assert.deepEqual(await createOf(w, anya), { left: 1, limit: 10 });
    assert.equal(typeof (await create(w, anya, { title: 'Через год' })), 'object');
    assert.match(await create(w, anya, { title: 'И ещё' }), /^400 За 12 месяцев/);
  });

  it('переданное событие место не освобождает; новый владелец его не тратит', async () => {
    const w = await world({ open: true });
    await stranger(w, anya);
    await stranger(w, bora);
    const ids = [];
    for (let i = 1; i <= 10; i++) ids.push(await newEvent(w, anya, 'Событие ' + i, { participate: true }));
    await join(w, bora, await inviteCode(w, anya, ids[0]));
    await w.api(anya, 'admin.owner.transfer', { event: ids[0], id: bora.id });
    assert.equal((await createOf(w, anya)).left, 0);
    assert.deepEqual(await createOf(w, bora), { left: 10, limit: 10 });
  });

  it('владелец бота — без лимита: me.create = { bot: true }', async () => {
    const w = await world({ open: false });
    for (let i = 1; i <= 11; i++) await newEvent(w, boss, 'Событие ' + i);
    assert.deepEqual(await createOf(w, boss), { bot: true });
    assert.equal((await w.api(boss, 'me')).events.length, 11);
  });

  it('от противного: факты создания — источник счёта (вставленные напрямую тоже считаются)', async () => {
    const w = await world({ open: true });
    await stranger(w, anya);
    const now = Date.now();
    for (let i = 1; i <= 10; i++) w.sql(`INSERT INTO event_creations (event_id, user_id, created_at) VALUES (${1000 + i}, ${anya.id}, ${now - i})`);
    assert.equal((await createOf(w, anya)).left, 0);
    assert.match(await create(w, anya, { title: 'Сверх' }), /^400 За 12 месяцев/);
  });
});

describe('закрытый бот: кто создаёт (US2, US5)', () => {
  it('без разрешения — отказ и нет me.create; с разрешением — можно; снятое разрешение — снова отказ', async () => {
    const w = await world({ open: false });
    const A = await newEvent(w, boss, 'Семья');
    await join(w, anya, await inviteCode(w, boss, A));
    assert.equal(await createOf(w, anya), undefined);
    assert.equal(await create(w, anya, { title: 'Своё' }), '403 ' + RIGHT);
    await allowCreate(w, boss, anya);
    assert.match(w.lastText(anya), /разрешил тебе создавать события/);
    assert.deepEqual(await createOf(w, anya), { left: 10, limit: 10 });
    assert.equal((await create(w, anya, { title: 'Своё' })).event.role, 'owner');
    await w.api(boss, 'bot.creator.set', { id: anya.id, on: false });
    assert.equal(await create(w, anya, { title: 'Ещё' }), '403 ' + RIGHT);
    assert.deepEqual(w.query("SELECT action, details FROM audit WHERE event_id = 0 AND action LIKE 'creator.%' ORDER BY id").map((x) => [x.action, x.details]),
      [['creator.grant', 'Аня'], ['creator.revoke', 'Аня']]);
    assert.deepEqual(invariants(w), []);
  });

  it('в открытом боте разрешений нет: bot.creator.set — отказ', async () => {
    const w = await world({ open: true });
    await stranger(w, anya);
    const r = await w.api(boss, 'bot.creator.set', { id: anya.id, on: true }, true);
    assert.equal(`${r.status} ${r.data.error}`, '400 В открытом боте создавать события может любой.');
  });

  it('незнакомцу закрытого бота — «закрытый бот», без регистрации', async () => {
    const w = await world({ open: false });
    await w.say(anya, '/start');
    await w.say(anya, anya.name);
    assert.deepEqual(w.texts(anya).map((x) => x.startsWith('🎄 Это закрытый бот')), [true, true]);
    assert.equal((await w.api(anya, 'me')).registered, false);
  });
});

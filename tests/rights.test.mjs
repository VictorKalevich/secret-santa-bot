// Права ролей по всем действиям admin.* (016, FR-1608): участник, администратор, владелец — каждое действие на свежем
// событии. 063: роли — в событии (specs/063-events-without-rooms/contracts/events-without-rooms.md, раздел 1): владелец
// бота ⊇ владелец события ⊇ администратор события (Конституция, принцип VII); владельцу события отказ по правам — только на
// действиях владельца бота (admin.transfer, admin.rename); администратор другого события получает «Событие не найдено.»
// на любом действии события, где он не человек события (SC-004), и «Только для администратора.» — где он участник.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';
import { newEvent, grant, join, inviteCode, invariants } from './support/events.mjs';
import { ACTIONS as TABLE } from '../src/api.js';

after(restoreFetch);

// Список — из таблицы действий (019, шаг 4 плана рефакторинга)
const ACTIONS = Object.keys(TABLE).filter((a) => a.startsWith('admin.'));
const EVENT_ACTIONS = ACTIONS.filter((a) => TABLE[a].event);

// Действия только владельца бота — владелец события получает 403
const BOT_ONLY = ['admin.rename', 'admin.transfer'];
// Действия только владельца — администратор события получает 403
const OWNER_ONLY = [
  ...BOT_ONLY, 'admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer', 'admin.insert', 'admin.draw.swap.check', 'admin.draw.swap',
  'admin.fixed.add', 'admin.fixed.del', 'admin.draw.cancel.force', 'admin.event.delete', 'admin.vault.person',
  'admin.vault.pairs', 'admin.reset.full',
].sort();

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const member = { id: 101, name: 'Участник', username: 'member' };
const chief = { id: 9005, name: 'Владелица', username: 'chief' };
const other = { id: 9006, name: 'Чужой админ', username: 'other' };
const stranger = { id: 7001, name: 'Незнакомец', username: 'stranger' };

// Минимальное тело: без слов подтверждения и без людей — опасные действия получают отказ по данным, а не по правам
const body = (event) => ({ event, id: 0, from: 0, to: 0, giver: 0, receiver: 0 });

let w;
let n = 0;
// Событие владельца: создаёт владелец бота и передаёт владение (лимит 10 созданий за год у Владелицы не мешает)
async function fresh(owner = boss) {
  const id = await newEvent(w, boss, 'Права ' + ++n);
  if (owner === boss) return id;
  await join(w, owner, await inviteCode(w, boss, id));
  await w.api(boss, 'admin.owner.transfer', { event: id, id: owner.id });
  return id;
}

before(async () => {
  w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = await fresh();
  const code = await inviteCode(w, boss, ev);
  for (const u of [adm, member, chief, other]) await join(w, u, code);
  // Администратор другого события: событие Владелицы
  await grant(w, chief, await fresh(chief), other);
});

test('права: список действий admin.* — ровно 43, включая действия с «_»; всего действий — 69 (063)', () => {
  assert.equal(ACTIONS.length, 43, ACTIONS.join(', '));
  assert.equal(Object.keys(TABLE).length, 69);
  assert.ok(ACTIONS.includes('admin.avoid_previous') && ACTIONS.includes('admin.event.invite_from'));
  for (const a of OWNER_ONLY) assert.ok(ACTIONS.includes(a), 'действие владельца есть в коде: ' + a);
});

test('права: участнику — «Только для администратора.» на каждом действии', async () => {
  const ev = await fresh();
  const wrong = [];
  for (const a of ACTIONS) {
    const r = await w.api(member, a, body(ev), true);
    if (r.status !== 403 || r.data.error !== 'Только для администратора.') wrong.push(`${a}: ${r.status} ${r.data.error}`);
  }
  assert.deepEqual(wrong, []);
});

test('права: администратору события — отказ по правам ровно на действиях владельца', async () => {
  const denied = [];
  for (const a of ACTIONS) {
    const ev = await fresh();
    await grant(w, boss, ev, adm);
    const r = await w.api(adm, a, body(ev), true);
    if (r.status === 403) {
      denied.push(a);
      assert.match(r.data.error, /может только владелец( бота)?\.$|^Служебный просмотр доступен только владельцу\.$/, a);
    }
  }
  assert.deepEqual(denied.sort(), OWNER_ONLY);
  assert.deepEqual(invariants(w), []);
});

test('права: владельцу бота — ни одного отказа по правам (каждое действие на свежем событии)', async () => {
  const denied = [];
  for (const a of ACTIONS) {
    const r = await w.api(boss, a, body(await fresh()), true);
    if (r.status === 403) denied.push(`${a}: ${r.data.error}`);
  }
  assert.deepEqual(denied, []);
});

test('063: владельцу события — в своём событии отказ по правам только на действиях владельца бота; чужое — 404', async () => {
  const denied = [];
  for (const a of ACTIONS) {
    const r = await w.api(chief, a, body(await fresh(chief)), true);
    if (r.status === 403) denied.push(`${a}: ${r.data.error}`);
  }
  assert.deepEqual(denied, [
    'admin.rename: Переименовать человека может только владелец бота.',
    'admin.transfer: Переносить участие на новый аккаунт может только владелец бота.',
  ]);
  // Владелец бота в событии Владелицы — гость с правами владельца
  const hers = await fresh(chief);
  const bossDenied = [];
  for (const a of EVENT_ACTIONS) if ((await w.api(boss, a, body(hers), true)).status === 403) bossDenied.push(a);
  assert.deepEqual(bossDenied, []);
  assert.deepEqual(invariants(w), []);
});

test('063: администратору другого события — «Событие не найдено.» на каждом действии события; участнику — «Только для администратора.» (SC-004)', async () => {
  const theirs = await fresh();
  const wrong = [];
  for (const a of EVENT_ACTIONS) {
    const r = await w.api(other, a, body(theirs), true);
    if (r.status !== 404 || r.data.error !== 'Событие не найдено.') wrong.push(`${a}: ${r.status} ${r.data.error}`);
  }
  assert.deepEqual(wrong, []);
  // Событие того же владельца, что и его, — тоже чужое
  const sameOwner = await fresh(chief);
  for (const a of EVENT_ACTIONS) {
    const r = await w.api(other, a, body(sameOwner), true);
    if (r.status !== 404) wrong.push(`${a}: ${r.status} ${r.data.error}`);
  }
  assert.deepEqual(wrong, []);
  // Участник события — «Только для администратора.»
  await join(w, other, await inviteCode(w, boss, theirs));
  for (const a of EVENT_ACTIONS) {
    const r = await w.api(other, a, body(theirs), true);
    if (r.status !== 403 || r.data.error !== 'Только для администратора.') wrong.push(`${a}: ${r.status} ${r.data.error}`);
  }
  assert.deepEqual(wrong, []);
  // Без события — только владелец бота
  for (const a of BOT_ONLY) assert.equal((await w.api(other, a, body(undefined), true)).status, 403, a);
});

test('права: без регистрации — 403, неверная подпись — 401, не POST — 405', async () => {
  const ev = await fresh();
  const me = await w.api(stranger, 'me', {}, true);
  assert.equal(me.status, 200);
  assert.equal(me.data.registered, false);
  for (const a of ['event.get', 'admin.state', 'notify.set']) {
    const r = await w.api(stranger, a, { event: ev, mode: 'off' }, true);
    assert.equal(r.status, 403, a);
    assert.equal(r.data.error, 'Сначала зарегистрируйся по пригласительной ссылке.');
  }
  for (const a of ['me', 'admin.state']) {
    const forged = await w.api(initData(boss, { token: '000000OTHERTOKEN' }), a, { event: ev }, true);
    assert.equal(forged.status, 401, a);
  }
  assert.equal((await w.api('', 'me', {}, true)).status, 401, 'без подписи');
  const get = await w.request('/api/me', { method: 'GET', headers: { 'x-init-data': initData(boss) } });
  assert.equal(get.status, 405);
});

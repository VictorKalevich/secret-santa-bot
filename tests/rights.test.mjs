// Права ролей по всем действиям admin.* (016, FR-1608): участник, админ, владелец — каждое действие на свежем событии.
// Владелец ⊇ админ (Конституция, принцип VII): владельцу ни одного отказа по правам. 051: владелец компании — то же в своей
// компании, кроме admin.transfer (только владелец бота); событие чужой компании — как несуществующее.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';
import { newCompany, ownerByLink } from './support/companies.mjs';
import { ACTIONS as TABLE } from '../src/api.js';

after(restoreFetch);

// Список — из таблицы действий (019, шаг 4 плана рефакторинга)
const ACTIONS = Object.keys(TABLE).filter((a) => a.startsWith('admin.'));

// Действия только владельца — админ получает 403
const OWNER_ONLY = [
  'admin.transfer', 'admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer', 'admin.insert', 'admin.draw.swap.check', 'admin.draw.swap',
  'admin.fixed.add', 'admin.fixed.del', 'admin.draw.cancel.force', 'admin.event.delete', 'admin.vault.person',
  'admin.vault.pairs', 'admin.reset.full',
].sort();

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const member = { id: 101, name: 'Участник', username: 'member' };
const stranger = { id: 7001, name: 'Незнакомец', username: 'stranger' };

// Минимальное тело: без слов подтверждения и без людей — опасные действия получают отказ по данным, а не по правам
const body = (event) => ({ event, id: 0, from: 0, to: 0, giver: 0, receiver: 0 });

let w;
let n = 0;
const fresh = async () => (await w.api(boss, 'admin.events.create', { company: 1, title: 'Права ' + ++n })).event.id;

before(async () => {
  w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = await fresh();
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev })).settings.invite_link)[1];
  for (const u of [adm, member]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { id: adm.id });
});

test('права: список действий admin.* — ровно 48, включая действия с «_»; всего действий — 77 (061)', () => {
  assert.equal(ACTIONS.length, 48, ACTIONS.join(', '));
  assert.equal(Object.keys(TABLE).length, 77);
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

test('права: админу — отказ по правам ровно на действиях владельца', async () => {
  const denied = [];
  for (const a of ACTIONS) {
    const r = await w.api(adm, a, body(await fresh()), true);
    if (r.status === 403) {
      denied.push(a);
      assert.match(r.data.error, /может только владелец бота\.$|^Служебный просмотр доступен только владельцу бота\.$/, a);
    }
  }
  assert.deepEqual(denied.sort(), OWNER_ONLY);
});

test('права: владельцу — ни одного отказа по правам (каждое действие на свежем событии)', async () => {
  const denied = [];
  for (const a of ACTIONS) {
    const r = await w.api(boss, a, body(await fresh()), true);
    if (r.status === 403) denied.push(`${a}: ${r.data.error}`);
  }
  assert.deepEqual(denied, []);
});

test('051: владельцу компании — в своей компании отказ по правам только на admin.transfer; чужое событие — 404', async () => {
  const chief = { id: 9005, name: 'Владелица', username: 'chief' };
  const company = await newCompany(w, boss, 'Своя');
  await ownerByLink(w, boss, company, chief);
  const own = async () => (await w.api(chief, 'admin.events.create', { title: 'Своё ' + ++n })).event.id;
  const denied = [];
  for (const a of ACTIONS) {
    const r = await w.api(chief, a, body(await own()), true);
    if (r.status === 403) denied.push(`${a}: ${r.data.error}`);
  }
  assert.deepEqual(denied, ['admin.transfer: Переносить участие на новый аккаунт может только владелец бота.']);
  const theirs = await fresh();
  const wrong = [];
  for (const a of ACTIONS.filter((x) => TABLE[x].event)) {
    const r = await w.api(chief, a, body(theirs), true);
    if (r.status !== 404 || r.data.error !== 'Событие не найдено.') wrong.push(`${a}: ${r.status} ${r.data.error}`);
  }
  assert.deepEqual(wrong, []);
  // Администратору — прежний список отказов (его компания ведёт владелец бота)
  const denyAdm = [];
  for (const a of ACTIONS) if ((await w.api(adm, a, { ...body(undefined), company: 1, ...(TABLE[a].event ? { event: await fresh() } : {}) }, true)).status === 403) denyAdm.push(a);
  assert.deepEqual(denyAdm.sort(), OWNER_ONLY);
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

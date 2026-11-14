// Права ролей по всем действиям admin.* (016, FR-1608): участник, админ, владелец — каждое действие на свежем событии.
// Владелец ⊇ админ (Конституция, принцип VII): владельцу ни одного отказа по правам.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';

after(restoreFetch);

// После шага 4 плана рефакторинга список берётся из таблицы действий
const source = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');
const ACTIONS = [...new Set([...source.matchAll(/case '(admin\.[a-z._]+)'/g)].map((m) => m[1]))];

// Действия только владельца — админ получает 403
const OWNER_ONLY = [
  'admin.transfer', 'admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer', 'admin.insert',
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
const fresh = async () => (await w.api(boss, 'admin.events.create', { title: 'Права ' + ++n })).event.id;

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

test('права: список действий admin.* — ровно 46, включая действия с «_»', () => {
  assert.equal(ACTIONS.length, 46, ACTIONS.join(', '));
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

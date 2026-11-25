// 037, 064: список участников на «Инфо» (specs/037-info-people/contracts/info-people.md). event.get отдаёт roster: имена,
// роли, организаторов, до жеребьёвки — сколько написали письма, и ссылку-приглашение; @username — у каждого, у кого он
// есть (064: параметра contacts_on нет); ни отметок по людям, ни адресов, ни пар.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const adm2 = { id: 9003, name: 'Второй админ', username: 'adm2' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vera = { id: 103, name: 'Вера', username: '' };
const gena = { id: 104, name: 'Гена', username: 'gena' };
const stranger = { id: 105, name: 'Незнакомец', username: 'stranger' };
const friend = { id: 106, name: 'Друг', username: 'friend' };

// Владелец и два админа; в событии «Список» — владелец, админ и четверо участников, вступали не по алфавиту; второй админ не
// участвует; незнакомец только начал регистрацию
async function world() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const invite = async (id) => /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
  const join = async (u, code) => {
    const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
    await w.say(u, '/start ' + code);
    if (!known) await w.say(u, u.name);
  };
  const E = (await w.api(boss, 'event.create', { participate: false, title: 'Список' })).event.id;
  const code = await invite(E);
  for (const u of [vera, gena, anya, adm, borya, adm2]) await join(u, code);
  await w.api(boss, 'admin.role.grant', { event: E, id: adm.id });
  await w.api(boss, 'admin.role.grant', { event: E, id: adm2.id });
  await w.api(adm2, 'admin.participate', { event: E, on: false });
  await w.api(boss, 'admin.participate', { event: E, on: true });
  await w.say(stranger, '/start ' + code);
  const roster = async (u = anya, event = E) => (await w.api(u, 'event.get', { event })).roster;
  return { w, E, code, invite, join, roster };
}

const keysOf = (rows) => [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();

describe('список участников (037, US1)', () => {
  let z;
  before(async () => {
    z = await world();
    await z.w.api(anya, 'wishlist.save', { event: z.E, text: 'Книгу про горы' });
    await z.w.api(borya, 'wishlist.save', { event: z.E, text: 'Тёплые носки' });
  });

  it('только зарегистрированные, по алфавиту, роли; ключи — id, name, role и @username, у кого он есть (064)', async () => {
    const r = await z.roster();
    assert.deepEqual(r.people.map((p) => p.name), ['Админ', 'Аня', 'Боря', 'Вера', 'Владелец', 'Гена']);
    assert.deepEqual(r.people.map((p) => p.role), ['admin', '', '', '', 'owner', '']);
    assert.deepEqual(r.people.map((p) => p.id), [adm.id, anya.id, borya.id, vera.id, boss.id, gena.id]);
    assert.deepEqual(keysOf(r.people), ['id', 'name', 'role', 'username']);
    assert.deepEqual(r.people.map((p) => p.username), ['adm', 'anya', 'borya', undefined, 'boss', 'gena']);
  });

  it('организаторы бота — владелец первым, остальные по алфавиту (и тот, кто не участвует)', async () => {
    const r = await z.roster();
    assert.deepEqual(r.organizers, [
      { id: boss.id, name: 'Владелец', owner: true, username: 'boss' },
      { id: adm.id, name: 'Админ', owner: false, username: 'adm' },
      { id: adm2.id, name: 'Второй админ', owner: false, username: 'adm2' },
    ]);
  });

  it('до жеребьёвки — письма написали X из N; число участников — как в списке; автожеребьёвка', async () => {
    const { w, E } = z;
    const d = await w.api(anya, 'event.get', { event: E });
    assert.deepEqual(d.roster.progress, { letters: 2, of: 6 });
    assert.equal(d.event.participants, 6);
    assert.equal(d.event.draw_auto_date, '');
    assert.ok(!('contacts_on' in d.event), '064: параметра нет');
    await w.api(adm, 'admin.game', { event: E, draw_auto_date: '2026-12-15' });
    assert.equal((await w.api(anya, 'event.get', { event: E })).event.draw_auto_date, '2026-12-15');
  });

  it('организатор, который не участвует, видит тот же список', async () => {
    assert.deepEqual(await z.roster(adm2), await z.roster(anya));
  });

  it('в данных нет текстов писем, адресов и отметок по людям', async () => {
    const text = JSON.stringify(await z.roster());
    for (const bad of ['Книгу', 'носки', 'wishlist', 'delivery', 'gift', 'seen', 'ready', 'received', 'blocked']) {
      assert.ok(!text.includes(bad), bad);
    }
  });

  it('после жеребьёвки — без сводки (064); вписанный после жеребьёвки — в списке', async () => {
    const { w, E } = z;
    await w.api(boss, 'admin.draw', { event: E });
    assert.equal((await z.roster()).progress, null);
    await w.api(boss, 'admin.registration', { event: E, open: true });
    await z.join(friend, z.code);
    await w.api(boss, 'admin.insert', { event: E, id: friend.id });
    const r = await z.roster();
    assert.equal(r.progress, null);
    assert.equal(r.people.length, 7);
  });
});

describe('@username всегда, параметра «писать друг другу» нет (064)', () => {
  let z;
  before(async () => { z = await world(); });

  it('прежний параметр в запросе сохранения ничего не меняет; образец и сброс — без него', async () => {
    const { w, E } = z;
    await w.api(adm, 'admin.game', { event: E, contacts_on: false });
    assert.ok(!('contacts_on' in (await w.api(adm, 'admin.state', { event: E })).settings));
    assert.equal((await z.roster()).people.find((p) => p.id === anya.id).username, 'anya');
    const copy = (await w.api(boss, 'event.create', { participate: false, title: 'По образцу', from: E })).event;
    assert.ok(!('contacts_on' in copy));
    await w.api(boss, 'admin.reset.full', { event: E, confirm: 'СБРОС' });
    assert.equal((await z.roster(boss)).people.find((p) => p.id === boss.id).username, 'boss');
  });
});

describe('пригласить друга (037, US3)', () => {
  let z;
  before(async () => { z = await world(); });

  it('регистрация открыта — ссылка события; по ней друг вступает', async () => {
    const { w, E } = z;
    const link = (await z.roster()).invite_link;
    assert.equal(link, (await w.api(boss, 'admin.state', { event: E })).settings.invite_link);
    await w.say(friend, '/start ' + /start=(inv_[a-z0-9]+)/.exec(link)[1]);
    await w.say(friend, friend.name);
    assert.equal(w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', E, friend.id).length, 1);
  });

  it('по одобрению — по той же ссылке приходит заявка, а не участие', async () => {
    const { w } = z;
    const F = (await w.api(boss, 'event.create', { participate: false, title: 'С заявками' })).event.id;
    await z.join(anya, await z.invite(F));
    await w.api(boss, 'admin.game', { event: F, approval: true });
    const link = (await z.roster(anya, F)).invite_link;
    await w.say(gena, '/start ' + /start=(inv_[a-z0-9]+)/.exec(link)[1]);
    assert.equal(w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', F, gena.id).length, 0);
    assert.equal(w.query('SELECT 1 FROM join_requests WHERE event_id = ? AND user_id = ?', F, gena.id).length, 1);
  });

  it('регистрация закрыта или событие завершено — ссылки нет', async () => {
    const { w, E } = z;
    await w.api(boss, 'admin.registration', { event: E, open: false });
    assert.equal((await z.roster()).invite_link, '');
    await w.api(boss, 'admin.registration', { event: E, open: true });
    assert.notEqual((await z.roster()).invite_link, '');
    await w.api(boss, 'admin.event.finish', { event: E });
    assert.equal((await z.roster()).invite_link, '');
  });
});

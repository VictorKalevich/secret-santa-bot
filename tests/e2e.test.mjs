// Сквозной тест: локальный Worker (wrangler dev) + имитация Telegram. Сценарии 001–008.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startWorld, initData, waitFor, sleep } from './harness.mjs';
import { BLOCKED_CHAT } from './mock-telegram.mjs';

let w, mock, BASE;
const api = (...a) => w.api(...a);
const say = (...a) => w.say(...a);
const press = (...a) => w.press(...a);
const cron = () => w.cron();
const from = (u) => w.from(u);
const texts = (u) => w.texts(u);
const lastText = (u) => w.lastText(u);

before(async () => {
  w = await startWorld();
  mock = w.mock;
  BASE = w.base;
});

// 009: ни один вызов Worker не должен превышать бюджет внешних запросов бесплатного тарифа
function assertBudget(log) {
  const over = log.split('\n').filter((l) => /budget exceeded/.test(l));
  assert.deepEqual(over, [], 'вызовы сверх бюджета запросов');
}

after(async () => {
  const log = w?.log() || '';
  await w?.stop();
  assertBudget(log);
});

// Люди
const owner = { id: 100, name: 'Дмитрий', username: 'dima' };
const people = [
  { id: 101, name: 'Маша', username: 'masha' },
  { id: 102, name: 'Петя', username: 'petya' },
  { id: 103, name: 'Аня', username: 'anya' },
  { id: 104, name: 'Олег', username: '' },
  { id: 105, name: 'Катя', username: 'katya' },
  { id: 106, name: 'Иван', username: 'ivan' },
];
const [masha, petya, anya, oleg, katya, ivan] = people;
const stranger = { id: 999, name: 'Чужой', username: 'stranger' };
const late = { id: 107, name: 'Света', username: 'sveta' };
const all = [owner, ...people, late];
const byId = Object.fromEntries(all.map((u) => [u.id, u]));
const byName = Object.fromEntries(all.map((u) => [u.name, u]));

let ownerCode;
const ev = {}; // ID эвентов по ключу

const inviteOf = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await api(owner, 'admin.state', { event: eid })).settings.invite_link)[1];

async function pairsOf(eid, users) {
  const m = new Map();
  for (const u of users) {
    const d = await api(u, 'ward.get', { event: eid });
    if (d.state === 'ok') m.set(u.id, byName[d.ward.name].id);
  }
  return m;
}

function assertPermutation(map, ids, exclusions = [], { ring = true } = {}) {
  assert.equal(map.size, ids.length);
  assert.equal(new Set(map.values()).size, ids.length);
  for (const [s, wd] of map) {
    assert.notEqual(s, wd);
    assert.ok(ids.includes(wd));
    for (const [a, b] of exclusions) assert.ok(!(s === a && wd === b), `нарушено исключение ${a}→${b}`);
    if (ring) assert.notEqual(map.get(wd), s, `взаимная пара ${s}⇄${wd} при кольцевой`);
  }
}

test('сквозной сценарий: эвенты, жеребьёвка, переписка, история', { timeout: 300000 }, async (t) => {
  await t.test('настройка /setup и защита webhook', async () => {
    assert.equal((await fetch(`${BASE}/setup?key=wrong`)).status, 403);
    const s = await w.setup();
    assert.match(s.html, /Бот настроен/);
    assert.match(s.html, /Создай эвент/);
    ownerCode = s.adminCode;
    assert.ok(mock.calls.some((c) => c.method === 'setChatMenuButton' && c.params.menu_button.web_app.url.endsWith('/app')));
    assert.equal(await w.update({ message: { message_id: 1, date: 1, from: from(stranger), chat: { id: 999, type: 'private' }, text: '/start' } }, 'bad'), 403);
  });

  await t.test('владелец и первый эвент; закрытая регистрация', async () => {
    await say(owner, '/start ' + ownerCode);
    assert.match(lastText(owner), /владелец бота/);
    await say(owner, owner.name);
    assert.match(texts(owner).join('\n'), /Создай первый эвент/);
    const me = await api(owner, 'me');
    assert.equal(me.me.is_owner, true);
    assert.deepEqual(me.events, []);

    assert.equal((await api(masha, 'admin.events.create', { title: 'Хак' }, true)).status, 403);
    ev.A = (await api(owner, 'admin.events.create', { title: 'Семья 2026' })).event.id;
    const st = await api(owner, 'admin.state', { event: ev.A });
    assert.equal(st.settings.ring, true, 'кольцевая по умолчанию включена');
    assert.equal(st.settings.registration_open, true);

    await say(stranger, '/start');
    assert.match(lastText(stranger), /закрытый бот/);
    await say(stranger, '/start inv_wrongcode');
    assert.match(lastText(stranger), /устарела/);
    assert.equal((await api(stranger, 'me')).registered, false);
  });

  await t.test('US1: вступление по ссылке эвента, имя, письмо', async () => {
    const code = await inviteOf(ev.A);
    for (const p of people) {
      await say(p, '/start ' + code);
      assert.match(lastText(p), /Семья 2026/);
      assert.match(lastText(p), /Как тебя зовут/);
      await say(p, p.name);
    }
    await waitFor(() => texts(owner).filter((x) => /присоединяется к эвенту/.test(x)).length === people.length, 'уведомления владельцу');
    await api(owner, 'admin.participate', { event: ev.A, on: true });
    const me = await api(masha, 'me');
    assert.deepEqual(me.events.map((e) => [e.id, e.member]), [[ev.A, true]]);

    for (const p of [owner, ...people.slice(0, 5)]) {
      await api(p, 'wishlist.save', { event: ev.A, text: `Письмо от ${p.name}: хочу носки и книгу. СЕКРЕТ-${p.id}` });
    }
    const r = await api(masha, 'wishlist.save', { event: ev.A, text: 'я'.repeat(4001) }, true);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /максимум 4000/);
    assert.equal((await api(stranger, 'wishlist.save', { event: ev.A, text: 'x' }, true)).status, 403);
    assert.equal((await api(initData(masha, { token: 'WRONG' }), 'me', {}, true)).status, 401);
    assert.equal((await api(initData(masha, { authDate: Math.floor(Date.now() / 1000) - 2 * 86400 }), 'me', {}, true)).status, 401);
  });

  await t.test('US5: админ видит статусы без содержимого', async () => {
    assert.equal((await api(masha, 'admin.state', { event: ev.A }, true)).status, 403);
    const st = await api(owner, 'admin.state', { event: ev.A });
    assert.ok(!/СЕКРЕТ-/.test(JSON.stringify(st)));
    assert.equal(st.users.find((u) => u.id === ivan.id).has_wishlist, false);
    const wl = await api(owner, 'admin.wishlist', { event: ev.A, id: masha.id });
    assert.match(wl.wishlist, /СЕКРЕТ-101/);
  });

  await t.test('ежедневное напоминание по эвенту — раз в сутки', async () => {
    const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    await api(owner, 'admin.game', { event: ev.A, title: 'Семья 2026', budget: 'до 50 BYN', deadline: today, event_date: '2026-12-27', place: 'У Маши', notes: '' });
    await cron();
    await waitFor(() => texts(ivan).some((x) => /Семья 2026.*пока пустое/s.test(x)), 'напоминание Ивану');
    const n = texts(ivan).length;
    await cron();
    await sleep(300);
    assert.equal(texts(ivan).length, n);
  });

  const exclusions = [[101, 102], [102, 101], [103, 104]];
  let pairs;
  const playersA = [owner, ...people];

  await t.test('US2 + 005: кольцевая жеребьёвка — без взаимных пар', async () => {
    await api(owner, 'admin.exclusion.add', { event: ev.A, giver: 101, receiver: 102, mutual: true });
    await api(owner, 'admin.exclusion.add', { event: ev.A, giver: 103, receiver: 104, mutual: false });
    assert.equal((await api(masha, 'admin.ring', { event: ev.A, on: false }, true)).status, 403, 'участник не меняет настройку');
    const c = await api(owner, 'admin.draw.check', { event: ev.A });
    assert.equal(c.possible, true);
    assert.equal(c.ring, true);
    assert.equal(c.count, 7);
    await api(owner, 'admin.draw', { event: ev.A });
    await waitFor(() => playersA.every((u) => texts(u).some((x) => /Жеребьёвка в эвенте «Семья 2026» проведена/.test(x))), 'уведомления о жеребьёвке');
    assert.equal((await api(owner, 'admin.ring', { event: ev.A, on: false }, true)).status, 400, 'после жеребьёвки кольцевую не менять');
    pairs = await pairsOf(ev.A, playersA);
    assertPermutation(pairs, playersA.map((u) => u.id), exclusions, { ring: true });
    const st = await api(owner, 'admin.state', { event: ev.A });
    assert.ok(!/"(ward|santa|pairs)"/.test(JSON.stringify(st)), 'в admin.state нет пар');
    await say(late, '/start ' + (await inviteOf(ev.A)));
    assert.match(lastText(late), /закрыта/);
  });

  await t.test('US4: уведомление об изменении письма — с названием эвента, без имени', async () => {
    await cron();
    await sleep(300);
    assert.ok(!mock.calls.some((c) => /обновил письмо/.test(c.params.text || '')));
    const wardOfOwner = byId[pairs.get(owner.id)];
    await api(wardOfOwner, 'wishlist.save', { event: ev.A, text: 'Новое письмо: тёплые варежки. СЕКРЕТ-' + wardOfOwner.id });
    await cron();
    await waitFor(() => texts(owner).some((x) => /обновил письмо/.test(x)), 'уведомление Санте');
    const note = mock.messagesTo(owner.id).find((c) => /обновил письмо/.test(c.params.text));
    assert.match(note.params.text, /Семья 2026/);
    assert.ok(!note.params.text.includes(wardOfOwner.name));
    assert.ok(note.params.reply_markup.inline_keyboard[0][0].web_app.url.includes('event=' + ev.A));
    const d = await api(owner, 'ward.get', { event: ev.A });
    assert.notEqual(d.previous, null);
  });

  await t.test('003: переписка в эвенте', async () => {
    const santa = masha;
    const ward = byId[pairs.get(santa.id)];
    await api(santa, 'message.send', { event: ev.A, to: 'ward', text: 'Какой у тебя размер перчаток?' });
    await waitFor(() => texts(ward).some((x) => /размер перчаток/.test(x)), 'сообщение подопечному');
    const q = mock.messagesTo(ward.id).find((c) => /размер перчаток/.test(c.params.text));
    assert.match(q.params.text, /Твой Тайный Санта \(«Семья 2026»\) пишет/);
    assert.ok(!q.params.text.includes(santa.name));
    const kb = q.params.reply_markup.inline_keyboard.flat();
    assert.ok(kb.some((b) => b.callback_data === `msg:santa:${ev.A}`));
    assert.ok(kb.some((b) => b.web_app && b.web_app.url.endsWith(`?event=${ev.A}&chat=santa`)));
    assert.equal((await api(ward, 'event.get', { event: ev.A })).member.unread.from_santa, 1);
    assert.equal((await api(ward, 'me')).events.find((e) => e.id === ev.A).unread, 1);
    const wc = await api(ward, 'chat.get', { event: ev.A, with: 'santa' });
    assert.equal(wc.messages.length, 1);
    assert.ok(!JSON.stringify(wc).includes(santa.name));
    await press(ward, `msg:santa:${ev.A}`);
    await say(ward, 'Размер M');
    await waitFor(() => texts(santa).some((x) => /Размер M/.test(x)), 'ответ Санте');
    const sc = await api(santa, 'chat.get', { event: ev.A, with: 'ward' });
    assert.deepEqual(sc.messages.map((m) => [m.mine, m.text]), [[true, 'Какой у тебя размер перчаток?'], [false, 'Размер M']]);
    assert.equal((await api(santa, 'message.send', { event: ev.A, to: 'ward', text: 'x'.repeat(4001) }, true)).status, 400);
  });

  await t.test('US7: удаление и вписывание с кольцевой — без взаимных пар', async () => {
    const before = pairs;
    await api(owner, 'admin.remove', { event: ev.A, id: ivan.id });
    const rest = playersA.filter((u) => u.id !== ivan.id);
    const after = await pairsOf(ev.A, rest);
    assertPermutation(after, rest.map((u) => u.id), exclusions, { ring: true });
    const changed = [...after].filter(([s, wd]) => before.get(s) !== wd).map(([s]) => s);
    assert.ok(changed.length >= 1 && changed.length <= 3, `изменилось ${changed.length}`);
    await waitFor(() => changed.every((s) => texts(byId[s]).some((x) => /новый подопечный/.test(x))), 'смена подопечного');
    await api(owner, 'admin.registration', { event: ev.A, open: true });
    await say(late, '/start ' + (await inviteOf(ev.A)));
    await say(late, late.name);
    assert.equal((await api(late, 'ward.get', { event: ev.A })).state, 'waiting');
    await api(owner, 'admin.insert', { event: ev.A, id: late.id });
    pairs = await pairsOf(ev.A, [...rest, late]);
    assertPermutation(pairs, [...rest, late].map((u) => u.id), exclusions, { ring: true });
  });

  await t.test('005: параллельный эвент без кольцевой; изоляция', async () => {
    ev.B = (await api(owner, 'admin.events.create', { title: 'Работа' })).event.id;
    const code = await inviteOf(ev.B);
    await say(masha, '/start ' + code);
    assert.match(lastText(masha) + texts(masha).slice(-2).join(), /Ты в эвенте «Работа»/, 'зарегистрированный вступает без имени');
    await say(petya, '/start ' + code);
    await api(masha, 'wishlist.save', { event: ev.B, text: 'Рабочее письмо Маши' });
    assert.match((await api(masha, 'event.get', { event: ev.A })).member.wishlist, /СЕКРЕТ-101/, 'письмо в другом эвенте не изменилось');
    const c = await api(owner, 'admin.draw.check', { event: ev.B });
    assert.equal(c.possible, false);
    assert.match(c.problems.join(), /минимум 3 участника/);
    await api(owner, 'admin.ring', { event: ev.B, on: false });
    await api(owner, 'admin.draw', { event: ev.B });
    const pb = await pairsOf(ev.B, [masha, petya]);
    assert.equal(pb.get(masha.id), petya.id);
    assert.equal(pb.get(petya.id), masha.id, 'без кольцевой взаимная пара допустима');
    // пары эвента A не изменились
    const pa = await pairsOf(ev.A, [masha]);
    assert.equal(pa.get(masha.id), pairs.get(masha.id));
    // Аня не участвует в «Работе»
    assert.equal((await api(anya, 'event.get', { event: ev.B }, true)).status, 403);
    assert.deepEqual((await api(anya, 'me')).events.map((e) => e.id), [ev.A]);
    // владелец не участвует в «Работе», но видит её как админ; пар и переписки не видит
    const oe = await api(owner, 'event.get', { event: ev.B });
    assert.equal(oe.member, null);
    assert.equal((await api(owner, 'ward.get', { event: ev.B }, true)).status, 403);
    assert.equal((await api(owner, 'chat.get', { event: ev.B, with: 'ward' }, true)).status, 403);
    assert.ok((await api(owner, 'me')).events.some((e) => e.id === ev.B && !e.member));
  });

  await t.test('005: завершение эвента и окно переписки 7 дней', async () => {
    await api(masha, 'ward.gift', { event: ev.A, ready: true });
    await api(owner, 'admin.reveal', { event: ev.A });
    await api(owner, 'admin.event.finish', { event: ev.A });
    await waitFor(() => texts(masha).some((x) => /Эвент «Семья 2026» завершён/.test(x)), 'сообщение о завершении');
    const r = await api(masha, 'wishlist.save', { event: ev.A, text: 'поздно' }, true);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /завершён/);
    assert.equal((await api(masha, 'ward.gift', { event: ev.A, ready: false }, true)).status, 400);
    assert.equal((await api(owner, 'admin.draw.check', { event: ev.A }, true)).status, 400, 'менять завершённый нельзя');
    assert.equal((await api(owner, 'admin.reset.full', { event: ev.A, confirm: 'СБРОС' }, true)).status, 400, 'завершённый не сбрасывается');
    const eg = await api(masha, 'event.get', { event: ev.A });
    assert.equal(eg.can.edit_letter, false);
    assert.equal(eg.can.chat_write, true);
    await api(masha, 'message.send', { event: ev.A, to: 'ward', text: 'Спасибо за праздник!' });
    // «перематываем» время: эвент завершён 8 дней назад
    w.sql(`UPDATE events SET finished_at = finished_at - ${8 * 86400000} WHERE id = ${ev.A}`);
    const late2 = await api(masha, 'message.send', { event: ev.A, to: 'ward', text: 'ещё одно' }, true);
    assert.equal(late2.status, 400);
    assert.match(late2.data.error, /только для чтения/);
    const hist = await api(masha, 'chat.get', { event: ev.A, with: 'ward' });
    assert.equal(hist.writable, false);
    assert.ok(hist.messages.some((m) => /Спасибо за праздник/.test(m.text)), 'история читается');
    assert.match((await api(masha, 'event.get', { event: ev.A })).member.wishlist, /СЕКРЕТ-101/, 'письмо в истории');
    const me = await api(masha, 'me');
    assert.deepEqual(me.events.map((e) => [e.id, e.status]).sort(), [[ev.A, 'finished'], [ev.B, 'active']].sort());
    await say(stranger, '/start ' + (await inviteOf(ev.A)));
    assert.match(lastText(stranger), /закрыта/);
  });

  await t.test('005: приглашение из прошлого эвента и «не повторять пары»', async () => {
    ev.C = (await api(owner, 'admin.events.create', { title: 'Семья 2027' })).event.id;
    const inv = await api(owner, 'admin.event.invite_from', { event: ev.C, from: ev.A });
    assert.equal(inv.count, 7, 'пригласили всех участников прошлого эвента (без удалённого Ивана, со Светой)');
    await waitFor(() => texts(anya).some((x) => /Приглашение в эвент «Семья 2027»/.test(x)), 'приглашение');
    const btn = mock.messagesTo(anya.id).find((c) => /Приглашение/.test(c.params.text)).params.reply_markup.inline_keyboard[0][0];
    const code = /start=(inv_[a-z0-9]+)/.exec(btn.url)[1];
    const crew = [owner, masha, petya, anya, oleg, katya, late];
    for (const u of crew) await say(u, '/start ' + code);
    const c = await api(owner, 'admin.draw.check', { event: ev.C });
    // 009: признаков учёта прошлых пар в ответе нет — по ним можно было бы вычислить чужие пары
    assert.ok(!Object.keys(c).some((k) => k.startsWith('history')), 'ответ проверки без history_*');
    await api(owner, 'admin.draw', { event: ev.C });
    const pc = await pairsOf(ev.C, crew);
    assertPermutation(pc, crew.map((u) => u.id), [], { ring: true });
    for (const [s, wd] of pc) assert.notEqual(pairs.get(s), wd, 'пара прошлого эвента не повторилась');
  });

  await t.test('002: роли — владелец назначает и снимает админов', async () => {
    await api(owner, 'admin.role.grant', { id: masha.id });
    await waitFor(() => texts(masha).some((x) => /назначил тебя администратором/.test(x)), 'назначен');
    assert.equal((await api(masha, 'me')).me.is_admin, true);
    assert.ok((await api(masha, 'me')).events.length >= 3, 'админ видит все эвенты');
    assert.equal((await api(masha, 'admin.role.grant', { id: petya.id }, true)).status, 403);
    const del = await api(masha, 'admin.remove', { event: ev.C, id: owner.id }, true);
    assert.equal(del.status, 400);
    await api(owner, 'admin.role.grant', { id: petya.id });
    assert.equal((await api(masha, 'admin.remove', { event: ev.C, id: petya.id }, true)).status, 403);
    await api(owner, 'admin.role.revoke', { id: petya.id });
    assert.equal((await api(petya, 'admin.state', { event: ev.C }, true)).status, 403);
    await api(owner, 'admin.owner.transfer', { id: masha.id });
    assert.equal((await api(masha, 'me')).me.is_owner, true);
    assert.equal((await api(owner, 'admin.role.grant', { id: petya.id }, true)).status, 403);
    await say(owner, '/start ' + ownerCode); // ссылка владельца возвращает права
    assert.equal((await api(owner, 'me')).me.is_owner, true);
    await waitFor(() => texts(masha).some((x) => /Права владельца бота перешли к <b>Дмитрий<\/b>/.test(x)), 'предупреждение');
  });

  await t.test('004/005: перенос аккаунта во всех эвентах', async () => {
    const katya2 = { id: 205, name: 'Катя Новая', username: 'katya_new' };
    byName[katya2.name] = katya2;
    byId[katya2.id] = katya2;
    await api(owner, 'admin.registration', { event: ev.C, open: true });
    await say(katya2, '/start ' + (await inviteOf(ev.C)));
    await say(katya2, katya2.name);
    const crewC = [owner, masha, petya, anya, oleg, katya, late];
    const beforeC = await pairsOf(ev.C, crewC);
    assert.equal((await api(owner, 'admin.transfer', { from: owner.id, to: katya2.id }, true)).status, 400);
    // 006: на аккаунт администратора переносить нельзя — иначе админ получил бы чужие пары
    const wardOfAnya = (await api(anya, 'ward.get', { event: ev.C })).ward?.name;
    const toAdmin = await api(owner, 'admin.transfer', { from: anya.id, to: masha.id }, true);
    assert.equal(toAdmin.status, 400);
    assert.match(toAdmin.data.error, /аккаунт администратора/);
    assert.equal((await api(owner, 'admin.transfer', { from: anya.id, to: owner.id }, true)).status, 400, 'и на свой');
    assert.equal((await api(anya, 'ward.get', { event: ev.C })).ward?.name, wardOfAnya, 'пары Ани на месте');
    await api(owner, 'admin.transfer', { from: katya.id, to: katya2.id });
    await waitFor(() => texts(katya2).some((x) => /перенёс на этот аккаунт/.test(x)), 'сообщение новому аккаунту');
    // 006: перенос не тайный — прежний аккаунт и другие админы узнают о нём
    await waitFor(() => texts(katya).some((x) => /перенесено на аккаунт <b>Катя Новая<\/b>/.test(x)), 'сообщение прежнему аккаунту');
    await waitFor(() => texts(masha).some((x) => /<b>Дмитрий<\/b> перенёс участие <b>Катя<\/b> на аккаунт <b>Катя Новая<\/b>/.test(x)), 'сообщение админу');
    assert.ok(!texts(owner).some((x) => /перенёс участие/.test(x)), 'выполнившему — без уведомления');
    const evs = (await api(katya2, 'me')).events.map((e) => e.id).sort();
    assert.deepEqual(evs, [ev.A, ev.C].sort(), 'история перенесена');
    const afterC = await pairsOf(ev.C, crewC.map((u) => (u.id === katya.id ? katya2 : u)));
    for (const [s, wd] of beforeC) {
      const s1 = s === katya.id ? katya2.id : s;
      const w1 = wd === katya.id ? katya2.id : wd;
      assert.equal(afterC.get(s1), w1, 'пары остальных не изменились');
    }
    assert.match((await api(katya2, 'event.get', { event: ev.A })).member.wishlist, /СЕКРЕТ-105/, 'письмо прошлого эвента');
    assert.equal((await api(katya, 'me')).registered, false);
  });

  await t.test('004/005: сброс одного эвента и удаление эвента', async () => {
    assert.equal((await api(masha, 'admin.reset.full', { event: ev.B, confirm: 'СБРОС' }, true)).status, 403);
    assert.equal((await api(owner, 'admin.reset.full', { event: ev.B, confirm: 'нет' }, true)).status, 400);
    const r = await api(owner, 'admin.reset.full', { event: ev.B, confirm: 'СБРОС' });
    assert.equal(r.removed, 2);
    const st = await api(owner, 'admin.state', { event: ev.B });
    assert.equal(st.users.length, 0);
    assert.equal(st.settings.draw_done, false);
    assert.equal(st.settings.ring, true, 'после сброса — настройки по умолчанию');
    assert.ok(!(await api(masha, 'me')).events.find((e) => e.id === ev.B)?.member, 'Маша больше не в «Работе»');
    assert.equal((await api(masha, 'event.get', { event: ev.C })).member !== null, true, 'другие эвенты не тронуты');
    // удаление
    assert.equal((await api(owner, 'admin.event.delete', { event: ev.B, confirm: 'удалит' }, true)).status, 400);
    await api(owner, 'admin.event.delete', { event: ev.B, confirm: 'УДАЛИТЬ' });
    assert.ok(!(await api(owner, 'me')).events.some((e) => e.id === ev.B));
    assert.equal((await api(owner, 'event.get', { event: ev.B }, true)).status, 404);
  });

  await t.test('очередь: заблокировавший бота не ломает рассылку', async () => {
    const blocked = { id: BLOCKED_CHAT, name: 'Блок', username: 'blk' };
    await api(owner, 'admin.registration', { event: ev.C, open: true });
    await say(blocked, '/start ' + (await inviteOf(ev.C)));
    await say(blocked, blocked.name);
    await api(owner, 'admin.remind.unfilled', { event: ev.C });
    await cron();
    await waitFor(() => mock.messagesTo(BLOCKED_CHAT).some((c) => /Напоминание.*пока пустое/.test(c.params.text)), 'попытка отправки');
    await cron();
    assert.equal(mock.messagesTo(BLOCKED_CHAT).filter((c) => /Напоминание.*пока пустое/.test(c.params.text)).length, 1);
    // 006: админ видит, что человек не получает сообщения; отметка снимается, когда он пишет боту
    const flag = async () => (await api(owner, 'admin.state', { event: ev.C })).users.find((u) => u.id === BLOCKED_CHAT).blocked;
    assert.equal(await flag(), true);
    assert.equal((await api(owner, 'admin.state', { event: ev.C })).users.find((u) => u.id === anya.id).blocked, false);
    await say(blocked, '/start');
    assert.equal(await flag(), false);
  });

  await t.test('006: двойная жеребьёвка, длинное название, раскрытие, мелочи', async () => {
    const longTitle = 'Новогодний обмен подарками отдела маркетинга и всех-всех друзей 2026 🎄🎄🎄🎄';
    assert.ok(longTitle.length >= 76 && longTitle.length <= 80, 'длина названия ' + longTitle.length);
    ev.D = (await api(owner, 'admin.events.create', { title: longTitle })).event.id;
    await api(owner, 'admin.participate', { event: ev.D, on: true });
    const crew = [owner, petya, anya, oleg];
    const code = await inviteOf(ev.D);
    for (const p of crew.slice(1)) await say(p, '/start ' + code);
    // мелочи: исключение и удаление — только участники эвента
    const ex = await api(owner, 'admin.exclusion.add', { event: ev.D, giver: petya.id, receiver: ivan.id }, true);
    assert.equal(ex.status, 400);
    assert.match(ex.data.error, /только между участниками/);
    const ivanBefore = texts(ivan).length;
    const rm = await api(owner, 'admin.remove', { event: ev.D, id: ivan.id }, true);
    assert.equal(rm.status, 400);
    assert.match(rm.data.error, /не участвует/);
    // переименование администратора — только владелец
    assert.equal((await api(masha, 'admin.rename', { id: owner.id, name: 'Взлом' }, true)).status, 403);
    await api(masha, 'admin.rename', { id: masha.id, name: masha.name });
    await api(masha, 'admin.rename', { id: petya.id, name: petya.name });
    assert.equal((await api(masha, 'admin.rename', { id: 424242, name: 'Никто' }, true)).status, 400);

    // двойная жеребьёвка: два одновременных запроса — ровно одна
    const drawn = (u) => texts(u).filter((x) => x.includes('Жеребьёвка в эвенте') && x.includes('отдела маркетинга')).length;
    const [r1, r2] = await Promise.all([
      api(owner, 'admin.draw', { event: ev.D }, true),
      api(masha, 'admin.draw', { event: ev.D }, true),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 400]);
    assert.match((r1.status === 400 ? r1 : r2).data.error, /уже проведена/);
    await waitFor(() => crew.every((u) => drawn(u) === 1), 'уведомления о жеребьёвке');
    await cron();
    await sleep(300);
    assert.ok(crew.every((u) => drawn(u) === 1), 'ровно одно уведомление на участника');
    const pairsD = await pairsOf(ev.D, crew);
    assertPermutation(pairsD, crew.map((u) => u.id), [], { ring: true });

    // длинное название + 4000 символов: уведомление помещается в одно сообщение Telegram
    const ward = byId[pairsD.get(owner.id)];
    const long = 'Ж'.repeat(3990) + ' & <ok>';
    await api(owner, 'message.send', { event: ev.D, to: 'ward', text: long });
    await waitFor(() => texts(ward).some((x) => x.includes('Ж'.repeat(3990))), 'длинное сообщение подопечному');
    const got = texts(ward).find((x) => x.includes('Ж'.repeat(3990)));
    assert.match(got, /Твой Тайный Санта \(«Новогодний обмен подарками отдела.*…»\) пишет/);
    assert.ok(got.includes('&amp; &lt;ok&gt;'), 'текст экранирован');

    // раскрытие — один раз
    await api(owner, 'admin.reveal', { event: ev.D });
    await waitFor(() => texts(ward).some((x) => /Тайна раскрыта/.test(x) && x.includes('отдела маркетинга')), 'раскрытие');
    const again = await api(owner, 'admin.reveal', { event: ev.D }, true);
    assert.equal(again.status, 400);
    assert.match(again.data.error, /уже раскрыта/);
    await cron();
    await sleep(300);
    assert.equal(texts(ward).filter((x) => /Тайна раскрыта/.test(x) && x.includes('отдела маркетинга')).length, 1);
    assert.equal(texts(ivan).length, ivanBefore, 'Ивану (не участнику) — ни одного сообщения');
  });
});

// 006: схема базы — только миграциями. База «как у 005» (миграция 0001 с данными): бот отвечает понятным отказом
// и ничего не трогает; после применения миграций данные на месте.
test('006: миграции — неготовая база и обновление с 005 без потери данных', { timeout: 300000 }, async () => {
  const v5 = fs.readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8') + `
INSERT INTO users (tg_id, name, username, is_admin, registered, created_at) VALUES (300, 'Старожил', 'old', 0, 1, 1);
INSERT INTO events (id, title, created_at, invite_code) VALUES (1, 'Новый год 2025', 1, 'oldcode');
INSERT INTO members (event_id, user_id, wishlist, wishlist_updated_at, joined_at) VALUES (1, 300, 'Письмо из прошлого', 1, 1);
`;
  const oldie = { id: 300, name: 'Старожил', username: 'old' };
  const old = await startWorld({ migrate: false, sqlBefore: v5 });
  try {
    const page = await fetch(old.base + '/');
    assert.equal(page.status, 500);
    assert.match(await page.text(), /База не подготовлена/);
    const r = await old.api(oldie, 'me', {}, true);
    assert.equal(r.status, 500);
    assert.match(r.data.error, /примени миграции/);
    assert.equal((await old.query("SELECT value FROM settings WHERE key = 'schema'"))[0].value, '5', 'база не тронута');
    old.migrate();
    const me = await old.api(oldie, 'me');
    assert.deepEqual(me.events.map((e) => e.title), ['Новый год 2025']);
    const evd = await old.api(oldie, 'event.get', { event: 1 });
    assert.equal(evd.member.wishlist, 'Письмо из прошлого');
  } finally {
    await old.stop();
  }
});

// 007: инструменты организатора — объявления, расписание, «получил», «не открыл», образец, отмена жеребьёвки, журнал.
// Отдельный мир, чтобы автодействия cron не задевали эвенты основного сценария.
test('007: инструменты организатора', { timeout: 300000 }, async (t) => {
  const z = await startWorld();
  const zapi = (...a) => z.api(...a);
  const ztexts = (u) => z.texts(u);
  const boss = { id: 500, name: 'Организатор', username: 'boss' };
  const crew = [
    { id: 501, name: 'Вера', username: 'vera' },
    { id: 502, name: 'Глеб', username: 'gleb' },
    { id: 503, name: 'Дина', username: 'dina' },
    { id: 504, name: 'Егор', username: 'egor' },
  ];
  const [vera, gleb, dina, egor] = crew;
  const zByName = Object.fromEntries([boss, ...crew].map((u) => [u.name, u]));
  const localIso = (plusDays = 0) => new Date(Date.now() + 3 * 3600 * 1000 + plusDays * 86400000).toISOString().slice(0, 10);
  const today = localIso();
  const zInvite = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await zapi(boss, 'admin.state', { event: eid })).settings.invite_link)[1];
  const zPairs = async (eid) => {
    const m = new Map();
    for (const u of crew) {
      const d = await zapi(u, 'ward.get', { event: eid });
      if (d.state === 'ok') m.set(u.id, zByName[d.ward.name].id);
    }
    return m;
  };
  const noPairs = (obj) => assert.ok(!/"(santa|ward)"\s*:/.test(JSON.stringify(obj)), 'в ответе админу нет пар');
  const audit = async (eid) => (await zapi(boss, 'admin.audit', eid ? { event: eid } : {})).entries;
  let E1, E2;

  try {
    await t.test('подготовка: владелец, эвент, 4 участника', async () => {
      const s = await z.setup();
      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      E1 = (await zapi(boss, 'admin.events.create', { title: 'Офис 2026' })).event.id;
      await zapi(boss, 'admin.game', { event: E1, title: 'Офис 2026', budget: 'до 40 BYN', place: 'Переговорка', notes: 'Без алкоголя' });
      const code = await zInvite(E1);
      for (const u of crew) {
        await z.say(u, '/start ' + code);
        await z.say(u, u.name);
        await zapi(u, 'wishlist.save', { event: E1, text: `ТАЙНОЕ-ПИСЬМО-${u.id}` });
      }
      await zapi(boss, 'admin.exclusion.add', { event: E1, giver: vera.id, receiver: gleb.id, mutual: true });
    });

    await t.test('US1: объявление всем участникам и во вкладке «Инфо»', async () => {
      assert.equal((await zapi(vera, 'admin.announce', { event: E1, text: 'взлом' }, true)).status, 403);
      assert.equal((await zapi(boss, 'admin.announce', { event: E1, text: '   ' }, true)).status, 400);
      assert.equal((await zapi(boss, 'admin.announce', { event: E1, text: 'я'.repeat(2001) }, true)).status, 400);
      const r = await zapi(boss, 'admin.announce', { event: E1, text: 'Сбор 28.12 в 18:00 <b>не опаздывать</b> & приносить хорошее настроение' });
      assert.equal(r.count, crew.length);
      for (const u of crew) {
        await waitFor(() => ztexts(u).some((x) => x.includes('📣') && x.includes('Офис 2026')), 'объявление ' + u.name);
        assert.ok(ztexts(u).find((x) => x.includes('📣')).includes('&lt;b&gt;не опаздывать&lt;/b&gt; &amp;'), 'текст экранирован');
      }
      const g = await zapi(dina, 'event.get', { event: E1 });
      assert.equal(g.announcements.length, 1);
      assert.match(g.announcements[0].text, /^Сбор 28\.12/);
      assert.equal(g.announcements[0].author_name, boss.name);
    });

    await t.test('US2: автожеребьёвка в cron, запрет менять дату после жеребьёвки', async () => {
      await zapi(boss, 'admin.game', { event: E1, title: 'Офис 2026', draw_auto_date: today });
      assert.equal((await zapi(boss, 'admin.state', { event: E1 })).settings.draw_auto_date, today);
      await z.cron();
      const st = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(st.settings.draw_done, true, 'жеребьёвка проведена ботом');
      noPairs(st);
      for (const u of crew) await waitFor(() => ztexts(u).some((x) => x.includes('Жеребьёвка в эвенте «Офис 2026»')), 'уведомление о жеребьёвке');
      const a = await audit(E1);
      assert.ok(a.some((e) => e.action === 'draw.auto' && e.actor_name === 'бот'));
      const bad = await zapi(boss, 'admin.game', { event: E1, title: 'Офис 2026', draw_auto_date: localIso(1) }, true);
      assert.equal(bad.status, 400);
      assert.match(bad.data.error, /после жеребьёвки/);
      // та же дата — не изменение
      await zapi(boss, 'admin.game', { event: E1, title: 'Офис 2026', draw_auto_date: today });
    });

    await t.test('US6: отмена жеребьёвки до просмотров; после просмотра — нельзя', async () => {
      const st = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(st.settings.draw_cancelable, true);
      assert.ok(st.users.every((u) => u.ward_seen === false), 'никто не открыл подопечного');
      const r = await zapi(boss, 'admin.draw.cancel', { event: E1 });
      assert.equal(r.count, crew.length);
      for (const u of crew) await waitFor(() => ztexts(u).some((x) => x.includes('отменил жеребьёвку')), 'уведомление об отмене');
      assert.equal((await zapi(vera, 'ward.get', { event: E1 })).state, 'no_draw');
      assert.match((await zapi(vera, 'event.get', { event: E1 })).member.wishlist, /ТАЙНОЕ-ПИСЬМО-501/, 'письмо на месте');
      const after = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(after.settings.draw_done, false);
      assert.equal(after.settings.registration_open, true);
      assert.equal((await zapi(boss, 'admin.draw.cancel', { event: E1 }, true)).data.error, 'Жеребьёвка не проведена.');

      await zapi(boss, 'admin.draw', { event: E1 });
      const before = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(before.users.find((u) => u.id === vera.id).ward_seen, false);
      await zapi(vera, 'ward.get', { event: E1 });
      const seen = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(seen.users.find((u) => u.id === vera.id).ward_seen, true);
      assert.equal(seen.users.find((u) => u.id === gleb.id).ward_seen, false);
      assert.equal(seen.settings.draw_cancelable, false);
      const no = await zapi(boss, 'admin.draw.cancel', { event: E1 }, true);
      assert.equal(no.status, 400);
      assert.match(no.data.error, /уже открыл подопечного/);
    });

    await t.test('US3: «подарок получен» — одно уведомление Санте', async () => {
      const pairs = await zPairs(E1);
      const santaOfDina = [...pairs].find(([, wd]) => wd === dina.id)[0];
      const santa = crew.find((u) => u.id === santaOfDina);
      const got = () => ztexts(santa).filter((x) => x.includes('получил подарок')).length;
      await zapi(dina, 'ward.received', { event: E1, received: true });
      await waitFor(() => got() === 1, 'уведомление Санте');
      assert.ok(!ztexts(santa).find((x) => x.includes('получил подарок')).includes('Дина'), 'без имени подопечного');
      assert.equal((await zapi(dina, 'event.get', { event: E1 })).member.gift_received, true);
      await zapi(dina, 'ward.received', { event: E1, received: false });
      await zapi(dina, 'ward.received', { event: E1, received: true });
      await z.cron();
      await sleep(300);
      assert.equal(got(), 1, 'повторная отметка не шлёт второе уведомление');
      const st = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(st.users.find((u) => u.id === dina.id).gift_received, true);
      assert.equal(st.users.filter((u) => u.gift_received).length, 1);
      noPairs(st);
      assert.equal((await zapi(boss, 'ward.received', { event: E1, received: true }, true)).status, 403, 'не участник');
    });

    await t.test('US2: автожеребьёвка не прошла — админам причина, дата снята', async () => {
      E2 = (await zapi(boss, 'admin.events.create', { title: 'Пустой' })).event.id;
      await zapi(boss, 'admin.participate', { event: E2, on: true });
      await zapi(boss, 'admin.game', { event: E2, title: 'Пустой', draw_auto_date: localIso(-1) });
      await z.cron();
      await waitFor(() => ztexts(boss).some((x) => x.includes('Автожеребьёвка «Пустой» не прошла')), 'сообщение админу');
      const st = await zapi(boss, 'admin.state', { event: E2 });
      assert.equal(st.settings.draw_auto_date, '');
      assert.equal(st.settings.draw_done, false);
      assert.ok((await audit(E2)).some((e) => e.action === 'draw.auto.failed'));
    });

    await t.test('US5: эвент по образцу — параметры, исключения, приглашения', async () => {
      await zapi(boss, 'admin.game', { event: E1, title: 'Офис 2026', budget: 'до 40 BYN', place: 'Переговорка', notes: 'Без алкоголя', reveal_auto: true });
      assert.equal((await zapi(boss, 'admin.events.create', { title: 'X', from: 99999 }, true)).data.error, 'Образец не найден.');
      const r = await zapi(boss, 'admin.events.create', { title: 'Офис 2027', from: E1, invite: true });
      const E3 = r.event.id;
      assert.equal(r.invited, crew.length);
      for (const u of crew) await waitFor(() => ztexts(u).some((x) => x.includes('Приглашение в эвент «Офис 2027»')), 'приглашение');
      let st = await zapi(boss, 'admin.state', { event: E3 });
      assert.equal(st.settings.budget, 'до 40 BYN');
      assert.equal(st.settings.place, 'Переговорка');
      assert.equal(st.settings.notes, 'Без алкоголя');
      assert.equal(st.settings.reveal_auto, true);
      assert.equal(st.settings.event_date, '');
      assert.deepEqual(st.exclusions, [], 'исключения не видны, пока люди не вступили');
      const code = await zInvite(E3);
      await z.say(vera, '/start ' + code);
      st = await zapi(boss, 'admin.state', { event: E3 });
      assert.deepEqual(st.exclusions, []);
      await z.say(gleb, '/start ' + code);
      st = await zapi(boss, 'admin.state', { event: E3 });
      assert.equal(st.exclusions.length, 2, 'исключение заработало, когда вступили оба');
      assert.ok((await audit(E3)).some((e) => e.action === 'event.create' && e.details.includes('Офис 2026')));
    });

    await t.test('US2: авто-раскрытие и автозавершение после даты вручения', async () => {
      await zapi(boss, 'admin.game', { event: E1, title: 'Офис 2026', event_date: localIso(-4), reveal_auto: true, finish_auto: true });
      await z.cron();
      for (const u of crew) await waitFor(() => ztexts(u).some((x) => x.includes('Тайна раскрыта') && x.includes('Офис 2026')), 'раскрытие');
      assert.equal((await zapi(boss, 'admin.state', { event: E1 })).settings.status, 'active', 'за один вызов — одно автодействие');
      await z.cron();
      await waitFor(async () => (await zapi(boss, 'admin.state', { event: E1 })).settings.status === 'finished', 'автозавершение');
      await z.cron();
      await sleep(300);
      for (const u of crew) assert.equal(ztexts(u).filter((x) => x.includes('Тайна раскрыта')).length, 1, 'раскрытие один раз');
    });

    await t.test('US7: журнал — по эвенту и общий, только админам, без писем', async () => {
      await zapi(boss, 'admin.wishlist', { event: E1, id: egor.id });
      const a = await audit(E1);
      const codes = new Set(a.map((e) => e.action));
      for (const c of ['event.create', 'event.settings', 'exclusion.add', 'announce', 'draw.auto', 'draw.cancel', 'draw', 'reveal', 'finish', 'wishlist.view']) {
        assert.ok(codes.has(c), 'в журнале есть ' + c);
      }
      assert.equal(a.filter((e) => e.action === 'announce').length, 1, 'одно действие — одна запись');
      assert.equal(a.find((e) => e.action === 'wishlist.view').details, egor.name);
      assert.equal(a.find((e) => e.action === 'draw').actor_name, boss.name);
      assert.ok(!/ТАЙНОЕ-ПИСЬМО|не опаздывать/.test(JSON.stringify(a)), 'без писем и текстов объявлений');
      noPairs(a);
      assert.equal((await zapi(vera, 'admin.audit', { event: E1 }, true)).status, 403);
      assert.equal((await zapi(vera, 'admin.audit', {}, true)).status, 403);

      await zapi(boss, 'admin.role.grant', { id: vera.id });
      await zapi(boss, 'admin.role.revoke', { id: vera.id });
      const g = await audit(null);
      const gc = g.map((e) => e.action);
      assert.ok(gc.includes('owner.link') && gc.includes('role.grant') && gc.includes('role.revoke'));
      assert.equal(g.find((e) => e.action === 'role.grant').details, vera.name);
      assert.ok(!gc.includes('draw'), 'в общем журнале нет действий эвентов');
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

// 008: адрес доставки, семьи, заявки на вступление. Отдельный мир.
test('008: адрес доставки, семьи, заявки', { timeout: 400000 }, async (t) => {
  const z = await startWorld();
  const zapi = (...a) => z.api(...a);
  const ztexts = (u) => z.texts(u);
  const boss = { id: 600, name: 'Хозяйка', username: 'host' };
  const crew = [
    { id: 601, name: 'Аля', username: 'alya' },
    { id: 602, name: 'Боря', username: 'borya' },
    { id: 603, name: 'Вика', username: 'vika' },
    { id: 604, name: 'Гена', username: 'gena' },
    { id: 605, name: 'Даша', username: 'dasha' },
  ];
  const [alya, borya, vika, gena, dasha] = crew;
  const borya2 = { id: 612, name: 'Боря (новый)', username: 'borya2' };
  const SECRET = 'АДРЕС-СЕКРЕТ-601: Минск, отделение 15';
  const zInvite = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await zapi(boss, 'admin.state', { event: eid })).settings.invite_link)[1];
  const pairsSql = async (eid) => new Map((await z.query(`SELECT santa, ward FROM pairs WHERE event_id = ${eid}`)).map((r) => [r.santa, r.ward]));
  const noSecret = (obj, what) => assert.ok(!JSON.stringify(obj).includes('АДРЕС-СЕКРЕТ'), what + ': без адреса');
  const newEvent = async (title, people, game = {}) => {
    const id = (await zapi(boss, 'admin.events.create', { title })).event.id;
    if (Object.keys(game).length) await zapi(boss, 'admin.game', { event: id, ...game });
    const code = await zInvite(id);
    for (const u of people) await z.say(u, '/start ' + code);
    return id;
  };
  let E1;

  try {
    await t.test('подготовка', async () => {
      const s = await z.setup();
      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      E1 = (await zapi(boss, 'admin.events.create', { title: 'По почте' })).event.id;
      await zapi(boss, 'admin.game', { event: E1, delivery_on: true });
      const code = await zInvite(E1);
      for (const u of crew) { await z.say(u, '/start ' + code); await z.say(u, u.name); }
      // частичное обновление admin.game не стирает остальные параметры
      await zapi(boss, 'admin.game', { event: E1, budget: 'до 30 BYN' });
      await zapi(boss, 'admin.game', { event: E1, approval: false });
      assert.equal((await zapi(boss, 'admin.state', { event: E1 })).settings.budget, 'до 30 BYN');
    });

    await t.test('US1: адрес доставки — сохранение и ограничения', async () => {
      assert.equal((await zapi(alya, 'event.get', { event: E1 })).event.delivery_on, true);
      await zapi(alya, 'delivery.save', { event: E1, text: SECRET });
      for (const u of crew.slice(1)) await zapi(u, 'delivery.save', { event: E1, text: `Адрес ${u.name}` });
      assert.equal((await zapi(alya, 'event.get', { event: E1 })).member.delivery, SECRET);
      const long = await zapi(alya, 'delivery.save', { event: E1, text: 'я'.repeat(501) }, true);
      assert.equal(long.status, 400);
      assert.match(long.data.error, /максимум 500/);
      const off = await newEvent('Без адреса', [alya]);
      assert.equal((await zapi(alya, 'delivery.save', { event: off, text: 'x' }, true)).status, 400);
      // 009: в эвент без адреса доставки адрес не копируется; в эвент с адресом — предзаполняется
      assert.equal((await zapi(alya, 'event.get', { event: off })).member.delivery, '', 'в эвенте без адреса адреса нет');
      assert.equal((await z.query(`SELECT delivery FROM members WHERE event_id = ${off} AND user_id = ${alya.id}`))[0].delivery, '');
      const on = await newEvent('С адресом', [alya], { delivery_on: true });
      assert.equal((await zapi(alya, 'event.get', { event: on })).member.delivery, SECRET, 'новое участие предзаполнено адресом');
      const st = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(st.users.find((u) => u.id === alya.id).has_delivery, true);
      noSecret(st, 'admin.state');
      noSecret(await zapi(boss, 'admin.wishlist', { event: E1, id: alya.id }), 'admin.wishlist');
    });

    await t.test('US2: семьи — управление', async () => {
      assert.equal((await zapi(alya, 'admin.families', {}, true)).status, 403);
      await zapi(boss, 'admin.family.save', { name: 'Ивановы', members: [alya.id, borya.id] });
      const dup = await zapi(boss, 'admin.family.save', { name: 'Петровы', members: [borya.id, vika.id] }, true);
      assert.equal(dup.status, 400);
      assert.match(dup.data.error, /Боря уже в семье «Ивановы»/);
      assert.equal((await zapi(boss, 'admin.family.save', { name: 'Один', members: [vika.id] }, true)).status, 400);
      const f = await zapi(boss, 'admin.families');
      assert.deepEqual(f.families.map((x) => [x.name, x.members.map((m) => m.id).sort()]), [['Ивановы', [alya.id, borya.id]]]);
      const st = await zapi(boss, 'admin.state', { event: E1 });
      assert.equal(st.settings.families_on, true);
      assert.deepEqual(st.families.map((x) => x.members.sort()), [[alya.id, borya.id]]);
    });

    await t.test('US2: 20 жеребьёвок соблюдают семью; замена тоже', async () => {
      for (let i = 0; i < 20; i++) {
        await zapi(boss, 'admin.draw', { event: E1 });
        const p = await pairsSql(E1);
        assert.equal(p.size, 5);
        assert.notEqual(p.get(alya.id), borya.id, `жеребьёвка ${i}: Аля → Боря`);
        assert.notEqual(p.get(borya.id), alya.id, `жеребьёвка ${i}: Боря → Аля`);
        if (i < 19) await zapi(boss, 'admin.draw.cancel', { event: E1 });
      }
      const no = await zapi(boss, 'admin.game', { event: E1, families_on: false }, true);
      assert.equal(no.status, 400);
      assert.match(no.data.error, /правило семей/);
      await zapi(boss, 'admin.remove', { event: E1, id: dasha.id });
      const p = await pairsSql(E1);
      assert.equal(p.size, 4);
      assert.notEqual(p.get(alya.id), borya.id);
      assert.notEqual(p.get(borya.id), alya.id);
    });

    await t.test('US2: понятная причина и выключатель семей', async () => {
      const E3 = await newEvent('Тесно', [alya, borya, vika]);
      let c = await zapi(boss, 'admin.draw.check', { event: E3 });
      assert.equal(c.possible, false);
      assert.match(c.problems[0], /Мешают семьи/);
      await zapi(boss, 'admin.game', { event: E3, families_on: false });
      c = await zapi(boss, 'admin.draw.check', { event: E3 });
      assert.equal(c.possible, true);
    });

    await t.test('US1: Санта видит адрес, админ — нет; уведомление об изменении', async () => {
      const p = await pairsSql(E1);
      const santaId = [...p].find(([, w]) => w === alya.id)[0];
      const santa = crew.find((u) => u.id === santaId);
      const wd = await zapi(santa, 'ward.get', { event: E1 });
      assert.equal(wd.ward.delivery, SECRET);
      const before = ztexts(santa).filter((x) => x.includes('обновил письмо или адрес')).length;
      await zapi(alya, 'delivery.save', { event: E1, text: SECRET + ', подъезд 2' });
      // после 20 жеребьёвок в очереди может быть хвост сообщений — cron отправляет его порциями
      await waitFor(async () => {
        await z.cron();
        return ztexts(santa).filter((x) => x.includes('обновил письмо или адрес')).length === before + 1;
      }, 'уведомление Санте', 20000);
      assert.ok(!ztexts(santa).some((x) => x.includes('подъезд 2')), 'уведомление без текста адреса');
      noSecret(await zapi(boss, 'admin.audit', { event: E1 }), 'журнал');
      noSecret(await zapi(boss, 'admin.state', { event: E1 }), 'admin.state после жеребьёвки');
    });

    await t.test('US2: перенос участия переносит семью', async () => {
      await zapi(boss, 'admin.registration', { event: E1, open: true });
      await z.say(borya2, '/start ' + (await zInvite(E1)));
      await z.say(borya2, borya2.name);
      await zapi(boss, 'admin.transfer', { from: borya.id, to: borya2.id });
      const f = await zapi(boss, 'admin.families');
      assert.deepEqual(f.families[0].members.map((m) => m.id).sort(), [alya.id, borya2.id]);
      const g = (await zapi(boss, 'admin.audit', {})).entries.map((e) => e.action);
      assert.ok(g.includes('family.save'));
    });

    await t.test('US3: заявки — принять кнопкой в чате, отклонить в панели', async () => {
      const newbie = { id: 620, name: 'Новенький', username: 'newbie' };
      const stranger = { id: 621, name: 'Незнакомец', username: 'who' };
      const E4 = (await zapi(boss, 'admin.events.create', { title: 'Закрытый клуб' })).event.id;
      await zapi(boss, 'admin.game', { event: E4, approval: true });
      const code = await zInvite(E4);

      await z.say(newbie, '/start ' + code);
      await z.say(newbie, newbie.name);
      assert.match(z.lastText(newbie), /Заявка в эвент «Закрытый клуб» отправлена/);
      assert.equal((await zapi(newbie, 'event.get', { event: E4 }, true)).status, 403, 'до одобрения не участник');
      await z.say(newbie, '/start ' + code);
      assert.match(z.lastText(newbie), /уже отправлена/);
      await waitFor(() => z.mock.messagesTo(boss.id).some((c) => c.params.text.includes('Новенький') && c.params.text.includes('просится')), 'заявка админу');
      const req = z.mock.messagesTo(boss.id).filter((c) => c.params.text.includes('Новенький') && c.params.text.includes('просится'));
      assert.equal(req.length, 1, 'одна заявка — одно сообщение');
      const accept = req[0].params.reply_markup.inline_keyboard[0][0].callback_data;
      assert.match(accept, /^req:\d+:a$/);
      const st = await zapi(boss, 'admin.state', { event: E4 });
      assert.deepEqual(st.requests.map((r) => r.name), ['Новенький']);

      await z.press(boss, accept);
      await waitFor(() => ztexts(newbie).some((x) => x.includes('Тебя приняли в эвент «Закрытый клуб»')), 'уведомление о приёме');
      assert.ok((await zapi(newbie, 'event.get', { event: E4 })).member);
      await z.press(boss, accept);
      const answers = z.mock.calls.filter((c) => c.method === 'answerCallbackQuery').map((c) => c.params.text);
      assert.equal(answers.at(-1), 'Заявка уже рассмотрена.');
      assert.equal(ztexts(newbie).filter((x) => x.includes('Тебя приняли')).length, 1);

      await z.say(stranger, '/start ' + code);
      await z.say(stranger, stranger.name);
      const st2 = await zapi(boss, 'admin.state', { event: E4 });
      const r2 = st2.requests.find((r) => r.name === stranger.name);
      await zapi(boss, 'admin.request.decide', { event: E4, id: r2.id, approve: false });
      await waitFor(() => ztexts(stranger).some((x) => x.includes('не одобрил заявку')), 'уведомление об отказе');
      assert.equal((await zapi(stranger, 'event.get', { event: E4 }, true)).status, 403);
      assert.equal((await zapi(boss, 'admin.request.decide', { event: E4, id: r2.id, approve: true }, true)).data.error, 'Заявка уже рассмотрена.');
      await z.say(stranger, '/start ' + code);
      assert.match(z.lastText(stranger), /отправлена организатору/, 'после отказа можно подать снова');
      // админ вступает сам, без заявки; участник не может решать заявки
      assert.equal((await zapi(newbie, 'admin.request.decide', { event: E4, id: r2.id, approve: true }, true)).status, 403);
      const codes = (await zapi(boss, 'admin.audit', { event: E4 })).entries.map((e) => e.action);
      assert.ok(codes.includes('request.approve') && codes.includes('request.reject'));
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

// 009: исправления перед первым выкатом — тайна, рассылка, режим ответа, вход, атомарность, перенос.
test('009: исправления перед выкатом', { timeout: 400000 }, async (t) => {
  const z = await startWorld();
  const zapi = (...a) => z.api(...a);
  const ztexts = (u) => z.texts(u);
  const boss = { id: 700, name: 'Ведущий', username: 'lead' };
  const crew = [
    { id: 701, name: 'Женя', username: 'zhenya' },
    { id: 702, name: 'Зоя', username: 'zoya' },
    { id: 703, name: 'Игорь', username: 'igor' },
    { id: 704, name: 'Лиза', username: 'liza' },
    { id: 705, name: 'Миша', username: 'misha' },
  ];
  const [zhenya, zoya, igor, liza, misha] = crew;
  const registered = new Set();
  const zInvite = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await zapi(boss, 'admin.state', { event: eid })).settings.invite_link)[1];
  const pairsSql = async (eid) => new Map((await z.query(`SELECT santa, ward FROM pairs WHERE event_id = ${eid}`)).map((r) => [r.santa, r.ward]));
  // Вступить по ссылке; кто ещё не зарегистрирован — пишет имя
  const join = async (u, code) => {
    await z.say(u, '/start ' + code);
    if (!registered.has(u.id)) {
      await z.say(u, u.name);
      registered.add(u.id);
    }
  };
  const newEvent = async (title, people, game = {}) => {
    const id = (await zapi(boss, 'admin.events.create', { title })).event.id;
    if (Object.keys(game).length) await zapi(boss, 'admin.game', { event: id, ...game });
    const code = await zInvite(id);
    for (const u of people) await join(u, code);
    return id;
  };
  let E1;

  try {
    await t.test('подготовка', async () => {
      const s = await z.setup();
      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      registered.add(boss.id);
      E1 = await newEvent('Тайна', crew);
    });

    await t.test('тайна: исключения и семьи после жеребьёвки заморожены, себя не вписать', async () => {
      await zapi(boss, 'admin.exclusion.add', { event: E1, giver: zhenya.id, receiver: zoya.id });
      await zapi(boss, 'admin.draw', { event: E1 });
      for (const action of ['admin.exclusion.add', 'admin.exclusion.del']) {
        const r = await zapi(boss, action, { event: E1, giver: zhenya.id, receiver: zoya.id }, true);
        assert.equal(r.status, 400, action);
        assert.match(r.data.error, /После жеребьёвки исключения не меняются/);
      }
      const add2 = await zapi(boss, 'admin.exclusion.add', { event: E1, giver: igor.id, receiver: liza.id, mutual: true }, true);
      assert.equal(add2.status, 400);
      assert.deepEqual((await zapi(boss, 'admin.state', { event: E1 })).exclusions, [{ giver: zhenya.id, receiver: zoya.id }]);

      // семья из двух участников идущего эвента с жеребьёвкой — нельзя
      const fam = await zapi(boss, 'admin.family.save', { name: 'Пара', members: [zhenya.id, zoya.id] }, true);
      assert.equal(fam.status, 400);
      assert.match(fam.data.error, /Состав семьи нельзя менять, пока идёт эвент «Тайна»/);
      // в эвенте только один член семьи — исключения там не меняются, можно
      await zapi(boss, 'admin.family.save', { name: 'Родня', members: [zhenya.id, boss.id] });
      let f = (await zapi(boss, 'admin.families')).families.find((x) => x.name === 'Родня');
      await zapi(boss, 'admin.family.save', { id: f.id, name: 'Родные', members: [zhenya.id, boss.id] }); // переименование
      const grow = await zapi(boss, 'admin.family.save', { id: f.id, name: 'Родные', members: [zhenya.id, boss.id, zoya.id] }, true);
      assert.equal(grow.status, 400, 'добавить второго участника эвента в семью нельзя');
      assert.equal((await zapi(boss, 'admin.family.delete', { id: f.id })).ok, true, 'в эвенте один член семьи — удалить можно');

      // вписать себя нельзя
      const self = await zapi(boss, 'admin.insert', { event: E1, id: boss.id }, true);
      assert.equal(self.status, 400);
      assert.match(self.data.error, /Вписать себя нельзя/);

      // проверка жеребьёвки без признаков учёта прошлых пар
      const E2 = await newEvent('Снова', crew);
      const c = await zapi(boss, 'admin.draw.check', { event: E2 });
      assert.equal(c.possible, true);
      assert.deepEqual(Object.keys(c).sort(), ['count', 'empty_wishlists', 'ok', 'possible', 'problems', 'ring']);
      const d = await zapi(boss, 'admin.draw', { event: E2 });
      assert.ok(!('history_ignored' in d));
      await zapi(boss, 'admin.draw.cancel', { event: E2 });
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

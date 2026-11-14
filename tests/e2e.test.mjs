// Сквозной тест: локальный Worker (wrangler dev) + имитация Telegram. Сценарии 001–008.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startWorld, initData, waitFor, sleep, ADMIN_SECRET } from './harness.mjs';
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
    // 010: ключ — только формой; адрес с ключом показывает форму и ничего не настраивает
    const get = await fetch(`${BASE}/setup?key=${ADMIN_SECRET}`);
    assert.equal(get.status, 200);
    assert.match(await get.text(), /<form method="post"/);
    assert.ok(!mock.calls.some((c) => c.method === 'setWebhook'), 'ключ из адреса не принят');
    assert.equal((await w.setup('wrong-key-123')).status, 403);
    const s = await w.setup();
    assert.match(s.html, /Бот настроен/);
    assert.match(s.html, /Создай событие/);
    ownerCode = s.adminCode;
    assert.ok(mock.calls.some((c) => c.method === 'setChatMenuButton' && c.params.menu_button.web_app.url.endsWith('/app')));
    assert.equal(await w.update({ message: { message_id: 1, date: 1, from: from(stranger), chat: { id: 999, type: 'private' }, text: '/start' } }, 'bad'), 403);
  });

  await t.test('владелец и первый эвент; закрытая регистрация', async () => {
    await say(owner, '/start ' + ownerCode);
    assert.match(lastText(owner), /владелец бота/);
    await say(owner, owner.name);
    assert.match(texts(owner).join('\n'), /Создай первое событие/);
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
    await waitFor(() => texts(owner).filter((x) => /присоединяется к событию/.test(x)).length === people.length, 'уведомления владельцу');
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
    await waitFor(() => playersA.every((u) => texts(u).some((x) => /Жеребьёвка в событии «Семья 2026» проведена/.test(x))), 'уведомления о жеребьёвке');
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
    assert.match(lastText(masha) + texts(masha).slice(-2).join(), /Ты в событии «Работа»/, 'зарегистрированный вступает без имени');
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
    await waitFor(() => texts(masha).some((x) => /Событие «Семья 2026» завершено/.test(x)), 'сообщение о завершении');
    const r = await api(masha, 'wishlist.save', { event: ev.A, text: 'поздно' }, true);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /завершено/);
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
    await waitFor(() => texts(anya).some((x) => /Приглашение на событие «Семья 2027»/.test(x)), 'приглашение');
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
    // 010: ссылка владельца одноразовая — повторный переход владельца не меняет
    await say(owner, '/start ' + ownerCode);
    assert.ok(texts(owner).slice(-2).some((x) => /Ссылка владельца уже использована/.test(x)), 'отказ (и меню следом)');
    assert.equal((await api(masha, 'me')).me.is_owner, true, 'владелец не сменился');
    // Смена ADMIN_SECRET делает отметку «использована» чужой — здесь так же, без перезапуска Worker
    w.sql("UPDATE settings SET value = 'old-secret' WHERE key = 'owner_link_used'");
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
    const drawn = (u) => texts(u).filter((x) => x.includes('Жеребьёвка в событии') && x.includes('отдела маркетинга')).length;
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
      for (const u of crew) await waitFor(() => ztexts(u).some((x) => x.includes('Жеребьёвка в событии «Офис 2026»')), 'уведомление о жеребьёвке');
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
      for (const u of crew) await waitFor(() => ztexts(u).some((x) => x.includes('Приглашение на событие «Офис 2027»')), 'приглашение');
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
      assert.match(z.lastText(newbie), /Заявка на участие в событии «Закрытый клуб» отправлена/);
      assert.equal((await zapi(newbie, 'event.get', { event: E4 }, true)).status, 403, 'до одобрения не участник');
      await z.say(newbie, '/start ' + code);
      assert.match(z.lastText(newbie), /уже отправлена/);
      await waitFor(() => z.mock.messagesTo(boss.id).some((c) => c.params.text.includes('Новенький') && c.params.text.includes('хочет участвовать')), 'заявка админу');
      const req = z.mock.messagesTo(boss.id).filter((c) => c.params.text.includes('Новенький') && c.params.text.includes('хочет участвовать'));
      assert.equal(req.length, 1, 'одна заявка — одно сообщение');
      const accept = req[0].params.reply_markup.inline_keyboard[0][0].callback_data;
      assert.match(accept, /^req:\d+:a$/);
      const st = await zapi(boss, 'admin.state', { event: E4 });
      assert.deepEqual(st.requests.map((r) => r.name), ['Новенький']);

      await z.press(boss, accept);
      await waitFor(() => ztexts(newbie).some((x) => x.includes('Заявка одобрена — ты в событии «Закрытый клуб»')), 'уведомление о приёме');
      assert.ok((await zapi(newbie, 'event.get', { event: E4 })).member);
      await z.press(boss, accept);
      const answers = z.mock.calls.filter((c) => c.method === 'answerCallbackQuery').map((c) => c.params.text);
      assert.equal(answers.at(-1), 'Заявка уже рассмотрена.');
      assert.equal(ztexts(newbie).filter((x) => x.includes('Заявка одобрена')).length, 1);

      await z.say(stranger, '/start ' + code);
      await z.say(stranger, stranger.name);
      const st2 = await zapi(boss, 'admin.state', { event: E4 });
      const r2 = st2.requests.find((r) => r.name === stranger.name);
      await zapi(boss, 'admin.request.decide', { event: E4, id: r2.id, approve: false });
      await waitFor(() => ztexts(stranger).some((x) => x.includes('не одобрил заявку')), 'уведомление об отказе');
      assert.equal((await zapi(stranger, 'event.get', { event: E4 }, true)).status, 403);
      assert.equal((await zapi(boss, 'admin.request.decide', { event: E4, id: r2.id, approve: true }, true)).data.error, 'Заявка уже рассмотрена.');
      // 009: после отказа — сутки без новых заявок (админов не засыпать); потом можно снова
      const asks = () => z.mock.messagesTo(boss.id).filter((c) => c.params.text.includes('Незнакомец') && c.params.text.includes('хочет участвовать')).length;
      const asked = asks();
      await z.say(stranger, '/start ' + code);
      assert.match(z.lastText(stranger), /Организатор не одобрил заявку на участие в событии «Закрытый клуб»/);
      assert.deepEqual((await zapi(boss, 'admin.state', { event: E4 })).requests.map((r) => r.name), [], 'новой заявки нет');
      await sleep(300);
      assert.equal(asks(), asked, 'админу ничего');
      z.sql(`UPDATE join_requests SET decided_at = decided_at - ${25 * 3600e3} WHERE id = ${r2.id}`);
      await z.say(stranger, '/start ' + code);
      assert.match(z.lastText(stranger), /отправлена организатору/, 'через сутки после отказа можно подать снова');
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
  // 010: заморозки 009 действуют на админов, владелец (boss) от них освобождён — проверяем от имени админа
  const helper = { id: 709, name: 'Помощник', username: 'helper009' };
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
  let E1, E6;

  try {
    await t.test('подготовка', async () => {
      const s = await z.setup();
      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      registered.add(boss.id);
      E1 = await newEvent('Тайна', crew);
      await newEvent('Штаб', [helper]);
      await zapi(boss, 'admin.role.grant', { id: helper.id });
    });

    await t.test('тайна: админу исключения и семьи после жеребьёвки заморожены, себя не вписать', async () => {
      await zapi(boss, 'admin.exclusion.add', { event: E1, giver: zhenya.id, receiver: zoya.id });
      await zapi(boss, 'admin.draw', { event: E1 });
      for (const action of ['admin.exclusion.add', 'admin.exclusion.del']) {
        const r = await zapi(helper, action, { event: E1, giver: zhenya.id, receiver: zoya.id }, true);
        assert.equal(r.status, 400, action);
        assert.match(r.data.error, /После жеребьёвки исключения не меняются/);
      }
      const add2 = await zapi(helper, 'admin.exclusion.add', { event: E1, giver: igor.id, receiver: liza.id, mutual: true }, true);
      assert.equal(add2.status, 400);
      assert.deepEqual((await zapi(boss, 'admin.state', { event: E1 })).exclusions, [{ giver: zhenya.id, receiver: zoya.id }]);

      // семья из двух участников идущего эвента с жеребьёвкой — нельзя
      const fam = await zapi(helper, 'admin.family.save', { name: 'Пара', members: [zhenya.id, zoya.id] }, true);
      assert.equal(fam.status, 400);
      assert.match(fam.data.error, /Состав семьи нельзя менять, пока идёт событие «Тайна»/);
      // в эвенте только один член семьи — исключения там не меняются, можно
      await zapi(helper, 'admin.family.save', { name: 'Родня', members: [zhenya.id, boss.id] });
      let f = (await zapi(helper, 'admin.families')).families.find((x) => x.name === 'Родня');
      await zapi(helper, 'admin.family.save', { id: f.id, name: 'Родные', members: [zhenya.id, boss.id] }); // переименование
      const grow = await zapi(helper, 'admin.family.save', { id: f.id, name: 'Родные', members: [zhenya.id, boss.id, zoya.id] }, true);
      assert.equal(grow.status, 400, 'добавить второго участника эвента в семью нельзя');
      assert.equal((await zapi(helper, 'admin.family.delete', { id: f.id })).ok, true, 'в эвенте один член семьи — удалить можно');

      // вписать себя нельзя: вписывает только владелец (012)
      const self = await zapi(helper, 'admin.insert', { event: E1, id: helper.id }, true);
      assert.equal(self.status, 403);
      assert.match(self.data.error, /только владелец бота/);

      // проверка жеребьёвки без признаков учёта прошлых пар
      const E2 = await newEvent('Снова', crew);
      const c = await zapi(boss, 'admin.draw.check', { event: E2 });
      assert.equal(c.possible, true);
      assert.deepEqual(Object.keys(c).sort(), ['count', 'empty_wishlists', 'ok', 'possible', 'problems', 'ring']);
      const d = await zapi(boss, 'admin.draw', { event: E2 });
      assert.ok(!('history_ignored' in d));
      await zapi(boss, 'admin.draw.cancel', { event: E2 });
    });

    await t.test('рассылка: три эвента с напоминаниями в один день — каждому ровно одно', async () => {
      const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
      const titles = ['Утро', 'День', 'Вечер'];
      for (const title of titles) await newEvent(title, crew.slice(0, 4), { deadline: today });
      const reminders = (u, title) => ztexts(u).filter((x) => x.includes('пока пустое') && x.includes(`«${title}»`)).length;
      await waitFor(async () => {
        await z.cron();
        return crew.slice(0, 4).every((u) => titles.every((title) => reminders(u, title) === 1));
      }, 'напоминания по трём эвентам', 20000);
      for (let i = 0; i < 3; i++) await z.cron();
      await sleep(300);
      for (const u of crew.slice(0, 4)) for (const title of titles) assert.equal(reminders(u, title), 1, `${u.name}: «${title}»`);
      // меню человека в пяти идущих эвентах и вступление в шестой — в пределах бюджета (проверка журнала в конце)
      await z.say(zhenya, '/start');
      assert.match(z.lastText(zhenya), /Твои события/);
      E6 = (await zapi(boss, 'admin.events.create', { title: 'Шестой 🎄🎄 с длинным-предлинным названием, чтобы обрезать кнопки меню' })).event.id;
      await z.say(zhenya, '/start ' + (await zInvite(E6)));
      assert.match(z.lastText(zhenya), /Твои события/);
    });

    await t.test('режим ответа: команда, истечение, смена пары, отказ нажатия', async () => {
      const santa = zhenya;
      const byIdZ = Object.fromEntries(crew.map((u) => [u.id, u]));
      let ward = byIdZ[(await pairsSql(E1)).get(santa.id)];
      const got = (u, text) => ztexts(u).some((x) => x.includes(text));
      const shiftReplyTime = async (u, ms) => {
        const [{ pending }] = await z.query(`SELECT pending FROM users WHERE tg_id = ${u.id}`);
        assert.match(pending, /^msg_ward:\d+:\d+:\d+$/);
        z.sql(`UPDATE users SET pending = '${pending.replace(/:\d+$/, ':' + (Date.now() - ms))}' WHERE tg_id = ${u.id}`);
      };

      // команда выключает режим ответа: следующий текст — не в переписку
      await z.press(santa, `msg:ward:${E1}`);
      assert.match(z.lastText(santa), /в течение часа/);
      await z.say(santa, '/start');
      await z.say(santa, 'Случайный текст после команды');
      assert.match(z.lastText(santa), /Твои события/);

      // прошло больше часа — не отправлено
      await z.press(santa, `msg:ward:${E1}`);
      await shiftReplyTime(santa, 2 * 3600e3);
      await z.say(santa, 'Текст через два часа');
      assert.match(z.lastText(santa), /Время ответа истекло — сообщение не отправлено/);

      // пара сменилась после нажатия — не отправлено ни прежнему, ни новому подопечному
      await z.press(santa, `msg:ward:${E1}`);
      const oldWard = ward;
      await zapi(boss, 'admin.remove', { event: E1, id: oldWard.id });
      ward = byIdZ[(await pairsSql(E1)).get(santa.id)];
      assert.notEqual(ward.id, oldWard.id);
      await z.say(santa, 'Текст после смены пары');
      assert.match(z.lastText(santa), /Пара изменилась после нажатия «Ответить» — сообщение не отправлено/);

      // отклонённое нажатие сбрасывает прежний режим
      await z.press(santa, `msg:ward:${E1}`);
      await z.press(santa, `msg:santa:${E6}`); // в E6 жеребьёвки нет
      await z.say(santa, 'Текст после отказа');
      assert.match(z.lastText(santa), /Твои события/);

      // обычный ответ доставляется
      await z.press(santa, `msg:ward:${E1}`);
      await z.say(santa, 'Обычный ответ подопечному');
      assert.match(z.lastText(santa), /Отправлено подопечному/);
      await waitFor(() => got(ward, 'Обычный ответ подопечному'), 'ответ новому подопечному');
      await sleep(300);
      for (const text of ['Случайный текст после команды', 'Текст через два часа', 'Текст после смены пары', 'Текст после отказа']) {
        assert.ok(!crew.some((u) => got(u, text)), `«${text}» никому не ушло`);
      }
      assert.equal((await z.query(`SELECT COUNT(*) AS n FROM messages WHERE event_id = ${E1}`))[0].n, 1, 'в переписке только обычный ответ');
    });

    await t.test('вход: повторная ссылка, удалённый до имени, меню с эмодзи', async () => {
      // участник после жеребьёвки и закрытия регистрации открывает ссылку снова
      await z.say(zoya, '/start ' + (await zInvite(E1)));
      assert.ok(ztexts(zoya).slice(-2).some((x) => x.includes('Ты уже участвуешь в событии «Тайна»')));
      assert.match(z.lastText(zoya), /Твои события/);

      // новичка удалили до ввода имени и закрыли регистрацию: «закрыта», админу — никакого «присоединяется»
      const nina = { id: 710, name: 'Нина', username: 'nina' };
      const E7 = (await zapi(boss, 'admin.events.create', { title: 'Открытый' })).event.id;
      await z.say(nina, '/start ' + (await zInvite(E7)));
      assert.match(z.lastText(nina), /Как тебя зовут/);
      await zapi(boss, 'admin.remove', { event: E7, id: nina.id });
      await zapi(boss, 'admin.registration', { event: E7, open: false });
      await z.say(nina, nina.name);
      assert.ok(ztexts(nina).some((x) => x.includes('Регистрация на событие «Открытый» закрыта')));
      assert.ok(ztexts(nina).some((x) => /не участвуешь/.test(x)), 'меню после отказа');
      assert.equal((await zapi(nina, 'event.get', { event: E7 }, true)).status, 403);
      await sleep(300);
      assert.ok(!ztexts(boss).some((x) => x.includes('Нина') && x.includes('присоединяется')), 'админу без «присоединяется»');

      // эмодзи на границе обрезки кнопки: меню доставляется (имитация Telegram отвергает разорванные эмодзи)
      const title = 'А'.repeat(43) + '🎄🎄 Ёлка';
      const E8 = await newEvent(title, [zhenya, zoya, igor]);
      await zapi(boss, 'admin.draw', { event: E8 });
      await z.say(igor, '/start');
      const menu = z.mock.messagesTo(igor.id).at(-1).params;
      const buttons = menu.reply_markup.inline_keyboard.flat();
      assert.ok(buttons.some((b) => b.callback_data === `msg:ward:${E8}`), 'кнопка переписки нового эвента');
      assert.ok(buttons.every((b) => b.text.isWellFormed()), 'без разорванных эмодзи');
      assert.ok(!/Telegram API error sendMessage 400/.test(z.log()), 'Telegram не отверг ни одного сообщения');
    });

    await t.test('атомарность: одновременные удаления, раскрытия и завершения', async () => {
      const E9 = await newEvent('Гонка', crew);
      await zapi(boss, 'admin.draw', { event: E9 });

      // два удаления сразу: каждое либо проходит, либо просит повторить — пары не затирают друг друга
      let left = [liza, misha];
      for (let round = 0; left.length && round < 5; round++) {
        const rs = await Promise.all(left.map((u) => zapi(boss, 'admin.remove', { event: E9, id: u.id }, true)));
        rs.forEach((r) => r.status === 200 || assert.match(r.data.error, /Пары изменились одновременно/));
        left = left.filter((u, i) => rs[i].status !== 200);
      }
      assert.equal(left.length, 0, 'оба удалены (с повтором)');
      const rest = [zhenya, zoya, igor];
      assertPermutation(await pairsSql(E9), rest.map((u) => u.id));

      // два раскрытия и два завершения сразу: успешно одно, второе — ошибка; каждому по одному сообщению
      const reveals = await Promise.all([1, 2].map(() => zapi(boss, 'admin.reveal', { event: E9 }, true)));
      assert.deepEqual(reveals.map((r) => r.status).sort(), [200, 400]);
      assert.match(reveals.find((r) => r.status === 400).data.error, /Тайна уже раскрыта/);
      const finishes = await Promise.all([1, 2].map(() => zapi(boss, 'admin.event.finish', { event: E9 }, true)));
      assert.deepEqual(finishes.map((r) => r.status).sort(), [200, 400]);
      assert.match(finishes.find((r) => r.status === 400).data.error, /завершено/);

      const count = (u, re) => ztexts(u).filter((x) => x.includes('«Гонка»') && re.test(x)).length;
      await waitFor(
        () => rest.every((u) => count(u, /Тайна раскрыта/) && count(u, /завершено/)) && [liza, misha].every((u) => count(u, /удалил тебя/)),
        'раскрытие, завершение и удаление дошли', 20000
      );
      await z.cron();
      await sleep(300);
      for (const u of rest) {
        assert.equal(count(u, /Тайна раскрыта/), 1, `${u.name}: одно раскрытие`);
        assert.equal(count(u, /завершено/), 1, `${u.name}: одно завершение`);
      }
      for (const u of [liza, misha]) assert.equal(count(u, /удалил тебя/), 1, `${u.name}: одно уведомление об удалении`);
      const audit = await z.query(`SELECT action, COUNT(*) AS n FROM audit WHERE event_id = ${E9} GROUP BY action`);
      const n = Object.fromEntries(audit.map((r) => [r.action, r.n]));
      assert.deepEqual([n.reveal, n.finish, n['member.remove']], [1, 1, 2], 'в журнале по одной записи на действие');
    });

    await t.test('перенос: адрес нового аккаунта сохраняется, пустой — заменяется старым', async () => {
      const EA = await newEvent('Почта А', [igor], { delivery_on: true });
      const EB = await newEvent('Почта Б', [igor], { delivery_on: true });
      await zapi(igor, 'delivery.save', { event: EA, text: 'Старый адрес А' });
      await zapi(igor, 'delivery.save', { event: EB, text: 'Старый адрес Б' });
      const igor2 = { id: 706, name: 'Игорь', username: 'igor2' };
      await join(igor2, await zInvite(EB)); // в Б — без адреса
      await join(igor2, await zInvite(EA));
      await zapi(igor2, 'delivery.save', { event: EA, text: 'Новый адрес' });
      await zapi(boss, 'admin.transfer', { from: igor.id, to: igor2.id });
      assert.equal((await zapi(igor2, 'event.get', { event: EA })).member.delivery, 'Новый адрес');
      assert.equal((await zapi(igor2, 'event.get', { event: EB })).member.delivery, 'Старый адрес Б');
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

// 010: права владельца — настройка, служебный просмотр, освобождения, закрытый набор, возврат удалённых, удаление.
test('010: права владельца', { timeout: 400000 }, async (t) => {
  const z = await startWorld();
  const zapi = (...a) => z.api(...a);
  const ztexts = (u) => z.texts(u);
  const boss = { id: 800, name: 'Хозяин', username: 'host' };
  const helper = { id: 801, name: 'Админ', username: 'admin010' };
  const anya = { id: 802, name: 'Аня', username: 'anya010' };
  const borya = { id: 803, name: 'Боря', username: 'borya010' };
  const vera = { id: 804, name: 'Вера', username: 'vera010' };
  const gena = { id: 805, name: 'Гена', username: 'gena010' };
  const dasha = { id: 806, name: 'Даша', username: 'dasha010' };
  const eva = { id: 807, name: 'Ева', username: 'eva010' };
  const anya2 = { id: 808, name: 'Аня', username: 'anya_new010' };
  const zhora = { id: 809, name: 'Жора', username: 'zhora010' };
  const registered = new Set();
  const zInvite = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await zapi(boss, 'admin.state', { event: eid })).settings.invite_link)[1];
  const pairsSql = async (eid) => new Map((await z.query(`SELECT santa, ward FROM pairs WHERE event_id = ${eid}`)).map((r) => [r.santa, r.ward]));
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
  let E;

  try {
    await t.test('настройка: ключ формой, одноразовая ссылка владельца, блокировка до смены секрета', async () => {
      const get = await fetch(`${z.base}/setup?key=${ADMIN_SECRET}`);
      assert.equal(get.status, 200);
      assert.equal(get.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(get.headers.get('cache-control'), 'no-store');
      assert.ok(!(await get.text()).includes('adm_'), 'по ключу из адреса ссылки нет');
      assert.ok(!z.mock.calls.some((c) => c.method === 'setWebhook'), 'и настройки нет');
      assert.equal((await z.setup('wrong-key-123')).status, 403);

      const s = await z.setup();
      assert.equal(s.status, 200);
      assert.match(s.html, /срабатывает один раз/);
      assert.equal(s.headers.get('referrer-policy'), 'no-referrer');
      assert.equal((await z.setup()).adminCode, s.adminCode, 'пока ссылку не использовали, страница работает повторно');

      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      registered.add(boss.id);
      assert.equal((await zapi(boss, 'me')).me.is_owner, true);

      // второй переход — отказ, владелец не меняется, запись не создаётся
      await z.say(zhora, '/start ' + s.adminCode);
      assert.equal(z.lastText(zhora), 'Ссылка владельца уже использована. Чтобы получить новую — смени ADMIN_SECRET и снова открой страницу настройки.');
      assert.equal((await zapi(zhora, 'me')).registered, false);
      assert.equal((await zapi(boss, 'me')).me.is_owner, true);

      const locked = await z.setup();
      assert.equal(locked.status, 423);
      assert.match(locked.html, /Страница заблокирована/);
      assert.ok(!locked.html.includes('adm_'), 'ссылка не показывается');

      // смена ADMIN_SECRET: отметка «использована» относится к старому секрету — страница снова работает
      z.sql("UPDATE settings SET value = 'old-secret' WHERE key = 'owner_link_used'");
      const unlocked = await z.setup();
      assert.equal(unlocked.status, 200);
      await z.say(boss, '/start ' + unlocked.adminCode);
      assert.equal((await z.setup()).status, 423, 'после перехода снова заблокирована');
    });

    await t.test('подготовка', async () => {
      E = await newEvent('База', [helper, anya, borya, vera, gena, dasha]);
      await zapi(boss, 'admin.role.grant', { id: helper.id });
    });

    await t.test('перенос участия — только владелец', async () => {
      await join(anya2, await zInvite(E));
      const r = await zapi(helper, 'admin.transfer', { from: anya.id, to: anya2.id }, true);
      assert.equal(r.status, 403);
      assert.equal(r.data.error, 'Переносить участие на новый аккаунт может только владелец бота.');
      assert.ok((await zapi(anya, 'event.get', { event: E })).member, 'ничего не изменилось');
    });

    await t.test('служебный просмотр: участник и все пары, журнал без пар, статусы не меняются', async () => {
      // до жеребьёвки пар нет
      const pre = await zapi(boss, 'admin.vault.person', { event: E, id: anya.id });
      assert.equal(pre.ward, null);
      assert.equal(pre.santa, null);
      assert.deepEqual((await zapi(boss, 'admin.vault.pairs', { event: E })).pairs, []);

      const V = await newEvent('Сейф', [anya, borya, vera, gena], { delivery_on: true });
      await zapi(boss, 'admin.participate', { event: V, on: true });
      await zapi(vera, 'wishlist.save', { event: V, text: 'Хочу шарф ВЕРА-СЕКРЕТ' });
      await zapi(vera, 'delivery.save', { event: V, text: 'Минск, ул. Ёлочная, 1' });
      await zapi(boss, 'admin.draw', { event: V });
      const pairs = await pairsSql(V);
      const santaOf = (id) => [...pairs].find(([, ward]) => ward === id)[0];
      await zapi(vera, 'message.send', { event: V, to: 'santa', text: 'Привет, Санта!' });
      await zapi(vera, 'message.send', { event: V, to: 'ward', text: 'Привет от Санты' });
      const statusSql = `SELECT santa, ward, seen_text, notified_at, gift_ready, gift_received FROM pairs WHERE event_id = ${V} ORDER BY santa`;
      const readSql = `SELECT id, read_at FROM messages WHERE event_id = ${V} ORDER BY id`;
      const before = [await z.query(statusSql), await z.query(readSql)];
      await sleep(300);
      const helperMsgs = z.mock.messagesTo(helper.id).length;

      for (const action of ['admin.vault.person', 'admin.vault.pairs']) {
        const r = await zapi(helper, action, { event: V, id: vera.id }, true);
        assert.equal(r.status, 403, action);
        assert.equal(r.data.error, 'Служебный просмотр доступен только владельцу бота.');
      }

      const all = await zapi(boss, 'admin.vault.pairs', { event: V });
      assert.deepEqual(new Map(all.pairs.map((p) => [p.santa.id, p.ward.id])), pairs);
      const p = await zapi(boss, 'admin.vault.person', { event: V, id: vera.id });
      assert.equal(p.person.name, 'Вера');
      assert.equal(p.ward.id, pairs.get(vera.id));
      assert.equal(p.santa.id, santaOf(vera.id));
      assert.equal(p.wishlist, 'Хочу шарф ВЕРА-СЕКРЕТ');
      assert.equal(p.delivery, 'Минск, ул. Ёлочная, 1');
      assert.deepEqual(p.chat_with_santa.map((m) => [m.from, m.text]), [['ward', 'Привет, Санта!']]);
      assert.deepEqual(p.chat_with_ward.map((m) => [m.from, m.text]), [['santa', 'Привет от Санты']]);
      assert.ok(p.chat_with_santa[0].created_at > 0, 'с датами');
      assert.equal((await zapi(boss, 'admin.vault.person', { event: V, id: zhora.id }, true)).status, 400, 'не участник');

      assert.deepEqual([await z.query(statusSql), await z.query(readSql)], before, 'статусы и непрочитанные не изменились');
      const log = (await zapi(helper, 'admin.audit', { event: V })).entries;
      assert.deepEqual(log.filter((e) => e.action === 'vault.person').map((e) => e.details), ['Вера'], 'в журнале — только чьи данные открыты');
      assert.deepEqual(log.filter((e) => e.action === 'vault.pairs').map((e) => e.details), [`пар: ${pairs.size}`]);
      await sleep(300);
      assert.equal(z.mock.messagesTo(helper.id).length, helperMsgs, 'другим админам сообщений нет');

      // отмена жеребьёвки остаётся доступной; завершённый эвент тоже открывается
      const V2 = await newEvent('Сейф-2', [anya, borya, vera]);
      await zapi(boss, 'admin.draw', { event: V2 });
      await zapi(boss, 'admin.vault.pairs', { event: V2 });
      for (const u of [anya, borya, vera]) await zapi(boss, 'admin.vault.person', { event: V2, id: u.id });
      assert.equal((await zapi(boss, 'admin.state', { event: V2 })).settings.draw_cancelable, true, 'просмотр не мешает отменить жеребьёвку');
      await zapi(boss, 'admin.event.finish', { event: V2 });
      assert.equal((await zapi(boss, 'admin.vault.pairs', { event: V2 })).pairs.length, 3, 'и в завершённом эвенте');

      // владельцу не действуют ограничения против вычисления пар; админу — действуют
      await zapi(boss, 'admin.exclusion.add', { event: V, giver: anya.id, receiver: borya.id });
      assert.ok((await zapi(boss, 'admin.state', { event: V })).exclusions.some((e) => e.giver === anya.id && e.receiver === borya.id));
      await zapi(boss, 'admin.exclusion.del', { event: V, giver: anya.id, receiver: borya.id });
      assert.equal((await zapi(helper, 'admin.exclusion.add', { event: V, giver: gena.id, receiver: vera.id }, true)).status, 400);
      assert.equal((await zapi(helper, 'admin.family.save', { name: 'Пара-010', members: [anya.id, borya.id] }, true)).status, 400);
      await zapi(boss, 'admin.family.save', { name: 'Пара-010', members: [anya.id, borya.id] });
      const fam = (await zapi(boss, 'admin.families')).families.find((f) => f.name === 'Пара-010');
      await zapi(boss, 'admin.family.delete', { id: fam.id });

      const V4 = await newEvent('Вписать', [anya, borya, vera]);
      await zapi(boss, 'admin.draw', { event: V4 });
      await zapi(boss, 'admin.registration', { event: V4, open: true });
      const code = await zInvite(V4);
      await z.say(helper, '/start ' + code);
      await z.say(boss, '/start ' + code);
      const hs = await zapi(helper, 'admin.insert', { event: V4, id: helper.id }, true);
      assert.equal(hs.status, 403);
      assert.match(hs.data.error, /Вписывать в жеребьёвку после неё может только владелец бота/);
      await zapi(boss, 'admin.insert', { event: V4, id: boss.id });
      assert.ok((await pairsSql(V4)).has(boss.id), 'владелец вписал себя');
    });

    await t.test('владелец может всё, что админ (автотест по всем действиям admin.*)', async () => {
      // 019: список — из таблицы действий (порядок строк = прежний порядок case); ровно 46 — потерю действия видно сразу
      const { ACTIONS } = await import('../src/api.js');
      const actions = Object.keys(ACTIONS).filter((a) => a.startsWith('admin.'));
      assert.equal(actions.length, 46, `найдено действий: ${actions.length}`);
      // Минимальное тело: без слов подтверждения и без людей — опасные действия получают отказ по данным, а не по правам
      const body = (event) => ({ event, id: 0, from: 0, to: 0, giver: 0, receiver: 0 });
      const P1 = (await zapi(boss, 'admin.events.create', { title: 'Права владельца' })).event.id;
      const denied = [];
      for (const a of actions) {
        const r = await zapi(boss, a, body(P1), true);
        if (r.status === 403) denied.push(`${a}: ${r.data.error}`);
      }
      assert.deepEqual(denied, [], 'владельцу ни одного отказа по правам');
      // Проверка не пустая: обычный админ получает отказ на действия владельца
      const P2 = (await zapi(boss, 'admin.events.create', { title: 'Права админа' })).event.id;
      const deniedAdmin = [];
      for (const a of actions) {
        const r = await zapi(helper, a, body(P2), true);
        if (r.status === 403) deniedAdmin.push(a);
      }
      for (const a of ['admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer', 'admin.transfer', 'admin.vault.person', 'admin.vault.pairs', 'admin.event.delete', 'admin.insert', 'admin.draw.cancel.force', 'admin.fixed.add', 'admin.fixed.del']) {
        assert.ok(deniedAdmin.includes(a), `админу отказано: ${a}`);
      }
    });

    await t.test('закрытая регистрация: заявки ждут, приглашений нет, «Я участвую» можно', async () => {
      const R = await newEvent('Набор', []);
      await zapi(boss, 'admin.game', { event: R, approval: true });
      const code = await zInvite(R);
      await z.say(gena, '/start ' + code);
      await z.say(dasha, '/start ' + code);
      assert.match(z.lastText(gena), /отправлена организатору/);
      await zapi(helper, 'admin.registration', { event: R, open: false });
      const st = await zapi(helper, 'admin.state', { event: R });
      const rg = st.requests.find((r) => r.user_id === gena.id);
      const rd = st.requests.find((r) => r.user_id === dasha.id);
      const closed = 'Регистрация на событие «Набор» закрыта — открой её, чтобы принять заявку.';

      await waitFor(() => z.mock.messagesTo(helper.id).some((c) => c.params.text.includes('Гена') && c.params.text.includes('хочет участвовать')), 'заявка админу');
      const msgToHelper = z.mock.messagesTo(helper.id).filter((c) => c.params.text.includes('Гена') && c.params.text.includes('хочет участвовать')).at(-1);
      await z.press(helper, msgToHelper.params.reply_markup.inline_keyboard[0][0].callback_data);
      const answers = z.mock.calls.filter((c) => c.method === 'answerCallbackQuery').map((c) => c.params.text);
      assert.equal(answers.at(-1), closed, 'кнопка в чате');
      const r1 = await zapi(helper, 'admin.request.decide', { event: R, id: rg.id, approve: true }, true);
      assert.equal(r1.status, 400);
      assert.equal(r1.data.error, closed);
      assert.equal((await z.query(`SELECT status FROM join_requests WHERE id = ${rg.id}`))[0].status, 'pending', 'заявка ждёт');
      await zapi(helper, 'admin.request.decide', { event: R, id: rd.id, approve: false }); // отклонить можно

      const inv = await zapi(helper, 'admin.event.invite_from', { event: R, from: E }, true);
      assert.equal(inv.status, 400);
      assert.equal(inv.data.error, 'Регистрация закрыта — открой её, чтобы приглашать.');

      await zapi(helper, 'admin.participate', { event: R, on: true });
      assert.ok((await zapi(helper, 'event.get', { event: R })).member, '«Я участвую» при закрытой регистрации');

      await zapi(helper, 'admin.registration', { event: R, open: true });
      await zapi(helper, 'admin.request.decide', { event: R, id: rg.id, approve: true });
      assert.ok((await zapi(gena, 'event.get', { event: R })).member, 'после открытия принять можно');
    });

    await t.test('возврат удалённых: запрет, «Разрешить вернуться», включено по умолчанию, образец', async () => {
      const J = await newEvent('Возврат', [anya, borya, vera]);
      assert.equal((await zapi(boss, 'admin.state', { event: J })).settings.rejoin, true, 'по умолчанию включено');
      await zapi(helper, 'admin.game', { event: J, rejoin: false });
      await zapi(helper, 'admin.remove', { event: J, id: borya.id });
      assert.deepEqual((await zapi(helper, 'admin.state', { event: J })).removed.map((r) => r.id), [borya.id]);

      const toAdmins = () => [helper, boss].map((a) => z.mock.messagesTo(a.id)
        .filter((c) => c.params.text.includes('Боря') && c.params.text.includes('«Возврат»') && /присоединяется|хочет участвовать/.test(c.params.text)).length);
      await sleep(300);
      const seen0 = toAdmins();
      const refused = /Организатор удалил тебя из события «Возврат» — вернуться по ссылке нельзя\. Если это ошибка — напиши ему\./;
      const code = await zInvite(J);
      await z.say(borya, '/start ' + code);
      assert.match(z.lastText(borya), refused);
      assert.equal((await zapi(borya, 'event.get', { event: J }, true)).status, 403);
      // и заявкой — тоже нет
      await zapi(helper, 'admin.game', { event: J, approval: true });
      await z.say(borya, '/start ' + code);
      assert.match(z.lastText(borya), refused);
      assert.deepEqual((await zapi(helper, 'admin.state', { event: J })).requests, []);
      await zapi(helper, 'admin.game', { event: J, approval: false });
      // приглашение из прошлого эвента его пропускает
      const invites = () => ztexts(borya).filter((x) => x.includes('Приглашение на событие «Возврат»')).length;
      const inv0 = invites();
      await zapi(helper, 'admin.event.invite_from', { event: J, from: E });
      await sleep(500);
      assert.equal(invites(), inv0, 'удалённому приглашение не ушло');
      assert.deepEqual(toAdmins(), seen0, 'админам о попытках ничего');

      // удалили ещё до ввода имени — после имени тоже отказ
      await z.say(eva, '/start ' + code);
      assert.ok((await zapi(helper, 'admin.state', { event: J })).users.some((u) => u.id === eva.id && !u.registered));
      await zapi(helper, 'admin.remove', { event: J, id: eva.id });
      await z.say(eva, eva.name);
      assert.ok(ztexts(eva).some((x) => refused.test(x)));
      assert.equal((await zapi(eva, 'event.get', { event: J }, true)).status, 403);

      // «Разрешить вернуться»
      await zapi(helper, 'admin.removed.allow', { event: J, id: borya.id });
      await z.say(borya, '/start ' + code);
      assert.ok((await zapi(borya, 'event.get', { event: J })).member, 'вернулся по ссылке');
      assert.deepEqual((await zapi(helper, 'admin.state', { event: J })).removed.map((r) => r.id), [eva.id]);
      assert.ok((await zapi(helper, 'admin.audit', { event: J })).entries.some((e) => e.action === 'member.allow' && e.details === 'Боря'));

      // включено: удалённый возвращается и пропадает из списка
      await zapi(helper, 'admin.game', { event: J, rejoin: true });
      await zapi(helper, 'admin.remove', { event: J, id: vera.id });
      await z.say(vera, '/start ' + code);
      assert.ok((await zapi(vera, 'event.get', { event: J })).member);
      assert.ok(!(await zapi(helper, 'admin.state', { event: J })).removed.some((r) => r.id === vera.id));

      // «Я участвую» выкл. — не удаление организатором
      await zapi(helper, 'admin.participate', { event: J, on: true });
      await zapi(helper, 'admin.participate', { event: J, on: false });
      assert.ok(!(await zapi(helper, 'admin.state', { event: J })).removed.some((r) => r.id === helper.id));

      // эвент по образцу копирует настройку
      await zapi(helper, 'admin.game', { event: J, rejoin: false });
      const J2 = (await zapi(boss, 'admin.events.create', { title: 'Возврат-2', from: J })).event.id;
      assert.equal((await zapi(boss, 'admin.state', { event: J2 })).settings.rejoin, false);
    });

    await t.test('удаление эвента: два одновременных — одно уведомление и одна запись журнала', async () => {
      const D = await newEvent('Удаляшка', [anya, borya, vera]);
      const rs = await Promise.all([1, 2].map(() => zapi(boss, 'admin.event.delete', { event: D, confirm: 'УДАЛИТЬ' }, true)));
      const ok = rs.filter((r) => r.status === 200);
      assert.equal(ok.length, 1, 'удалило одно');
      const other = rs.find((r) => r.status !== 200);
      assert.match(other.data.error, /^Событие (уже удалено|не найдено)\.$/);
      const gone = (u) => ztexts(u).filter((x) => x.includes('«Удаляшка»') && x.includes('удалено организатором')).length;
      await waitFor(() => [anya, borya, vera].every((u) => gone(u) >= 1), 'уведомления об удалении');
      await z.cron();
      await sleep(300);
      for (const u of [anya, borya, vera]) assert.equal(gone(u), 1, `${u.name}: одно уведомление`);
      const rows = await z.query("SELECT COUNT(*) AS n FROM audit WHERE event_id = 0 AND action = 'event.delete' AND details LIKE '«Удаляшка»%'");
      assert.equal(rows[0].n, 1, 'одна запись в общем журнале');
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

test('012: вписывание по группам, принудительная отмена, обращения к организатору', { timeout: 400000 }, async (t) => {
  const z = await startWorld();
  const zapi = (...a) => z.api(...a);
  const ztexts = (u) => z.texts(u);
  const boss = { id: 1200, name: 'Хозяин', username: 'host012' };
  const helper = { id: 1201, name: 'Олег', username: 'oleg012' };
  const third = { id: 1202, name: 'Ира', username: 'ira012' };
  const anya = { id: 1203, name: 'Аня', username: 'anya012' };
  const borya = { id: 1204, name: 'Боря', username: 'borya012' };
  const vera = { id: 1205, name: 'Вера', username: 'vera012' };
  const gena = { id: 1206, name: 'Гена', username: 'gena012' };
  const dasha = { id: 1207, name: 'Даша', username: 'dasha012' };
  const eva = { id: 1208, name: 'Ева', username: 'eva012' };
  const zhora = { id: 1209, name: 'Жора', username: 'zhora012' };
  const borya2 = { id: 1210, name: 'Боря', username: 'borya_new012' };
  const registered = new Set();
  const zInvite = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await zapi(boss, 'admin.state', { event: eid })).settings.invite_link)[1];
  const pairsSql = async (eid) => new Map((await z.query(`SELECT santa, ward FROM pairs WHERE event_id = ${eid}`)).map((r) => [r.santa, r.ward]));
  const count = async (sql) => (await z.query(sql))[0].n;
  const join = async (u, code) => {
    await z.say(u, '/start ' + code);
    if (!registered.has(u.id)) {
      await z.say(u, u.name);
      registered.add(u.id);
    }
  };
  const newEvent = async (title, people) => {
    const id = (await zapi(boss, 'admin.events.create', { title })).event.id;
    const code = await zInvite(id);
    for (const u of people) await join(u, code);
    return id;
  };
  const answers = () => z.mock.calls.filter((c) => c.method === 'answerCallbackQuery').map((c) => c.params.text);

  try {
    await t.test('подготовка: владелец и два админа', async () => {
      const s = await z.setup();
      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      registered.add(boss.id);
      await newEvent('База-012', [helper, third, anya, borya, vera, gena, dasha, eva, zhora]);
      await zapi(boss, 'admin.role.grant', { id: helper.id });
      await zapi(boss, 'admin.role.grant', { id: third.id });
    });

    await t.test('вписывание: только владелец; сначала не открывшие, потом неготовые, иначе отказ', async () => {
      const V = await newEvent('Вписать-012', [anya, borya, vera, gena]);
      await zapi(boss, 'admin.draw', { event: V });
      for (const u of [anya, borya, vera]) await zapi(u, 'ward.get', { event: V });
      await zapi(vera, 'ward.gift', { event: V, ready: true });
      const before = await pairsSql(V);
      await zapi(boss, 'admin.registration', { event: V, open: true });
      await join(dasha, await zInvite(V));

      const denied = await zapi(helper, 'admin.insert', { event: V, id: dasha.id }, true);
      assert.equal(denied.status, 403);
      assert.equal(denied.data.error, 'Вписывать в жеребьёвку после неё может только владелец бота.');
      assert.equal((await pairsSql(V)).size, 4, 'админ ничего не изменил');

      // не открыл подопечного только Гена — подопечный меняется у него
      await zapi(boss, 'admin.insert', { event: V, id: dasha.id });
      const after = await pairsSql(V);
      const changed = [...before].filter(([s, w]) => after.get(s) !== w).map(([s]) => s);
      assert.deepEqual(changed, [gena.id]);
      assert.equal(after.get(gena.id), dasha.id);
      assert.equal(after.get(dasha.id), before.get(gena.id));
      await waitFor(() => ztexts(gena).some((x) => /новый подопечный/.test(x) && x.includes('«Вписать-012»')), 'уведомление Гене');

      // все открыли, у Веры подарок готов — меняется кто угодно, кроме Веры
      for (const u of [gena, dasha]) await zapi(u, 'ward.get', { event: V });
      await join(eva, await zInvite(V));
      await zapi(boss, 'admin.insert', { event: V, id: eva.id });
      const after2 = await pairsSql(V);
      const changed2 = [...after].filter(([s, w]) => after2.get(s) !== w).map(([s]) => s);
      assert.equal(changed2.length, 1);
      assert.notEqual(changed2[0], vera.id, 'у готового подарка подопечный не меняется');

      // подарки готовы у всех — вписать нельзя, пары те же
      await zapi(eva, 'ward.get', { event: V });
      for (const u of [anya, borya, gena, dasha, eva]) await zapi(u, 'ward.gift', { event: V, ready: true });
      await join(zhora, await zInvite(V));
      const blocked = await zapi(boss, 'admin.insert', { event: V, id: zhora.id }, true);
      assert.equal(blocked.status, 400);
      assert.equal(blocked.data.error, 'Не получается вписать участника, не нарушив правила: подарки уже готовы у всех, кому мог бы смениться подопечный, или мешают исключения. Можно отменить жеребьёвку в опасной зоне и провести заново.');
      assert.deepEqual([...(await pairsSql(V))].sort(), [...after2].sort());

      // не открыл, но уже переписывается — такого Санту не трогаем, пока есть «чистые»
      const W = await newEvent('Переписка-012', [anya, borya, vera, gena]);
      await zapi(boss, 'admin.draw', { event: W });
      await zapi(anya, 'message.send', { event: W, to: 'ward', text: 'Привет от Санты' });
      const wb = await pairsSql(W);
      await zapi(boss, 'admin.registration', { event: W, open: true });
      await join(dasha, await zInvite(W));
      await zapi(boss, 'admin.insert', { event: W, id: dasha.id });
      const wa = await pairsSql(W);
      assert.equal(wa.get(anya.id), wb.get(anya.id), 'переписывающийся Санта сохранил подопечного');
      assert.equal(await count(`SELECT COUNT(*) AS n FROM messages WHERE event_id = ${W}`), 1, 'переписка цела');

      // «Я участвую» после жеребьёвки — отказ называет владельца
      const part = await zapi(helper, 'admin.participate', { event: W, on: true }, true);
      assert.equal(part.data.error, 'После жеребьёвки так нельзя. Попроси владельца бота вписать тебя.');
    });

    await t.test('принудительная отмена: только владелец, пары и переписка удалены, письма на месте', async () => {
      const F = await newEvent('Отмена-012', [anya, borya, vera]);
      await zapi(anya, 'wishlist.save', { event: F, text: 'Хочу носки' });
      await zapi(boss, 'admin.draw', { event: F });
      await zapi(anya, 'ward.get', { event: F });
      await zapi(anya, 'message.send', { event: F, to: 'ward', text: 'Привет!' });
      await zapi(borya, 'ward.gift', { event: F, ready: true });
      assert.equal((await zapi(boss, 'admin.state', { event: F })).settings.draw_cancelable, false, 'обычная отмена недоступна');

      const byAdmin = await zapi(helper, 'admin.draw.cancel.force', { event: F, confirm: 'ОТМЕНА' }, true);
      assert.equal(byAdmin.status, 403);
      assert.equal(byAdmin.data.error, 'Принудительно отменить жеребьёвку может только владелец бота.');
      const noWord = await zapi(boss, 'admin.draw.cancel.force', { event: F }, true);
      assert.equal(noWord.status, 400);
      assert.equal(noWord.data.error, 'Для отмены введи слово ОТМЕНА.');

      const r = await zapi(boss, 'admin.draw.cancel.force', { event: F, confirm: 'отмена' });
      assert.equal(r.count, 3);
      assert.equal(await count(`SELECT COUNT(*) AS n FROM pairs WHERE event_id = ${F}`), 0);
      assert.equal(await count(`SELECT COUNT(*) AS n FROM messages WHERE event_id = ${F}`), 0);
      const ev = await zapi(anya, 'event.get', { event: F });
      assert.equal(ev.event.draw_done, false);
      assert.equal(ev.member.wishlist, 'Хочу носки', 'письмо сохранено');
      assert.equal((await zapi(boss, 'admin.state', { event: F })).settings.registration_open, true);
      const note = (u) => ztexts(u).filter((x) => x.includes('отменил жеребьёвку') && x.includes('«Отмена-012»'));
      await waitFor(() => [anya, borya, vera].every((u) => note(u).length === 1), 'уведомления об отмене');
      for (const u of [anya, borya, vera]) assert.ok(!/Аня|Боря|Вера/.test(note(u)[0]), 'без имён');
      const log = await zapi(helper, 'admin.audit', { event: F });
      assert.ok(log.entries.some((e) => e.action === 'draw.cancel.force' && e.details === 'пар удалено: 3'));

      assert.equal((await zapi(boss, 'admin.draw.cancel.force', { event: F, confirm: 'ОТМЕНА' }, true)).data.error, 'Жеребьёвка не проведена.');
      await zapi(boss, 'admin.draw', { event: F });
      await zapi(boss, 'admin.reveal', { event: F });
      assert.equal((await zapi(boss, 'admin.draw.cancel.force', { event: F, confirm: 'ОТМЕНА' }, true)).data.error, 'Тайна уже раскрыта — отменить жеребьёвку нельзя.');
    });

    let S, first;
    await t.test('обращения: рассылка всем админам, взять, видимость, ответы из бота', async () => {
      S = await newEvent('Помощь-012', [anya, borya]);
      assert.deepEqual((await zapi(anya, 'event.get', { event: S })).support, { available: true, open: false, assignee_name: '', unread: 0 });
      assert.equal((await zapi(anya, 'support.send', { event: S, text: 'x'.repeat(4001) }, true)).data.error,
        'Слишком длинно: 4001 символов, максимум 4000 (лимит сообщения Telegram).');
      assert.equal((await zapi(anya, 'support.send', { event: S, text: '   ' }, true)).data.error, 'Пустое сообщение.');

      first = await zapi(anya, 'support.send', { event: S, text: 'Не вижу подопечного <b>' });
      const sos = (u) => z.mock.messagesTo(u.id).filter((c) => c.params.text.includes('просит помощи') && c.params.text.includes('«Помощь-012»'));
      await waitFor(() => [boss, helper, third].every((u) => sos(u).length === 1), '🆘 всем админам');
      assert.equal(sos(anya).length, 0);
      const m = sos(helper)[0];
      assert.match(m.params.text, /Не вижу подопечного &lt;b&gt;/, 'текст экранирован');
      const takeData = m.params.reply_markup.inline_keyboard[0][0].callback_data;
      assert.equal(takeData, `sup:take:${first.thread}`);
      assert.match(m.params.reply_markup.inline_keyboard[0][1].web_app.url, new RegExp(`support=${first.thread}`));

      await zapi(anya, 'support.send', { event: S, text: 'И письмо не сохраняется' });
      await waitFor(() => z.mock.messagesTo(third.id).some((c) => c.params.text.includes('дополняет') && c.params.disable_notification), 'дополнение без звука');
      const list = (await zapi(third, 'admin.state', { event: S })).support.threads;
      assert.equal(list.length, 1);
      assert.deepEqual([list[0].status, list[0].assignee, list[0].readable, list[0].unread], ['open', 0, true, 2]);
      assert.ok(!JSON.stringify(list).includes('подопечного'), 'в списке нет текстов');
      assert.deepEqual((await zapi(third, 'event.get', { event: S })).support_admin, { waiting: 1, unread: 0 });

      // взять из чата бота; второй — «уже взял(а)»
      await z.press(helper, takeData);
      assert.ok(answers().includes('🙋 Обращение твоё'));
      const own = z.mock.messagesTo(helper.id).find((c) => c.params.text.includes('теперь ведёшь ты'));
      assert.ok(own, 'взявшему — сообщение с кнопкой «Ответить»');
      assert.equal(own.params.reply_markup.inline_keyboard[0][0].callback_data, `sup:a:${first.thread}`);
      await z.press(third, takeData);
      assert.ok(answers().includes('Обращение уже взял(а) Олег.'));
      await waitFor(() => ztexts(anya).some((x) => x.includes('взял(а) <b>Олег</b>')), 'участнику — кто взял');
      await waitFor(() => [boss, third].every((u) => ztexts(u).some((x) => x.includes('<b>Олег</b> взял(а) обращение <b>Аня</b>'))), 'остальным админам');

      // видимость: третий админ — нет, владелец — да
      const hidden = await zapi(third, 'admin.support.get', { event: S, thread: first.thread }, true);
      assert.equal(hidden.status, 403);
      assert.equal(hidden.data.error, 'Обращение ведёт Олег — переписку видят он(а) и владелец.');
      const thirdList = (await zapi(third, 'admin.state', { event: S })).support.threads[0];
      assert.deepEqual([thirdList.readable, thirdList.assignee_name, thirdList.unread], [false, 'Олег', 0]);
      assert.equal((await zapi(boss, 'admin.support.get', { event: S, thread: first.thread })).messages.length, 2);
      assert.equal((await zapi(boss, 'admin.support.send', { event: S, thread: first.thread, text: 'Я владелец' }, true)).data.error, 'Обращение ведёт Олег.');

      // ответ организатора из чата бота
      await z.press(helper, `sup:a:${first.thread}`);
      await z.say(helper, 'Открой вкладку «Подопечный»');
      assert.equal(z.lastText(helper), '✅ Отправлено участнику.');
      const replyOf = () => z.mock.messagesTo(anya.id).find((c) => c.params.text.includes('Организатор <b>Олег</b> отвечает'));
      await waitFor(() => replyOf(), 'ответ участнику');
      assert.equal(replyOf().params.reply_markup.inline_keyboard[0][0].callback_data, `sup:u:${S}`);
      assert.match(replyOf().params.reply_markup.inline_keyboard[0][1].web_app.url, /support=my/);
      assert.deepEqual((await zapi(anya, 'event.get', { event: S })).support, { available: true, open: true, assignee_name: 'Олег', unread: 1 });
      assert.equal((await zapi(anya, 'me')).events.find((e) => e.id === S).unread, 1);
      const view = await zapi(anya, 'support.get', { event: S });
      assert.equal(view.threads.length, 1);
      assert.deepEqual(view.threads[0].messages.map((x) => [x.mine, x.author]), [[true, ''], [true, ''], [false, 'Олег']]);
      assert.equal((await zapi(anya, 'event.get', { event: S })).support.unread, 0, 'прочитано');

      // ответ участника из чата бота — только ответственному
      await z.press(anya, `sup:u:${S}`);
      await z.say(anya, 'Спасибо, вижу!');
      assert.equal(z.lastText(anya), '✅ Отправлено организатору. Ответ придёт сюда.');
      await waitFor(() => ztexts(helper).some((x) => x.includes('<b>Аня</b> пишет в обращении') && x.includes('Спасибо, вижу!')), 'ответственному');
      assert.ok(![boss, third].some((u) => ztexts(u).some((x) => x.includes('Спасибо, вижу!'))), 'остальным админам текст не уходит');
      assert.deepEqual((await zapi(helper, 'event.get', { event: S })).support_admin, { waiting: 0, unread: 1 });
      await zapi(helper, 'admin.support.get', { event: S, thread: first.thread });
      assert.deepEqual((await zapi(helper, 'event.get', { event: S })).support_admin, { waiting: 0, unread: 0 });

      // любая команда сбрасывает режим ответа
      await z.press(anya, `sup:u:${S}`);
      await z.say(anya, '/start');
      await z.say(anya, 'это уже не в обращение');
      await sleep(500);
      assert.ok(!ztexts(helper).some((x) => x.includes('это уже не в обращение')));
      assert.equal(await count(`SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ${first.thread}`), 4);
    });

    await t.test('обращения: передача, закрытие, новое обращение, журнал без текстов', async () => {
      assert.equal((await zapi(third, 'admin.support.pass', { event: S, thread: first.thread, to: third.id }, true)).status, 403);
      assert.equal((await zapi(helper, 'admin.support.pass', { event: S, thread: first.thread, to: anya.id }, true)).data.error, 'Передать можно другому администратору.');
      await zapi(helper, 'admin.support.pass', { event: S, thread: first.thread, to: third.id });
      await waitFor(() => ztexts(third).some((x) => x.includes('<b>Олег</b> передал(а) тебе обращение <b>Аня</b>')), 'новому ответственному');
      await waitFor(() => ztexts(anya).some((x) => x.includes('теперь ведёт <b>Ира</b>')), 'участнику — кто ведёт');
      assert.equal((await zapi(helper, 'admin.support.get', { event: S, thread: first.thread }, true)).status, 403, 'прежний больше не видит');
      assert.equal((await zapi(third, 'admin.support.get', { event: S, thread: first.thread })).messages.length, 4);
      // устаревшая кнопка «Ответить» у прежнего ответственного
      await z.press(helper, `sup:a:${first.thread}`);
      assert.ok(answers().includes('Обращение ведёт Ира.'));

      await zapi(anya, 'support.close', { event: S });
      await waitFor(() => ztexts(third).some((x) => x.includes('<b>Аня</b> закрыл(а) обращение')), 'ответственному — закрыто');
      assert.equal((await zapi(anya, 'support.close', { event: S }, true)).data.error, 'Открытого обращения нет.');
      assert.equal((await zapi(third, 'admin.support.send', { event: S, thread: first.thread, text: 'Ещё' }, true)).data.error, 'Обращение уже закрыто.');

      const second = await zapi(anya, 'support.send', { event: S, text: 'Новый вопрос' });
      assert.notEqual(second.thread, first.thread, 'после закрытия — новое обращение');
      await waitFor(() => z.mock.messagesTo(helper.id).filter((c) => c.params.text.includes('просит помощи') && c.params.text.includes('Новый вопрос')).length === 1, 'новое 🆘');
      // ответ админа берёт ничьё обращение; участнику — только ответ, без «взял(а)»
      const before = ztexts(anya).length;
      await zapi(boss, 'admin.support.send', { event: S, thread: second.thread, text: 'Отвечаю как владелец' });
      await waitFor(() => ztexts(anya).some((x) => x.includes('Организатор <b>Хозяин</b> отвечает')), 'ответ владельца');
      assert.ok(!ztexts(anya).slice(before).some((x) => x.includes('взял(а)')));
      assert.equal((await zapi(third, 'admin.state', { event: S })).support.threads.find((x) => x.id === second.thread).assignee_name, 'Хозяин');
      await zapi(boss, 'admin.support.close', { event: S, thread: second.thread });
      await waitFor(() => ztexts(anya).some((x) => x.includes('закрыл(а) твоё обращение') && x.includes('напиши снова')), 'закрыто организатором');
      const view = await zapi(anya, 'support.get', { event: S });
      assert.deepEqual(view.threads.map((x) => x.status), ['closed', 'closed']);

      const log = (await zapi(helper, 'admin.audit', { event: S })).entries;
      for (const a of ['support.open', 'support.take', 'support.pass', 'support.close']) assert.ok(log.some((e) => e.action === a), a);
      assert.ok(!JSON.stringify(log).includes('Не вижу подопечного') && !JSON.stringify(log).includes('Новый вопрос'), 'журнал без текстов');
    });

    await t.test('обращения: одновременное «Взять», снятие прав, перенос, удаление участника и эвента', async () => {
      const b = await zapi(borya, 'support.send', { event: S, text: 'Вопрос Бори' });
      const rs = await Promise.all([helper, third].map((u) => zapi(u, 'admin.support.take', { event: S, thread: b.thread }, true)));
      assert.equal(rs.filter((r) => r.status === 200).length, 1, 'взял один');
      assert.match(rs.find((r) => r.status !== 200).data.error, /^Обращение уже взял\(а\) (Олег|Ира)\.$/);
      const winner = rs[0].status === 200 ? helper : third;
      const other = winner === helper ? third : helper;

      await zapi(boss, 'admin.role.revoke', { id: winner.id });
      assert.equal(await count(`SELECT assignee AS n FROM support_threads WHERE id = ${b.thread}`), 0, 'снова ничьё');
      await waitFor(() => [boss, other].every((u) => ztexts(u).some((x) => x.includes('<b>Боря</b> («Помощь-012») снова ничьё'))), 'админам — снова ничьё');
      await waitFor(() => ztexts(borya).some((x) => x.includes('снова ждёт ответа организатора')), 'участнику');
      await zapi(boss, 'admin.role.grant', { id: winner.id });

      // перенос участия: обращения переходят на новый аккаунт
      await join(borya2, await zInvite(S));
      await zapi(boss, 'admin.transfer', { from: borya.id, to: borya2.id });
      assert.equal(await count(`SELECT COUNT(*) AS n FROM support_threads WHERE user_id = ${borya2.id}`), 1);
      assert.equal(await count(`SELECT COUNT(*) AS n FROM support_messages WHERE sender = ${borya2.id}`), 1);
      assert.equal((await zapi(borya2, 'support.get', { event: S })).threads[0].messages[0].text, 'Вопрос Бори');

      // удаление участника — его обращения в эвенте удаляются
      await zapi(boss, 'admin.remove', { event: S, id: anya.id });
      assert.equal(await count(`SELECT COUNT(*) AS n FROM support_threads WHERE event_id = ${S} AND user_id = ${anya.id}`), 0);
      assert.equal(await count(`SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ${first.thread}`), 0);

      await zapi(boss, 'admin.event.delete', { event: S, confirm: 'УДАЛИТЬ' });
      assert.equal(await count(`SELECT COUNT(*) AS n FROM support_threads WHERE event_id = ${S}`), 0);
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

// 014: закреплённые пары владельца — только владелец, кольцевая в одну сторону, жеребьёвка их соблюдает, тайна для админов
test('014: закреплённые пары владельца', { timeout: 400000 }, async (t) => {
  const z = await startWorld();
  const zapi = (...a) => z.api(...a);
  const boss = { id: 1400, name: 'Хозяин', username: 'host014' };
  const helper = { id: 1401, name: 'Олег', username: 'oleg014' };
  const anya = { id: 1403, name: 'Аня', username: 'anya014' };
  const borya = { id: 1404, name: 'Боря', username: 'borya014' };
  const vera = { id: 1405, name: 'Вера', username: 'vera014' };
  const gena = { id: 1406, name: 'Гена', username: 'gena014' };
  const dasha = { id: 1407, name: 'Даша', username: 'dasha014' };
  const eva = { id: 1408, name: 'Ева', username: 'eva014' };
  const anya2 = { id: 1409, name: 'Аня', username: 'anya_new014' };
  const FIXED_BLOCK = 'Мешают закреплённые пары: с ними распределить всех по правилам не получается. Владелец бота может убрать часть закреплённых пар.';
  const FROZEN = 'После жеребьёвки закреплённые пары не меняются. Чтобы поменять их, отмени жеребьёвку.';
  const registered = new Set();
  const zInvite = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await zapi(boss, 'admin.state', { event: eid })).settings.invite_link)[1];
  const pairsSql = async (eid) => new Map((await z.query(`SELECT santa, ward FROM pairs WHERE event_id = ${eid}`)).map((r) => [r.santa, r.ward]));
  const count = async (sql) => (await z.query(sql))[0].n;
  const fixedCount = (eid) => count(`SELECT COUNT(*) AS n FROM fixed_pairs WHERE event_id = ${eid}`);
  const join = async (u, code) => {
    await z.say(u, '/start ' + code);
    if (!registered.has(u.id)) {
      await z.say(u, u.name);
      registered.add(u.id);
    }
  };
  const newEvent = async (title, people) => {
    const id = (await zapi(boss, 'admin.events.create', { title })).event.id;
    const code = await zInvite(id);
    for (const u of people) await join(u, code);
    return id;
  };
  const err = async (u, action, body) => (await zapi(u, action, body, true)).data.error;

  try {
    await t.test('подготовка: владелец и админ', async () => {
      const s = await z.setup();
      await z.say(boss, '/start ' + s.adminCode);
      await z.say(boss, boss.name);
      registered.add(boss.id);
      await newEvent('База-014', [helper]);
      await zapi(boss, 'admin.role.grant', { id: helper.id });
    });

    await t.test('закрепление: только владелец, проверки, админ ничего не видит', async () => {
      const F = await newEvent('Закреп-014', [anya, borya, vera, gena, dasha]);
      assert.deepEqual((await zapi(boss, 'admin.state', { event: F })).fixed, []);
      await zapi(boss, 'admin.fixed.add', { event: F, giver: anya.id, receiver: borya.id });
      await zapi(boss, 'admin.fixed.add', { event: F, giver: anya.id, receiver: borya.id }); // повтор — без изменений
      assert.deepEqual((await zapi(boss, 'admin.state', { event: F })).fixed, [{ giver: anya.id, receiver: borya.id }]);

      // админ: поля нет, действия запрещены, журнал без имён
      const st = await zapi(helper, 'admin.state', { event: F });
      assert.ok(!('fixed' in st), 'у админа нет поля fixed');
      for (const a of ['admin.fixed.add', 'admin.fixed.del']) {
        const r = await zapi(helper, a, { event: F, giver: anya.id, receiver: borya.id }, true);
        assert.equal(r.status, 403);
        assert.equal(r.data.error, 'Закреплять пары может только владелец бота.');
      }
      assert.equal(await fixedCount(F), 1, 'админ ничего не изменил');
      const audit = (await zapi(helper, 'admin.audit', { event: F })).entries.filter((e) => e.action.startsWith('fixed.'));
      assert.equal(audit.length, 2);
      assert.ok(audit.every((e) => !e.details), 'журнал без имён');

      // проверки
      assert.equal(await err(boss, 'admin.fixed.add', { event: F, giver: vera.id, receiver: vera.id }), 'Выбери двух разных людей');
      assert.equal(await err(boss, 'admin.fixed.add', { event: F, giver: vera.id, receiver: helper.id }), 'Закрепить пару можно только между участниками события.');
      assert.equal(await err(boss, 'admin.fixed.add', { event: F, giver: anya.id, receiver: vera.id }), 'У «Аня» уже есть закреплённый подопечный — сначала убери ту пару.');
      assert.equal(await err(boss, 'admin.fixed.add', { event: F, giver: vera.id, receiver: borya.id }), 'Санта для «Боря» уже закреплён — сначала убери ту пару.');
      // кольцевая (по умолчанию включена) — только в одну сторону
      assert.equal(await err(boss, 'admin.fixed.add', { event: F, giver: borya.id, receiver: anya.id }),
        'При кольцевой жеребьёвке пару можно закрепить только в одну сторону: «Аня» уже дарит «Боря».');
      assert.equal(await err(boss, 'admin.fixed.add', { event: F, giver: vera.id, receiver: gena.id, mutual: true }),
        'При кольцевой жеребьёвке пару можно закрепить только в одну сторону.');
      assert.equal(await fixedCount(F), 1);

      await zapi(boss, 'admin.fixed.del', { event: F, giver: anya.id, receiver: borya.id });
      assert.equal(await fixedCount(F), 0);
    });

    await t.test('без кольцевой — в обе стороны; включили кольцевую — жеребьёвка отклонена без имён', async () => {
      const R = await newEvent('Круг-014', [anya, borya, vera, gena]);
      await zapi(boss, 'admin.ring', { event: R, on: false });
      await zapi(boss, 'admin.fixed.add', { event: R, giver: anya.id, receiver: borya.id, mutual: true });
      assert.equal(await fixedCount(R), 2);
      await zapi(helper, 'admin.ring', { event: R, on: true }); // админ включает кольцевую как обычно
      const c = await zapi(helper, 'admin.draw.check', { event: R });
      assert.equal(c.possible, false);
      assert.deepEqual(c.problems, [FIXED_BLOCK]);
      const d = await zapi(helper, 'admin.draw', { event: R }, true);
      assert.equal(d.status, 400);
      assert.equal(d.data.error, FIXED_BLOCK);

      await zapi(boss, 'admin.fixed.del', { event: R, giver: anya.id, receiver: borya.id, mutual: true });
      assert.equal(await fixedCount(R), 0, 'взаимная убрана одним действием');
      await zapi(boss, 'admin.fixed.add', { event: R, giver: anya.id, receiver: borya.id });
      await zapi(helper, 'admin.draw', { event: R }); // проводит админ — закреплённая пара всё равно соблюдается
      const m = await pairsSql(R);
      assert.equal(m.get(anya.id), borya.id);
      assert.notEqual(m.get(borya.id), anya.id, 'кольцевая — без взаимных');

      // после жеребьёвки — только чтение, и для владельца
      assert.equal(await err(boss, 'admin.fixed.add', { event: R, giver: vera.id, receiver: gena.id }), FROZEN);
      assert.equal(await err(boss, 'admin.fixed.del', { event: R, giver: anya.id, receiver: borya.id }), FROZEN);
      assert.equal(await fixedCount(R), 1);
    });

    await t.test('жеребьёвка соблюдает закреплённые пары, они важнее исключений; тупик — причина без имён', async () => {
      for (let i = 0; i < 3; i++) {
        const P = await newEvent(`Повтор-014-${i}`, [anya, borya, vera, gena, dasha]);
        await zapi(helper, 'admin.exclusion.add', { event: P, giver: vera.id, receiver: gena.id, mutual: true });
        await zapi(boss, 'admin.fixed.add', { event: P, giver: vera.id, receiver: gena.id });
        await zapi(boss, 'admin.fixed.add', { event: P, giver: gena.id, receiver: anya.id });
        await zapi(boss, 'admin.draw', { event: P });
        const m = await pairsSql(P);
        assert.equal(m.get(vera.id), gena.id);
        assert.equal(m.get(gena.id), anya.id);
      }
      // трое, кольцевая: Аня → Боря закреплено, Вера не дарит Ане — круг невозможен, без закрепления возможен
      const X = await newEvent('Тупик-014', [anya, borya, vera]);
      await zapi(boss, 'admin.fixed.add', { event: X, giver: anya.id, receiver: borya.id });
      await zapi(helper, 'admin.exclusion.add', { event: X, giver: vera.id, receiver: anya.id });
      const c = await zapi(helper, 'admin.draw.check', { event: X });
      assert.equal(c.possible, false);
      assert.deepEqual(c.problems, [FIXED_BLOCK]);
    });

    await t.test('после жеребьёвки: замены не ломают пару, перенос и удаление участника', async () => {
      const L = await newEvent('Жизнь-014', [anya, borya, vera, gena, dasha]);
      await zapi(boss, 'admin.fixed.add', { event: L, giver: anya.id, receiver: borya.id });
      await zapi(boss, 'admin.draw', { event: L });
      await zapi(helper, 'admin.remove', { event: L, id: dasha.id });
      assert.equal((await pairsSql(L)).get(anya.id), borya.id, 'удаление другого не меняет пару');
      await zapi(boss, 'admin.registration', { event: L, open: true });
      await join(eva, await zInvite(L));
      await zapi(boss, 'admin.insert', { event: L, id: eva.id });
      const m = await pairsSql(L);
      assert.equal(m.size, 5);
      assert.equal(m.get(anya.id), borya.id, 'вписывание не меняет пару');

      await join(anya2, await zInvite(L));
      await zapi(boss, 'admin.transfer', { from: anya.id, to: anya2.id });
      assert.equal(await count(`SELECT COUNT(*) AS n FROM fixed_pairs WHERE event_id = ${L} AND giver = ${anya2.id} AND receiver = ${borya.id}`), 1);
      assert.equal(await count(`SELECT COUNT(*) AS n FROM fixed_pairs WHERE giver = ${anya.id} OR receiver = ${anya.id}`), 0);

      await zapi(boss, 'admin.remove', { event: L, id: borya.id });
      assert.equal(await fixedCount(L), 0, 'ушёл участник — его закреплённые пары удалены');
    });

    await t.test('отмена жеребьёвки сохраняет, образец не копирует, сброс и удаление события — удаляют', async () => {
      const C = await newEvent('Отмена-014', [borya, vera, gena, dasha]);
      await zapi(boss, 'admin.fixed.add', { event: C, giver: vera.id, receiver: gena.id });
      await zapi(boss, 'admin.draw', { event: C });
      await zapi(boss, 'admin.draw.cancel', { event: C });
      assert.equal(await fixedCount(C), 1, 'отмена сохраняет');
      await zapi(boss, 'admin.fixed.add', { event: C, giver: borya.id, receiver: dasha.id }); // снова можно менять
      const copy = (await zapi(boss, 'admin.events.create', { title: 'Копия-014', from: C })).event.id;
      assert.equal(await fixedCount(copy), 0, 'образец не копирует');
      await zapi(boss, 'admin.reset.full', { event: C, confirm: 'СБРОС' });
      assert.equal(await fixedCount(C), 0, 'сброс удаляет');

      const D = await newEvent('Удалить-014', [borya, vera, gena]);
      await zapi(boss, 'admin.fixed.add', { event: D, giver: vera.id, receiver: gena.id });
      await zapi(boss, 'admin.event.delete', { event: D, confirm: 'УДАЛИТЬ' });
      assert.equal(await fixedCount(D), 0, 'удаление события удаляет');

      const E = await newEvent('Финиш-014', [borya, vera, gena]);
      await zapi(boss, 'admin.draw', { event: E });
      await zapi(boss, 'admin.event.finish', { event: E });
      assert.match(await err(boss, 'admin.fixed.add', { event: E, giver: vera.id, receiver: gena.id }), /Событие завершено/);
    });
  } finally {
    const log = z.log();
    await z.stop();
    assertBudget(log);
  }
});

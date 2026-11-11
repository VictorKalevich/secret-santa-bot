// Сквозной тест: локальный Worker (wrangler dev) + имитация Telegram. Сценарии 001–005.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

after(async () => { await w?.stop(); });

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
    assert.equal(c.history_used, true);
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
    await api(owner, 'admin.transfer', { from: katya.id, to: katya2.id });
    await waitFor(() => texts(katya2).some((x) => /перенёс на этот аккаунт/.test(x)), 'сообщение новому аккаунту');
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
  });
});

// Сквозной тест: локальный Worker (wrangler dev) + имитация Telegram. Сценарии US1–US8 из spec.md.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, initData, waitFor, sleep } from './harness.mjs';
import { BLOCKED_CHAT } from './mock-telegram.mjs';

let w, mock, BASE, webhookSecret;
const api = (...a) => w.api(...a);
const update = (...a) => w.update(...a);
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

// Участники
const admin = { id: 100, name: 'Дмитрий', username: 'dima' };
const people = [
  { id: 101, name: 'Маша', username: 'masha' },
  { id: 102, name: 'Петя', username: 'petya' },
  { id: 103, name: 'Аня', username: 'anya' },
  { id: 104, name: 'Олег', username: '' },
  { id: 105, name: 'Катя', username: 'katya' },
  { id: 106, name: 'Иван', username: 'ivan' },
];
const stranger = { id: 999, name: 'Чужой', username: 'stranger' };
const late = { id: 107, name: 'Света', username: 'sveta' };
const everyone = [admin, ...people];
const byId = Object.fromEntries([...everyone, late].map((u) => [u.id, u]));

let adminCode, inviteCode;

async function pairsSnapshot(users) {
  const map = new Map();
  for (const u of users) {
    const d = await api(u, 'ward.get');
    if (d.state === 'ok') {
      const ward = [...everyone, late].find((x) => x.name === d.ward.name);
      map.set(u.id, ward.id);
    }
  }
  return map;
}

function assertPermutation(map, ids, exclusions = []) {
  assert.equal(map.size, ids.length);
  assert.equal(new Set(map.values()).size, ids.length);
  for (const [s, w] of map) {
    assert.notEqual(s, w);
    assert.ok(ids.includes(w));
    for (const [a, b] of exclusions) assert.ok(!(s === a && w === b), `нарушено исключение ${a}→${b}`);
  }
}

test('сквозной сценарий игры', { timeout: 180000 }, async (t) => {
  await t.test('настройка /setup и защита webhook', async () => {
    assert.equal((await fetch(`${BASE}/setup?key=wrong`)).status, 403);
    const s = await w.setup();
    assert.match(s.html, /Бот настроен/);
    adminCode = s.adminCode;
    inviteCode = s.inviteCode;
    const wh = mock.calls.find((c) => c.method === 'setWebhook');
    assert.ok(wh.params.url.endsWith('/tg'));
    webhookSecret = s.webhookSecret;
    assert.ok(webhookSecret.length >= 32);
    assert.ok(mock.calls.some((c) => c.method === 'setChatMenuButton' && c.params.menu_button.web_app.url.endsWith('/app')));
    assert.equal(await update({ message: { message_id: 1, date: 1, from: from(stranger), chat: { id: 999, type: 'private' }, text: '/start' } }, 'bad'), 403);
  });

  await t.test('US1: регистрация только по приглашению', async () => {
    await say(stranger, '/start');
    assert.match(lastText(stranger), /закрытый бот/);
    await say(stranger, '/start inv_wrongcode');
    assert.match(lastText(stranger), /устарела/);
    const r = await api(stranger, 'me');
    assert.equal(r.registered, false);
    const w = await api(stranger, 'wishlist.save', { text: 'хак' }, true);
    assert.equal(w.status, 403);

    await say(admin, '/start ' + adminCode);
    assert.match(lastText(admin), /владелец игры/);
    await say(admin, admin.name);
    assert.match(lastText(admin), /участвуешь/);
    await press(admin, 'adm_part:1');
    assert.match(lastText(admin), /Тайный Санта/);

    for (const p of people) {
      await say(p, '/start ' + inviteCode);
      assert.match(lastText(p), /Как тебя зовут/);
      await say(p, p.name);
    }
    await waitFor(() => texts(admin).filter((x) => /Новый участник/.test(x)).length === people.length, 'уведомления админу о новых участниках');
    const silent = mock.messagesTo(admin.id).filter((c) => /Новый участник/.test(c.params.text));
    assert.ok(silent.every((c) => c.params.disable_notification === true), 'уведомления админу — без звука');
    const me = await api(people[0], 'me');
    assert.equal(me.me.name, 'Маша');
    assert.equal(me.me.is_participant, true);
  });

  await t.test('US1: письмо — сохранение, лимит 4000 символов, только своё', async () => {
    for (const p of [admin, ...people.slice(0, 5)]) {
      await api(p, 'wishlist.save', { text: `Письмо от ${p.name}: хочу носки и книгу. СЕКРЕТ-${p.id}` });
    }
    // 003, FR-309: лимит 4000 символов (одно сообщение Telegram — 4096)
    const r = await api(people[0], 'wishlist.save', { text: 'я'.repeat(4001) }, true);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /максимум 4000/);
    await api(people[0], 'wishlist.save', { text: 'я'.repeat(4000) });
    assert.equal((await api(people[0], 'me')).limits.chars, 4000);
    await api(people[0], 'wishlist.save', { text: 'Подмена', id: 102, tg_id: 102 });
    const petya = await api(people[1], 'me');
    assert.match(petya.me.wishlist, /СЕКРЕТ-102/, 'чужое письмо не изменилось');
    await api(people[0], 'wishlist.save', { text: `Письмо от Маша: хочу носки и книгу. СЕКРЕТ-101` });
    const bad = await api(initData(people[0], { token: 'WRONG' }), 'me', {}, true);
    assert.equal(bad.status, 401, 'поддельная подпись отклоняется');
    const old = await api(initData(people[0], { authDate: Math.floor(Date.now() / 1000) - 2 * 86400 }), 'me', {}, true);
    assert.equal(old.status, 401, 'старая подпись отклоняется');
  });

  await t.test('US5: админ видит статусы без содержимого; не-админ не видит панель', async () => {
    const no = await api(people[0], 'admin.state', {}, true);
    assert.equal(no.status, 403);
    const st = await api(admin, 'admin.state');
    const raw = JSON.stringify(st);
    assert.ok(!/СЕКРЕТ-/.test(raw), 'в admin.state нет текстов писем');
    const ivan = st.users.find((u) => u.id === 106);
    assert.equal(ivan.has_wishlist, false);
    assert.equal(st.users.find((u) => u.id === 101).has_wishlist, true);
    assert.match(st.settings.invite_link, /t\.me\/test_santa_bot\?start=inv_/);
    const w = await api(admin, 'admin.wishlist', { id: 101 });
    assert.match(w.wishlist, /СЕКРЕТ-101/, 'по отдельному действию письмо открывается');
  });

  await t.test('US8: ежедневное напоминание до срока — один раз в сутки', async () => {
    const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    await api(admin, 'admin.game', { budget: 'до 50 BYN', deadline: today, event_date: '2026-12-27', place: 'У Маши', notes: 'Без алкоголя' });
    await cron();
    await waitFor(() => texts(byId[106]).some((x) => /письмо Санте пока пустое/.test(x)), 'напоминание Ивану');
    const n = texts(byId[106]).length;
    await cron();
    await sleep(300);
    assert.equal(texts(byId[106]).length, n, 'второй раз в тот же день не напоминаем');
    assert.ok(!texts(byId[101]).some((x) => /пустое/.test(x)), 'тем, у кого письмо есть, не напоминаем');
  });

  const exclusions = [[101, 102], [102, 101], [103, 104]];
  let pairs;

  await t.test('US2: исключения, проверка и жеребьёвка', async () => {
    await api(admin, 'admin.exclusion.add', { giver: 101, receiver: 102, mutual: true });
    await api(admin, 'admin.exclusion.add', { giver: 103, receiver: 104, mutual: false });
    const st = await api(admin, 'admin.state');
    assert.equal(st.exclusions.length, 3);
    const check = await api(admin, 'admin.draw.check');
    assert.equal(check.possible, true);
    assert.equal(check.count, 7);
    assert.deepEqual(check.empty_wishlists, ['Иван']);
    const before = mock.calls.length;
    const d = await api(admin, 'admin.draw');
    assert.equal(d.count, 7);
    await waitFor(() => everyone.every((u) => mock.calls.slice(before).some((c) => c.params.chat_id === u.id && /Жеребьёвка проведена/.test(c.params.text || ''))), 'уведомления о жеребьёвке');
    const again = await api(admin, 'admin.draw', {}, true);
    assert.equal(again.status, 400, 'повторная жеребьёвка запрещена');
    await say(late, '/start ' + inviteCode);
    assert.match(lastText(late), /Регистрация сейчас закрыта/);
  });

  await t.test('US3: каждый видит только своего подопечного; тайна', async () => {
    pairs = await pairsSnapshot(everyone);
    assertPermutation(pairs, everyone.map((u) => u.id), exclusions);
    const st = await api(admin, 'admin.state');
    const raw = JSON.stringify(st);
    assert.ok(!/"(ward|santa|pairs)"/.test(raw), 'в admin.state нет пар');
    for (const u of st.users) assert.deepEqual(Object.keys(u).sort(), ['gift_ready', 'has_wishlist', 'id', 'in_draw', 'is_admin', 'is_owner', 'is_participant', 'name', 'registered', 'username']);
    const drawMsgs = mock.calls.filter((c) => /Жеребьёвка проведена/.test(c.params.text || ''));
    for (const c of drawMsgs) for (const u of everyone) assert.ok(!c.params.text.includes(u.name), 'в уведомлении нет имён');
  });

  await t.test('US4: одно уведомление на серию правок, без имени; режим «выкл»', async () => {
    await cron();
    await sleep(300);
    assert.ok(!mock.calls.some((c) => /обновил письмо/.test(c.params.text || '')), 'правки до жеребьёвки не уведомляют');

    const wardOfAdmin = byId[pairs.get(admin.id)];
    await api(wardOfAdmin, 'wishlist.save', { text: `Письмо от ${wardOfAdmin.name}: хочу варежки и книгу. СЕКРЕТ-${wardOfAdmin.id}` });
    await api(wardOfAdmin, 'wishlist.save', { text: `Письмо от ${wardOfAdmin.name}: хочу тёплые варежки и книгу. СЕКРЕТ-${wardOfAdmin.id}` });
    await cron();
    await waitFor(() => texts(admin).some((x) => /обновил письмо/.test(x)), 'уведомление Санте');
    await cron();
    await sleep(300);
    const notes = mock.messagesTo(admin.id).filter((c) => /обновил письмо/.test(c.params.text));
    assert.equal(notes.length, 1, 'ровно одно уведомление');
    assert.ok(!notes[0].params.text.includes(wardOfAdmin.name), 'без имени подопечного');
    assert.ok(!notes[0].params.text.includes('варежки'), 'без текста письма');

    const d = await api(admin, 'ward.get');
    assert.notEqual(d.previous, null, 'есть прошлая версия для подсветки');
    assert.notEqual(d.previous, d.ward.wishlist);
    assert.match(d.ward.wishlist, /тёплые варежки/);
    const d2 = await api(admin, 'ward.get');
    assert.equal(d2.previous, null, 'после просмотра изменений больше нет');

    const santaX = people[2];
    await api(santaX, 'notify.set', { mode: 'off' });
    const wardX = byId[pairs.get(santaX.id)];
    await api(wardX, 'wishlist.save', { text: 'Новый текст письма' });
    await cron();
    await sleep(400);
    assert.ok(!texts(santaX).some((x) => /обновил письмо/.test(x)), 'в режиме «выкл» уведомлений нет');
    await api(santaX, 'notify.set', { mode: 'silent' });
  });

  await t.test('US6 + 003: переписка Санты и подопечного, уведомления, непрочитанные', async () => {
    const santa = people[0];
    const ward = byId[pairs.get(santa.id)];
    const sent = await api(santa, 'message.send', { to: 'ward', text: 'Какой у тебя размер перчаток?' });
    assert.equal(sent.message.mine, true);
    await waitFor(() => texts(ward).some((x) => /Какой у тебя размер перчаток/.test(x)), 'сообщение подопечному');
    const q = mock.messagesTo(ward.id).find((c) => /размер перчаток/.test(c.params.text));
    assert.match(q.params.text, /Твой Тайный Санта пишет/);
    assert.ok(!q.params.text.includes(santa.name), 'отправитель не раскрыт');
    const kb = q.params.reply_markup.inline_keyboard.flat();
    assert.ok(kb.some((b) => b.callback_data === 'msg:santa'), 'кнопка «Ответить»');
    assert.ok(kb.some((b) => b.web_app && /\/app\?chat=santa$/.test(b.web_app.url)), 'кнопка «Вся переписка»');

    assert.equal((await api(ward, 'me')).me.unread.from_santa, 1, 'непрочитанное у подопечного');
    const wc = await api(ward, 'chat.get', { with: 'santa' });
    assert.equal(wc.messages.length, 1);
    assert.equal(wc.messages[0].mine, false);
    assert.ok(!JSON.stringify(wc).includes(santa.name) && !JSON.stringify(wc).includes(String(santa.id)), 'в ответе нет имени и ID Санты');
    assert.equal((await api(ward, 'me')).me.unread.from_santa, 0, 'прочитано после открытия');

    // ответ через бота попадает в ту же переписку
    await press(ward, 'msg:santa');
    await say(ward, 'Размер M, спасибо!');
    await waitFor(() => texts(santa).some((x) => /Размер M, спасибо/.test(x)), 'ответ Санте');
    assert.match(lastText(ward), /Отправлено твоему Санте/);
    assert.equal((await api(santa, 'me')).me.unread.from_ward, 1);
    const sc = await api(santa, 'chat.get', { with: 'ward' });
    assert.deepEqual(sc.messages.map((m) => [m.mine, m.text]), [[true, 'Какой у тебя размер перчаток?'], [false, 'Размер M, спасибо!']]);
    const more = await api(santa, 'chat.get', { with: 'ward', after: sc.messages[1].id });
    assert.equal(more.messages.length, 0, 'догрузка после последнего — пусто');

    // чужую переписку не видно: у подопечного Санты своя пара
    const other = people[1];
    const oc = await api(other, 'chat.get', { with: 'santa' });
    assert.ok(!oc.messages?.some((m) => /перчаток/.test(m.text)), 'чужая переписка недоступна');

    // лимиты
    assert.equal((await api(santa, 'message.send', { to: 'ward', text: 'x'.repeat(4001) }, true)).status, 400);
    assert.equal((await api(santa, 'message.send', { to: 'ward', text: '   ' }, true)).status, 400);
    await press(santa, 'msg:ward');
    await say(santa, 'y'.repeat(4001));
    assert.match(lastText(santa), /максимум 4000/);
    await say(santa, '/cancel');
  });

  await t.test('US7: удаление и вписывание после жеребьёвки — минимум изменений', async () => {
    const victim = people[5]; // Иван
    const before = pairs;
    const victimSanta = [...pairs].find(([, w]) => w === victim.id)[0];
    await api(byId[victimSanta], 'message.send', { to: 'ward', text: 'Секретный вопрос Ивану' });
    await api(admin, 'admin.remove', { id: victim.id });
    const vs = await api(byId[victimSanta], 'chat.get', { with: 'ward' });
    assert.ok(!vs.messages.some((m) => /Ивану/.test(m.text)), 'переписка с удалённым не переходит к новому подопечному');
    const rest = everyone.filter((u) => u.id !== victim.id);
    const after = await pairsSnapshot(rest);
    assertPermutation(after, rest.map((u) => u.id), exclusions);
    const changed = [...after].filter(([s, w]) => before.get(s) !== w).map(([s]) => s);
    assert.ok(changed.length >= 1 && changed.length <= 2, `изменилось ${changed.length}`);
    await waitFor(() => changed.every((s) => texts(byId[s]).some((x) => /новый подопечный/.test(x))), 'уведомление о смене подопечного');
    const unchanged = rest.filter((u) => !changed.includes(u.id));
    for (const u of unchanged) assert.ok(!texts(u).some((x) => /новый подопечный/.test(x)), `${u.name} не должен получать уведомление`);
    assert.match(lastText(victim), /удалил тебя/);

    await api(admin, 'admin.registration', { open: true });
    await say(late, '/start ' + inviteCode);
    await say(late, late.name);
    let st = await api(admin, 'admin.state');
    assert.equal(st.users.find((u) => u.id === late.id).in_draw, false);
    const lw = await api(late, 'ward.get');
    assert.equal(lw.state, 'waiting');
    await api(admin, 'admin.insert', { id: late.id });
    const all = [...rest, late];
    pairs = await pairsSnapshot(all);
    assertPermutation(pairs, all.map((u) => u.id), exclusions);
    await waitFor(() => texts(late).some((x) => /Ты в игре/.test(x)), 'уведомление новичку');
    st = await api(admin, 'admin.state');
    assert.equal(st.users.find((u) => u.id === late.id).in_draw, true);
  });

  await t.test('US8: подарок готов, раскрытие, новая игра без повторов', async () => {
    await api(people[0], 'ward.gift', { ready: true });
    const st = await api(admin, 'admin.state');
    assert.equal(st.users.find((u) => u.id === 101).gift_ready, true);
    const rs = await api(admin, 'admin.remind.santas');
    assert.equal(rs.count, pairs.size - 1);

    await api(admin, 'admin.reveal');
    for (const [s, w] of pairs) {
      await waitFor(() => texts(byId[w]).some((x) => x.includes('Твой Тайный Санта') && x.includes(byId[s].name)), `раскрытие для ${byId[w].name}`);
    }

    await api(admin, 'admin.newgame');
    const st2 = await api(admin, 'admin.state');
    assert.equal(st2.settings.draw_done, false);
    assert.equal(st2.settings.has_history, true);
    assert.equal(st2.settings.registration_open, true);
    const check = await api(admin, 'admin.draw.check');
    assert.equal(check.history_used, true);
    await api(admin, 'admin.draw');
    const ids = [...pairs.keys()];
    const next = await pairsSnapshot(ids.map((id) => byId[id]));
    assertPermutation(next, ids, exclusions);
    for (const [s, w] of next) assert.notEqual(pairs.get(s), w, 'пара прошлой игры не повторилась');
  });

  await t.test('очередь: заблокировавший бота не ломает рассылку', async () => {
    const blocked = { id: BLOCKED_CHAT, name: 'Блок', username: 'blk' };
    await api(admin, 'admin.newgame');
    await say(blocked, '/start ' + inviteCode);
    await say(blocked, blocked.name);
    await api(admin, 'admin.remind.unfilled');
    await cron();
    await waitFor(() => mock.messagesTo(BLOCKED_CHAT).some((c) => /пустое/.test(c.params.text)), 'попытка отправки');
    await cron();
    const tries = mock.messagesTo(BLOCKED_CHAT).filter((c) => /пустое/.test(c.params.text)).length;
    assert.equal(tries, 1, 'после 403 повторов нет');
  });
  await t.test('002: роли — владелец назначает и снимает админов, защита, передача, ссылка владельца', async () => {
    const [masha, petya, , oleg] = people;
    let me = await api(admin, 'me');
    assert.equal(me.me.is_owner, true, 'перешедший по ссылке /setup — владелец');
    let st = await api(admin, 'admin.state');
    assert.equal(st.users.find((u) => u.id === admin.id).is_owner, true);
    assert.equal(st.settings.owner_name, admin.name);
    assert.equal((await api(masha, 'admin.state', {}, true)).status, 403);

    await api(admin, 'admin.role.grant', { id: masha.id });
    await waitFor(() => texts(masha).some((x) => /назначил тебя администратором/.test(x)), 'сообщение назначенному');
    me = await api(masha, 'me');
    assert.equal(me.me.is_admin, true);
    assert.equal(me.me.is_owner, false);
    await api(masha, 'admin.state');

    // обычный админ не управляет ролями и не удаляет владельца/админов
    assert.equal((await api(masha, 'admin.role.grant', { id: petya.id }, true)).status, 403);
    assert.equal((await api(masha, 'admin.owner.transfer', { id: masha.id }, true)).status, 403);
    const delOwner = await api(masha, 'admin.remove', { id: admin.id }, true);
    assert.equal(delOwner.status, 400);
    assert.match(delOwner.data.error, /Владельца нельзя удалить/);

    await api(admin, 'admin.role.grant', { id: petya.id });
    await waitFor(() => mock.messagesTo(masha.id).some((c) => /Петя<\/b> теперь администратор/.test(c.params.text) && c.params.disable_notification), 'тихое уведомление другим админам');
    assert.equal((await api(masha, 'admin.remove', { id: petya.id }, true)).status, 403, 'админа удаляет только владелец');
    assert.equal((await api(admin, 'admin.role.revoke', { id: admin.id }, true)).status, 400, 'владелец не снимает права сам с себя');
    assert.equal((await api(admin, 'admin.remove', { id: admin.id }, true)).status, 400);

    await api(admin, 'admin.role.revoke', { id: petya.id });
    await waitFor(() => texts(petya).some((x) => /снял с тебя права администратора/.test(x)), 'сообщение снятому');
    assert.equal((await api(petya, 'admin.state', {}, true)).status, 403);

    // передача владения
    await api(admin, 'admin.owner.transfer', { id: masha.id });
    await waitFor(() => texts(masha).some((x) => /переданы права владельца/.test(x)), 'сообщение новому владельцу');
    assert.equal((await api(masha, 'me')).me.is_owner, true);
    me = await api(admin, 'me');
    assert.equal(me.me.is_owner, false);
    assert.equal(me.me.is_admin, true, 'прежний владелец остаётся админом');
    assert.equal((await api(admin, 'admin.role.grant', { id: petya.id }, true)).status, 403);

    // ссылка владельца с /setup забирает права и предупреждает прежнего владельца
    const { adminCode: ownerCode } = await w.setup();
    await say(oleg, '/start ' + ownerCode);
    assert.match(lastText(oleg), /владелец игры/);
    await waitFor(() => texts(masha).some((x) => /Права владельца игры перешли к <b>Олег<\/b>/.test(x)), 'предупреждение прежнему владельцу');
    assert.equal((await api(oleg, 'me')).me.is_owner, true);
    const m = (await api(masha, 'me')).me;
    assert.equal(m.is_owner, false);
    assert.equal(m.is_admin, true);
    await say(oleg, '/start');
    assert.match(lastText(oleg), /Ты владелец игры/);

    st = await api(oleg, 'admin.state');
    assert.ok(!/"(ward|santa|pairs)"/.test(JSON.stringify(st)), 'роли не открывают пары');
    assert.deepEqual(st.users.filter((u) => u.is_owner).map((u) => u.id), [oleg.id], 'владелец ровно один');
  });
  await t.test('004: перенос участия на новый аккаунт — пары остальных не меняются', async () => {
    const [masha, , , oleg, katya] = people;
    const owner = oleg; // после сценария ролей владелец — Олег
    await api(owner, 'admin.draw');
    const drawIds = (await api(owner, 'admin.state')).users.filter((u) => u.in_draw).map((u) => u.id);
    const nameOf = Object.fromEntries((await api(owner, 'admin.state')).users.map((u) => [u.name, u.id]));
    const snapshot = async (ids) => {
      const m = new Map();
      for (const id of ids) {
        const d = await api({ id, name: 'x', username: '' }, 'ward.get');
        if (d.state === 'ok') m.set(id, nameOf[d.ward.name]);
      }
      return m;
    };
    const before = await snapshot(drawIds);
    const katyaSanta = [...before].find(([, w]) => w === katya.id)[0];
    await api({ id: katyaSanta, name: 'x', username: '' }, 'message.send', { to: 'ward', text: 'Привет, Катя! Что ты любишь?' });
    const katyaLetter = (await api(katya, 'me')).me.wishlist;

    // Катя потеряла аккаунт и зарегистрировалась с нового
    const katya2 = { id: 205, name: 'Катя Новая', username: 'katya_new' };
    await api(owner, 'admin.registration', { open: true });
    await say(katya2, '/start ' + inviteCode);
    await say(katya2, katya2.name);

    // права: владельца не переносим; админа переносит только владелец; цель не должна быть в жеребьёвке
    assert.equal((await api(owner, 'admin.transfer', { from: owner.id, to: katya2.id }, true)).status, 400);
    assert.equal((await api(admin, 'admin.transfer', { from: masha.id, to: katya2.id }, true)).status, 403);
    assert.equal((await api(owner, 'admin.transfer', { from: katya.id, to: masha.id }, true)).status, 400);

    const othersMsgsBefore = mock.calls.length;
    await api(masha, 'admin.transfer', { from: katya.id, to: katya2.id });
    await waitFor(() => texts(katya2).some((x) => /перенёс на этот аккаунт/.test(x)), 'сообщение новому аккаунту');

    nameOf[katya2.name] = katya2.id;
    const afterIds = drawIds.map((id) => (id === katya.id ? katya2.id : id));
    const after = await snapshot(afterIds);
    for (const [s0, w0] of before) {
      const s1 = s0 === katya.id ? katya2.id : s0;
      const w1 = w0 === katya.id ? katya2.id : w0;
      assert.equal(after.get(s1), w1, 'пара не изменилась');
    }
    const chat = await api(katya2, 'chat.get', { with: 'santa' });
    assert.ok(chat.messages.some((m) => /Привет, Катя/.test(m.text)), 'переписка перенесена');
    assert.equal((await api(katya2, 'me')).me.wishlist, katyaLetter, 'письмо перенесено');
    assert.equal((await api(katya, 'me')).registered, false, 'старая запись удалена');
    const extra = mock.calls.slice(othersMsgsBefore).filter((c) => c.method === 'sendMessage' && c.params.chat_id !== katya2.id && /подопечн/.test(c.params.text || ''));
    assert.equal(extra.length, 0, 'другим уведомлений о смене подопечного нет');
  });

  await t.test('004: полный сброс — только владелец, слово СБРОС, остаётся только владелец', async () => {
    const [masha, , , oleg] = people;
    const owner = oleg;
    const stBefore = await api(owner, 'admin.state');
    const oldInvite = /start=(inv_[a-z0-9]+)/.exec(stBefore.settings.invite_link)[1];
    assert.equal((await api(masha, 'admin.reset.full', { confirm: 'СБРОС' }, true)).status, 403, 'админ не может');
    assert.equal((await api(owner, 'admin.reset.full', { confirm: 'сбро' }, true)).status, 400, 'неверное слово');

    const r = await api(owner, 'admin.reset.full', { confirm: 'сброс' });
    assert.equal(r.removed, stBefore.users.length - 1);
    assert.ok(r.invite_link && !r.invite_link.includes(oldInvite), 'новая пригласительная ссылка');

    const st = await api(owner, 'admin.state');
    assert.deepEqual(st.users.map((u) => u.id), [owner.id], 'остался только владелец');
    assert.equal(st.users[0].is_owner, true);
    assert.equal(st.exclusions.length, 0);
    assert.equal(st.settings.draw_done, false);
    assert.equal(st.settings.registration_open, true);
    assert.equal(st.settings.budget, '');
    assert.equal(st.settings.has_history, false);
    assert.equal((await api(owner, 'me')).me.wishlist, '');
    assert.equal((await api(owner, 'ward.get')).state, 'no_draw');

    assert.equal((await api(masha, 'me')).registered, false, 'участник удалён');
    await waitFor(() => texts(masha).some((x) => /начал игру «Тайный Санта» заново/.test(x)), 'сообщение удалённым');
    const fresh = { id: 301, name: 'Новенький', username: 'fresh' };
    await say(fresh, '/start ' + oldInvite);
    assert.match(lastText(fresh), /устарела/, 'старая ссылка не работает');
    const newInvite = /start=(inv_[a-z0-9]+)/.exec(r.invite_link)[1];
    await say(fresh, '/start ' + newInvite);
    assert.match(lastText(fresh), /Как тебя зовут/, 'новая ссылка работает');
  });
});

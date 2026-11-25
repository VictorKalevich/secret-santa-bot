// 047: регистрация именем из Telegram (specs/047-telegram-name-signup/). После ссылки — имя из профиля и кнопки
// «✅ Участвовать / Продолжить как …» и «✏️ Изменить имя»; нажатие завершает регистрацию так же, как имя текстом.
// Одновременные нажатия — в tests/atomic.test.mjs.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };

const NAME_PROMPT = 'Как тебя зовут? Напиши имя (и, если нужно, фамилию) — так тебя увидят твой Санта, владелец и администраторы.';
const NAME_ASK =
  '✏️ Напиши имя (и, если нужно, фамилию) одним сообщением — до 40 символов. Так тебя увидят твой Санта, владелец и администраторы.';
const NAME_SAVED = 'Имя уже сохранено. Сменить его можно в приложении: «Профиль» → «✏️ Изменить имя».';
const NOT_REGISTERED = 'Сначала зарегистрируйся по пригласительной ссылке.';
const keyboard = (verb, name) => [
  [{ text: `✅ ${verb} как ${name}`, callback_data: 'reg:ok' }],
  [{ text: '✏️ Изменить имя', callback_data: 'reg:edit' }],
];

let cqNo = 0;
// Человек Telegram: from — как его присылает Telegram (имя, фамилия, ник)
const person = (id, first_name, last_name, username) => ({ id, is_bot: false, first_name, ...(last_name ? { last_name } : {}), ...(username ? { username } : {}) });

async function world({ ownerByButton = false } = {}) {
  const w = await startWorld();
  const s = await w.setup();
  const say = (from, text) => w.update({ message: { message_id: 1, date: 1, from, chat: { id: from.id, type: 'private' }, text } });
  // Нажатие; message — сообщение с кнопками (у настоящего Telegram оно есть почти всегда). → id нажатия
  const press = async (from, data, message = null) => {
    const id = 'signup' + ++cqNo;
    await w.update({ callback_query: { id, from, data, chat_instance: 'x', ...(message ? { message } : {}) } });
    return id;
  };
  const answers = (id) => w.calls.filter((c) => c.method === 'answerCallbackQuery' && c.params.callback_query_id === id).map((c) => c.params.text ?? '');
  const sent = (u) => w.calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === u.id);
  const last = (u) => sent(u).at(-1)?.params;
  const user = (u) => w.query('SELECT name, username, registered, pending, is_admin FROM users WHERE tg_id = ?', u.id)[0];
  const member = (u, ev) => w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', ev, u.id).length === 1;
  const joined = (to, name) => w.texts(to).filter((t) => t.includes(`<b>${name}</b> присоединяется к событию`)).length;
  const invite = async (ev) => /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev })).settings.invite_link)[1];
  const create = async (title, body = {}) => {
    const id = (await w.api(boss, 'event.create', { participate: false, title })).event.id;
    if (Object.keys(body).length) await w.api(boss, 'admin.game', { event: id, ...body });
    return id;
  };
  if (!ownerByButton) {
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    const forAdmin = await create('Для админа');
    await w.say(adm, '/start ' + (await invite(forAdmin)));
    await w.say(adm, adm.name);
    await w.api(boss, 'admin.role.grant', { event: forAdmin, id: adm.id });
  }
  return { w, s, say, press, answers, sent, last, user, member, joined, invite, create };
}

describe('вступление одним нажатием (047, US1)', () => {
  let z;
  let E;
  let code;
  before(async () => {
    z = await world();
    E = await z.create('Проверка');
    code = await z.invite(E);
  });

  it('после ссылки — имя из Telegram и две строки кнопок, имя ещё не сохранено', async () => {
    const anna = person(201, 'Анна', 'Иванова', 'anna');
    await z.say(anna, '/start ' + code);
    const p = z.last(anna);
    assert.equal(p.text, '🎄 Привет! Это бот для игры в Тайного Санту, «Проверка».\n\n' +
      'Имя в игре — <b>Анна Иванова</b>, как в Telegram. Его увидят твой Санта, владелец и администраторы. ' +
      'Хочешь другое — нажми «✏️ Изменить имя» или просто напиши его.');
    assert.deepEqual(p.reply_markup.inline_keyboard, keyboard('Участвовать', 'Анна Иванова'));
    assert.deepEqual(z.user(anna), { name: '', username: 'anna', registered: 0, pending: `name:${E}:${code.slice(4)}`, is_admin: 0 });
  });

  it('«Участвовать как …» — имя и ник сохранены, участник, приветствие, меню, кнопки сняты, одно «присоединяется»', async () => {
    const anna = person(201, 'Анна', 'Иванова', 'anna');
    const before = z.sent(anna).length;
    const id = await z.press(anna, 'reg:ok', { message_id: 77, date: 1, chat: { id: anna.id, type: 'private' } });
    assert.deepEqual(z.answers(id), ['']);
    assert.deepEqual(z.user(anna), { name: 'Анна Иванова', username: 'anna', registered: 1, pending: '', is_admin: 0 });
    assert.ok(z.member(anna, E));
    const edit = z.w.calls.filter((c) => c.method === 'editMessageReplyMarkup');
    assert.deepEqual(edit.map((c) => c.params), [{ chat_id: anna.id, message_id: 77, reply_markup: { inline_keyboard: [] } }]);
    const now = z.sent(anna).slice(before).map((c) => c.params);
    assert.equal(now.length, 2);
    assert.match(now[0].text, /^Приятно познакомиться, Анна Иванова! 🎉\n\nТеперь открой приложение и напиши письмо своему Тайному Санте в событии «Проверка»/);
    assert.equal(now[0].reply_markup.inline_keyboard[0][0].text, '✏️ Написать письмо');
    assert.match(now[1].text, /Твои события/);
    assert.equal(z.joined(boss, 'Анна Иванова'), 1);
    assert.equal(z.joined(adm, 'Анна Иванова'), 0, '063: администратор другого события — не получает');
  });

  it('вступление по одобрению — нажатие отправляет заявку', async () => {
    const A = await z.create('Одобрение', { approval: true });
    const borya = person(202, 'Боря', '', 'borya');
    await z.say(borya, '/start ' + (await z.invite(A)));
    assert.deepEqual(z.last(borya).reply_markup.inline_keyboard, keyboard('Участвовать', 'Боря'));
    await z.press(borya, 'reg:ok');
    assert.equal(z.user(borya).registered, 1);
    assert.ok(!z.member(borya, A));
    assert.equal(z.w.query("SELECT COUNT(*) AS n FROM join_requests WHERE event_id = ? AND user_id = ? AND status = 'pending'", A, borya.id)[0].n, 1);
    assert.ok(z.w.texts(borya).some((t) => t.includes('Заявка на участие в событии «Одобрение» отправлена')));
    assert.ok(z.w.texts(boss).some((t) => t.includes('<b>Боря</b> (@borya) хочет участвовать')));
    assert.equal(z.joined(boss, 'Боря'), 0);
  });

  it('пока человек решал, ссылку сменили — ответ как после ввода имени: «устарела»', async () => {
    const A = await z.create('Смена ссылки', { approval: true });
    const dima = person(203, 'Дима');
    await z.say(dima, '/start ' + (await z.invite(A)));
    await z.w.api(boss, 'admin.invite.regen', { event: A });
    await z.press(dima, 'reg:ok');
    assert.equal(z.user(dima).name, 'Дима');
    const texts = z.w.texts(dima);
    assert.ok(texts.includes('Приятно познакомиться, Дима! 🎉\n\nЭта пригласительная ссылка устарела. Попроси новую ссылку.'));
    assert.match(texts.at(-1), /не участвуешь/);
  });

  it('пока человек решал, его удалили и закрыли регистрацию — «закрыта», организаторам ничего', async () => {
    const C = await z.create('Закрытое');
    const gena = person(204, 'Гена');
    await z.say(gena, '/start ' + (await z.invite(C)));
    await z.w.api(boss, 'admin.remove', { event: C, id: gena.id });
    await z.w.api(boss, 'admin.registration', { event: C, open: false });
    await z.press(gena, 'reg:ok');
    const texts = z.w.texts(gena);
    assert.ok(texts.includes('Приятно познакомиться, Гена! 🎉'));
    assert.ok(texts.includes('Регистрация на событие «Закрытое» закрыта. Владелец или администратор может открыть её снова.'));
    assert.match(texts.at(-1), /не участвуешь/);
    assert.ok(!z.member(gena, C));
    assert.equal(z.joined(boss, 'Гена'), 0);
  });

  it('удалён без права возврата — «вернуться по ссылке нельзя»', async () => {
    const R = await z.create('Без возврата', { rejoin: false });
    const egor = person(205, 'Егор');
    await z.say(egor, '/start ' + (await z.invite(R)));
    await z.w.api(boss, 'admin.remove', { event: R, id: egor.id });
    await z.press(egor, 'reg:ok');
    assert.equal(z.user(egor).registered, 1);
    assert.ok(z.w.texts(egor).some((t) => t.startsWith('Тебя удалили из события «Без возврата» — вернуться по ссылке нельзя.')));
    assert.ok(!z.member(egor, R));
  });

  it('какое имя предлагается: фамилия не влезает — только имя; не влезает имя или это команда — прежний вопрос', async () => {
    const offer = async (from) => {
      await z.say(from, '/start ' + code);
      return z.last(from);
    };
    const long = await offer(person(210, 'Константин', 'К'.repeat(35)));
    assert.deepEqual(long.reply_markup.inline_keyboard, keyboard('Участвовать', 'Константин'));
    const spaces = await offer(person(211, '  Мария \n', ' Петровна  '));
    assert.deepEqual(spaces.reply_markup.inline_keyboard, keyboard('Участвовать', 'Мария Петровна'));
    for (const from of [person(212, 'А'.repeat(41)), person(213, '/start'), person(214, '   ', '')]) {
      const p = await offer(from);
      assert.equal(p.text, '🎄 Привет! Это бот для игры в Тайного Санту, «Проверка».\n\n' + NAME_PROMPT);
      assert.equal(p.reply_markup, undefined);
    }
    // Ровно 40 — подходит
    const forty = await offer(person(215, 'Б'.repeat(40)));
    assert.deepEqual(forty.reply_markup.inline_keyboard, keyboard('Участвовать', 'Б'.repeat(40)));
  });

  it('разметка в имени: в тексте экранирована, в кнопке и в базе — как есть', async () => {
    const li = person(216, '<Ли>', '& Ко');
    await z.say(li, '/start ' + code);
    const p = z.last(li);
    assert.ok(p.text.includes('Имя в игре — <b>&lt;Ли&gt; &amp; Ко</b>, как в Telegram.'));
    assert.deepEqual(p.reply_markup.inline_keyboard, keyboard('Участвовать', '<Ли> & Ко'));
    await z.press(li, 'reg:ok');
    assert.equal(z.user(li).name, '<Ли> & Ко');
    assert.ok(z.w.texts(li).some((t) => t.startsWith('Приятно познакомиться, &lt;Ли&gt; &amp; Ко! 🎉')));
  });

  it('имя берётся в момент нажатия; стало неподходящим — прежний вопрос, имя не сохранено', async () => {
    await z.say(person(220, 'Константин'), '/start ' + code);
    await z.press(person(220, 'Костя'), 'reg:ok');
    assert.equal(z.user({ id: 220 }).name, 'Костя');

    await z.say(person(221, 'Лена'), '/start ' + code);
    const id = await z.press(person(221, '/команда'), 'reg:ok');
    assert.deepEqual(z.answers(id), ['']);
    assert.equal(z.last({ id: 221 }).text, NAME_PROMPT);
    assert.equal(z.user({ id: 221 }).registered, 0);
  });
});

describe('другое имя (047, US2)', () => {
  let z;
  let code;
  before(async () => {
    z = await world();
    code = await z.invite(await z.create('Имена'));
  });

  it('«✏️ Изменить имя» — просьба написать имя, затем имя текстом', async () => {
    const zhenya = person(301, 'Евгения', 'Смирнова', 'zhenya');
    await z.say(zhenya, '/start ' + code);
    const id = await z.press(zhenya, 'reg:edit', { message_id: 5, date: 1, chat: { id: zhenya.id, type: 'private' } });
    assert.deepEqual(z.answers(id), ['']);
    assert.equal(z.last(zhenya).text, NAME_ASK);
    assert.equal(z.user(zhenya).registered, 0);
    await z.say(zhenya, '  Женя  ');
    assert.deepEqual(z.user(zhenya), { name: 'Женя', username: 'zhenya', registered: 1, pending: '', is_admin: 0 });
    assert.equal(z.joined(boss, 'Женя'), 1);
    assert.equal(z.w.calls.filter((c) => c.method === 'editMessageReplyMarkup').length, 0, 'кнопки снимает только нажатие «Участвовать»');
  });

  it('имя текстом — и без нажатия', async () => {
    const zina = person(302, 'Зинаида');
    await z.say(zina, '/start ' + code);
    await z.say(zina, 'Зина');
    assert.equal(z.user(zina).name, 'Зина');
    assert.ok(z.w.texts(zina).some((t) => t.startsWith('Приятно познакомиться, Зина! 🎉')));
  });

  it('после «Изменить имя» «Участвовать как …» ещё работает', async () => {
    const igor = person(303, 'Игорь');
    await z.say(igor, '/start ' + code);
    await z.press(igor, 'reg:edit');
    await z.press(igor, 'reg:ok');
    assert.equal(z.user(igor).name, 'Игорь');
    assert.equal(z.user(igor).registered, 1);
  });
});

describe('владелец по своей ссылке (047, US3)', () => {
  it('«Продолжить как …», напоминания /start и /cancel — то же предложение, нажатие — владелец с именем', async () => {
    const z = await world({ ownerByButton: true });
    const owner = person(boss.id, 'Владелец', 'Бота', 'boss');
    await z.say(owner, '/start ' + z.s.adminCode);
    const p = z.last(owner);
    assert.ok(p.text.startsWith('👑 Ты — владелец бота «Тайный Санта»: создаёшь события и назначаешь администраторов.\n\nИмя в игре — <b>Владелец Бота</b>'));
    assert.deepEqual(p.reply_markup.inline_keyboard, keyboard('Продолжить', 'Владелец Бота'));
    for (const text of ['/start', '/cancel']) {
      await z.say(owner, text);
      assert.ok(z.last(owner).text.startsWith('Имя в игре — <b>Владелец Бота</b>'), text);
      assert.deepEqual(z.last(owner).reply_markup.inline_keyboard, keyboard('Продолжить', 'Владелец Бота'), text);
    }
    // Другая команда вместо имени — прежняя подсказка
    await z.say(owner, '/help');
    assert.equal(z.last(owner).text, 'Напиши, пожалуйста, имя обычным текстом (до 40 символов).');
    await z.press(owner, 'reg:ok');
    assert.deepEqual(z.user(owner), { name: 'Владелец Бота', username: 'boss', registered: 1, pending: '', is_admin: 1 });
    assert.equal((await z.w.api(boss, 'me')).me.is_owner, true);
    assert.ok(z.w.texts(owner).includes('Приятно познакомиться, Владелец Бота! 🎉\n\nСоздай первое событие в приложении — там появится пригласительная ссылка.'));
  });

  it('напоминание до регистрации после пригласительной ссылки — «Участвовать как …»', async () => {
    const z = await world();
    const code = await z.invite(await z.create('Напоминание'));
    const olga = person(401, 'Ольга');
    await z.say(olga, '/start ' + code);
    for (const text of ['/start', '/cancel']) {
      await z.say(olga, text);
      assert.equal(z.last(olga).text, 'Имя в игре — <b>Ольга</b>, как в Telegram. Его увидят твой Санта, владелец и администраторы. Хочешь другое — нажми «✏️ Изменить имя» или просто напиши его.');
      assert.deepEqual(z.last(olga).reply_markup.inline_keyboard, keyboard('Участвовать', 'Ольга'), text);
    }
  });
});

describe('старые кнопки и чужие нажатия (047, US4)', () => {
  let z;
  let code;
  before(async () => {
    z = await world();
    code = await z.invite(await z.create('Повторы'));
  });

  it('кнопка после регистрации — «Имя уже сохранено», без сообщений и изменений', async () => {
    const pavel = person(501, 'Павел');
    await z.say(pavel, '/start ' + code);
    await z.say(pavel, 'Паша');
    const before = z.sent(pavel).length;
    const joined = z.joined(boss, 'Паша');
    for (const data of ['reg:ok', 'reg:edit']) {
      const id = await z.press(person(501, 'Павел Новый'), data, { message_id: 9, date: 1, chat: { id: pavel.id, type: 'private' } });
      assert.deepEqual(z.answers(id), [NAME_SAVED], data);
    }
    assert.equal(z.sent(pavel).length, before);
    assert.equal(z.user(pavel).name, 'Паша');
    assert.equal(z.joined(boss, 'Паша'), joined);
    assert.equal(z.w.calls.filter((c) => c.method === 'editMessageReplyMarkup').length, 0);
  });

  it('человек, о котором бот ничего не знает, — «Сначала зарегистрируйся…», записи нет', async () => {
    const id = await z.press(person(502, 'Чужой'), 'reg:ok');
    assert.deepEqual(z.answers(id), [NOT_REGISTERED]);
    assert.equal(z.user({ id: 502 }), undefined);
  });

  it('прочие кнопки человеку без имени — по-прежнему «Сначала зарегистрируйся…»', async () => {
    const rita = person(503, 'Рита');
    await z.say(rita, '/start ' + code);
    for (const data of ['notify', 'nm:off']) {
      const id = await z.press(rita, data);
      assert.deepEqual(z.answers(id), [NOT_REGISTERED], data);
    }
    assert.equal(z.user(rita).registered, 0);
  });
});

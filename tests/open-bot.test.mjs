// Открытый бот (052, specs/052-open-bot/contracts/open-bot.md): закрытый бот — как раньше (незнакомцу прежний ответ,
// компании создаёт только владелец бота, у людей без прав ответ me прежний); открытый — незнакомец регистрируется именем
// и создаёт свою компанию (владелец, общее название), своих во владении не больше двух (передача и ссылка — без лимита,
// у владельца бота лимита нет), общее название видят люди компании и владелец бота, владелец удаляет пустую компанию.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { invariants, ownerCode } from './support/companies.mjs';

after(restoreFetch);

const boss = { id: 9301, name: 'Владелец', username: 'boss' };
const person = (id, name) => ({ id, name, username: 'u' + id });
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];
const CLOSED_BOT = '🎄 Это закрытый бот для игры в Тайного Санту. Чтобы присоединиться, попроси пригласительную ссылку на событие.';
const HELLO = '🎄 Привет! Это бот для игры в Тайного Санту.';
const NAME_RULE = 'Название комнаты — от 1 до 40 символов.';
const OWN_LIMIT = 'Вести можно не больше двух своих комнат — передай или удали одну из них.';
const OWN_DELETE = 'Удалить комнату может только её владелец.';
const DELETED = 'Владелец удалил комнату, в которой ты был администратором: событий в ней не было.';
const MENU_OPEN = 'Сейчас ты не участвуешь ни в одном идущем событии. Создай свою комнату в приложении или попроси пригласительную ссылку на событие.';
const ME_KEYS = ['companies', 'events', 'limits', 'looks', 'me', 'registered'];
const OPEN_FIELDS = ['shared', 'rename', 'deletable'];

// Мир с владельцем бота; open — открытый бот. Ответы API всем, кроме владельца бота, копятся в seen
async function world(open) {
  const w = await startWorld({ open });
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const seen = [];
  const z = { w };
  z.api = async (u, action, body = {}) => {
    const r = await w.api(u, action, body, true);
    if (u.id !== boss.id) seen.push({ to: u.id, text: `${u.name} ${action}: ${r.text}` });
    return r;
  };
  z.ok = async (u, action, body = {}) => {
    const r = await z.api(u, action, body);
    assert.equal(r.data.ok, true, `${u.name} ${action}: ${r.data.error}`);
    return r.data;
  };
  // Поля словаря приложения (060) — не о компаниях
  z.me = async (u) => {
    const { lang, texts_version, texts, lang_choice, lang_auto, languages, ...me } = await z.ok(u, 'me'); // 060, 061 — тест i18n
    return me;
  };
  // Незнакомец без ссылки: /start и имя текстом
  z.signUp = async (u) => {
    await w.say(u, '/start');
    await w.say(u, u.name);
  };
  z.create = async (u, name) => (await z.ok(u, 'company.create', { name })).company;
  z.event = async (u, company, title, people = []) => {
    const id = (await z.ok(u, 'admin.events.create', { company, title })).event.id;
    const code = inviteOf(await z.ok(u, 'admin.state', { event: id }));
    for (const p of people) {
      const known = w.query('SELECT registered FROM users WHERE tg_id = ?', p.id)[0]?.registered;
      await w.say(p, '/start ' + code);
      if (!known) await w.say(p, p.name);
    }
    return id;
  };
  z.company = (id) => w.query('SELECT * FROM companies WHERE id = ?', id)[0];
  z.row = (company, id) => w.query('SELECT is_admin, label FROM company_members WHERE company_id = ? AND user_id = ?', company, id)[0];
  z.owned = (id) => w.query('SELECT COUNT(*) AS n FROM companies WHERE owner_id = ?', id)[0].n;
  z.botLog = () => w.query('SELECT action, details, actor FROM audit WHERE company_id = 0 AND event_id = 0 ORDER BY id');
  z.sent = (u, part) => w.texts(u).filter((t) => t.includes(part)).length;
  // Всё, что видел человек: ответы API и сообщения бота
  z.seenBy = (u) => [...seen.filter((x) => x.to === u.id).map((x) => x.text), ...w.texts(u)].join('\n');
  return z;
}

describe('052: закрытый бот — как раньше', () => {
  let z;
  const stranger = person(9310, 'Незнакомец');
  const mem = person(9311, 'Аня');
  before(async () => {
    z = await world(false);
    await z.event(boss, 1, 'Ёлка', [mem]);
  });

  it('незнакомцу — прежний ответ на /start и на текст, записи нет', async () => {
    await z.w.say(stranger, '/start');
    await z.w.say(stranger, 'Привет');
    assert.deepEqual(z.w.texts(stranger), [CLOSED_BOT, CLOSED_BOT]);
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM users WHERE tg_id = ?', stranger.id)[0].n, 0);
    assert.deepEqual(await z.me(stranger), { ok: true, registered: false });
  });

  it('создать и удалить компанию человек не может; ответ me — прежний, без полей открытого бота', async () => {
    const r = await z.api(mem, 'company.create', { name: 'Своя' });
    assert.deepEqual([r.status, r.data.error], [403, 'Только для владельца бота.']);
    const d = await z.api(mem, 'company.delete', { company: 1, confirm: 'УДАЛИТЬ' });
    assert.deepEqual([d.status, d.data.error], [403, 'Удалить комнату может только владелец бота.']);
    const me = await z.me(mem);
    assert.deepEqual(Object.keys(me).filter((k) => k !== 'ok').sort(), ME_KEYS);
    for (const c of me.companies) assert.deepEqual(OPEN_FIELDS.filter((k) => k in c), []);
    assert.equal(me.companies[0].title, 'Комната 1');
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM companies')[0].n, 1);
  });

  it('владелец бота: me.create = { bot: true }, company.create — компания, которую ведёт он (название — только ему)', async () => {
    assert.deepEqual((await z.me(boss)).create, { bot: true });
    const id = await z.create(boss, 'Работа');
    const c = z.company(id);
    assert.deepEqual([c.owner_id, c.shared, c.name], [0, 0, 'Работа']);
    assert.equal(z.row(id, boss.id).is_admin, 1);
    assert.deepEqual(z.botLog().at(-1), { action: 'company.create', details: '«Работа»', actor: boss.id });
    assert.deepEqual(invariants(z.w), []);
  });
});

describe('052: открытый бот — незнакомец и своя компания', () => {
  let z;
  const anya = person(9320, 'Аня');
  const borya = person(9321, 'Боря');
  const vera = person(9322, 'Вера');
  before(async () => { z = await world(true); });

  it('незнакомец: /start — приветствие и «Продолжить как …», «✅» — зарегистрирован без компании, меню открытого бота', async () => {
    await z.w.say(anya, '/start');
    const ask = z.w.calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === anya.id).at(-1).params;
    assert.ok(ask.text.startsWith(HELLO), ask.text);
    assert.deepEqual(ask.reply_markup.inline_keyboard.map((row) => row[0].callback_data), ['reg:ok', 'reg:edit']);
    assert.equal(ask.reply_markup.inline_keyboard[0][0].text, `✅ Продолжить как ${anya.name}`);
    assert.deepEqual(await z.me(anya), { ok: true, registered: false, open: true });
    await z.w.press(anya, 'reg:ok');
    const u = z.w.query('SELECT name, registered, pending, is_admin FROM users WHERE tg_id = ?', anya.id)[0];
    assert.deepEqual(u, { name: anya.name, registered: 1, pending: '', is_admin: 0 });
    assert.ok(z.w.texts(anya).some((t) => t.startsWith(`Приятно познакомиться, ${anya.name}! 🎉`)));
    assert.ok(z.w.lastText(anya).includes(MENU_OPEN), z.w.lastText(anya));
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM company_members WHERE user_id = ?', anya.id)[0].n, 0);
  });

  it('незнакомец пишет любой текст — тоже просьба имени; имя текстом — регистрация', async () => {
    await z.w.say(borya, 'Здравствуйте');
    assert.ok(z.w.lastText(borya).startsWith(HELLO));
    await z.w.say(borya, borya.name);
    assert.equal(z.w.query('SELECT registered FROM users WHERE tg_id = ?', borya.id)[0].registered, 1);
    const me = await z.me(borya);
    assert.deepEqual([me.companies, me.open, me.create], [[], true, { left: 2 }]);
  });

  it('создание — владелец компании с общим названием, администратор, журнал бота; me — роль и признаки', async () => {
    const X = await z.create(anya, '  Тайная   поляна ');
    const c = z.company(X);
    assert.deepEqual([c.name, c.owner_id, c.shared, c.created_by], ['Тайная поляна', anya.id, 1, anya.id]);
    assert.equal(z.row(X, anya.id).is_admin, 1);
    assert.equal(z.w.query('SELECT is_admin FROM users WHERE tg_id = ?', anya.id)[0].is_admin, 1);
    assert.deepEqual(z.botLog().at(-1), { action: 'company.create', details: '«Тайная поляна»', actor: anya.id });
    const me = await z.me(anya);
    const [mine] = me.companies;
    assert.deepEqual(
      [mine.id, mine.title, mine.role, mine.organizer, mine.owner, mine.shared, mine.rename, mine.deletable, mine.bot_run],
      [X, 'Тайная поляна', 'owner', true, true, true, true, true, false],
    );
    assert.deepEqual(me.create, { left: 1 });
    assert.deepEqual(invariants(z.w), []);
  });

  it('событие в своей компании: пришедший по ссылке — участник, владельцу — «присоединяется»; он создаёт свою — две строки', async () => {
    const X = z.w.query('SELECT id FROM companies WHERE owner_id = ?', anya.id)[0].id;
    await z.event(anya, X, 'Новый год', [vera]);
    assert.equal(z.sent(anya, 'присоединяется'), 1);
    let me = await z.me(vera);
    assert.deepEqual(me.companies.map((c) => [c.title, c.role, !!c.rename, !!c.deletable]), [['Тайная поляна', 'member', false, false]]);
    assert.deepEqual(me.create, { left: 2 });
    const V = await z.create(vera, 'Верина');
    me = await z.me(vera);
    assert.deepEqual(me.companies.map((c) => [c.id, c.title, c.role]), [[X, 'Тайная поляна', 'member'], [V, 'Верина', 'owner']]);
    assert.deepEqual(invariants(z.w), []);
  });

  it('меню человека с двумя компаниями — общее название компании у события', async () => {
    await z.w.say(vera, '/start');
    assert.ok(z.w.lastText(vera).includes('«Новый год» (Тайная поляна)'), z.w.lastText(vera));
  });
});

describe('052: не больше двух своих комнат', () => {
  let z;
  const anya = person(9330, 'Аня');
  const borya = person(9331, 'Боря');
  const carol = person(9332, 'Карина');
  let X;
  let Y;
  before(async () => {
    z = await world(true);
    for (const u of [anya, borya, carol]) await z.signUp(u);
  });

  it('две — можно, третья — отказ, ничего не записано; me.create.left по шагам', async () => {
    assert.deepEqual((await z.me(anya)).create, { left: 2 });
    X = await z.create(anya, 'Первая');
    assert.deepEqual((await z.me(anya)).create, { left: 1 });
    Y = await z.create(anya, 'Вторая');
    assert.deepEqual((await z.me(anya)).create, { left: 0 });
    const before3 = [z.w.query('SELECT COUNT(*) AS n FROM companies')[0].n, z.botLog().length];
    const r = await z.api(anya, 'company.create', { name: 'Третья' });
    assert.deepEqual([r.status, r.data.error], [400, OWN_LIMIT]);
    assert.deepEqual([z.w.query('SELECT COUNT(*) AS n FROM companies')[0].n, z.botLog().length], before3);
  });

  it('передал одну — снова можно', async () => {
    await z.event(anya, Y, 'Во второй', [borya]);
    await z.ok(anya, 'admin.owner.transfer', { company: Y, id: borya.id });
    assert.equal(z.company(Y).owner_id, borya.id);
    assert.deepEqual((await z.me(anya)).create, { left: 1 });
    await z.create(anya, 'Третья');
    assert.equal(z.owned(anya.id), 2);
  });

  it('владелец двух получает третью передачей и четвёртую ссылкой владельца — без лимита; создать — нельзя', async () => {
    await z.create(borya, 'Борина');
    assert.equal(z.owned(borya.id), 2);
    const K = await z.create(carol, 'Клуб');
    await z.event(carol, K, 'Клубное', [borya]);
    await z.ok(carol, 'admin.owner.transfer', { company: K, id: borya.id });
    const B = await z.create(boss, 'От владельца бота');
    const { link } = await z.ok(boss, 'bot.company.link', { company: B, on: true });
    await z.w.say(borya, '/start ' + ownerCode(link));
    assert.equal(z.company(B).owner_id, borya.id);
    assert.equal(z.owned(borya.id), 4);
    assert.deepEqual((await z.me(borya)).create, { left: 0 });
    const r = await z.api(borya, 'company.create', { name: 'Пятая' });
    assert.deepEqual([r.status, r.data.error], [400, OWN_LIMIT]);
    assert.deepEqual(invariants(z.w), []);
  });

  it('владелец бота — без лимита', async () => {
    for (const name of ['Б1', 'Б2', 'Б3']) await z.create(boss, name);
    assert.deepEqual((await z.me(boss)).create, { bot: true });
  });

  it('повтор названия за минуту — «только что создана»; пустое и длинное — правило названия', async () => {
    const r = await z.api(carol, 'company.create', { name: 'Клуб' });
    assert.deepEqual([r.status, r.data.error], [400, 'Комната с таким названием только что создана.']);
    for (const name of ['   ', 'я'.repeat(41)]) {
      const e = await z.api(carol, 'company.create', { name });
      assert.deepEqual([e.status, e.data.error], [400, NAME_RULE]);
    }
  });
});

describe('052: общее название', () => {
  let z;
  const anya = person(9340, 'Аня');
  const vera = person(9341, 'Вера');
  const outsider = person(9342, 'Гоша');
  let X;
  let S;
  before(async () => {
    z = await world(true);
    for (const u of [anya, outsider]) await z.signUp(u);
    X = await z.create(anya, 'Тайная поляна');
    await z.event(anya, X, 'Ёлка', [vera]);
    await z.create(outsider, 'Своя у Гоши');
  });

  it('участник видит общее название; своё — важнее; пустое своё — снова общее', async () => {
    const title = async () => (await z.me(vera)).companies.find((c) => c.id === X).title;
    assert.equal(await title(), 'Тайная поляна');
    assert.equal((await z.ok(vera, 'company.label.set', { company: X, label: 'Работа' })).title, 'Работа');
    assert.equal(await title(), 'Работа');
    assert.equal((await z.ok(vera, 'company.label.set', { company: X, label: '' })).title, 'Тайная поляна');
    assert.equal(await title(), 'Тайная поляна');
  });

  it('владелец меняет общее название (своё стирается) — видят все без своего и владелец бота; пустое — отказ', async () => {
    z.w.sql(`UPDATE company_members SET label = 'Моя' WHERE company_id = ${X} AND user_id = ${anya.id}`);
    const logged = z.w.query('SELECT COUNT(*) AS n FROM audit')[0].n;
    const blank = await z.api(anya, 'company.label.set', { company: X, label: '  ' });
    assert.deepEqual([blank.status, blank.data.error], [400, NAME_RULE]);
    assert.equal((await z.ok(anya, 'company.label.set', { company: X, label: 'Поляна' })).title, 'Поляна');
    assert.deepEqual([z.company(X).name, z.row(X, anya.id).label], ['Поляна', '']);
    const titles = async (u) => (await z.me(u)).companies.find((c) => c.id === X)?.title;
    assert.deepEqual([await titles(anya), await titles(vera), await titles(boss)], ['Поляна', 'Поляна', 'Поляна']);
    await z.ok(vera, 'company.label.set', { company: X, label: 'Работа' });
    assert.equal(await titles(vera), 'Работа');
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM audit')[0].n, logged, 'смена названия журнала не пишет');
  });

  it('названия компании нет у человека вне её — ни в ответах, ни в сообщениях бота', async () => {
    await z.w.say(outsider, '/start');
    await z.me(outsider);
    const r = await z.api(outsider, 'company.label.set', { company: X, label: 'Подглядеть' });
    assert.equal(r.status, 404);
    const all = z.seenBy(outsider);
    for (const name of ['Тайная поляна', 'Поляна']) assert.ok(!all.includes(name), `«${name}» у постороннего`);
  });

  it('компания владельца бота: её название — только ему, её люди видят «Компания N»', async () => {
    S = await z.create(boss, 'Секрет владельца');
    await z.event(boss, S, 'Корпоратив', [vera]);
    const me = await z.me(vera);
    const c = me.companies.find((x) => x.id === S);
    assert.deepEqual([c.title, 'shared' in c], ['Комната 2', false]);
    assert.ok(!z.seenBy(vera).includes('Секрет владельца'));
    assert.equal((await z.me(boss)).companies.find((x) => x.id === S).title, 'Секрет владельца');
    assert.deepEqual(invariants(z.w), []);
  });
});

describe('052: удаление своей пустой компании', () => {
  let z;
  const anya = person(9350, 'Аня');
  const vera = person(9351, 'Вера');
  let P;
  let ev;
  before(async () => {
    z = await world(true);
    await z.signUp(anya);
    P = await z.create(anya, 'Пустая');
    ev = await z.event(anya, P, 'Было', [vera]);
    await z.ok(anya, 'admin.role.grant', { company: P, id: vera.id });
  });

  it('с событием — отказ; администратор — не владелец — отказ; слово — отказ', async () => {
    const has = await z.api(anya, 'company.delete', { company: P, confirm: 'УДАЛИТЬ' });
    assert.deepEqual([has.status, has.data.error], [400, 'В комнате есть события — сначала удали их.']);
    await z.ok(anya, 'admin.event.delete', { event: ev, confirm: 'УДАЛИТЬ' });
    const adm = await z.api(vera, 'company.delete', { company: P, confirm: 'УДАЛИТЬ' });
    assert.deepEqual([adm.status, adm.data.error], [403, OWN_DELETE]);
    const word = await z.api(anya, 'company.delete', { company: P, confirm: 'удали' });
    assert.deepEqual([word.status, word.data.error], [400, 'Для удаления введи слово УДАЛИТЬ.']);
    assert.ok(z.company(P));
  });

  it('владелец удаляет пустую: строк компании нет, администратору — сообщение, журнал бота, признак пересчитан; повтор — 404', async () => {
    const meBefore = await z.me(anya);
    assert.equal(meBefore.companies.find((c) => c.id === P).deletable, true);
    await z.ok(anya, 'company.delete', { company: P, confirm: ' удалить ' });
    assert.equal(z.company(P), undefined);
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM company_members WHERE company_id = ?', P)[0].n, 0);
    assert.equal(z.sent(vera, DELETED), 1);
    assert.equal(z.sent(anya, DELETED), 0);
    assert.deepEqual(z.botLog().at(-1), { action: 'company.delete', details: '«Пустая», людей: 2', actor: anya.id });
    assert.deepEqual(z.w.query('SELECT tg_id, is_admin FROM users WHERE tg_id IN (?, ?) ORDER BY tg_id', anya.id, vera.id),
      [{ tg_id: anya.id, is_admin: 0 }, { tg_id: vera.id, is_admin: 0 }]);
    const again = await z.api(anya, 'company.delete', { company: P, confirm: 'УДАЛИТЬ' });
    assert.deepEqual([again.status, again.data.error], [404, 'Комната не найдена.']);
    const me = await z.me(anya);
    assert.deepEqual([me.companies, me.create], [[], { left: 2 }]);
    assert.deepEqual(invariants(z.w), []);
  });
});

describe('052: открытый бот, владельца бота ещё нет', () => {
  it('люди создают компании, назначают и снимают администраторов, удаляют компанию — общий признак без ошибок', async () => {
    const w = await startWorld({ open: true });
    await w.setup();
    const anya = person(9360, 'Аня');
    const vera = person(9361, 'Вера');
    for (const u of [anya]) {
      await w.say(u, '/start');
      await w.say(u, u.name);
    }
    assert.equal(w.query("SELECT COUNT(*) AS n FROM settings WHERE key = 'owner_id' AND value != ''")[0].n, 0);
    const C = (await w.api(anya, 'company.create', { name: 'Без владельца бота' })).company;
    const ev = (await w.api(anya, 'admin.events.create', { company: C, title: 'Ёлка' })).event.id;
    await w.say(vera, '/start ' + inviteOf(await w.api(anya, 'admin.state', { event: ev })));
    await w.say(vera, vera.name);
    await w.api(anya, 'admin.role.grant', { company: C, id: vera.id });
    await w.api(anya, 'admin.role.revoke', { company: C, id: vera.id });
    assert.equal(w.query('SELECT is_admin FROM users WHERE tg_id = ?', vera.id)[0].is_admin, 0);
    await w.api(anya, 'admin.event.delete', { event: ev, confirm: 'УДАЛИТЬ' });
    await w.api(anya, 'company.delete', { company: C, confirm: 'УДАЛИТЬ' });
    assert.deepEqual(w.query('SELECT tg_id, is_admin FROM users ORDER BY tg_id'), [{ tg_id: anya.id, is_admin: 0 }, { tg_id: vera.id, is_admin: 0 }]);
    assert.deepEqual(invariants(w), []);
  });
});

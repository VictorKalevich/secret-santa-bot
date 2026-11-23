// Компании, шаг 2 (051, specs/051-companies/contracts/companies.md): создание и названия, владелец компании (назначение,
// передача, «Вести самому», ссылка владельца own_<код>), видимость и названия по умолчанию, гость, удаление компании,
// журнал бота, тексты «владелец» и «владелец бота», меню бота. Название компании, которое дал владелец бота, и ссылка
// владельца не уходят никому другому — проверяется перебором ответов и сообщений сценария.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { invariants, newCompany, ownerCode } from './support/companies.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const person = (id, name) => ({ id, name, username: 'u' + id });
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];
const NAME_RULE = 'Название компании — от 1 до 40 символов.';
const BOT_ONLY = 'Только для владельца бота.';
const NEW_OWNER = '👑 Ты — владелец своей компании в «Тайном Санте»: создаёшь события, приглашаешь людей, назначаешь администраторов.';
const GONE = 'Эта ссылка владельца уже использована или отозвана. Попроси новую.';

// Мир: владелец бота, «Основная» (№1) с событием и её администратором. Ответы API всем, кроме владельца бота, и сообщения
// бота им же копятся в others() — для проверки «название и ссылка не утекли»
async function bossWorld() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const seen = [];
  const z = { w, seen };
  z.api = async (u, action, body = {}) => {
    const r = await w.api(u, action, body, true);
    if (u.id !== boss.id) seen.push(`${u.name} ${action}: ${r.text}`);
    return r;
  };
  z.ok = async (u, action, body = {}) => {
    const r = await z.api(u, action, body);
    assert.equal(r.data.ok, true, `${u.name} ${action}: ${r.data.error}`);
    return r.data;
  };
  z.join = async (ev, people) => {
    const code = inviteOf(await w.api(boss, 'admin.state', { event: ev }));
    for (const u of people) {
      const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
      await w.say(u, '/start ' + code);
      if (!known) await w.say(u, u.name);
    }
  };
  z.event = async (company, title, people = []) => {
    const id = (await w.api(boss, 'admin.events.create', { title, company })).event.id;
    await z.join(id, people);
    return id;
  };
  z.others = () => [
    ...seen,
    ...w.calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id !== boss.id).map((c) => `→${c.params.chat_id}: ${c.params.text}`),
  ];
  z.botLog = () => w.query("SELECT action, details, actor FROM audit WHERE company_id = 0 AND event_id = 0 ORDER BY id");
  z.companyLog = (company) => w.query('SELECT action, details, actor FROM audit WHERE company_id = ? AND event_id = 0 ORDER BY id', company);
  z.row = (company, id) => w.query('SELECT is_admin, label FROM company_members WHERE company_id = ? AND user_id = ?', company, id)[0];
  z.company = (id) => w.query('SELECT * FROM companies WHERE id = ?', id)[0];
  z.adm = person(9101, 'Альфа-админ');
  z.mem = person(1101, 'Аня');
  z.E1 = await z.event(1, 'Основное событие', [z.adm, z.mem]);
  await w.api(boss, 'admin.role.grant', { company: 1, id: z.adm.id });
  return z;
}

describe('051: создание компании (US1)', () => {
  let z;
  before(async () => { z = await bossWorld(); });

  it('компания, строка владельца бота (администратор, I2), журнал бота; название — схлопнутые пробелы', async () => {
    const { company } = await z.ok(boss, 'bot.company.create', { name: '  Работа   над\nошибками ' });
    const c = z.company(company);
    assert.equal(c.name, 'Работа над ошибками');
    assert.equal(c.owner_id, 0);
    assert.equal(c.created_by, boss.id);
    assert.equal(c.owner_code, '');
    assert.equal(z.row(company, boss.id).is_admin, 1);
    assert.deepEqual(z.botLog().at(-1), { action: 'company.create', details: '«Работа над ошибками»', actor: boss.id });
    assert.deepEqual(z.companyLog(company), [], 'в журнал компании создание не пишется');
    const { entries } = await z.ok(boss, 'bot.audit');
    assert.equal(entries[0].action, 'company.create');
    assert.deepEqual(invariants(z.w), []);
  });

  it('двойное нажатие в одну миллисекунду — одна компания и одна запись; другое название — сразу можно', async () => {
    const rs = await z.w.together([1, 2].map(() => () => z.w.api(boss, 'bot.company.create', { name: 'Дубль' }, true)), { sameMoment: true });
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 400]);
    assert.equal(rs.find((r) => r.status === 400).data.error, 'Компания с таким названием только что создана.');
    assert.equal(z.w.query("SELECT COUNT(*) AS n FROM companies WHERE name = 'Дубль'")[0].n, 1);
    assert.equal(z.w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'company.create' AND details = '«Дубль»'")[0].n, 1);
    assert.equal((await z.w.api(boss, 'bot.company.create', { name: 'Дубль 2' }, true)).status, 200);
    assert.deepEqual(invariants(z.w), []);
  });

  it('правила названия: пусто и длиннее 40 — отказ, 40 — можно', async () => {
    for (const name of ['', '   ', 'я'.repeat(41), undefined]) {
      const r = await z.w.api(boss, 'bot.company.create', { name }, true);
      assert.equal(r.status, 400, String(name));
      assert.equal(r.data.error, NAME_RULE);
    }
    assert.equal((await z.w.api(boss, 'bot.company.create', { name: 'я'.repeat(40) }, true)).status, 200);
  });

  it('не владельцу бота (участник, администратор, владелец компании) — 403 на каждом bot.*', async () => {
    const owner = person(1301, 'Оля');
    const c = await newCompany(z.w, boss, 'Для Оли');
    const { link } = await z.ok(boss, 'bot.company.link', { company: c, on: true });
    await z.w.say(owner, '/start ' + ownerCode(link));
    await z.w.say(owner, owner.name);
    assert.equal(z.company(c).owner_id, owner.id);
    for (const u of [z.mem, z.adm, owner]) {
      for (const [a, b] of [
        ['bot.company.create', { name: 'Своя' }], ['bot.company.link', { company: c, on: true }],
        ['bot.company.delete', { company: c, confirm: 'УДАЛИТЬ' }], ['bot.owner.transfer', { id: u.id }], ['bot.audit', {}],
      ]) {
        const r = await z.api(u, a, b);
        assert.equal(r.status, 403, `${u.name} ${a}`);
        assert.equal(r.data.error, BOT_ONLY);
      }
    }
  });

  it('новая компания без владельца: владелец бота в ней владелец — создаёт событие, получает «присоединяется»', async () => {
    const c = await newCompany(z.w, boss, 'Своя без владельца');
    const ev = (await z.ok(boss, 'admin.events.create', { company: c, title: 'В новой' })).event.id;
    assert.equal(z.w.query('SELECT company_id FROM events WHERE id = ?', ev)[0].company_id, c);
    const before = z.w.texts(boss).length;
    await z.join(ev, [person(1401, 'Новичок')]);
    assert.ok(z.w.texts(boss).slice(before).some((t) => t.includes('присоединяется')));
    const { users, owner_id } = await z.ok(boss, 'admin.users', { company: c });
    assert.equal(owner_id, boss.id);
    assert.deepEqual(users.map((u) => u.name).sort(), ['Владелец', 'Новичок'], 'владелец бота — человек своей компании');
    assert.deepEqual(invariants(z.w), []);
  });

  it('событие в несуществующей компании — 404 «Компания не найдена.», ничего не записано', async () => {
    const before = z.w.query('SELECT COUNT(*) AS n FROM events')[0].n;
    const r = await z.w.api(boss, 'admin.events.create', { company: 999, title: 'Никуда' }, true);
    assert.equal(r.status, 403, 'компании нет — конвейер: не организатор');
    // Компания удалена между проверкой конвейера и записью — условие пакета
    const c = await newCompany(z.w, boss, 'Исчезнет');
    z.w.beforeWrite('INSERT INTO events', () => z.w.sql(`DELETE FROM company_members WHERE company_id = ${c}; DELETE FROM companies WHERE id = ${c}`));
    const gone = await z.w.api(boss, 'admin.events.create', { company: c, title: 'Не будет' }, true);
    assert.equal(gone.status, 404);
    assert.equal(gone.data.error, 'Компания не найдена.');
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM events')[0].n, before);
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM audit WHERE event_id NOT IN (SELECT id FROM events) AND event_id != 0')[0].n, 0);
  });

  it('название владельца бота — ни в одном ответе и сообщении другим людям', async () => {
    const SECRET = 'Тайная-Корпорация';
    const c = await newCompany(z.w, boss, SECRET);
    const [p1, p2, p3] = [person(1501, 'Пётр'), person(1502, 'Полина'), person(1503, 'Павел')];
    const ev = await z.event(c, 'Событие корпорации', [p1, p2, p3]);
    await z.ok(boss, 'admin.role.grant', { company: c, id: p1.id });
    for (const u of [p1, p2, p3]) {
      await z.ok(u, 'me');
      await z.ok(u, 'event.get', { event: ev });
    }
    for (const a of ['admin.users', 'admin.audit', 'admin.families']) await z.ok(p1, a, { company: c });
    await z.ok(p1, 'admin.state', { event: ev });
    await z.ok(p1, 'admin.audit', { event: ev });
    await z.ok(p1, 'admin.announce', { event: ev, text: 'Привет всем' });
    // Владелец по ссылке и смена владельца: сообщения ему и администраторам — без названия
    const { link } = await z.ok(boss, 'bot.company.link', { company: c, on: true });
    await z.w.say(p3, '/start ' + ownerCode(link));
    await z.ok(p3, 'me');
    await z.ok(p3, 'admin.users', { company: c });
    await z.ok(p3, 'admin.audit', { company: c });
    await z.ok(p3, 'admin.owner.transfer', { company: c, id: p1.id });
    await z.ok(boss, 'admin.owner.transfer', { company: c, id: boss.id });
    await z.ok(p1, 'me');
    const leaks = z.others().filter((t) => t.includes(SECRET));
    assert.deepEqual(leaks, []);
    assert.ok(z.w.texts(boss).some((t) => t.includes(SECRET)), 'владельцу бота название приходит');
    assert.ok(z.companyLog(c).length >= 3 && z.companyLog(c).every((r) => !r.details.includes(SECRET)), 'журнал компании — без названия');
  });
});

describe('051: владелец компании (US2)', () => {
  let z;
  let C;
  let evC;
  const [x, y, q, s] = [person(2001, 'Ксения'), person(2002, 'Юрий'), person(2003, 'Кира'), person(2004, 'Сеня')];
  before(async () => {
    z = await bossWorld();
    C = await newCompany(z.w, boss, 'Клуб');
    evC = await z.event(C, 'Событие клуба', [x, y, q, s]);
    await z.join(z.E1, [x]); // Ксения — ещё и в «Основной»
  });

  it('назначение человека компании: владелец, администратор, сообщение, журналы; владелец бота — гость', async () => {
    const t0 = z.w.texts(x).length;
    await z.ok(boss, 'admin.owner.transfer', { company: C, id: x.id });
    assert.equal(z.company(C).owner_id, x.id);
    assert.equal(z.row(C, x.id).is_admin, 1);
    assert.equal(z.w.query('SELECT is_admin FROM users WHERE tg_id = ?', x.id)[0].is_admin, 1);
    assert.equal(z.row(C, boss.id), undefined, 'владелец бота не участник событий компании — строки нет');
    assert.deepEqual(z.w.texts(x).slice(t0), [NEW_OWNER]);
    assert.deepEqual(z.companyLog(C).at(-1), { action: 'company.owner', details: '→ Ксения', actor: boss.id });
    assert.deepEqual(z.botLog().at(-1), { action: 'company.owner', details: '«Клуб»: → Ксения', actor: boss.id });
    assert.deepEqual(invariants(z.w, { guests: [] }), []);
    const me = await z.ok(x, 'me');
    // Порядок — по времени вступления: сначала «Клуб», потом «Основная»
    assert.deepEqual(me.companies.map((c) => [c.id, c.role, c.owner, c.bot_run]), [[C, 'owner', true, false], [1, 'member', false, true]]);
  });

  it('владелец компании — действия владельца в своей компании; чужое событие — 404; admin.transfer и bot.* — нет', async () => {
    const t0 = z.w.texts(y).length;
    await z.ok(x, 'admin.role.grant', { company: C, id: y.id });
    assert.ok(z.w.texts(y).slice(t0).some((t) => t.includes('назначил тебя администратором')));
    await z.ok(x, 'admin.draw', { event: evC });
    const vault = await z.ok(x, 'admin.vault.pairs', { event: evC, confirm: 'ОТКРЫТЬ' });
    assert.equal(vault.pairs.length, 4);
    assert.equal((await z.api(x, 'admin.state', { event: z.E1 })).status, 404);
    const transfer = await z.api(x, 'admin.transfer', { company: C, from: q.id, to: s.id });
    assert.equal(transfer.status, 403);
    assert.equal(transfer.data.error, 'Переносить участие на новый аккаунт может только владелец бота.');
    assert.equal((await z.api(x, 'bot.audit')).data.error, BOT_ONLY);
  });

  it('тексты: в компании с назначенным владельцем — «владелец», в компании владельца бота — прежние', async () => {
    const grant = await z.api(y, 'admin.role.grant', { company: C, id: q.id });
    assert.equal(grant.status, 403);
    assert.equal(grant.data.error, 'Назначать и снимать администраторов может только владелец.');
    const vault = await z.api(y, 'admin.vault.pairs', { event: evC, confirm: 'ОТКРЫТЬ' });
    assert.equal(vault.data.error, 'Служебный просмотр доступен только владельцу.');
    const old = await z.api(z.adm, 'admin.role.grant', { company: 1, id: z.mem.id });
    assert.equal(old.data.error, 'Назначать и снимать администраторов может только владелец бота.');
    assert.equal((await z.api(y, 'admin.participate', { event: evC, on: true })).data.error,
      'После жеребьёвки так нельзя. Попроси владельца вписать тебя.');
    // Причина отказа жеребьёвки видна и администраторам: убрать закреплённые пары может владелец компании
    const ev2 = (await z.ok(x, 'admin.events.create', { company: C, title: 'Второе событие клуба' })).event.id;
    await z.join(ev2, [y, q, s]);
    await z.ok(x, 'admin.ring', { event: ev2, on: false });
    await z.ok(x, 'admin.fixed.add', { event: ev2, giver: y.id, receiver: q.id, mutual: true });
    await z.ok(x, 'admin.ring', { event: ev2, on: true });
    assert.ok((await z.ok(y, 'admin.draw.check', { event: ev2 })).problems.includes(
      'Мешают закреплённые пары: с ними распределить всех по правилам не получается. Владелец может убрать часть закреплённых пар.'));
  });

  it('передача владельцем компании: новый — владелец, прежний — администратор; сообщения и отказы', async () => {
    const [ty, tb, tq] = [z.w.texts(y).length, z.w.texts(boss).length, z.w.texts(q).length];
    await z.ok(x, 'admin.owner.transfer', { company: C, id: y.id });
    assert.equal(z.company(C).owner_id, y.id);
    assert.equal(z.row(C, x.id).is_admin, 1, 'прежний владелец остаётся администратором');
    assert.match(z.w.texts(y).slice(ty).join('\n'), /Тебе переданы права владельца компании/);
    assert.deepEqual(z.w.texts(boss).slice(tb), ['ℹ️ <b>Ксения</b> передал(а) права владельца компании «Клуб»: теперь владелец — <b>Юрий</b>.']);
    assert.equal(z.w.texts(q).length, tq, 'не организатору — ничего');
    assert.deepEqual(z.companyLog(C).at(-1), { action: 'company.owner', details: '→ Юрий', actor: x.id });
    assert.equal((await z.api(y, 'admin.owner.transfer', { company: C, id: y.id })).data.error, 'Ты и так владелец.');
    assert.equal((await z.api(boss, 'admin.owner.transfer', { company: C, id: y.id })).data.error, 'Он(а) уже владелец.');
    assert.equal((await z.api(y, 'admin.owner.transfer', { company: C, id: 777 })).data.error,
      'Передать права владельца можно только зарегистрированному человеку.');
    assert.equal((await z.api(x, 'admin.owner.transfer', { company: C, id: x.id })).status, 403, 'бывший владелец — уже нет');
    assert.deepEqual(invariants(z.w), []);
  });

  it('«Вести самому»: компания снова у владельца бота, прежний владелец — администратор', async () => {
    const [ty, tb] = [z.w.texts(y).length, z.w.texts(boss).length];
    await z.ok(boss, 'admin.owner.transfer', { company: C, id: boss.id });
    assert.equal(z.company(C).owner_id, 0);
    assert.equal(z.row(C, boss.id).is_admin, 1, 'I2');
    assert.equal(z.row(C, y.id).is_admin, 1);
    assert.deepEqual(z.w.texts(y).slice(ty), ['ℹ️ Компанию снова ведёт владелец бота. Ты остаёшься администратором.']);
    assert.equal(z.w.texts(boss).length, tb, 'владельцу бота при «Вести самому» — ничего');
    assert.deepEqual(z.botLog().at(-1), { action: 'company.owner', details: '«Клуб»: → владелец бота', actor: boss.id });
    assert.deepEqual(invariants(z.w), []);
    assert.equal((await z.api(y, 'admin.role.grant', { company: C, id: q.id })).data.error,
      'Назначать и снимать администраторов может только владелец бота.');
  });

  it('владелец бота участник событий компании — после назначения остаётся в ней без прав', async () => {
    const D = await newCompany(z.w, boss, 'С участием');
    const evD = await z.event(D, 'Событие с владельцем', [q]);
    await z.ok(boss, 'admin.participate', { event: evD, on: true });
    await z.ok(boss, 'admin.owner.transfer', { company: D, id: q.id });
    assert.equal(z.row(D, boss.id).is_admin, 0);
    assert.deepEqual(invariants(z.w), []);
  });

  it('ссылка владельца: каждая строка таблицы раздела 4', async () => {
    const L = await newCompany(z.w, boss, 'По ссылке');
    const link = async () => ownerCode((await z.ok(boss, 'bot.company.link', { company: L, on: true })).link);
    const last2 = (u) => z.w.texts(u).slice(-2);
    // владелец бота
    let code = await link();
    await z.w.say(boss, '/start ' + code);
    assert.equal(last2(boss)[0], 'Ты владелец бота — эту компанию и так ведёшь ты.');
    // зарегистрированный человек
    const tb = z.w.texts(boss).length;
    await z.w.say(s, '/start ' + code);
    assert.equal(last2(s)[0], NEW_OWNER + ' Всё — в приложении.');
    assert.equal(z.company(L).owner_id, s.id);
    assert.equal(z.company(L).owner_code, '', 'код стёрт');
    assert.deepEqual(z.w.texts(boss).slice(tb), ['👑 <b>Сеня</b> (@u2004) — теперь владелец компании «По ссылке».']);
    assert.deepEqual(z.companyLog(L).at(-1), { action: 'company.owner', details: 'по ссылке: Сеня', actor: s.id });
    // тот же код ещё раз — «использована»
    await z.w.say(s, '/start ' + code);
    assert.equal(last2(s)[0], GONE);
    // уже владелец — по новой ссылке
    code = await link();
    await z.w.say(s, '/start ' + code);
    assert.equal(last2(s)[0], 'Ты уже владелец.');
    assert.notEqual(z.company(L).owner_code, '', 'код цел');
    // новый человек: имя текстом
    const n1 = person(3001, 'Нина');
    await z.w.say(n1, '/start ' + code);
    assert.match(z.w.lastText(n1), /^👑 Ты — владелец своей компании/);
    assert.match(z.w.query('SELECT pending FROM users WHERE tg_id = ?', n1.id)[0].pending, new RegExp(`^name_own:${L}:`));
    assert.equal(z.company(L).owner_id, s.id, 'до имени прав нет');
    await z.w.say(n1, n1.name);
    assert.ok(z.w.texts(n1).some((t) => t === 'Приятно познакомиться, Нина! 🎉\n\nСоздай первое событие в приложении — там появится пригласительная ссылка.'));
    assert.equal(z.company(L).owner_id, n1.id);
    assert.equal(z.row(L, s.id).is_admin, 1, 'прежний владелец — администратор');
    // новый человек: кнопкой «Продолжить как …»
    const n2 = person(3002, 'Ник');
    code = await link();
    await z.w.say(n2, '/start ' + code);
    await z.w.press(n2, 'reg:ok');
    assert.equal(z.company(L).owner_id, n2.id);
    // отзыв во время ввода имени
    const n3 = person(3003, 'Пётр');
    code = await link();
    await z.w.say(n3, '/start ' + code);
    await z.ok(boss, 'bot.company.link', { company: L, on: false });
    await z.w.say(n3, n3.name);
    assert.ok(z.w.texts(n3).some((t) => t === 'Приятно познакомиться, Пётр! 🎉\n\nСсылка владельца уже использована или отозвана. Попроси новую.'));
    assert.equal(z.w.query('SELECT registered FROM users WHERE tg_id = ?', n3.id)[0].registered, 1);
    assert.equal(z.company(L).owner_id, n2.id);
    // замена: прежняя ссылка не действует
    const old = await link();
    await link();
    await z.w.say(q, '/start ' + old);
    assert.equal(last2(q)[0], GONE);
    assert.equal(z.company(L).owner_id, n2.id);
    assert.deepEqual(invariants(z.w), []);
  });

  it('журнал бота: ссылка — «создана» / «отозвана», только при изменении', async () => {
    const K = await newCompany(z.w, boss, 'Журнал ссылок');
    const before = z.botLog().length;
    await z.ok(boss, 'bot.company.link', { company: K, on: false });
    assert.equal(z.botLog().length, before, 'отзыв без ссылки — без записи');
    await z.ok(boss, 'bot.company.link', { company: K, on: true });
    await z.ok(boss, 'bot.company.link', { company: K, on: false });
    await z.ok(boss, 'bot.company.link', { company: K, on: false });
    assert.deepEqual(z.botLog().slice(before).map((r) => r.details), ['«Журнал ссылок»: создана', '«Журнал ссылок»: отозвана']);
    z.w.sql("DELETE FROM settings WHERE key = 'bot_username'");
    const r = await z.w.api(boss, 'bot.company.link', { company: K, on: true }, true);
    assert.equal(r.data.error, 'Сначала открой страницу настройки /setup (см. README).');
    z.w.sql("INSERT INTO settings (key, value) VALUES ('bot_username', 'santa_test_bot')");
  });

  it('ссылка владельца — только в ответе bot.company.link: не в me, журналах и сообщениях', async () => {
    const M = await newCompany(z.w, boss, 'Без утечки');
    const { link } = await z.ok(boss, 'bot.company.link', { company: M, on: true });
    const code = ownerCode(link).slice(4);
    const me = await z.w.api(boss, 'me', {}, true);
    assert.equal(me.data.companies.find((c) => c.id === M).link, true);
    assert.ok(!me.text.includes(code));
    assert.ok(!(await z.w.api(boss, 'bot.audit', {}, true)).text.includes(code));
    assert.ok(!(await z.w.api(boss, 'admin.audit', { company: M }, true)).text.includes(code));
    assert.deepEqual(z.w.calls.filter((c) => JSON.stringify(c.params).includes(code)), []);
    assert.deepEqual(z.others().filter((t) => t.includes(code)), []);
  });

  it('admin.rename человека из двух компаний — только он сам или владелец бота', async () => {
    const r = await z.api(z.adm, 'admin.rename', { company: 1, id: x.id, name: 'Ксю' });
    assert.equal(r.status, 400);
    assert.equal(r.data.error, 'Имя этого человека меняет он сам: «Профиль» → «✏️ Изменить имя».');
    await z.ok(boss, 'admin.rename', { company: 1, id: x.id, name: 'Ксю' });
    assert.equal(z.w.query('SELECT name FROM users WHERE tg_id = ?', x.id)[0].name, 'Ксю');
    await z.ok(z.adm, 'admin.rename', { company: 1, id: z.mem.id, name: 'Анна' });
  });
});

describe('051: видимость и названия (US3)', () => {
  let z;
  let C;
  let evC;
  const [a, b, c, d] = [person(3001, 'Арина'), person(3002, 'Борис'), person(3003, 'Вика'), person(3004, 'Гоша')];
  const LABEL = 'Секретный-Ярлык';
  const ids = (me) => me.companies.map((x) => [x.id, x.title, x.named]);
  before(async () => {
    z = await bossWorld();
    await z.join(z.E1, [a, d]);
    C = await newCompany(z.w, boss, 'Клуб-тайна');
    evC = await z.event(C, 'Событие клуба', [a, b, c]);
    await z.ok(boss, 'admin.role.grant', { company: C, id: c.id });
  });

  it('видимость: участник события, администратор; названия по умолчанию — «Компания N» по времени вступления', async () => {
    const meA = await z.ok(a, 'me');
    assert.deepEqual(ids(meA), [[1, 'Компания 1', false], [C, 'Компания 2', false]]);
    assert.deepEqual(meA.companies.map((x) => [x.role, x.bot_run, x.owner_name]), [['member', true, 'Владелец'], ['member', true, 'Владелец']]);
    assert.deepEqual(meA.events.map((e) => [e.id, e.company]).sort((x, y) => x[0] - y[0]), [[z.E1, 1], [evC, C]]);
    assert.equal((await z.ok(a, 'event.get', { event: evC })).event.company, C);
    assert.deepEqual(ids(await z.ok(b, 'me')), [[C, 'Компания 1', false]], 'одна компания — её номер 1');
    assert.deepEqual(ids(await z.ok(d, 'me')), [[1, 'Компания 1', false]]);
    // Администратор без событий компании её видит; участник после выхода из единственного события — нет
    await z.ok(c, 'event.leave', { event: evC, confirm: 'ВЫЙТИ' });
    assert.deepEqual((await z.ok(c, 'me')).companies.map((x) => [x.id, x.role]), [[C, 'admin']]);
    await z.ok(b, 'event.leave', { event: evC, confirm: 'ВЫЙТИ' });
    assert.deepEqual((await z.ok(b, 'me')).companies, []);
    // Владелец бота видит все компании под своими названиями
    assert.deepEqual(ids(await z.ok(boss, 'me')), [[1, 'Основная', true], [C, 'Клуб-тайна', true]]);
  });

  it('своё название: видно только себе, пустое — снова по умолчанию, длиннее 40 — отказ, чужая компания — 404', async () => {
    assert.deepEqual(await z.ok(a, 'company.label.set', { company: C, label: `  ${LABEL}  ` }), { ok: true, title: LABEL });
    assert.deepEqual(ids(await z.ok(a, 'me')), [[1, 'Компания 1', false], [C, LABEL, true]]);
    assert.equal(z.row(C, a.id).label, LABEL);
    assert.equal(z.company(C).name, 'Клуб-тайна', 'название владельца бота не меняется');
    const long = await z.api(a, 'company.label.set', { company: C, label: 'я'.repeat(41) });
    assert.deepEqual([long.status, long.data.error], [400, 'Название — до 40 символов.']);
    const alien = await z.api(d, 'company.label.set', { company: C, label: 'Чужая' });
    assert.deepEqual([alien.status, alien.data.error], [404, 'Компания не найдена.']);
    assert.deepEqual(await z.ok(a, 'company.label.set', { company: 1, label: 'Дом' }), { ok: true, title: 'Дом' });
    assert.deepEqual(await z.ok(a, 'company.label.set', { company: 1, label: '' }), { ok: true, title: 'Компания 1' });
    // Владелец бота переименовывает саму компанию — пустое нельзя
    const empty = await z.w.api(boss, 'company.label.set', { company: C, label: ' ' }, true);
    assert.equal(empty.status, 400);
    assert.deepEqual(await z.w.api(boss, 'company.label.set', { company: C, label: 'Клуб' }), { ok: true, title: 'Клуб' });
    assert.equal(z.company(C).name, 'Клуб');
    assert.deepEqual(ids(await z.ok(a, 'me')).at(-1), [C, LABEL, true], 'своё название не зависит от названия владельца бота');
  });

  it('меню бота: при нескольких компаниях — название рядом с событием, при одной — как раньше', async () => {
    await z.w.say(a, '/start');
    const menuA = z.w.lastText(a);
    assert.match(menuA, /«Основное событие» \(Компания 1\)/);
    assert.ok(menuA.includes(`«Событие клуба» (${LABEL})`), menuA);
    await z.w.say(d, '/start');
    assert.doesNotMatch(z.w.lastText(d), /Компания|\(/);
  });

  it('чужое своё название и название владельца бота — ни в одном ответе и сообщении другим людям', async () => {
    for (const u of [b, c, d]) await z.ok(u, 'me');
    await z.ok(c, 'admin.users', { company: C });
    await z.ok(c, 'admin.state', { event: evC });
    await z.ok(c, 'admin.audit', { company: C });
    const notA = z.others().filter((t) => !t.startsWith(a.name + ' ') && !t.startsWith(`→${a.id}:`));
    assert.deepEqual(notA.filter((t) => t.includes(LABEL) || t.includes('Клуб')), []);
    assert.ok(!JSON.stringify(await z.w.api(boss, 'me')).includes(LABEL), 'и владельцу бота чужое название не приходит');
    assert.deepEqual(invariants(z.w), []);
  });
});

describe('051: владелец бота в чужой компании — гость (US5)', () => {
  let z;
  let C;
  let evC;
  const [x, y, n] = [person(4001, 'Ира'), person(4002, 'Яков'), person(4003, 'Нил')];
  before(async () => {
    z = await bossWorld();
    C = await newCompany(z.w, boss, 'Гостевая');
    evC = await z.event(C, 'Событие гостевой', [x, y]);
    await z.ok(boss, 'admin.owner.transfer', { company: C, id: x.id });
  });

  it('гость: метка в me, нет в списках людей, «присоединяется» ему не приходит; изменения — в журнале под его именем', async () => {
    const me = await z.w.api(boss, 'me');
    assert.deepEqual(me.companies.filter((c) => c.id === C).map((c) => [c.role, c.organizer, c.owner, c.bot_run]), [['guest', true, true, false]]);
    assert.equal(z.row(C, boss.id), undefined);
    for (const u of [x, boss]) {
      const { users } = await z.w.api(u, 'admin.users', { company: C });
      assert.ok(!users.some((p) => p.id === boss.id), `${u.name}: владелец бота в списке людей компании`);
    }
    const state = await z.ok(x, 'admin.state', { event: evC });
    assert.ok(!JSON.stringify(state.users ?? state).includes('"Владелец"'), 'в панели события его нет');
    const before = z.w.texts(boss).length;
    await z.join(evC, [n]);
    assert.ok(z.w.texts(x).some((t) => t.includes('присоединяется')), 'владельцу компании — да');
    assert.ok(!z.w.texts(boss).slice(before).some((t) => t.includes('присоединяется')), 'гостю — нет');
    await z.w.api(boss, 'admin.announce', { event: evC, text: 'Собираемся в пятницу' });
    const { entries } = await z.ok(x, 'admin.audit', { event: evC });
    assert.equal(entries[0].actor_name, 'Владелец');
    assert.deepEqual(invariants(z.w, { guests: [C] }), []);
  });

  it('«Я участвую» делает гостя человеком компании (без прав администратора)', async () => {
    await z.w.api(boss, 'admin.participate', { event: evC, on: true });
    assert.deepEqual(z.row(C, boss.id), { is_admin: 0, label: '' });
    const me = await z.w.api(boss, 'me');
    assert.deepEqual(me.companies.filter((c) => c.id === C).map((c) => [c.role, c.organizer, c.owner]), [['member', true, true]]);
    const { users } = await z.ok(x, 'admin.users', { company: C });
    assert.ok(users.some((p) => p.id === boss.id && !p.is_admin));
    assert.deepEqual(invariants(z.w), []);
  });
});

describe('051: удаление компании и журнал бота (US6)', () => {
  let z;
  const [o, p] = [person(5001, 'Оксана'), person(5002, 'Пётр')];

  it('пустая компания: строк не осталось, владельцу и администратору — сообщение, журнал бота; у людей — пустой экран', async () => {
    z = await bossWorld();
    const C = await newCompany(z.w, boss, 'Пустеющая');
    const ev = await z.event(C, 'Ненадолго', [o, p]);
    await z.ok(boss, 'admin.owner.transfer', { company: C, id: o.id });
    await z.ok(o, 'admin.role.grant', { company: C, id: p.id });
    await z.ok(o, 'admin.family.save', { company: C, name: 'Семья', members: [o.id, p.id] });
    await z.ok(o, 'admin.event.delete', { event: ev, confirm: 'УДАЛИТЬ' });
    const word = await z.w.api(boss, 'bot.company.delete', { company: C }, true);
    assert.deepEqual([word.status, word.data.error], [400, 'Для удаления введи слово УДАЛИТЬ.']);
    const t0 = [o, p].map((u) => z.w.texts(u).length);
    await z.ok(boss, 'bot.company.delete', { company: C, confirm: 'УДАЛИТЬ' });
    for (const table of ['companies WHERE id', 'company_members WHERE company_id', 'families WHERE company_id', 'family_members WHERE company_id', 'audit WHERE company_id']) {
      assert.equal(z.w.query(`SELECT COUNT(*) AS n FROM ${table} = ?`, C)[0].n, 0, table);
    }
    assert.deepEqual(z.w.texts(o).slice(t0[0]), ['Владелец бота удалил компанию, которую ты вёл: событий в ней не было.']);
    assert.deepEqual(z.w.texts(p).slice(t0[1]), ['Владелец бота удалил компанию, в которой ты был администратором: событий в ней не было.']);
    assert.deepEqual(z.botLog().at(-1), { action: 'company.delete', details: '«Пустеющая», людей: 2', actor: boss.id });
    for (const u of [o, p]) {
      const me = await z.ok(u, 'me');
      assert.deepEqual([me.companies, me.events, me.me.is_admin], [[], [], false], u.name);
    }
    assert.ok(!z.others().some((t) => t.includes('Пустеющая')), 'название — только владельцу бота');
    assert.deepEqual(invariants(z.w), []);
  });

  it('отказы: в компании есть события, компании нет; журнал бота — только владельцу бота', async () => {
    const busy = await z.w.api(boss, 'bot.company.delete', { company: 1, confirm: 'УДАЛИТЬ' }, true);
    assert.deepEqual([busy.status, busy.data.error], [400, 'В компании есть события — сначала удали их.']);
    const gone = await z.w.api(boss, 'bot.company.delete', { company: 999, confirm: 'УДАЛИТЬ' }, true);
    assert.deepEqual([gone.status, gone.data.error], [404, 'Компания не найдена.']);
    const { entries } = await z.ok(boss, 'bot.audit');
    assert.deepEqual(entries.slice(0, 1).map((e) => [e.action, e.actor_name]), [['company.delete', 'Владелец']]);
    assert.equal((await z.api(z.adm, 'bot.audit')).status, 403);
    const { entries: shared } = await z.ok(z.adm, 'admin.audit', { company: 1 });
    assert.ok(!shared.some((e) => e.action.startsWith('company.')), 'в общий журнал «Основной» записи бота не попадают');
  });
});

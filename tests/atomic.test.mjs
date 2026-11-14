// Одновременные вызовы с навязанным чередованием (016, FR-1609): два вызова сначала оба читают, затем пишут
// (world.together) или чужой вызов встаёт точно перед записью (world.beforeWrite).
// 32 проверки «один результат»: три — дефекты, исправленные в шаге 3 (018), две — в шаге 5 (020: «подарок получен» в
// одну миллисекунду, исключение ×2), пять — двойное нажатие одним человеком в одну миллисекунду (sameMoment: захват
// узнаётся по прежнему состоянию, а не по времени, 020), шесть — закреплённые пары (023: журнал — только при изменении;
// там же проверка повторов без изменений). Известный дефект — todo с номером шага, который его чинит
// (docs/refactoring-roadmap.md, «Исправления внутри шагов»): шаг снимает пометку; сейчас таких нет. Случаи без захвата
// (объявление, напоминание, сброс, роли, двойное сохранение семьи) — решения владельца, здесь их нет (baseline.md,
// раздел 4).
import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const adm2 = { id: 9003, name: 'Второй админ', username: 'adm2' };
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];
const statuses = (rs) => rs.map((r) => r.status);
const sorted = (rs) => statuses(rs).sort((a, b) => a - b);

// Событие: владелец, два админа, n участников (админы тоже вступили по ссылке)
async function world({ draw = false, n = 6, approval = false } = {}) {
  const w = await startWorld();
  const people = mk(n);
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'admin.events.create', { title: 'Атомарность' })).event;
  const code = inviteOf(await w.api(boss, 'admin.state', { event: ev.id }));
  for (const u of [adm, adm2, ...people]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  await w.api(boss, 'admin.role.grant', { id: adm2.id });
  if (approval) await w.api(boss, 'admin.game', { event: ev.id, approval: true });
  if (draw) await w.api(boss, 'admin.draw', { event: ev.id });
  const sent = (u, sub) => w.texts(u).filter((t) => t.includes(sub)).length;
  const audit = (action) => w.query('SELECT COUNT(*) AS n FROM audit WHERE action = ?', action)[0].n;
  const orphans = () => w.query(
    `SELECT COUNT(*) AS n FROM pairs p WHERE p.event_id = ?1
       AND (p.santa NOT IN (SELECT user_id FROM members WHERE event_id = ?1) OR p.ward NOT IN (SELECT user_id FROM members WHERE event_id = ?1))`,
    ev.id
  )[0].n;
  const twice = (user, action, body, opts) => w.together([1, 2].map(() => () => w.api(user, action, body, true)), opts);
  return { w, ev, people, code, sent, audit, orphans, twice };
}

describe('атомарность: жеребьёвка, раскрытие, завершение, удаление события', () => {
  let z;
  before(async () => { z = await world(); });

  it('admin.draw ×2 — одна жеребьёвка', async () => {
    const rs = await z.twice(adm, 'admin.draw', { event: z.ev.id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'Жеребьёвка в событии'), 1);
    assert.equal(z.audit('draw'), 1);
  });
  it('admin.reveal ×2 — одно раскрытие', async () => {
    const rs = await z.twice(adm, 'admin.reveal', { event: z.ev.id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'Тайна раскрыта'), 1);
    assert.equal(z.audit('reveal'), 1);
  });
  it('admin.event.finish ×2 — одно завершение', async () => {
    const rs = await z.twice(adm, 'admin.event.finish', { event: z.ev.id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'завершено'), 1);
    assert.equal(z.audit('finish'), 1);
  });
  it('admin.event.delete ×2 — одно удаление', async () => {
    const rs = await z.twice(boss, 'admin.event.delete', { event: z.ev.id, confirm: 'УДАЛИТЬ' });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'удалено организатором'), 1);
    assert.equal(z.audit('event.delete'), 1);
  });
});

describe('атомарность: отмены жеребьёвки', () => {
  let z;
  before(async () => { z = await world({ draw: true }); });

  it('admin.draw.cancel ×2 — одна отмена', async () => {
    const rs = await z.twice(adm, 'admin.draw.cancel', { event: z.ev.id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'отменил жеребьёвку'), 1);
    assert.equal(z.audit('draw.cancel'), 1);
  });
  it('admin.draw.cancel.force ×2 — одна принудительная отмена', async () => {
    await z.w.api(boss, 'admin.draw', { event: z.ev.id });
    const rs = await z.twice(boss, 'admin.draw.cancel.force', { event: z.ev.id, confirm: 'ОТМЕНА' });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'отменил жеребьёвку'), 2, 'одно от обычной отмены, одно от принудительной');
    assert.equal(z.audit('draw.cancel.force'), 1);
  });
});

describe('атомарность: удаление и вписывание после жеребьёвки', () => {
  let z;
  before(async () => { z = await world({ draw: true }); });

  it('admin.remove ×2 одного человека — одно удаление', async () => {
    const rs = await z.twice(adm, 'admin.remove', { event: z.ev.id, id: z.people[0].id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.audit('member.remove'), 1);
    assert.equal(z.orphans(), 0);
    assert.equal(z.sent(z.people[0], 'удалил тебя'), 1);
  });
  it('admin.remove двух разных людей — второй просит повторить, пары целы', async () => {
    const rs = await z.w.together([
      () => z.w.api(adm, 'admin.remove', { event: z.ev.id, id: z.people[1].id }, true),
      () => z.w.api(adm2, 'admin.remove', { event: z.ev.id, id: z.people[2].id }, true),
    ]);
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.orphans(), 0);
  });
  it('admin.insert ×2 — одно вписывание', async () => {
    const late = { id: 777, name: 'Опоздавший', username: 'late' };
    await z.w.api(boss, 'admin.registration', { event: z.ev.id, open: true });
    await z.w.say(late, '/start ' + inviteOf(await z.w.api(boss, 'admin.state', { event: z.ev.id })));
    await z.w.say(late, late.name);
    const rs = await z.twice(boss, 'admin.insert', { event: z.ev.id, id: late.id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.audit('member.insert'), 1);
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ? AND santa = ?', z.ev.id, late.id)[0].n, 1);
    assert.equal(z.sent(late, 'Ты в игре'), 1);
  });
});

describe('атомарность: до жеребьёвки', () => {
  let z;
  before(async () => { z = await world(); });

  it('admin.remove ×2 до жеребьёвки — одно уведомление и одна запись журнала', async () => {
    const rs = await z.twice(adm, 'admin.remove', { event: z.ev.id, id: z.people[0].id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(rs.find((r) => r.status === 400).data.error, 'Человек не участвует в этом событии.');
    assert.equal(z.w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', z.ev.id, z.people[0].id).length, 0, 'удалён');
    assert.equal(z.audit('member.remove'), 1, 'записей журнала');
    assert.equal(z.sent(z.people[0], 'удалил тебя'), 1, 'уведомлений удалённому');
  });
  it('admin.exclusion.add ×2 — одна запись журнала (исправлено в шаге 5, 020)', async () => {
    await z.twice(adm, 'admin.exclusion.add', { event: z.ev.id, giver: z.people[1].id, receiver: z.people[2].id });
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM exclusions WHERE event_id = ?', z.ev.id)[0].n, 1, 'исключение одно');
    assert.equal(z.audit('exclusion.add'), 1, 'записей журнала');
  });
});

// 024: повторные нажатия — рассылки по желанию (окно в минуту), роли, владение, сброс, новая семья. Все вызовы —
// в одну миллисекунду (sameMoment): признак «уже сделано» — состояние базы, а не время и не автор.
describe('атомарность: повторные нажатия (024)', () => {
  const once = { sameMoment: true };
  const refusal = (rs) => rs.find((r) => r.status === 400)?.data.error;

  describe('рассылки, роли, владение, семья', () => {
    let z;
    before(async () => { z = await world(); });

    it('admin.announce ×2 с одним текстом — одно объявление каждому', async () => {
      const rs = await z.twice(adm, 'admin.announce', { event: z.ev.id, text: 'Сбор в пятницу' }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Это объявление уже отправлено.');
      assert.equal(z.sent(z.people[0], 'Сбор в пятницу'), 1, 'объявлений участнику');
      assert.equal(z.w.query('SELECT COUNT(*) AS n FROM announcements')[0].n, 1);
      assert.equal(z.audit('announce'), 1);
    });
    it('два разных объявления одновременно — уходят оба', async () => {
      const rs = await z.w.together([
        () => z.w.api(adm, 'admin.announce', { event: z.ev.id, text: 'Первое' }, true),
        () => z.w.api(adm2, 'admin.announce', { event: z.ev.id, text: 'Второе' }, true),
      ], once);
      assert.deepEqual(statuses(rs), [200, 200]);
      assert.equal(z.sent(z.people[0], 'Первое') + z.sent(z.people[0], 'Второе'), 2);
    });
    it('то же объявление через минуту — уходит', async () => {
      z.w.query('UPDATE announcements SET created_at = created_at - 61000');
      const r = await z.w.api(adm, 'admin.announce', { event: z.ev.id, text: 'Сбор в пятницу' }, true);
      assert.equal(r.status, 200);
      assert.equal(z.sent(z.people[0], 'Сбор в пятницу'), 2);
    });
    it('admin.remind.unfilled ×2 — одно напоминание каждому', async () => {
      const rs = await z.twice(adm, 'admin.remind.unfilled', { event: z.ev.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Напоминание уже отправлено — повторить можно через минуту.');
      assert.equal(z.sent(z.people[0], 'письмо Санте'), 1);
      assert.equal(z.audit('remind.unfilled'), 1);
    });
    it('admin.event.invite_from ×2 — одно приглашение каждому', async () => {
      const B = (await z.w.api(boss, 'admin.events.create', { title: 'Второе' })).event.id;
      const rs = await z.twice(adm, 'admin.event.invite_from', { event: B, from: z.ev.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Приглашения уже отправлены — повторить можно через минуту.');
      assert.equal(z.sent(z.people[0], 'Приглашение на событие'), 1);
      assert.equal(z.audit('invite.from'), 1);
    });
    it('admin.family.save ×2 новой семьи — понятный отказ вместо 500', async () => {
      const rs = await z.twice(adm, 'admin.family.save', { name: 'Ивановы', members: [z.people[0].id, z.people[1].id] }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.match(refusal(rs), /уже в семье «Ивановы»\.$/);
      assert.equal(z.w.query('SELECT COUNT(*) AS n FROM families')[0].n, 1);
      assert.equal(z.audit('family.save'), 1);
    });
    it('admin.role.grant ×2 — одно уведомление', async () => {
      const rs = await z.twice(boss, 'admin.role.grant', { id: z.people[2].id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Он(а) уже администратор.');
      assert.equal(z.sent(z.people[2], 'назначил тебя администратором'), 1);
      assert.equal(z.sent(adm, `${z.people[2].name}</b> теперь администратор`), 1, 'другому админу');
      assert.equal(z.audit('role.grant'), 3, 'два админа мира и этот');
    });
    it('admin.role.revoke ×2 у админа со взятым обращением — одно уведомление, обращение ничьё один раз', async () => {
      await z.w.api(z.people[3], 'support.send', { event: z.ev.id, text: 'Помогите' });
      const th = z.w.query('SELECT id FROM support_threads')[0].id;
      await z.w.api(adm2, 'admin.support.take', { event: z.ev.id, thread: th });
      const rs = await z.twice(boss, 'admin.role.revoke', { id: adm2.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Он(а) не администратор.');
      assert.equal(z.sent(adm2, 'снял с тебя права'), 1);
      assert.equal(z.sent(z.people[3], 'снова ждёт ответа'), 1);
      assert.equal(z.sent(adm, 'снова ничьё'), 1);
      assert.equal(z.audit('role.revoke'), 1);
      assert.equal(z.audit('support.return'), 1);
    });
    it('admin.owner.transfer ×2 — одна передача', async () => {
      const rs = await z.twice(boss, 'admin.owner.transfer', { id: adm.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Права владельца уже переданы.');
      assert.equal(z.sent(adm, 'Тебе переданы права владельца'), 1);
      assert.equal(z.audit('owner.transfer'), 1);
    });
  });

  describe('после жеребьёвки: напоминание Сантам и полный сброс', () => {
    let z;
    before(async () => { z = await world({ draw: true }); });

    it('admin.remind.santas ×2 — одно напоминание каждому Санте', async () => {
      const rs = await z.twice(adm, 'admin.remind.santas', { event: z.ev.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Напоминание уже отправлено — повторить можно через минуту.');
      assert.equal(z.sent(z.people[0], 'Напоминание для Санты'), 1);
      assert.equal(z.audit('remind.santas'), 1);
    });
    it('admin.reset.full ×2 — одно уведомление каждому удалённому', async () => {
      const rs = await z.twice(boss, 'admin.reset.full', { event: z.ev.id, confirm: 'СБРОС' }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Событие уже сброшено или изменилось одновременно со сбросом — обнови экран.');
      assert.equal(z.sent(z.people[0], 'начал событие'), 1);
      assert.equal(z.audit('reset'), 1);
      assert.equal(z.w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', z.ev.id)[0].n, 0, 'пары удалены');
    });
  });
});

// 023: журнал закреплённых пар — по прежнему состоянию, только когда пара действительно добавлена или убрана. Ответы
// прежние: второй из одновременных вызовов тоже получает успех (research R3 фичи 023).
describe('атомарность: закреплённые пары (023)', () => {
  let z, p;
  before(async () => {
    z = await world();
    p = z.people;
    await z.w.api(boss, 'admin.ring', { event: z.ev.id, on: false }); // взаимные пары — только без кольцевой
  });
  afterEach(() => clear()); // каждая проверка начинает без закреплённых пар
  const fix = (a, b, extra = {}) => ({ event: z.ev.id, giver: a.id, receiver: b.id, ...extra });
  const rows = () => z.w.query('SELECT giver, receiver FROM fixed_pairs WHERE event_id = ? ORDER BY giver', z.ev.id);
  const add = (body) => z.w.api(boss, 'admin.fixed.add', body);
  const del = (body) => z.w.api(boss, 'admin.fixed.del', body);
  const clear = async () => { for (const r of rows()) await del({ event: z.ev.id, giver: r.giver, receiver: r.receiver }); };
  // Записи журнала, добавленные вызовом f: в событии уже есть записи прошлых проверок
  async function counted(action, f) {
    const n = z.audit(action);
    const out = await f();
    return { added: z.audit(action) - n, out };
  }

  it('admin.fixed.add ×2 — одна пара, одна запись', async () => {
    const { added, out } = await counted('fixed.add', () => z.twice(boss, 'admin.fixed.add', fix(p[0], p[1])));
    assert.deepEqual(statuses(out), [200, 200]);
    assert.deepEqual(rows(), [{ giver: p[0].id, receiver: p[1].id }]);
    assert.equal(added, 1, 'записей журнала');
  });
  it('admin.fixed.add ×2 в одну миллисекунду — одна запись', async () => {
    const { added } = await counted('fixed.add', () => z.twice(boss, 'admin.fixed.add', fix(p[2], p[3]), { sameMoment: true }));
    assert.deepEqual(rows(), [{ giver: p[2].id, receiver: p[3].id }]);
    assert.equal(added, 1, 'записей журнала');
  });
  it('admin.fixed.del ×2 — пары нет, одна запись', async () => {
    await add(fix(p[0], p[1]));
    const { added, out } = await counted('fixed.del', () => z.twice(boss, 'admin.fixed.del', fix(p[0], p[1])));
    assert.deepEqual(statuses(out), [200, 200]);
    assert.deepEqual(rows(), []);
    assert.equal(added, 1, 'записей журнала');
  });
  it('взаимная пара ×2 — две стороны, одна запись', async () => {
    const { added } = await counted('fixed.add', () => z.twice(boss, 'admin.fixed.add', fix(p[0], p[1], { mutual: true })));
    assert.equal(rows().length, 2, 'в обе стороны');
    assert.equal(added, 1, 'записей журнала');
  });
  it('одновременно «А → Б» и «А → В» (один Санта) — одна пара, одна запись', async () => {
    const { added, out } = await counted('fixed.add', () => z.w.together([
      () => z.w.api(boss, 'admin.fixed.add', fix(p[0], p[1]), true),
      () => z.w.api(boss, 'admin.fixed.add', fix(p[0], p[2]), true),
    ]));
    assert.deepEqual(statuses(out), [200, 200], 'ответы прежние');
    assert.equal(rows().length, 1, 'у Санты один закреплённый подопечный');
    assert.equal(added, 1, 'записей журнала');
  });
  it('одновременно «А → Б» и «В → Б» (один подопечный) — одна пара, одна запись', async () => {
    const { added } = await counted('fixed.add', () => z.w.together([
      () => z.w.api(boss, 'admin.fixed.add', fix(p[0], p[1]), true),
      () => z.w.api(boss, 'admin.fixed.add', fix(p[2], p[1]), true),
    ]));
    assert.equal(rows().length, 1, 'у подопечного один закреплённый Санта');
    assert.equal(added, 1, 'записей журнала');
  });
  it('без изменений — без записи; взаимная с одной новой стороной — одна', async () => {
    await add(fix(p[0], p[1]));
    let r = await counted('fixed.add', () => z.w.api(boss, 'admin.fixed.add', fix(p[0], p[1]), true));
    assert.equal(r.out.status, 200, 'повтор — успех, как раньше');
    assert.equal(r.added, 0, 'повтор закреплённой пары — без записи');
    r = await counted('fixed.del', () => z.w.api(boss, 'admin.fixed.del', fix(p[2], p[3]), true));
    assert.equal(r.out.status, 200);
    assert.equal(r.added, 0, 'удаление отсутствующей — без записи');
    r = await counted('fixed.add', () => add(fix(p[0], p[1], { mutual: true })));
    assert.equal(rows().length, 2, 'добавлена вторая сторона');
    assert.equal(r.added, 1, 'изменение было — одна запись');
    await del(fix(p[1], p[0]));
    r = await counted('fixed.del', () => del(fix(p[0], p[1], { mutual: true })));
    assert.deepEqual(rows(), [], 'убрана оставшаяся сторона');
    assert.equal(r.added, 1, 'изменение было — одна запись');
  });
});

describe('атомарность: «Я участвую» выкл ↔ жеребьёвка', () => {
  const pair = (z) => [
    () => z.w.api(adm, 'admin.participate', { event: z.ev.id, on: false }, true),
    () => z.w.api(boss, 'admin.draw', { event: z.ev.id }, true),
  ];

  it('участие пишется первым — жеребьёвка просит повторить', async () => {
    const z = await world();
    await z.w.api(adm, 'admin.participate', { event: z.ev.id, on: true });
    const rs = await z.w.together(pair(z));
    assert.deepEqual(statuses(rs), [200, 400]);
    assert.equal(z.orphans(), 0);
  });
  it('жеребьёвка пишется первой — в парах нет человека вне события', async () => {
    const z = await world();
    await z.w.api(adm, 'admin.participate', { event: z.ev.id, on: true });
    const rs = await z.w.together(pair(z), { writeOrder: [1, 0] });
    assert.deepEqual(statuses(rs), [400, 200], 'выход отказывает, жеребьёвка прошла');
    assert.equal(rs[0].data.error, 'После жеребьёвки так нельзя. Попроси владельца бота вписать тебя.');
    assert.equal(z.orphans(), 0, 'пар с не-участником');
    assert.ok(z.w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', z.ev.id, adm.id).length, 'админ остался участником');
    assert.equal(z.w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'participate' AND details = 'не участвует'")[0].n, 0, 'журнал «не участвует»');
  });
  it('admin.remove ↔ admin.draw, жеребьёвка пишется первой — удаление отказывает', async () => {
    const z = await world();
    z.w.beforeWrite('DELETE FROM members WHERE event_id = ? AND user_id = ?', () => z.w.api(boss, 'admin.draw', { event: z.ev.id }));
    const r = await z.w.api(adm, 'admin.remove', { event: z.ev.id, id: z.people[0].id }, true);
    assert.equal(r.status, 400);
    assert.equal(z.orphans(), 0);
    assert.ok(z.w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', z.ev.id)[0].n > 0, 'жеребьёвка прошла');
  });
});

describe('атомарность: заявки и обращения', () => {
  it('admin.request.decide: один принимает, другой отклоняет — одно решение', async () => {
    const z = await world({ approval: true });
    const guest = { id: 888, name: 'Гость', username: 'guest' };
    await z.w.say(guest, '/start ' + z.code);
    await z.w.say(guest, guest.name);
    const req = z.w.query('SELECT id FROM join_requests WHERE user_id = ?', guest.id)[0];
    const rs = await z.w.together([
      () => z.w.api(adm, 'admin.request.decide', { event: z.ev.id, id: req.id, approve: true }, true),
      () => z.w.api(adm2, 'admin.request.decide', { event: z.ev.id, id: req.id, approve: false }, true),
    ]);
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(guest, 'Заявка одобрена') + z.sent(guest, 'не одобрил заявку'), 1);
    assert.equal(z.audit('request.approve') + z.audit('request.reject'), 1);
  });

  describe('обращения', () => {
    let z;
    before(async () => { z = await world(); });

    it('admin.support.take двумя админами — один ответственный', async () => {
      await z.w.api(z.people[0], 'support.send', { event: z.ev.id, text: 'Помогите' });
      const th = z.w.query('SELECT id FROM support_threads')[0].id;
      const rs = await z.w.together([
        () => z.w.api(adm, 'admin.support.take', { event: z.ev.id, thread: th }, true),
        () => z.w.api(adm2, 'admin.support.take', { event: z.ev.id, thread: th }, true),
      ]);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(z.audit('support.take'), 1);
      assert.equal(z.sent(z.people[0], 'взял(а)'), 1);
    });
    it('ответ двух админов на ничьё обращение — один ответ', async () => {
      await z.w.api(z.people[1], 'support.send', { event: z.ev.id, text: 'И мне' });
      const th = z.w.query('SELECT id FROM support_threads ORDER BY id DESC')[0].id;
      const rs = await z.w.together([
        () => z.w.api(adm, 'admin.support.send', { event: z.ev.id, thread: th, text: 'Отвечаю' }, true),
        () => z.w.api(adm2, 'admin.support.send', { event: z.ev.id, thread: th, text: 'И я' }, true),
      ]);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(z.w.query('SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ? AND from_admin = 1', th)[0].n, 1);
      assert.equal(z.sent(z.people[1], 'отвечает'), 1);
    });
    it('закрытие обращения админом и участником одновременно — одно закрытие', async () => {
      const th = z.w.query('SELECT id, assignee FROM support_threads ORDER BY id DESC')[0];
      const who = th.assignee === adm.id ? adm : adm2;
      const rs = await z.w.together([
        () => z.w.api(who, 'admin.support.close', { event: z.ev.id, thread: th.id }, true),
        () => z.w.api(z.people[1], 'support.close', { event: z.ev.id }, true),
      ]);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(z.audit('support.close'), 1);
    });
  });
});

// Двойное нажатие одним человеком в одну миллисекунду (020): время и автор у двух вызовов совпадают, поэтому «свой»
// захват узнаётся по прежнему состоянию (уведомления и журнал — перед изменением), а не по метке времени
describe('атомарность: один человек дважды в одну миллисекунду', () => {
  const once = { sameMoment: true };

  describe('обращения', () => {
    let z;
    let th;
    before(async () => {
      z = await world();
      await z.w.api(z.people[0], 'support.send', { event: z.ev.id, text: 'Помогите' });
      th = z.w.query('SELECT id FROM support_threads')[0].id;
    });

    it('admin.support.take ×2 — одно уведомление и одна запись журнала', async () => {
      const rs = await z.twice(adm, 'admin.support.take', { event: z.ev.id, thread: th }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.match(rs.find((r) => r.status === 400).data.error, /^Обращение уже взял\(а\) /);
      assert.equal(z.audit('support.take'), 1, 'записей журнала');
      assert.equal(z.sent(z.people[0], 'взял(а)'), 1, 'участнику');
      assert.equal(z.sent(adm2, 'взял(а) обращение'), 1, 'другому админу');
      assert.equal(z.sent(boss, 'взял(а) обращение'), 1, 'владельцу');
    });
    it('admin.support.pass ×2 владельцем — одно уведомление каждому и одна запись журнала', async () => {
      const rs = await z.twice(boss, 'admin.support.pass', { event: z.ev.id, thread: th, to: adm2.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(rs.find((r) => r.status === 400).data.error, 'Обращение изменилось одновременно с этим действием — обнови экран и попробуй ещё раз.');
      assert.equal(z.audit('support.pass'), 1, 'записей журнала');
      assert.equal(z.sent(z.people[0], 'теперь ведёт'), 1, 'участнику');
      assert.equal(z.sent(adm2, 'передал(а) тебе обращение'), 1, 'новому ответственному');
      assert.equal(z.sent(adm, 'теперь его ведёт'), 1, 'прежнему ответственному');
    });
    it('admin.support.close ×2 ответственным — одно уведомление и одна запись журнала', async () => {
      const rs = await z.twice(adm2, 'admin.support.close', { event: z.ev.id, thread: th }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(rs.find((r) => r.status === 400).data.error, 'Обращение уже закрыто.');
      assert.equal(z.audit('support.close'), 1, 'записей журнала');
      assert.equal(z.sent(z.people[0], 'закрыл(а) твоё обращение'), 1, 'участнику');
    });
    it('support.close ×2 участником — одно уведомление каждому админу и одна запись журнала', async () => {
      await z.w.api(z.people[1], 'support.send', { event: z.ev.id, text: 'И мне' });
      const log = z.audit('support.close');
      const rs = await z.twice(z.people[1], 'support.close', { event: z.ev.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(rs.find((r) => r.status === 400).data.error, 'Открытого обращения нет.');
      assert.equal(z.audit('support.close'), log + 1, 'записей журнала');
      for (const a of [boss, adm, adm2]) assert.equal(z.sent(a, 'закрыл(а) обращение ('), 1, 'админу ' + a.name);
    });
  });

  it('admin.request.decide «принять» ×2 — одно сообщение человеку, одно админам, одна запись журнала', async () => {
    const z = await world({ approval: true });
    const guest = { id: 888, name: 'Гость', username: 'guest' };
    await z.w.say(guest, '/start ' + z.code);
    await z.w.say(guest, guest.name);
    const req = z.w.query('SELECT id FROM join_requests WHERE user_id = ?', guest.id)[0];
    const rs = await z.twice(adm, 'admin.request.decide', { event: z.ev.id, id: req.id, approve: true }, once);
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(rs.find((r) => r.status === 400).data.error, 'Заявка уже рассмотрена.');
    assert.equal(z.sent(guest, 'Заявка одобрена'), 1, 'человеку');
    assert.equal(z.audit('request.approve'), 1, 'записей журнала');
    for (const a of [boss, adm2]) assert.equal(z.sent(a, 'принял(а) заявку'), 1, 'админу ' + a.name);
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM members WHERE event_id = ? AND user_id = ?', z.ev.id, guest.id)[0].n, 1, 'участник');
  });
});

describe('атомарность: перенос участия', () => {
  it('admin.transfer ×2, новый аккаунт уже в событии — его участие не пропадает', async () => {
    const z = await world();
    await z.w.api(z.people[0], 'wishlist.save', { event: z.ev.id, text: 'Письмо старого аккаунта' });
    const members = () => z.w.query('SELECT COUNT(*) AS n FROM members WHERE event_id = ?', z.ev.id)[0].n;
    const before = members();
    const rs = await z.twice(boss, 'admin.transfer', { from: z.people[0].id, to: z.people[1].id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(rs.find((r) => r.status === 400).data.error, 'Старая запись не найдена.');
    assert.equal(members(), before - 1, 'участников стало на одного меньше');
    assert.ok(z.w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', z.ev.id, z.people[1].id).length, 'участие нового аккаунта есть');
    assert.equal(z.audit('transfer'), 1, 'записей журнала');
    assert.equal(z.sent(z.people[1], 'перенёс на этот аккаунт'), 1, 'уведомлений новому аккаунту');
  });
});

describe('атомарность: ссылка владельца и «подарок получен»', () => {
  it('ссылка владельца: двое одновременно — владелец один', async () => {
    const w = await startWorld();
    const s = await w.setup();
    const a = { id: 1, name: 'Первый', username: 'a' };
    const b = { id: 2, name: 'Второй', username: 'b' };
    await w.together([() => w.say(a, '/start ' + s.adminCode), () => w.say(b, '/start ' + s.adminCode)]);
    assert.equal(w.query('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')[0].n, 1);
  });
  it('ward.received ×2 в одну миллисекунду — одно сообщение Санте (исправлено в шаге 5, 020)', async () => {
    const z = await world({ draw: true });
    const p = z.w.query('SELECT santa, ward FROM pairs WHERE event_id = ? LIMIT 1', z.ev.id)[0];
    const all = [boss, adm, adm2, ...z.people];
    const ward = all.find((u) => u.id === p.ward);
    const santa = all.find((u) => u.id === p.santa);
    await z.twice(ward, 'ward.received', { event: z.ev.id, received: true }, { sameMoment: true });
    assert.equal(z.sent(santa, 'получил подарок'), 1, 'сообщений Санте');
  });
});

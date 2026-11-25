// Одновременные вызовы с навязанным чередованием (016, FR-1609): два вызова сначала оба читают, затем пишут
// (world.together) или чужой вызов встаёт точно перед записью (world.beforeWrite).
// 64 проверки «один результат»: три — дефекты, исправленные в шаге 3 (018), одна — в шаге 5 (020: исключение ×2; «подарок
// получен» в одну миллисекунду ушёл вместе с отметками в 064), пять — двойное нажатие одним человеком в одну миллисекунду (sameMoment: захват
// узнаётся по прежнему состоянию, а не по времени, 020), десять — закреплённые пары (023: журнал — только при изменении;
// 031: из спорящих закреплений сохраняется одно, второму — отказ обычной проверки, взаимная — целиком или никак; там же
// проверка повторов без изменений), девять — повторные нажатия (024: объявление, напоминание пустым письмам и
// приглашение — раз в минуту, роли, владение, полный сброс; напоминание Сантам ушло в 064), одна — переименование (025): запись журнала — только при настоящем
// изменении (новая семья ×2 и сохранение семьи — 024 и 034 — ушли вместе с семьями в 062); четыре — выход из события
// и своё имя (035: выход ×2, выход ↔ жеребьёвка в обоих порядках, имя ×2); три — регистрация в боте (047: «Участвовать как …» ×2 в одну миллисекунду,
// нажатие ↔ имя текстом в обоих порядках); три — обмен подопечных (048: ×2 в одну миллисекунду, обмен ↔ вписывание в
// обоих порядках); пять — владелец и администраторы события (063: назначение в двух событиях одновременно и ×2 в одном
// в одну миллисекунду, передача владения ×2 одному и разным, передача ↔ снятие того же администратора — в обоих порядках);
// четыре — создание события (063: два создания у границы лимита и создание ↔ снятие разрешения — в обоих порядках). Случаи
// компаний (050–052) ушли вместе с комнатами в 063. После сценариев с ролями, владением, созданием и переносом — инварианты
// событий E1–E4 (tests/support/events.mjs). Известный дефект — todo с номером фичи, которая его чинит: фича снимает
// пометку; сейчас таких нет.
import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { invariants } from './support/events.mjs';

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
  const ev = (await w.api(boss, 'event.create', { participate: false, title: 'Атомарность' })).event;
  const code = inviteOf(await w.api(boss, 'admin.state', { event: ev.id }));
  for (const u of [adm, adm2, ...people]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { event: ev.id, id: adm.id });
  await w.api(boss, 'admin.role.grant', { event: ev.id, id: adm2.id });
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
    assert.equal(z.sent(z.people[0], 'удалено владельцем'), 1);
    assert.equal(z.audit('event.delete'), 1);
  });
});

describe('атомарность: отмены жеребьёвки', () => {
  let z;
  before(async () => { z = await world({ draw: true }); });

  it('admin.draw.cancel ×2 — одна отмена', async () => {
    const rs = await z.twice(adm, 'admin.draw.cancel', { event: z.ev.id });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'Жеребьёвка отменена'), 1);
    assert.equal(z.audit('draw.cancel'), 1);
  });
  it('admin.draw.cancel.force ×2 — одна принудительная отмена', async () => {
    await z.w.api(boss, 'admin.draw', { event: z.ev.id });
    const rs = await z.twice(boss, 'admin.draw.cancel.force', { event: z.ev.id, confirm: 'ОТМЕНА' });
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(z.sent(z.people[0], 'Владелец <b>отменил жеребьёвку'), 1);
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
    assert.equal(z.sent(z.people[0], 'Тебя удалили'), 1);
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
    assert.equal(z.sent(z.people[0], 'Тебя удалили'), 1, 'уведомлений удалённому');
  });
  it('admin.exclusion.add ×2 — одна запись журнала (исправлено в шаге 5, 020)', async () => {
    await z.twice(adm, 'admin.exclusion.add', { event: z.ev.id, giver: z.people[1].id, receiver: z.people[2].id });
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM exclusions WHERE event_id = ?', z.ev.id)[0].n, 1, 'исключение одно');
    assert.equal(z.audit('exclusion.add'), 1, 'записей журнала');
  });
});

// 024: повторные нажатия — рассылки по желанию (окно в минуту), роли, владение, сброс. Все вызовы —
// в одну миллисекунду (sameMoment): признак «уже сделано» — состояние базы, а не время и не автор.
describe('атомарность: повторные нажатия (024)', () => {
  const once = { sameMoment: true };
  const refusal = (rs) => rs.find((r) => r.status === 400)?.data.error;

  describe('рассылки, роли, владение', () => {
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
      const B = (await z.w.api(boss, 'event.create', { participate: false, title: 'Второе' })).event.id;
      const rs = await z.twice(boss, 'admin.event.invite_from', { event: B, from: z.ev.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Приглашения уже отправлены — повторить можно через минуту.');
      assert.equal(z.sent(z.people[0], 'Приглашение на событие'), 1);
      assert.equal(z.audit('invite.from'), 1);
    });
    it('admin.rename ×2 с одним именем — одна запись журнала (025)', async () => {
      const u = z.people[4];
      const rs = await z.twice(boss, 'admin.rename', { id: u.id, name: 'Переименованный' }, once);
      assert.deepEqual(statuses(rs), [200, 200], 'имя стало тем, что просили, — у обоих успех');
      assert.equal(z.w.query('SELECT name FROM users WHERE tg_id = ?', u.id)[0].name, 'Переименованный');
      assert.equal(z.w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'rename'")[0].n, 1);
    });
    it('admin.role.grant ×2 — одно уведомление', async () => {
      const rs = await z.twice(boss, 'admin.role.grant', { event: z.ev.id, id: z.people[2].id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Он(а) уже администратор.');
      assert.equal(z.sent(z.people[2], 'Тебя назначили администратором'), 1);
      assert.equal(z.sent(adm, `${z.people[2].name}</b> теперь администратор`), 1, 'другому админу');
      assert.equal(z.audit('role.grant'), 3, 'два админа мира и этот');
    });
    it('admin.role.revoke ×2 у админа со взятым обращением — одно уведомление, обращение ничьё один раз', async () => {
      await z.w.api(z.people[3], 'support.send', { event: z.ev.id, text: 'Помогите' });
      const th = z.w.query('SELECT id FROM support_threads')[0].id;
      await z.w.api(adm2, 'admin.support.take', { event: z.ev.id, thread: th });
      const rs = await z.twice(boss, 'admin.role.revoke', { event: z.ev.id, id: adm2.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Он(а) не администратор.');
      assert.equal(z.sent(adm2, 'С тебя сняли права'), 1);
      assert.equal(z.sent(z.people[3], 'снова ждёт ответа'), 1);
      assert.equal(z.sent(adm, 'снова ничьё'), 1);
      assert.equal(z.audit('role.revoke'), 1);
      assert.equal(z.audit('support.return'), 1);
    });
    // 051: права владельца бота передаёт bot.owner.transfer (прежний admin.owner.transfer); 063: запись — в журнале бота
    it('bot.owner.transfer ×2 — одна передача', async () => {
      const rs = await z.twice(boss, 'bot.owner.transfer', { id: adm.id }, once);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(refusal(rs), 'Права владельца уже переданы.');
      assert.equal(z.sent(adm, 'Тебе переданы права владельца'), 1);
      assert.equal(z.audit('owner.transfer'), 1);
      assert.equal(z.w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'owner.transfer' AND event_id = 0")[0].n, 1);
    });
    it('после ролей и передачи владения инварианты событий держатся (063)', () => {
      assert.deepEqual(invariants(z.w), []);
    });
  });

  describe('после жеребьёвки: полный сброс', () => {
    let z;
    before(async () => { z = await world({ draw: true }); });

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

// 023: журнал закреплённых пар — по прежнему состоянию, только когда пара действительно добавлена или убрана.
// 031: из спорящих закреплений (один Санта, один подопечный, встречные при кольцевой) сохраняется одно, второй вызов
// получает отказ обычной проверки; взаимная пара — целиком или никак; повтор того же закрепления — успех.
describe('атомарность: закреплённые пары (023, 031)', () => {
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
  // Спор двух закреплений в обоих порядках записи: ровно один успех, у другого — отказ обычной проверки; сохранено
  // закрепление вызова с успехом; запись журнала одна
  async function dispute(bodies, refusal, opts = {}) {
    for (const writeOrder of [[0, 1], [1, 0]]) {
      const { added, out } = await counted('fixed.add', () => z.w.together(
        bodies.map((b) => () => z.w.api(boss, 'admin.fixed.add', b, true)), { writeOrder, ...opts }));
      assert.deepEqual(sorted(out), [200, 400], `ответы, порядок ${writeOrder}`);
      const lost = out.findIndex((r) => r.status === 400);
      assert.equal(out[lost].data.error, refusal(bodies[lost]), `текст отказа, порядок ${writeOrder}`);
      const won = bodies[1 - lost];
      const expect = won.mutual
        ? [[won.giver, won.receiver], [won.receiver, won.giver]]
        : [[won.giver, won.receiver]];
      assert.deepEqual(rows().map((r) => [r.giver, r.receiver]).sort(), expect.sort(), `сохранено закрепление успеха, порядок ${writeOrder}`);
      assert.equal(added, 1, `записей журнала, порядок ${writeOrder}`);
      await clear();
    }
  }
  const named = (id) => p.find((u) => u.id === id).name;
  const SANTA_TAKEN = (b) => `У «${named(b.giver)}» уже есть закреплённый подопечный — сначала убери ту пару.`;
  const WARD_TAKEN = (b) => `Санта для «${named(b.receiver)}» уже закреплён — сначала убери ту пару.`;

  it('одновременно «А → Б» и «А → В» (один Санта) — одна пара, второму отказ', async () => {
    await dispute([fix(p[0], p[1]), fix(p[0], p[2])], SANTA_TAKEN);
  });
  it('одновременно «А → Б» и «А → В» в одну миллисекунду — одна пара, второму отказ', async () => {
    await dispute([fix(p[0], p[1]), fix(p[0], p[2])], SANTA_TAKEN, { sameMoment: true });
  });
  it('одновременно «А → Б» и «В → Б» (один подопечный) — одна пара, второму отказ', async () => {
    await dispute([fix(p[0], p[1]), fix(p[2], p[1])], WARD_TAKEN);
  });
  it('при кольцевой одновременно «А → Б» и «Б → А» — одна пара, второму отказ', async () => {
    await z.w.api(boss, 'admin.ring', { event: z.ev.id, on: true });
    try {
      await dispute([fix(p[0], p[1]), fix(p[1], p[0])],
        (b) => `При кольцевой жеребьёвке пару можно закрепить только в одну сторону: «${named(b.receiver)}» уже дарит «${named(b.giver)}».`);
    } finally {
      await z.w.api(boss, 'admin.ring', { event: z.ev.id, on: false });
    }
  });
  it('одновременно взаимная «А ↔ Б» и «А → В» — взаимная целиком или никак', async () => {
    // Кто бы ни проиграл, у Санты «А» уже есть подопечный
    await dispute([fix(p[0], p[1], { mutual: true }), fix(p[0], p[2])], SANTA_TAKEN);
  });
  it('одновременно взаимная «А ↔ Б» и «В → А» — взаимная целиком или никак', async () => {
    // Кто бы ни проиграл, у «А» уже есть Санта (у взаимной мешает сторона «Б → А»)
    await dispute([fix(p[0], p[1], { mutual: true }), fix(p[2], p[0])],
      () => `Санта для «${named(p[0].id)}» уже закреплён — сначала убери ту пару.`);
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
    assert.equal(rs[0].data.error, 'После жеребьёвки так нельзя. Попроси владельца вписать тебя.');
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
    it('ответ двух админов на ничьё обращение — один ответ, одно взятие и одна запись ответа (031)', async () => {
      await z.w.api(z.people[1], 'support.send', { event: z.ev.id, text: 'И мне' });
      const th = z.w.query('SELECT id FROM support_threads ORDER BY id DESC')[0].id;
      const taken = z.audit('support.take');
      const rs = await z.w.together([
        () => z.w.api(adm, 'admin.support.send', { event: z.ev.id, thread: th, text: 'Отвечаю' }, true),
        () => z.w.api(adm2, 'admin.support.send', { event: z.ev.id, thread: th, text: 'И я' }, true),
      ]);
      assert.deepEqual(sorted(rs), [200, 400]);
      assert.equal(z.w.query('SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ? AND from_admin = 1', th)[0].n, 1);
      assert.equal(z.sent(z.people[1], 'отвечает'), 1);
      assert.equal(z.audit('support.take'), taken + 1, 'взятие');
      assert.equal(z.audit('support.reply'), 1, 'ответ');
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
    assert.deepEqual(invariants(z.w), [], 'инварианты событий (063)');
  });
});

// 063: организатор события — строка event_admins (назначение — вставка, снятие — удаление, по прежнему состоянию),
// владение — events.owner_id по прежнему владельцу; новый владелец получает строку организатора в том же пакете
describe('атомарность: владелец и администраторы события (063)', () => {
  const once = { sameMoment: true };
  const owner = (z, id = z.ev.id) => z.w.query('SELECT owner_id FROM events WHERE id = ?', id)[0].owner_id;
  const organizers = (z, id = z.ev.id) => z.w.query('SELECT user_id FROM event_admins WHERE event_id = ? ORDER BY user_id', id).map((r) => r.user_id);
  const refusal = (rs) => rs.find((r) => r.status === 400)?.data.error;

  it('назначение в А и в Б одновременно — оба успешны; ×2 в одном событии в одну миллисекунду — один успех', async () => {
    const z = await world();
    const evB = (await z.w.api(boss, 'event.create', { participate: false, title: 'Событие Б' })).event;
    const codeB = inviteOf(await z.w.api(boss, 'admin.state', { event: evB.id }));
    const [x, y, admB] = z.people;
    for (const u of [x, y, admB]) await z.w.say(u, '/start ' + codeB);
    await z.w.api(boss, 'admin.role.grant', { event: evB.id, id: admB.id });
    const both = await z.w.together([z.ev.id, evB.id].map((event) => () => z.w.api(boss, 'admin.role.grant', { event, id: x.id }, true)));
    assert.deepEqual(statuses(both), [200, 200]);
    assert.deepEqual(z.w.query('SELECT event_id FROM event_admins WHERE user_id = ? ORDER BY event_id', x.id).map((r) => r.event_id), [z.ev.id, evB.id]);
    assert.equal(z.w.query('SELECT is_admin FROM users WHERE tg_id = ?', x.id)[0].is_admin, 1);
    assert.deepEqual(z.w.query("SELECT event_id FROM audit WHERE action = 'role.grant' AND details = ? ORDER BY event_id", x.name)
      .map((r) => r.event_id), [z.ev.id, evB.id]);
    const notice = `${y.name}</b> теперь администратор`;
    const rs = await z.twice(boss, 'admin.role.grant', { event: evB.id, id: y.id }, once);
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(refusal(rs), 'Он(а) уже администратор.');
    assert.equal(z.sent(y, 'Тебя назначили администратором'), 1);
    assert.equal(z.sent(admB, notice), 1, 'администратору Б — одно');
    assert.equal(z.sent(adm, notice), 0, 'администратору А — ничего');
    assert.equal(z.w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'role.grant' AND details = ?", y.name)[0].n, 1);
    assert.deepEqual(invariants(z.w), []);
  });

  it('admin.owner.transfer ×2 одному в одну миллисекунду — одна передача: одно сообщение каждому, одна запись', async () => {
    const z = await world();
    const p = z.people[0];
    const rs = await z.twice(boss, 'admin.owner.transfer', { event: z.ev.id, id: p.id }, once);
    assert.deepEqual(sorted(rs), [200, 400]);
    assert.equal(refusal(rs), 'Владение уже передано.');
    assert.equal(owner(z), p.id);
    assert.ok(organizers(z).includes(p.id) && organizers(z).includes(boss.id), 'новый — организатор, прежний остался');
    assert.equal(z.sent(p, 'Ты теперь владелец события'), 1);
    assert.equal(z.sent(adm, `теперь — <b>${p.name}</b>`), 1, 'администратору — одно');
    assert.equal(z.audit('event.owner'), 1);
    assert.deepEqual(invariants(z.w), []);
  });

  it('передача владения двум разным одновременно — один новый владелец, второй не стал организатором', async () => {
    const z = await world();
    const [p, q] = z.people;
    const rs = await z.w.together([p, q].map((u) => () => z.w.api(boss, 'admin.owner.transfer', { event: z.ev.id, id: u.id }, true)));
    assert.deepEqual(statuses(rs), [200, 400]);
    assert.equal(rs[1].data.error, 'Владение уже передано.');
    assert.equal(owner(z), p.id);
    assert.ok(!organizers(z).includes(q.id), 'проигравший — не организатор');
    assert.equal(z.sent(q, 'Ты теперь владелец события'), 0);
    assert.equal(z.audit('event.owner'), 1);
    assert.deepEqual(invariants(z.w), []);
  });

  for (const [first, writeOrder] of [['передача', [0, 1]], ['снятие', [1, 0]]]) {
    it(`передача владения администратору ↔ его снятие, первой пишет ${first} — он владелец и организатор`, async () => {
      const z = await world();
      const rs = await z.w.together([
        () => z.w.api(boss, 'admin.owner.transfer', { event: z.ev.id, id: adm.id }, true),
        () => z.w.api(boss, 'admin.role.revoke', { event: z.ev.id, id: adm.id }, true),
      ], { writeOrder });
      // Передача первой — снятие владельца невозможно; снятие первым — передача возвращает ему строку организатора
      assert.deepEqual(statuses(rs), writeOrder[0] === 0 ? [200, 400] : [200, 200]);
      if (writeOrder[0] === 0) assert.equal(rs[1].data.error, 'Нельзя снять права владельца. Сначала передай владение событием.');
      assert.equal(owner(z), adm.id);
      assert.ok(organizers(z).includes(adm.id));
      assert.equal(z.audit('role.revoke'), writeOrder[0] === 0 ? 0 : 1);
      assert.equal(z.audit('event.owner'), 1);
      assert.deepEqual(invariants(z.w), []);
    });
  }
});

describe('атомарность: ссылка владельца', () => {
  it('ссылка владельца: двое одновременно — владелец один', async () => {
    const w = await startWorld();
    const s = await w.setup();
    const a = { id: 1, name: 'Первый', username: 'a' };
    const b = { id: 2, name: 'Второй', username: 'b' };
    await w.together([() => w.say(a, '/start ' + s.adminCode), () => w.say(b, '/start ' + s.adminCode)]);
    assert.equal(w.query('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')[0].n, 1);
  });
});

// 035: выход участника — по прежнему состоянию (событие идёт, жеребьёвки нет, человек участник; сообщения и журнал —
// перед захватом, строка участника — последней); своё имя — renameUser (025)
describe('атомарность: выход из события и своё имя (035)', () => {
  const once = { sameMoment: true };
  const leave = (z, u) => () => z.w.api(u, 'event.leave', { event: z.ev.id, confirm: 'ВЫЙТИ' }, true);
  const member = (z, u) => z.w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', z.ev.id, u.id).length === 1;

  it('event.leave ×2 в одну миллисекунду — один выход: одно сообщение каждому организатору, одна запись', async () => {
    const z = await world();
    const rs = await z.twice(z.people[0], 'event.leave', { event: z.ev.id, confirm: 'ВЫЙТИ' }, once);
    assert.deepEqual(sorted(rs), [200, 403]);
    assert.equal(rs.find((r) => r.status === 403).data.error, 'Ты не участвуешь в этом событии.');
    assert.ok(!member(z, z.people[0]));
    assert.equal(z.audit('member.leave'), 1, 'записей журнала');
    for (const a of [boss, adm, adm2]) assert.equal(z.sent(a, 'выходит из события'), 1, 'организатору ' + a.name);
  });
  it('выход ↔ жеребьёвка, выход пишется первым — жеребьёвка просит повторить, в парах нет вышедшего', async () => {
    const z = await world();
    const rs = await z.w.together([leave(z, z.people[0]), () => z.w.api(boss, 'admin.draw', { event: z.ev.id }, true)]);
    assert.deepEqual(statuses(rs), [200, 400]);
    assert.ok(!member(z, z.people[0]));
    assert.equal(z.orphans(), 0, 'пар с не-участником');
  });
  it('выход ↔ жеребьёвка, жеребьёвка пишется первой — выход отказывает, человек в событии и в парах', async () => {
    const z = await world();
    const rs = await z.w.together([leave(z, z.people[0]), () => z.w.api(boss, 'admin.draw', { event: z.ev.id }, true)], { writeOrder: [1, 0] });
    assert.deepEqual(statuses(rs), [400, 200]);
    assert.equal(rs[0].data.error, 'Жеребьёвка уже прошла. Чтобы выйти, обратись к владельцу или администраторам.');
    assert.ok(member(z, z.people[0]), 'остался участником');
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ? AND santa = ?', z.ev.id, z.people[0].id)[0].n, 1, 'в парах');
    assert.equal(z.orphans(), 0);
    assert.equal(z.audit('member.leave'), 0, 'записей журнала');
    assert.equal(z.sent(boss, 'выходит из события'), 0, 'сообщений');
  });
  // 063: своё имя журнал не пишет (журналы — событий и бота)
  it('name.set ×2 с новым именем в одну миллисекунду — имя одно, журнала нет', async () => {
    const z = await world();
    const rs = await z.twice(z.people[0], 'name.set', { name: 'Игрок Первый' }, once);
    assert.deepEqual(statuses(rs), [200, 200]);
    assert.equal(z.w.query('SELECT name FROM users WHERE tg_id = ?', z.people[0].id)[0].name, 'Игрок Первый');
    assert.equal(z.audit('rename'), 0, 'записей журнала');
  });
});

describe('атомарность: регистрация в боте (047)', () => {
  const newcomer = { id: 700, name: 'Новичок', username: 'novice' };
  const NAME_SAVED = 'Имя уже сохранено. Сменить его можно в приложении: «⚙️ Настройки» → «Профиль» → «✏️ Изменить имя».';
  const named = (z) => z.w.query('SELECT name, registered FROM users WHERE tg_id = ?', newcomer.id)[0];
  const answers = (z, from) => z.w.calls.slice(from).filter((c) => c.method === 'answerCallbackQuery').map((c) => c.params.text ?? '');

  it('«Участвовать как …» ×2 в одну миллисекунду — одна регистрация: одно приветствие, одно «присоединяется»', async () => {
    const z = await world();
    await z.w.say(newcomer, '/start ' + z.code);
    const mark = z.w.calls.length;
    await z.w.together([() => z.w.press(newcomer, 'reg:ok'), () => z.w.press(newcomer, 'reg:ok')], { sameMoment: true });
    assert.deepEqual(named(z), { name: 'Новичок', registered: 1 });
    assert.deepEqual(answers(z, mark).sort(), ['', NAME_SAVED]);
    assert.equal(z.sent(newcomer, 'Приятно познакомиться'), 1, 'приветствий');
    for (const a of [boss, adm, adm2]) assert.equal(z.sent(a, '<b>Новичок</b> присоединяется'), 1, 'организатору ' + a.name);
  });
  for (const [first, writeOrder] of [['нажатие', [0, 1]], ['имя текстом', [1, 0]]]) {
    it(`нажатие ↔ имя текстом, первым пишет ${first} — одна регистрация, второму «Имя уже сохранено»`, async () => {
      const z = await world();
      await z.w.say(newcomer, '/start ' + z.code);
      const mark = z.w.calls.length;
      await z.w.together([() => z.w.press(newcomer, 'reg:ok'), () => z.w.say(newcomer, 'Другое имя')], { writeOrder });
      const [won, lost] = writeOrder[0] === 0 ? ['Новичок', 'Другое имя'] : ['Другое имя', 'Новичок'];
      assert.deepEqual(named(z), { name: won, registered: 1 });
      assert.equal(z.sent(newcomer, 'Приятно познакомиться'), 1, 'приветствий');
      assert.deepEqual(answers(z, mark), [writeOrder[0] === 0 ? '' : NAME_SAVED], 'ответ на нажатие');
      assert.equal(z.sent(newcomer, NAME_SAVED), writeOrder[0] === 0 ? 1 : 0, 'сообщение проигравшему тексту');
      for (const a of [boss, adm, adm2]) {
        assert.equal(z.sent(a, `<b>${won}</b> присоединяется`), 1, 'организатору ' + a.name);
        assert.equal(z.sent(a, `<b>${lost}</b> присоединяется`), 0, 'организатору ' + a.name);
      }
    });
  }
});

describe('атомарность: обмен подопечных (048)', () => {
  const late = { id: 778, name: 'Опоздавший', username: 'late2' };
  const pairs = (z) => new Map(z.w.query('SELECT santa, ward FROM pairs WHERE event_id = ?', z.ev.id).map((r) => [r.santa, r.ward]));
  // Каждый в парах дарит ровно одному и получает ровно от одного
  const whole = (z) => {
    const m = pairs(z);
    assert.deepEqual([...m.keys()].sort(), [...new Set(m.values())].sort(), 'пары — перестановка');
  };
  // Двое, которые не дарят друг другу (обмен возможен), и тело запроса с версией и согласием на любые правила
  async function swapBody(z) {
    const m = pairs(z);
    const a = z.people[0].id;
    const b = z.people.slice(1).map((u) => u.id).find((id) => m.get(a) !== id && m.get(id) !== a);
    const c = await z.w.api(boss, 'admin.draw.swap.check', { event: z.ev.id, a, b });
    return { a, b, before: m, body: { event: z.ev.id, a, b, version: c.version, agree: c.rules.map((r) => r.rule) } };
  }

  it('admin.draw.swap ×2 в одну миллисекунду — один обмен: пары не вернулись, одна запись, по сообщению двум Сантам', async () => {
    const z = await world({ draw: true });
    const { a, b, before, body } = await swapBody(z);
    // 049: о смене пишем только открывшим подопечного — оба открыли
    z.w.sql(`UPDATE pairs SET seen_text = '' WHERE event_id = ${z.ev.id} AND santa IN (${a}, ${b})`);
    const rs = await z.twice(boss, 'admin.draw.swap', body, { sameMoment: true });
    assert.deepEqual(sorted(rs), [200, 400]);
    const now = pairs(z);
    assert.deepEqual([now.get(a), now.get(b)], [before.get(b), before.get(a)]);
    whole(z);
    assert.equal(z.audit('draw.swap'), 1);
    for (const id of [a, b]) assert.equal(z.sent({ id }, 'Владелец изменил жеребьёвку'), 1);
  });
  for (const [first, writeOrder] of [['обмен', [0, 1]], ['вписывание', [1, 0]]]) {
    it(`обмен ↔ вписывание, первым пишет ${first} — второй просит повторить, пары целы`, async () => {
      const z = await world({ draw: true });
      await z.w.api(boss, 'admin.registration', { event: z.ev.id, open: true });
      await z.w.say(late, '/start ' + inviteOf(await z.w.api(boss, 'admin.state', { event: z.ev.id })));
      await z.w.say(late, late.name);
      const { body } = await swapBody(z);
      const rs = await z.w.together([
        () => z.w.api(boss, 'admin.draw.swap', body, true),
        () => z.w.api(boss, 'admin.insert', { event: z.ev.id, id: late.id }, true),
      ], { writeOrder });
      assert.deepEqual(statuses(rs), writeOrder[0] === 0 ? [200, 400] : [400, 200]);
      whole(z);
      assert.equal(z.audit('draw.swap'), writeOrder[0] === 0 ? 1 : 0);
      assert.equal(z.audit('member.insert'), writeOrder[0] === 0 ? 0 : 1);
    });
  }
});

// 063: создание события — условие лимита и разрешения в пакете вставки (createGuard), проигравшему — отказ по свежему
// состоянию (createRefusal)
describe('атомарность: создание события (063)', () => {
  const anya = { id: 801, name: 'Аня', username: 'anya' };
  const LIMIT = /^За 12 месяцев можно создать не больше 10 событий\. Следующее — с /;
  // Открытый бот: Аня — незнакомка, назвалась; закрытый: вступила по ссылке владельца бота, ей разрешено создавать
  async function creator({ open }) {
    const w = await startWorld({ open });
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    if (open) {
      await w.say(anya, '/start');
      await w.say(anya, anya.name);
    } else {
      const ev = (await w.api(boss, 'event.create', { participate: false, title: 'Вход' })).event;
      await w.say(anya, '/start ' + inviteOf(await w.api(boss, 'admin.state', { event: ev.id })));
      await w.say(anya, anya.name);
      await w.api(boss, 'bot.creator.set', { id: anya.id, on: true });
    }
    const created = () => w.query('SELECT COUNT(*) AS n FROM events WHERE owner_id = ?', anya.id)[0].n;
    const facts = () => w.query('SELECT COUNT(*) AS n FROM event_creations WHERE user_id = ?', anya.id)[0].n;
    return { w, created, facts };
  }

  for (const [first, writeOrder] of [['первое', [0, 1]], ['второе', [1, 0]]]) {
    it(`у границы лимита (создано 9) два создания одновременно, первым пишет ${first} — одно событие, второму отказ лимита`, async () => {
      const { w, created, facts } = await creator({ open: true });
      for (let i = 1; i <= 9; i++) await w.api(anya, 'event.create', { participate: false, title: 'Событие ' + i });
      const rs = await w.together(['А', 'Б'].map((title) => () => w.api(anya, 'event.create', { participate: false, title }, true)), { writeOrder });
      const [won, lost] = [rs[writeOrder[0]], rs[writeOrder[1]]];
      assert.equal(won.status, 200);
      assert.equal(lost.status, 400);
      assert.match(lost.data.error, LIMIT);
      assert.deepEqual([created(), facts()], [10, 10]);
      assert.equal(w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'event.create' AND event_id = 0")[0].n, 10, 'журнал бота');
      assert.deepEqual(invariants(w), []);
    });
  }

  for (const [first, writeOrder] of [['создание', [0, 1]], ['снятие разрешения', [1, 0]]]) {
    it(`закрытый бот: создание ↔ снятие разрешения, первым пишет ${first} — событие создано до снятия или отказ`, async () => {
      const { w, created, facts } = await creator({ open: false });
      const rs = await w.together([
        () => w.api(anya, 'event.create', { participate: false, title: 'Успеть' }, true),
        () => w.api(boss, 'bot.creator.set', { id: anya.id, on: false }, true),
      ], { writeOrder });
      assert.equal(rs[1].status, 200);
      if (writeOrder[0] === 0) {
        assert.equal(rs[0].status, 200);
        assert.deepEqual([created(), facts()], [1, 1]);
      } else {
        assert.equal(rs[0].status, 403);
        assert.equal(rs[0].data.error, 'Создавать события в этом боте может владелец бота и те, кому он разрешил.');
        assert.deepEqual([created(), facts()], [0, 0]);
      }
      assert.equal(w.query('SELECT can_create FROM users WHERE tg_id = ?', anya.id)[0].can_create, 0);
      assert.deepEqual(invariants(w), []);
    });
  }
});

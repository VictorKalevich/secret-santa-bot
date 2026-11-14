// Одновременные вызовы с навязанным чередованием (016, FR-1609): два вызова сначала оба читают, затем пишут
// (world.together) или чужой вызов встаёт точно перед записью (world.beforeWrite).
// 19 проверок «один результат» — обычные (три из них — дефекты, исправленные в шаге 3, 018); 2 известных дефекта —
// todo с номером шага, который их чинит
// (docs/refactoring-roadmap.md, «Исправления внутри шагов»): шаг снимает пометку. Случаи без захвата (объявление,
// напоминание, сброс, роли, двойное сохранение семьи) — решения владельца, здесь их нет (baseline.md, раздел 4).
import { describe, it, before, after } from 'node:test';
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
  it('admin.exclusion.add ×2 — одна запись журнала (будет исправлено в шаге 5)', { todo: 'шаг 5' }, async () => {
    await z.twice(adm, 'admin.exclusion.add', { event: z.ev.id, giver: z.people[1].id, receiver: z.people[2].id });
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM exclusions WHERE event_id = ?', z.ev.id)[0].n, 1, 'исключение одно');
    assert.equal(z.audit('exclusion.add'), 1, 'записей журнала');
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
  it('ward.received ×2 в одну миллисекунду — одно сообщение Санте (будет исправлено в шаге 5)', { todo: 'шаг 5' }, async () => {
    const z = await world({ draw: true });
    const p = z.w.query('SELECT santa, ward FROM pairs WHERE event_id = ? LIMIT 1', z.ev.id)[0];
    const all = [boss, adm, adm2, ...z.people];
    const ward = all.find((u) => u.id === p.ward);
    const santa = all.find((u) => u.id === p.santa);
    await z.twice(ward, 'ward.received', { event: z.ev.id, received: true }, { sameMoment: true });
    assert.equal(z.sent(santa, 'получил подарок'), 1, 'сообщений Санте');
  });
});

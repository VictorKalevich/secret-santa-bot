// 025: решения владельца — слово «ОТКРЫТЬ» в API служебного просмотра, «кто сделал» при переносе участия, журнал
// переименования, отклонение заявки в завершённом событии (specs/025-behavior-fixes/).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const adm2 = { id: 9003, name: 'Второй админ', username: 'adm2' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vera = { id: 103, name: 'Вера', username: 'vera' };
const gena = { id: 104, name: 'Гена', username: 'gena' };
const fresh = { id: 777, name: 'Новый аккаунт', username: 'fresh' };

const WORD = 'Для служебного просмотра введи слово ОТКРЫТЬ.';
const CLOSED = 'Событие завершено — менять его уже нельзя (доступны просмотр, раскрытие и удаление).';

// Владелец, админ, трое участников в событии «Проверка»; create — ещё одно событие с людьми
async function world() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const invite = async (id) => /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
  const join = async (u, code) => {
    const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
    await w.say(u, '/start ' + code);
    if (!known) await w.say(u, u.name);
  };
  const create = async (title, people) => {
    const id = (await w.api(boss, 'admin.events.create', { title })).event.id;
    const code = await invite(id);
    for (const u of people) await join(u, code);
    return id;
  };
  const E = await create('Проверка', [adm, anya, borya, vera]);
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  return { w, E, create, invite, join };
}
const records = (w, action, ev = null) => (ev === null
  ? w.query('SELECT * FROM audit WHERE action = ?', action)
  : w.query('SELECT * FROM audit WHERE event_id = ? AND action = ?', ev, action));

describe('служебный просмотр: слово ОТКРЫТЬ проверяет сервер (025, US1)', () => {
  let w, E;
  before(async () => {
    ({ w, E } = await world());
    await w.api(boss, 'admin.draw', { event: E });
  });

  it('без слова и с другим словом — отказ, данных нет, журнал не пишется', async () => {
    for (const confirm of [undefined, '', 'СБРОС', 'ОТКРЫТ']) {
      const person = await w.api(boss, 'admin.vault.person', { event: E, id: anya.id, confirm }, true);
      const pairs = await w.api(boss, 'admin.vault.pairs', { event: E, confirm }, true);
      for (const r of [person, pairs]) {
        assert.equal(r.status, 400, String(confirm));
        assert.equal(r.data.error, WORD);
        assert.ok(!('pairs' in r.data) && !('person' in r.data) && !('ward' in r.data), 'данных нет');
      }
    }
    assert.equal(records(w, 'vault.person', E).length + records(w, 'vault.pairs', E).length, 0, 'журнал без записей');
  });

  it('слово в любом регистре и с пробелами — данные и одна запись журнала', async () => {
    const person = await w.api(boss, 'admin.vault.person', { event: E, id: anya.id, confirm: ' открыть ' });
    assert.equal(person.person.id, anya.id);
    const pairs = await w.api(boss, 'admin.vault.pairs', { event: E, confirm: 'Открыть' });
    assert.equal(pairs.pairs.length, w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', E)[0].n);
    assert.equal(records(w, 'vault.person', E).length, 1);
    assert.equal(records(w, 'vault.pairs', E).length, 1);
  });

  it('админ со словом — прежний отказ по правам; нет события — 404', async () => {
    const r = await w.api(adm, 'admin.vault.pairs', { event: E, confirm: 'ОТКРЫТЬ' }, true);
    assert.deepEqual([r.status, r.data.error], [403, 'Служебный просмотр доступен только владельцу бота.']);
    const missing = await w.api(boss, 'admin.vault.person', { event: 999999, id: anya.id }, true);
    assert.deepEqual([missing.status, missing.data.error], [404, 'Событие не найдено.']);
  });

  it('в завершённом событии — со словом открывается', async () => {
    await w.api(boss, 'admin.event.finish', { event: E });
    assert.equal((await w.api(boss, 'admin.vault.pairs', { event: E }, true)).data.error, WORD);
    assert.ok((await w.api(boss, 'admin.vault.pairs', { event: E, confirm: 'ОТКРЫТЬ' })).pairs.length >= 4);
  });
});

describe('перенос участия: «кто сделал» — у нового аккаунта (025, US2)', () => {
  it('журнал и объявление подписаны новым аккаунтом; у старого — только очередь', async () => {
    const { w, E, create } = await world();
    await create('Другое', [fresh]); // новый аккаунт зарегистрирован
    await w.api(adm, 'admin.announce', { event: E, text: 'Сбор в пятницу' });
    await w.api(adm, 'admin.remove', { event: E, id: vera.id });
    const before = w.query('SELECT action FROM audit WHERE actor = ?', adm.id).map((r) => r.action);
    assert.ok(before.includes('announce') && before.includes('member.remove'), before.join(', '));

    await w.api(boss, 'admin.transfer', { from: adm.id, to: fresh.id });

    const entries = (await w.api(boss, 'admin.audit', { event: E })).entries.filter((e) => ['announce', 'member.remove'].includes(e.action));
    assert.equal(entries.length, 2);
    for (const e of entries) assert.equal(e.actor_name, fresh.name, e.action);
    const ann = (await w.api(anya, 'event.get', { event: E })).announcements;
    assert.deepEqual(ann.map((a) => a.author_name), [fresh.name]);
    // Создатель события и семьи, решивший, удаливший — тоже новый; у старого — только сообщения очереди ему
    const left = [
      ['audit', 'actor'], ['announcements', 'author'], ['events', 'created_by'], ['families', 'created_by'],
      ['join_requests', 'decided_by'], ['removed_members', 'removed_by'], ['support_threads', 'closed_by'],
      ['support_threads', 'assignee'], ['support_messages', 'sender'], ['members', 'user_id'], ['users', 'tg_id'],
    ].filter(([t, c]) => w.query(`SELECT 1 FROM ${t} WHERE ${c} = ?`, adm.id).length).map(([t, c]) => `${t}.${c}`);
    assert.deepEqual(left, []);
    assert.equal(w.query('SELECT actor FROM audit WHERE actor = ?', fresh.id).length, before.length, 'все записи старого — у нового');
  });

  it('записи бота остаются записями бота', async () => {
    const { w, E, create } = await world();
    await create('Другое', [fresh]);
    w.sql(`INSERT INTO audit (event_id, actor, action, details, created_at) VALUES (${E}, 0, 'remind.unfilled', 'получили: 0', 1)`);
    await w.api(boss, 'admin.transfer', { from: adm.id, to: fresh.id });
    assert.equal(w.query('SELECT actor FROM audit WHERE event_id = ? AND action = ?', E, 'remind.unfilled')[0].actor, 0);
  });
});

describe('переименование — запись журнала при настоящем изменении (025, US3)', () => {
  let w;
  before(async () => ({ w } = await world()));

  it('смена имени — одна запись «старое → новое» от переименовавшего', async () => {
    await w.api(adm, 'admin.rename', { id: anya.id, name: 'Анна' });
    const rows = records(w, 'rename', 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].details, 'Аня → Анна');
    const entry = (await w.api(boss, 'admin.audit')).entries.find((e) => e.action === 'rename');
    assert.equal(entry.actor_name, adm.name);
  });

  it('то же имя (и с лишними пробелами) — успех без записи', async () => {
    await w.api(adm, 'admin.rename', { id: anya.id, name: 'Анна' });
    await w.api(adm, 'admin.rename', { id: anya.id, name: '  Анна ' });
    assert.equal(records(w, 'rename', 0).length, 1);
    assert.equal(w.query('SELECT name FROM users WHERE tg_id = ?', anya.id)[0].name, 'Анна');
  });

  it('себя — тоже с записью', async () => {
    await w.api(adm, 'admin.rename', { id: adm.id, name: 'Админ Петров' });
    const rows = records(w, 'rename', 0);
    assert.equal(rows.length, 2);
    assert.deepEqual([rows[1].actor, rows[1].details], [adm.id, 'Админ → Админ Петров']);
  });
});

describe('заявка в завершённом событии: отклонить можно, принять — нет (025, US4)', () => {
  it('отклонение — сообщение заявителю, уведомление админу, одна запись; принять — прежний отказ', async () => {
    const { w, E, invite, join } = await world();
    await w.say(adm2, '/start ' + (await invite(E)));
    await w.say(adm2, adm2.name);
    await w.api(boss, 'admin.role.grant', { id: adm2.id });
    await w.api(boss, 'admin.game', { event: E, approval: true });
    await join(gena, await invite(E));
    const req = (await w.api(boss, 'admin.state', { event: E })).requests.find((r) => r.user_id === gena.id);
    assert.ok(req, 'заявка ждёт');
    await w.api(boss, 'admin.event.finish', { event: E });

    const approve = await w.api(adm, 'admin.request.decide', { event: E, id: req.id, approve: true }, true);
    assert.deepEqual([approve.status, approve.data.error], [400, CLOSED]);

    const toGena = w.texts(gena).length;
    const toAdm2 = w.texts(adm2).length;
    await w.api(adm, 'admin.request.decide', { event: E, id: req.id, approve: false });
    assert.equal(w.texts(gena).length, toGena + 1, 'заявителю — одно сообщение');
    assert.match(w.texts(gena).at(-1), /Проверка/);
    assert.equal(w.texts(adm2).length, toAdm2 + 1, 'второму админу — уведомление');
    assert.match(w.texts(adm2).at(-1), /отклонил/);
    assert.equal(records(w, 'request.reject', E).length, 1);
    assert.equal(w.query('SELECT status FROM join_requests WHERE id = ?', req.id)[0].status, 'rejected');

    const again = await w.api(adm, 'admin.request.decide', { event: E, id: req.id, approve: false }, true);
    assert.deepEqual([again.status, again.data.error], [400, 'Заявка уже рассмотрена.']);
    assert.equal(records(w, 'request.reject', E).length, 1);
  });
});

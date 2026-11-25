// 025: решения владельца — слово «ОТКРЫТЬ» в API служебного просмотра, «кто сделал» при переносе участия, журнал
// переименования, отклонение заявки в завершённом событии (specs/025-behavior-fixes/).
// 031: отказ проигравшему спор закреплений — текст обычной проверки; журнал каждого ответа организатора в обращение
// (specs/031-pins-audit-index/).
// 034: один текст «только для чтения» в API, боте и приложении (specs/034-small-consistency/; журнал семьи — до 062).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP } from './support/app-source.mjs';
import { fixedRefusal } from '../src/constraints.js';
import { t, render, DEFAULT_LANG } from '../src/i18n/index.js';

// 060: один текст — один ключ словаря приложения; его же берут API и бот
const CHAT_READ_ONLY = t(DEFAULT_LANG, 'app.sheet.chatReadOnly');
const SUPPORT_READ_ONLY = t(DEFAULT_LANG, 'app.sheet.supportReadOnly');

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

describe('закреплённые пары: отказ проигравшему — текст обычной проверки (031, US1)', () => {
  const NAMES = { 1: 'Аня', 2: 'Боря', 3: 'Вера', 4: 'Гена' };
  const name = (id) => NAMES[id];
  // 060: отказ модуля — отложенный текст, собирается на языке ответа
  const refusal = (ev, fixed, links) => render(fixedRefusal(ev, fixed, links, name)?.error ?? null, DEFAULT_LANG);
  const SANTA_TAKEN = 'У «Аня» уже есть закреплённый подопечный — сначала убери ту пару.';

  it('занят Санта, занят подопечный, встречная при кольцевой — те же тексты; свободно — нет отказа', () => {
    const fixed = [{ giver: 1, receiver: 2 }];
    assert.equal(refusal({ ring: 0 }, fixed, [[1, 3]]), SANTA_TAKEN);
    assert.equal(refusal({ ring: 0 }, fixed, [[3, 2]]), 'Санта для «Боря» уже закреплён — сначала убери ту пару.');
    assert.equal(refusal({ ring: 1 }, fixed, [[2, 1]]),
      'При кольцевой жеребьёвке пару можно закрепить только в одну сторону: «Аня» уже дарит «Боря».');
    assert.equal(refusal({ ring: 0 }, fixed, [[2, 1]]), null, 'без кольцевой встречная — не отказ');
    assert.equal(refusal({ ring: 0 }, fixed, [[1, 2]]), null, 'та же пара — не спор');
    assert.equal(refusal({ ring: 0 }, fixed, [[3, 4]]), null);
    assert.equal(refusal({ ring: 0 }, [], [[1, 2], [2, 1]]), null);
  });

  it('взаимная: сторона уже есть — не мешает, занятая вторая сторона — отказ', () => {
    assert.equal(refusal({ ring: 0 }, [{ giver: 1, receiver: 2 }], [[1, 2], [2, 1]]), null);
    assert.equal(refusal({ ring: 0 }, [{ giver: 3, receiver: 1 }], [[1, 2], [2, 1]]), 'Санта для «Аня» уже закреплён — сначала убери ту пару.');
  });

  it('чужое закрепление между чтением и записью — отказ, пара вызова не сохранена, журнала нет', async () => {
    const { w, E } = await world();
    await w.api(boss, 'admin.ring', { event: E, on: false });
    w.beforeWrite('INTO fixed_pairs', () => w.sql(`INSERT INTO fixed_pairs (event_id, giver, receiver) VALUES (${E}, ${anya.id}, ${vera.id})`));
    const r = await w.api(boss, 'admin.fixed.add', { event: E, giver: anya.id, receiver: borya.id }, true);
    assert.deepEqual([r.status, r.data.error], [400, SANTA_TAKEN]);
    assert.deepEqual(w.query('SELECT giver, receiver FROM fixed_pairs WHERE event_id = ?', E), [{ giver: anya.id, receiver: vera.id }]);
    assert.equal(records(w, 'fixed.add', E).length, 0);
  });
});

describe('журнал: каждый ответ организатора в обращение (031, US2)', () => {
  let w, E, th;
  const replies = () => records(w, 'support.reply', E);
  before(async () => {
    ({ w, E } = await world());
    await w.api(anya, 'support.send', { event: E, text: 'Помогите с адресом' });
    th = w.query('SELECT id FROM support_threads WHERE user_id = ?', anya.id)[0].id;
  });

  it('ответ в ничьё — support.take и support.reply; подробности — имя автора, без текста', async () => {
    await w.api(adm, 'admin.support.send', { event: E, thread: th, text: 'Секретный ответ' });
    assert.equal(records(w, 'support.take', E).length, 1);
    const rows = replies();
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].actor, rows[0].details], [adm.id, 'Аня']);
    const entry = (await w.api(boss, 'admin.audit', { event: E })).entries.find((e) => e.action === 'support.reply');
    assert.equal(entry.actor_name, adm.name);
    assert.ok(!JSON.stringify(entry).includes('Секретный'), 'текста ответа в журнале нет');
  });

  it('ответ во взятое — ещё одна запись; из чата бота — тоже', async () => {
    await w.api(adm, 'admin.support.send', { event: E, thread: th, text: 'Ещё ответ' });
    assert.equal(replies().length, 2);
    await w.press(adm, `sup:a:${th}`);
    await w.say(adm, 'Ответ из бота');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ? AND from_admin = 1', th)[0].n, 3, 'ответ из бота сохранён');
    assert.equal(replies().length, 3);
    assert.equal(records(w, 'support.take', E).length, 1, 'взятие — одно');
  });

  it('отказы и ответы участника — без записи', async () => {
    const other = await w.api(boss, 'admin.support.send', { event: E, thread: th, text: 'Влезу' }, true);
    assert.deepEqual([other.status, other.data.error], [400, `Обращение ведёт ${adm.name}.`]);
    await w.api(anya, 'support.send', { event: E, text: 'Спасибо' });
    await w.api(adm, 'support.send', { event: E, text: 'Свой вопрос' });
    const own = w.query('SELECT id FROM support_threads WHERE user_id = ?', adm.id)[0].id;
    assert.equal((await w.api(adm, 'admin.support.send', { event: E, thread: own, text: 'Сам себе' }, true)).status, 400);
    await w.api(anya, 'support.close', { event: E });
    assert.equal((await w.api(adm, 'admin.support.send', { event: E, thread: th, text: 'Поздно' }, true)).status, 400);
    assert.equal(replies().length, 3);
  });
});

describe('«только для чтения»: один текст в API, боте и приложении (034, US1)', () => {
  let w, E;
  const refusal = async (user, action, body) => {
    const r = await w.api(user, action, body, true);
    return [r.status, r.data.error];
  };
  const botAnswer = async (user, data) => {
    await w.press(user, data);
    return w.calls.filter((c) => c.method === 'answerCallbackQuery').at(-1).params.text;
  };
  before(async () => {
    ({ w, E } = await world());
    await w.api(boss, 'admin.draw', { event: E });
    await w.api(anya, 'support.send', { event: E, text: 'Вопрос' });
    await w.api(boss, 'admin.event.finish', { event: E });
    w.query('UPDATE events SET finished_at = finished_at - ? WHERE id = ?', 8 * 24 * 3600 * 1000, E);
  });

  it('тексты — с тире, без «доступна»', () => {
    assert.equal(CHAT_READ_ONLY, 'Событие завершено больше недели назад — переписка только для чтения.');
    assert.equal(SUPPORT_READ_ONLY, 'Событие завершено больше недели назад — обращения только для чтения.');
  });

  it('API: переписка и обращения', async () => {
    assert.deepEqual(await refusal(anya, 'message.send', { event: E, to: 'ward', text: 'Привет' }), [400, CHAT_READ_ONLY]);
    assert.deepEqual(await refusal(anya, 'support.send', { event: E, text: 'Ещё вопрос' }), [400, SUPPORT_READ_ONLY]);
    assert.deepEqual(await refusal(anya, 'support.close', { event: E }), [400, SUPPORT_READ_ONLY]);
  });

  it('бот: «↩️ Ответить» в переписку и организатору', async () => {
    assert.equal(await botAnswer(anya, `msg:ward:${E}`), CHAT_READ_ONLY);
    assert.equal(await botAnswer(anya, `sup:u:${E}`), SUPPORT_READ_ONLY);
  });

  it('приложение показывает те же тексты; в модулях сервера — только общие из format.js', () => {
    const src = new URL('../src/', import.meta.url);
    for (const key of ['app.sheet.chatReadOnly', 'app.sheet.supportReadOnly']) {
      assert.equal(APP.split(`t('${key}')`).length - 1, 1, `в приложении нет t('${key}')`);
      for (const f of readdirSync(src).filter((x) => x.endsWith('.js') && x !== 'format.js')) {
        assert.ok(!readFileSync(new URL(f, src), 'utf8').includes(key), `src/${f}: свой ключ «только для чтения» — бери из format.js`);
      }
    }
    assert.ok(!APP.includes('больше недели назад'), 'текст — только в словаре');
  });
});


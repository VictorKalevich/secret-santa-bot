// 057 (specs/057-cron-marks/): минутная проверка по отметкам. Уведомление Санте «обновил письмо» — по отметке участника
// (members.notify_at): ставят записи письма и адреса при наличии Санты, снимает минутная проверка, если после чтения не
// было новой правки; текст, задержка и режимы — прежние. Ежедневный шаг — по отметке события (events.checked_on):
// проверенное сегодня событие не читается, сохранение параметров, жеребьёвка и сброс отметку снимают, напоминание не
// повторяется. Контракт — specs/057-cron-marks/contracts/cron-marks.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { statementsDuring } from './support/plans.mjs';
import { NOTIFY_MARK } from '../src/participant.js';

after(restoreFetch);

const MIN = 60000;
const local = (days = 0) => new Date(Date.now() + 3 * 3600000 + days * 86400000).toISOString().slice(0, 10);

// Часы Worker и подписи initData — на minutes вперёд (минутная проверка «через N минут»)
async function later(minutes, fn) {
  const real = Date.now;
  Date.now = () => real() + minutes * MIN;
  try {
    return await fn();
  } finally {
    Date.now = real;
  }
}

// Событие после жеребьёвки: владелец и трое участников, адрес доставки включён, задержка уведомления — 10 минут
async function drawnWorld() {
  const w = await startWorld({ notifyDelay: 10 });
  const boss = { id: 5701, name: 'Владелец', username: 'boss' };
  const [a, b, c] = [5711, 5712, 5713].map((id, i) => ({ id, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));
  await w.say(boss, '/start ' + (await w.setup()).adminCode);
  await w.say(boss, boss.name);
  const create = async (title, people) => {
    const id = (await w.api(boss, 'event.create', { participate: false, title })).event.id;
    const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
    for (const u of people) {
      await w.say(u, '/start ' + code);
      if (!w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered) await w.say(u, u.name);
    }
    return id;
  };
  const ev = await create('Отметки', [a, b, c]);
  await w.api(boss, 'admin.participate', { event: ev, on: true });
  await w.api(boss, 'admin.game', { event: ev, delivery_on: true });
  for (const u of [boss, a, b, c]) await w.api(u, 'wishlist.save', { event: ev, text: 'Хочу книгу ' + u.id });
  const before = w.query('SELECT notify_at FROM members WHERE event_id = ?', ev).map((r) => r.notify_at);
  assert.deepEqual(before, [0, 0, 0, 0], 'до жеребьёвки — без отметок (уведомлять некого)');
  await w.api(boss, 'admin.draw', { event: ev });
  await w.cron();
  const z = { w, boss, a, b, c, ev, create };
  z.who = (id) => [boss, a, b, c].find((u) => u.id === id);
  z.mark = (u, event = ev) => w.query('SELECT notify_at FROM members WHERE event_id = ? AND user_id = ?', event, u.id)[0]?.notify_at;
  z.santaOf = (u) => w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', ev, u.id)[0].santa;
  z.notes = (santa) => w.calls.filter((x) => x.method === 'sendMessage' && x.params.chat_id === santa && /обновил письмо/.test(x.params.text || ''));
  return z;
}

test('US1: правка после жеребьёвки — отметка; через задержку одно прежнее сообщение; отметка снята', async () => {
  const { w, a, ev, mark, santaOf, notes } = await drawnWorld();
  const santa = santaOf(a);
  const r = await w.api(a, 'wishlist.save', { event: ev, text: 'Хочу шарф' });
  assert.equal(mark(a), r.updated_at, 'отметка — время правки');
  await w.cron();
  await later(9, () => w.cron());
  assert.equal(notes(santa).length, 0, 'до задержки — тишина');
  assert.equal(mark(a), r.updated_at, 'отметка стоит');
  await later(11, () => w.cron());
  const sent = notes(santa);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].params.text, '📝 Твой подопечный в событии «Отметки» обновил письмо или адрес доставки.');
  assert.match(JSON.stringify(sent[0].params.reply_markup), /👀 Посмотреть/);
  assert.ok(!sent[0].params.disable_notification);
  assert.equal(mark(a), 0, 'отметка снята');
  assert.equal(w.query('SELECT notified_at FROM pairs WHERE event_id = ? AND ward = ?', ev, a.id)[0].notified_at, r.updated_at);
  await later(12, () => w.cron());
  assert.equal(notes(santa).length, 1, 'второго нет');
  // Серия правок — одно сообщение
  for (const text of ['Шарф и шапку', 'Шарф, шапку, варежки', 'Только варежки']) await w.api(a, 'wishlist.save', { event: ev, text });
  await later(11, () => w.cron());
  await later(12, () => w.cron());
  assert.equal(notes(santa).length, 2, 'серия — одно сообщение');
});

test('US1: адрес доставки, режимы «выключено» и «без звука», публикация черновика; без изменений, черновик и открытка — без отметки', async () => {
  const { w, boss, a, b, c, ev, mark, santaOf, notes, who } = await drawnWorld();
  await w.api(b, 'delivery.save', { event: ev, text: 'Минск, Победителей 1' });
  assert.ok(mark(b) > 0, 'адрес — отметка');
  await w.api(who(santaOf(c)), 'notify.set', { mode: 'off' });
  await w.api(c, 'wishlist.save', { event: ev, text: 'Хочу чай' });
  const cTime = mark(c);
  await w.api(who(santaOf(a)), 'notify.set', { mode: 'silent' });
  await w.api(a, 'wishlist.save', { event: ev, text: 'Хочу кофе' });
  await later(11, () => w.cron());
  assert.match(notes(santaOf(b))[0].params.text, /обновил письмо или адрес доставки/);
  assert.equal(notes(santaOf(c)).length, 0, 'уведомления выключены — сообщения нет');
  assert.equal(mark(c), 0);
  assert.equal(w.query('SELECT notified_at FROM pairs WHERE event_id = ? AND ward = ?', ev, c.id)[0].notified_at, cTime, 'правка учтена');
  assert.equal(notes(santaOf(a))[0].params.disable_notification, true, 'без звука');
  // Без изменений, открытка — не правка
  await w.api(a, 'wishlist.save', { event: ev, text: 'Хочу кофе' });
  await w.api(a, 'delivery.save', { event: ev, text: '' });
  await w.api(a, 'card.set', { event: ev, card: 'snow' });
  assert.equal(mark(a), 0, 'сохранение без изменений и открытка — без отметки');
  // Черновики (041): черновик — без отметки, публикация изменённого — отметка и уведомление, неизменённого — без
  await w.api(boss, 'admin.game', { event: ev, letter_drafts: true });
  const draft = async () => (await w.api(a, 'event.get', { event: ev })).member.draft;
  const write = async (action, text) => {
    const d = await draft();
    return w.api(a, action, { event: ev, text, revision: d.revision, joined_at: d.joined_at });
  };
  await write('wishlist.draft', 'Черновик для себя');
  assert.equal(mark(a), 0, 'черновик — без отметки');
  const pub = await write('wishlist.publish', 'Опубликованное письмо');
  assert.equal(mark(a), pub.updated_at, 'публикация изменённого — отметка');
  await later(11, () => w.cron());
  assert.equal(notes(santaOf(a)).length, 2, 'публикация — уведомление');
  await write('wishlist.publish', 'Опубликованное письмо');
  assert.equal(mark(a), 0, 'публикация без изменений — без отметки');
});

test('US1: правка во время обработки не теряется — отметка остаётся, второе сообщение после задержки', async () => {
  const { w, a, ev, mark, santaOf, notes } = await drawnWorld();
  const santa = santaOf(a);
  await w.api(a, 'wishlist.save', { event: ev, text: 'Первая правка' });
  let second;
  w.beforeWrite('UPDATE members SET notify_at = 0', async () => {
    second = (await w.api(a, 'wishlist.save', { event: ev, text: 'Вторая правка' })).updated_at;
  });
  await later(11, () => w.cron());
  assert.equal(notes(santa).length, 1, 'первая правка — сообщение');
  assert.equal(mark(a), second, 'отметка второй правки не снята');
  await later(15, () => w.cron());
  assert.equal(notes(santa).length, 1, 'до задержки от второй правки — тишина');
  await later(22, () => w.cron());
  assert.equal(notes(santa).length, 2, 'вторая правка — своё сообщение');
  assert.equal(mark(a), 0);
});

test('US1: без Санты и при перестройке пар — снятие молча; сброс обнуляет отметки; перенос участия переносит отметку', async () => {
  const z = await drawnWorld();
  const { w, boss, ev, mark, santaOf, notes } = z;
  // Санту удалили после правки: новая пара считает письмо увиденным — уведомления нет, отметка снята. Подопечный — тот,
  // чей Санта не владелец (в кольце из четырёх такой есть всегда)
  const x = [z.a, z.b, z.c].find((u) => santaOf(u) !== boss.id);
  await w.api(x, 'wishlist.save', { event: ev, text: 'Новое письмо' });
  assert.ok(mark(x) > 0);
  await w.api(boss, 'admin.remove', { event: ev, id: santaOf(x) });
  const next = santaOf(x);
  await later(11, () => w.cron());
  assert.equal(notes(next).length, 0, 'новый Санта — без уведомления о правке до пары');
  assert.equal(mark(x), 0, 'отметка снята молча');
  // Перенос участия: отметка у нового аккаунта, уведомление — его Санте
  const moved = x;
  const fresh = { id: 5799, name: 'Новый аккаунт', username: 'fresh' };
  await z.create('Регистрация нового аккаунта', [fresh]);
  const r = await w.api(moved, 'wishlist.save', { event: ev, text: 'Письмо до переноса' });
  await w.api(boss, 'admin.transfer', { from: moved.id, to: fresh.id });
  assert.equal(mark(fresh), r.updated_at, 'отметка перешла с участием');
  const santa = santaOf(fresh);
  const before = notes(santa).length;
  await later(11, () => w.cron());
  assert.equal(notes(santa).length, before + 1, 'Санта нового аккаунта уведомлён');
  // Полный сброс: отметки участников события обнуляются
  await w.api(boss, 'wishlist.save', { event: ev, text: 'Письмо владельца' });
  assert.ok(mark(boss) > 0);
  await w.api(boss, 'admin.reset.full', { event: ev, confirm: 'СБРОС' });
  assert.deepEqual(w.query('SELECT notify_at FROM members WHERE event_id = ?', ev).map((x) => x.notify_at), [0]);
});

// Литералы JS из текста: в одинарных, двойных и обратных кавычках
const literals = (text) => [...text.matchAll(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g)].map((m) => m[0]);
const unmarked = (text) => literals(text).filter((l) => /(?:wishlist|delivery)_updated_at = \?/.test(l) && !l.includes('${NOTIFY_MARK}'));

test('контракт: каждая запись, меняющая время письма или адреса, ставит отметку; «от противного»', () => {
  const dir = new URL('../src/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const writes = files.flatMap((f) => literals(readFileSync(new URL(f, dir), 'utf8')).filter((l) => /(?:wishlist|delivery)_updated_at = \?/.test(l)).map(() => f));
  assert.deepEqual(writes, ['participant.js', 'participant.js', 'participant.js'], 'три записи: письмо, публикация, адрес');
  assert.deepEqual(files.flatMap((f) => unmarked(readFileSync(new URL(f, dir), 'utf8')).map((l) => `${f}: ${l.slice(0, 80)}`)), []);
  assert.deepEqual(unmarked("db.prepare('UPDATE members SET delivery = ?, delivery_updated_at = ? WHERE event_id = ?')").length, 1, 'запись без отметки находится');
});

test('от противного: без отметки в записи письма минутная проверка правку не видит', async () => {
  const { w, a, ev, mark, santaOf, notes } = await drawnWorld();
  const { sqlite } = w.DB;
  const own = sqlite.prepare;
  const exists = NOTIFY_MARK.slice(NOTIFY_MARK.indexOf('EXISTS'), NOTIFY_MARK.indexOf(' THEN'));
  sqlite.prepare = (sql) => own.call(sqlite, sql.replace(exists, '0'));
  try {
    await w.api(a, 'wishlist.save', { event: ev, text: 'Правка без отметки' });
  } finally {
    sqlite.prepare = own;
  }
  assert.equal(mark(a), 0);
  await later(11, () => w.cron());
  assert.equal(notes(santaOf(a)).length, 0, 'без отметки уведомления нет — перебора пар больше нет');
});

// ---------- ежедневный шаг ----------

async function dailyWorld() {
  const w = await startWorld();
  const boss = { id: 5801, name: 'Владелец', username: 'boss' };
  const people = [5811, 5812, 5813].map((id, i) => ({ id, name: 'Друг' + (i + 1), username: 'd' + (i + 1) }));
  await w.say(boss, '/start ' + (await w.setup()).adminCode);
  await w.say(boss, boss.name);
  const create = async (title, list = []) => {
    const id = (await w.api(boss, 'event.create', { participate: false, title })).event.id;
    const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
    for (const u of list) {
      await w.say(u, '/start ' + code);
      if (!w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered) await w.say(u, u.name);
    }
    return id;
  };
  const ev = (id) => w.query('SELECT checked_on, last_daily, draw_done, revealed FROM events WHERE id = ?', id)[0];
  return { w, boss, people, create, ev };
}

test('US2: проверенное сегодня событие не читается; обычная минута — 3 запроса', async () => {
  const { w, people, create, ev } = await dailyWorld();
  const E1 = await create('Первое', people);
  const E2 = await create('Пустое');
  await w.cron();
  assert.deepEqual([ev(E1).checked_on, ev(E2).checked_on], [local(0), local(0)], 'оба отмечены');
  assert.deepEqual([ev(E1).last_daily, ev(E2).last_daily], [local(0), local(0)]);
  const list = await statementsDuring(w, () => w.cron());
  const daily = list.find((s) => /AS outsiders/.test(s));
  assert.equal(w.DB.sqlite.prepare(daily).all(0, local(0), Date.now()).length, 0, 'запрос ежедневного шага ничего не находит');
  assert.equal(w.last.db, 3);
});

test('US2: автожеребьёвка, заданная после проверки, — в следующую минуту; жеребьёвка вручную — автораскрытие; сброс', async () => {
  const { w, boss, people, create, ev } = await dailyWorld();
  const E = await create('Автожеребьёвка', people);
  await w.cron();
  assert.equal(ev(E).checked_on, local(0));
  await w.api(boss, 'admin.game', { event: E, draw_auto_date: local(0) });
  assert.equal(ev(E).checked_on, '', 'сохранение параметров снимает отметку');
  assert.equal(ev(E).last_daily, local(0), '«сегодня сделано» остаётся');
  await w.cron();
  assert.equal(ev(E).draw_done, 1, 'автожеребьёвка в следующую минуту');
  await w.cron();
  assert.equal(ev(E).checked_on, local(0), 'после автодействий — отмечено');

  const R = await create('Раскрытие', people);
  await w.api(boss, 'admin.game', { event: R, reveal_auto: true, event_date: local(-2) });
  await w.cron();
  assert.deepEqual([ev(R).checked_on, !!ev(R).revealed], [local(0), false], 'без жеребьёвки раскрывать нечего');
  await w.api(boss, 'admin.draw', { event: R });
  assert.equal(ev(R).checked_on, '', 'жеребьёвка снимает отметку');
  await w.cron();
  assert.ok(ev(R).revealed, 'автораскрытие в следующую минуту');

  await w.api(boss, 'admin.reset.full', { event: E, confirm: 'СБРОС' });
  assert.deepEqual([ev(E).checked_on, ev(E).last_daily], ['', ''], 'сброс снимает обе отметки');
});

test('US2: напоминание не повторяется после сохранения параметров; несколько напоминаний — по одному в минуту', async () => {
  const { w, boss, people, create, ev } = await dailyWorld();
  const ids = [];
  for (const title of ['Н1', 'Н2', 'Н3']) {
    const id = await create(title, people);
    await w.api(boss, 'admin.game', { event: id, deadline: local(0) }); // у всех письма пустые — напоминание сегодня
    ids.push(id);
  }
  const reminders = (u) => w.texts(u).filter((t) => t.startsWith('⏰')).length;
  await w.cron();
  assert.equal(ids.filter((id) => ev(id).checked_on === local(0)).length, 1, 'одно тяжёлое действие за минуту — отмечено одно');
  await w.cron();
  await w.cron();
  assert.deepEqual(ids.map((id) => ev(id).checked_on), ids.map(() => local(0)));
  assert.equal(reminders(people[0]), 3, 'по напоминанию на событие');
  await w.api(boss, 'admin.game', { event: ids[0], title: 'Н1 — новое название' });
  assert.equal(ev(ids[0]).checked_on, '');
  await w.cron();
  await w.cron();
  assert.equal(reminders(people[0]), 3, 'второго напоминания в тот же день нет');
  assert.equal(ev(ids[0]).checked_on, local(0));
});

test('от противного: без снятия отметки жеребьёвкой и сохранением автодействие в этот день не наступает', async () => {
  const { w, boss, people, create, ev } = await dailyWorld();
  const E = await create('Без снятия', people);
  await w.cron();
  await w.api(boss, 'admin.game', { event: E, draw_auto_date: local(0) });
  w.sql(`UPDATE events SET checked_on = '${local(0)}' WHERE id = ${E}`); // как если бы сохранение отметку не снимало
  await w.cron();
  await w.cron();
  assert.equal(ev(E).draw_done, 0, 'событие не перечитано — автожеребьёвки нет');

  const R = await create('Раскрытие без снятия', people);
  await w.api(boss, 'admin.game', { event: R, reveal_auto: true, event_date: local(-2) });
  await w.cron();
  await w.api(boss, 'admin.draw', { event: R });
  w.sql(`UPDATE events SET checked_on = '${local(0)}' WHERE id = ${R}`); // как если бы жеребьёвка отметку не снимала
  await w.cron();
  assert.ok(!ev(R).revealed, 'автораскрытия нет');
});

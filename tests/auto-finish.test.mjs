// 056 (specs/056-auto-finish-stale/, контракт contracts/auto-finish.md): автозавершение брошенных событий в открытом боте.
// Правила А (дата вручения прошла 7 дней назад), Г (без даты, без жеребьёвки, никого, кроме владельца и администраторов,
// 23 дня от создания), Б (без даты, 113 дней) → предупреждение администраторам компании, через 7 дней — обычное
// завершение; перестало подходить — отметка снимается; закрытый бот — как раньше; ежедневный шаг читает участников только
// у кандидатов Г и по индексам, обычная минута — 3 запроса.
import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { fullScans as scansOf, statementsDuring } from './support/plans.mjs';
import { staleReason, staleStep, dailyEventsQuery } from '../src/stale.js';
import { formatDate, addDays } from '../src/format.js';

after(restoreFetch);

const DAY = 86400000;
const ENV = { TIMEZONE_OFFSET_HOURS: '3' };
// Местная дата через days дней (UTC+3, как в мире)
const local = (days = 0) => new Date(Date.now() + 3 * 3600000 + days * DAY).toISOString().slice(0, 10);
const boss = { id: 9601, name: 'Владелец бота', username: 'boss' };
const org = { id: 9602, name: 'Аня', username: 'anya' };
const adm = { id: 9603, name: 'Боря', username: 'borya' };
const people = [9611, 9612, 9613, 9614].map((id, i) => ({ id, name: 'Игрок' + (i + 1), username: 'p' + id }));
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

const WARN = (title, until, why, keep) => `⏳ <b>Событие «${title}» завершится автоматически ${formatDate(until)}.</b>\n${why}\n\n${keep}`;
const KEEP_DATE = 'Если событие ещё нужно — перенеси дату вручения: «Управление» → «Параметры».';
const KEEP_EMPTY = 'Если событие ещё нужно — пригласи участников или укажи дату вручения: «Управление» → «Параметры».';
const KEEP_AGE = 'Если событие ещё нужно — укажи дату вручения: «Управление» → «Параметры».';
const WHY_EMPTY = 'В него пока никто не вступил, кроме владельца и администраторов.';
const WHY_AGE = 'У него нет даты вручения, а создано оно больше трёх месяцев назад.';

// Мир: владелец бота; в открытом — Аня создаёт свою компанию, Боря — её администратор; в закрытом — компания 1 владельца бота
async function world(open = true) {
  const w = await startWorld({ open });
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const z = { w, lead: open ? org : boss, company: 1 };
  z.join = async (u, id) => {
    const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
    await w.say(u, '/start ' + inviteOf(await w.api(z.lead, 'admin.state', { event: id })));
    if (!known) await w.say(u, u.name);
  };
  z.event = async (title, members = []) => {
    const id = (await w.api(z.lead, 'admin.events.create', { company: z.company, title })).event.id;
    for (const u of members) await z.join(u, id);
    return id;
  };
  z.ev = (id) => w.query('SELECT status, finish_warned, last_daily FROM events WHERE id = ?', id)[0];
  // «Перемотка»: правка дат события и сброс отметок «сегодня сделано» и «на сегодня проверено» (057) — следующий
  // ежедневный шаг проверит его заново
  z.set = (id, fields) => {
    const all = { last_daily: '', checked_on: '', ...fields };
    const keys = Object.keys(all);
    w.DB.sqlite.prepare(`UPDATE events SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => all[k]), id);
  };
  z.ago = (days) => Date.now() - days * DAY;
  z.warns = (u, title) => w.texts(u).filter((t) => t.startsWith('⏳') && t.includes(`«${title}»`));
  z.log = (id, action) => w.query('SELECT actor, details FROM audit WHERE event_id = ? AND action = ? ORDER BY id', id, action);
  // Ежедневный шаг выполняет одно тяжёлое действие за запуск: несколько запусков — все кандидаты
  z.daily = async (n = 4) => {
    for (let i = 0; i < n; i++) await w.cron();
  };
  if (open) {
    await w.say(org, '/start');
    await w.say(org, org.name);
    z.company = (await w.api(org, 'company.create', { name: 'Семья' })).company;
    const first = await z.event('Знакомство', [adm]);
    await w.api(org, 'admin.role.grant', { id: adm.id });
    z.set(first, { event_date: local(60) }); // будущая дата — правила его не трогают
  }
  return z;
}

describe('056: чистые правила на границах', () => {
  const today = '2026-12-31';
  const made = (days) => Date.parse(addDays(today, -days) + 'T09:00:00Z'); // местный полдень дня «сегодня − days»
  const ev = (fields) => ({ event_date: '', draw_done: 0, outsiders: -1, finish_warned: '', created_at: made(1), ...fields });

  it('А: дата вручения — 6 дней назад нет, 7 — да; будущая дата защищает и старое пустое событие', () => {
    assert.equal(staleReason(ENV, ev({ event_date: addDays(today, -6) }), today), null);
    assert.equal(staleReason(ENV, ev({ event_date: addDays(today, -7) }), today), 'date');
    assert.equal(staleReason(ENV, ev({ event_date: addDays(today, 1), outsiders: 0, created_at: made(500) }), today), null);
  });

  it('Г: без даты, без жеребьёвки, никого, кроме администраторов — 22 дня нет, 23 — да', () => {
    assert.equal(staleReason(ENV, ev({ outsiders: 0, created_at: made(22) }), today), null);
    assert.equal(staleReason(ENV, ev({ outsiders: 0, created_at: made(23) }), today), 'empty');
    assert.equal(staleReason(ENV, ev({ outsiders: 1, created_at: made(23) }), today), null, 'есть участник');
    assert.equal(staleReason(ENV, ev({ outsiders: 0, draw_done: 1, created_at: made(23) }), today), null, 'жеребьёвка');
    // От противного: без подсчёта участников (прежний запрос событий, outsiders нет) пустое событие не узнать
    assert.equal(staleReason(ENV, ev({ outsiders: undefined, created_at: made(30) }), today), null);
  });

  it('Б: без даты — 112 дней нет, 113 — да; пустое старое — по правилу Г', () => {
    assert.equal(staleReason(ENV, ev({ outsiders: 2, created_at: made(112) }), today), null);
    assert.equal(staleReason(ENV, ev({ outsiders: 2, created_at: made(113) }), today), 'age');
    assert.equal(staleReason(ENV, ev({ outsiders: 2, draw_done: 1, created_at: made(113) }), today), 'age');
    assert.equal(staleReason(ENV, ev({ outsiders: 0, created_at: made(113) }), today), 'empty');
  });

  it('шаг: предупредить, ждать 7 дней, завершить; перестало подходить — снять отметку', () => {
    const due = { event_date: addDays(today, -10) };
    assert.deepEqual(staleStep(ENV, ev(due), today), { act: 'warn', reason: 'date', until: addDays(today, 7) });
    assert.equal(staleStep(ENV, ev({ ...due, finish_warned: today }), today), null);
    assert.equal(staleStep(ENV, ev({ ...due, finish_warned: addDays(today, -6) }), today), null);
    assert.deepEqual(staleStep(ENV, ev({ ...due, finish_warned: addDays(today, -7) }), today), { act: 'finish' });
    assert.deepEqual(staleStep(ENV, ev({ event_date: addDays(today, 3), finish_warned: addDays(today, -7) }), today), { act: 'clear' });
    assert.equal(staleStep(ENV, ev({ event_date: addDays(today, 3) }), today), null);
    // Отметка не помнит причину: предупредили как пустое, теперь подходит по дате — завершается в свой день
    assert.deepEqual(staleStep(ENV, ev({ ...due, outsiders: 3, finish_warned: addDays(today, -7) }), today), { act: 'finish' });
  });
});

describe('056: открытый бот', () => {
  let z;
  before(async () => {
    z = await world(true);
  });

  it('А: дата прошла 7 дней назад — предупреждение администраторам, перенос даты снимает отметку, через 7 дней — завершение', async () => {
    const { w } = z;
    const id = await z.event('Ёлка', [people[0], people[1]]);
    z.set(id, { event_date: local(-6) });
    await z.daily();
    assert.equal(z.warns(org, 'Ёлка').length, 0, '6 дней — рано');
    assert.equal(z.ev(id).finish_warned, '');

    z.set(id, { event_date: local(-7) });
    await z.daily();
    const text = WARN('Ёлка', local(7), `Дата вручения (${formatDate(local(-7))}) уже прошла.`, KEEP_DATE);
    for (const u of [org, adm]) assert.deepEqual(z.warns(u, 'Ёлка'), [text], u.name);
    for (const u of [boss, ...people.slice(0, 2)]) assert.equal(z.warns(u, 'Ёлка').length, 0, `${u.name}: не администратор компании`);
    const sent = w.calls.find((c) => c.method === 'sendMessage' && c.params.chat_id === org.id && c.params.text === text);
    const button = sent.params.reply_markup.inline_keyboard[0][0];
    assert.equal(button.text, '⚙️ Открыть событие');
    assert.match(button.web_app.url, new RegExp(`/app\\?event=${id}$`));
    assert.deepEqual(z.log(id, 'finish.warn'), [{ actor: 0, details: `дата вручения прошла; завершится ${formatDate(local(7))}` }]);
    assert.deepEqual(z.ev(id), { status: 'active', finish_warned: local(0), last_daily: local(0) });

    await z.daily(); // тот же день — ничего
    z.set(id, {}); // и при новой проверке в пределах 7 дней — ничего
    await z.daily();
    assert.equal(z.warns(org, 'Ёлка').length, 1);
    assert.equal(z.log(id, 'finish.warn').length, 1);

    z.set(id, { event_date: local(10) }); // организатор перенёс дату
    await z.daily();
    assert.equal(z.ev(id).finish_warned, '', 'отметка снята');
    assert.equal(z.warns(org, 'Ёлка').length, 1, 'без сообщений');
    assert.equal(z.log(id, 'finish.warn').length, 1, 'без журнала');

    z.set(id, { event_date: local(-14) }); // снова брошено — новое предупреждение
    await z.daily();
    assert.equal(z.warns(org, 'Ёлка').length, 2);
    assert.equal(z.ev(id).finish_warned, local(0));

    z.set(id, { finish_warned: local(-6) });
    await z.daily();
    assert.equal(z.ev(id).status, 'active', '6 дней после предупреждения — рано');

    z.set(id, { finish_warned: local(-7) });
    await z.daily();
    assert.equal(z.ev(id).status, 'finished');
    for (const u of people.slice(0, 2)) {
      assert.ok(w.texts(u).some((t) => t.startsWith('🏁 <b>Событие «Ёлка» завершено.</b>')), `${u.name}: прежнее сообщение`);
    }
    assert.deepEqual(z.log(id, 'finish'), [{ actor: 0, details: '' }]);
  });

  it('Г: только владелец и администраторы — 23 дня; вступил участник — отметка снята; ушёл — снова; через 7 дней — завершение', async () => {
    const { w } = z;
    const id = await z.event('Пустое');
    await w.api(org, 'admin.participate', { event: id, on: true });
    await w.api(adm, 'admin.participate', { event: id, on: true });
    z.set(id, { created_at: z.ago(22) });
    await z.daily();
    assert.equal(z.warns(org, 'Пустое').length, 0, '22 дня — рано');

    z.set(id, { created_at: z.ago(23) });
    await z.daily();
    const text = WARN('Пустое', local(7), WHY_EMPTY, KEEP_EMPTY);
    for (const u of [org, adm]) assert.deepEqual(z.warns(u, 'Пустое'), [text], u.name);
    assert.deepEqual(z.log(id, 'finish.warn'), [{ actor: 0, details: `никто не вступил, кроме владельца и администраторов; завершится ${formatDate(local(7))}` }]);

    await z.join(people[2], id);
    z.set(id, {});
    await z.daily();
    assert.equal(z.ev(id).finish_warned, '', 'вступил участник — отметка снята');

    await w.api(org, 'admin.remove', { event: id, id: people[2].id });
    z.set(id, {});
    await z.daily();
    assert.equal(z.warns(org, 'Пустое').length, 2, 'снова пустое — новое предупреждение');

    z.set(id, { finish_warned: local(-7) });
    await z.daily();
    assert.equal(z.ev(id).status, 'finished');
    assert.ok(w.texts(org).some((t) => t.startsWith('🏁 <b>Событие «Пустое» завершено.</b>')), 'владелец участвовал — прежнее сообщение');
  });

  it('Б: без даты с участником — 113 дней; указали дату — отметка снята; убрали — через 7 дней завершение', async () => {
    const id = await z.event('Без даты', [people[3]]);
    z.set(id, { created_at: z.ago(112) });
    await z.daily();
    assert.equal(z.warns(org, 'Без даты').length, 0, '112 дней — рано');

    z.set(id, { created_at: z.ago(113) });
    await z.daily();
    assert.deepEqual(z.warns(org, 'Без даты'), [WARN('Без даты', local(7), WHY_AGE, KEEP_AGE)]);
    assert.deepEqual(z.log(id, 'finish.warn'), [{ actor: 0, details: `нет даты вручения; завершится ${formatDate(local(7))}` }]);

    z.set(id, { event_date: local(20) });
    await z.daily();
    assert.equal(z.ev(id).finish_warned, '');

    z.set(id, { event_date: '' });
    await z.daily();
    assert.equal(z.warns(org, 'Без даты').length, 2);
    z.set(id, { finish_warned: local(-7) });
    await z.daily();
    assert.equal(z.ev(id).status, 'finished');
  });

  it('напоминание в тот же день: завершение важнее, предупреждение ждёт день', async () => {
    const { w } = z;
    const id = await z.event('Срок письма');
    await w.api(org, 'admin.participate', { event: id, on: true });
    z.set(id, { created_at: z.ago(40), deadline: local(0) }); // сегодня срок письма — напоминание пустым письмам
    await z.daily();
    assert.ok(w.texts(org).some((t) => t.startsWith('⏰ Напоминание') && t.includes('«Срок письма»')), 'напоминание');
    assert.equal(z.ev(id).finish_warned, '', 'предупреждение — не в день напоминания');
    z.set(id, { deadline: local(-1) });
    await z.daily();
    assert.equal(z.warns(org, 'Срок письма').length, 1, 'на следующий день');

    z.set(id, { deadline: local(0), finish_warned: local(-7) });
    const reminders = w.texts(org).filter((t) => t.startsWith('⏰')).length;
    await z.daily();
    assert.equal(z.ev(id).status, 'finished', 'завершение важнее напоминания');
    assert.equal(w.texts(org).filter((t) => t.startsWith('⏰')).length, reminders, 'напоминания нет');
  });

  it('полный сброс снимает отметку', async () => {
    const id = await z.event('Сброс', [people[0]]);
    z.set(id, { event_date: local(-8) });
    await z.daily();
    assert.equal(z.ev(id).finish_warned, local(0));
    await z.w.api(org, 'admin.reset.full', { event: id, confirm: 'СБРОС' });
    assert.equal(z.ev(id).finish_warned, '');
  });
});

test('056: из двух одновременных запусков — одно предупреждение и одна запись журнала', async () => {
  const z = await world(true);
  const id = await z.event('Гонка', [people[0]]);
  await z.daily(); // первое событие и «Гонка» проверены сегодня
  z.set(id, { event_date: local(-9) });
  await z.w.together([() => z.w.cron(), () => z.w.cron()]);
  assert.equal(z.warns(org, 'Гонка').length, 1);
  assert.equal(z.log(id, 'finish.warn').length, 1);
  assert.equal(z.ev(id).finish_warned, local(0));
});

test('056: закрытый бот — ни предупреждений, ни автозавершения', async () => {
  const z = await world(false);
  const ids = [
    await z.event('Старое пустое'),
    await z.event('Прошла дата', [people[0]]),
    await z.event('Старое с людьми', [people[1]]),
  ];
  z.set(ids[0], { created_at: z.ago(200) });
  z.set(ids[1], { event_date: local(-30), finish_warned: local(-10) });
  z.set(ids[2], { created_at: z.ago(200) });
  await z.daily(6);
  for (const id of ids) assert.equal(z.ev(id).status, 'active');
  assert.equal(z.w.texts(boss).filter((t) => t.startsWith('⏳')).length, 0);
  assert.equal(z.w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'finish.warn'")[0].n, 0);
  assert.equal(z.ev(ids[0]).finish_warned, '');
  assert.equal(z.ev(ids[1]).finish_warned, local(-10), 'чужую отметку закрытый бот не трогает');
});

test('056: ежедневный шаг — участники только у кандидатов Г и по индексам; обычная минута — 3 запроса', async () => {
  const z = await world(true);
  const { w } = z;
  const id = await z.event('План');
  await w.api(org, 'admin.participate', { event: id, on: true });
  z.set(id, { created_at: z.ago(30) });
  const list = await statementsDuring(w, () => w.cron());
  const daily = list.find((s) => /AS outsiders/.test(s));
  assert.ok(daily, 'запрос событий ежедневного шага');
  const scans = list.flatMap((s) => scansOf(w.DB.sqlite, s, { tables: ['settings', 'outbox'] }).map((x) => `${x} ← ${s.slice(0, 80)}`));
  assert.deepEqual(scans, []);
  const plan = w.DB.sqlite.prepare('EXPLAIN QUERY PLAN ' + daily).all().map((r) => r.detail);
  // 057: только не проверенные сегодня — поиском по индексу events_unchecked
  assert.ok(plan.some((d) => /^SEARCH events USING (?:COVERING )?INDEX events_unchecked \(checked_on<\?\)/.test(d)), plan.join(' | '));
  assert.ok(plan.some((d) => /^SEARCH m USING (?:COVERING )?INDEX \w+ \(event_id=\?/.test(d)), plan.join(' | '));
  assert.ok(plan.some((d) => /^SEARCH cm USING (?:COVERING )?INDEX \w+ \(company_id=\? AND user_id=\?\)/.test(d)), plan.join(' | '));
  assert.equal(z.warns(org, 'План').length, 1, 'кандидат Г обработан');

  // Подзапрос считается только у кандидатов: в закрытом боте и у проверенных сегодня — -1
  const rows = (open, today) => w.DB.sqlite.prepare(dailyEventsQuery({ prepare: (sql) => ({ bind: () => sql }) }, { open, today })).all(open ? 1 : 0, today, Date.now() - 22 * DAY);
  z.set(id, {});
  assert.equal(rows(true, local(0)).find((r) => r.id === id).outsiders, 0, 'кандидат: участников, кроме администраторов, нет');
  assert.equal(rows(false, local(0)).find((r) => r.id === id).outsiders, -1, 'закрытый бот — не считается');
  z.set(id, { last_daily: local(0) });
  assert.equal(rows(true, local(0)).find((r) => r.id === id).outsiders, -1, 'проверенное сегодня — не считается');

  await z.daily();
  await w.cron();
  assert.equal(w.last.db, 3, 'обычная минута — три запроса, как до 056');
});

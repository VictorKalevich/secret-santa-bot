// 064 (specs/064-texts-cleanup/, contracts/removal.md): адреса, отметок подарка, посылки и напоминаний Сантам нет;
// параметров delivery_on, contacts_on, finish_auto нет (колонки — ради отката); событие с датой завершается само на
// 3-й день; поле ссылки при закрытой регистрации неактивно, кнопок нет. Прежние данные в базе (адреса, отметки,
// посылка) ответы не меняют и наружу не выходят.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP, where, code, topBlock } from './support/app-source.mjs';
import { ACTIONS } from '../src/api.js';
import { EVENT_PARAMS, EVENT_RETIRED } from '../src/event-params.js';

after(restoreFetch);

const GONE_ACTIONS = ['delivery.save', 'ward.gift', 'ward.received', 'ward.shipment', 'admin.remind.santas'];
const GONE_PARAMS = ['delivery_on', 'contacts_on', 'finish_auto'];
const ADDRESS = 'Минск, ул. Прежняя, 7. Метка адреса A7Q.';
const local = (days = 0) => new Date(Date.now() + 3 * 3600000 + days * 86400000).toISOString().slice(0, 10);

const boss = { id: 6401, name: 'Владелец', username: 'boss' };
const adm = { id: 6402, name: 'Админ', username: 'adm' };
const people = [6411, 6412, 6413, 6414].map((id, i) => ({ id, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));

// Событие после жеребьёвки с данными прежнего кода: адреса, отметки «готов», «получил», посылка, все три параметра
async function legacyWorld() {
  const w = await startWorld();
  await w.say(boss, '/start ' + (await w.setup()).adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'event.create', { participate: false, title: 'Прежнее' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev })).settings.invite_link)[1];
  for (const u of [adm, ...people]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { event: ev, id: adm.id });
  await w.api(adm, 'admin.participate', { event: ev, on: false });
  for (const u of people) await w.api(u, 'wishlist.save', { event: ev, text: 'Хочу книгу ' + u.name });
  await w.api(boss, 'admin.draw', { event: ev });
  w.sql(`UPDATE events SET delivery_on = 1, contacts_on = 1, finish_auto = 1 WHERE id = ${ev}`);
  w.sql(`UPDATE members SET delivery = '${ADDRESS}', delivery_updated_at = 1 WHERE event_id = ${ev}`);
  w.sql(`UPDATE pairs SET gift_ready = 1, gift_received = 1, gift_received_at = 1, gift_sent = 1, tracking = 'PRIVATE-064',
    shipment_version = 3 WHERE event_id = ${ev}`);
  return { w, ev };
}

test('сервер: пяти действий нет в таблице, трёх параметров — в списке параметров (они в EVENT_RETIRED)', () => {
  assert.deepEqual(GONE_ACTIONS.filter((a) => a in ACTIONS), []);
  assert.equal(Object.keys(ACTIONS).length, 64);
  assert.deepEqual(GONE_PARAMS.filter((c) => c in EVENT_PARAMS), []);
  assert.deepEqual(GONE_PARAMS.filter((c) => !EVENT_RETIRED.includes(c)), []);
});

test('удалённые действия — путь неизвестного действия; прежние данные не выходят ни в один ответ', async () => {
  const { w, ev } = await legacyWorld();
  const [a] = people;
  for (const action of GONE_ACTIONS) {
    const user = action.startsWith('admin.') ? adm : a;
    const r = await w.api(user, action, { event: ev, ready: true, received: true, text: 'x', sent: true, version: 3 }, true);
    assert.deepEqual([r.status, r.data.error], [404, 'Неизвестное действие'], action);
  }
  const views = {
    'event.get участник': await w.api(a, 'event.get', { event: ev }),
    'event.get админ': await w.api(adm, 'event.get', { event: ev }),
    'ward.get': await w.api(a, 'ward.get', { event: ev }),
    'admin.state админ': await w.api(adm, 'admin.state', { event: ev }),
    'admin.state владелец': await w.api(boss, 'admin.state', { event: ev }),
    'admin.vault.person': await w.api(boss, 'admin.vault.person', { event: ev, id: a.id, confirm: 'ОТКРЫТЬ' }),
    me: await w.api(a, 'me', {}),
  };
  assert.equal(views['ward.get'].state, 'ok', 'проверка не пустая: подопечный открыт');
  assert.ok(views['event.get участник'].roster.people.every((p) => p.username), '@username — всегда');
  const BAD = ['delivery', 'gift_', 'shipment', 'tracking', 'PRIVATE-064', 'A7Q', ...GONE_PARAMS];
  for (const [name, body] of Object.entries(views)) {
    const text = JSON.stringify(body);
    assert.deepEqual(BAD.filter((b) => text.includes(b)), [], name);
  }
  assert.equal(views['event.get участник'].roster.progress, null, 'после жеребьёвки — без сводки');
});

test('admin.game: прежние параметры в запросе ничего не меняют', async () => {
  const { w, ev } = await legacyWorld();
  const cols = () => w.query(`SELECT ${GONE_PARAMS.join(', ')} FROM events WHERE id = ?`, ev)[0];
  w.sql(`UPDATE events SET delivery_on = 0, contacts_on = 0, finish_auto = 0 WHERE id = ${ev}`);
  await w.api(boss, 'admin.game', { event: ev, delivery_on: true, contacts_on: true, finish_auto: true, budget: '30 р.' });
  assert.deepEqual(cols(), { delivery_on: 0, contacts_on: 0, finish_auto: 0 });
  assert.equal(w.query('SELECT budget FROM events WHERE id = ?', ev)[0].budget, '30 р.', 'остальное сохраняется');
});

test('cron: напоминаний Сантам нет; уведомление о правке — «обновил письмо Санте»; событие с датой — завершение на 3-й день', async () => {
  const { w, ev } = await legacyWorld();
  const reset = (fields) => {
    const all = { last_daily: '', checked_on: '', ...fields };
    const keys = Object.keys(all);
    w.DB.sqlite.prepare(`UPDATE events SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => all[k]), ev);
  };
  await w.cron();
  const sent = () => w.calls.filter((c) => c.method === 'sendMessage').length;
  for (const days of [2, 0]) { // прежние дни напоминания Сантам: за 2 дня и в день вручения
    reset({ event_date: local(days), finish_auto: 0 });
    const before = sent();
    for (let i = 0; i < 3; i++) await w.cron();
    assert.equal(sent(), before, `за ${days} дн. до вручения — ни одного сообщения`);
  }
  assert.equal(w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'remind.santas'")[0].n, 0);

  const [a] = people;
  const santa = w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', ev, a.id)[0].santa;
  await w.api(a, 'wishlist.save', { event: ev, text: 'Хочу шарф' });
  await w.cron();
  const notes = w.texts({ id: santa }).filter((t) => t.includes('обновил'));
  assert.deepEqual(notes, ['📝 Твой подопечный в событии «Прежнее» обновил письмо Санте.']);

  reset({ event_date: local(-2), finish_auto: 0 });
  for (let i = 0; i < 3; i++) await w.cron();
  assert.equal(w.query('SELECT status FROM events WHERE id = ?', ev)[0].status, 'active', '2 дня после вручения — идёт');
  reset({ event_date: local(-3), finish_auto: 0 });
  for (let i = 0; i < 3; i++) await w.cron();
  assert.equal(w.query('SELECT status FROM events WHERE id = ?', ev)[0].status, 'finished', 'без галочки — само');
});

// 066: плановое напоминание о пустом письме — одно, за 2 дня до срока; за день и в день срока — нет
test('cron (066): напоминание о пустом письме — только за 2 дня до срока, один раз', async () => {
  const w = await startWorld();
  await w.say(boss, '/start ' + (await w.setup()).adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'event.create', { participate: false, title: 'Срок' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev })).settings.invite_link)[1];
  const [a] = people;
  await w.say(a, '/start ' + code);
  await w.say(a, a.name);
  const reminders = () => w.texts(a).filter((t) => t.startsWith('⏰')).length;
  for (const [days, want] of [[2, 1], [1, 0], [0, 0]]) {
    await w.api(boss, 'admin.game', { event: ev, deadline: local(days) });
    w.sql(`UPDATE events SET last_daily = '', checked_on = '' WHERE id = ${ev}`);
    const before = reminders();
    for (let i = 0; i < 3; i++) await w.cron();
    assert.equal(reminders() - before, want, `за ${days} дн. до срока`);
  }
  assert.equal(w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'remind.unfilled'")[0].n, 1);
});

// ---------- приложение: по склейке ----------
// Что не должно встречаться в коде частей (вне комментариев): вызовы удалённых действий и кнопок, поля удалённых данных;
// 065 — кнопки раскрытия Сант нет (раскрытие — только по расписанию, reveal_auto); 066 — подсказки о напоминаниях нет
const FORBIDDEN = [
  ...GONE_ACTIONS.map((a) => `'${a}'`), "'admin.reset.full'", "'admin.event.finish'", "'admin.reveal'", 'app.admin.draw.reveal',
  'howItWorks', 'aboutSections', 'remindersHint', 'rosterOpen', ...GONE_PARAMS, 'gift_', 'has_delivery', 'shipment', '.delivery',
];

function appRules(app) {
  const lines = app.split('\n');
  const body = (name) => {
    const b = topBlock(lines, name);
    return b ? lines.slice(b[0], b[1] + 1).map(code).join('\n') : '';
  };
  const invite = body('adminInvite');
  return {
    removed: lines.flatMap((l, i) => FORBIDDEN.filter((f) => code(l).includes(f)).map((f) => `${where(i + 1)}: ${f}`)),
    invite: [
      /linkInput\.disabled = linkRow\.hidden = !s\.registration_open;/.test(invite) ? null : 'поле и кнопки — не по регистрации',
      /\n\s+syncLink\(\);\n/.test(invite) ? null : 'нет начального состояния',
      /p\.watch\('registration_open', syncLink\);/.test(invite) ? null : 'переключатель не обновляет поле на месте',
      /h\('div', \{ class: 'ds-row ds-row--wrap' \}, copyBtn, shareBtn, regenBtn\)/.test(invite) ? null : 'кнопки — не в одном ряду',
    ].filter(Boolean),
    people: /openTgLink|t\.me\/|addEventListener/.test(body('personRow')) ? ['строка участника нажимается'] : [],
  };
}

test('склейка: нет адреса, отметок, посылки, «Полного сброса», «Завершить», «Раскрыть Сант» (065), «Как это работает»; ссылка — по регистрации', () => {
  assert.deepEqual(appRules(APP), { removed: [], invite: [], people: [] });
});

test('от противного: каждое правило находит порчу склейки', () => {
  const spoil = (from, to) => {
    assert.ok(APP.includes(from), `в склейке нет «${from}»`);
    return appRules(APP.replace(from, to));
  };
  const broken = (rules) => Object.keys(rules).filter((k) => rules[k].length);
  for (const bad of ["xapi('ward.gift', { ready: true })", "xapi('admin.reset.full')", 'state.ev.delivery_on', 'u.gift_ready', 'howItWorks()',
    "xapi('admin.reveal')", "t('app.admin.draw.revealed')", "ui.hint(t('app.admin.params.remindersHint'))"]) {
    assert.deepEqual(broken(appRules(APP + `\n  function spoiled() {\n    return ${bad};\n  }\n`)), ['removed'], bad);
  }
  assert.deepEqual(broken(appRules(APP + "\n  // xapi('ward.gift') — в комментарии не в счёт\n")), []);
  assert.deepEqual(broken(spoil('linkInput.disabled = linkRow.hidden = !s.registration_open;', 'linkInput.disabled = false;')), ['invite']);
  assert.deepEqual(broken(spoil("    p.watch('registration_open', syncLink);\n", '')), ['invite']);
  assert.deepEqual(broken(spoil('    syncLink();\n', '')), ['invite']);
  assert.deepEqual(broken(spoil("return h('div', { class: 'ds-list-item' }, h('div', { class: 'ds-grow' }, title), role);",
    "const row = h('div', { class: 'ds-list-item' }, h('div', { class: 'ds-grow' }, title), role);\n    row.addEventListener('click', () => openTgLink('https://t.me/' + u.username));\n    return row;")), ['people']);
});

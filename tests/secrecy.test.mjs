// Тайна по значениям (016, FR-1607; Конституция, принцип I): ответы организаторам не зависят от пар, писем и адресов.
// Не «нет ключа с подозрительным именем», а «перестановка пар в базе не меняет ни одного байта ответа».
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const adm2 = { id: 9003, name: 'Второй админ', username: 'adm2' };
const outsider = { id: 9100, name: 'Посторонний', username: 'outsider' };
// Имена не входят друг в друга и в тексты бота — по ним ищем утечки в сообщениях
const NAMES = ['Аврора', 'Богдан', 'Ванесса', 'Гордей', 'Дарина', 'Елисей', 'Жасмин', 'Захар'];
const people = NAMES.map((name, i) => ({ id: 201 + i, name, username: 'u' + (i + 1) }));
const letter = (i) => `Хочу настольную игру и тёплые носки. Метка письма L${i}Q.`;
const address = (i) => `Минск, ул. Тестовая, ${i + 1}. Метка адреса A${i}Q.`;
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

async function join(w, u, code) {
  await w.say(u, '/start ' + code);
  await w.say(u, u.name);
}

// Колонки пар: у Санты — его статусы, у подопечного — его. Новая колонка в pairs — решить, чья она, здесь.
const SANTA_COLS = ['seen_text', 'notified_at', 'gift_ready'];
const WARD_COLS = ['gift_received', 'gift_received_at'];

// Другая допустимая расстановка: у каждого Санты подопечный сменился, никто не дарит себе. Колонки Санты остаются у
// Санты, колонки подопечного переезжают с подопечным. Одна транзакция: удаление и вставка (PK (event_id, santa),
// UNIQUE (event_id, ward) не мешают).
function permutePairs(w, eventId) {
  const cols = w.query('SELECT name FROM pragma_table_info(\'pairs\')').map((r) => r.name).sort();
  assert.deepEqual(cols, ['event_id', 'santa', 'ward', ...SANTA_COLS, ...WARD_COLS].sort(), 'колонки pairs');
  const rows = w.query('SELECT * FROM pairs WHERE event_id = ? ORDER BY santa', eventId);
  assert.ok(rows.length >= 4, 'жеребьёвка проведена');
  const old = new Map(rows.map((r) => [r.santa, r.ward]));
  const wardRow = new Map(rows.map((r) => [r.ward, r]));
  const ids = rows.map((r) => r.santa);
  let next = null;
  for (let k = 1; k < ids.length && !next; k++) {
    const m = new Map(ids.map((s, i) => [s, ids[(i + k) % ids.length]]));
    if (ids.every((s) => m.get(s) !== s && m.get(s) !== old.get(s))) next = m;
  }
  for (let seed = 1; !next; seed++) { // запасной путь: перебор перестановок с зерном
    let x = seed;
    const shuffled = [...ids].sort(() => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) - 0.5);
    const m = new Map(ids.map((s, i) => [s, shuffled[i]]));
    if (ids.every((s) => m.get(s) !== s && m.get(s) !== old.get(s))) next = m;
  }
  const db = w.DB.sqlite;
  const ins = db.prepare(`INSERT INTO pairs (event_id, santa, ward, ${SANTA_COLS.join(', ')}, ${WARD_COLS.join(', ')})
                          VALUES (?, ?, ?, ${[...SANTA_COLS, ...WARD_COLS].map(() => '?').join(', ')})`);
  db.exec('BEGIN');
  db.prepare('DELETE FROM pairs WHERE event_id = ?').run(eventId);
  for (const r of rows) {
    const ward = next.get(r.santa);
    ins.run(eventId, r.santa, ward, ...SANTA_COLS.map((c) => r[c]), ...WARD_COLS.map((c) => wardRow.get(ward)[c]));
  }
  db.exec('COMMIT');
  return next;
}

let w;
let E1;
let E2;
let thread;

before(async () => {
  w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  E1 = (await w.api(boss, 'admin.events.create', { title: 'Тайна' })).event.id;
  await w.api(boss, 'admin.game', { event: E1, delivery_on: true, families_on: true, budget: '50 р.' });
  const code1 = inviteOf(await w.api(boss, 'admin.state', { event: E1 }));
  for (const u of [adm, adm2, ...people]) await join(w, u, code1);
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  await w.api(boss, 'admin.role.grant', { id: adm2.id });
  // Организаторы не участвуют: их собственные пары по замыслу видны им в ward.get, а не в ответах админа
  await w.api(adm, 'admin.participate', { event: E1, on: false });
  await w.api(adm2, 'admin.participate', { event: E1, on: false });
  for (const [i, u] of people.entries()) {
    if (i === 7) continue; // одно письмо пустое — статус «письмо пусто» тоже в ответах
    await w.api(u, 'wishlist.save', { event: E1, text: letter(i) });
    await w.api(u, 'delivery.save', { event: E1, text: address(i) });
  }
  await w.api(adm, 'admin.family.save', { name: 'Семья', members: [people[0].id, people[1].id] });
  await w.api(adm, 'admin.exclusion.add', { event: E1, giver: people[2].id, receiver: people[3].id });
  await w.api(adm, 'admin.draw', { event: E1 });
  // Статусы, которые видит админ: открыл подопечного, подарок готов, подарок получен; переписка; обращение
  for (const u of people.slice(0, 4)) await w.api(u, 'ward.get', { event: E1 });
  for (const u of [people[0], people[4]]) await w.api(u, 'ward.gift', { event: E1, ready: true });
  for (const u of [people[5], people[6]]) await w.api(u, 'ward.received', { event: E1, received: true });
  await w.api(people[1], 'message.send', { event: E1, to: 'ward', text: 'Привет, подопечный!' });
  await w.api(people[2], 'message.send', { event: E1, to: 'santa', text: 'Привет, Санта!' });
  await w.api(people[6], 'support.send', { event: E1, text: 'Вопрос организатору: метка обращения S7Q.' });
  thread = w.query('SELECT id FROM support_threads WHERE event_id = ?', E1)[0].id;
  // Второе событие тех же людей: «не повторять прошлые пары» — пары E1 входят в его проверку жеребьёвки
  E2 = (await w.api(boss, 'admin.events.create', { title: 'Тайна 2' })).event.id;
  await w.api(boss, 'admin.avoid_previous', { event: E2, on: true });
  const code2 = inviteOf(await w.api(boss, 'admin.state', { event: E2 }));
  for (const u of [...people, outsider]) await join(w, u, code2);
  for (const u of people.slice(0, 3)) await w.api(u, 'wishlist.save', { event: E2, text: 'Второе письмо: метка E2Q.' });
});

// Ответы организаторам (админу и владельцу-неучастнику): текст тела ответа
async function views() {
  const out = {};
  for (const [who, u] of [['админ', adm], ['владелец', boss]]) {
    for (const [name, action, body] of [
      ['admin.state E1', 'admin.state', { event: E1 }],
      ['admin.state E2', 'admin.state', { event: E2 }],
      ['admin.audit E1', 'admin.audit', { event: E1 }],
      ['admin.audit', 'admin.audit', {}],
      ['admin.users', 'admin.users', {}],
      ['admin.families', 'admin.families', {}],
      ['event.get E1', 'event.get', { event: E1 }],
      ['event.get E2', 'event.get', { event: E2 }],
      ['me', 'me', {}],
      ['admin.draw.check E2', 'admin.draw.check', { event: E2 }],
    ]) {
      const r = await w.api(u, action, body, true);
      assert.equal(r.status, 200, `${who} ${name}: ${r.text}`);
      out[`${who} ${name}`] = r.text;
    }
  }
  return out;
}

test('тайна: перестановка пар в базе не меняет ни одного ответа организаторам', async () => {
  const before = await views();
  assert.deepEqual(await views(), before, 'контроль: без изменений ответы те же');
  // Проверка не пустая: в ответе админу есть все статусы, которые зависят от пар
  const users = JSON.parse(before['админ admin.state E1']).users;
  const count = (k) => users.filter((u) => u[k] === true).length;
  assert.deepEqual(
    { in_draw: count('in_draw'), ward_seen: count('ward_seen'), gift_ready: count('gift_ready'), gift_received: count('gift_received'), has_wishlist: count('has_wishlist'), has_delivery: count('has_delivery') },
    { in_draw: 8, ward_seen: 4, gift_ready: 2, gift_received: 2, has_wishlist: 7, has_delivery: 7 }
  );
  assert.equal(JSON.parse(before['админ admin.draw.check E2']).possible, true);
  const old = new Map(w.query('SELECT santa, ward FROM pairs WHERE event_id = ?', E1).map((r) => [r.santa, r.ward]));
  const next = permutePairs(w, E1);
  for (const [s, ward] of next) assert.notEqual(ward, old.get(s), 'у каждого Санты подопечный сменился');
  // Статусы людей на месте: «получил» — у подопечного, «готов» и «открыл» — у Санты
  const received = w.query('SELECT ward FROM pairs WHERE event_id = ? AND gift_received = 1 ORDER BY ward', E1).map((r) => r.ward);
  assert.deepEqual(received, [people[5].id, people[6].id]);
  const after = await views();
  for (const k of Object.keys(before)) assert.equal(after[k], before[k], k);
});

test('тайна: замена писем и адресов другими непустыми не меняет ответы организаторам', async () => {
  const before = await views();
  w.sql(`UPDATE members SET wishlist = 'Совсем другое письмо, заметно длиннее прежнего: ' || wishlist || ' Конец.' WHERE wishlist != ''`);
  w.sql(`UPDATE members SET delivery = 'Другой адрес: ' || delivery WHERE delivery != ''`);
  const after = await views();
  for (const k of Object.keys(before)) assert.equal(after[k], before[k], k);
  for (const text of Object.values(after)) {
    assert.ok(!/L\dQ|A\dQ|E2Q/.test(text), 'ни письма, ни адреса в ответах организаторам');
  }
});

test('тайна: закреплённые пары видит только владелец', async () => {
  await w.api(boss, 'admin.fixed.add', { event: E2, giver: people[0].id, receiver: people[5].id });
  const forAdmin = await w.api(adm, 'admin.state', { event: E2 });
  assert.ok(!('fixed' in forAdmin), 'у админа поля нет вовсе');
  assert.equal((await w.api(boss, 'admin.state', { event: E2 })).fixed.length, 1);
  for (const action of ['admin.fixed.add', 'admin.fixed.del']) {
    const r = await w.api(adm, action, { event: E2, giver: people[1].id, receiver: people[2].id }, true);
    assert.equal(r.status, 403, action);
  }
});

test('тайна: действия участника — только участникам события', async () => {
  const actions = [
    ['ward.get', {}], ['chat.get', { with: 'ward' }], ['chat.get', { with: 'santa' }], ['message.send', { to: 'ward', text: 'x' }],
    ['ward.gift', { ready: true }], ['ward.received', { received: true }], ['delivery.save', { text: 'x' }],
    ['wishlist.save', { text: 'x' }], ['support.get', {}], ['support.send', { text: 'x' }], ['support.close', {}],
  ];
  // Посторонний — участник только E2; админ и владелец не участвуют в E1
  for (const u of [outsider, adm, boss]) {
    for (const [action, body] of actions) {
      const r = await w.api(u, action, { event: E1, ...body }, true);
      assert.equal(r.status, 403, `${u.username} ${action}`);
      assert.equal(r.data.error, 'Ты не участвуешь в этом событии.');
    }
  }
});

test('тайна: взятое обращение — переписку видят ответственный и владелец, другой админ — нет', async () => {
  await w.api(adm, 'admin.support.take', { event: E1, thread });
  const other = await w.api(adm2, 'admin.support.get', { event: E1, thread }, true);
  assert.equal(other.status, 403);
  assert.ok(!other.text.includes('S7Q'));
  for (const u of [adm, boss]) {
    const r = await w.api(u, 'admin.support.get', { event: E1, thread }, true);
    assert.equal(r.status, 200, u.username);
    assert.ok(r.text.includes('S7Q'), 'переписка открыта');
  }
  // Список и журнал — без текстов
  for (const u of [adm2, adm, boss]) {
    for (const action of ['admin.state', 'admin.audit']) {
      assert.ok(!(await w.api(u, action, { event: E1 }, true)).text.includes('S7Q'), `${u.username} ${action}`);
    }
  }
});

test('тайна: сообщения участникам — без имени подопечного и без текста письма и адреса', async () => {
  const z = await startWorld();
  const s = await z.setup();
  await z.say(boss, '/start ' + s.adminCode);
  await z.say(boss, boss.name);
  const F = (await z.api(boss, 'admin.events.create', { title: 'Рассылки' })).event.id;
  await z.api(boss, 'admin.game', { event: F, delivery_on: true });
  const code = inviteOf(await z.api(boss, 'admin.state', { event: F }));
  for (const u of [adm, ...people]) await join(z, u, code);
  await z.api(boss, 'admin.role.grant', { id: adm.id });
  await z.api(adm, 'admin.participate', { event: F, on: false });
  for (const [i, u] of people.entries()) {
    if (i === 7) continue; // пустое письмо — для напоминания
    await z.api(u, 'wishlist.save', { event: F, text: letter(i) });
  }
  await z.api(adm, 'admin.draw', { event: F });

  // Все подопечные каждого за всё время (с учётом замен после жеребьёвки)
  const wardsOf = new Map();
  const remember = () => {
    for (const r of z.query('SELECT santa, ward FROM pairs WHERE event_id = ?', F)) {
      if (!wardsOf.has(r.santa)) wardsOf.set(r.santa, new Set());
      wardsOf.get(r.santa).add(r.ward);
    }
  };
  remember();
  const seq = (n) => `${letter(n)} Правка.`;
  for (const [i, u] of people.slice(0, 7).entries()) {
    await z.api(u, 'ward.get', { event: F });
    await z.api(u, 'message.send', { event: F, to: 'ward', text: 'Привет! Как дела?' });
    await z.api(u, 'message.send', { event: F, to: 'santa', text: 'Спасибо, Санта!' });
    await z.api(u, 'wishlist.save', { event: F, text: seq(i) }); // Санте — «письмо обновлено» (cron)
    await z.api(u, 'delivery.save', { event: F, text: address(i) });
  }
  await z.cron();
  await z.api(people[0], 'ward.gift', { event: F, ready: true });
  for (const u of people.slice(1, 4)) await z.api(u, 'ward.received', { event: F, received: true });
  await z.api(adm, 'admin.remind.santas', { event: F });
  await z.api(adm, 'admin.remind.unfilled', { event: F });
  await z.api(adm, 'admin.announce', { event: F, text: 'Встречаемся в пятницу.' });
  await z.api(people[3], 'support.send', { event: F, text: 'Где мы встречаемся?' });
  const th = z.query('SELECT id FROM support_threads WHERE event_id = ?', F)[0].id;
  await z.api(adm, 'admin.support.send', { event: F, thread: th, text: 'В пятницу в офисе.' });
  await z.api(adm, 'admin.remove', { event: F, id: people[7].id });
  remember();
  const late = { id: 299, name: 'Изольда', username: 'late' };
  await z.api(adm, 'admin.registration', { event: F, open: true });
  await join(z, late, code);
  await z.api(late, 'wishlist.save', { event: F, text: letter(9) });
  await z.api(boss, 'admin.insert', { event: F, id: late.id });
  remember();
  await z.api(adm, 'admin.reveal', { event: F });
  await z.api(adm, 'admin.event.finish', { event: F });
  await z.cron();

  const names = new Map([...people, late].map((u) => [u.id, u.name]));
  const shown = (c) => [c.params.text || '', ...(c.params.reply_markup?.inline_keyboard || []).flat().map((b) => b.text || '')].join('\n');
  const sent = z.calls.filter((c) => c.method === 'sendMessage');
  assert.ok(sent.length > 60, `сообщений в сценарии: ${sent.length}`);
  const leaks = [];
  for (const c of sent) {
    const text = shown(c);
    if (/L\dQ|A\dQ/.test(text)) leaks.push(`текст письма или адреса → ${c.params.chat_id}: ${text}`);
    if (!names.has(c.params.chat_id) || text.includes('Тайна раскрыта')) continue;
    for (const ward of wardsOf.get(c.params.chat_id) || []) {
      if (text.includes(names.get(ward))) leaks.push(`имя подопечного ${names.get(ward)} → ${names.get(c.params.chat_id)}: ${text}`);
    }
  }
  assert.deepEqual(leaks, []);
  // Проверка не пустая: раскрытие называет Санту, и его сообщения из проверки имён исключены
  assert.ok(sent.some((c) => shown(c).includes('Тайна раскрыта')));
});

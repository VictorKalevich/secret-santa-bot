// 048: обмен подопечных после жеребьёвки — только владелец (specs/048-owner-ward-swap/contracts/draw-swap.md). Владелец
// выбирает двоих, А и Б: А получает бывшего подопечного Б, Б — бывшего подопечного А. Ответы — коды и тексты правил без
// имён и версия пар; две новые пары — с чистого листа; сообщения — только двум Сантам; журнал — без имён.
import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP, PARTS, topBlock, code } from './support/app-source.mjs';
import { swapRules, SWAP_RULES } from '../src/pairs.js';

after(restoreFetch);

const boss = { id: 9001, name: 'Евгения', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const [p1, p2, p3, p4, p5] = ['Аврора', 'Богдан', 'Ванесса', 'Гордей', 'Дарина']
  .map((name, i) => ({ id: 301 + i, name, username: 'u' + (i + 1) }));
const late = { id: 399, name: 'Опоздавший', username: 'late' };
// Круг пар после жеребьёвки: p1→p2→p3→p4→p5→adm→p1
const CYCLE = [p1, p2, p3, p4, p5, adm].map((u) => u.id);
const NAMES = [boss, adm, p1, p2, p3, p4, p5].map((u) => u.name);

const NO_DRAW = 'Жеребьёвка ещё не проведена.';
const REVEALED = 'Тайна уже раскрыта — менять подопечных нельзя.';
const TWO = 'Выбери двух разных участников.';
const NOT_IN_DRAW = 'Участник не в жеребьёвке.';
const STALE = 'Пары уже изменились — открой обмен заново.';
const SELF = 'Этих двоих поменять нельзя — выбери другую пару.';
const CHANGED = 'Правила жеребьёвки для этого обмена изменились — проверь ещё раз.';
const OWNER_ONLY = 'Менять подопечных после жеребьёвки может только владелец бота.';
const CLOSED = 'Событие завершено — менять его уже нельзя (доступны просмотр, раскрытие и удаление).';
const SANTA_NOTE = 'Владелец изменил жеребьёвку';

const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

// Владелец (не участник), админ и пять участников; жеребьёвка проведена, пары — круг CYCLE
async function world() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'admin.events.create', { title: 'Обмен' })).event.id;
  const code = inviteOf(await w.api(boss, 'admin.state', { event: ev }));
  for (const u of [adm, p1, p2, p3, p4, p5]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  await w.api(boss, 'admin.draw', { event: ev });
  setPairs(w, ev, CYCLE.map((id, i) => [id, CYCLE[(i + 1) % CYCLE.length]]));
  const pairs = () => new Map(w.query('SELECT santa, ward FROM pairs WHERE event_id = ?', ev).map((r) => [r.santa, r.ward]));
  const sent = (u, sub) => w.texts(u).filter((t) => t.includes(sub)).length;
  const audit = (action) => w.query('SELECT details FROM audit WHERE event_id = ? AND action = ?', ev, action).map((r) => r.details);
  const check = (a, b) => w.api(boss, 'admin.draw.swap.check', { event: ev, a: a.id, b: b.id });
  const swap = (a, b, extra = {}) => w.api(boss, 'admin.draw.swap', { event: ev, a: a.id, b: b.id, ...extra }, true);
  return { w, ev, pairs, sent, audit, check, swap };
}

function setPairs(w, ev, list) {
  w.sql(`DELETE FROM pairs WHERE event_id = ${ev}`);
  for (const [santa, ward] of list) w.sql(`INSERT INTO pairs (event_id, santa, ward) VALUES (${ev}, ${santa}, ${ward})`);
}

describe('обмен без нарушений (US1)', () => {
  let z;
  let res;
  let checked;
  before(async () => {
    z = await world();
    // У пар p1→p2 и p4→p5 — ход подарка, маска, посылка и переписка; у p5→adm — тоже переписка (её обмен не трогает)
    z.w.sql(`UPDATE pairs SET seen_text = 'письмо', gift_ready = 1, mask = 'dragon', gift_sent = 1, sent_date = '2026-12-01',
      carrier = 'Белпочта', tracking = 'TRACK-1', gift_received = 1, gift_received_at = 5 WHERE event_id = ${z.ev} AND santa IN (${p1.id}, ${p4.id})`);
    for (const [santa, ward] of [[p1.id, p2.id], [p4.id, p5.id], [p5.id, adm.id]]) {
      z.w.sql(`INSERT INTO messages (event_id, santa, ward, sender, text, created_at) VALUES (${z.ev}, ${santa}, ${ward}, 'santa', 'привет', 1)`);
    }
    z.w.sql(`UPDATE members SET wishlist = 'Хочу книгу' WHERE event_id = ${z.ev} AND user_id IN (${p2.id}, ${p5.id})`);
    checked = await z.check(p1, p4);
    res = await z.swap(p1, p4, { version: checked.version });
  });

  it('проверка: обмен возможен, нарушений нет, есть версия пар — и ничего больше', () => {
    assert.deepEqual(Object.keys(checked).sort(), ['ok', 'possible', 'rules', 'version']);
    assert.equal(checked.possible, true);
    assert.deepEqual(checked.rules, []);
    assert.equal(typeof checked.version, 'string');
    assert.ok(checked.version.length > 0);
  });

  it('обмен: А дарит бывшему подопечному Б, Б — бывшему подопечному А; остальные пары прежние', () => {
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.data, { ok: true });
    const now = z.pairs();
    assert.equal(now.get(p1.id), p5.id);
    assert.equal(now.get(p4.id), p2.id);
    for (const [santa, ward] of [[p2.id, p3.id], [p3.id, p4.id], [p5.id, adm.id], [adm.id, p1.id]]) assert.equal(now.get(santa), ward);
  });

  it('новые пары — с чистого листа; переписка прежних пар удалена, чужая — цела; письма целы', () => {
    for (const santa of [p1.id, p4.id]) {
      const [row] = z.w.query('SELECT * FROM pairs WHERE event_id = ? AND santa = ?', z.ev, santa);
      assert.equal(row.seen_text, null);
      for (const col of ['gift_ready', 'gift_sent', 'gift_received', 'gift_received_at']) assert.equal(row[col], 0, col);
      for (const col of ['mask', 'sent_date', 'carrier', 'tracking']) assert.equal(row[col], '', col);
    }
    const msgs = z.w.query('SELECT santa, ward FROM messages WHERE event_id = ?', z.ev).map((m) => `${m.santa}→${m.ward}`);
    assert.deepEqual(msgs, [`${p5.id}→${adm.id}`]);
    const letters = z.w.query('SELECT wishlist FROM members WHERE event_id = ? AND user_id IN (?, ?)', z.ev, p2.id, p5.id);
    assert.deepEqual(letters.map((r) => r.wishlist), ['Хочу книгу', 'Хочу книгу'], 'письма целы');
  });

  it('сообщения — по одному двум Сантам, без имён; подопечным и организаторам — нет', () => {
    assert.equal(z.sent(p1, SANTA_NOTE), 1);
    assert.equal(z.sent(p4, SANTA_NOTE), 1);
    for (const u of [p2, p3, p5, adm, boss]) assert.equal(z.sent(u, SANTA_NOTE), 0, u.name);
    const text = z.w.texts(p1).find((t) => t.includes(SANTA_NOTE));
    for (const name of NAMES) assert.ok(!text.includes(name), name);
    assert.match(text, /новый подопечный/);
  });

  it('журнал — одна запись draw.swap без имён', () => {
    assert.deepEqual(z.audit('draw.swap'), ['пар изменено: 2']);
  });

  it('повтор того же запроса после успеха — отказ, пары не вернулись обратно', async () => {
    const again = await z.swap(p1, p4, { version: checked.version });
    assert.equal(again.status, 400);
    assert.equal(again.data.error, STALE);
    assert.equal(z.pairs().get(p1.id), p5.id);
    assert.equal(z.audit('draw.swap').length, 1);
  });

  it('обмен укладывается в лимит запросов бесплатного тарифа', async () => {
    const c = await z.check(p2, p5);
    assert.ok(z.w.last.db + z.w.last.tg <= 50, JSON.stringify(z.w.last));
    const r = await z.swap(p2, p5, { version: c.version, agree: c.rules.map((x) => x.rule) });
    assert.equal(r.status, 200, r.text);
    assert.ok(z.w.last.db + z.w.last.tg <= 50, `${z.w.last.db} + ${z.w.last.tg}`);
  });
});

describe('обмен вопреки правилам (US2) и невозможный обмен (US3)', () => {
  let z;
  before(async () => { z = await world(); });

  const rulesOf = async (a, b) => (await z.check(a, b)).rules.map((r) => r.rule);

  it('кольцевая: взаимная пара — нарушение ring', async () => {
    // p1→p2, p3→p4: после обмена p3→p2, а p2→p3 — взаимная пара
    assert.deepEqual(await rulesOf(p1, p3), ['ring']);
  });

  it('невозможный обмен: Санта и его подопечный — possible: false, только self', async () => {
    const c = await z.check(p1, p2);
    assert.equal(c.possible, false);
    assert.deepEqual(c.rules, [{ rule: 'self', text: SWAP_RULES.self }]);
    const r = await z.swap(p1, p2, { version: c.version, agree: ['self', 'exclusion', 'family', 'ring', 'fixed', 'history'] });
    assert.equal(r.status, 400);
    assert.equal(r.data.error, SELF);
    assert.equal(z.pairs().get(p1.id), p2.id);
  });

  it('исключение, семья, закреплённая пара и прошлое событие — каждое правило отдельно и вместе, в своём порядке', async () => {
    // p1 и p4: новые связки p1→p5 и p4→p2
    z.w.sql(`INSERT INTO exclusions (event_id, giver, receiver) VALUES (${z.ev}, ${p1.id}, ${p5.id})`);
    assert.deepEqual(await rulesOf(p1, p4), ['exclusion']);
    z.w.sql(`DELETE FROM exclusions WHERE event_id = ${z.ev}`);

    await z.w.api(boss, 'admin.family.save', { name: 'Семья', members: [p4.id, p2.id] });
    assert.deepEqual(await rulesOf(p1, p4), ['family']);
    z.w.sql(`UPDATE events SET families_on = 0 WHERE id = ${z.ev}`);
    assert.deepEqual(await rulesOf(p1, p4), [], 'семьи не учитываются — не нарушение');
    z.w.sql(`UPDATE events SET families_on = 1 WHERE id = ${z.ev}`);

    z.w.sql(`INSERT INTO fixed_pairs (event_id, giver, receiver) VALUES (${z.ev}, ${p1.id}, ${p2.id})`);
    assert.deepEqual(await rulesOf(p1, p4), ['family', 'fixed']);
    z.w.sql(`DELETE FROM fixed_pairs WHERE event_id = ${z.ev}`);
    z.w.sql(`INSERT INTO fixed_pairs (event_id, giver, receiver) VALUES (${z.ev}, ${p1.id}, ${p3.id})`);
    assert.deepEqual(await rulesOf(p1, p4), ['family'], 'закреплённая пара, которая и так не действовала, — не нарушение');
    z.w.sql(`DELETE FROM fixed_pairs WHERE event_id = ${z.ev}`);

    const prev = (await z.w.api(boss, 'admin.events.create', { title: 'Прошлое' })).event.id;
    z.w.sql(`UPDATE events SET created_at = 1 WHERE id = ${prev}`);
    z.w.sql(`INSERT INTO pairs (event_id, santa, ward) VALUES (${prev}, ${p1.id}, ${p5.id})`);
    assert.deepEqual(await rulesOf(p1, p4), ['family', 'history']);
    z.w.sql(`UPDATE events SET avoid_previous = 0 WHERE id = ${z.ev}`);
    assert.deepEqual(await rulesOf(p1, p4), ['family'], '«не повторять» выключено — не нарушение');
    z.w.sql(`UPDATE events SET avoid_previous = 1 WHERE id = ${z.ev}`);

    z.w.sql(`INSERT INTO exclusions (event_id, giver, receiver) VALUES (${z.ev}, ${p4.id}, ${p2.id})`);
    z.w.sql(`INSERT INTO fixed_pairs (event_id, giver, receiver) VALUES (${z.ev}, ${p4.id}, ${p5.id})`);
    const c = await z.check(p1, p4);
    assert.deepEqual(c.rules.map((r) => r.rule), ['exclusion', 'family', 'fixed', 'history']);
    assert.deepEqual(c.rules.map((r) => r.text), ['exclusion', 'family', 'fixed', 'history'].map((r) => SWAP_RULES[r]));
    for (const name of NAMES) assert.ok(!JSON.stringify(c).includes(name), 'без имён: ' + name);
  });

  it('без согласия на каждое нарушение — отказ, пары прежние; с согласием — обмен', async () => {
    const c = await z.check(p1, p4);
    const before = [...z.pairs()];
    for (const agree of [undefined, [], ['exclusion', 'family', 'fixed']]) {
      const r = await z.swap(p1, p4, { version: c.version, agree });
      assert.equal(r.status, 400);
      assert.equal(r.data.error, CHANGED);
    }
    assert.deepEqual([...z.pairs()], before);
    const ok = await z.swap(p1, p4, { version: c.version, agree: c.rules.map((r) => r.rule) });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(z.pairs().get(p1.id), p5.id);
    assert.deepEqual(z.audit('draw.swap'), ['пар изменено: 2']);
  });

  it('правило появилось между проверкой и обменом — отказ «изменились»', async () => {
    const c = await z.check(p2, p5);
    assert.deepEqual(c.rules, []);
    z.w.sql(`INSERT INTO exclusions (event_id, giver, receiver) VALUES (${z.ev}, ${p2.id}, ${z.pairs().get(p5.id)})`);
    const r = await z.swap(p2, p5, { version: c.version });
    assert.equal(r.status, 400);
    assert.equal(r.data.error, CHANGED);
  });

  it('кольцевая выключена — взаимная пара не нарушение', async () => {
    const zz = await world();
    zz.w.sql(`UPDATE events SET ring = 0 WHERE id = ${zz.ev}`);
    assert.deepEqual((await zz.check(p1, p3)).rules, []);
  });
});

describe('отказы и права', () => {
  let z;
  before(async () => { z = await world(); });
  const call = (user, action, body) => z.w.api(user, action, { event: z.ev, ...body }, true);

  it('админу — 403 владельца, участнику — «Только для администратора.»', async () => {
    for (const action of ['admin.draw.swap.check', 'admin.draw.swap']) {
      const a = await call(adm, action, { a: p1.id, b: p4.id });
      assert.deepEqual([a.status, a.data.error], [403, OWNER_ONLY], action);
      const m = await call(p1, action, { a: p1.id, b: p4.id });
      assert.deepEqual([m.status, m.data.error], [403, 'Только для администратора.'], action);
    }
  });

  it('один и тот же человек, нет второго, не участник жеребьёвки', async () => {
    for (const body of [{ a: p1.id, b: p1.id }, { a: p1.id }, { a: 'x', b: p2.id }, {}]) {
      const r = await call(boss, 'admin.draw.swap.check', body);
      assert.deepEqual([r.status, r.data.error], [400, TWO], JSON.stringify(body));
    }
    await z.w.api(boss, 'admin.registration', { event: z.ev, open: true });
    await z.w.say(late, '/start ' + inviteOf(await z.w.api(boss, 'admin.state', { event: z.ev })));
    await z.w.say(late, late.name);
    for (const action of ['admin.draw.swap.check', 'admin.draw.swap']) {
      const r = await call(boss, action, { a: p1.id, b: late.id });
      assert.deepEqual([r.status, r.data.error], [400, NOT_IN_DRAW], action);
    }
  });

  it('версия устарела после вписывания — отказ', async () => {
    const c = await z.check(p1, p4);
    await z.w.api(boss, 'admin.insert', { event: z.ev, id: late.id });
    const r = await z.swap(p1, p4, { version: c.version });
    assert.deepEqual([r.status, r.data.error], [400, STALE]);
  });

  it('жеребьёвка не проведена, тайна раскрыта, событие завершено', async () => {
    const fresh = (await z.w.api(boss, 'admin.events.create', { title: 'Без жеребьёвки' })).event.id;
    for (const action of ['admin.draw.swap.check', 'admin.draw.swap']) {
      const r = await z.w.api(boss, action, { event: fresh, a: p1.id, b: p4.id }, true);
      assert.deepEqual([r.status, r.data.error], [400, NO_DRAW], action);
    }
    await z.w.api(boss, 'admin.reveal', { event: z.ev });
    for (const action of ['admin.draw.swap.check', 'admin.draw.swap']) {
      const r = await call(boss, action, { a: p1.id, b: p4.id });
      assert.deepEqual([r.status, r.data.error], [400, REVEALED], action);
    }
    await z.w.api(boss, 'admin.event.finish', { event: z.ev });
    for (const action of ['admin.draw.swap.check', 'admin.draw.swap']) {
      const r = await call(boss, action, { a: p1.id, b: p4.id });
      assert.deepEqual([r.status, r.data.error], [400, CLOSED], action);
    }
  });
});

test('swapRules: чистая функция на малых примерах', () => {
  const m = (list) => new Map(list);
  const cycle = m([[1, 2], [2, 3], [3, 4], [4, 5], [5, 1]]);
  assert.deepEqual(swapRules(cycle, 1, 2), ['self']);
  assert.deepEqual(swapRules(cycle, 2, 1), ['self']);
  assert.deepEqual(swapRules(m([[1, 2], [2, 1], [3, 4], [4, 3]]), 1, 2), ['self'], 'взаимная пара — тоже «сам себе»');
  assert.deepEqual(swapRules(m([[1, 2], [2, 1]]), 1, 2), ['self'], 'жеребьёвка на двоих — менять некого');
  assert.deepEqual(swapRules(cycle, 1, 3), [], 'без кольцевой взаимная пара допустима');
  assert.deepEqual(swapRules(cycle, 1, 3, { ring: true }), ['ring'], '3→2 и 2→3');
  assert.deepEqual(swapRules(cycle, 1, 4, { ring: true }), ['ring'], '1→5 и 5→1');
  assert.deepEqual(swapRules(m([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]]), 1, 4, { ring: true }), []);
  assert.deepEqual(swapRules(cycle, 1, 3, { exclusions: [{ giver: 3, receiver: 2 }] }), ['exclusion']);
  assert.deepEqual(swapRules(cycle, 1, 3, { exclusions: [{ giver: 2, receiver: 3 }] }), [], 'запрет в обратную сторону не мешает');
  assert.deepEqual(swapRules(cycle, 1, 3, { families: [{ giver: 1, receiver: 4 }] }), ['family']);
  assert.deepEqual(swapRules(cycle, 1, 3, { fixed: [{ giver: 4, receiver: 5 }] }), [], 'чужая закреплённая пара');
  assert.deepEqual(swapRules(cycle, 1, 3, { fixed: [{ giver: 3, receiver: 4 }] }), ['fixed']);
  assert.deepEqual(swapRules(cycle, 1, 3, { history: [{ giver: 1, receiver: 4 }] }), ['history']);
  assert.deepEqual(swapRules(cycle, 1, 3, {
    ring: true, exclusions: [{ giver: 1, receiver: 4 }], families: [{ giver: 3, receiver: 2 }],
    fixed: [{ giver: 1, receiver: 2 }], history: [{ giver: 3, receiver: 2 }],
  }), ['exclusion', 'family', 'ring', 'fixed', 'history']);
});

test('приложение: секция только владельцу после жеребьёвки, шторка зовёт оба действия и «Подробнее»', () => {
  const lines = (name) => PARTS.find((p) => p.name === name).text.split('\n');
  const admin = lines('05-admin.js.txt');
  const section = topBlock(admin, 'adminSwap');
  assert.ok(section, 'нет adminSwap в 05-admin');
  const body = admin.slice(section[0], section[1] + 1).map(code).join('\n');
  assert.match(body, /me\.is_owner/);
  assert.match(body, /s\.draw_done/);
  assert.match(body, /s\.revealed/);
  assert.match(body, /\bdone\b/);
  assert.match(admin.join('\n'), /adminSwap, adminVault/, 'секция — перед служебным просмотром');
  const sheet = lines('06-vault-audit.js.txt');
  const open = topBlock(sheet, 'openSwapSheet');
  assert.ok(open, 'нет openSwapSheet в 06-vault-audit');
  const text = sheet.slice(open[0], open[1] + 1).map(code).join('\n');
  for (const needle of ["'admin.draw.swap.check'", "'admin.draw.swap'", 'ds-details', 'ds-details__summary', 'confirmBox(', 'busy(']) {
    assert.ok(text.includes(needle), 'в шторке нет ' + needle);
  }
  assert.ok(!/\.ward\b|\.santa\b/.test(text), 'шторка не знает пар');
  assert.match(APP, /'draw\.swap': '🔀 Подопечные поменялись'/);
});

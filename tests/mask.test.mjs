// 040: маска Санты в переписке (specs/040-santa-mask/contracts/mask.md). Маска — у пары в событии: её выбирает Санта
// (пока событие идёт и тайна не раскрыта), видят только он и его подопечный — в переписке, в «Письме», в сообщениях бота
// и при раскрытии; организаторам, журналу и «Инфо» — нет. Набор — один список на сервере, со значками у имени не
// пересекается ни эмодзи, ни смыслом. Новые пары (жеребьёвка, вписывание, удаление) — без маски, перенос её сохраняет.
import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { MASKS, validMask, maskLabel } from '../src/looks.js';
import { MAX_CHARS } from '../src/chat.js';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vera = { id: 103, name: 'Вера', username: 'vera' };
const gena = { id: 104, name: 'Гена', username: 'gena' };
const dasha = { id: 105, name: 'Даша', username: 'dasha' };
const fresh = { id: 106, name: 'Вера новая', username: 'vera2' };
const PEOPLE = [boss, adm, anya, borya, vera, gena, dasha, fresh];

const NO_MASK = 'Такой маски нет — выбери из списка.';
const NO_WARD = 'У тебя пока нет подопечного.';
const REVEALED = 'Тайна уже раскрыта — маску больше не сменить.';
const CLOSED = 'Событие завершено: маску больше не сменить.';

// Владелец (организатор, не участник), админ и участники в событии «Маски»; жеребьёвка — по запросу
async function world(people = [adm, anya, borya, vera]) {
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
  const create = async (title, list) => {
    const id = (await w.api(boss, 'admin.events.create', { title })).event.id;
    const code = await invite(id);
    for (const u of list) await join(u, code);
    return id;
  };
  const E = await create('Маски', people);
  if (people.includes(adm)) await w.api(boss, 'admin.role.grant', { id: adm.id });
  const person = (id) => PEOPLE.find((x) => x.id === id);
  const santaOf = (u, ev = E) => person(w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', ev, u.id)[0].santa);
  const wardOf = (u, ev = E) => person(w.query('SELECT ward FROM pairs WHERE event_id = ? AND santa = ?', ev, u.id)[0].ward);
  const pairs = (ev = E) => w.query('SELECT santa, ward, mask FROM pairs WHERE event_id = ? ORDER BY santa', ev);
  const count = (table) => w.query(`SELECT COUNT(*) AS n FROM ${table}`)[0].n;
  return { w, E, create, invite, join, santaOf, wardOf, pairs, count };
}

// ---------- набор ----------
const VS = /[︎️]/g;
const bare = (e) => e.replace(VS, '');
test('набор: 20 масок, id и названия разные, эмодзи — одна графема и без повторов', () => {
  const seg = new Intl.Segmenter('ru', { granularity: 'grapheme' });
  assert.equal(MASKS.length, 20);
  assert.equal(new Set(MASKS.map((m) => m.id)).size, 20);
  assert.equal(new Set(MASKS.map((m) => m.title)).size, 20);
  assert.equal(new Set(MASKS.map((m) => bare(m.emoji))).size, 20);
  for (const m of MASKS) {
    assert.match(m.id, /^[a-z]+$/, m.id);
    assert.equal([...seg.segment(m.emoji)].length, 1, m.emoji);
    assert.ok(m.title.trim() === m.title && m.title.length > 0, m.title);
  }
});

test('validMask и maskLabel: из набора или пусто; маска не из набора — «без маски»', () => {
  assert.equal(validMask('dragon'), 'dragon');
  assert.equal(validMask(''), '');
  for (const x of ['nope', '🐉', 'Дракон', null, undefined, 5, 'DRAGON']) assert.equal(validMask(x), null, String(x));
  assert.equal(maskLabel('dragon'), '🐉 Дракон');
  assert.equal(maskLabel('agent'), '🕵️ Тайный агент');
  assert.equal(maskLabel(''), '');
  assert.equal(maskLabel('removed-from-set'), '');
});

// ---------- US1: Санта выбирает маску ----------
describe('Санта выбирает маску (040, US1)', () => {
  let z, santa;
  before(async () => {
    z = await world();
  });

  it('до жеребьёвки — «У тебя пока нет подопечного.»', async () => {
    const r = await z.w.api(anya, 'mask.set', { event: z.E, mask: 'dragon' }, true);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, NO_WARD);
  });

  it('me отдаёт набор масок', async () => {
    assert.deepEqual((await z.w.api(anya, 'me')).looks.masks, MASKS);
  });

  it('маска сохраняется у пары: ward.get и chat.get Санты; «без маски» снимает; без сообщений и журнала', async () => {
    const { w, E, count } = z;
    await w.api(boss, 'admin.draw', { event: E });
    santa = z.santaOf(anya);
    assert.equal((await w.api(santa, 'ward.get', { event: E })).mask, '');
    const [outbox, audit] = [count('outbox'), count('audit')];
    assert.deepEqual(await w.api(santa, 'mask.set', { event: E, mask: 'dragon' }), { ok: true, mask: 'dragon' });
    assert.deepEqual(await w.api(santa, 'mask.set', { event: E, mask: 'dragon' }), { ok: true, mask: 'dragon' }, 'повтор');
    assert.equal((await w.api(santa, 'ward.get', { event: E })).mask, 'dragon');
    assert.equal((await w.api(santa, 'chat.get', { event: E, with: 'ward' })).mask, 'dragon');
    assert.deepEqual(await w.api(santa, 'mask.set', { event: E, mask: '' }), { ok: true, mask: '' });
    assert.equal((await w.api(santa, 'ward.get', { event: E })).mask, '');
    await w.api(santa, 'mask.set', { event: E, mask: 'dragon' });
    assert.equal(count('outbox'), outbox, 'очередь бота');
    assert.equal(count('audit'), audit, 'журнал');
  });

  it('маска не из набора — отказ, маска прежняя', async () => {
    const { w, E } = z;
    for (const mask of ['nope', '🐉', 'Дракон', null, 5]) {
      const r = await w.api(santa, 'mask.set', { event: E, mask }, true);
      assert.equal(r.status, 400, String(mask));
      assert.equal(r.data.error, NO_MASK);
    }
    assert.equal(z.pairs().find((p) => p.santa === santa.id).mask, 'dragon');
  });

  it('маска своя у пары в каждом событии', async () => {
    const { w, create } = z;
    const G = await create('Другое', [adm, anya, borya, vera]);
    await w.api(boss, 'admin.draw', { event: G });
    const s = z.santaOf(anya, G);
    await w.api(s, 'mask.set', { event: G, mask: 'robot' });
    assert.equal((await w.api(santa, 'ward.get', { event: z.E })).mask, 'dragon');
    if (santa.id !== s.id) assert.equal((await w.api(santa, 'ward.get', { event: G })).mask, '');
    assert.deepEqual(z.pairs(G).map((p) => p.mask).sort(), ['', '', '', 'robot']);
  });

  it('одновременные выборы — одна из масок, без сообщений', async () => {
    const { w, E, count } = z;
    const outbox = count('outbox');
    for (const order of [[0, 1], [1, 0]]) {
      await w.together([
        () => w.api(santa, 'mask.set', { event: E, mask: 'ghost' }),
        () => w.api(santa, 'mask.set', { event: E, mask: 'robot' }),
      ], { writeOrder: order });
      assert.equal(z.pairs().find((p) => p.santa === santa.id).mask, order[1] === 1 ? 'robot' : 'ghost');
    }
    assert.equal(count('outbox'), outbox);
    await w.api(santa, 'mask.set', { event: E, mask: 'dragon' });
  });

  it('вступивший после жеребьёвки без пары и посторонний — отказ', async () => {
    const { w, E, invite, join } = z;
    await w.api(boss, 'admin.registration', { event: E, open: true }); // жеребьёвка закрывает регистрацию
    await join(gena, await invite(E));
    const r = await w.api(gena, 'mask.set', { event: E, mask: 'dragon' }, true);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, NO_WARD);
    const o = await w.api(dasha, 'mask.set', { event: E, mask: 'dragon' }, true);
    assert.notEqual(o.status, 200);
  });

  it('после раскрытия — «Тайна уже раскрыта…», после завершения — «Событие завершено…»; маска прежняя', async () => {
    const { w, E } = z;
    await w.api(boss, 'admin.reveal', { event: E });
    const r = await w.api(santa, 'mask.set', { event: E, mask: 'ghost' }, true);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, REVEALED);
    assert.equal((await w.api(santa, 'ward.get', { event: E })).mask, 'dragon');
    await w.api(boss, 'admin.event.finish', { event: E });
    const f = await w.api(santa, 'mask.set', { event: E, mask: 'ghost' }, true);
    assert.equal(f.status, 400);
    assert.equal(f.data.error, CLOSED);
    assert.equal((await w.api(santa, 'ward.get', { event: E })).mask, 'dragon', 'в завершённом маска видна');
  });
});

// ---------- US2: подопечный видит Санту в маске ----------
describe('подопечный видит Санту в маске (040, US2)', () => {
  let z, santa, plain;
  const prompt = (u) => z.w.lastText(u).split('\n')[0]; // вторая строка просьбы — общая подсказка о длине и сроке
  before(async () => {
    z = await world();
    await z.w.api(boss, 'admin.draw', { event: z.E });
    santa = z.santaOf(anya);
    plain = z.wardOf(anya); // его Санта — Аня, у неё маски нет
    await z.w.api(santa, 'mask.set', { event: z.E, mask: 'dragon' });
  });

  it('event.get и chat.get подопечного — маска его Санты; у других — без маски', async () => {
    const { w, E } = z;
    assert.equal((await w.api(anya, 'event.get', { event: E })).member.santa_mask, 'dragon');
    assert.equal((await w.api(anya, 'chat.get', { event: E, with: 'santa' })).mask, 'dragon');
    assert.equal((await w.api(plain, 'event.get', { event: E })).member.santa_mask, '');
    assert.equal((await w.api(plain, 'chat.get', { event: E, with: 'santa' })).mask, '');
  });

  it('сообщение Санты из приложения — у подопечного с маской; ответ подопечного у Санты — без маски', async () => {
    const { w, E } = z;
    await w.api(santa, 'message.send', { event: E, to: 'ward', text: 'Привет!' });
    assert.equal(w.lastText(anya), '💬 <b>Твой Тайный Санта «🐉 Дракон» («Маски») пишет:</b>\n\nПривет!');
    await w.api(anya, 'message.send', { event: E, to: 'santa', text: 'Спасибо!' });
    assert.equal(w.lastText(santa), '💬 <b>Тебе пишет твой подопечный («Маски»):</b>\n\nСпасибо!');
  });

  it('бот: просьба написать — подопечному и Санте с маской; ответ Санты в боте — у подопечного с маской', async () => {
    const { w, E } = z;
    await w.press(anya, `msg:santa:${E}`);
    assert.equal(prompt(anya), '✍️ Напиши сообщение своему Санте «🐉 Дракон» («Маски») — я передам его. Санта знает, кто ты, а ты его — нет.');
    await w.say(anya, 'Ответ из бота');
    assert.equal(w.lastText(santa), '💬 <b>Тебе пишет твой подопечный («Маски»):</b>\n\nОтвет из бота');
    await w.press(santa, `msg:ward:${E}`);
    assert.equal(prompt(santa), '✍️ Напиши сообщение подопечному («Маски») — я передам его <b>анонимно</b>, от имени «Тайного Санты · 🐉 Дракон».');
    await w.say(santa, 'Из бота');
    assert.equal(w.lastText(anya), '💬 <b>Твой Тайный Санта «🐉 Дракон» («Маски») пишет:</b>\n\nИз бота');
  });

  it('без маски — тексты прежние', async () => {
    const { w, E } = z;
    const ward = plain; // Санта у plain — Аня, у неё маски нет
    assert.equal(z.santaOf(ward), anya);
    await w.api(anya, 'message.send', { event: E, to: 'ward', text: 'Хо-хо' });
    assert.equal(w.lastText(ward), '💬 <b>Твой Тайный Санта («Маски») пишет:</b>\n\nХо-хо');
    await w.press(ward, `msg:santa:${E}`);
    assert.equal(prompt(ward), '✍️ Напиши сообщение своему Санте («Маски») — я передам его. Санта знает, кто ты, а ты его — нет.');
    await w.press(anya, `msg:ward:${E}`);
    assert.equal(prompt(anya), '✍️ Напиши сообщение подопечному («Маски») — я передам его <b>анонимно</b>, от имени «Тайного Санты».');
  });

  it('самая длинная маска с длинным названием события и 4000 символов — одно сообщение Telegram', async () => {
    const { w, create } = z;
    const longest = MASKS.reduce((a, b) => (maskLabel(b.id).length > maskLabel(a.id).length ? b : a));
    const L = await create('Новогодний обмен подарками большой и очень дружной семьи', [anya, borya, vera]);
    await w.api(boss, 'admin.draw', { event: L });
    const s = z.santaOf(anya, L);
    await w.api(s, 'mask.set', { event: L, mask: longest.id });
    await w.api(s, 'message.send', { event: L, to: 'ward', text: 'я'.repeat(MAX_CHARS) });
    const sent = w.lastText(anya);
    assert.ok(sent.includes(maskLabel(longest.id)), sent.slice(0, 80));
    const visible = sent.replace(/<\/?b>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    assert.ok(visible.length <= 4096, `${visible.length} > 4096`);
  });
});

// ---------- US3: раскрытие ----------
test('раскрытие: подопечному Санты с маской — маска и имя, без маски — прежний текст (040, US3)', async () => {
  const z = await world();
  const { w, E } = z;
  await w.api(boss, 'admin.draw', { event: E });
  const santa = z.santaOf(anya);
  await w.api(santa, 'mask.set', { event: E, mask: 'agent' });
  const plainWard = z.pairs().map((p) => PEOPLE.find((u) => u.id === p.ward)).find((u) => u !== anya);
  await w.api(boss, 'admin.reveal', { event: E });
  assert.ok(w.texts(anya).includes(`🎅 <b>Тайна раскрыта!</b>\n\nВ событии «Маски» твой Тайный Санта «🕵️ Тайный агент» — <b>${santa.name}</b>. С праздником! 🎄`),
    w.lastText(anya));
  assert.ok(w.texts(plainWard).includes(`🎅 <b>Тайна раскрыта!</b>\n\nВ событии «Маски» твой Тайный Санта — <b>${z.santaOf(plainWard).name}</b>. С праздником! 🎄`),
    w.lastText(plainWard));
});

// ---------- US4: тайна ----------
// Любое упоминание маски в ответе: поле mask/santa_mask, id в кавычках, эмодзи или название из набора
const MASK_NEEDLES = ['"mask"', '"santa_mask"', ...MASKS.flatMap((m) => [`"${m.id}"`, bare(m.emoji), m.title])];
const masked = (data) => MASK_NEEDLES.filter((n) => JSON.stringify(data).includes(n));

describe('маска не уходит организаторам (040, US4)', () => {
  let z;
  before(async () => {
    z = await world([adm, anya, borya, vera, gena]);
    const { w, E } = z;
    for (const u of [adm, anya, borya, vera, gena]) await w.api(u, 'wishlist.save', { event: E, text: 'Письмо ' + u.name });
    await w.api(boss, 'admin.draw', { event: E });
    const ids = ['dragon', 'agent', 'ghost', 'robot', 'whale'];
    for (const [i, p] of z.pairs().entries()) await w.api(PEOPLE.find((u) => u.id === p.santa), 'mask.set', { event: E, mask: ids[i] });
    assert.ok(z.pairs().every((p) => p.mask), 'маски у всех Сант');
  });

  it('панель, журнал, письма, пользователи, служебный просмотр — без масок', async () => {
    const { w, E } = z;
    for (const org of [boss, adm]) {
      assert.deepEqual(masked(await w.api(org, 'admin.state', { event: E })), [], 'admin.state');
      assert.deepEqual(masked(await w.api(org, 'admin.audit', { event: E })), [], 'admin.audit');
      assert.deepEqual(masked(await w.api(org, 'admin.audit', {})), [], 'общий журнал');
      assert.deepEqual(masked(await w.api(org, 'admin.users')), [], 'admin.users');
      for (const u of [adm, anya, borya, vera, gena]) {
        assert.deepEqual(masked(await w.api(org, 'admin.wishlist', { event: E, id: u.id })), [], 'admin.wishlist');
      }
    }
    for (const u of [adm, anya, borya, vera, gena]) {
      assert.deepEqual(masked(await w.api(boss, 'admin.vault.person', { event: E, id: u.id, confirm: 'ОТКРЫТЬ' })), [], 'vault.person');
    }
    assert.deepEqual(masked(await w.api(boss, 'admin.vault.pairs', { event: E, confirm: 'ОТКРЫТЬ' })), [], 'vault.pairs');
    assert.deepEqual(masked(w.query('SELECT * FROM audit')), [], 'журнал в базе');
  });

  it('событие у организатора-неучастника и «Инфо» участника — без масок', async () => {
    const { w, E } = z;
    assert.deepEqual(masked(await w.api(boss, 'event.get', { event: E })), [], 'владелец не участвует');
    for (const u of [adm, anya, borya]) {
      const { member, ...rest } = await w.api(u, 'event.get', { event: E });
      assert.deepEqual(masked(rest), [], 'всё, кроме своего участия');
      assert.deepEqual(Object.keys(member).filter((k) => /mask/.test(k)), ['santa_mask'], 'в участии — только маска своего Санты');
    }
  });

  it('от противного: проверка ловит маску в ответе', () => {
    assert.ok(masked({ users: [{ name: 'Аня', mask: 'dragon' }] }).length > 0);
    assert.ok(masked({ text: 'Твой Санта — 🕵️ Тайный агент' }).length > 0);
    assert.deepEqual(masked({ users: [{ name: 'Аня', emoji: '🦊' }] }), []);
  });
});

// ---------- US5: изменения пар ----------
describe('маска и изменения пар (040, US5)', () => {
  let z;
  const MASK_IDS = MASKS.map((m) => m.id);
  const maskAll = async () => {
    for (const [i, p] of z.pairs().entries()) await z.w.api(PEOPLE.find((u) => u.id === p.santa), 'mask.set', { event: z.E, mask: MASK_IDS[i] });
  };
  // Пары после изменения: у прежних (тот же Санта и подопечный) — прежняя маска, у новых — без маски
  const keptOrBlank = (before, after) => {
    const old = new Map(before.map((p) => [`${p.santa}>${p.ward}`, p.mask]));
    let kept = 0, fresh = 0;
    for (const p of after) {
      const key = `${p.santa}>${p.ward}`;
      if (old.has(key)) { assert.equal(p.mask, old.get(key), key); kept++; } else { assert.equal(p.mask, '', key); fresh++; }
    }
    return { kept, fresh };
  };
  before(async () => {
    z = await world([anya, borya, vera, gena]);
    await z.w.api(boss, 'admin.draw', { event: z.E });
    await maskAll();
  });

  it('вписывание после жеребьёвки: у новых пар маски нет, у неизменных — прежние', async () => {
    const { w, E, invite, join } = z;
    await w.api(boss, 'admin.registration', { event: E, open: true });
    await join(dasha, await invite(E));
    const before = z.pairs();
    await w.api(boss, 'admin.insert', { event: E, id: dasha.id });
    const r = keptOrBlank(before, z.pairs());
    assert.ok(r.kept > 0 && r.fresh === 2, JSON.stringify(r));
  });

  it('удаление после жеребьёвки: у новой пары маски нет, у неизменных — прежние', async () => {
    const { w, E } = z;
    await maskAll();
    const before = z.pairs();
    await w.api(boss, 'admin.remove', { event: E, id: dasha.id });
    const r = keptOrBlank(before, z.pairs());
    assert.ok(r.kept > 0 && r.fresh === 1, JSON.stringify(r));
  });

  it('перенос участия: маска пары остаётся — и у Санты, и у подопечного', async () => {
    const { w, E, create } = z;
    await maskAll(); // после удаления у новой пары маски нет
    await create('Регистрация нового аккаунта', [fresh]);
    const asSanta = z.pairs().find((p) => p.santa === vera.id);
    const asWard = z.pairs().find((p) => p.ward === vera.id);
    await w.api(boss, 'admin.transfer', { from: vera.id, to: fresh.id });
    const after = z.pairs();
    assert.equal(after.find((p) => p.santa === fresh.id).mask, asSanta.mask);
    assert.equal(after.find((p) => p.ward === fresh.id).mask, asWard.mask);
    assert.ok(asSanta.mask && asWard.mask);
  });

  it('принудительная отмена и новая жеребьёвка, полный сброс — масок нет', async () => {
    const { w, E } = z;
    await w.api(boss, 'admin.draw.cancel.force', { event: E, confirm: 'ОТМЕНА' });
    assert.equal(z.pairs().length, 0);
    await w.api(boss, 'admin.draw', { event: E });
    assert.ok(z.pairs().length > 0 && z.pairs().every((p) => p.mask === ''));
    await maskAll();
    await w.api(boss, 'admin.reset.full', { event: E, confirm: 'СБРОС' });
    assert.equal(z.pairs().length, 0);
  });
});

// ---------- приложение (по склейке) ----------
test('приложение: маска — текстом только через maskLabel (maskedSanta), выбор — только шторкой с busy; панель и журнал без масок', async () => {
  const { PARTS, topBlock, code } = await import('./support/app-source.mjs');
  const part = (prefix) => PARTS.find((p) => p.name.startsWith(prefix)).text.split('\n');
  const all = PARTS.flatMap((p) => p.text.split('\n').map((l) => ({ part: p.name, line: code(l) })));
  const masksUse = all.filter((x) => /looks\.masks/.test(x.line));
  assert.ok(masksUse.length > 0 && masksUse.every((x) => /maskLabel|openMaskSheet|masks\.(find|map)/.test(x.line)), JSON.stringify(masksUse));
  const setCalls = all.filter((x) => /'mask\.set'/.test(x.line));
  assert.equal(setCalls.length, 1, 'mask.set — одно место');
  const ev = part('05-');
  const sheet = topBlock(ev, 'openMaskSheet');
  assert.ok(sheet, 'нет openMaskSheet');
  const body = ev.slice(sheet[0], sheet[1] + 1).join('\n');
  assert.match(body, /'mask\.set'/);
  assert.match(body, /busy\(\[\.\.\.grid\.children\]/);
  assert.match(body, /ds-choices--labeled/);
  const chat = part('08-');
  const oc = topBlock(chat, 'openChat');
  const ocBody = chat.slice(oc[0], oc[1] + 1).join('\n');
  assert.match(ocBody, /maskedSanta\(/, 'openChat — маска через maskedSanta (maskLabel)');
  assert.match(ocBody, /d\.mask/, 'openChat — маска из ответа chat.get');
  for (const p of ['06-', '07-']) {
    const bad = part(p).filter((l) => /\bmask/i.test(code(l)));
    assert.deepEqual(bad, [], `${p}: без масок`);
  }
});

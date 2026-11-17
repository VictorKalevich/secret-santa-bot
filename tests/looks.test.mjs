// 038: значок у имени и открытка письма (specs/038-emoji-postcards/contracts/looks.md). Значок — свойство человека: виден в
// списках событий, у Санты и в обращениях (039 — tests/names.test.mjs), но не в переписке Санты и подопечного, сообщениях
// бота и журнале; открытка — у письма в событии: видна самому
// участнику, его Санте и организатору, открывшему письмо; смена открытки — не изменение письма. Набор — один список на
// сервере, у каждой открытки — тема в дизайн-системе с читаемым текстом.
import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { EMOJIS, POSTCARDS } from '../src/looks.js';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vera = { id: 103, name: 'Вера', username: 'vera' };
const gena = { id: 104, name: 'Гена', username: 'gena' };
const fresh = { id: 105, name: 'Аня новая', username: 'anya2' };
const stranger = { id: 106, name: 'Незнакомец', username: 'stranger' };

const NO_EMOJI = 'Такого значка нет — выбери из списка.';
const NO_CARD = 'Такой открытки нет — выбери из списка.';
const LETTER_CLOSED = 'Событие завершено: письмо теперь только для чтения.';

// Владелец, админ и трое участников в событии «Открытки» (владелец и админ тоже участвуют), жеребьёвка — по запросу
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
  const E = await create('Открытки', [adm, anya, borya, vera]);
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  await w.api(boss, 'admin.participate', { event: E, on: true });
  const santaOf = (u, ev = E) => {
    const id = w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', ev, u.id)[0].santa;
    return [boss, adm, anya, borya, vera, gena, fresh].find((x) => x.id === id);
  };
  return { w, E, create, invite, join, santaOf };
}

const has = (data, needle) => JSON.stringify(data).includes(needle);

describe('значок у имени (038, US1)', () => {
  let z;
  before(async () => { z = await world(); });

  it('me отдаёт свой значок и набор: 40 значков, 15 открыток', async () => {
    const d = await z.w.api(anya, 'me');
    assert.equal(d.me.emoji, '');
    assert.deepEqual(d.looks.emojis, EMOJIS);
    assert.deepEqual(d.looks.postcards, POSTCARDS);
    assert.equal(EMOJIS.length, 40);
    assert.equal(POSTCARDS.length, 15);
  });

  it('значок из набора сохраняется, «без значка» убирает, не из набора — отказ и прежний значок', async () => {
    const { w } = z;
    assert.deepEqual(await w.api(anya, 'emoji.set', { emoji: '🦊' }), { ok: true, emoji: '🦊' });
    assert.equal((await w.api(anya, 'me')).me.emoji, '🦊');
    for (const emoji of ['🍕', 'abc', '🦊🦊', null, undefined, 5]) {
      const r = await w.api(anya, 'emoji.set', { emoji }, true);
      assert.equal(r.status, 400, String(emoji));
      assert.equal(r.data.error, NO_EMOJI);
    }
    assert.equal((await w.api(anya, 'me')).me.emoji, '🦊');
    await w.api(borya, 'emoji.set', { emoji: '🐻' });
    await w.api(borya, 'emoji.set', { emoji: '' });
    assert.equal(w.query('SELECT emoji FROM users WHERE tg_id = ?', borya.id)[0].emoji, '');
  });

  it('незарегистрированный значок не ставит', async () => {
    const { w, E, invite } = z;
    await w.say(stranger, '/start ' + await invite(E));
    const r = await w.api(stranger, 'emoji.set', { emoji: '🦊' }, true);
    assert.notEqual(r.status, 200);
    assert.equal(w.query('SELECT emoji FROM users WHERE tg_id = ?', stranger.id)[0].emoji, '');
  });

  it('значок — в списке участников на «Инфо», у организаторов, в панели и в списке администраторов', async () => {
    const { w, E } = z;
    await w.api(boss, 'emoji.set', { emoji: '🎅' });
    const r = (await w.api(vera, 'event.get', { event: E })).roster;
    assert.equal(r.people.find((p) => p.id === anya.id).emoji, '🦊');
    assert.equal(r.people.find((p) => p.id === vera.id).emoji, '');
    assert.equal(r.organizers.find((p) => p.id === boss.id).emoji, '🎅');
    const st = await w.api(adm, 'admin.state', { event: E });
    assert.equal(st.users.find((u) => u.id === anya.id).emoji, '🦊');
    const us = await w.api(adm, 'admin.users');
    assert.equal(us.users.find((u) => u.id === boss.id).emoji, '🎅');
  });

  it('значок — у заявок и удалённых в панели', async () => {
    const { w, create, invite } = z;
    const F = await create('Заявки', [borya]);
    await w.api(gena, 'emoji.set', { emoji: '🐧' }, true); // ещё не зарегистрирован — не ставится
    await w.api(boss, 'admin.game', { event: F, approval: true });
    await w.say(gena, '/start ' + await invite(F));
    await w.say(gena, gena.name);
    await w.api(gena, 'emoji.set', { emoji: '🐧' });
    await w.api(borya, 'emoji.set', { emoji: '🐻' });
    await w.api(boss, 'admin.remove', { event: F, id: borya.id });
    const st = await w.api(boss, 'admin.state', { event: F });
    assert.equal(st.requests.find((r) => r.user_id === gena.id).emoji, '🐧');
    assert.equal(st.removed.find((r) => r.id === borya.id).emoji, '🐻');
  });

  it('Санта видит значок подопечного; в переписке, сообщениях бота и журнале значков нет', async () => {
    const { w, E, santaOf } = z;
    await w.api(boss, 'admin.draw', { event: E });
    const santa = santaOf(anya);
    assert.equal((await w.api(santa, 'ward.get', { event: E })).ward.emoji, '🦊');
    await w.api(santa, 'emoji.set', { emoji: '🦄' });
    await w.api(santa, 'message.send', { event: E, to: 'ward', text: 'Привет!' });
    await w.api(anya, 'message.send', { event: E, to: 'santa', text: 'Спасибо!' });
    const forWard = await w.api(anya, 'chat.get', { event: E, with: 'santa' });
    const forSanta = await w.api(santa, 'chat.get', { event: E, with: 'ward' });
    for (const d of [forWard, forSanta]) {
      assert.ok(!has(d, 'emoji') && !has(d, '🦄') && !has(d, '🦊'), JSON.stringify(d));
    }
    assert.ok(!has((await w.api(anya, 'event.get', { event: E })).member, 'emoji'), 'участнику о себе — без значков');
    const texts = w.calls.filter((c) => c.method === 'sendMessage').map((c) => c.params.text).join('\n');
    assert.ok(!texts.includes('🦄') && !texts.includes('🦊'), 'сообщения бота без значков');
    assert.ok(!has(w.query('SELECT * FROM audit'), '🦄') && !has(w.query('SELECT * FROM audit'), '🦊'), 'журнал без значков');
  });
});

describe('открытка для письма (038, US2)', () => {
  let z;
  before(async () => {
    z = await world();
    await z.w.api(anya, 'wishlist.save', { event: z.E, text: 'Хочу книгу про горы' });
  });

  it('открытка из набора сохраняется у письма; Санте нет сообщения, время письма прежнее; журнала нет', async () => {
    const { w, E } = z;
    await w.api(boss, 'admin.draw', { event: E });
    const t = w.query('SELECT wishlist_updated_at FROM members WHERE event_id = ? AND user_id = ?', E, anya.id)[0].wishlist_updated_at;
    const outbox = w.query('SELECT COUNT(*) AS n FROM outbox')[0].n;
    const audit = w.query('SELECT COUNT(*) AS n FROM audit')[0].n;
    assert.deepEqual(await w.api(anya, 'card.set', { event: E, card: 'night' }), { ok: true, card: 'night' });
    const d = await w.api(anya, 'event.get', { event: E });
    assert.equal(d.member.card, 'night');
    assert.equal(d.member.wishlist_updated_at, t);
    assert.equal(w.query('SELECT COUNT(*) AS n FROM outbox')[0].n, outbox, 'очередь бота');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM audit')[0].n, audit, 'журнал');
  });

  it('не из набора — отказ и прежняя открытка; «без открытки» убирает', async () => {
    const { w, E } = z;
    for (const card of ['nope', 'Снегопад', null, 1]) {
      const r = await w.api(anya, 'card.set', { event: E, card }, true);
      assert.equal(r.status, 400, String(card));
      assert.equal(r.data.error, NO_CARD);
    }
    assert.equal((await w.api(anya, 'event.get', { event: E })).member.card, 'night');
    await w.api(borya, 'card.set', { event: E, card: 'candy' });
    await w.api(borya, 'card.set', { event: E, card: '' });
    assert.equal((await w.api(borya, 'event.get', { event: E })).member.card, '');
  });

  it('открытку видят Санта (и с изменениями письма) и организатор, открывший письмо', async () => {
    const { w, E, santaOf } = z;
    const santa = santaOf(anya);
    assert.equal((await w.api(santa, 'ward.get', { event: E })).ward.card, 'night');
    await w.api(anya, 'wishlist.save', { event: E, text: 'Хочу книгу про горы и шарф' });
    const d = await w.api(santa, 'ward.get', { event: E });
    assert.ok(d.previous);
    assert.equal(d.ward.card, 'night');
    assert.equal((await w.api(adm, 'admin.wishlist', { event: E, id: anya.id })).card, 'night');
  });

  it('не участник и завершённое событие — отказ', async () => {
    const { w, E, create } = z;
    const F = await create('Завершённое', [vera]);
    await w.api(boss, 'admin.event.finish', { event: F });
    const r = await w.api(vera, 'card.set', { event: F, card: 'snow' }, true);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, LETTER_CLOSED);
    const g = await w.api(gena, 'card.set', { event: E, card: 'snow' }, true);
    assert.notEqual(g.status, 200);
  });

  it('перенос участия: открытка идёт с письмом — с письмом нового аккаунта, если оно не пустое', async () => {
    const { w, create, invite, join } = z;
    const P = await create('Перенос', [vera]);
    const Q = await create('Перенос с письмом', [vera]);
    for (const ev of [P, Q]) {
      await w.api(vera, 'wishlist.save', { event: ev, text: 'Письмо Веры' });
      await w.api(vera, 'card.set', { event: ev, card: 'snow' });
      await join(fresh, await invite(ev));
    }
    await w.api(fresh, 'wishlist.save', { event: Q, text: 'Новое письмо' });
    await w.api(boss, 'admin.transfer', { from: vera.id, to: fresh.id });
    const row = (ev) => w.query('SELECT wishlist, card FROM members WHERE event_id = ? AND user_id = ?', ev, fresh.id)[0];
    assert.deepEqual({ ...row(P) }, { wishlist: 'Письмо Веры', card: 'snow' });
    assert.deepEqual({ ...row(Q) }, { wishlist: 'Новое письмо', card: '' });
  });

  it('полный сброс стирает письмо и открытку оставшегося владельца', async () => {
    const { w, create } = z;
    const R = await create('Сброс', [borya]);
    await w.api(boss, 'admin.participate', { event: R, on: true });
    await w.api(boss, 'wishlist.save', { event: R, text: 'Письмо владельца' });
    await w.api(boss, 'card.set', { event: R, card: 'gift' });
    await w.api(boss, 'admin.reset.full', { event: R, confirm: 'СБРОС' });
    assert.deepEqual({ ...w.query('SELECT wishlist, card FROM members WHERE event_id = ? AND user_id = ?', R, boss.id)[0] }, { wishlist: '', card: '' });
  });
});

// ---------- набор ↔ дизайн-система ----------
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = strip(read('design-system/tokens.css'));
const components = strip(read('design-system/components.css'));
const preview = read('design-system/preview.html');
const IDS = POSTCARDS.map((c) => c.id);
const token = (name) => new RegExp(`--ds-postcard-${name}:\\s*([^;]+);`).exec(tokens)?.[1].trim();

// Относительная яркость и контраст WCAG 2.x по цветам #rrggbb
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('набор: значки — 40 разных, каждый одна графема; открытки — 15 разных id и названий', () => {
  const seg = new Intl.Segmenter('ru', { granularity: 'grapheme' });
  assert.equal(new Set(EMOJIS).size, EMOJIS.length);
  for (const e of EMOJIS) assert.equal([...seg.segment(e)].length, 1, e);
  assert.equal(new Set(IDS).size, 15);
  assert.equal(new Set(POSTCARDS.map((c) => c.title)).size, 15);
  for (const id of IDS) assert.match(id, /^[a-z]+$/, id);
});

test('каждая открытка набора — тема в components.css, токены в tokens.css, показ в витрине; лишних тем нет', () => {
  const themes = [...components.matchAll(/\.ds-postcard--([a-z]+)\s*\{([^}]*)\}/g)].filter(([, id]) => id !== 'mini');
  assert.deepEqual(themes.map(([, id]) => id).sort(), [...IDS].sort(), 'темы в components.css = набор');
  for (const [, id, body] of themes) {
    for (const part of ['frame', 'paper', 'ink']) {
      assert.match(body, new RegExp(`--ds-postcard-${part}:\\s*var\\(--ds-postcard-${id}-${part}\\)`), `${id}: ${part}`);
      assert.ok(token(`${id}-${part}`), `tokens.css: --ds-postcard-${id}-${part}`);
    }
    assert.match(body, /--ds-postcard-mark:\s*'[^']+'/, `${id}: наклейка`);
    assert.ok(preview.includes(`ds-postcard--${id}"`) || preview.includes(`ds-postcard--${id} `), `витрина: ${id}`);
  }
  const tokenThemes = new Set([...tokens.matchAll(/--ds-postcard-([a-z]+)-(?:frame|paper|ink):/g)].map((m) => m[1]));
  assert.deepEqual([...tokenThemes].sort(), [...IDS].sort(), 'темы в tokens.css = набор');
});

test('текст открытки читается: контраст чернил и бумаги не ниже 4.5 : 1 у каждой', () => {
  const low = [];
  for (const id of IDS) {
    const paper = token(`${id}-paper`);
    const ink = token(`${id}-ink`);
    assert.match(paper, /^#[0-9a-f]{6}$/i, `${id}: бумага — сплошной цвет`);
    assert.match(ink, /^#[0-9a-f]{6}$/i, `${id}: чернила — сплошной цвет`);
    const c = contrast(paper, ink);
    if (c < 4.5) low.push(`${id}: ${c.toFixed(2)}`);
  }
  assert.deepEqual(low, []);
});

// Без явного caret-color iOS рисует каретку по теме телефона: в тёмной теме — светлую, на светлой бумаге её не видно
const caretRule = (css) => /\.ds-postcard__paper \.ds-input\s*\{[^}]*caret-color:\s*var\(--ds-postcard-ink\)/.test(css);
test('поле ввода на открытке: каретка — цвет чернил (видна на бумаге в любой теме телефона)', () => {
  assert.ok(caretRule(components), 'components.css: у .ds-postcard__paper .ds-input нет caret-color: var(--ds-postcard-ink)');
  assert.ok(!caretRule('.ds-postcard__paper .ds-input { background: transparent; color: inherit; }'), 'от противного');
});

test('от противного: контраст ловит бледный текст, сверка — лишнюю тему', () => {
  assert.ok(contrast('#ffffff', '#999999') < 4.5);
  assert.ok(contrast('#ffffff', '#1b365d') >= 4.5);
  const extra = [...'.ds-postcard--snow { } .ds-postcard--pizza { }'.matchAll(/\.ds-postcard--([a-z]+)\s*\{/g)].map((m) => m[1]);
  assert.notDeepEqual(extra.sort(), ['snow']);
});

// ---------- приложение: значка нет в переписке Санты и подопечного ----------
// 039: обращения (та же часть 07-sheet-chat) — со значками; переписка Санты и подопечного (openChat) — без
test('переписка Санты и подопечного (openChat) не показывает значков: нет emoji, emojiName, withEmoji', async () => {
  const { PARTS, topBlock } = await import('./support/app-source.mjs');
  const lines = PARTS.find((p) => p.name.startsWith('07-')).text.split('\n');
  const block = topBlock(lines, 'openChat');
  assert.ok(block, 'нет openChat');
  const found = (ls) => ls.filter((l) => /\b(emoji|emojiName|withEmoji)\b|_emoji\b/.test(l));
  assert.deepEqual(found(lines.slice(block[0], block[1] + 1)), []);
  assert.equal(found(['  h(\'div\', {}, emojiName(u));', '  m.author_emoji']).length, 2, 'от противного');
});

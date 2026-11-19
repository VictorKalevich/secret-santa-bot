// 038: открытка видна участнику, его Санте и организатору, открывшему письмо.
import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { POSTCARDS } from '../src/looks.js';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vera = { id: 103, name: 'Вера', username: 'vera' };
const gena = { id: 104, name: 'Гена', username: 'gena' };
const fresh = { id: 105, name: 'Аня новая', username: 'anya2' };

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

test('набор открыток — 15 разных id и названий', () => {
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

// Язык у вызова и у получателя (060, US3, research R10): у одного человека псевдоязык xx (tests/support/pseudo.mjs) —
// всё, что получает он (ответы API, ответы и сообщения бота, кнопки, отказы), без кириллицы и с ⟪…⟫; всё, что получают
// остальные, — без ⟪; журнал — на русском. Люди и названия — латиницей, чтобы кириллица значила только текст бота.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { PSEUDO, CYRILLIC, pseudoLanguage } from './support/pseudo.mjs';
import { appTexts, DEFAULT_LANG } from '../src/i18n/index.js';

const boss = { id: 9101, name: 'Boss', username: 'boss' };
const anna = { id: 9102, name: 'Anna', username: 'anna' };
const bob = { id: 9103, name: 'Bob', username: 'bob' };
const carl = { id: 9104, name: 'Carl', username: 'carl' };
const dina = { id: 9105, name: 'Dina', username: 'dina' };

let drop;
before(() => {
  drop = pseudoLanguage();
});
after(() => {
  drop();
  restoreFetch();
});

// Все строки значения (тексты, подписи кнопок, вложенные поля)
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

// Нарушения в вызовах Bot API: кому — chat_id (ответ на нажатие — нажавшему); у человека с xx — ни буквы кириллицы и
// хотя бы одна ⟪ в вызове с текстом, у остальных — ни одной ⟪
export function langProblems(calls, presser, xx = new Set([anna.id])) {
  const found = [];
  for (const { method, params } of calls) {
    const to = params.chat_id ?? (method === 'answerCallbackQuery' ? presser?.id : undefined);
    if (to === undefined) continue;
    const texts = strings({ text: params.text, caption: params.caption, reply_markup: params.reply_markup })
      .filter((s) => /\p{L}/u.test(s) && !/^https?:/.test(s));
    const all = texts.join(' | ');
    if (xx.has(to)) {
      if (CYRILLIC.test(all)) found.push(`${method} → ${to}: кириллица: ${all.slice(0, 160)}`);
      else if (texts.length && !all.includes('⟪')) found.push(`${method} → ${to}: без ⟪: ${all.slice(0, 160)}`);
    } else if (all.includes('⟪')) found.push(`${method} → ${to}: ⟪ у русского: ${all.slice(0, 160)}`);
  }
  return found;
}

describe('псевдоязык у одного человека (US3)', () => {
  let w;
  let E;
  const problems = [];
  // Шаг сценария: вызовы Bot API за время шага проверяются сразу (presser — кто нажал кнопку)
  async function step(label, fn, presser) {
    const from = w.calls.length;
    const result = await fn();
    for (const p of langProblems(w.calls.slice(from), presser)) problems.push(`${label}: ${p}`);
    return result;
  }
  // Ответ API человеку: у xx — без кириллицы и с ⟪ в тексте отказа; у остальных — без ⟪
  async function call(u, action, body = {}) {
    const r = await step(`${u.name} ${action}`, () => w.api(u, action, body, true));
    const json = JSON.stringify(r.data);
    if (u === anna && CYRILLIC.test(json)) problems.push(`${action} → Anna: кириллица в ответе: ${json.slice(0, 200)}`);
    if (u === anna && r.data.ok === false && !r.data.error.includes('⟪')) problems.push(`${action} → Anna: отказ без ⟪`);
    if (u !== anna && json.includes('⟪')) problems.push(`${action} → ${u.name}: ⟪ в ответе`);
    return r;
  }
  const say = (u, text) => step(`${u.name} пишет «${text}»`, () => w.say(u, text));
  const press = (u, data) => step(`${u.name} нажимает ${data}`, () => w.press(u, data), u);
  const santaOf = (u) => w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', E, u.id)[0].santa;
  const wardOf = (u) => w.query('SELECT ward FROM pairs WHERE event_id = ? AND santa = ?', E, u.id)[0].ward;
  const person = (id) => [boss, anna, bob, carl, dina].find((u) => u.id === id);

  before(async () => {
    w = await startWorld();
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    // Язык ставится до первого сообщения: в шаге 1 его ставят только тесты (шаг 2 — язык Telegram и выбор человека)
    w.query("INSERT INTO users (tg_id, lang, created_at) VALUES (?, ?, ?)", anna.id, PSEUDO, Date.now());
    E = (await w.api(boss, 'admin.events.create', { title: 'Party' })).event.id;
    const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: E })).settings.invite_link)[1];
    for (const u of [anna, bob, carl, dina]) {
      await say(u, '/start ' + code);
      await say(u, u.name);
    }
  });

  it('me: язык xx и словарь только xx; повтор с той же версией — без словаря', async () => {
    const r = await call(anna, 'me');
    assert.equal(r.data.lang, PSEUDO);
    assert.equal(r.data.texts_version, appTexts(PSEUDO).version);
    assert.ok(Object.keys(r.data.texts).every((k) => k.startsWith('app.')));
    assert.deepEqual(r.data.texts, appTexts(PSEUDO).texts);
    const again = await call(anna, 'me', { texts: r.data.texts_version });
    assert.equal(again.data.texts, undefined);
    assert.equal(again.data.texts_version, r.data.texts_version);
    const ru = await call(bob, 'me');
    assert.equal(ru.data.lang, DEFAULT_LANG);
    assert.equal(ru.data.texts_version, appTexts(DEFAULT_LANG).version);
  });

  it('игра целиком: ответы, отказы, сообщения и кнопки — каждому на своём языке', async () => {
    await call(anna, 'event.get', { event: E });
    await call(anna, 'wishlist.save', { event: E, text: 'Books' });
    await call(bob, 'wishlist.save', { event: E, text: 'Socks' });
    await call(anna, 'admin.state', { event: E }); // не организатор — отказ
    await call(anna, 'event.leave', { event: E, confirm: 'NO' }); // не то слово — отказ со словом
    await call(anna, 'support.send', { event: E, text: 'Question' });
    const thread = w.query('SELECT id FROM support_threads WHERE event_id = ? AND user_id = ?', E, anna.id)[0].id;
    await call(boss, 'admin.support.send', { event: E, thread, text: 'Answer' });
    await say(anna, 'hello');
    await say(anna, '/start');
    await call(boss, 'admin.draw.check', { event: E });
    await call(boss, 'admin.draw', { event: E });
    await call(anna, 'ward.get', { event: E });
    await call(anna, 'message.send', { event: E, to: 'ward', text: 'Hi ward' });
    const santa = person(santaOf(anna));
    await call(santa, 'message.send', { event: E, to: 'ward', text: 'Hi Anna' });
    await call(anna, 'message.send', { event: E, to: 'santa', text: 'Thanks' });
    await press(anna, `msg:ward:${E}`);
    await say(anna, 'From the bot');
    await call(person(wardOf(anna)), 'wishlist.save', { event: E, text: 'Tea' });
    await step('cron', () => w.cron());
    await call(boss, 'admin.announce', { event: E, text: 'News' });
    await call(boss, 'admin.remind.santas', { event: E });
    await call(anna, 'ward.gift', { event: E, ready: true });
    await call(santa, 'ward.gift', { event: E, ready: true });
    await call(anna, 'ward.received', { event: E, received: true });
    await press(anna, `sup:u:${E}`);
    await call(boss, 'admin.reveal', { event: E });
    await call(boss, 'admin.event.finish', { event: E });
    await call(anna, 'wishlist.save', { event: E, text: 'Late' }); // завершено — отказ
    await press(anna, 'nonsense:1');
    assert.deepEqual(problems, []);
    // Сценарий действительно прошёл: Анна получила сообщения бота, остальные — тоже
    assert.ok(w.texts(anna).length >= 8, `Анне сообщений: ${w.texts(anna).length}`);
    assert.ok(w.texts(anna).every((x) => x.includes('⟪')));
    assert.ok(w.texts(boss).some((x) => CYRILLIC.test(x)), 'организатору — по-русски');
  });

  it('журнал — на языке по умолчанию, в том числе записи действий Анны', () => {
    const rows = w.query('SELECT action, details FROM audit WHERE event_id = ?', E);
    assert.ok(rows.length > 0);
    assert.deepEqual(rows.filter((r) => r.details.includes('⟪')), []);
  });
});

describe('от противного: проверка языка замечает чужой язык', () => {
  it('русский текст Анне и ⟪ другому — нарушения; свой язык каждому — нет', () => {
    const calls = [
      { method: 'sendMessage', params: { chat_id: anna.id, text: '⟪Privet⟫' } },
      { method: 'sendMessage', params: { chat_id: anna.id, text: 'Привет', reply_markup: { inline_keyboard: [[{ text: '⟪Da⟫' }]] } } },
      { method: 'sendMessage', params: { chat_id: bob.id, text: 'Привет' } },
      { method: 'sendMessage', params: { chat_id: bob.id, text: '⟪Privet⟫ Bob' } },
      { method: 'answerCallbackQuery', params: { callback_query_id: 'x', text: 'Готово' } },
    ];
    assert.deepEqual(langProblems(calls, anna).map((p) => p.split(':')[0]), [
      'sendMessage → 9102', 'sendMessage → 9103', 'answerCallbackQuery → 9102',
    ]);
  });
});

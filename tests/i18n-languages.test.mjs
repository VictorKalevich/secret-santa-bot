// Язык человека (061, контракт specs/061-i18n-languages/contracts/language.md): правило языка Telegram, запоминание при
// обращении, выбор в приложении и в боте, кнопка меню и команды чата, профиль бота частями, журнал на языке смотрящего,
// слова подтверждения и игра целиком на каждом языке бота. Люди и названия — латиницей: кириллица значит текст бота.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { telegramReply, visibleLength } from './support/telegram-rules.mjs';
import { CYRILLIC } from './support/pseudo.mjs';
import {
  t, tx, langOf, telegramLanguage, LANGUAGES, RUSSIAN_SPEAKING, FALLBACK_LANG, DEFAULT_LANG,
} from '../src/i18n/index.js';
import { LANGUAGE_NAMES } from '../src/i18n/languages.js';
import { PROFILE_TARGETS, profileCalls, profileVersion, profileFrom, sendProfile } from '../src/bot-profile.js';
import { metered } from '../src/budget.js';
import { auditStmt } from '../src/db.js';

after(restoreFetch);

const OTHERS = LANGUAGES.filter((l) => l !== DEFAULT_LANG);
// Названия языков — на самих языках («Русский» в списке выбора у любого человека)
const NAMES = new Set(Object.values(LANGUAGE_NAMES));

// Все строки значения (тексты, подписи кнопок, вложенные поля)
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}
// Вызовы Bot API людям не русского языка (foreign — их id) с кириллицей; ответ на нажатие — нажавшему
function foreignProblems(calls, presser, foreign) {
  const found = [];
  for (const { method, params } of calls) {
    const to = params.chat_id ?? (method === 'answerCallbackQuery' ? presser?.id : undefined);
    if (!foreign.has(to)) continue;
    const all = strings({ text: params.text, caption: params.caption, reply_markup: params.reply_markup, menu: params.menu_button })
      .filter((x) => !NAMES.has(x.replace(/^✓ /, ''))).join(' | ');
    if (CYRILLIC.test(all)) found.push(`${method} → ${to}: кириллица: ${all.slice(0, 160)}`);
  }
  return found;
}
const boss = { id: 9101, name: 'Boss', username: 'boss' };

async function bossWorld(opts) {
  const w = await startWorld(opts);
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const E = (await w.api(boss, 'event.create', { participate: false, title: 'Party' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: E })).settings.invite_link)[1];
  return { w, E, code };
}
const join = async (w, code, u) => {
  await w.say(u, '/start ' + code);
  await w.say(u, u.name);
};
const userRow = (w, u) => w.query('SELECT lang, tg_lang, menu_lang FROM users WHERE tg_id = ?', u.id)[0];
const callsTo = (w, from, u, method) => w.calls.slice(from).filter((c) => c.method === method && c.params.chat_id === u.id);

describe('правило языка (US1)', () => {
  it('языки бота, русскоязычные и язык по умолчанию', () => {
    assert.deepEqual(LANGUAGES.slice(0, 1), ['ru']);
    for (const lang of LANGUAGES) assert.ok(LANGUAGE_NAMES[lang], `у ${lang} есть название`);
    assert.deepEqual(RUSSIAN_SPEAKING, ['be', 'uk', 'kk', 'ky', 'tg', 'uz', 'hy', 'az', 'tk']);
    assert.equal(FALLBACK_LANG, 'en');
  });

  it('код Telegram → язык бота', () => {
    const table = {
      '': '', ru: 'ru', 'ru-RU': 'ru', be: 'ru', uk: 'ru', kk: 'ru', ky: 'ru', tg: 'ru', uz: 'ru', hy: 'ru', az: 'ru', tk: 'ru',
      ka: 'en', he: 'en', ja: 'en', nl: 'en', en: 'en', 'en-US': 'en', 'en_GB': 'en',
    };
    for (const lang of OTHERS) {
      table[lang] = lang;
      table[lang.toUpperCase() + '-XX'] = lang;
    }
    if (LANGUAGES.includes('pt')) table['pt-br'] = 'pt';
    if (LANGUAGES.includes('zh')) Object.assign(table, { 'zh-hans': 'zh', 'zh-hant': 'zh', 'zh-TW': 'zh' });
    for (const [code, lang] of Object.entries(table)) assert.equal(telegramLanguage(code), lang, code);
    assert.equal(telegramLanguage(undefined), '');
    assert.equal(telegramLanguage(null), '');
  });

  it('язык человека: выбор → язык Telegram обращения → запомненный → русский; чужие коды не в счёт', () => {
    const [a, b] = OTHERS;
    assert.equal(langOf({ lang: a, tg_lang: b }, b), a);
    assert.equal(langOf({ lang: '', tg_lang: b }, a), a);
    assert.equal(langOf({ lang: '', tg_lang: b }, ''), b);
    assert.equal(langOf({ lang: 'qq', tg_lang: 'constructor' }, 'zz'), DEFAULT_LANG);
    assert.equal(langOf(null, a), a, 'без записи — язык Telegram');
    assert.equal(langOf(null), DEFAULT_LANG);
  });
});

describe('язык Telegram запоминается при обращении (US1)', () => {
  it('бот, нажатие и приложение; запись — только при изменении; без кода — прежний', async () => {
    const { w, code } = await bossWorld();
    const [a, b, c] = OTHERS;
    const ann = { id: 9201, name: 'Ann', username: 'ann', language_code: a };
    // Новый человек по ссылке: запись сразу с языком Telegram, просьба имени — на нём
    let from = w.calls.length;
    await w.say(ann, '/start ' + code);
    assert.equal(userRow(w, ann).tg_lang, a);
    const asks = callsTo(w, from, ann, 'sendMessage');
    assert.ok(asks.length && asks.every((x) => !CYRILLIC.test(JSON.stringify(x.params))), 'просьба имени — на языке Telegram');
    await w.say(ann, ann.name);
    // Тот же язык — ни одной записи языка
    await w.say(ann, '/start');
    assert.ok(!w.last.sql.some((q) => /UPDATE users SET .*tg_lang/.test(q)), 'тот же язык не пишется');
    // Другой язык в сообщении — запомнен, ответ на нём
    from = w.calls.length;
    await w.say({ ...ann, language_code: b }, '/start');
    assert.equal(userRow(w, ann).tg_lang, b);
    // Нажатие кнопки
    await w.press({ ...ann, language_code: c }, 'notify');
    assert.equal(userRow(w, ann).tg_lang, c);
    // Приложение: язык из подписанных данных
    const me = await w.api({ ...ann, language_code: a }, 'me', {}, true);
    assert.equal(me.data.lang, a);
    assert.equal(me.data.lang_auto, a);
    assert.equal(me.data.lang_choice, '');
    assert.equal(userRow(w, ann).tg_lang, a);
    // Без кода Telegram — запомненный язык, запись прежняя
    const plain = { id: ann.id, name: ann.name, username: ann.username };
    assert.equal((await w.api(plain, 'me', {}, true)).data.lang, a);
    assert.equal(userRow(w, ann).tg_lang, a);
    assert.ok(!w.last.sql.some((q) => /UPDATE users SET/.test(q)), 'без кода — ни одной записи');
  });

  it('русскоязычному Telegram и без кода — русский, как раньше', async () => {
    const { w, code } = await bossWorld();
    const ua = { id: 9202, name: 'Oles', username: 'oles', language_code: 'uk' };
    await join(w, code, ua);
    assert.equal(userRow(w, ua).tg_lang, 'ru');
    assert.ok(w.texts(ua).every((x) => CYRILLIC.test(x)), 'украинскому Telegram — русский');
    const me = await w.api(ua, 'me', {}, true);
    assert.equal(me.data.lang, 'ru');
  });
});

describe('выбор языка (US2)', () => {
  it('lang.set: выбор важнее Telegram, ответ — уже на новом языке; «как в Telegram» — обратно; отказ', async () => {
    const { w, code } = await bossWorld();
    const [a, b] = OTHERS;
    const ann = { id: 9211, name: 'Ann', username: 'ann', language_code: a };
    await join(w, code, ann);
    const r = await w.api(ann, 'lang.set', { lang: b }, true);
    assert.deepEqual(r.data, { ok: true, lang: b });
    assert.equal(userRow(w, ann).lang, b);
    assert.equal((await w.api(ann, 'me', {}, true)).data.lang, b, 'выбор важнее языка Telegram');
    assert.equal((await w.api(ann, 'me', {}, true)).data.lang_choice, b);
    const bad = await w.api(ann, 'lang.set', { lang: 'xx' }, true);
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error, t(b, 'api.lang.unknown'));
    const back = await w.api(ann, 'lang.set', { lang: '' }, true);
    assert.deepEqual(back.data, { ok: true, lang: a });
    assert.equal(userRow(w, ann).lang, '');
    // Сообщения очереди — на языке получателя: русский организатор получает своё
    const ru = await w.api(ann, 'lang.set', { lang: 'ru' }, true);
    assert.deepEqual(ru.data, { ok: true, lang: 'ru' });
  });

  it('кнопка меню и команды чата: свой язык — своя кнопка один раз, русский — общая; выбор — команды чата', async () => {
    const { w, code } = await bossWorld();
    const [a, b] = OTHERS;
    const ann = { id: 9212, name: 'Ann', username: 'ann', language_code: a };
    let from = w.calls.length;
    await join(w, code, ann);
    const menu = callsTo(w, from, ann, 'setChatMenuButton');
    assert.equal(menu.length, 1, 'кнопка меню — один раз');
    assert.equal(menu[0].params.menu_button.type, 'web_app');
    assert.equal(menu[0].params.menu_button.text, t(a, 'setup.menuButton'));
    assert.match(menu[0].params.menu_button.web_app.url, /\/app$/);
    assert.equal(userRow(w, ann).menu_lang, a);
    from = w.calls.length;
    await w.say(ann, '/start');
    assert.equal(callsTo(w, from, ann, 'setChatMenuButton').length, 0, 'повтор — без вызова');
    // Выбор другого языка: кнопка и команды чата на нём
    from = w.calls.length;
    await w.api(ann, 'lang.set', { lang: b });
    assert.equal(callsTo(w, from, ann, 'setChatMenuButton')[0].params.menu_button.text, t(b, 'setup.menuButton'));
    const cmds = w.calls.slice(from).filter((c) => c.method === 'setMyCommands');
    assert.equal(cmds.length, 1);
    assert.deepEqual(cmds[0].params.scope, { type: 'chat', chat_id: ann.id });
    assert.deepEqual(cmds[0].params.commands.map((c) => c.command), ['start', 'language', 'cancel']);
    assert.equal(cmds[0].params.commands[1].description, t(b, 'setup.command.language'));
    // Русский — общая кнопка бота
    from = w.calls.length;
    await w.api(ann, 'lang.set', { lang: 'ru' });
    assert.deepEqual(callsTo(w, from, ann, 'setChatMenuButton')[0].params.menu_button, { type: 'default' });
    assert.equal(userRow(w, ann).menu_lang, '');
    // «Как в Telegram» — команды чата снимаются
    from = w.calls.length;
    await w.api(ann, 'lang.set', { lang: '' });
    const del = w.calls.slice(from).filter((c) => c.method === 'deleteMyCommands');
    assert.deepEqual(del.map((c) => c.params.scope), [{ type: 'chat', chat_id: ann.id }]);
    // Тот же выбор ещё раз — ни одного вызова Telegram
    from = w.calls.length;
    await w.api(ann, 'lang.set', { lang: '' });
    assert.equal(w.calls.length, from);
    // Русскому без выбора — ни одного вызова кнопки
    const ru = { id: 9213, name: 'Ivan', username: 'ivan' };
    from = w.calls.length;
    await join(w, code, ru);
    assert.equal(callsTo(w, from, ru, 'setChatMenuButton').length, 0);
  });

  it('/language и кнопки lang: — до регистрации тоже; ответ, меню и просьба имени — на новом языке', async () => {
    const { w, code } = await bossWorld();
    const [a] = OTHERS;
    const ivan = { id: 9221, name: 'Ivan', username: 'ivan' };
    await join(w, code, ivan);
    let from = w.calls.length;
    await w.say(ivan, '/language');
    const [menu] = callsTo(w, from, ivan, 'sendMessage');
    assert.equal(menu.params.text, t('ru', 'bot.lang.choose'));
    const kb = menu.params.reply_markup.inline_keyboard;
    assert.deepEqual(kb[0].map((b) => b.callback_data), ['lang:auto']);
    assert.equal(kb[0][0].text, '✓ ' + t('ru', 'bot.lang.auto', { name: LANGUAGE_NAMES.ru }));
    assert.deepEqual(kb.slice(1).flat().map((b) => b.callback_data), LANGUAGES.map((l) => 'lang:' + l));
    assert.ok(kb.slice(1).every((row) => row.length <= 2));
    // Выбор: ответ на нажатие и меню — на новом языке
    from = w.calls.length;
    await w.press(ivan, 'lang:' + a);
    const answer = w.calls.slice(from).find((c) => c.method === 'answerCallbackQuery');
    assert.equal(answer.params.text, t(a, 'bot.lang.saved', { name: LANGUAGE_NAMES[a] }));
    const after = callsTo(w, from, ivan, 'sendMessage');
    assert.equal(after.length, 1, 'меню');
    assert.ok(!CYRILLIC.test(JSON.stringify(after[0].params)), 'меню — на новом языке');
    assert.equal(userRow(w, ivan).lang, a);
    // Галочка — у выбранного
    from = w.calls.length;
    await w.say(ivan, '/language');
    const marked = callsTo(w, from, ivan, 'sendMessage')[0].params.reply_markup.inline_keyboard.flat().filter((b) => b.text.startsWith('✓ '));
    assert.deepEqual(marked.map((b) => b.callback_data), ['lang:' + a]);
    // Неизвестный код — отказ на языке человека
    from = w.calls.length;
    await w.press(ivan, 'lang:xx');
    assert.equal(w.calls.slice(from).find((c) => c.method === 'answerCallbackQuery').params.text, t(a, 'api.lang.unknown'));
    // Ждущий имени: выбор — и просьба имени на новом языке
    const nora = { id: 9222, name: 'Nora', username: 'nora' };
    await w.say(nora, '/start ' + code);
    from = w.calls.length;
    await w.press(nora, 'lang:' + a);
    const ask = callsTo(w, from, nora, 'sendMessage');
    assert.equal(ask.length, 1);
    assert.ok(!CYRILLIC.test(JSON.stringify(ask[0].params)), 'просьба имени — на новом языке');
    // Незнакомый (записи нет) — /language как текст незнакомца
    const stranger = { id: 9223, name: 'Zed', username: 'zed' };
    from = w.calls.length;
    await w.say(stranger, '/language');
    assert.deepEqual(callsTo(w, from, stranger, 'sendMessage').map((c) => c.params.text), [t('ru', 'bot.closedBot')]);
  });
});

describe('слова подтверждения (US3)', () => {
  for (const lang of OTHERS) {
    it(`${lang}: слово своего языка без регистра принимается, русское — отказ со словом языка`, async () => {
      const { w, E, code } = await bossWorld();
      const u = { id: 9231, name: 'Uma', username: 'uma', language_code: lang };
      await join(w, code, u);
      const word = t(lang, 'app.core.word.leave');
      const wrong = await w.api(u, 'event.leave', { event: E, confirm: t('ru', 'app.core.word.leave') }, true);
      if (word !== t('ru', 'app.core.word.leave')) {
        assert.equal(wrong.status, 400);
        assert.equal(wrong.data.error, t(lang, 'api.confirm.leave', { word }));
      }
      const ok = await w.api(u, 'event.leave', { event: E, confirm: ' ' + word.toLocaleLowerCase(lang) + ' ' }, true);
      assert.equal(ok.data.ok, true, JSON.stringify(ok.data));
    });
  }
});

describe('профиль бота (US4)', () => {
  it('цели: прочие языки — английский, языки бота — свои, русскоязычные — русский; 3 вызова на цель', () => {
    assert.deepEqual(PROFILE_TARGETS[0], ['', FALLBACK_LANG]);
    for (const lang of LANGUAGES.filter((l) => l !== FALLBACK_LANG)) assert.ok(PROFILE_TARGETS.some(([c, l]) => c === lang && l === lang), lang);
    for (const code of RUSSIAN_SPEAKING) assert.ok(PROFILE_TARGETS.some(([c, l]) => c === code && l === 'ru'), code);
    assert.equal(profileCalls().length, PROFILE_TARGETS.length * 3);
    assert.equal(new Set(PROFILE_TARGETS.map(([c]) => c)).size, PROFILE_TARGETS.length, 'цели без повторов');
  });

  it('каждый вызов профиля — в пределах Telegram на каждом языке', () => {
    for (const [method, params] of profileCalls()) {
      const r = telegramReply(method, params, () => 1);
      assert.equal(r.status, 200, `${method} ${params.language_code ?? '-'}: ${r.body.description}`);
    }
    for (const lang of LANGUAGES) assert.ok(t(lang, 'setup.menuButton').length <= 20, `кнопка меню ${lang}`);
  });

  it('с какого вызова продолжить: не настроен — не нужен; другая версия — сначала; всё отправлено — не нужен', () => {
    const total = profileCalls().length;
    assert.equal(profileFrom({}), null);
    assert.equal(profileFrom({ base_url: 'x' }), 0);
    assert.equal(profileFrom({ base_url: 'x', bot_profile: 'old:' + total }), 0);
    assert.equal(profileFrom({ base_url: 'x', bot_profile: `${profileVersion()}:7` }), 7);
    assert.equal(profileFrom({ base_url: 'x', bot_profile: `${profileVersion()}:${total}` }), null);
  });

  it('/setup — сколько помещается, остальное — частями после обращений, без превышения бюджета; потом — ни одного вызова', async () => {
    const w = await startWorld();
    const total = profileCalls().length;
    const s = await w.setup(undefined, { profile: true });
    const sent = () => w.calls.filter((c) => ['setMyCommands', 'setMyDescription', 'setMyShortDescription'].includes(c.method) && !c.params.scope);
    const mark = () => w.query("SELECT value FROM settings WHERE key = 'bot_profile'")[0]?.value;
    assert.ok(sent().length > 0 && sent().length <= total);
    assert.equal(mark(), `${profileVersion()}:${sent().length}`);
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    for (let i = 0; i < 5 && mark() !== `${profileVersion()}:${total}`; i++) await w.api(boss, 'me');
    assert.equal(mark(), `${profileVersion()}:${total}`, 'профиль отправлен целиком');
    assert.deepEqual(sent().map((c) => [c.method, c.params]), profileCalls(), 'все вызовы по порядку, каждый один раз');
    const before = w.calls.length;
    await w.api(boss, 'me');
    await w.say(boss, '/start');
    assert.equal(w.calls.slice(before).filter((c) => /^setMy/.test(c.method)).length, 0, 'после — ни одного');
    assert.deepEqual(w.log().filter((l) => l.includes('budget exceeded')), []);
    // Страница /setup говорит, что остальное уйдёт позже
    if (total > 40) assert.match(s.html, new RegExp(t('ru', 'setup.profileLater')));
  });

  it('ошибка вызова — дальше по списку, место записано', async () => {
    const w = await startWorld();
    const env = metered({ DB: w.DB, BOT_TOKEN: 'x', TG_API: 'http://nowhere.test' });
    const log = console.log;
    const lines = [];
    console.log = (...a) => lines.push(a.join(' '));
    let r;
    try {
      r = await sendProfile(env, 0);
    } finally {
      console.log = log;
    }
    assert.ok(lines.some((l) => l.startsWith('bot profile: setMyCommands')), 'ошибка — в журнале Worker');
    assert.equal(r.ok, 0);
    assert.ok(r.next > 3, 'не остановился на первой ошибке');
    assert.equal(w.query("SELECT value FROM settings WHERE key = 'bot_profile'")[0].value, `${profileVersion()}:${r.next}`);
    assert.ok(env.meter.used <= 50);
  });
});

describe('журнал на языке смотрящего (US5)', () => {
  it('новые записи — на языке организатора, прежние — как записаны; длинная подробность — только русской строкой', async () => {
    const { w, E, code } = await bossWorld();
    const [a] = OTHERS;
    const ivan = { id: 9241, name: 'Ivan', username: 'ivan' };
    await join(w, code, ivan);
    await w.api(boss, 'admin.rename', { event: E, id: ivan.id, name: 'Ivan B' });
    await w.api(boss, 'admin.ring', { event: E, on: true });
    const rows = w.query('SELECT details, details_tx FROM audit WHERE event_id = ? AND details_tx != ?', E, '');
    assert.ok(rows.length >= 1, 'новые записи хранят отложенный текст');
    w.query("INSERT INTO audit (event_id, company_id, actor, action, details, details_tx, created_at) VALUES (?, 1, 0, 'game', 'старая запись', '', 1)", E);
    const ru = (await w.api(boss, 'admin.audit', { event: E })).entries;
    await w.api(boss, 'lang.set', { lang: a });
    const other = (await w.api(boss, 'admin.audit', { event: E })).entries;
    assert.equal(ru.length, other.length);
    assert.ok(ru.every((e) => !('details_tx' in e)), 'служебная колонка не уходит наружу');
    const stored = new Map(w.query('SELECT id, details, details_tx FROM audit WHERE event_id = ?', E).map((r) => [r.id, r]));
    for (const [i, e] of other.entries()) {
      const row = stored.get(e.id);
      assert.equal(ru[i].details, row.details, 'русскому — как записано');
      if (row.details_tx) assert.ok(!CYRILLIC.test(e.details), `${e.action}: ${e.details}`);
      else assert.equal(e.details, row.details, 'прежняя запись — как была');
    }
    // Подробность длиннее предела отложенного текста — только русская строка
    await auditStmt(w.DB, E, 0, 'x', tx('events.deleted', { title: 'y'.repeat(3000) })).run();
    const long = w.query("SELECT details, details_tx FROM audit WHERE action = 'x'")[0];
    assert.equal(long.details_tx, '');
    assert.equal(long.details.length, 500);
    const short = await auditStmt(w.DB, E, 0, 'y', tx('events.deleted', { title: 'Party' })).run();
    assert.ok(short);
    const row = w.query("SELECT details, details_tx FROM audit WHERE action = 'y'")[0];
    assert.deepEqual(JSON.parse(row.details_tx), JSON.parse(JSON.stringify(tx('events.deleted', { title: 'Party' }))));
    assert.equal(row.details, t('ru', 'events.deleted', { title: 'Party' }));
  });
});

// Игра целиком на каждом языке (SC-002): Анна с языком Telegram — всё, что получает она (ответы API, ответы и сообщения
// бота, кнопки, отказы), без кириллицы; сообщения с текстом 4000 символов помещаются в Telegram; русским — по-русски
describe('игра целиком на каждом языке (US1, US3)', () => {
  for (const lang of OTHERS) {
    it(lang, async () => {
      const anna = { id: 9302, name: 'Anna', username: 'anna', language_code: lang };
      const bob = { id: 9303, name: 'Bob', username: 'bob' };
      const carl = { id: 9304, name: 'Carl', username: 'carl', language_code: 'en' };
      const dina = { id: 9305, name: 'Dina', username: 'dina', language_code: 'uk' };
      const people = [boss, anna, bob, carl, dina];
      const { w, E, code } = await bossWorld();
      const problems = [];
      const own = (id) => langOf(w.query('SELECT lang, tg_lang FROM users WHERE tg_id = ?', id)[0]);
      async function step(label, fn, presser) {
        const from = w.calls.length;
        const result = await fn();
        for (const c of w.calls.slice(from)) {
          if (c.method === 'sendMessage' && visibleLength(c.params) > 4096) problems.push(`${label}: длиннее 4096 → ${c.params.chat_id}`);
        }
        const foreign = new Set(people.filter((u) => own(u.id) !== 'ru').map((u) => u.id));
        for (const p of foreignProblems(w.calls.slice(from), presser, foreign)) problems.push(`${label}: ${p}`);
        return result;
      }
      async function call(u, action, body = {}) {
        const r = await step(`${u.name} ${action}`, () => w.api(u, action, body, true));
        const { languages, texts, ...data } = r.data;
        if (own(u.id) !== 'ru' && CYRILLIC.test(JSON.stringify(data))) problems.push(`${action} → ${u.name}: кириллица: ${JSON.stringify(data).slice(0, 200)}`);
        if (texts && own(u.id) !== 'ru' && CYRILLIC.test(JSON.stringify(texts))) problems.push(`${action} → ${u.name}: словарь с кириллицей`);
        return r;
      }
      const say = (u, text) => step(`${u.name} «${text.slice(0, 20)}»`, () => w.say(u, text));
      const press = (u, data) => step(`${u.name} ${data}`, () => w.press(u, data), u);
      const pairOf = (col, id) => w.query(`SELECT santa, ward FROM pairs WHERE event_id = ? AND ${col} = ?`, E, id)[0];
      const person = (id) => people.find((u) => u.id === id);
      const LONG = 'x'.repeat(4000);
      for (const u of [anna, bob, carl, dina]) {
        await say(u, '/start ' + code);
        await say(u, u.name);
      }
      await call(anna, 'me');
      await call(anna, 'event.get', { event: E });
      await call(anna, 'wishlist.save', { event: E, text: 'Books' });
      for (const u of [bob, carl, dina]) await call(u, 'wishlist.save', { event: E, text: 'Socks' });
      await call(anna, 'admin.state', { event: E });
      await call(anna, 'event.leave', { event: E, confirm: 'NO' });
      await call(anna, 'support.send', { event: E, text: LONG });
      const thread = w.query('SELECT id FROM support_threads WHERE event_id = ? AND user_id = ?', E, anna.id)[0].id;
      await call(boss, 'admin.support.send', { event: E, thread, text: LONG });
      await say(anna, 'hello');
      await say(anna, '/language');
      await call(boss, 'admin.draw.check', { event: E });
      await call(boss, 'admin.draw', { event: E });
      await call(anna, 'ward.get', { event: E });
      await call(anna, 'message.send', { event: E, to: 'ward', text: LONG });
      const santa = person(pairOf('ward', anna.id).santa);
      await call(santa, 'message.send', { event: E, to: 'ward', text: LONG });
      await call(anna, 'chat.get', { event: E, with: 'santa' });
      await press(anna, `msg:ward:${E}`);
      await say(anna, 'From the bot');
      await call(person(pairOf('santa', anna.id).ward), 'wishlist.save', { event: E, text: 'Tea' });
      await step('cron', () => w.cron());
      await call(boss, 'admin.announce', { event: E, text: LONG });
      await call(boss, 'admin.remind.santas', { event: E });
      await call(anna, 'ward.gift', { event: E, ready: true });
      await call(anna, 'ward.received', { event: E, received: true });
      await press(anna, `sup:u:${E}`);
      await call(boss, 'admin.reveal', { event: E });
      await call(boss, 'admin.event.finish', { event: E });
      await call(anna, 'wishlist.save', { event: E, text: 'Late' });
      await press(anna, 'notify');
      await press(anna, 'nm:silent');
      await press(anna, 'nonsense:1');
      assert.deepEqual(problems, []);
      assert.ok(w.texts(anna).length >= 8, `Анне сообщений: ${w.texts(anna).length}`);
      assert.ok(w.texts(boss).some((x) => CYRILLIC.test(x)), 'организатору — по-русски');
      assert.ok(w.texts(dina).every((x) => !x.includes('Santa') || CYRILLIC.test(x)), 'украинскому Telegram — по-русски');
      assert.ok(w.texts(anna).some((x) => x.includes(LONG)), 'длинное сообщение дошло');
    });
  }
});

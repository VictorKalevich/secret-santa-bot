// Словарь (060): правила сборки текста, формы числа, отложенный текст, язык человека, словарь приложения. Контракт —
// specs/060-i18n-dictionary/contracts/i18n.md (разделы 1–3, 6). У каждого правила — проверка «от противного».
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  t, tl, tx, tdate, tjoin, render, langOf, appTexts, bootTexts, translator, slotsOf, formatDate, formatMs,
  DEFAULT_LANG, DICTIONARIES,
} from '../src/i18n/index.js';
import { escapeHtml, ownerWord } from '../src/format.js';

// Ошибки словаря (console.error «i18n: …») — собрать, а не печатать
function errorsOf(fn) {
  const real = console.error;
  const seen = [];
  console.error = (...a) => seen.push(a.join(' '));
  try {
    return { value: fn(), errors: seen };
  } finally {
    console.error = real;
  }
}

// Служебный язык zz со своими текстами — только на время проверки
function withLang(server, app = {}, extra = {}) {
  DICTIONARIES.zz = { server, app, ...extra };
}
afterEach(() => {
  delete DICTIONARIES.zz;
});

// Прежнее правило приложения (до 060): одна из трёх форм по числу
function oldPlural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

describe('t: подстановки и отсутствующие ключи', () => {
  it('подстановка, форма из набора форм, вложенный отложенный текст', () => {
    withLang({ 'x.hello': 'Привет, {name}!', 'x.who': 'Может только {owner.nom}.', 'x.wrap': '«{inner}»', 'x.inner': 'внутри {v}' });
    assert.equal(t('zz', 'x.hello', { name: 'Аня' }), 'Привет, Аня!');
    assert.equal(t('zz', 'x.who', { owner: ownerWord(true) }), 'Может только владелец бота.');
    assert.equal(t('zz', 'x.who', { owner: ownerWord(false) }), 'Может только владелец.');
    assert.equal(t('zz', 'x.wrap', { inner: tx('x.inner', { v: 1 }) }), '«внутри 1»');
  });

  it('нет ключа у языка — русский текст; нет и у русского — сам ключ и ошибка', () => {
    withLang({});
    const { value, errors } = errorsOf(() => t('zz', 'common.noDraw'));
    assert.equal(value, t(DEFAULT_LANG, 'common.noDraw'));
    assert.deepEqual(errors, []);
    const missing = errorsOf(() => t('zz', 'x.none'));
    assert.equal(missing.value, 'x.none');
    assert.deepEqual(missing.errors, ['i18n: нет ключа x.none']);
  });

  it('от противного: нехватка и лишняя подстановка, форма без набора — ошибка с ключом', () => {
    withLang({ 'x.hello': 'Привет, {name}!', 'x.who': 'Может только {owner.nom}.' });
    const lack = errorsOf(() => t('zz', 'x.hello', {}));
    assert.equal(lack.value, 'Привет, {name}!');
    assert.deepEqual(lack.errors, ['i18n: x.hello: нет подстановки name']);
    const extra = errorsOf(() => t('zz', 'x.hello', { name: 'Аня', age: 3 }));
    assert.equal(extra.value, 'Привет, Аня!');
    assert.deepEqual(extra.errors, ['i18n: x.hello: лишняя подстановка age']);
    const form = errorsOf(() => t('zz', 'x.who', { owner: 'владелец' }));
    assert.deepEqual(form.errors, ['i18n: x.who: нет подстановки owner.nom']);
  });

  it('список: tl — значение, t по списку и tl по тексту — ошибки', () => {
    assert.equal(tl(DEFAULT_LANG, 'common.monthsGen').length, 12);
    assert.match(errorsOf(() => t(DEFAULT_LANG, 'common.monthsGen')).errors[0], /common\.monthsGen — список/);
    assert.deepEqual(errorsOf(() => tl(DEFAULT_LANG, 'common.noDraw')).value, []);
  });

  it('translator — ctx.t одного языка', () => {
    const tr = translator(DEFAULT_LANG);
    assert.equal(tr.lang, DEFAULT_LANG);
    assert.equal(tr('common.noDraw'), t(DEFAULT_LANG, 'common.noDraw'));
    assert.equal(tr.list('common.monthsGen')[0], 'января');
  });
});

describe('формы числа', () => {
  it('ru: one/few/many по Intl = прежнее правило приложения на 0–1000', () => {
    withLang({ 'x.n': { one: '{n} человек-1', few: '{n} человека', many: '{n} человек' } }, {}, { plural: 'ru' });
    for (let n = 0; n <= 1000; n++) {
      assert.equal(t('zz', 'x.n', { n }), `${n} ` + oldPlural(n, 'человек-1', 'человека', 'человек'), String(n));
    }
  });

  it('от противного: набор форм без n — ошибка; n не лишняя подстановка у набора', () => {
    withLang({ 'x.n': { one: 'один', few: 'несколько', many: 'много' } }, {}, { plural: 'ru' });
    assert.deepEqual(errorsOf(() => t('zz', 'x.n', { n: 5 })).errors, []);
    assert.deepEqual(errorsOf(() => t('zz', 'x.n')).errors, ['i18n: x.n: у набора форм нет числа n']);
  });

  it('slotsOf — имена подстановок текста и набора форм', () => {
    assert.deepEqual([...slotsOf('{a} и {b.nom}')], ['a', 'b']);
    assert.deepEqual([...slotsOf({ one: '{n} {x}', many: '{n}' })].sort(), ['n', 'x']);
    assert.deepEqual([...slotsOf(['{a}'])], []);
  });
});

describe('отложенный текст: render', () => {
  it('строки и числа — как есть, $t/$d/$j/$h — собираются, вложенность и кнопки', () => {
    const payload = {
      text: tx('common.notMember'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: tx('common.openApp'), web_app: { url: 'https://x/app' } }]] },
      n: 3,
      date: tdate('2026-12-31'),
      ms: tdate(Date.UTC(2026, 0, 1, 22), 3),
      list: tjoin('\n', ['а', tx('common.noDraw')]),
      html: escapeHtml(tx('x.raw')),
    };
    withLang({ 'x.raw': '<b>&</b>' });
    const out = render(payload, 'zz');
    assert.deepEqual(out, {
      text: t(DEFAULT_LANG, 'common.notMember'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🎁 Открыть приложение', web_app: { url: 'https://x/app' } }]] },
      n: 3,
      date: '31 декабря',
      ms: '2 января',
      list: 'а\n' + t(DEFAULT_LANG, 'common.noDraw'),
      html: '&lt;b&gt;&amp;&lt;/b&gt;',
    });
    assert.equal(render('готовый текст', 'zz'), 'готовый текст');
    assert.equal(escapeHtml('<i>'), '&lt;i&gt;');
  });

  it('дата — по словарю языка: формат и месяцы', () => {
    withLang({ 'common.date': '{month} {day}', 'common.monthsGen': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] });
    assert.equal(formatDate('2026-11-25', 'zz'), 'Nov 25');
    assert.equal(formatMs(Date.UTC(2026, 10, 24, 22), 3, 'zz'), 'Nov 25');
    assert.equal(formatDate('2026-11-25'), '25 ноября');
    assert.equal(formatDate('не дата'), 'не дата');
  });

  it('от противного: отложенный текст без render ушёл бы объектом', () => {
    assert.notEqual(JSON.stringify({ text: tx('common.noDraw') }), JSON.stringify(render({ text: tx('common.noDraw') }, DEFAULT_LANG)));
  });
});

describe('язык человека и словарь приложения', () => {
  it('langOf: пусто, неизвестный — язык по умолчанию; известный — свой', () => {
    withLang({});
    assert.equal(langOf(null), DEFAULT_LANG);
    assert.equal(langOf({ lang: '' }), DEFAULT_LANG);
    assert.equal(langOf({ lang: 'qq' }), DEFAULT_LANG);
    assert.equal(langOf({ lang: 'constructor' }), DEFAULT_LANG);
    assert.equal(langOf({ lang: 'zz' }), 'zz');
  });

  it('appTexts: только app.*, версия от содержимого, один объект на язык; bootTexts — только app.boot.*', () => {
    const a = appTexts(DEFAULT_LANG);
    assert.ok(Object.keys(a.texts).length > 0);
    assert.ok(Object.keys(a.texts).every((k) => k.startsWith('app.')));
    assert.match(a.version, /^ru:[0-9a-f]{8}$/);
    assert.equal(appTexts(DEFAULT_LANG), a, 'один объект на экземпляр');
    const boot = bootTexts(DEFAULT_LANG);
    assert.ok(Object.keys(boot).length > 0 && Object.keys(boot).every((k) => k.startsWith('app.boot.')));
  });

  it('от противного: другой словарь — другая версия; нет ключа у языка — русский текст', () => {
    withLang({}, { 'app.boot.title': 'Secret Santa' });
    const zz = appTexts('zz');
    assert.notEqual(zz.version.slice(3), appTexts(DEFAULT_LANG).version.slice(3));
    assert.equal(zz.texts['app.boot.title'], 'Secret Santa');
    assert.equal(zz.texts['app.boot.loading'], appTexts(DEFAULT_LANG).texts['app.boot.loading']);
  });
});

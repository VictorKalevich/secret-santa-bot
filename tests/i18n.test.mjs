// Словарь (060): правила сборки текста, формы числа, отложенный текст, язык человека, словарь приложения; правила
// словаря по исходникам (R9) и сверка сборки в приложении. Контракт — specs/060-i18n-dictionary/contracts/i18n.md.
// У каждого правила — проверка «от противного».
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  t, tl, tx, tdate, tjoin, render, langOf, appTexts, bootTexts, translator, slotsOf, formatDate, formatMs,
  DEFAULT_LANG, DICTIONARIES, LANGUAGES,
} from '../src/i18n/index.js';
import { escapeHtml, ownerWord } from '../src/format.js';
import { readdirSync } from 'node:fs';
import {
  read, codeFiles, cyrillicLines, keysIn, dictionary, prefixProblems, missingKeys, unusedKeys, callParams,
} from './support/i18n-rules.mjs';
import { APP } from './support/app-source.mjs';
import { PSEUDO, pseudoLanguage } from './support/pseudo.mjs';

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

// ---------- правила словаря по исходникам (R9, T033–T035) ----------

describe('кириллица — только в словарях (T033)', () => {
  // Файлы с текстами для людей: модули сервера, части приложения, модуль словаря и общий код дизайн-системы в странице
  const FILES = [...codeFiles(), 'design-system/clearable-input.js.txt'];

  it('вне комментариев, new Error(…), console.*(…) и ошибок словаря — ни одной строки с кириллицей', () => {
    assert.deepEqual(FILES.flatMap((f) => cyrillicLines(f)), []);
  });

  it('от противного: текст в части и в модуле — нарушение; комментарий, new Error и console — нет', () => {
    const part = "  // Подпись кнопки\n  ui.btn('Сохранить', save);\n  /* «Отмена» */ ui.btn(t('app.core.cancel'));\n";
    assert.deepEqual(cyrillicLines('src/app/x.js.txt', part), ["src/app/x.js.txt:2: ui.btn('Сохранить', save);"]);
    const mod = "throw new Error('Нет базы');\nconsole.error('сбой', e);\nreturn no('Событие не найдено.');\n";
    assert.deepEqual(cyrillicLines('src/x.js', mod), ["src/x.js:3: return no('Событие не найдено.');"]);
    assert.deepEqual(cyrillicLines('x.html', '<!-- Заголовок -->\n<title></title>\n'), []);
  });
});

describe('ключи словаря (T034)', () => {
  const dict = dictionary();

  it('ключи вызовов есть в словаре, у семейств есть ключи; ключ — из области своего файла', () => {
    assert.deepEqual(missingKeys(codeFiles(), dict), []);
    assert.deepEqual(prefixProblems(), []);
  });

  it('каждый ключ словаря используется: вызовом, строкой таблицы или членом семейства', () => {
    assert.deepEqual(unusedKeys(codeFiles(), dict), []);
  });

  it('от противного: вызов неизвестного ключа, семейство без ключей, неиспользуемый ключ', () => {
    const src = "t('app.core.noSuchKey'); tx('pairs.noFamily.' + type); t('common.noDraw');";
    const { called, families } = keysIn(src);
    assert.deepEqual([...called], ['app.core.noSuchKey', 'common.noDraw']);
    assert.deepEqual([...families], ['pairs.noFamily.']);
    assert.ok(!dict.has('app.core.noSuchKey'));
    assert.ok(![...dict.keys()].some((k) => k.startsWith('pairs.noFamily.')));
    const only = new Map([['common.noDraw', dict.get('common.noDraw')], ['common.unused', { file: 'x', value: 'x' }]]);
    assert.equal(unusedKeys([], only).length, 2);
    assert.ok(keysIn("x = 'common.noDraw';").literals.has('common.noDraw'), 'строка таблицы — использование');
  });
});

// Ожидаемые подстановки текста и найденные в вызове → описание расхождения или null
function slotMismatch(value, names) {
  const slots = slotsOf(value);
  const plural = !!value && typeof value === 'object' && !Array.isArray(value);
  const extra = [...names].filter((x) => !slots.has(x) && !(x === 'n' && plural));
  const lack = [...slots].filter((x) => !names.has(x));
  if (plural && !names.has('n') && !lack.includes('n')) lack.push('n');
  return extra.length || lack.length ? `лишние: ${extra.join(', ') || '—'}; нет: ${lack.join(', ') || '—'}` : null;
}

describe('подстановки, формы, файлы (T035)', () => {
  const dict = dictionary();

  it('у вызова с ключом и литералом объекта имена подстановок = подстановки текста', () => {
    const found = [];
    for (const f of codeFiles()) {
      for (const c of callParams(read(f))) {
        if (!dict.has(c.key) || c.names === null) continue;
        const bad = slotMismatch(dict.get(c.key).value, c.names);
        if (bad) found.push(`${f}:${c.line} ${c.key} — ${bad}`);
      }
    }
    assert.deepEqual(found, []);
  });

  it('набор форм — все категории русского языка на 0–1000, в каждой форме число {n}', () => {
    const rules = new Intl.PluralRules(DEFAULT_LANG);
    const categories = new Set(Array.from({ length: 1001 }, (_, n) => rules.select(n)));
    const found = [];
    for (const [key, { value }] of dict) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      for (const c of categories) if (typeof value[c] !== 'string') found.push(`${key}: нет формы ${c}`);
      for (const [c, text] of Object.entries(value)) if (!/\{n\}/.test(text)) found.push(`${key}.${c}: нет {n}`);
    }
    assert.deepEqual(found, []);
  });

  it('значения непустые; у каждого языка тот же набор файлов, что у русского', () => {
    const blank = (v) => !String(v).trim();
    const empty = [...dict].filter(([, { value }]) => (Array.isArray(value) ? !value.length || value.some(blank)
      : typeof value === 'object' ? Object.values(value).some(blank) : blank(value))).map(([k]) => k);
    assert.deepEqual(empty, []);
    const files = (lang) => readdirSync(new URL(`../src/i18n/${lang}/`, import.meta.url)).sort();
    for (const lang of LANGUAGES) assert.deepEqual(files(lang), files(DEFAULT_LANG), lang);
  });

  it('от противного: лишняя и недостающая подстановка, набор форм без числа', () => {
    assert.equal(slotMismatch('Привет, {name}!', new Set(['name'])), null);
    assert.equal(slotMismatch('Привет, {name}!', new Set(['nmae'])), 'лишние: nmae; нет: name');
    assert.equal(slotMismatch({ one: '{n} день', few: '{n} дня', many: '{n} дней' }, new Set()), 'лишние: —; нет: n');
    assert.deepEqual(callParams("t('a.b', { a, b: f(1, { c: 2 }), 'd': '}', e: 'x' }); t('a.c'); tx('a.d', p); t('a.e', { ...o })")
      .map((c) => [c.key, c.names && [...c.names]]), [['a.b', ['a', 'b', 'd', 'e']], ['a.c', []], ['a.d', null], ['a.e', null]]);
  });
});

// Ядро словаря приложения из склейки (02-core): t, tl, setTexts — для сверки с сервером
function appDictionary() {
  const from = APP.indexOf('  const BOOT_TEXTS');
  const to = APP.indexOf('  // ---------- утилиты', from);
  assert.ok(from > 0 && to > from, 'в склейке нет блока словаря');
  const errors = [];
  const make = Function('state', 'document', 'console', APP.slice(from, to) + '\nreturn { t, tl, setTexts };');
  const core = make({}, { documentElement: {} }, { error: (m) => errors.push(m) });
  return { ...core, errors };
}

// Подстановки для сверки: обычная — строка, с формой ({owner.nom}) — набор форм, у набора форм числа — n
function sampleParams(value, n) {
  const params = {};
  const texts = typeof value === 'string' ? [value] : Object.values(value);
  for (const text of texts) {
    for (const m of text.matchAll(/\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g)) {
      if (m[2]) params[m[1]] = { ...params[m[1]], [m[2]]: `<${m[1]}.${m[2]}>` };
      else if (m[1] !== 'n') params[m[1]] = `<${m[1]}>`;
    }
  }
  if (typeof value === 'object' || texts.some((x) => x.includes('{n}'))) params.n = n;
  return params;
}

describe('приложение собирает текст так же, как сервер (T035)', () => {
  for (const lang of [DEFAULT_LANG, PSEUDO]) {
    it(`все ключи app.* (${lang}): t приложения = t сервера`, () => {
      const drop = lang === PSEUDO ? pseudoLanguage() : () => {};
      try {
        const app = appDictionary();
        const { texts, version } = appTexts(lang);
        app.setTexts({ lang, texts, texts_version: version });
        const diff = [];
        for (const [key, value] of Object.entries(texts)) {
          if (Array.isArray(value)) {
            if (JSON.stringify(app.tl(key)) !== JSON.stringify(tl(lang, key))) diff.push(key);
            continue;
          }
          for (const n of typeof value === 'object' ? [0, 1, 2, 5, 11, 21, 22, 25, 101, 1000] : [7]) {
            const params = sampleParams(value, n);
            const want = t(lang, key, params);
            const got = app.t(key, params);
            if (got !== want) diff.push(`${key} (n=${n}): ${got} ≠ ${want}`);
          }
        }
        assert.deepEqual(diff, []);
        assert.deepEqual(app.errors, []);
      } finally {
        drop();
      }
    });
  }

  it('от противного: другой словарь у приложения — расхождение замечено', () => {
    const app = appDictionary();
    const { texts } = appTexts(DEFAULT_LANG);
    app.setTexts({ lang: DEFAULT_LANG, texts: { ...texts, 'app.boot.loading': 'Иначе' } });
    assert.notEqual(app.t('app.boot.loading'), t(DEFAULT_LANG, 'app.boot.loading'));
  });
});

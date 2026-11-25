// 053 (контракт specs/053-donate-block/contracts/donate-block.md, раздел 6): блок «Нравится бот?» на «Инфо» — правила по
// склейке и дизайн-системе. Поведение в Chrome (открытый и закрытый бот, порядок разделов, openLink) — checkDonate в
// tests/screenshots.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP, where, code, topBlock, ownerOf } from './support/app-source.mjs';
import { appTexts, DEFAULT_LANG } from '../src/i18n/index.js';

const DONATE = 'https://dalink.to/trivial_no';
// 060: тексты — в словаре: [вызов в donateSection, ключ, текст словаря]; значок — в коде
const TEXTS = [
  ["ui.section(t('app.event.donate.section'))", 'app.event.donate.section', 'Нравится бот?'],
  ["t('app.event.donate.title')", 'app.event.donate.title', 'Поддержать проект'],
  ["t('app.event.donate.text')", 'app.event.donate.text',
    'Бот полностью бесплатный. Если он оказался вам полезен, вы можете поддержать его развитие и дальнейшее улучшение.'],
  ["t('app.event.donate.button')", 'app.event.donate.button', '❤️ Поддержать через DonationAlerts'],
  ["t('app.event.donate.note')", 'app.event.donate.note', 'Любая сумма имеет значение. Спасибо!'],
];
const ICON = "'☕'";
const APP_DICT = appTexts(DEFAULT_LANG).texts;
const ds = (file) => readFileSync(new URL(`../design-system/${file}`, import.meta.url), 'utf8');
const DS = { tokens: ds('tokens.css'), components: ds('components.css'), preview: ds('preview.html'), readme: ds('README.md') };

const body = (lines, name) => {
  const b = topBlock(lines, name);
  return b ? lines.slice(b[0], b[1] + 1).map(code) : [];
};

// Правила 1–5 по склейке и словарю dict: имя правила → нарушения ([] — правило выполнено)
function appRules(app, dict = APP_DICT) {
  const lines = app.split('\n');
  const owner = (i) => ownerOf(lines, i).name;
  const bad = (re, allowed) => lines.flatMap((l, i) => (re.test(code(l)) && !allowed.includes(owner(i)) ? [where(i + 1)] : []));
  const donate = body(lines, 'donateSection');
  const info = body(lines, 'renderInfo');
  const at = (re) => info.findIndex((l) => re.test(l));
  const call = at(/\.\.\.donateSection\(\)/);
  const web = body(lines, 'openWebLink').join('\n');
  return {
    url: lines.flatMap((l, i) => (l.includes(DONATE) && !/^ {2}const DONATE_URL = 'https:\/\/dalink\.to\/trivial_no';$/.test(l) ? [where(i + 1)] : []))
      .concat(lines.filter((l) => /^ {2}const DONATE_URL = /.test(l)).length === 1 ? [] : ['DONATE_URL объявлен не один раз']),
    builder: bad(/ds-donate|ds-btn--donate|ui\.btn\([^)]*'donate'|\bDONATE_URL\b(?! = )/, ['donateSection']),
    texts: TEXTS.filter(([use, key, text]) => !donate.some((l) => l.includes(use)) || dict[key] !== text).map(([use]) => use)
      .concat(donate.some((l) => l.includes(ICON)) ? [] : [ICON]),
    open: donate[1] && /^\s*if \(!state\.open\) return \[\];$/.test(donate[1]) ? [] : ['donateSection: первая проверка — не state.open'],
    place: call > at(/t\('app\.event\.info\.notMember'\)/) && call > at(/ui\.section\(t\('app\.event\.support\.section'\)\)/)
      && call < at(/ui\.section\(t\('app\.event\.how\.title'\)\)/)
      // 063: и в «О боте» «Настроек» — ровно два вызова
      && lines.filter((l) => /\.\.\.donateSection\(\)/.test(code(l))).length === 2
      && body(lines, 'aboutSections').some((l) => /\.\.\.donateSection\(\)/.test(code(l))) ? [] : ['renderInfo: donateSection() не на своём месте'],
    link: (donate.some((l) => /openWebLink\(DONATE_URL\)/.test(l)) ? [] : ['кнопка открывает ссылку не через openWebLink'])
      .concat(/if \(tg && tg\.openLink\) tg\.openLink\(url\); else window\.open\(url, '_blank', 'noopener'\);/.test(web) ? [] : ['openWebLink: не openLink / window.open'])
      .concat(bad(/\.openLink\(|window\.open\(/, ['openWebLink', 'openTgLink'])),
  };
}

// Правило 6: дизайн-система
function dsRules({ tokens, components, preview, readme }) {
  return {
    tokens: /--ds-color-donate:\s*#ed8224;/.test(tokens) && /--ds-color-on-donate:\s*#ffffff;/.test(tokens),
    button: /\.ds-btn--donate \{ background: var\(--ds-color-donate\); color: var\(--ds-color-on-donate\); \}/.test(components),
    card: /\.ds-donate \{[^}]*align-items: center;[^}]*text-align: center;/.test(components),
    preview: /class="ds-card ds-donate"/.test(preview) && /ds-btn--donate/.test(preview),
    readme: /`ds-donate`/.test(readme) && /`--donate`/.test(readme) && /`donate`/.test(readme),
  };
}

const CLEAN = { url: [], builder: [], texts: [], open: [], place: [], link: [] };

test('блок «Нравится бот?»: ссылка, строитель, тексты, только открытый бот, место, открытие ссылки (053)', () => {
  assert.deepEqual(appRules(APP), CLEAN);
});

test('от противного (053): каждое правило находит порчу склейки', () => {
  const spoil = (from, to) => {
    assert.ok(APP.includes(from), `в склейке нет «${from}»`);
    return appRules(APP.replace(from, to));
  };
  const broken = (rules) => Object.keys(rules).filter((k) => rules[k].length);
  assert.deepEqual(broken(appRules(APP + `\n  const other = '${DONATE}';\n`)), ['url']);
  assert.deepEqual(broken(appRules(APP + "\n  function elsewhere() {\n    return h('div', { class: 'ds-card ds-donate' });\n  }\n")), ['builder']);
  assert.deepEqual(broken(spoil("t('app.event.donate.note')", "'Спасибо!'")), ['texts']);
  assert.deepEqual(broken(appRules(APP, { ...APP_DICT, 'app.event.donate.note': 'Спасибо!' })), ['texts']);
  assert.deepEqual(broken(spoil("'☕'", "'🍵'")), ['texts']);
  assert.deepEqual(broken(spoil('    if (!state.open) return [];\n', '')), ['open']);
  assert.deepEqual(broken(spoil('    nodes.push(...donateSection());\n', '')), ['place']);
  assert.deepEqual(broken(spoil("ui.section(t('app.event.how.title')),", "ui.section(t('app.event.how.title')), ...donateSection(),")), ['place']);
  assert.deepEqual(broken(spoil("howItWorks(), ...donateSection()]", "howItWorks()]")), ['place']);
  assert.deepEqual(broken(spoil('openWebLink(DONATE_URL)', 'window.open(DONATE_URL)')), ['link']);
  assert.deepEqual(broken(spoil("else window.open(url, '_blank', 'noopener');", "else location.href = url;")), ['link']);
});

test('дизайн-система: токены DonationAlerts, вариант кнопки, карточка, витрина и README (053)', () => {
  const all = { tokens: true, button: true, card: true, preview: true, readme: true };
  assert.deepEqual(dsRules(DS), all);
  // от противного
  assert.deepEqual(dsRules({ ...DS, tokens: DS.tokens.replace('--ds-color-donate: #ed8224;', '--ds-color-donate: #2481cc;') }), { ...all, tokens: false });
  assert.deepEqual(dsRules({ ...DS, components: DS.components.replace('background: var(--ds-color-donate)', 'background: var(--ds-color-accent)') }), { ...all, button: false });
  assert.deepEqual(dsRules({ ...DS, preview: DS.preview.replace('class="ds-card ds-donate"', 'class="ds-card"') }), { ...all, preview: false });
});

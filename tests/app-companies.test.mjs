// 051 (контракт specs/051-companies/contracts/companies.md, раздел 5): мини-приложение и компании — правила по склейке.
// Общие действия организатора — только через capi (компания открытого экрана); права в компании (state.me.is_admin,
// is_owner) пишет только enterCompany; корневой экран — «Компании» при двух и больше, иначе главный экран единственной;
// слово «комната» (059; прежде «компания») — только в части 04-companies и в перечисленных местах (FR-5127); часть
// 04-companies — в APP_PARTS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, PARTS, where, code, topBlock, ownerOf } from './support/app-source.mjs';

// Общие действия организатора (050, раздел 2): без события у них есть поле company
const COMMON = ['admin.events.create', 'admin.families', 'admin.family.save', 'admin.family.delete', 'admin.audit',
  'admin.users', 'admin.rename', 'admin.transfer', 'admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer'];

// Вызовы api('<общее действие>' — кроме журнала события (api('admin.audit', { event: … }))
function plainApiCalls(text) {
  const found = [];
  text.split('\n').forEach((line, i) => {
    for (const m of code(line).matchAll(/\bapi\('([\w.]+)'(,\s*\{\s*event\b)?/g)) {
      if (COMMON.includes(m[1]) && !(m[1] === 'admin.audit' && m[2])) found.push([i + 1, m[1]]);
    }
  });
  return found;
}

// Присваивания прав человека вне enterCompany
function roleWrites(text) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((line, i) => {
    if (/\b(?:state\.)?me\.is_(?:admin|owner)\s*=(?!=)/.test(code(line)) && ownerOf(lines, i).name !== 'enterCompany') found.push(i + 1);
  });
  return found;
}

// Слово «комната» (059; до него — «компания») в текстах частей, кроме 04-companies и разрешённых мест: [часть, кусок
// строки]. Прежнее слово «компани…» вне комментариев — нигде, и в 04-companies
const COMPANY_WORD = [
  ['03-home.js.txt', 'Ты здесь как владелец бота: в списках комнаты'], // плашка гостя (владелец бота)
  ['03-home.js.txt', 'Твои изменения записываются в журнал комнаты'],
  ['03-home.js.txt', 'владельцем этой комнаты?'], // 👑 владельца бота
  ['07-vault-audit.js.txt', "'company.create': '🚪 Создана комната'"], // записи журнала бота
];
function companyWords(parts, allowed = COMPANY_WORD) {
  const found = [];
  for (const p of parts) {
    p.text.split('\n').forEach((line, i) => {
      const c = code(line);
      const room = /комнат/iu.test(c) && p.name !== '04-companies.js.txt'
        && !allowed.some(([name, part]) => name === p.name && c.includes(part));
      if (room || /компани/iu.test(c)) found.push(`src/app/${p.name}:${i + 1}`);
    });
  }
  return found;
}

// Выбор корневого экрана в start() и goRoot() (052): «Компании» — по listFirst (≥ 2 компаний или их нет, а список
// доступен), иначе вход в единственную; listFirst и withList — по одному определению с прежним смыслом
function rootRule(text) {
  const lines = text.split('\n');
  const body = (name) => {
    const found = topBlock(lines, name);
    return found ? lines.slice(found[0], found[1] + 1).map(code).join('\n') : '';
  };
  const start = body('start');
  return {
    companies: /if \(listFirst\(\)\) \{\s*state\.view = 'companies';/.test(start)
      && /return listFirst\(\) \? goCompanies\(\) :/.test(body('goRoot')),
    single: /enterCompany\(state\.companies\.length \? state\.companies\[0\]\.id : null\)/.test(start),
    listFirst: /^\s*const listFirst = \(\) => state\.companies\.length >= 2 \|\| \(!state\.companies\.length && withList\(\)\);$/m.test(body('listFirst')),
    withList: /^\s*const withList = \(\) => state\.companies\.length >= 2 \|\| state\.botOwner \|\| state\.open;$/m.test(body('withList')),
  };
}

// «‹» и «Назад» главного экрана компании — по withList (052): renderHome, goBack, syncBack
function backRule(text) {
  const lines = text.split('\n');
  const body = (name) => lines.slice(...topBlock(lines, name).map((x, i) => x + i)).map(code).join('\n');
  return {
    hero: /heroBack\.hidden = !withList\(\);/.test(body('renderHome')),
    back: /state\.view === 'home' && withList\(\)\) return goCompanies\(\)/.test(body('goBack')),
    system: /state\.view === 'home' && withList\(\)\)\) && !heroBack\.hidden/.test(body('syncBack')),
    tools: !/companiesTools\(/.test(body('renderHome')),
  };
}

test('общие действия организатора — только через capi (компания открытого экрана)', () => {
  assert.deepEqual(plainApiCalls(APP).map(([n, a]) => `${where(n)}: api('${a}')`), []);
  const capi = topBlock(APP.split('\n'), 'capi');
  assert.ok(capi, 'нет capi');
  assert.match(APP.split('\n').slice(capi[0], capi[1] + 1).join('\n'), /company: state\.companyId/);
  // от противного
  const bad = "    const load = () => api('admin.users').then(show);\n    api('admin.audit', { event: id });\n    api('admin.audit', {});";
  assert.deepEqual(plainApiCalls(bad), [[1, 'admin.users'], [3, 'admin.audit']]);
});

test('права в компании (state.me.is_admin, is_owner) пишет только enterCompany', () => {
  assert.deepEqual(roleWrites(APP).map(where), []);
  const lines = APP.split('\n');
  const [a, b] = topBlock(lines, 'enterCompany');
  const body = lines.slice(a, b + 1).join('\n');
  assert.match(body, /state\.me\.is_admin = c\.organizer/);
  assert.match(body, /state\.me\.is_owner = c\.owner/);
  // enterCompany зовут: reloadMe, открытие события (компания события), start
  assert.ok(lines.some((l) => /enterCompany\(state\.ev\.company\)/.test(code(l))), 'openEvent не выставляет компанию события');
  // от противного
  const bad = "  function renderX() {\n    state.me.is_admin = true;\n  }\n  function enterCompany(id) {\n    state.me.is_owner = id > 0;\n  }";
  assert.deepEqual(roleWrites(bad), [2]);
});

test('корневой экран: «Компании» при двух и больше или без компаний при доступном списке, иначе главный экран единственной', () => {
  const all = { companies: true, single: true, listFirst: true, withList: true };
  assert.deepEqual(rootRule(APP), all);
  // от противного
  assert.deepEqual(rootRule(APP.replace("if (listFirst()) {\n        state.view", "if (state.companies.length >= 2) {\n        state.view")),
    { ...all, companies: false });
  assert.deepEqual(rootRule(APP.replace('|| state.botOwner || state.open;', '|| state.botOwner;')), { ...all, withList: false });
});

test('«‹» главного экрана компании — по withList; раздела «Компании» на главном экране нет (052)', () => {
  assert.deepEqual(backRule(APP), { hero: true, back: true, system: true, tools: true });
  assert.deepEqual(backRule(APP.replace('heroBack.hidden = !withList();', 'heroBack.hidden = !many;')),
    { hero: false, back: true, system: true, tools: true }, 'от противного');
});

test('слово «комната» — только в части 04-companies и в разрешённых местах; «компания» — нигде (059)', () => {
  assert.deepEqual(companyWords(PARTS), []);
  // от противного: подсказка в событии, устаревший список, прежнее слово в 04-companies
  const bad = PARTS.map((p) => (p.name === '05-event.js.txt' ? { ...p, text: p.text + "    ui.hint('Событие комнаты');\n" } : p));
  assert.equal(companyWords(bad).length, 1);
  assert.equal(companyWords(PARTS, COMPANY_WORD.slice(1)).length, 1);
  const old = PARTS.map((p) => (p.name === '04-companies.js.txt' ? { ...p, text: p.text + "    ui.hint('Новая компания');\n" } : p));
  assert.equal(companyWords(old).length, 1);
});

test('часть 04-companies — в сборке между главным экраном и событием', () => {
  const names = PARTS.map((p) => p.name);
  assert.equal(names.indexOf('04-companies.js.txt'), names.indexOf('03-home.js.txt') + 1);
  assert.equal(names.indexOf('05-event.js.txt'), names.indexOf('04-companies.js.txt') + 1);
  const part = PARTS.find((p) => p.name === '04-companies.js.txt').text.split('\n');
  for (const fn of ['renderCompanies', 'companyRow', 'openLabelSheet', 'companiesTools', 'openCreateCompany', 'openCompanySheet', 'companyLinkCard', 'openBotOwnerSheet']) {
    assert.ok(topBlock(part, fn), `нет ${fn}`);
  }
});

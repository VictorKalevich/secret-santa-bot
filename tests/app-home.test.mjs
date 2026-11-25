// 063 (контракт specs/063-events-without-rooms/contracts/events-without-rooms.md, раздел 6): главный экран «Мои события» —
// правила по склейке. «Создать событие» — только в нижней панели и только при state.create; «Идут» — по дате вручения
// (без даты — в конце, при равных — новые первыми), «Завершённые» — свёрнутый ds-details; права события
// (state.me.is_admin, is_owner) пишет только enterEvent; экрана комнат нет — ни частей, ни действий компаний, ни capi;
// оболочка (shellTexts) до ответа me берёт только ключи app.boot.*.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, PARTS, where, code, topBlock, ownerOf } from './support/app-source.mjs';

const lines = APP.split('\n');
const body = (src, name) => {
  const ls = src.split('\n');
  const at = topBlock(ls, name);
  return at ? ls.slice(at[0], at[1] + 1).map(code).join('\n') : '';
};

// homeLists из склейки (чистая функция главного экрана); null — нет
function homeListsOf(src) {
  const text = body(src, 'homeLists');
  return text ? Function(`${text}\nreturn homeLists;`)() : null;
}

// Правила по склейке: имя → нарушения ([] — выполнено)
function rules(src) {
  const ls = src.split('\n');
  const home = body(src, 'renderHome');
  const bars = ls.flatMap((l, i) => (/ds-bottom-bar/.test(code(l)) ? [[i, ownerOf(ls, i).name]] : []));
  const creates = ls.flatMap((l, i) => (/t\('app\.home\.create\.button'\)/.test(code(l)) ? [ownerOf(ls, i).name] : []));
  const roleWrites = ls.flatMap((l, i) => (/\b(?:state\.)?me\.is_(?:admin|owner)\s*=(?!=)/.test(code(l)) && ownerOf(ls, i).name !== 'enterEvent'
    ? [where(i + 1)] : []));
  const rooms = ls.flatMap((l, i) => (/\bcapi\(|\bcompan(?:y|ies)\b|enterCompany|withList|listFirst|'(?:bot\.)?company\.|04-companies/.test(code(l))
    ? [where(i + 1)] : []));
  // Кнопка — внутри «if (state.create) {…}» renderHome (до закрывающей скобки того же отступа), панель — там же
  const hl = home.split('\n');
  const from = hl.findIndex((l) => /^ {4}if \(state\.create\) \{$/.test(l));
  const to = from < 0 ? -1 : hl.findIndex((l, i) => i > from && /^ {4}\}$/.test(l));
  const inside = to < 0 ? '' : hl.slice(from, to).join('\n');
  const guarded = ["t('app.home.create.button')", 'ds-bottom-bar', "classList.add('ds-page--bar')"].every((x) => inside.includes(x));
  return {
    bar: bars.length === 1 && bars[0][1] === 'renderHome' && creates.length === 1 && creates[0] === 'renderHome' && guarded
      ? [] : ['«Создать событие» — не в нижней панели renderHome при state.create'],
    finished: /h\('details', \{ class: 'ds-details[^']*' \}/.test(home) && /t\('app\.home\.done', \{ n: finished\.length \}\)/.test(home)
      && !/open: true/.test(home) ? [] : ['«Завершённые» — не свёрнутый ds-details с числом'],
    roles: roleWrites,
    rooms,
    // «Профиль», «Уведомления», язык и «Владелец бота» — в «Настройках» (⚙️), «Владелец и администраторы» — в событии
    settings: ['personalSections', 'botOwnerSections', 'adminOrganizers', "'app.settings."].filter((x) => home.includes(x))
      .concat(/heroAction\.hidden = false/.test(home) ? [] : ['⚙️ не показана'])
      .concat(/addEventListener\('click', \(\) => goSettings\(\)\)/.test(src) ? [] : ['⚙️ не ведёт в «Настройки»']),
    // Оболочку подписывает start() до ответа me — словаря ещё нет, только набор app.boot.* в странице
    boot: (body(src, 'shellTexts').match(/\bt\('[^']+'/g) || ['нет shellTexts']).filter((k) => !k.startsWith("t('app.boot.")),
  };
}
const CLEAN = { bar: [], finished: [], roles: [], rooms: [], settings: [], boot: [] };

const ev = (id, extra = {}) => ({ id, status: 'active', event_date: '', finished_at: 0, ...extra });
const ids = (list) => list.map((e) => e.id);

test('главный экран: «Создать событие» в нижней панели, «Завершённые» свёрнуты, права — enterEvent, комнат нет', () => {
  assert.deepEqual(rules(APP), CLEAN);
  assert.ok(!PARTS.some((p) => /compan/.test(p.name)), 'части компаний нет');
  assert.ok(PARTS.some((p) => p.name === '04-settings.js.txt'), 'часть «Настройки» — на месте 04');
});

test('порядок списков: «Идут» по дате вручения (без даты — в конце, новые первыми), «Завершённые» — недавно завершённые первыми', () => {
  const homeLists = homeListsOf(APP);
  assert.ok(homeLists, 'в склейке нет function homeLists(');
  const { active, finished } = homeLists([
    ev(1), ev(2, { event_date: '2026-12-31' }), ev(3, { event_date: '2026-12-25' }), ev(4), ev(5, { event_date: '2026-12-25' }),
    ev(6, { status: 'finished', finished_at: 100 }), ev(7, { status: 'finished', finished_at: 300 }), ev(8, { status: 'finished', finished_at: 200 }),
  ]);
  assert.deepEqual(ids(active), [5, 3, 2, 4, 1]);
  assert.deepEqual(ids(finished), [7, 8, 6]);
  assert.deepEqual(homeLists([]), { active: [], finished: [] });
});

test('от противного (063): каждое правило находит порчу склейки', () => {
  const spoil = (from, to) => {
    assert.ok(APP.includes(from), `в склейке нет «${from}»`);
    return APP.replace(from, to);
  };
  const broken = (src) => Object.entries(rules(src)).filter(([, v]) => v.length).map(([k]) => k);
  assert.deepEqual(broken(spoil('    if (state.create) {\n', '    if (true) {\n')), ['bar']);
  assert.deepEqual(broken(APP + "\n  function other() {\n    return h('div', { class: 'ds-bottom-bar' });\n  }\n"), ['bar']);
  assert.deepEqual(broken(spoil("h('details', { class: 'ds-details", "h('div', { class: 'ds-details")), ['finished']);
  assert.deepEqual(broken(APP + '\n  function other() {\n    state.me.is_owner = true;\n  }\n'), ['roles']);
  assert.deepEqual(broken(APP + "\n  function other() {\n    return capi('admin.users');\n  }\n"), ['rooms']);
  assert.deepEqual(broken(APP + "\n  function other() {\n    return api('company.create', {});\n  }\n"), ['rooms']);
  assert.deepEqual(broken(spoil('    main.replaceChildren(...nodes);\n  }\n\n  // Шторка «Новое событие»',
    '    main.replaceChildren(...nodes, ...personalSections(0, () => {}));\n  }\n\n  // Шторка «Новое событие»')), ['settings']);
  assert.deepEqual(broken(spoil('    heroAction.hidden = false;\n', '')), ['settings']);
  assert.deepEqual(broken(spoil("heroAction.title = t('app.boot.settings')", "heroAction.title = t('app.settings.title')")), ['boot']);
  // Сортировка: без даты — не в конце
  const flat = spoil('a.event_date ? -1 : b.event_date ? 1 : 0', 'a.event_date ? 1 : b.event_date ? -1 : 0');
  assert.notDeepEqual(ids(homeListsOf(flat)([ev(1), ev(2, { event_date: '2026-12-31' })]).active), [2, 1]);
});

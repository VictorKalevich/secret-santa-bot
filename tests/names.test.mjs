// 039: значок после имени, значок в обращениях, главный экран сразу, тап мимо поля
// (specs/039-names-emoji-keyboard/contracts/names.md). Сервер: рядом с каждым именем человека в ответах об обращениях —
// его значок; сообщения бота и журнал — без значков (переписка Санты и подопечного — tests/looks.test.mjs). Приложение
// (по склейке): имя и значок соединяет одна функция — «Аня 🦊»; имена обращений — через неё; приветствие со значком и
// одно обновление главного экрана после смены имени или значка; один обработчик касаний снимает фокус с поля.
import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP, PARTS, topBlock, code } from './support/app-source.mjs';

after(restoreFetch);

const boss = { id: 9101, name: 'Владелец', username: 'boss' };
const bora = { id: 9102, name: 'Боря', username: 'bora' };
const anya = { id: 201, name: 'Аня', username: 'anya' };
const vera = { id: 202, name: 'Вера', username: 'vera' };

const has = (data, needle) => JSON.stringify(data).includes(needle);

describe('значки в обращениях (039, US2)', () => {
  let w, E;
  before(async () => {
    w = await startWorld();
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    E = (await w.api(boss, 'admin.events.create', { title: 'Обращения' })).event.id;
    const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: E })).settings.invite_link)[1];
    for (const u of [bora, anya, vera]) { await w.say(u, '/start ' + code); await w.say(u, u.name); }
    await w.api(boss, 'admin.role.grant', { id: bora.id });
    await w.api(anya, 'emoji.set', { emoji: '🦊' });
    await w.api(bora, 'emoji.set', { emoji: '🐻' });
  });

  it('ничьё обращение: автор со значком в панели, ответственного нет', async () => {
    await w.api(anya, 'support.send', { event: E, text: 'Где отметить подарок?' });
    const sup = (await w.api(anya, 'event.get', { event: E })).support;
    assert.equal(sup.assignee_name, '');
    assert.equal(sup.assignee_emoji, '');
    const t = (await w.api(bora, 'admin.state', { event: E })).support.threads.find((x) => x.user_id === anya.id);
    assert.equal(t.name, 'Аня');
    assert.equal(t.emoji, '🦊');
    assert.equal(t.assignee_emoji, '');
  });

  it('взятое и с ответом: значок ответственного и авторов — в панели, у организатора и у участника', async () => {
    const thread = (await w.api(bora, 'admin.state', { event: E })).support.threads.find((x) => x.user_id === anya.id).id;
    await w.api(bora, 'admin.support.take', { event: E, thread });
    const t = (await w.api(boss, 'admin.state', { event: E })).support.threads.find((x) => x.id === thread);
    assert.equal(t.assignee_name, 'Боря');
    assert.equal(t.assignee_emoji, '🐻');
    const sent = await w.api(bora, 'admin.support.send', { event: E, thread, text: 'Во вкладке «Подопечный».' });
    assert.equal(sent.message.author_emoji, '🐻');

    const mine = (await w.api(anya, 'support.get', { event: E })).threads.at(-1);
    assert.equal(mine.assignee_name, 'Боря');
    assert.equal(mine.assignee_emoji, '🐻');
    assert.deepEqual(mine.messages.map((m) => [m.author, m.author_emoji]), [['', ''], ['Боря', '🐻']]);
    assert.equal((await w.api(anya, 'event.get', { event: E })).support.assignee_emoji, '🐻');

    const d = await w.api(boss, 'admin.support.get', { event: E, thread });
    assert.equal(d.thread.emoji, '🦊');
    assert.equal(d.thread.assignee_emoji, '🐻');
    assert.deepEqual(d.messages.map((m) => [m.author, m.author_emoji]), [['Аня', '🦊'], ['Боря', '🐻']]);
    assert.ok(d.admins.every((a) => !('emoji' in a)), 'выпадающий список «кому передать» — без значков');
  });

  it('закрытое участником: «кто закрыл» со значком', async () => {
    await w.api(anya, 'support.close', { event: E });
    const thread = (await w.api(boss, 'admin.state', { event: E })).support.threads.find((x) => x.user_id === anya.id).id;
    const d = await w.api(boss, 'admin.support.get', { event: E, thread });
    assert.equal(d.thread.closed_by_name, 'Аня');
    assert.equal(d.thread.closed_by_emoji, '🦊');
  });

  it('без значка — пустая строка', async () => {
    const sent = await w.api(vera, 'support.send', { event: E, text: 'Вопрос' });
    assert.equal(sent.message.author_emoji, '');
    const t = (await w.api(boss, 'admin.state', { event: E })).support.threads.find((x) => x.user_id === vera.id);
    assert.equal(t.emoji, '');
    await w.api(boss, 'admin.support.send', { event: E, thread: t.id, text: 'Отвечаю' });
    const mine = (await w.api(vera, 'support.get', { event: E })).threads.at(-1);
    assert.deepEqual([mine.assignee_name, mine.assignee_emoji], ['Владелец', '']);
    assert.equal(mine.messages.at(-1).author_emoji, '');
  });

  it('сообщения бота и журнал об обращениях — без значков', async () => {
    const texts = w.calls.filter((c) => c.method === 'sendMessage').map((c) => c.params.text).join('\n');
    assert.ok(texts.includes('Аня') && texts.includes('Боря'), 'бот писал об обращениях');
    assert.ok(!texts.includes('🦊') && !texts.includes('🐻'), 'сообщения бота без значков');
    const audit = w.query('SELECT * FROM audit');
    assert.ok(audit.some((r) => r.action.startsWith('support.')), 'журнал писал об обращениях');
    assert.ok(!has(audit, '🦊') && !has(audit, '🐻'), 'журнал без значков');
  });
});

// ---------- приложение (по склейке) ----------
const lines = APP.split('\n');
const part = (prefix) => PARTS.find((p) => p.name.startsWith(prefix)).text.split('\n');
const block = (ls, name) => {
  const b = topBlock(ls, name);
  assert.ok(b, 'нет ' + name);
  return ls.slice(b[0], b[1] + 1);
};

test('имя и значок соединяет одна функция withEmoji: «Аня 🦊», без значка — «Аня»; emojiName — через неё', () => {
  const core = part('02-');
  const def = core.find((l) => /^  const withEmoji = /.test(l));
  assert.ok(def, 'нет withEmoji в 02-core');
  const withEmoji = new Function('return ' + def.replace(/^  const withEmoji = /, '').replace(/;\s*$/, ''))();
  assert.equal(withEmoji('Аня', '🦊'), 'Аня 🦊');
  assert.equal(withEmoji('Аня', ''), 'Аня');
  assert.equal(withEmoji('Аня', undefined), 'Аня');
  assert.ok(core.some((l) => /^  const emojiName = \(u, name = u\.name\) => withEmoji\(name, u\.emoji\);/.test(l)), 'emojiName — через withEmoji');
});

// Значок приклеивается к тексту только в withEmoji: вне её вызовов (и вызовов emojiName) нет «emoji +», «+ … emoji»,
// «${… emoji}»
const GLUE = /emoji\s*\+|\+\s*[\w.]*emoji\b|\$\{[^}]*emoji[^}]*\}/;
const CALLS = /\b(?:withEmoji|emojiName)\((?:[^()]|\([^()]*\))*\)/g;
const glued = (l) => GLUE.test(code(l).replace(CALLS, ''));
// Кроме withEmoji, эмодзи с текстом соединяет только maskLabel (040): эмодзи и название маски Санты — не значок у имени
const JOINERS = /^  const (withEmoji|maskLabel) = /;
test('в склейке нет другого соединения значка с текстом', () => {
  const bad = lines.map((l, i) => [i, l]).filter(([, l]) => glued(l) && !JOINERS.test(l));
  assert.deepEqual(bad.map(([i, l]) => `${i + 1}: ${l.trim()}`), []);
  assert.ok(glued("    const t = (u.emoji ? u.emoji + ' ' : '') + name;"), 'от противного: значок перед именем (038)');
  assert.ok(glued('    nameText.textContent = `${me.name} ${me.emoji}`;'), 'от противного: шаблон');
  assert.ok(!glued("    ? `закрыто${t.by ? ' — ' + withEmoji(t.by, t.by_emoji) : ''}.`"), 'вызов withEmoji в шаблоне — можно');
});

// Имя ответственного, кто закрыл, автор сообщения — в той же строке, что и его значок (вывод — через withEmoji)
const PAIRED = [[/(\w+)\.assignee_name\b/g, '.assignee_emoji'], [/(\w+)\.closed_by_name\b/g, '.closed_by_emoji'], [/(\w+)\.author\b/g, '.author_emoji']];
const unpaired = (ls) => ls.flatMap((l, i) => PAIRED.flatMap(([re, tail]) =>
  [...code(l).matchAll(re)].filter((m) => !code(l).includes(m[1] + tail)).map(() => `${i + 1}: ${l.trim()}`)));
test('имена в обращениях — со значком: ответственный, кто закрыл, автор; заголовки обращения', () => {
  assert.deepEqual(unpaired(lines), []);
  assert.deepEqual(unpaired(["        : t.assignee === me.id ? 'ведёшь ты' : 'ведёт ' + t.assignee_name;"]).length, 1, 'от противного');
  assert.ok(block(part('05-'), 'adminSupport').some((l) => l.includes("withEmoji(t.name || 'без имени', t.emoji)")), 'строка списка «Обращения»');
  assert.ok(block(part('07-'), 'openSupportThread').some((l) => l.includes("'Обращение: ' + withEmoji(t.name, t.emoji)")), 'заголовок шторки обращения');
  assert.ok(block(part('07-'), 'supportBubble').some((l) => l.includes('withEmoji(m.author, m.author_emoji)')), 'подпись сообщения');
});

test('главный экран: приветствие со значком, после смены имени или значка — одно обновление всего экрана', () => {
  const home = block(part('03-'), 'renderHome').map(code);
  assert.ok(home.some((l) => l.includes("heroSub.textContent = 'Привет, ' + emojiName(me) + '!'")), 'приветствие — emojiName(me)');
  assert.equal(lines.filter((l) => /'Привет, '/.test(code(l))).length, 1, 'приветствие собирается в одном месте');
  const callbacks = (ls) => ['openNameSheet', 'openEmojiSheet'].map((f) => (ls.join('\n').match(new RegExp(f + '\\((\\w+)\\)')) || [])[1]);
  const [name, emoji] = callbacks(home);
  assert.ok(name && name === emoji, `одно обновление после имени и значка: ${name}, ${emoji}`);
  const body = home.slice(home.findIndex((l) => l.includes(`const ${name} = `)));
  const fn = body.slice(0, body.findIndex((l) => /^\s*\};/.test(l)) + 1).join('\n');
  assert.match(fn, /nav !== state\.nav/, 'только на том же главном экране');
  assert.match(fn, /greet\(\)/, 'приветствие');
  assert.match(fn, /for \(const load of people\) load\(\)/, 'разделы с именами перечитываются');
  const old = ["    editName.addEventListener('click', () => openNameSheet((name) => { nameText.textContent = emojiName(me); }));",
    "    editEmoji.addEventListener('click', () => openEmojiSheet(() => { nameText.textContent = emojiName(me); }));"];
  const [oldName, oldEmoji] = callbacks(old);
  assert.ok(!(oldName && oldName === oldEmoji), 'от противного: прежние колбэки — свои у имени и значка, разделы не обновляли');
});

// Обработчик касаний (R4): один, в ядре, по событиям указателя, кнопки и поля не трогает
function tapRule(src) {
  const ls = src.map(code);
  const up = ls.filter((l) => /document\.addEventListener\('pointerup'/.test(l)).length;
  const fn = ls.join('\n');
  const keeps = (/KEEPS_FOCUS = '([^']+)'/.exec(fn) || [])[1] || '';
  return {
    one: up === 1,
    events: ['pointerdown', 'pointercancel'].every((e) => fn.includes(`addEventListener('${e}'`)),
    keeps: ['input', 'textarea', 'select', 'button', 'a', 'label', '[role="button"]'].every((s) => keeps.split(/,\s*/).includes(s)),
    blur: /field\.blur\(\)/.test(fn) && /e\.target\.closest\(KEEPS_FOCUS\)/.test(fn) && /<= TAP_SLOP/.test(fn),
    called: ls.some((l) => /^  blurOnTap\(\);/.test(l)),
  };
}
test('тап мимо поля: один обработчик в 02-core — pointerdown/up/cancel, сдвиг ≤ TAP_SLOP, поля и кнопки исключены', () => {
  assert.deepEqual(tapRule(part('02-')), { one: true, events: true, keeps: true, blur: true, called: true });
  assert.equal(lines.filter((l) => /document\.addEventListener\('pointer/.test(code(l))).length, 3, 'касания документа слушает только он');
  const noCancel = part('02-').filter((l) => !l.includes("'pointercancel'"));
  assert.equal(tapRule(noCancel).events, false, 'от противного: без pointercancel прокрутка снимала бы фокус');
  const noButtons = part('02-').map((l) => l.replace(", button, a, label", ''));
  assert.equal(tapRule(noButtons).keeps, false, 'от противного: кнопки не исключены');
});

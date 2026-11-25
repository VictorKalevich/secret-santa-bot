// 039: обновление главного экрана и клавиатура. 043: имя может содержать Unicode-эмодзи.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP, PARTS, topBlock, code } from './support/app-source.mjs';
import { appTexts, DEFAULT_LANG } from '../src/i18n/index.js';

after(restoreFetch);

const boss = { id: 9101, name: 'Владелец', username: 'boss' };
const bora = { id: 9102, name: 'Боря', username: 'bora' };
const anya = { id: 201, name: 'Аня', username: 'anya' };
const vera = { id: 202, name: 'Вера', username: 'vera' };

test('отдельный значок недоступен, эмодзи в имени сохраняется и виден в списках и обращениях', async () => {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const event = (await w.api(boss, 'event.create', { participate: false, title: 'Имена' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event })).settings.invite_link)[1];
  for (const u of [bora, anya, vera]) { await w.say(u, '/start ' + code); await w.say(u, u.name); }
  await w.api(boss, 'admin.role.grant', { event, id: bora.id });
  w.sql("UPDATE users SET emoji = '🦊' WHERE tg_id IN (201, 9102)");

  const oldAction = await w.api(anya, 'emoji.set', { emoji: '🐻' }, true);
  assert.equal(oldAction.status, 404);
  assert.equal(w.query('SELECT emoji FROM users WHERE tg_id = ?', anya.id)[0].emoji, '🦊');

  const { name } = await w.api(anya, 'name.set', { name: 'Аня 🦊' });
  assert.equal(name, 'Аня 🦊');
  const home = await w.api(anya, 'me');
  assert.equal(home.me.name, name);
  assert.ok(!('emoji' in home.me));
  assert.ok(!('emojis' in home.looks));

  const sent = await w.api(anya, 'support.send', { event, text: 'Вопрос' });
  await w.api(bora, 'admin.support.send', { event, thread: sent.thread, text: 'Ответ' });
  const { roster, support } = await w.api(anya, 'event.get', { event });
  const person = roster.people.find((u) => u.id === anya.id);
  assert.equal(person.name, name);
  assert.ok(!('emoji' in person));
  assert.deepEqual(support, { available: true, open: true, assignee_name: 'Боря', unread: 1 });
  const participantThread = (await w.api(anya, 'support.get', { event })).threads[0];
  assert.deepEqual(participantThread.messages.map((m) => m.text), ['Вопрос', 'Ответ']);
  const thread = await w.api(boss, 'admin.support.get', { event, thread: sent.thread });
  assert.deepEqual(thread.messages.map((m) => m.author), [name, 'Боря']);
  assert.ok(thread.messages.every((m) => !('author_emoji' in m)));
  assert.ok(!('emoji' in thread.thread));
  assert.ok(!('assignee_emoji' in thread.thread));
});

const lines = APP.split('\n');
const part = (prefix) => PARTS.find((p) => p.name.startsWith(prefix)).text.split('\n');

test('«Настройки» обновляются после смены имени и не предлагают отдельный значок', () => {
  const settings = part('04-');
  const block = (name) => {
    const [start, end] = topBlock(settings, name);
    return settings.slice(start, end + 1).map(code).join('\n');
  };
  // «Профиль» и «Уведомления» (063 — экран «Настройки») — personalSections: экран передаёт ей приветствие
  const body = block('personalSections');
  assert.match(block('renderSettings'), /heroSub\.textContent = t\('app\.home\.greet', \{ name: state\.me\.name \}\)/);
  assert.equal(appTexts(DEFAULT_LANG).texts['app.home.greet'], 'Привет, {name}!');
  assert.match(block('renderSettings'), /personalSections\(nav, greet\)/);
  assert.match(body, /openNameSheet\(profileChanged\)/);
  assert.match(body, /nameText\.textContent = me\.name/);
  assert.match(body, /nav !== state\.nav/);
  assert.match(body, /greet\(\)/);
  assert.doesNotMatch(APP, /openEmojiSheet|emoji\.set|Значок у имени/);
  assert.ok(!Object.values(appTexts(DEFAULT_LANG).texts).some((v) => /Значок у имени/.test(v)), 'в словаре приложения нет «Значок у имени»');
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

// «Мир» (016): страница мини-приложения, правила поддельного Telegram, ожидание отправки очереди.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { BLOCKED_CHAT, telegramReply } from './support/telegram-rules.mjs';

after(restoreFetch);

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const boss = { id: 9001, name: 'Владелец', username: 'boss' };

async function ownerWorld() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'admin.events.create', { title: 'Проверка' })).event;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: ev.id })).settings.invite_link)[1];
  return { w, ev, code };
}

test('/app: страница приложения со встроенной дизайн-системой', async () => {
  const w = await startWorld();
  const page = await w.page();
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = read('src/app.html');
  assert.ok(html.includes('/*@design-system*/'), 'в исходнике есть метка');
  const css = read('design-system/tokens.css') + '\n' + read('design-system/components.css');
  assert.equal(page.text, html.replace('/*@design-system*/', () => css));
  assert.ok(!page.text.includes('/*@design-system*/'), 'метки в ответе нет');
});

test('правила Telegram: отказ заблокировавшему, длинному и с разорванным эмодзи', () => {
  let id = 1;
  const next = () => id++;
  assert.equal(telegramReply('sendMessage', { chat_id: BLOCKED_CHAT, text: 'x' }, next).status, 403);
  assert.equal(telegramReply('sendMessage', { chat_id: 1, text: 'я'.repeat(4097) }, next).status, 400);
  // Теги HTML не в счёт, сущность — один символ
  const html = { chat_id: 1, parse_mode: 'HTML', text: '<b>' + 'я'.repeat(4095) + '</b>&amp;' };
  assert.equal(telegramReply('sendMessage', html, next).status, 200);
  const torn = { chat_id: 1, text: 'ок', reply_markup: { inline_keyboard: [[{ text: '🎄'.slice(0, 1) }]] } };
  assert.equal(telegramReply('sendMessage', torn, next).status, 400);
  assert.equal(telegramReply('sendMessage', { chat_id: 1, text: '🎄' }, next).body.result.message_id, 2, 'номер выдаётся только принятому');
  assert.equal(telegramReply('getMe', {}, next).body.result.username, 'test_santa_bot');
});

test('мир: очередь уходит до конца вызова, заблокировавший отмечается', async () => {
  const { w, ev, code } = await ownerWorld();
  const anya = { id: 101, name: 'Аня', username: 'anya' };
  const blocked = { id: BLOCKED_CHAT, name: 'Блок', username: 'blk' };
  for (const u of [anya, blocked]) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  await w.api(boss, 'admin.announce', { event: ev.id, text: 'Всем привет' });
  // Без sleep и без cron: ответ API ждёт отправку очереди из waitUntil
  assert.ok(w.texts(anya).some((t) => t.includes('Всем привет')));
  assert.equal(w.query('SELECT COUNT(*) AS n FROM outbox')[0].n, 0, 'очередь пуста');
  assert.ok(w.texts(blocked).some((t) => t.includes('Всем привет')), 'попытка отправки была');
  assert.ok(w.query('SELECT blocked_at FROM users WHERE tg_id = ?', BLOCKED_CHAT)[0].blocked_at > 0, 'отметка «заблокировал бота»');
  const users = (await w.api(boss, 'admin.state', { event: ev.id })).users;
  assert.equal(users.find((u) => u.id === BLOCKED_CHAT).blocked, true);
  assert.equal(users.find((u) => u.id === anya.id).blocked, false);
  assert.ok(w.log().some((l) => l.includes('Telegram API error sendMessage 403')), 'журнал Worker собран');
});

test('мир: сеть наружу закрыта', async () => {
  await startWorld();
  await assert.rejects(fetch('https://api.telegram.org/'), /сеть в быстрых тестах недоступна/);
});

// 019: режим ответа (pending) разбирается в одном месте; старый формат переписки без собеседника и времени (до 009)
// и устаревшее нажатие «Ответить» в обращении — «время ответа истекло», ничего не отправлено
test('бот: старый и устаревший режим ответа не отправляет, свежий — отправляет', async () => {
  const { w, ev, code } = await ownerWorld();
  const people = [{ id: 101, name: 'Аня', username: 'anya' }, { id: 102, name: 'Боря', username: 'borya' }, { id: 103, name: 'Вера', username: 'vera' }];
  for (const u of people) {
    await w.say(u, '/start ' + code);
    await w.say(u, u.name);
  }
  assert.equal((await w.api(boss, 'admin.draw', { event: ev.id })).count, 3);
  const [anya] = people;
  const pending = () => w.query('SELECT pending FROM users WHERE tg_id = ?', anya.id)[0].pending;
  const count = (table) => w.query(`SELECT COUNT(*) AS n FROM ${table}`)[0].n;

  w.query('UPDATE users SET pending = ? WHERE tg_id = ?', `msg_ward:${ev.id}`, anya.id);
  await w.say(anya, 'Текст в старом режиме');
  assert.match(w.lastText(anya), /Время ответа истекло — сообщение не отправлено/);
  assert.equal(pending(), '');

  w.query('UPDATE users SET pending = ? WHERE tg_id = ?', `sup_u:${ev.id}:${Date.now() - 2 * 3600e3}`, anya.id);
  await w.say(anya, 'Вопрос организатору');
  assert.match(w.lastText(anya), /Время ответа истекло — сообщение не отправлено/);
  assert.equal(pending(), '');
  assert.equal(count('messages'), 0);
  assert.equal(count('support_messages'), 0);

  await w.press(anya, `msg:ward:${ev.id}`);
  assert.match(pending(), /^msg_ward:\d+:\d+:\d+$/);
  await w.say(anya, 'Привет, подопечный');
  assert.match(w.lastText(anya), /Отправлено подопечному/);
  assert.equal(count('messages'), 1);
});

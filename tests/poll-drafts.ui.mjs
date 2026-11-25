// node --test tests/poll-drafts.ui.mjs (Chrome или CHROME_PATH); Worker и D1 из локального тестового мира.
// 058 (specs/058-poll-drafts/): запросы приложения на часах Playwright и заглушке SDK Telegram (isActive, onEvent) —
// опрос переписки в открытом и закрытом боте, сворачивание и возвращение, касание спящей шторки; черновик письма — набор,
// сворачивание, уход на «Инфо» без вопроса, быстрое возвращение во время сохранения.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Событие после жеребьёвки: владелец бота и два игрока, без кольцевой
async function drawnWorld({ open = false, drafts = false } = {}) {
  const w = await startWorld({ open });
  const owner = { id: 5801, name: 'Олег' };
  const [a, b] = [{ id: 5811, name: 'Аня' }, { id: 5812, name: 'Боря' }];
  await w.say(owner, '/start ' + (await w.setup()).adminCode);
  await w.say(owner, owner.name);
  const event = (await w.api(owner, 'event.create', { participate: false, company: 1, title: 'Ёлка' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(owner, 'admin.state', { event })).settings.invite_link)[1];
  for (const u of [a, b]) { await w.say(u, '/start ' + code); await w.say(u, u.name); }
  await w.api(owner, 'admin.participate', { event, on: true });
  await w.api(owner, 'admin.ring', { event, on: false });
  if (drafts) await w.api(owner, 'admin.game', { event, letter_drafts: true });
  else await w.api(owner, 'admin.draw', { event });
  return { w, owner, a, b, event };
}

// Страница приложения: заглушка SDK (__active(v) — свернуть/развернуть, как Telegram iOS), часы Playwright, счёт запросов
async function openApp(t, browser, w, user, query) {
  const page = await browser.newPage({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.addInitScript(() => {
    const handlers = {};
    window.Telegram = { WebApp: {
      initData: '', isActive: true, ready() {}, expand() {}, isVersionAtLeast: () => false,
      onEvent(name, fn) { (handlers[name] ||= []).push(fn); },
    } };
    window.__active = (v) => {
      window.Telegram.WebApp.isActive = v;
      for (const fn of handlers[v ? 'activated' : 'deactivated'] || []) fn();
    };
  });
  const requests = [];
  let inflight = 0;
  let gate = null; // обещание: ответы wishlist.draft ждут его
  await page.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.host !== 'w.test') return route.abort();
    if (url.pathname.startsWith('/api/')) { requests.push(url.pathname.slice(5)); inflight++; }
    try {
      if (gate && url.pathname === '/api/wishlist.draft') await gate;
      const res = await w.request(url.pathname, { method: req.method(), headers: req.headers(), body: req.postData() });
      await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
    } finally {
      if (url.pathname.startsWith('/api/')) inflight--;
    }
  });
  await page.clock.install();
  await page.goto('https://w.test/app?' + query + '#tgWebAppData=' + encodeURIComponent(initData(user)));
  // Ответы приходят в настоящем времени, таймеры приложения — по часам Playwright
  const settle = async () => {
    await sleep(30);
    for (let i = 0; i < 300 && inflight > 0; i++) await sleep(10);
    await sleep(10);
  };
  const run = async (seconds, step = 2) => {
    for (let s = 0; s < seconds; s += step) { await page.clock.runFor(step * 1000); await settle(); }
  };
  const count = (action) => requests.filter((r) => r === action).length;
  return { page, errors, dialogs, requests, count, settle, run, hold: (p) => { gate = p; } };
}

async function launch(t) {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  t.after(() => browser.close());
  t.after(restoreFetch);
  return browser;
}

test('058: опрос переписки — открытый бот засыпает после тишины, касание и возвращение будят; свёрнутое — без запросов', async (t) => {
  const browser = await launch(t);
  const { w, a, event } = await drawnWorld({ open: true });
  const p = await openApp(t, browser, w, a, `event=${event}&chat=santa`);
  await p.page.locator('.ds-sheet .ds-chat').waitFor();
  await p.settle();
  await p.page.clock.pauseAt(Date.now() + 1000);
  await p.settle();
  const first = p.count('chat.get');
  assert.equal(first, 1, 'открытие — один запрос');
  await p.run(300);
  const five = p.count('chat.get');
  assert.ok(five <= 9, `за 5 минут тишины — ${five} запросов (было бы 50)`);
  await p.run(300);
  assert.equal(p.count('chat.get'), 9, 'дальше опрос спит');
  await p.page.locator('.ds-sheet .ds-chat').click();
  await p.settle();
  assert.equal(p.count('chat.get'), 10, 'касание спящей шторки — запрос сразу');
  // Свернули (Telegram iOS: deactivated) — ни одного запроса; развернули — сразу
  await p.page.evaluate(() => window.__active(false));
  await p.run(120);
  assert.equal(p.count('chat.get'), 10, 'свёрнуто — без запросов');
  await p.page.evaluate(() => window.__active(true));
  await p.settle();
  assert.equal(p.count('chat.get'), 11, 'развернули — запрос сразу');
  // Страница скрыта (visibilitychange) — так же
  await p.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.run(60);
  assert.equal(p.count('chat.get'), 11, 'скрыто — без запросов');
  await p.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.settle();
  assert.equal(p.count('chat.get'), 12);
  // Новое сообщение собеседника видно при ближайшем запросе
  const santa = w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', event, a.id)[0].santa;
  await w.api({ id: santa }, 'message.send', { event, to: 'ward', text: 'Привет от Санты' });
  await p.run(6);
  await p.page.locator('.ds-chat__msg', { hasText: 'Привет от Санты' }).waitFor();
  assert.deepEqual(p.errors, []);
});

test('058: опрос переписки — закрытый бот раз в 6 с, свёрнутое — без запросов', async (t) => {
  const browser = await launch(t);
  const { w, a, event } = await drawnWorld();
  const p = await openApp(t, browser, w, a, `event=${event}&chat=santa`);
  await p.page.locator('.ds-sheet .ds-chat').waitFor();
  await p.settle();
  await p.page.clock.pauseAt(Date.now() + 1000);
  await p.settle();
  await p.run(60, 1);
  const minute = p.count('chat.get') - 1;
  assert.ok(minute >= 8 && minute <= 10, `минута — ${minute} запросов (раз в 6 с)`);
  await p.run(600, 6);
  assert.ok(p.count('chat.get') > 90, 'закрытый бот не засыпает');
  await p.page.evaluate(() => window.__active(false));
  const hidden = p.count('chat.get');
  await p.run(60, 1);
  assert.equal(p.count('chat.get'), hidden, 'свёрнуто — без запросов');
  assert.deepEqual(p.errors, []);
});

test('058: черновик — набор не чаще раза в 5 с, свернули — сразу, «Инфо» — сразу и без вопроса, быстрое возвращение — без отказа', async (t) => {
  const browser = await launch(t);
  const { w, owner, event } = await drawnWorld({ drafts: true });
  const p = await openApp(t, browser, w, owner, `event=${event}`);
  const field = p.page.getByLabel('Текст письма');
  const status = p.page.getByRole('status');
  await field.waitFor();
  await p.settle();
  await p.page.clock.pauseAt(Date.now() + 1000);
  const server = async () => (await w.api(owner, 'event.get', { event })).member.draft.text;
  // Набор 20 секунд: правка каждую секунду
  let text = 'Дорогой Санта!';
  await field.fill(text);
  for (let i = 0; i < 20; i++) {
    await p.run(1, 1);
    text += ' слово' + i;
    await field.fill(text);
  }
  const typing = p.count('wishlist.draft');
  assert.ok(typing >= 3 && typing <= 5, `набор 20 с — ${typing} сохранений (не чаще раза в 5 с)`);
  await p.run(6, 1);
  assert.equal(await server(), text, 'конец набора — на сервере не позже чем через 5 с');
  // Свернули сразу после правки — сохранение уходит без ожидания таймера
  const before = p.count('wishlist.draft');
  await field.fill(text + ' — и шарф');
  await p.page.evaluate(() => window.__active(false));
  await p.settle();
  assert.equal(p.count('wishlist.draft'), before + 1, 'свернули — сохранение сразу');
  assert.equal(await server(), text + ' — и шарф');
  await p.page.evaluate(() => window.__active(true));
  // Ушли на «Инфо» сразу после правки — сохранение сразу и без вопроса
  await p.run(6, 1);
  await field.fill(text + ' — и варежки');
  await p.page.getByRole('button', { name: /ℹ️ Инфо/ }).click();
  await p.settle();
  assert.deepEqual(p.dialogs, [], 'вопроса «Уйти без сохранения?» нет');
  assert.equal(await server(), text + ' — и варежки', 'уход с вкладки — сохранение сразу');
  // Быстрое возвращение, пока сохранение ещё идёт: новый редактор ждёт его и берёт его версию
  await p.page.getByRole('button', { name: /✉️ Письмо/ }).click();
  await p.run(6, 1);
  let release;
  p.hold(new Promise((r) => { release = r; }));
  await field.fill(text + ' — и шапку');
  await p.page.getByRole('button', { name: /ℹ️ Инфо/ }).click();
  await p.page.getByRole('button', { name: /✉️ Письмо/ }).click();
  await field.fill(text + ' — и шапку, и носки');
  await p.run(1, 1);
  p.hold(null);
  release();
  await p.settle();
  await p.run(6, 1);
  assert.equal(await status.getByText(/не сохранён/).count(), 0, 'без «Черновик не сохранён»');
  assert.equal(await server(), text + ' — и шапку, и носки');
  assert.deepEqual(p.dialogs, []);
  assert.deepEqual(p.errors, []);
});

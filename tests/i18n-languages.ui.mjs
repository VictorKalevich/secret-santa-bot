// node --test tests/i18n-languages.ui.mjs (Chrome или CHROME_PATH); Worker и D1 — локальный тестовый мир.
// 061 (US1, US2): человек с английским и с китайским Telegram — главный экран, «Настройки» (063: у владельца бота — и его
// шторки), событие (все вкладки), панель и шторки без кириллицы (кроме названий языков в списке выбора); язык страницы —
// его; смена языка в «Настройках» → «🌐 Язык» перестраивает экран сразу и запоминается, «Как в Telegram» возвращает язык
// Telegram; ошибок словаря и страницы нет.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';
import { CYRILLIC } from './support/pseudo.mjs';
import { t as tr, LANGUAGES } from '../src/i18n/index.js';
import { LANGUAGE_NAMES } from '../src/i18n/languages.js';

const anna = { id: 6101, name: 'Anna', username: 'anna', language_code: 'en' };
const li = { id: 6102, name: 'Li Wei', username: 'liwei', language_code: 'zh-hans' };
const bob = { id: 6103, name: 'Bob', username: 'bob', language_code: 'ru' };
const carl = { id: 6104, name: 'Carl', username: 'carl' };
const NAMES = new Set(Object.values(LANGUAGE_NAMES));

let browser;
let w;
let E;
before(async () => {
  w = await startWorld();
  const s = await w.setup();
  await w.say(anna, '/start ' + s.adminCode);
  await w.say(anna, anna.name);
  E = (await w.api(anna, 'event.create', { participate: false, title: 'Party' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(anna, 'admin.state', { event: E })).settings.invite_link)[1];
  for (const u of [li, bob, carl]) { await w.say(u, '/start ' + code); await w.say(u, u.name); }
  await w.api(anna, 'admin.participate', { event: E, on: true });
  for (const u of [anna, li, bob, carl]) await w.api(u, 'wishlist.save', { event: E, text: 'Books and tea' });
  await w.api(li, 'support.send', { event: E, text: 'Question' });
  await w.api(anna, 'admin.draw', { event: E });
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
});
after(async () => {
  await browser?.close();
  restoreFetch();
});

async function openApp(t, user, query = '') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', (e) => errors.push('страница: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && m.text().startsWith('i18n:')) errors.push(m.text()); });
  await page.addInitScript(() => {
    window.Telegram = { WebApp: { initData: '', isActive: true, ready() {}, expand() {}, isVersionAtLeast: () => false, onEvent() {} } };
  });
  await page.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.host !== 'w.test') return route.abort();
    const res = await w.request(url.pathname + url.search, { method: req.method(), headers: req.headers(), body: req.postData() });
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
  });
  await page.goto('https://w.test/app' + query + '#tgWebAppData=' + encodeURIComponent(initData(user)));
  await page.waitForSelector('#main > *');
  await page.waitForTimeout(300);
  return { page, errors };
}

// Строка «🌐 Язык» в «Настройках» (063: ⚙️ в шапке главного экрана)
async function langRow(page, lang) {
  const row = page.locator('.ds-list-item', { hasText: tr(lang, 'app.settings.lang.button').replace('🌐 ', '') });
  if (!(await row.count())) {
    await page.locator('#heroAction').click();
    await row.first().waitFor();
  }
  await row.first().scrollIntoViewIfNeeded();
  return row.first();
}

const pageText = (page) => page.evaluate(() => {
  const attrs = [...document.querySelectorAll('[placeholder],[aria-label],[title]')]
    .flatMap((el) => ['placeholder', 'aria-label', 'title'].map((a) => el.getAttribute(a)).filter(Boolean));
  return [document.title, document.body.innerText, ...attrs].join('\n');
});
// Строки с кириллицей, кроме названий языков (список выбора — на самих языках)
async function cyrillic(page) {
  return (await pageText(page)).split('\n').map((l) => l.trim().replace(/^✓\s*/, ''))
    .filter((l) => CYRILLIC.test(l) && !NAMES.has(l)).map((l) => l.slice(0, 80));
}
async function expectClean(page, where, found) {
  for (const l of await cyrillic(page)) found.push(`${where}: ${l}`);
}

for (const [user, lang] of [[anna, 'en'], [li, 'zh']]) {
  test(`061: ${lang} — главный экран, «Настройки», событие, панель и шторки на языке Telegram`, async (t) => {
    const found = [];
    async function sheet(page, key, where) {
      const btn = page.locator('.ds-btn', { hasText: tr(lang, key).replace(/^\S+\s/, '').split('{')[0].trim() });
      if (!(await btn.count())) return false;
      await btn.first().scrollIntoViewIfNeeded();
      await btn.first().click();
      await page.waitForSelector('.ds-sheet');
      await page.waitForTimeout(300);
      await expectClean(page, where, found);
      await page.locator('.ds-sheet .ds-icon-btn').last().click();
      await page.waitForTimeout(200);
      return true;
    }
    const home = await openApp(t, user);
    assert.equal(await home.page.evaluate(() => document.documentElement.lang), lang);
    await expectClean(home.page, 'главный экран', found);
    // «Настройки» (063): профиль, язык, уведомления, «О боте»; у владельца бота (anna) — его раздел и шторки
    await home.page.locator('#heroAction').click();
    await home.page.waitForTimeout(300);
    await expectClean(home.page, '«Настройки»', found);
    if (!(await sheet(home.page, 'app.settings.profile.editName', 'шторка имени'))) found.push('«Настройки»: нет кнопки имени');
    if (user === anna) {
      for (const key of ['app.settings.bot.events', 'app.settings.bot.creators', 'app.settings.bot.log', 'app.settings.bot.pass']) {
        if (!(await sheet(home.page, key, `шторка ${key}`))) found.push(`«Настройки»: нет кнопки ${key}`);
      }
    }
    const ev = await openApp(t, user, `?event=${E}`);
    const tabs = ev.page.locator('.ds-tab');
    const count = await tabs.count();
    assert.ok(count >= 3, `вкладок: ${count}`);
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await ev.page.waitForTimeout(400);
      await expectClean(ev.page, `вкладка ${i + 1}`, found);
    }
    await tabs.first().click();
    await ev.page.waitForTimeout(300);
    await sheet(ev.page, 'app.event.card.button', 'шторка открытки');
    const chat = await openApp(t, user, `?event=${E}&chat=santa`);
    await chat.page.waitForSelector('.ds-sheet');
    await expectClean(chat.page, 'переписка', found);
    for (const p of [home, ev, chat]) found.push(...p.errors);
    assert.deepEqual(found, []);
  });
}

test('061: смена языка в «Настройках» — экран сразу на новом языке, запоминается; «Как в Telegram» — обратно', async (t) => {
  const { page, errors } = await openApp(t, bob);
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'ru');
  await (await langRow(page, 'ru')).click();
  await page.waitForSelector('.ds-sheet');
  const items = page.locator('.ds-sheet .ds-btn');
  assert.equal(await items.count(), LANGUAGES.length + 1, 'кнопка «Как в Telegram» и каждый язык');
  await page.locator('.ds-sheet .ds-btn', { hasText: LANGUAGE_NAMES.de }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'de');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.ds-sheet').count(), 0, 'шторка закрыта');
  assert.deepEqual(await cyrillic(page), []);
  assert.equal(w.query('SELECT lang FROM users WHERE tg_id = ?', bob.id)[0].lang, 'de');
  // Новое открытие — уже на немецком
  const again = await openApp(t, bob);
  assert.equal(await again.page.evaluate(() => document.documentElement.lang), 'de');
  // «Как в Telegram» — русский
  await (await langRow(again.page, 'de')).click();
  await again.page.waitForSelector('.ds-sheet');
  await again.page.locator('.ds-sheet .ds-btn').first().click();
  await again.page.waitForFunction(() => document.documentElement.lang === 'ru');
  assert.equal(w.query('SELECT lang FROM users WHERE tg_id = ?', bob.id)[0].lang, '');
  assert.deepEqual([...errors, ...again.errors], []);
});

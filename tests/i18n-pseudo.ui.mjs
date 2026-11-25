// node --test tests/i18n-pseudo.ui.mjs (Chrome или CHROME_PATH); Worker и D1 из локального тестового мира — псевдоязык
// добавляется в словари того же процесса (screenshots.mjs ходит в wrangler dev, где его нет).
// 060 (US3, T041): владелец бота с языком xx проходит главный экран, «Настройки» (063), событие (все вкладки), панель
// организатора и шторки — в тексте страницы и подписях (placeholder, aria-label, title) нет кириллицы, есть ⟪; у человека
// с русским — ни одной ⟪; ошибок словаря (console.error «i18n: …») и ошибок страницы нет.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';
import { PSEUDO, CYRILLIC, pseudoLanguage, translit } from './support/pseudo.mjs';

const anna = { id: 6001, name: 'Anna', username: 'anna' };
const bob = { id: 6002, name: 'Bob', username: 'bob' };
const carl = { id: 6003, name: 'Carl', username: 'carl' };
const dina = { id: 6004, name: 'Dina', username: 'dina' };

let drop;
let browser;
let w;
let E;
before(async () => {
  drop = pseudoLanguage();
  w = await startWorld();
  const s = await w.setup();
  w.query('INSERT INTO users (tg_id, lang, created_at) VALUES (?, ?, ?)', anna.id, PSEUDO, Date.now());
  await w.say(anna, '/start ' + s.adminCode);
  await w.say(anna, anna.name);
  E = (await w.api(anna, 'event.create', { participate: false, title: 'Party' })).event.id;
  const code = /start=(inv_[a-z0-9]+)/.exec((await w.api(anna, 'admin.state', { event: E })).settings.invite_link)[1];
  for (const u of [bob, carl, dina]) { await w.say(u, '/start ' + code); await w.say(u, u.name); }
  await w.api(anna, 'admin.participate', { event: E, on: true });
  for (const u of [anna, bob, carl, dina]) await w.api(u, 'wishlist.save', { event: E, text: 'Books and tea' });
  await w.api(bob, 'support.send', { event: E, text: 'Question' });
  await w.api(anna, 'admin.draw', { event: E });
  // Подробности журнала — данные на языке по умолчанию (контракт, раздел 3): в журнале проверяются подписи, не они
  w.query("UPDATE audit SET details = 'details' WHERE details != ''");
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
});
after(async () => {
  await browser?.close();
  drop();
  restoreFetch();
});

// Страница приложения через Worker мира; заглушка SDK Telegram (initData — из адреса)
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

// Видимый текст и подписи страницы (вместе со шторкой)
const pageText = (page) => page.evaluate(() => {
  const attrs = [...document.querySelectorAll('[placeholder],[aria-label],[title]')]
    .flatMap((el) => ['placeholder', 'aria-label', 'title'].map((a) => el.getAttribute(a)).filter(Boolean));
  return [document.title, document.body.innerText, ...attrs].join('\n');
});

// Строки с кириллицей (место — первые слова) и есть ли ⟪
async function look(page) {
  const text = await pageText(page);
  return { cyrillic: text.split('\n').filter((l) => CYRILLIC.test(l)).map((l) => l.slice(0, 80)), marked: text.includes('⟪') };
}

async function expectPseudo(page, where, found) {
  const { cyrillic, marked } = await look(page);
  for (const l of cyrillic) found.push(`${where}: ${l}`);
  if (!marked) found.push(`${where}: нет ⟪`);
}

const label = (ru) => translit(ru);

test('060: человек с языком xx — главный экран, «Настройки», событие, панель и шторки без кириллицы', async (t) => {
  const found = [];
  // Шторка по кнопке с подписью (транслит русской): открыть, проверить, закрыть ✕; нет кнопки — false
  async function sheet(page, ru, where) {
    const btn = page.locator('.ds-btn', { hasText: label(ru) });
    if (!(await btn.count())) return false;
    await btn.first().scrollIntoViewIfNeeded();
    await btn.first().click();
    await page.waitForSelector('.ds-sheet');
    await page.waitForTimeout(300);
    await expectPseudo(page, where, found);
    await page.locator('.ds-sheet .ds-icon-btn').last().click();
    await page.waitForTimeout(200);
    return true;
  }

  const home = await openApp(t, anna);
  assert.equal(await home.page.evaluate(() => document.documentElement.lang), PSEUDO);
  await expectPseudo(home.page, 'главный экран', found);
  // «Настройки» (063) — ⚙️ в шапке: профиль, уведомления (064: без «О боте»), раздел владельца бота и его шторки (шторка языка —
  // названия языков на самих языках, в ней кириллица законна)
  await home.page.locator('#heroAction').click();
  await home.page.waitForTimeout(300);
  await expectPseudo(home.page, '«Настройки»', found);
  for (const ru of ['Изменить имя', 'Все события', 'Кто может создавать события', 'Журнал бота', 'Передать права владельца бота']) {
    if (!(await sheet(home.page, ru, `шторка «${ru}»`))) found.push(`«Настройки»: нет кнопки «${ru}»`);
  }

  const ev = await openApp(t, anna, `?event=${E}`);
  const tabs = ev.page.locator('.ds-tab');
  const count = await tabs.count();
  assert.ok(count >= 4, `вкладок: ${count}`);
  // Шторки вкладок: открытка («Письмо», 064 — «Раскрасить письмо»), журнал действий («Управление»); масок нет с 062
  const SHEETS = ['Раскрасить письмо', 'Журнал действий'];
  const opened = new Set();
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click();
    await ev.page.waitForTimeout(400);
    await expectPseudo(ev.page, `вкладка ${i + 1}`, found);
    for (const ru of SHEETS) if (!opened.has(ru) && (await sheet(ev.page, ru, `шторка «${ru}»`))) opened.add(ru);
  }
  for (const ru of SHEETS) if (!opened.has(ru)) found.push(`событие: нет кнопки шторки «${ru}» (подпись транслитом)`);

  const chat = await openApp(t, anna, `?event=${E}&chat=santa`);
  await chat.page.waitForSelector('.ds-sheet');
  await expectPseudo(chat.page, 'переписка', found);

  for (const p of [home, ev, chat]) found.push(...p.errors);
  assert.deepEqual(found, []);
});

test('060: человек с русским — ни одной ⟪', async (t) => {
  const { page, errors } = await openApp(t, bob, `?event=${E}`);
  const tabs = page.locator('.ds-tab');
  const seen = [];
  for (let i = 0; i < await tabs.count(); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(300);
    if ((await look(page)).marked) seen.push(`вкладка ${i + 1}`);
  }
  assert.deepEqual([...seen, ...errors], []);
});

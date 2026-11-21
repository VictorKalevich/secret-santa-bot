// node --test tests/announce-field.ui.mjs (Chrome или CHROME_PATH).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startWorld, restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';

test('046: поле объявления после отправки возвращается к исходной высоте', async (t) => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  t.after(() => browser.close());
  t.after(restoreFetch);
  const w = await startWorld();
  const admin = { id: 950, name: 'Организатор' }, player = { id: 951, name: 'Участник' };
  await w.say(admin, '/start ' + (await w.setup()).adminCode);
  await w.say(admin, admin.name);
  const event = (await w.api(admin, 'admin.events.create', { title: 'Объявления' })).event.id;
  const invite = (await w.api(admin, 'admin.state', { event })).settings.invite_link.split('start=')[1];
  await w.say(player, '/start ' + invite);
  await w.say(player, player.name);
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, colorScheme: theme });
    await context.route('**/*', async (route) => {
      const req = route.request(), url = new URL(req.url());
      if (url.host !== 'w.test') return route.abort();
      const r = await w.request(url.pathname, { method: req.method(), headers: req.headers(), body: req.postData() });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: await r.text() });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('https://w.test/app?event=' + event + '#tgWebAppData=' + encodeURIComponent(initData(admin)));
    await page.getByRole('button', { name: /Управление/ }).click();
    const field = page.getByPlaceholder(/Например: собираемся/);
    const send = page.getByRole('button', { name: '📣 Отправить всем', exact: true });
    await field.scrollIntoViewIfNeeded();
    const height = () => field.evaluate((el) => new Promise((done) => requestAnimationFrame(() => done(el.getBoundingClientRect().height))));
    const initial = await height();
    await field.fill(`Объявление (${theme})\n` + 'строка\n'.repeat(8) + 'конец');
    assert.ok(await height() > initial + 50, 'поле выросло вместе с текстом');
    await send.click();
    await page.getByText(/Объявление отправлено/).waitFor();
    assert.equal(await field.inputValue(), '');
    assert.equal(await height(), initial, 'высота пустого поля — как при открытии панели');
    assert.ok(await send.isDisabled());
    assert.deepEqual(errors, []);
    await context.close();
  }
});

// node --test tests/shipment.ui.mjs (Chrome или CHROME_PATH).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { shipmentWorld } from './support/shipment-world.mjs';
import { restoreFetch } from './support/world.mjs';
import { initData } from './support/auth.mjs';
import { localDate } from '../src/format.js';

test('042: отправка с телефона, форма и старая ссылка в обеих темах', async (t) => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  t.after(() => browser.close());
  t.after(restoreFetch);
  const { w, event, santa, recipient } = await shipmentWorld();
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, colorScheme: theme });
    await context.addInitScript(mode => document.addEventListener('DOMContentLoaded', () => {
      const style = document.documentElement.style;
      style.setProperty('--tg-color-scheme', mode);
      if (mode === 'dark') {
        style.setProperty('--tg-theme-secondary-bg-color', '#101013');
        style.setProperty('--tg-theme-bg-color', '#202024');
        style.setProperty('--tg-theme-text-color', '#eeeeef');
        style.setProperty('--tg-theme-hint-color', '#b5b5ba');
      }
    }, { once: true }), theme);
    const errors = [];
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.host !== 'w.test') return route.abort();
      const r = await w.request(url.pathname, { method: req.method(), headers: req.headers(), body: req.postData() });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: await r.text() });
    });
    const sender = await context.newPage();
    const link = u => 'https://w.test/app?event=' + event + '#tgWebAppData=' + encodeURIComponent(initData(u));
    await sender.goto(link(santa));
    await sender.getByRole('button', { name: /🎁 Подопечный/ }).click();
    const btn = name => sender.getByRole('button', { name, exact: true });
    await btn('Отметить отправку').click();
    const date = sender.getByLabel('Дата отправки', { exact: true });
    assert.equal(await date.inputValue(), localDate(w.env).iso);
    assert.equal(await date.getAttribute('type'), 'date');
    await date.fill('2024-01-01');
    await date.fill('');
    const tracking = '00-' + 'A'.repeat(157);
    await sender.getByLabel('Трек-номер', { exact: true }).fill(tracking);
    await sender.getByLabel('Служба доставки', { exact: true }).fill('Черновик');
    await btn('Очистить поле «Служба доставки»').tap();
    assert.equal(await sender.getByLabel('Служба доставки', { exact: true }).inputValue(), '');
    assert.equal(await sender.getByLabel('Трек-номер', { exact: true }).inputValue(), tracking);
    await sender.route('**/api/ward.shipment', route => route.abort(), { times: 1 });
    await btn('Подтвердить отправку').click();
    await sender.getByText(/Нет связи с сервером/).waitFor();
    assert.equal(await sender.getByLabel('Трек-номер', { exact: true }).inputValue(), tracking);
    await btn('Подтвердить отправку').click();
    await btn('Изменить данные').click();
    assert.equal(await date.inputValue(), '');
    await sender.getByLabel('Служба доставки', { exact: true }).fill('Почта');
    await btn('Сохранить изменения').click();
    await sender.getByText('Почта', { exact: true }).waitFor();
    const message = w.calls.filter(c => c.params.reply_markup?.inline_keyboard?.[0]?.[0]?.text === 'Открыть посылку').at(-1);
    const query = new URL(message.params.reply_markup.inline_keyboard[0][0].web_app.url).search;
    const receiver = await context.newPage();
    await receiver.goto('https://w.test/app' + query + '#tgWebAppData=' + encodeURIComponent(initData(recipient)));
    const card = receiver.locator('#myShipment');
    await card.getByText(tracking, { exact: true }).waitFor();
    assert.ok(await receiver.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    sender.once('dialog', dialog => dialog.accept());
    await btn('Отменить отметку').click();
    await btn('Отметить отправку').waitFor();
    await receiver.reload();
    await card.getByText('Отправка пока не отмечена').waitFor();
    assert.equal(await card.getByText(tracking).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startWorld, restoreFetch } from './support/world.mjs';

test('045: очистка в обеих темах витрины и в форме настройки', async t => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.goto(new URL('../design-system/preview.html', import.meta.url).href);
  for (const theme of ['light', 'dark']) {
    const gallery = page.locator('#' + theme);
    const input = gallery.getByLabel('Бюджет подарка', { exact: true });
    const clear = gallery.getByRole('button', { name: 'Очистить поле «Бюджет подарка»' });
    const box = await clear.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
    const spacing = await clear.evaluate(button => {
      const glyph = document.createRange();
      glyph.selectNodeContents(button);
      const input = button.previousElementSibling;
      return {
        inset: input.getBoundingClientRect().right - glyph.getBoundingClientRect().right,
        padding: parseFloat(getComputedStyle(input).paddingInlineEnd),
      };
    });
    assert.ok(spacing.inset >= 12 && spacing.padding >= box.width);
    await clear.tap();
    assert.equal(await input.inputValue(), '');
    assert.equal(await clear.count(), 0);
    await input.evaluate(el => { el.value = ' '; });
    assert.ok(await clear.isVisible());
    await input.press('Backspace');
    assert.equal(await clear.count(), 0);
  }
  t.after(restoreFetch);
  const w = await startWorld();
  const setup = await (await w.request('/setup')).text();
  await page.setContent(setup);
  const key = page.locator('input[type="password"]');
  await key.fill('тестовый ключ');
  await page.getByRole('button', { name: 'Очистить поле «Ключ настройки»' }).tap();
  assert.equal(await key.inputValue(), '');
  assert.ok(await key.evaluate(el => el === document.activeElement && el.validity.valueMissing));
});

// Скриншоты мини-приложения в светлой и тёмной теме Telegram (для визуальной проверки).
// Запуск: npm run screenshots   (нужен установленный Google Chrome или переменная CHROME_PATH)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startWorld, initData } from './harness.mjs';

const OUT = new URL('../test-results/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const DARK = {
  '--tg-theme-bg-color': '#1c1c1e',
  '--tg-theme-secondary-bg-color': '#0f0f10',
  '--tg-theme-section-bg-color': '#1c1c1e',
  '--tg-theme-text-color': '#ffffff',
  '--tg-theme-hint-color': '#8d8e93',
  '--tg-theme-link-color': '#64b5ef',
  '--tg-theme-button-color': '#3e88f7',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-destructive-text-color': '#eb5545',
  '--tg-theme-section-header-text-color': '#8d8e93',
};

const admin = { id: 100, name: 'Дмитрий', username: 'dima' };
const people = [
  { id: 101, name: 'Маша', username: 'masha' },
  { id: 102, name: 'Петя', username: 'petya' },
  { id: 103, name: 'Аня', username: 'anya' },
  { id: 104, name: 'Олег', username: '' },
  { id: 105, name: 'Катя', username: 'katya' },
];
const LETTER = (name) => `Дорогой Санта!\n\nВ этом году я мечтаю о тёплом шарфе и хорошей книге — люблю фантастику и детективы. ` +
  `Размер одежды M, любимый цвет — зелёный.\n\nЧего точно не надо: сладкого и свечей.\n\nС любовью, ${name}`;

// Проверка вычисленных цветов: текст вкладок и кнопок должен быть цветом их варианта (002, US4).
const colorProblems = [];
async function checkColors(page, label) {
  const r = await page.evaluate(() => {
    const token = (name) => {
      const d = document.createElement('div');
      d.style.color = `var(${name})`;
      document.body.append(d);
      const c = getComputedStyle(d).color;
      d.remove();
      return c;
    };
    const probe = (cls) => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = 'x';
      document.body.append(b);
      const c = getComputedStyle(b).color;
      b.remove();
      return c;
    };
    const active = document.querySelector('.ds-tab--active');
    return [
      ['выбранная вкладка', active ? getComputedStyle(active).color : null, token('--ds-color-on-accent')],
      ['основная кнопка', probe('ds-btn'), token('--ds-color-on-accent')],
      ['вторичная кнопка', probe('ds-btn ds-btn--secondary'), token('--ds-color-link')],
      ['опасная кнопка', probe('ds-btn ds-btn--danger'), token('--ds-color-danger')],
      ['праздничная кнопка', probe('ds-btn ds-btn--festive'), token('--ds-color-on-festive')],
      ['невыбранная вкладка', probe('ds-tab'), token('--ds-color-text')],
    ];
  });
  for (const [what, actual, expected] of r) {
    if (actual !== expected) colorProblems.push(`${label}: ${what} — ${actual}, ожидалось ${expected}`);
  }
}

const w = await startWorld();
let browser;
try {
  const s = await w.setup();
  await w.say(admin, '/start ' + s.adminCode);
  await w.say(admin, admin.name);
  await w.press(admin, 'adm_part:1');
  for (const p of people) { await w.say(p, '/start ' + s.inviteCode); await w.say(p, p.name); }
  for (const p of [admin, ...people.slice(0, 4)]) await w.api(p, 'wishlist.save', { text: LETTER(p.name) });
  await w.api(admin, 'admin.game', { budget: 'до 50 BYN', event_date: '2026-12-27', place: 'У Маши дома', deadline: '2026-12-20', notes: 'Подарок упаковать и подписать только именем получателя 🎁' });
  await w.api(admin, 'admin.exclusion.add', { giver: 101, receiver: 102, mutual: true });

  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
  browser = await chromium.launch(launch);

  async function shot(user, name, { tab, dark = false, before } = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.route('https://telegram.org/**', (r) => r.abort());
    if (dark) {
      await page.addInitScript((vars) => {
        document.addEventListener('DOMContentLoaded', () => {
          for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
        });
      }, DARK);
    }
    await page.goto(`${w.base}/app#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector('.ds-tabs:not([hidden])');
    if (tab) { await page.locator('.ds-tab', { hasText: tab }).click(); }
    await page.waitForTimeout(400);
    await checkColors(page, name + (dark ? ' (тёмная)' : ''));
    if (before) { await before(page); await page.waitForTimeout(500); }
    await page.screenshot({ path: fileURLToPath(new URL(`${name}${dark ? '-dark' : ''}.png`, OUT)), fullPage: true });
    await page.close();
    console.log('✔', name + (dark ? ' (тёмная)' : ''));
  }

  // До жеребьёвки
  await shot(people[4], '01-my-letter-empty');
  await shot(people[0], '02-my-letter');
  await shot(admin, '03-admin-before-draw', { tab: 'Админ' });

  // Жеребьёвка и правка письма подопечного (для подсветки изменений)
  await w.api(admin, 'admin.draw');
  const wardName = (await w.api(admin, 'ward.get')).ward.name;
  const ward = [admin, ...people].find((p) => p.name === wardName);
  await w.api(ward, 'wishlist.save', { text: LETTER(ward.name).replace('тёплом шарфе', 'тёплых варежках').replace('Чего точно не надо', 'И ещё настольную игру.\n\nЧего точно не надо') });

  await shot(admin, '04-ward', { tab: 'Подопечный', before: (p) => p.getByRole('button', { name: '👀 Показать имя' }).click() });
  await shot(people[1], '05-ward-hidden', { tab: 'Подопечный' });
  await shot(people[0], '06-info', { tab: 'Инфо' });
  await shot(admin, '07-admin-after-draw', { tab: 'Админ' });
  await shot(people[0], '02-my-letter', { dark: true });
  await shot(people[2], '05-ward-hidden', { tab: 'Подопечный', dark: true });
  await shot(admin, '07-admin-after-draw', { tab: 'Админ', dark: true });
  console.log('Скриншоты сохранены в test-results/');
  if (colorProblems.length) {
    console.error('✘ Цвета не соответствуют дизайн-системе:\n' + colorProblems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('✔ цвета вкладок и кнопок соответствуют дизайн-системе');
  }
} finally {
  await browser?.close();
  await w.stop();
}

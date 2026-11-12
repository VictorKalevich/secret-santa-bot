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
    if (actual === null) continue; // на главном экране вкладок нет
    if (actual !== expected) colorProblems.push(`${label}: ${what} — ${actual}, ожидалось ${expected}`);
  }
}

const w = await startWorld();
let browser;
try {
  const s = await w.setup();
  await w.say(admin, '/start ' + s.adminCode);
  await w.say(admin, admin.name);
  const A = (await w.api(admin, 'admin.events.create', { title: 'Новый год 2026 — семья' })).event.id;
  const B = (await w.api(admin, 'admin.events.create', { title: 'Офис' })).event.id;
  const inv = async (eid) => /start=(inv_[a-z0-9]+)/.exec((await w.api(admin, 'admin.state', { event: eid })).settings.invite_link)[1];
  await w.api(admin, 'admin.participate', { event: A, on: true });
  const codeA = await inv(A);
  for (const p of people) { await w.say(p, '/start ' + codeA); await w.say(p, p.name); }
  const codeB = await inv(B);
  for (const p of [people[0], people[1], people[2]]) await w.say(p, '/start ' + codeB);
  for (const p of [admin, ...people.slice(0, 4)]) await w.api(p, 'wishlist.save', { event: A, text: LETTER(p.name) });
  await w.api(admin, 'admin.game', { event: A, title: 'Новый год 2026 — семья', budget: 'до 50 BYN', event_date: '2026-12-27', place: 'У Маши дома', deadline: '2026-12-20', notes: 'Подарок упаковать и подписать только именем получателя 🎁' });
  await w.api(admin, 'admin.game', { event: B, title: 'Офис', budget: 'до 30 BYN', event_date: '2026-12-24', place: 'Переговорка', deadline: '', notes: '' });
  await w.api(admin, 'admin.exclusion.add', { event: A, giver: 101, receiver: 102, mutual: true });
  await w.api(admin, 'admin.role.grant', { id: people[0].id });

  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
  browser = await chromium.launch(launch);

  // event — открыть эвент (как из кнопки бота); без него — главный экран со списком эвентов
  async function shot(user, name, { event, tab, dark = false, before, fullPage = true } = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.route('https://telegram.org/**', (r) => r.abort());
    if (dark) {
      await page.addInitScript((vars) => {
        document.addEventListener('DOMContentLoaded', () => {
          for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
        });
      }, DARK);
    }
    const q = event ? `?event=${event}` : '';
    await page.goto(`${w.base}/app${q}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector(event ? '.ds-tabs:not([hidden])' : '.ds-list-item--link, .ds-tabs:not([hidden])');
    if (tab) { await page.locator('.ds-tab', { hasText: tab }).click(); }
    await page.waitForTimeout(400);
    await checkColors(page, name + (dark ? ' (тёмная)' : ''));
    if (before) { await before(page); await page.waitForTimeout(500); }
    await page.screenshot({ path: fileURLToPath(new URL(`${name}${dark ? '-dark' : ''}.png`, OUT)), fullPage });
    await page.close();
    console.log('✔', name + (dark ? ' (тёмная)' : ''));
  }

  // Главный экран (005): мои эвенты, другие эвенты, создание эвента, администраторы
  await shot(admin, '00-home');
  await shot(admin, '00-home', { dark: true });
  await shot(admin, '13-new-event', { fullPage: false, before: (p) => p.locator('.ds-btn', { hasText: 'Новый эвент' }).click() });
  await shot(people[1], '16-home-participant');

  // До жеребьёвки
  await shot(people[4], '01-my-letter-empty');
  await shot(people[0], '02-my-letter', { event: A });
  // 006: Катя заблокировала бота (после того как открыла приложение для скриншота 01) — в панели админа у неё метка «не получает сообщения»
  w.sql('UPDATE users SET blocked_at = 1 WHERE tg_id = 105');
  await shot(admin, '03-admin-before-draw', { event: A, tab: 'Админ' });

  // Жеребьёвка и правка письма подопечного (для подсветки изменений)
  await w.api(admin, 'admin.draw', { event: A });
  const wardName = (await w.api(admin, 'ward.get', { event: A })).ward.name;
  const ward = [admin, ...people].find((p) => p.name === wardName);
  await w.api(ward, 'wishlist.save', { event: A, text: LETTER(ward.name).replace('тёплом шарфе', 'тёплых варежках').replace('Чего точно не надо', 'И ещё настольную игру.\n\nЧего точно не надо') });

  // Переписка (003): Санта спросил, подопечный ответил — у Санты непрочитанное
  await w.api(admin, 'message.send', { event: A, to: 'ward', text: 'Привет! Какой у тебя размер перчаток? И какие цвета любишь?' });
  await w.api(ward, 'message.send', { event: A, to: 'santa', text: 'Привет, Санта! Размер M 🙂\nЛюблю зелёный и синий.' });
  await shot(admin, '04-ward', { event: A, tab: 'Подопечный', before: (p) => p.getByRole('button', { name: '👀 Показать имя' }).click() });
  await shot(admin, '09-chat-santa-view', { event: A, fullPage: false, tab: 'Подопечный', before: (p) => p.locator('.ds-btn', { hasText: 'Написать подопечному' }).click() });
  await shot(ward, '10-chat-ward-view', { event: A, fullPage: false, tab: 'Письмо', before: (p) => p.locator('.ds-btn', { hasText: 'Написать Санте' }).click() });
  await shot(ward, '10-chat-ward-view', { event: A, fullPage: false, tab: 'Письмо', dark: true, before: (p) => p.locator('.ds-btn', { hasText: 'Написать Санте' }).click() });
  await shot(people[1], '05-ward-hidden', { event: A, tab: 'Подопечный' });
  await shot(people[0], '06-info', { event: A, tab: 'Инфо' });
  await shot(admin, '07-admin-after-draw', { event: A, tab: 'Админ' });
  await shot(people[0], '08-admin-as-regular-admin', { event: A, tab: 'Админ' });
  await shot(admin, '08b-admin-not-member', { event: B, tab: 'Админ' });
  await shot(admin, '11-participant-menu', { event: A, fullPage: false, tab: 'Админ', before: (p) => p.locator('.ds-icon-btn[title="Действия с участником"]').nth(2).click() });
  await shot(admin, '12-danger-zone', { event: A, fullPage: false, tab: 'Админ', before: async (p) => {
    await p.locator('.ds-btn', { hasText: 'Полный сброс эвента' }).click();
    await p.locator('.ds-sheet .ds-input').fill('СБРОС');
  } });
  await shot(people[0], '02-my-letter', { event: A, dark: true });
  await shot(people[2], '05-ward-hidden', { event: A, tab: 'Подопечный', dark: true });
  await shot(admin, '07-admin-after-draw', { event: A, tab: 'Админ', dark: true });

  // Завершённый эвент (005): письмо только для чтения, переписка ещё неделю
  await w.api(admin, 'admin.reveal', { event: A });
  await w.api(admin, 'admin.event.finish', { event: A });
  await shot(people[0], '14-finished-letter', { event: A });
  await shot(admin, '15-finished-ward', { event: A, tab: 'Подопечный' });
  await shot(people[1], '16-home-participant', { dark: true });
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

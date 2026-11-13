// Скриншоты мини-приложения в светлой и тёмной теме Telegram (для визуальной проверки).
// Запуск: npm run screenshots   (нужен установленный Google Chrome или переменная CHROME_PATH)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startWorld, initData } from './harness.mjs';

const OUT = new URL('../test-results/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// Telegram SDK ставит --tg-color-scheme на <html>; здесь SDK заблокирован — ставим сами (011)
const LIGHT = { '--tg-color-scheme': 'light' };
const DARK = {
  '--tg-color-scheme': 'dark',
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
  // 008: адрес доставки в эвенте A, семья, заявка в эвент B
  await w.api(admin, 'admin.game', { event: A, delivery_on: true });
  for (const p of [admin, ...people.slice(0, 3)]) {
    await w.api(p, 'delivery.save', { event: A, text: `Минск, Европочта, отделение 15 — ${p.name}, +375 29 000-00-0${p.id % 10}` });
  }
  await w.api(admin, 'admin.family.save', { name: 'Ивановы', members: [103, 104] });
  await w.api(admin, 'admin.game', { event: B, approval: true });
  const stepa = { id: 130, name: 'Стёпа', username: 'stepa' };
  await w.say(stepa, '/start ' + codeB);
  await w.say(stepa, stepa.name);

  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
  browser = await chromium.launch(launch);

  // 011: раскрытый список и пункты — в схеме темы: color-scheme как у Telegram, пункты — surface/text
  async function checkScheme(page, label, expected) {
    const r = await page.evaluate(() => {
      const paint = (prop, name) => {
        const d = document.createElement('div');
        d.style[prop] = `var(${name})`;
        document.body.append(d);
        const c = getComputedStyle(d)[prop];
        d.remove();
        return c;
      };
      const sel = document.createElement('select');
      sel.className = 'ds-input';
      const opt = document.createElement('option');
      opt.textContent = 'x';
      sel.append(opt);
      document.body.append(sel);
      const out = {
        scheme: getComputedStyle(sel).colorScheme,
        optBg: getComputedStyle(opt).backgroundColor, surface: paint('backgroundColor', '--ds-color-surface'),
        optColor: getComputedStyle(opt).color, text: paint('color', '--ds-color-text'),
      };
      sel.remove();
      return out;
    });
    if (r.scheme !== expected) colorProblems.push(`${label}: color-scheme списка — ${r.scheme}, ожидалось ${expected}`);
    if (r.optBg !== r.surface) colorProblems.push(`${label}: фон пункта списка — ${r.optBg}, ожидалось ${r.surface}`);
    if (r.optColor !== r.text) colorProblems.push(`${label}: текст пункта списка — ${r.optColor}, ожидалось ${r.text}`);
  }

  // 011: открытая шторка не отдаёт прокрутку колеса странице; после закрытия страница прокручивается и стоит на месте
  async function checkSheetScroll(user, event) {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    await page.route('https://telegram.org/**', (r) => r.abort());
    await page.goto(`${w.base}/app?event=${event}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector('.ds-tabs:not([hidden])');
    await page.locator('.ds-tab', { hasText: 'Админ' }).click();
    const logBtn = page.locator('.ds-btn', { hasText: 'Журнал действий' });
    await logBtn.waitFor();
    await logBtn.scrollIntoViewIfNeeded();
    await logBtn.click();
    await page.waitForSelector('.ds-sheet .ds-list-item, .ds-sheet .ds-hint');
    const y = () => page.evaluate(() => window.scrollY);
    const y1 = await y();
    const problems = [];
    if (!(await page.evaluate(() => document.body.classList.contains('ds-root--locked')))) problems.push('нет ds-root--locked при открытой шторке');
    await page.mouse.move(195, 500); await page.mouse.wheel(0, 3000); await page.waitForTimeout(300);
    await page.mouse.move(195, 20); await page.mouse.wheel(0, -3000); await page.waitForTimeout(300);
    await page.mouse.move(195, 20); await page.mouse.wheel(0, 3000); await page.waitForTimeout(300);
    if ((await y()) !== y1) problems.push(`страница прокрутилась под шторкой: ${y1} → ${await y()}`);
    const sheetScrolled = await page.evaluate(() => document.querySelector('.ds-sheet').scrollTop);
    await page.locator('.ds-sheet .ds-icon-btn', { hasText: '✕' }).click();
    if (await page.evaluate(() => document.body.classList.contains('ds-root--locked'))) problems.push('ds-root--locked остался после закрытия');
    if ((await y()) !== y1) problems.push(`после закрытия страница не на месте: ${y1} → ${await y()}`);
    await page.mouse.move(195, 300); await page.mouse.wheel(0, y1 > 0 ? -200 : 200); await page.waitForTimeout(300);
    if ((await y()) === y1) problems.push('после закрытия шторки страница не прокручивается');
    await page.close();
    if (problems.length) colorProblems.push(...problems.map((x) => 'шторка: ' + x));
    else console.log(`✔ шторка держит прокрутку (страница ${y1}, шторка прокручена на ${sheetScrolled})`);
  }

  // 011: поле даты — рисунок календаря справа на отступе поля (как «галочка» списка), высота как у текстового поля;
  // «Сбросить» в календаре (очистка без клавиатуры) закрывает календарь — снимает фокус; стирание с клавиатуры — нет
  async function checkDateFields(user, event) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://telegram.org/**', (r) => r.abort());
    await page.goto(`${w.base}/app?event=${event}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector('.ds-tabs:not([hidden])');
    await page.locator('.ds-tab', { hasText: 'Админ' }).click();
    await page.waitForSelector('input.ds-input[type="date"]');
    const problems = [];
    const dates = page.locator('input.ds-input[type="date"]');
    const count = await dates.count();
    if (count !== 3) problems.push(`полей даты ${count}, ожидалось 3 (вручение, письмо до, автожеребьёвка)`);
    const textH = await page.locator('input.ds-input[type="text"]').first().evaluate((e) => e.getBoundingClientRect().height);
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const indicators = [];
    (function walk(n) {
      if (n.attributes?.includes('-webkit-calendar-picker-indicator')) indicators.push(n.nodeId);
      for (const k of [...(n.children || []), ...(n.shadowRoots || [])]) walk(k);
    })(root);
    const bleed = 2; // --ds-date-icon-bleed
    for (let i = 0; i < count; i++) {
      const box = await dates.nth(i).evaluate((e) => { const r = e.getBoundingClientRect(); return { right: r.right, h: r.height }; });
      if (Math.abs(box.h - textH) > 0.5) problems.push(`поле даты ${i + 1}: высота ${box.h}, у текстового поля ${textH}`);
      const { model } = await cdp.send('DOM.getBoxModel', { nodeId: indicators[i] });
      const inset = box.right - model.border[2] + bleed; // рисунок отстоит от края значка на bleed
      if (Math.abs(inset - 12) > 1) problems.push(`поле даты ${i + 1}: значок календаря на ${inset} px от края, ожидалось 12`);
    }
    const focused = (i) => dates.nth(i).evaluate((e) => document.activeElement === e);
    // дата вручения заполнена: Backspace стирает день → значение пустое, но фокус остаётся
    await dates.nth(0).focus();
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);
    if (await dates.nth(0).inputValue()) problems.push('Backspace не очистил дату вручения — проверка клавиатуры не сработала');
    if (!(await focused(0))) problems.push('стирание с клавиатуры сняло фокус с поля даты');
    // «Сбросить»: календарь сам ставит пустое значение и шлёт input/change (без нажатий клавиш)
    await dates.nth(2).focus();
    await dates.nth(2).evaluate((e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(100);
    if (await focused(2)) problems.push('«Сбросить» не закрыл календарь: поле осталось в фокусе');
    await page.close();
    if (problems.length) colorProblems.push(...problems.map((x) => 'дата: ' + x));
    else console.log('✔ поля даты: значок на отступе поля, высота как у текста, «Сбросить» закрывает календарь');
  }

  // event — открыть эвент (как из кнопки бота); без него — главный экран со списком эвентов
  async function shot(user, name, { event, tab, dark = false, before, fullPage = true } = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.route('https://telegram.org/**', (r) => r.abort());
    await page.addInitScript((vars) => {
      document.addEventListener('DOMContentLoaded', () => {
        for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
      });
    }, dark ? DARK : LIGHT);
    const q = event ? `?event=${event}` : '';
    await page.goto(`${w.base}/app${q}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector(event ? '.ds-tabs:not([hidden])' : '.ds-list-item--link, .ds-tabs:not([hidden])');
    if (tab) { await page.locator('.ds-tab', { hasText: tab }).click(); }
    await page.waitForTimeout(400);
    await checkColors(page, name + (dark ? ' (тёмная)' : ''));
    await checkScheme(page, name + (dark ? ' (тёмная)' : ''), dark ? 'dark' : 'light');
    if (before) { await before(page); await page.waitForTimeout(500); }
    await page.screenshot({ path: fileURLToPath(new URL(`${name}${dark ? '-dark' : ''}.png`, OUT)), fullPage });
    await page.close();
    console.log('✔', name + (dark ? ' (тёмная)' : ''));
  }

  // Главный экран (005): мои эвенты, другие эвенты, создание эвента, администраторы
  await shot(admin, '00-home');
  await shot(admin, '00-home', { dark: true });
  await shot(admin, '13-new-event', { fullPage: false, before: (p) => p.locator('.ds-btn', { hasText: 'Создать' }).click() });
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
  // 007: объявление во вкладке «Инфо», отметка «получил подарок», журнал действий
  await w.api(admin, 'admin.announce', { event: A, text: 'Собираемся 27 декабря в 18:00 у Маши. Подарки кладём под ёлку, подписываем только именем получателя 🎄' });
  await w.api(ward, 'ward.received', { event: A, received: true });
  await shot(people[0], '06-info', { event: A, tab: 'Инфо' });
  await shot(ward, '17-my-gift-received', { event: A, tab: 'Письмо' });
  await shot(admin, '07-admin-after-draw', { event: A, tab: 'Админ' });
  await shot(people[0], '08-admin-as-regular-admin', { event: A, tab: 'Админ' });
  await shot(admin, '08b-admin-not-member', { event: B, tab: 'Админ' });
  // 012: вопрос организатору — «Инфо» → «Нужна помощь?», переписка участника, раздел «Обращения», шторка обращения
  await w.api(people[2], 'support.send', { event: A, text: 'Не могу найти, где отметить, что подарок готов 🙈' });
  const sup = await w.api(people[3], 'support.send', { event: A, text: 'Можно поменять адрес доставки после жеребьёвки?' });
  await w.api(people[0], 'admin.support.send', { event: A, thread: sup.thread, text: 'Да, во вкладке «Письмо» — Санта сразу увидит новый адрес.' });
  await shot(people[3], '24-info-support', { event: A, tab: 'Инфо' });
  const openMySupport = (p) => p.locator('.ds-btn', { hasText: 'Написать организатору' }).click();
  await shot(people[3], '25-support-chat', { event: A, fullPage: false, tab: 'Инфо', before: openMySupport });
  await shot(people[3], '25-support-chat', { event: A, fullPage: false, tab: 'Инфо', dark: true, before: openMySupport });
  await shot(admin, '26-admin-support', { event: A, fullPage: false, tab: 'Админ', before: (p) => p.locator('.ds-section-title', { hasText: 'Обращения' }).evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }) });
  const openThread = (name) => (p) => p.locator('.ds-list-item--link', { hasText: name }).click();
  await shot(admin, '27-support-thread', { event: A, fullPage: false, tab: 'Админ', before: openThread('Олег') });
  await shot(admin, '27-support-thread-free', { event: A, fullPage: false, tab: 'Админ', before: openThread('Аня') });
  await shot(admin, '18-audit', { event: A, fullPage: false, tab: 'Админ', before: (p) => p.locator('.ds-btn', { hasText: 'Журнал действий' }).click() });
  await shot(admin, '11-participant-menu', { event: A, fullPage: false, tab: 'Админ', before: (p) => p.locator('.ds-icon-btn[title="Действия с участником"]').nth(2).click() });
  await shot(admin, '12-danger-zone', { event: A, fullPage: false, tab: 'Админ', before: async (p) => {
    await p.locator('.ds-btn', { hasText: 'Полный сброс' }).click();
    await p.locator('.ds-sheet .ds-input').fill('СБРОС');
  } });
  // 012: принудительная отмена жеребьёвки владельцем (подопечных уже открыли)
  await shot(admin, '28-force-cancel', { event: A, fullPage: false, tab: 'Админ', before: async (p) => {
    await p.locator('.ds-btn--danger', { hasText: 'Отменить жеребьёвку' }).click();
    await p.locator('.ds-sheet .ds-input').fill('ОТМЕНА');
  } });
  // 010: служебный просмотр владельца — вход словом, участник, все пары; журнал с открытиями
  const vaultIn = async (p) => {
    await p.locator('.ds-btn', { hasText: 'Открыть служебный просмотр' }).click();
    await p.locator('.ds-sheet .ds-input').fill('ОТКРЫТЬ');
  };
  await shot(admin, '19-vault-gate', { event: A, fullPage: false, tab: 'Админ', before: vaultIn });
  await shot(admin, '20-vault-person', { event: A, fullPage: false, tab: 'Админ', before: async (p) => {
    await vaultIn(p);
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Войти' }).click();
    await p.locator('.ds-sheet select').selectOption(String(ward.id === admin.id ? people[0].id : ward.id));
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Открыть участника' }).click();
    await p.waitForSelector('.ds-sheet .ds-info-grid');
  } });
  await shot(admin, '21-vault-pairs', { event: A, fullPage: false, tab: 'Админ', before: async (p) => {
    p.once('dialog', (d) => d.accept());
    await vaultIn(p);
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Войти' }).click();
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Показать все пары' }).click();
    await p.waitForSelector('.ds-sheet .ds-section-title');
  } });
  await shot(admin, '23-audit-vault', { event: A, fullPage: false, tab: 'Админ', before: (p) => p.locator('.ds-btn', { hasText: 'Журнал действий' }).click() });
  // 010: запрет возврата и список «Удалённые» в эвенте B
  await w.api(admin, 'admin.game', { event: B, rejoin: false });
  await w.api(admin, 'admin.remove', { event: B, id: people[1].id });
  await shot(admin, '22-removed-list', { event: B, tab: 'Админ' });
  await checkDateFields(admin, B);
  await shot(people[0], '02-my-letter', { event: A, dark: true });
  await shot(people[2], '05-ward-hidden', { event: A, tab: 'Подопечный', dark: true });
  await shot(admin, '07-admin-after-draw', { event: A, tab: 'Админ', dark: true });

  // Завершённый эвент (005): письмо только для чтения, переписка ещё неделю
  await w.api(admin, 'admin.reveal', { event: A });
  await w.api(admin, 'admin.event.finish', { event: A });
  await shot(people[0], '14-finished-letter', { event: A });
  await shot(admin, '15-finished-ward', { event: A, tab: 'Подопечный' });
  await shot(people[1], '16-home-participant', { dark: true });
  await checkSheetScroll(admin, A);
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

// Скриншоты мини-приложения в светлой и тёмной теме Telegram (для визуальной проверки).
// Запуск: npm run screenshots   (нужен установленный Google Chrome или переменная CHROME_PATH)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startWorld, initData, waitFor } from './harness.mjs';
import { TELEGRAM_SCRIPT } from '../src/csp.js';
import { LANGUAGES } from '../src/i18n/index.js';

const OUT = new URL('../test-results/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// 032: настоящий скрипт Telegram — для проверки фрейма веб-клиента (checkCsp); без сети эта часть пропускается
async function telegramScript() {
  try {
    const res = await fetch(TELEGRAM_SCRIPT, { signal: AbortSignal.timeout(10000) });
    return res.ok ? { text: await res.text() } : { error: 'HTTP ' + res.status };
  } catch (e) {
    return { error: e.message };
  }
}
const TG_SCRIPT = await telegramScript();

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
  const A = (await w.api(admin, 'event.create', { participate: false, title: 'Новый год 2026 — семья' })).event.id;
  const B = (await w.api(admin, 'event.create', { participate: false, title: 'Офис' })).event.id;
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
  await w.api(admin, 'admin.fixed.add', { event: A, giver: 103, receiver: 101 }); // 014: блок видит только владелец
  await w.api(admin, 'admin.role.grant', { event: A, id: people[0].id }); // 063: администратор этого события
  // 008: заявка в эвент B (адреса доставки нет с 064)
  await w.api(admin, 'admin.game', { event: B, approval: true });
  const stepa = { id: 130, name: 'Стёпа', username: 'stepa' };
  await w.say(stepa, '/start ' + codeB);
  await w.say(stepa, stepa.name);

  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
  browser = await chromium.launch(launch);

  // Каждая страница прогона: скрипт Telegram заблокирован (снимки не зависят от сети), нарушения политики страницы (032)
  // собираются — обработчик ставят средства отладки браузера, политика страницы его не ограничивает. own — свой список
  // нарушений (пробы «от противного»), иначе — общий: на обычных страницах нарушений быть не должно.
  const cspSeen = [];
  let pagesOpened = 0;
  async function openPage(what, options, { own = null } = {}) {
    const page = await browser.newPage(options);
    if (!own) pagesOpened++;
    await page.exposeFunction('__cspViolation', (v) => (own ? own.push(v) : cspSeen.push(`${what}: ${v.directive} ${v.blocked}`)));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) =>
      window.__cspViolation({ directive: e.effectiveDirective, blocked: e.blockedURI || '', sample: e.sample || '' })));
    await page.route('https://telegram.org/**', (r) => r.abort());
    return page;
  }
  // Тема Telegram на странице: SDK заблокирован — переменные темы ставим сами (011)
  const paintTheme = (page, dark) => page.addInitScript((vars) => {
    document.addEventListener('DOMContentLoaded', () => {
      for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
    });
  }, dark ? DARK : LIGHT);
  const snapPath = (name) => fileURLToPath(new URL(`${name}.png`, OUT));
  // «Мои события» построены (063): ⚙️ в шапке видна только у главного экрана; список может быть пустым или свёрнутым
  const HOME_READY = '#heroAction:not([hidden]), .ds-tabs:not([hidden])';

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
    const page = await openPage('шторка: прокрутка', { viewport: { width: 390, height: 600 } });
    await page.goto(`${w.base}/app?event=${event}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector('.ds-tabs:not([hidden])');
    await page.locator('.ds-tab', { hasText: 'Управление' }).click();
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
    const page = await openPage('поля даты', { viewport: { width: 390, height: 844 } });
    await page.goto(`${w.base}/app?event=${event}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector('.ds-tabs:not([hidden])');
    await page.locator('.ds-tab', { hasText: 'Управление' }).click();
    await page.waitForSelector('input.ds-input[type="date"]');
    const problems = [];
    const dates = page.locator('input.ds-input[type="date"]');
    const count = await dates.count();
    // 027: у «Автожеребьёвки» свой календарь (checkTweaks) — системных полей два
    if (count !== 2) problems.push(`полей даты ${count}, ожидалось 2 (вручение, письмо до)`);
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
    await dates.nth(1).focus();
    await dates.nth(1).evaluate((e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(100);
    if (await focused(1)) problems.push('«Сбросить» не закрыл календарь: поле осталось в фокусе');
    await page.close();
    if (problems.length) colorProblems.push(...problems.map((x) => 'дата: ' + x));
    else console.log('✔ поля даты: значок на отступе поля, высота как у текста, «Сбросить» закрывает календарь');
  }

  // Проверка на своей странице (без SDK Telegram: подтверждения — окном браузера); сбой ожидания — нарушение в problems,
  // а не падение скрипта. event — экран события; без него — главный экран
  async function onPage(problems, what, user, event, fn, options = {}) {
    const page = await openPage(what, { viewport: { width: 390, height: 844 }, ...options });
    try {
      await page.goto(`${w.base}/app${event ? `?event=${event}` : ''}#tgWebAppData=${encodeURIComponent(initData(user))}`);
      await page.waitForSelector(event ? '.ds-tabs:not([hidden])' : HOME_READY);
      await fn(page);
    } catch (e) {
      problems.push(`${what}: ${e.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }

  // 027: свой календарь автожеребьёвки, подсказка названия, отступ над «Вопрос решён» (правила по коду —
  // tests/app-tweaks.test.mjs). Событие B — до жеребьёвки (поле «Автожеребьёвка» есть, дата не задана); в A у people[3]
  // открыто обращение. Дата, которую ставит проверка, к концу снята — снимки после неё B не меняют.
  async function checkTweaks() {
    const problems = [];
    const NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const now = new Date();
    const nx = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const cur = `${NOM[now.getMonth()]} ${now.getFullYear()}`;
    const nextTitle = `${NOM[nx.getMonth()]} ${nx.getFullYear()}`;
    const pickedIso = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, '0')}-15`;
    const pickedText = `15 ${GEN[nx.getMonth()]} ${nx.getFullYear()}`;
    const serverDate = async () => (await w.api(admin, 'admin.state', { event: B })).settings.draw_auto_date;

    await onPage(problems, 'календарь автожеребьёвки', admin, B, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      const field = page.locator('.ds-field', { hasText: 'Автожеребьёвка' }).locator('button.ds-input--pick');
      await field.waitFor({ timeout: 5000 });
      const text = () => field.textContent();
      const sheet = page.locator('.ds-sheet');
      const title = sheet.locator('.ds-calendar__title');
      const selected = sheet.locator('.ds-calendar__day--selected');
      const done = sheet.locator('.ds-btn', { hasText: /^Готово$/ });
      const reset = sheet.locator('.ds-btn', { hasText: /^Сбросить$/ });
      const closeBtn = sheet.locator('.ds-btn', { hasText: /^Закрыть$/ });
      const height = () => sheet.evaluate((e) => e.getBoundingClientRect().height); // sheet — сама .ds-sheet
      const prev = sheet.locator('.ds-icon-btn[title="Предыдущий месяц"]');
      const next = sheet.locator('.ds-icon-btn[title="Следующий месяц"]');
      const day = (n) => sheet.locator('.ds-calendar__day', { hasText: new RegExp(`^${n}$`) });
      const open = async () => { await field.click(); await page.locator('.ds-sheet__title', { hasText: 'Автожеребьёвка' }).waitFor({ timeout: 3000 }); };
      // «Сохранено» — после тихой перестройки панели (026): до неё поле на экране ещё прежнее
      const save = async (want) => {
        await page.locator('.ds-btn', { hasText: /^Сохранить$/ }).click();
        await waitFor(async () => (await serverDate()) === want, `на сервере draw_auto_date = «${want}»`, 5000);
        await page.locator('#toast.ds-toast--visible', { hasText: 'Сохранено' }).waitFor({ timeout: 5000 });
      };

      if ((await text()) !== 'Не выбрана') problems.push(`пустое поле — «${await text()}», ожидалось «Не выбрана»`);
      // Без даты: текущий месяц, ничего не выделено, «Готово» недоступна, «Сбросить» нет, назад нельзя, вчера бледное
      await open();
      if ((await title.textContent()) !== cur) problems.push(`без даты открыт месяц «${await title.textContent()}», ожидался «${cur}»`);
      if (await selected.count()) problems.push('без даты выделен день');
      if (!(await done.isDisabled())) problems.push('без выбранного дня «Готово» доступна');
      if (await reset.count()) problems.push('без даты есть «Сбросить»');
      if (!(await closeBtn.count())) problems.push('без даты нет «Закрыть» (028: вторая кнопка видна всегда)');
      if (!(await prev.isDisabled())) problems.push('на текущем месяце «‹» доступна');
      if (now.getDate() > 1 && !(await day(now.getDate() - 1).isDisabled())) problems.push('вчерашний день доступен');
      if (await day(now.getDate()).isDisabled()) problems.push('сегодняшний день недоступен');
      await next.click();
      if ((await title.textContent()) !== nextTitle) problems.push(`«›» — «${await title.textContent()}», ожидался «${nextTitle}»`);
      await prev.click();
      if ((await title.textContent()) !== cur) problems.push(`«‹» — «${await title.textContent()}», ожидался «${cur}»`);
      // Выбор дня делает «Готово» доступной; закрытие ✕ поле не меняет
      await next.click();
      await day(15).click();
      if ((await selected.count()) !== 1 || (await selected.textContent()) !== '15') problems.push('выбранный день не выделен (или выделен не один)');
      if (await done.isDisabled()) problems.push('после выбора дня «Готово» недоступна');
      await sheet.locator('.ds-icon-btn[title="Закрыть"]').click();
      if ((await text()) !== 'Не выбрана') problems.push(`закрытие ✕ поменяло поле: «${await text()}»`);
      await open();
      if (await selected.count()) problems.push('после закрытия ✕ при новом открытии выделен день');
      // 028: высота шторки одна на месяцах с 4, 5 и 6 неделями (неделя с понедельника)
      const heights = new Map();
      for (let k = 0, d = new Date(now.getFullYear(), now.getMonth(), 1); k < 24 && heights.size < 3; k++, d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const weeks = Math.ceil(((d.getDay() + 6) % 7 + new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) / 7);
        if (!heights.has(weeks)) heights.set(weeks, await height());
        await next.click();
      }
      if (new Set(heights.values()).size !== 1) problems.push(`высота шторки по числу недель: ${JSON.stringify(Object.fromEntries(heights))} — должна быть одна`);
      // 028: «Закрыть» без даты — шторка закрыта, поле прежнее
      await day(15).click();
      await closeBtn.click();
      if (await sheet.count()) problems.push('«Закрыть» не закрыла календарь');
      if ((await text()) !== 'Не выбрана') problems.push(`«Закрыть» поменяла поле: «${await text()}»`);
      // 028: драгер — короткий свайп возвращает шторку, длинный закрывает
      await open();
      const handle = sheet.locator('.ds-sheet__handle');
      if (!(await handle.count())) problems.push('у шторки календаря нет драгера');
      else {
        const box = await handle.boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 20, { steps: 4 }); await page.mouse.up();
        await page.waitForTimeout(500);
        if (!(await sheet.count())) problems.push('короткий свайп драгера закрыл шторку');
        else if ((await sheet.evaluate((e) => getComputedStyle(e).transform)) !== 'none') problems.push('после короткого свайпа шторка не вернулась на место');
        const h = await height();
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + h / 2, { steps: 12 }); await page.mouse.up();
        await page.waitForTimeout(800);
        if (await sheet.count()) problems.push('свайп драгера на половину высоты не закрыл шторку');
        if ((await text()) !== 'Не выбрана') problems.push(`свайп поменял поле: «${await text()}»`);
      }
      await open();
      // «Готово» → дата в поле → «Сохранить» → на сервере
      await next.click();
      await day(15).click();
      await done.click();
      if (await sheet.count()) problems.push('«Готово» не закрыла календарь');
      if ((await text()) !== pickedText) problems.push(`после «Готово» поле — «${await text()}», ожидалось «${pickedText}»`);
      await save(pickedIso);
      // С датой: её месяц, день выделен, «Готово» доступна; «Сбросить» → пусто → на сервере ''
      await open();
      if ((await title.textContent()) !== nextTitle) problems.push(`с датой открыт месяц «${await title.textContent()}», ожидался «${nextTitle}»`);
      if ((await selected.count()) !== 1 || (await selected.textContent()) !== '15') problems.push('с датой её день не выделен');
      if (await done.isDisabled()) problems.push('с датой «Готово» недоступна');
      await reset.click();
      if (await sheet.count()) problems.push('«Сбросить» не закрыл календарь');
      if ((await text()) !== 'Не выбрана') problems.push(`после «Сбросить» поле — «${await text()}»`);
      await save('');
    });

    await onPage(problems, 'подсказка названия', admin, null, async (page) => {
      await page.getByRole('button', { name: '🎄 Создать событие', exact: true }).click();
      const hint = await page.locator('.ds-sheet input.ds-input[type="text"]').getAttribute('placeholder');
      const want = `Новый год ${now.getFullYear() + 1} — семья`; // 064: без «Например: »
      if (hint !== want) problems.push(`подсказка названия — «${hint}», ожидалось «${want}»`);
    });

    await onPage(problems, 'отступ над «Вопрос решён»', people[3], A, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      await page.locator('.ds-btn', { hasText: 'Задать вопрос' }).first().click();
      const btn = page.locator('.ds-sheet .ds-btn', { hasText: 'Вопрос решён' });
      await btn.waitFor({ timeout: 5000 });
      const a = await page.locator('.ds-sheet .ds-composer').boundingBox();
      const b = await btn.boundingBox();
      const gap = Math.round(b.y - (a.y + a.height));
      if (gap < 12) problems.push(`между полем ввода и «Вопрос решён» ${gap} px, ожидалось не меньше 12`);
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'правки 027–028: ' + x));
    else console.log('✔ правки 027–028: календарь автожеребьёвки без выбранного дня, «Готово» после выбора, «Закрыть» без даты, одна высота, драгер, подсказка названия — следующий год, отступ над «Вопрос решён»');
  }

  // 033: драгер у каждой шторки (правила по коду — tests/design-system.test.mjs, правило 7 tests/app-tweaks.test.mjs).
  // Журнал — длинная шторка (полоса у верха прокрученной), переписка — на весь экран и с вопросом о неотправленном,
  // меню участника → «Имя участника» — смена шторки; жест Telegram — на заглушке SDK. Событие A — после жеребьёвки,
  // admin — Санта; ничего не отправляется и не сохраняется.
  async function checkSheetHandle() {
    const problems = [];
    const sheetOpen = (page) => page.locator('.ds-sheet').count();
    // Полоса — первая в шторке и у её верхнего края; null — всё так, иначе что не так
    const topProblem = (page) => page.evaluate(() => {
      const s = document.querySelector('.ds-sheet');
      const bar = s && s.firstElementChild;
      if (!bar || !bar.classList.contains('ds-sheet__handle')) return 'первая в шторке — не полоса драгера';
      const gap = Math.round(bar.getBoundingClientRect().top - s.getBoundingClientRect().top);
      return !gap ? null : gap > 0 ? `полоса на ${gap} px ниже верха шторки` : `полоса уехала с прокруткой на ${-gap} px выше верха шторки`;
    });
    const atTop = async (page, what) => { const p = await topProblem(page); if (p) problems.push(`${what}: ${p}`); };
    // Свайп за полосу на dy px (по центру полосы); после — время на возврат или уход шторки
    const swipe = async (page, dy) => {
      const box = await page.locator('.ds-sheet__handle').boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x, y + dy, { steps: dy > 50 ? 12 : 4 }); await page.mouse.up();
      await page.waitForTimeout(800);
    };
    const half = (page) => page.locator('.ds-sheet').evaluate((e) => e.getBoundingClientRect().height / 2);
    const settled = (page) => page.locator('.ds-sheet').evaluate((e) => getComputedStyle(e).transform === 'none');

    await onPage(problems, 'драгер: журнал', admin, A, async (page) => {
      await page.setViewportSize({ width: 390, height: 500 });
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('#main .ds-btn', { hasText: 'Журнал действий' }).click();
      await page.waitForSelector('.ds-sheet .ds-list-item');
      await atTop(page, 'журнал');
      const scrolled = await page.locator('.ds-sheet').evaluate((e) => { e.scrollTop = e.scrollHeight; return e.scrollTop; });
      if (!scrolled) problems.push('журнал не прокручивается — прилипание полосы не проверено');
      await atTop(page, 'прокрученный журнал');
      await swipe(page, 20);
      if (!(await sheetOpen(page))) problems.push('журнал: короткий свайп закрыл шторку');
      else if (!(await settled(page))) problems.push('журнал: после короткого свайпа шторка не вернулась на место');
      await swipe(page, await half(page));
      if (await sheetOpen(page)) problems.push('журнал: свайп на половину высоты не закрыл шторку');
      if (await page.evaluate(() => document.body.classList.contains('ds-root--locked'))) problems.push('журнал: после свайпа осталась ds-root--locked');
    });

    await onPage(problems, 'драгер: переписка', admin, A, async (page) => {
      const open = async () => {
        await page.locator('.ds-btn', { hasText: 'Написать подопечному' }).click();
        await page.locator('.ds-sheet__title', { hasText: 'Переписка с подопечным' }).waitFor({ timeout: 5000 });
      };
      await page.locator('.ds-tab', { hasText: 'Подопечный' }).click();
      await open();
      await atTop(page, 'переписка (на весь экран)');
      await swipe(page, await half(page));
      if (await sheetOpen(page)) problems.push('переписка без текста: свайп на половину высоты не закрыл шторку');
      await open();
      const input = page.locator('.ds-sheet .ds-composer__input');
      await input.fill('Черновик Санты');
      let asked = null;
      page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
      await swipe(page, await half(page));
      if (asked === null) problems.push('переписка с текстом: свайп закрыл без вопроса о неотправленном');
      if (!(await sheetOpen(page))) problems.push('переписка с текстом: «Отмена» в вопросе, а шторка закрыта');
      else {
        if (!(await settled(page))) problems.push('переписка: после «Отмена» шторка не вернулась на место');
        if ((await input.inputValue()) !== 'Черновик Санты') problems.push(`переписка: после «Отмена» в поле «${await input.inputValue()}»`);
        page.once('dialog', (d) => d.accept());
        await swipe(page, await half(page));
        if (await sheetOpen(page)) problems.push('переписка с текстом: «ОК» в вопросе, а шторка открыта');
      }
    });

    // Жест Telegram «свайп вниз»: заглушка SDK (скрипт Telegram на страницах прогона заблокирован), версия «старая» —
    // подтверждения окном браузера, данные — из адреса
    const page = await openPage('драгер: жест Telegram', { viewport: { width: 390, height: 844 } });
    try {
      await page.addInitScript(() => {
        window.__swipes = [];
        window.Telegram = { WebApp: {
          initData: '', isVerticalSwipesEnabled: true, ready() {}, expand() {}, isVersionAtLeast: () => false,
          disableVerticalSwipes() { this.isVerticalSwipesEnabled = false; window.__swipes.push('off'); },
          enableVerticalSwipes() { this.isVerticalSwipesEnabled = true; window.__swipes.push('on'); },
        } };
      });
      await page.goto(`${w.base}/app?event=${A}#tgWebAppData=${encodeURIComponent(initData(admin))}`);
      await page.waitForSelector('.ds-tabs:not([hidden])');
      const swipes = () => page.evaluate(() => [window.Telegram.WebApp.isVerticalSwipesEnabled, window.__swipes.join(' ')]);
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('.ds-icon-btn[title="Действия с участником"]').first().click();
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Переименовать' }).waitFor({ timeout: 5000 });
      await atTop(page, 'меню участника');
      let [on, log] = await swipes();
      if (on) problems.push(`жест Telegram при открытой шторке включён (${log})`);
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Переименовать' }).click();
      await page.locator('.ds-sheet__title', { hasText: 'Имя участника' }).waitFor({ timeout: 3000 });
      await atTop(page, '«Имя участника»');
      [on, log] = await swipes();
      if (on || log !== 'off on off') problems.push(`шторка сменила шторку — жест Telegram ${on ? 'включён' : 'выключен'}, вызовы «${log}», ожидалось «off on off»`);
      await swipe(page, await half(page));
      if (await sheetOpen(page)) problems.push('«Имя участника»: свайп на половину высоты не закрыл шторку');
      [on, log] = await swipes();
      if (!on || log !== 'off on off on') problems.push(`после закрытия жест Telegram ${on ? 'включён' : 'выключен'}, вызовы «${log}», ожидалось «off on off on»`);
      // Жест выключен до шторки (клиент или другой код) — шторка его не включает
      await page.evaluate(() => { window.Telegram.WebApp.isVerticalSwipesEnabled = false; window.__swipes = []; });
      await page.locator('#main .ds-btn', { hasText: 'Журнал действий' }).click();
      await page.locator('.ds-sheet__title', { hasText: 'Журнал события' }).waitFor({ timeout: 5000 });
      await page.locator('.ds-sheet .ds-icon-btn[title="Закрыть"]').click();
      [on, log] = await swipes();
      if (on || log) problems.push(`жест был выключен до шторки — после неё ${on ? 'включён' : 'выключен'}, вызовы «${log}»`);
    } catch (e) {
      problems.push(`драгер: жест Telegram: ${e.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }

    if (problems.length) colorProblems.push(...problems.map((x) => 'драгер (033): ' + x));
    else console.log('✔ драгер у шторок (033): полоса первой и у верха (журнал, прокрученный журнал, переписка, меню, «Имя участника»), свайп закрывает, короткий — нет, вопрос о неотправленном — «Отмена» оставляет шторку с текстом, жест Telegram выключен на время шторок и возвращён');
  }

  // 026: недочёты интерфейса — поведение, которое видно только в браузере (правила по коду — tests/app-ui.test.mjs).
  // Идёт после всех снимков: событие «Проверка» и открытия обращений снимков не меняют.
  async function checkUiFixes() {
    const problems = [];
    const step = (what, user, event, fn) => onPage(problems, what, user, event, fn);
    const tab = (page, name) => page.locator('.ds-tab', { hasText: name }).click();
    const sheetTitle = (page) => page.locator('.ds-sheet__title').textContent();
    const closeSheetBtn = (page) => page.locator('.ds-sheet .ds-icon-btn[title="Закрыть"]').click();
    const loadFailed = (page) => page.locator('#main .ds-empty__title', { hasText: 'Не получилось загрузить' }).waitFor({ timeout: 3000 });
    const BROKEN = { contentType: 'application/json', body: '{"ok":true}' }; // «успех» без данных панели

    const C = (await w.api(admin, 'event.create', { participate: false, title: 'Проверка' })).event.id;
    await w.api(admin, 'admin.participate', { event: C, on: true });
    await w.say(people[4], '/start ' + (await inv(C)));

    // (1) «Сохранить» в «Параметрах»: панель перестроена по новым данным, экран на месте; (2) событие завершили со
    // стороны — после перерисовки панель без «Полный сброс» и с плашкой «завершено»
    await step('сохранение параметров', admin, C, async (page) => {
      await tab(page, 'Управление');
      await page.locator('.ds-field', { hasText: 'Название' }).locator('input').fill('Проверка — новое');
      const budget = page.getByLabel('Бюджет подарка', { exact: true });
      await budget.fill('до 50 BYN');
      await page.getByRole('button', { name: 'Очистить поле «Бюджет подарка»' }).click();
      const save = page.locator('.ds-btn', { hasText: /^Сохранить$/ });
      await save.scrollIntoViewIfNeeded();
      await save.click();
      await page.locator('#toast', { hasText: 'Сохранено' }).waitFor({ timeout: 5000 });
      if (await budget.inputValue()) throw new Error('после сохранения вернулся старый бюджет');
      const box = await page.locator('.ds-btn', { hasText: /^Сохранить$/ }).boundingBox();
      if (!box || box.y < 0 || box.y + box.height > 844) problems.push('после «Сохранить» кнопка не на экране — панель прыгнула');
      const hero = await page.locator('#heroTitle').textContent();
      if (hero !== 'Проверка — новое') problems.push(`заголовок после «Сохранить» — «${hero}»`);
      await page.locator('.ds-list-item', { hasText: 'Катя' }).locator('.ds-icon-btn[title="Действия с участником"]').click();
      let text = null;
      page.once('dialog', (d) => { text = d.message(); d.dismiss(); });
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Удалить из события' }).click();
      await waitFor(() => text !== null, 'окно подтверждения удаления', 3000);
      if (!text.includes('«Проверка — новое»')) problems.push(`подтверждение удаления после «Сохранить»: «${text}»`);
      await closeSheetBtn(page);
      await page.locator('.ds-btn', { hasText: 'Удалить событие' }).click();
      const doomed = await page.locator('.ds-sheet .ds-bullets li').first().textContent();
      if (!doomed.includes('«Проверка — новое»')) problems.push(`«Удалить событие» после «Сохранить»: «${doomed}»`);
      await closeSheetBtn(page);

      await w.api(admin, 'admin.event.finish', { event: C });
      await tab(page, 'Инфо');
      await tab(page, 'Управление');
      await page.locator('.ds-section-title', { hasText: 'Опасная зона' }).waitFor({ timeout: 5000 });
      if (await page.locator('.ds-btn', { hasText: 'Полный сброс' }).count()) problems.push('событие завершено со стороны — панель предлагает «Полный сброс»');
      if (!(await page.locator('.ds-btn', { hasText: 'Удалить событие' }).count())) problems.push('событие завершено со стороны — нет «Удалить событие»');
      if (!(await page.locator('#main .ds-notice', { hasText: 'Событие завершено' }).count())) problems.push('событие завершено со стороны — нет плашки «Событие завершено»');
    });

    // (3) ответ обращения пришёл, когда открыта уже другая шторка (журнал), — заголовок не её
    await step('заголовок своей шторки', admin, A, async (page) => {
      await tab(page, 'Управление');
      let release;
      const held = new Promise((r) => { release = r; });
      let first = true;
      await page.route('**/api/admin.support.get', async (r) => {
        if (first) { first = false; await held; }
        await r.continue();
      });
      await page.locator('.ds-list-item--link', { hasText: 'Олег' }).click();
      await waitFor(() => !first, 'запрос обращения', 3000);
      await closeSheetBtn(page);
      // Панель перестраивается после закрытия шторки — click() сам дождётся кнопки и прокрутит к ней
      await page.locator('#main .ds-btn', { hasText: 'Журнал действий' }).click();
      await page.locator('.ds-sheet__title', { hasText: 'Журнал события' }).waitFor({ timeout: 5000 });
      release();
      await page.waitForTimeout(800);
      const title = await sheetTitle(page);
      if (title !== 'Журнал события') problems.push(`ответ обращения пришёл при открытом журнале — заголовок журнала «${title}»`);
    });

    // (4) сбой построения панели — экран ошибки с повтором, а не вечный загрузчик: вкладка и закрытие шторки обращения
    await step('вечный загрузчик (вкладка)', admin, C, async (page) => {
      let broken = true;
      await page.route('**/api/admin.state', (r) => (broken ? r.fulfill(BROKEN) : r.continue()));
      await tab(page, 'Управление');
      await loadFailed(page);
      if (await page.locator('#main .ds-loader').count()) problems.push('вкладка «Управление» при сбое: загрузчик остался');
      broken = false;
      await page.locator('#main .ds-btn', { hasText: 'Попробовать снова' }).click();
      await page.locator('.ds-btn', { hasText: 'Журнал действий' }).waitFor({ timeout: 5000 });
    });
    await step('вечный загрузчик (закрытие шторки)', admin, A, async (page) => {
      await tab(page, 'Управление');
      await page.locator('.ds-list-item--link', { hasText: 'Олег' }).click();
      await page.locator('.ds-sheet__title', { hasText: 'Обращение: Олег' }).waitFor({ timeout: 5000 });
      await page.route('**/api/admin.state', (r) => r.fulfill(BROKEN));
      await closeSheetBtn(page);
      await loadFailed(page);
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'недочёты интерфейса (026): ' + x));
    else console.log('✔ недочёты интерфейса (026): панель после «Сохранить» и завершения со стороны, заголовок своей шторки, экран ошибки вместо загрузчика');
  }

  // 030: переключатель «Регистрация открыта» обновляет панель на месте (правило по коду — tests/app-panel.test.mjs).
  // Событие B — до жеребьёвки: заявка Стёпы, прошлое событие A. В конце регистрация снова открыта.
  async function checkRegistration() {
    const problems = [];
    const OPEN = 'Пригласить участников прошлого события — например, тех же людей на следующий год.';
    const CLOSED = 'Пригласить участников прошлого события можно, когда регистрация открыта.';
    const REQ = 'Регистрация закрыта — принять заявку можно, когда откроешь её. Отклонить можно сейчас.';
    // Состояние панели: кнопка приглашения, видимые подсказки, выбор, черновик, прокрутка, та же ли панель (не перестроена)
    const look = (page) => page.evaluate(([open, closed, req]) => {
      const btn = [...document.querySelectorAll('#main .ds-btn')].find((b) => b.textContent.includes('Пригласить участников'));
      const shown = (t) => [...document.querySelectorAll('#main .ds-hint')].some((x) => x.textContent === t && x.offsetParent !== null);
      const sel = [...document.querySelectorAll('#main select')].find((s) => s.options[0].text === 'Из какого события…');
      return {
        disabled: btn.disabled, open: shown(open), closed: shown(closed), req: shown(req),
        picked: sel.value, draft: document.querySelector('#main textarea[placeholder^="Например: собираемся"]').value,
        y: Math.round(window.scrollY), same: window.__panel === document.querySelector('#main').firstElementChild,
        loader: !!document.querySelector('#main .ds-loader'),
      };
    }, [OPEN, CLOSED, REQ]);
    const expect = (what, got, want) => {
      for (const [k, v] of Object.entries(want)) if (got[k] !== v) problems.push(`${what}: ${k} = ${JSON.stringify(got[k])}, ожидалось ${JSON.stringify(v)}`);
    };
    const toggle = (page) => page.locator('label.ds-switch:has(input[aria-label="Регистрация открыта"])').click();

    await onPage(problems, 'переключатель регистрации', admin, B, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('.ds-section-title', { hasText: 'Журнал' }).waitFor({ timeout: 5000 });
      await page.locator('#main select', { has: page.locator('option', { hasText: 'Из какого события…' }) }).selectOption(String(A));
      await page.locator('#main textarea[placeholder^="Например: собираемся"]').fill('Черновик объявления');
      // Переключатель — в середине экрана: щелчок не прокручивает страницу сам, сдвиг прокрутки — от панели
      const y = await page.locator('input[aria-label="Регистрация открыта"]').evaluate((e) => {
        e.closest('.ds-row').scrollIntoView({ block: 'center' });
        window.__panel = document.querySelector('#main').firstElementChild;
        return Math.round(window.scrollY);
      });
      const kept = { picked: String(A), draft: 'Черновик объявления', y, same: true, loader: false };
      expect('до щелчка', await look(page), { disabled: false, open: true, closed: false, req: false, ...kept });

      await toggle(page);
      await page.locator('#toast', { hasText: 'Регистрация закрыта' }).waitFor({ timeout: 5000 });
      expect('регистрация закрыта', await look(page), { disabled: true, open: false, closed: true, req: true, ...kept });

      await toggle(page);
      await page.locator('#toast', { hasText: 'Регистрация открыта' }).waitFor({ timeout: 5000 });
      expect('регистрация открыта', await look(page), { disabled: false, open: true, closed: false, req: false, ...kept });

      // Отказ сервера: переключатель возвращается, кнопка и подсказки прежние
      await page.route('**/api/admin.registration', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Проверка: отказ' }) }));
      await toggle(page);
      await page.locator('#toast', { hasText: 'Проверка: отказ' }).waitFor({ timeout: 5000 });
      await page.waitForTimeout(200);
      if (!(await page.locator('input[aria-label="Регистрация открыта"]').isChecked())) problems.push('отказ сервера: переключатель не вернулся');
      expect('отказ сервера', await look(page), { disabled: false, open: true, closed: false, req: false, ...kept });
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'переключатель регистрации (030): ' + x));
    else console.log('✔ переключатель регистрации (030): кнопка приглашения и подсказки — сразу, без перестройки; выбор, черновик и прокрутка на месте; отказ — всё прежнее');
  }

  // 032: политика страницы в браузере (контракт — specs/032-app-csp/contracts/app-csp.md). «От противного» — внедрённое
  // в открытое приложение заблокировано и замечено; фрейм веб-клиента: на https://web.telegram.org приложение работает и
  // принимает блок стилей (так скрипт Telegram ставит тему), на чужом сайте — заблокировано. Адреса https обслуживает
  // перехват Playwright: приложение — https://santa.test (запросы пересылаются в Worker теста).
  async function checkCsp() {
    const problems = [];
    const home = `#tgWebAppData=${encodeURIComponent(initData(admin))}`;
    const ready = '.ds-list-item--link, .ds-tabs:not([hidden])';

    const seen = [];
    const page = await openPage('CSP: от противного', { viewport: { width: 390, height: 844 } }, { own: seen });
    try {
      await page.goto(`${w.base}/app${home}`);
      await page.waitForSelector(ready);
      // fn(arg) → 'заблокировано', если внедрённое не сработало; нарушение нужного вида должно прийти. Код самой пробы
      // выполняют средства отладки — политика его не ограничивает, поэтому пробы внедряют то, что выполняет страница
      const probe = async (what, directive, fn, blocked = '', arg = null) => {
        const from = seen.length;
        const got = await page.evaluate(fn, arg).catch((e) => 'ошибка пробы: ' + e.message.split('\n')[0]);
        await page.waitForTimeout(300);
        const mine = seen.slice(from);
        if (got !== 'заблокировано') problems.push(`${what}: ${got}`);
        if (!mine.some((v) => v.directive === directive && v.blocked.includes(blocked))) problems.push(`${what}: нет нарушения ${directive} ${blocked} (пришло: ${JSON.stringify(mine)})`);
      };
      await probe('встроенный скрипт', 'script-src-elem', () => new Promise((done) => {
        const s = document.createElement('script');
        s.textContent = 'window.__cspInline = 1';
        document.head.append(s);
        setTimeout(() => done(window.__cspInline ? 'выполнился' : 'заблокировано'), 100);
      }));
      await probe('обработчик в разметке', 'script-src-attr', () => {
        const d = document.createElement('div');
        d.setAttribute('onclick', 'window.__cspAttr = 1');
        document.body.append(d);
        d.click();
        d.remove();
        return window.__cspAttr ? 'выполнился' : 'заблокировано';
      });
      // Строка в таймере компилируется уже страницей (не в вызове средств отладки) — как eval
      await probe('строка как код (таймер)', 'script-src', () => new Promise((done) => {
        setTimeout('window.__cspEval = 1', 0);
        setTimeout(() => done(window.__cspEval ? 'выполнилась' : 'заблокировано'), 100);
      }), 'eval');
      const external = (src) => new Promise((done) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => done('загрузился');
        s.onerror = () => done('заблокировано');
        document.head.append(s);
      });
      await probe('скрипт с чужого адреса', 'script-src-elem', external, 'csp-check.example', 'https://csp-check.example/x.js');
      await probe('другой скрипт telegram.org', 'script-src-elem', external, 'telegram.org/js/other.js', 'https://telegram.org/js/other.js');
      await probe('запрос на чужой адрес', 'connect-src', () => fetch('https://csp-check.example/').then(() => 'ответ получен', () => 'заблокировано'), 'csp-check.example');
    } catch (e) {
      problems.push(`от противного: ${e.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }

    // Фрейм: родитель parent — страница с <iframe> приложения; tg — текст скрипта Telegram (иначе он заблокирован).
    // Родитель на iframe_ready шлёт set_custom_style, как веб-клиент Telegram; без скрипта блок стилей создаёт проба.
    const STYLE = ':root { --csp-check: 7px; }';
    async function frame(what, parent, { tg = null, allowed }) {
      const own = [];
      const p = await openPage(what, { viewport: { width: 430, height: 900 } }, { own });
      try {
        if (tg) await p.route(TELEGRAM_SCRIPT, (r) => r.fulfill({ contentType: 'application/javascript', body: tg }));
        await p.route('https://santa.test/**', async (r) => {
          const u = new URL(r.request().url());
          await r.fulfill({ response: await r.fetch({ url: w.base + u.pathname + u.search }) });
        });
        await p.route(parent + '/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8">
<iframe id="app" src="https://santa.test/app${home}" width="390" height="844"></iframe>
<script>
addEventListener('message', (e) => {
  let d; try { d = JSON.parse(e.data); } catch (_) { return; }
  if (d.eventType === 'iframe_ready') e.source.postMessage(JSON.stringify({ eventType: 'set_custom_style', eventData: ${JSON.stringify(STYLE)} }), '*');
});
</script>` }));
        await p.goto(parent + '/k/');
        const app = await (await p.waitForSelector('iframe#app', { state: 'attached' })).contentFrame();
        if (!allowed) {
          await p.waitForTimeout(1500);
          const shown = await app.evaluate(() => !!document.querySelector('#main')).catch(() => false);
          if (shown) problems.push(`${what}: приложение показано во фрейме чужого сайта`);
          if (!app.url().startsWith('chrome-error:')) problems.push(`${what}: во фрейме ${app.url()}, ожидалась страница ошибки`);
          return;
        }
        await app.waitForSelector(ready, { timeout: 15000 });
        const mark = () => app.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--csp-check').trim());
        if (!tg) {
          if ((await mark()) !== '') problems.push(`${what}: метка стиля есть до проверки`);
          await app.evaluate((css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }, STYLE);
        }
        else if (!(await app.evaluate(() => !!(window.Telegram && window.Telegram.WebApp)))) problems.push(`${what}: скрипт Telegram не выполнился`);
        await waitFor(async () => (await mark()) === '7px', `${what}: блок стилей применён`, 5000)
          .catch((e) => problems.push(e.message));
        if (own.length) problems.push(`${what}: нарушения политики ${JSON.stringify(own)}`);
      } catch (e) {
        problems.push(`${what}: ${e.message.split('\n')[0]}`);
      } finally {
        await p.close();
      }
    }
    await frame('фрейм веб-клиента', 'https://web.telegram.org', { allowed: true });
    if (TG_SCRIPT.text) await frame('фрейм веб-клиента со скриптом Telegram', 'https://web.telegram.org', { tg: TG_SCRIPT.text, allowed: true });
    await frame('фрейм чужого сайта', 'https://csp-check.example', { allowed: false });

    if (problems.length) colorProblems.push(...problems.map((x) => 'CSP (032): ' + x));
    else console.log(`✔ CSP (032): внедрённые скрипт, обработчик, строка как код, чужие скрипты и запрос заблокированы; фрейм веб-клиента работает и принимает тему${TG_SCRIPT.text ? ' (и с настоящим скриптом Telegram)' : ''}; на чужом сайте — заблокирован`);
    if (!TG_SCRIPT.text) console.log(`⚠ CSP (032): настоящий скрипт Telegram не скачан (${TG_SCRIPT.error}) — проверка фрейма с ним пропущена`);
  }

  // 035: своё имя на главном экране и выход из события со словом ВЫЙТИ (правило по коду — tests/app-ui.test.mjs, 7). Свои
  // события: L — до жеребьёвки (Тимур выходит), D — с жеребьёвкой (Юля видит подсказку); «Опасная зона» — та же шторка
  // со словом и со вторым окном «точно?» (отказ в нём ничего не сбрасывает). 036: в D участвуют и организаторы — владелец
  // (admin) и админ people[0]: после жеребьёвки у каждого своя подсказка (specs/036-organizer-leave-hint/contracts/), до и
  // после раскрытия Сант
  async function checkSelfService() {
    const problems = [];
    const timur = { id: 140, name: 'Тимур', username: 'timur' };
    const yulia = { id: 141, name: 'Юля', username: 'yulia' };
    const L = (await w.api(admin, 'event.create', { participate: false, title: 'Выход' })).event.id;
    const codeL = await inv(L);
    for (const p of [timur, yulia]) { await w.say(p, '/start ' + codeL); await w.say(p, p.name); }
    const D = (await w.api(admin, 'event.create', { participate: false, title: 'Уже с жеребьёвкой' })).event.id;
    const codeD = await inv(D);
    for (const p of [timur, yulia, people[0]]) await w.say(p, '/start ' + codeD);
    await w.api(admin, 'admin.participate', { event: D, on: true });
    await w.api(admin, 'admin.role.grant', { event: D, id: people[0].id }); // 063: администратор — участник события
    await w.api(admin, 'admin.draw', { event: D });
    const member = (u, ev) => w.query(`SELECT 1 FROM members WHERE event_id = ${Number(ev)} AND user_id = ${u.id}`).length === 1;
    const leaveBtn = (page) => page.locator('#main .ds-btn--danger', { hasText: 'Выйти из события' });
    // 063: «Профиль» — на экране «Настройки» (⚙️ в шапке главного экрана)
    const toSettings = async (p) => {
      await p.locator('#heroAction').click();
      await p.locator('#heroTitle', { hasText: /^Настройки$/ }).waitFor({ timeout: 5000 });
    };

    await shot(timur, '30-profile', { before: toSettings });
    await shot(timur, '30-profile-name', { fullPage: false, before: async (p) => {
      await toSettings(p);
      await p.locator('#main .ds-btn', { hasText: 'Изменить имя' }).click();
    } });
    await shot(timur, '31-leave', { event: L, tab: 'Инфо', fullPage: false, before: async (p) => {
      await leaveBtn(p).click();
      await p.locator('.ds-sheet .ds-input').fill('ВЫЙТИ');
    } });
    await shot(yulia, '32-leave-after-draw', { event: D, tab: 'Инфо' });
    await shot(admin, '33-leave-owner', { event: D, tab: 'Инфо' });

    await onPage(problems, 'профиль', timur, null, async (page) => {
      await toSettings(page);
      const titles = await page.locator('#main .ds-section-title').allTextContents();
      if (titles.indexOf('Профиль') < 0 || titles.indexOf('Профиль') !== titles.indexOf('Уведомления') - 1) problems.push(`профиль: разделы ${titles.join(', ')}`);
      await page.locator('#main .ds-btn', { hasText: 'Изменить имя' }).click();
      await page.locator('.ds-sheet__title', { hasText: 'Твоё имя' }).waitFor({ timeout: 3000 });
      const input = page.locator('.ds-sheet .ds-input');
      if ((await input.inputValue()) !== 'Тимур') problems.push('профиль: в поле не текущее имя');
      if ((await input.getAttribute('maxlength')) !== '40') problems.push('профиль: поле без maxlength 40');
      await page.getByRole('button', { name: 'Очистить поле «Твоё имя»' }).click();
      if (await input.inputValue()) throw new Error('предзаполненное имя осталось в поле');
      await input.fill('  Тимур   Ш. ');
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Сохранить' }).click();
      await page.locator('#toast', { hasText: 'Имя сохранено' }).waitFor({ timeout: 5000 });
      if (await page.locator('.ds-sheet').count()) problems.push('профиль: шторка не закрылась');
      const hello = await page.locator('#heroSub').textContent();
      if (hello !== 'Привет, Тимур Ш.!') problems.push(`профиль: приветствие «${hello}»`);
      if (!(await page.locator('#main .ds-text-strong', { hasText: 'Тимур Ш.' }).count())) problems.push('профиль: в разделе прежнее имя');
      const saved = w.query(`SELECT name FROM users WHERE tg_id = ${timur.id}`)[0].name;
      if (saved !== 'Тимур Ш.') problems.push(`профиль: на сервере «${saved}»`);
    });

    await onPage(problems, 'выход до жеребьёвки', timur, L, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      await leaveBtn(page).click();
      await page.locator('.ds-sheet__title', { hasText: 'Выйти из события' }).waitFor({ timeout: 3000 });
      const go = page.locator('.ds-sheet .ds-btn--danger', { hasText: 'Выйти' });
      const input = page.locator('.ds-sheet .ds-input');
      if (!(await go.isDisabled())) problems.push('выход: кнопка доступна без слова');
      await input.fill('выйт');
      if (!(await go.isDisabled())) problems.push('выход: кнопка доступна с неполным словом');
      await input.fill(' выйти ');
      if (await go.isDisabled()) problems.push('выход: кнопка недоступна со словом');
      await input.press('Tab');
      const clear = page.getByRole('button', { name: /Очистить/ });
      if (!(await clear.evaluate(el => el === document.activeElement))) throw new Error('крестик пропущен при Tab');
      await page.keyboard.press('Enter');
      if (!(await go.isDisabled()) || await input.inputValue() || await clear.count()) throw new Error('очистка не сбросила подтверждение');
      if (!(await input.evaluate(el => el === document.activeElement))) throw new Error('фокус не вернулся в поле');
      await input.fill('выйти');
      await go.click(); // второго окна нет: окно браузера Playwright закрыл бы отказом — выхода бы не было
      await page.locator('#toast', { hasText: 'Ты больше не участвуешь в событии «Выход»' }).waitFor({ timeout: 5000 });
      await page.locator('#main .ds-list-item--link', { hasText: 'Уже с жеребьёвкой' }).waitFor({ timeout: 5000 });
      if (await page.locator('#main .ds-list-item--link', { hasText: /^Выход/ }).count()) problems.push('выход: событие осталось в «Моих событиях»');
      if (member(timur, L)) problems.push('выход: на сервере всё ещё участник');
      if (!w.texts(admin).some((t) => t === '🚪 <b>Тимур Ш.</b> выходит из события «Выход».')) problems.push('выход: организатору нет сообщения');
    });

    await onPage(problems, 'выход после жеребьёвки', yulia, D, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      await page.locator('#main .ds-section-title', { hasText: 'Выход из события' }).waitFor({ timeout: 3000 });
      if (await leaveBtn(page).count()) problems.push('после жеребьёвки: есть кнопка выхода');
      if (!(await page.locator('#main .ds-hint', { hasText: 'Жеребьёвка уже прошла. Чтобы выйти' }).count())) problems.push('после жеребьёвки: нет подсказки');
      await page.locator('#main .ds-btn', { hasText: 'Задать вопрос' }).last().click();
      await page.locator('.ds-sheet__title', { hasText: 'Обращения' }).waitFor({ timeout: 3000 });
      if (!member(yulia, D)) problems.push('после жеребьёвки: участие пропало');
    });

    // 036: раздел выхода после жеребьёвки — подсказка по роли; button — есть ли в разделе «Задать вопрос». 063: у события
    // свой владелец (admin создал D) — в подсказках «владелец», не «владелец бота»
    const HINTS = {
      owner: 'Ты владелец — удалить тебя из события некому. Выйти можно, только отменив жеребьёвку: «Управление» → «Опасная зона» → «↩️ Отменить жеребьёвку» (пары удалятся у всех, участники получат уведомление). Потом выключи «Я участвую» и проведи жеребьёвку заново.',
      ownerRevealed: 'Тайна уже раскрыта — жеребьёвку не отменить, поэтому выйти из события нельзя: удалить владельца некому.',
      admin: 'Жеребьёвка уже прошла — удалить из события администратора может только владелец. Отправь обращение, чтобы владелец мог помочь.',
      member: 'Жеребьёвка уже прошла. Чтобы выйти, обратись к владельцу или администраторам.',
    };
    const leaveHint = (user, what, hint, button) => onPage(problems, what, user, D, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      const title = page.locator('#main .ds-section-title', { hasText: 'Выход из события' });
      await title.waitFor({ timeout: 3000 });
      const card = title.locator('xpath=following-sibling::*[1]');
      const text = await card.locator('.ds-hint').allTextContents();
      if (text.join('|') !== hint) problems.push(`${what}: подсказка «${text.join('|')}»`);
      const buttons = await card.locator('.ds-btn').allTextContents();
      const want = button ? ['💬 Задать вопрос'] : [];
      if (buttons.join('|') !== want.join('|')) problems.push(`${what}: кнопки в разделе — ${buttons.join(', ') || 'нет'}, ожидалось ${want.join(', ') || 'нет'}`);
    });
    await leaveHint(admin, 'владелец после жеребьёвки', HINTS.owner, false);
    await leaveHint(people[0], 'админ после жеребьёвки', HINTS.admin, true);
    await leaveHint(yulia, 'участник после жеребьёвки', HINTS.member, true);
    await w.api(admin, 'admin.reveal', { event: D });
    await leaveHint(admin, 'владелец после раскрытия', HINTS.ownerRevealed, false);
    await leaveHint(people[0], 'админ после раскрытия', HINTS.admin, true);
    await leaveHint(yulia, 'участник после раскрытия', HINTS.member, true);

    await onPage(problems, 'опасная зона через ту же шторку', admin, L, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      // 064: «Полного сброса» нет — та же шторка со словом у «Удалить событие»
      if (await page.locator('#main .ds-btn', { hasText: 'Полный сброс' }).count()) problems.push('опасная зона: остался «Полный сброс»');
      await page.locator('#main .ds-btn--danger', { hasText: 'Удалить событие' }).click();
      await page.locator('.ds-sheet__title', { hasText: 'Удалить событие' }).waitFor({ timeout: 3000 });
      const go = page.locator('.ds-sheet .ds-btn--danger', { hasText: 'Удалить навсегда' });
      if (!(await go.isDisabled())) problems.push('опасная зона: кнопка доступна без слова');
      await page.locator('.ds-sheet .ds-input').fill('УДАЛИТЬ');
      let asked = '';
      page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
      await go.click();
      await page.waitForTimeout(300);
      if (asked !== 'Удалить событие: точно? Это нельзя отменить.') problems.push(`опасная зона: второе окно «${asked}»`);
      if (!member(yulia, L)) problems.push('опасная зона: отказ во втором окне, а событие удалено');
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'имя и выход (035–036): ' + x));
    else console.log('✔ имя и выход (035–036): «Профиль» в «Настройках» над «Уведомлениями», имя — сразу в приветствии; выход — только со словом, без второго окна, организатору — сообщение; после жеребьёвки — подсказка по роли (владелец, админ, участник; до и после раскрытия) и обращение; «Опасная зона» — та же шторка со вторым окном');
  }

  // 037, 064: участники на «Инфо» (specs/037-info-people/contracts/info-people.md). Событие R: владелец (admin), админ
  // people[0] и восемь новых — десять человек, писем — три. 064: список виден весь, @username — у каждого, у кого он есть,
  // строки не нажимаются; параметра «Участники могут писать друг другу» нет; после жеребьёвки сводки нет
  async function checkInfoPeople() {
    const problems = [];
    const names = ['Вова', 'Галя', 'Евгений', 'Жанна', 'Зоя', 'Игорь', 'Лена', 'Нина'];
    const fresh = names.map((name, i) => ({ id: 150 + i, name, username: name === 'Лена' ? '' : 'u' + (150 + i) }));
    const [vova] = fresh;
    const R = (await w.api(admin, 'event.create', { participate: false, title: 'Список участников' })).event.id;
    const codeR = await inv(R);
    for (const p of fresh) { await w.say(p, '/start ' + codeR); await w.say(p, p.name); }
    await w.api(admin, 'admin.participate', { event: R, on: true });
    await w.say(people[0], '/start ' + codeR);
    await w.api(admin, 'admin.role.grant', { event: R, id: people[0].id }); // 063: администратор — участник события
    for (const p of fresh.slice(0, 3)) await w.api(p, 'wishlist.save', { event: R, text: LETTER(p.name) });
    const WANT = ['Вова  @u150  (ты)', 'Галя  @u151', 'Дмитрий  @dima', 'Евгений  @u152', 'Жанна  @u153', 'Зоя  @u154',
      'Игорь  @u155', 'Лена', 'Маша  @masha', 'Нина  @u157'];

    // Раздел «Участники · 10»: подсказка над списком (до жеребьёвки), карточка списка; переходы — в window.__opened
    const section = async (page) => {
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      const title = page.locator('#main .ds-section-title', { hasText: 'Участники · 10' });
      await title.waitFor({ timeout: 3000 });
      await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
      return {
        next: title.locator('xpath=following-sibling::*[1]'),
        list: title.locator('xpath=following-sibling::*[contains(@class, "ds-card--flush")][1]'),
        opened: () => page.evaluate(() => window.__opened.slice()),
      };
    };
    const rowTitles = (list) => list.locator('.ds-list-item__title').allTextContents();
    const info = async (page) => {
      const dt = await page.locator('#main .ds-info-grid dt').allTextContents();
      const dd = await page.locator('#main .ds-info-grid dd').allTextContents();
      return Object.fromEntries(dt.map((k, i) => [k, dd[i]]));
    };

    await onPage(problems, 'список до жеребьёвки', vova, R, async (page) => {
      const { next, list, opened } = await section(page);
      const rows = await info(page);
      if ('Участников' in rows) problems.push('«О событии»: осталась строка «Участников»');
      if (rows['Владелец'] !== 'Дмитрий') problems.push(`«Владелец»: «${rows['Владелец']}»`);
      if (rows['Администраторы'] !== 'Маша') problems.push(`«Администраторы»: «${rows['Администраторы']}»`);
      if (rows['Автожеребьёвка'] !== 'не установлена') problems.push(`«Автожеребьёвка»: «${rows['Автожеребьёвка']}»`);
      if ((await next.textContent()) !== '✉️ Письма написали 3 из 10') problems.push(`прогресс: «${await next.textContent()}»`);
      const titles = await rowTitles(list);
      if (titles.join('|') !== WANT.join('|')) problems.push(`список: ${titles.join(', ')}`);
      if (await list.locator('.ds-list-item--link').count()) problems.push('строки или «Показать всех» нажимаются');
      const chip = async (name) => (await list.locator('.ds-list-item', { hasText: name }).locator('.ds-chip').allTextContents()).join('|');
      if ((await chip('Дмитрий')) !== '👑 владелец') problems.push(`метка владельца: «${await chip('Дмитрий')}»`);
      if ((await chip('Маша')) !== '🛠 администратор') problems.push(`метка администратора: «${await chip('Маша')}»`);
      if ((await chip('Галя')) !== '') problems.push(`у участника метка «${await chip('Галя')}»`);
      await list.locator('.ds-list-item', { hasText: 'Галя' }).click();
      await page.waitForTimeout(200);
      if ((await opened()).length) problems.push('нажатие на строку открыло ссылку');
      const invite = page.locator('#main .ds-card', { has: page.locator('.ds-btn', { hasText: '📨 Пригласить друга' }) });
      if ((await invite.locator('.ds-hint').textContent()) !== 'Позови друга — по ссылке он сразу вступит в событие.') problems.push('приглашение: подсказка');
      await invite.locator('.ds-btn').click();
      const link = (await w.api(admin, 'admin.state', { event: R })).settings.invite_link;
      const [url] = await opened();
      if (!url || !url.startsWith('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=')) problems.push(`приглашение: открыто «${url}»`);
    });

    await onPage(problems, 'в «Параметрах» нет «писать друг другу»', admin, R, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('#main .ds-section-title', { hasText: 'Параметры' }).waitFor({ timeout: 3000 });
      if (await page.locator('#main .ds-check', { hasText: 'писать друг другу' }).count()) problems.push('в «Параметрах» осталась галочка «Участники могут писать друг другу»');
    });

    await shot(vova, '34-info-people', { event: R, tab: 'Инфо' });
    await shot(vova, '34-info-people', { event: R, tab: 'Инфо', dark: true });

    await w.api(admin, 'admin.registration', { event: R, open: false });
    await w.api(admin, 'admin.draw', { event: R });
    await onPage(problems, 'после жеребьёвки', vova, R, async (page) => {
      const { next } = await section(page);
      if (!(await next.evaluate((el) => el.classList.contains('ds-card--flush')))) problems.push(`после жеребьёвки над списком: «${await next.textContent()}»`);
      if (await page.locator('#main', { hasText: /Подарки готовы|получено:/ }).count()) problems.push('после жеребьёвки осталась сводка о подарках');
      if ('Автожеребьёвка' in (await info(page))) problems.push('после жеребьёвки осталась «Автожеребьёвка»');
      if (await page.locator('#main .ds-btn', { hasText: 'Пригласить друга' }).count()) problems.push('регистрация закрыта, а «Пригласить друга» есть');
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'участники на «Инфо» (037, 064): ' + x));
    else console.log('✔ участники на «Инфо» (037, 064): «Владелец», «Администраторы» и «Автожеребьёвка» в «О событии», весь список по алфавиту с @username, «(ты)» и метками, строки не нажимаются, прогресс писем до жеребьёвки и без сводки после; галочки «писать друг другу» нет; «Пригласить друга» пересылает ссылку и пропадает при закрытой регистрации');
  }

  // 038: значок у имени и открытка письма — свои люди и событие «Открытки» (другие снимки и проверки не меняются).
  // Значок из «Профиля» — в профиле, на «Инфо» и у Санты внутри скрытого имени, в переписке его нет; открытка — шторка с
  // отметкой выбранной, редактор на открытке (цвета бумаги и чернил), несохранённый текст цел, время письма прежнее; у
  // Санты и организатора письмо на открытке; в завершённом событии кнопки нет, письмо — на открытке.
  async function checkLooks() {
    const problems = [];
    const [petr, rita, sveta] = [['Пётр', 'petr'], ['Рита', 'rita'], ['Света', 'sveta']].map(([name, username], i) => ({ id: 170 + i, name, username }));
    const E = (await w.api(admin, 'event.create', { participate: false, title: 'Открытки' })).event.id;
    const code = await inv(E);
    for (const p of [petr, rita, sveta]) { await w.say(p, '/start ' + code); await w.say(p, p.name); }
    await w.api(rita, 'wishlist.save', { event: E, text: LETTER('Рита') });
    const UNSAVED_TEXT = 'Дорогой Санта! Хочу тёплые варежки';
    const color = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el)[p], prop);
    const toastIs = (page, text) => page.locator('#toast', { hasText: text }).waitFor({ timeout: 5000 });

    await onPage(problems, 'открытка письма', petr, E, async (page) => {
      const ta = page.locator('#main textarea.ds-input--letter');
      await ta.fill(UNSAVED_TEXT);
      const btn = page.locator('#main .ds-btn', { hasText: '🎨 Раскрасить письмо' });
      if ((await btn.textContent()) !== '🎨 Раскрасить письмо') problems.push(`кнопка: «${await btn.textContent()}»`);
      if (await page.locator('#main .ds-postcard').count()) problems.push('без открытки — а редактор на открытке');
      await btn.click();
      const sheet = page.locator('.ds-sheet', { hasText: 'Открытка для письма' });
      if (await sheet.locator('.ds-hint').count()) problems.push('шторка открытки: осталась подсказка (064)');
      const tiles = await sheet.locator('.ds-choice').allTextContents();
      if (tiles.length !== 16 || tiles[0] !== 'Без открытки') problems.push(`плитки: ${tiles.join(', ')}`);
      if ((await sheet.locator('.ds-choice--selected').textContent()) !== 'Без открытки') problems.push('не отмечено «Без открытки»');
      await sheet.locator('.ds-choice', { hasText: 'Звёздная ночь' }).click();
      await toastIs(page, 'Открытка выбрана');
      const paper = page.locator('#main .ds-postcard--night .ds-postcard__paper');
      if (!(await paper.locator('textarea').count())) problems.push('редактор не на открытке');
      if ((await ta.inputValue()) !== UNSAVED_TEXT) problems.push('несохранённый текст пропал');
      if (!(await page.locator('.ds-tab--active .ds-tab__dot').count())) problems.push('после смены открытки нет отметки «не сохранено»');
      if ((await color(paper, 'backgroundColor')) !== 'rgb(20, 35, 71)') problems.push(`бумага: ${await color(paper, 'backgroundColor')}`);
      if ((await color(ta, 'color')) !== 'rgb(238, 242, 255)') problems.push(`чернила редактора: ${await color(ta, 'color')}`);
      if ((await color(ta, 'caretColor')) !== 'rgb(238, 242, 255)') problems.push(`каретка редактора: ${await color(ta, 'caretColor')}`);
      if ((await color(ta, 'backgroundColor')) !== 'rgba(0, 0, 0, 0)') problems.push(`фон редактора: ${await color(ta, 'backgroundColor')}`);
      if ((await btn.textContent()) !== '🎨 Раскрасить письмо') problems.push(`кнопка после выбора — с названием: «${await btn.textContent()}»`);
      const row = w.query(`SELECT card, wishlist, wishlist_updated_at FROM members WHERE event_id = ${Number(E)} AND user_id = ${petr.id}`)[0];
      if (row.card !== 'night' || row.wishlist !== '' || row.wishlist_updated_at !== 0) problems.push(`на сервере: ${JSON.stringify(row)}`);
      await btn.click();
      if ((await page.locator('.ds-sheet .ds-choice--selected').textContent()) !== 'Звёздная ночь') problems.push('выбранная открытка не отмечена');
      await page.locator('.ds-sheet .ds-icon-btn', { hasText: '✕' }).click();
      await page.locator('#main .ds-btn', { hasText: /^Сохранить$/ }).click();
      await toastIs(page, 'Письмо сохранено');
    });

    await shot(petr, '36-letter-postcard', { event: E });
    await shot(petr, '36-letter-postcard', { event: E, dark: true });
    const openCards = (p) => p.locator('#main .ds-btn', { hasText: '🎨 Раскрасить письмо' }).click();
    await shot(petr, '36-postcards', { event: E, fullPage: false, before: openCards });
    await shot(petr, '36-postcards', { event: E, fullPage: false, dark: true, before: openCards });

    await w.api(sveta, 'card.set', { event: E, card: 'candy' });
    await w.api(admin, 'admin.registration', { event: E, open: false });
    await w.api(admin, 'admin.draw', { event: E });
    const santaId = w.query(`SELECT santa FROM pairs WHERE event_id = ${Number(E)} AND ward = ${petr.id}`)[0].santa;
    const santa = [rita, sveta].find((p) => p.id === santaId);
    await w.api(santa, 'message.send', { event: E, to: 'ward', text: 'Привет! Какой размер варежек?' });

    await onPage(problems, 'у Санты', santa, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Подопечный' }).click();
      const name = page.locator('#main .ds-ward-card__name');
      await name.waitFor({ timeout: 3000 });
      if ((await name.textContent()) !== 'Пётр') problems.push(`имя подопечного: «${await name.textContent()}»`);
      if (!(await name.evaluate((el) => el.classList.contains('ds-ward-card__name--hidden')))) problems.push('имя не скрыто');
      if (!(await page.locator('#main .ds-postcard--night .ds-letter').count())) problems.push('письмо подопечного не на открытке');
    });
    await shot(santa, '37-ward-postcard', { event: E, tab: 'Подопечный', before: (p) => p.getByRole('button', { name: '👀 Показать имя' }).click() });
    await shot(santa, '37-ward-postcard', { event: E, tab: 'Подопечный', dark: true, before: (p) => p.getByRole('button', { name: '👀 Показать имя' }).click() });

    // После жеребьёвки у Петра есть подопечный с письмом — событие открывается на «Подопечном»
    await onPage(problems, 'у организатора', admin, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      const item = page.locator('#main .ds-list-item', { hasText: 'Пётр' });
      const title = await item.locator('.ds-list-item__title').first().textContent();
      if (title !== 'Пётр  @petr') problems.push(`панель: «${title}»`);
      await item.locator('.ds-icon-btn[title="Действия с участником"]').click();
      page.once('dialog', (d) => d.accept());
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Открыть письмо' }).click();
      const letter = page.locator('.ds-sheet', { hasText: 'Письмо: Пётр' }).locator('.ds-postcard--night .ds-letter');
      await letter.waitFor({ timeout: 3000 });
      if ((await letter.textContent()) !== UNSAVED_TEXT) problems.push(`письмо у организатора: «${await letter.textContent()}»`);
    });

    await w.api(admin, 'admin.event.finish', { event: E });
    await onPage(problems, 'завершённое событие', petr, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Письмо' }).click();
      await page.locator('#main .ds-letter').first().waitFor({ timeout: 3000 });
      if (await page.locator('#main .ds-btn', { hasText: 'Открытка' }).count()) problems.push('в завершённом есть кнопка открытки');
      if (!(await page.locator('#main .ds-postcard--night .ds-letter').count())) problems.push('в завершённом письмо не на открытке');
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'открытка (038): ' + x));
    else console.log('✔ открытка (038): шторка открыток — 16 плиток, выбранная отмечена, редактор на открытке с цветами темы, несохранённый текст цел, время письма прежнее; у Санты и организатора письмо на открытке; в завершённом — без кнопки');
  }

  // 039, 043: имя с Unicode-эмодзи обновляется на экране без перезагрузки и видно в обращениях. 063: имя меняется в
  // «Настройках» — «Профиль» и приветствие на месте, прокрутка прежняя.
  async function checkNames() {
    const problems = [];
    const [gleb, liza, mila] = [['Глеб', 'gleb'], ['Лиза', 'liza'], ['Мила', 'mila']].map(([name, username], i) => ({ id: 180 + i, name, username }));
    const E = (await w.api(admin, 'event.create', { participate: false, title: 'Имена' })).event.id;
    const code = await inv(E);
    for (const p of [gleb, liza, mila]) { await w.say(p, '/start ' + code); await w.say(p, p.name); }
    await w.api(admin, 'admin.role.grant', { event: E, id: gleb.id });
    const toSettings = async (page) => {
      await page.locator('#heroAction').click();
      await page.locator('#heroTitle', { hasText: /^Настройки$/ }).waitFor({ timeout: 5000 });
    };
    const toastIs = (page, text) => page.locator('#toast', { hasText: text }).waitFor({ timeout: 5000 });
    const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));
    // Один из узлов loc — ровно want (ждёт до 3 с: разделы перечитываются после ответа сервера)
    const textIs = async (loc, want, what) => {
      await loc.filter({ hasText: want }).first().waitFor({ timeout: 3000 }).catch(() => {});
      const all = await loc.allTextContents();
      if (!all.includes(want)) problems.push(`${what}: ${all.map((t) => `«${t}»`).join(', ') || 'нет'}, ожидалось «${want}»`);
    };

    // Низкий экран: «Настройки» прокручиваются, кнопка «Изменить имя» — у верхнего края
    await onPage(problems, '«Настройки» организатора', gleb, null, async (page) => {
      if ((await page.locator('#heroSub').textContent()) !== 'Привет, Глеб!') problems.push(`приветствие до смены имени: «${await page.locator('#heroSub').textContent()}»`);
      await toSettings(page);
      const editName = page.getByRole('button', { name: '✏️ Изменить имя' });
      await editName.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      if (await page.getByRole('button', { name: /Значок у имени/ }).count()) problems.push('в профиле есть отдельный выбор значка');
      const y = await scrollY(page);
      if (y < 100) problems.push(`«Настройки» не прокручены (${y}) — проверка прокрутки ничего не значит`);
      await editName.click();
      await page.locator('.ds-sheet .ds-input').fill('Глеб Петров 🐧');
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Сохранить' }).click();
      await toastIs(page, 'Имя сохранено');
      if (await page.locator('#main .ds-spinner').count()) problems.push('после смены имени — загрузчик в «Настройках»');
      await textIs(page.locator('#heroSub'), 'Привет, Глеб Петров 🐧!', 'приветствие после имени');
      await textIs(page.locator('#main .ds-text-strong'), 'Глеб Петров 🐧', '«Профиль» после имени');
      if (Math.abs((await scrollY(page)) - y) > 1) problems.push(`прокрутка после имени: ${await scrollY(page)}, была ${y}`);
      // «‹» — главный экран с новым приветствием
      await page.locator('#heroBack').click();
      await textIs(page.locator('#heroSub'), 'Привет, Глеб Петров 🐧!', 'приветствие на главном экране после имени');
    }, { viewport: { width: 390, height: 320 } }); // 064: без «О боте» «Настройки» короче — экран ниже, чтобы прокручивались

    await onPage(problems, '«Настройки» участника', liza, null, async (page) => {
      await toSettings(page);
      await page.getByRole('button', { name: '✏️ Изменить имя' }).click();
      await page.locator('.ds-sheet .ds-input').fill('Лиза 🦄');
      await page.locator('.ds-sheet .ds-btn', { hasText: 'Сохранить' }).click();
      await toastIs(page, 'Имя сохранено');
      await textIs(page.locator('#heroSub'), 'Привет, Лиза 🦄!', 'приветствие участника');
      await textIs(page.locator('#main .ds-text-strong'), 'Лиза 🦄', '«Профиль» участника');
    });

    const sent = await w.api(liza, 'support.send', { event: E, text: 'Можно поменять адрес после жеребьёвки?' });
    await w.api(gleb, 'admin.support.send', { event: E, thread: sent.thread, text: 'Да, во вкладке «Письмо».' });
    await onPage(problems, 'обращения у владельца', admin, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      const item = page.locator('#main .ds-list-item--link', { hasText: 'Лиза' });
      await textIs(item.locator('.ds-list-item__title'), 'Лиза 🦄', 'строка «Обращений»');
      await textIs(item.locator('.ds-chip'), '🙋 ведёт Глеб Петров 🐧', 'метка «ведёт»');
      await item.click();
      const sheet = page.locator('.ds-sheet--full');
      await sheet.locator('.ds-chat__msg').nth(1).waitFor({ timeout: 3000 });
      await textIs(sheet.locator('.ds-sheet__title'), 'Обращение: Лиза 🦄', 'заголовок обращения');
      await textIs(sheet.locator('.ds-hint'), 'Обращение ведёт Глеб Петров 🐧.', '«ведёт» в обращении');
      const metas = await sheet.locator('.ds-chat__meta').allTextContents();
      if (!metas[0]?.startsWith('Лиза 🦄 · ') || !metas[1]?.startsWith('Глеб Петров 🐧 · ')) problems.push(`подписи сообщений у владельца: ${metas.join(' | ')}`);
    });
    await onPage(problems, 'обращение у участника', liza, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      await textIs(page.locator('#main .ds-text-sm'), 'Твоё обращение ведёт Глеб Петров 🐧.', '«Инфо» участника');
      await page.locator('#main .ds-btn', { hasText: 'Задать вопрос' }).first().click();
      const sheet = page.locator('.ds-sheet--full');
      await sheet.locator('.ds-chat__msg').nth(1).waitFor({ timeout: 3000 });
      await textIs(sheet.locator('.ds-hint'), 'Обращение ведёт Глеб Петров 🐧.', '«Обращения»: «ведёт»');
      const metas = await sheet.locator('.ds-chat__meta').allTextContents();
      if (!metas[1]?.startsWith('Глеб Петров 🐧 · ')) problems.push(`подпись ответа у участника: ${metas.join(' | ')}`);
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'имена (039, 043): ' + x));
    else console.log('✔ имена (039, 043): профиль без кнопки значка, имя с эмодзи обновляется на месте и отображается в обращениях');
  }

  // 039: тап мимо поля снимает фокус (клавиатура iOS прячется). Синтетические события указателя фокус сами не снимают —
  // снимает только обработчик приложения: тап по заголовку, ленте переписки, подсказке шторки — фокус снят; сдвиг пальца,
  // отменённое касание, тап по кнопке и по самому полю — фокус остаётся.
  // 062: масок и семей нет. Главный экран — без «Семей» и без подсказки над кнопками «Уведомлений»; «Подопечный» — без
  // кнопки маски, подсказка про «Тайного Санту»; переписка у подопечного — «Твой Тайный Санта»; «Управление» — без
  // «Учитывать семьи». Скриншоты — в обеих темах.
  async function checkNoMasksFamilies() {
    const problems = [];
    const ppl = [['Тима', 'tima'], ['Уля', 'ulya'], ['Фёдор', 'fedor']].map(([name, username], i) => ({ id: 200 + i, name, username }));
    const [tima] = ppl;
    const E = (await w.api(admin, 'event.create', { participate: false, title: 'Без масок' })).event.id;
    const code = await inv(E);
    for (const p of ppl) { await w.say(p, '/start ' + code); await w.say(p, p.name); }
    await w.api(admin, 'admin.draw', { event: E });
    const ward = ppl.find((p) => p.id === w.query(`SELECT ward FROM pairs WHERE event_id = ${Number(E)} AND santa = ${tima.id}`)[0].ward);

    // 063: «Уведомления» — в «Настройках»; семей нет ни там, ни на главном экране
    await onPage(problems, 'главный экран и «Настройки»', admin, null, async (page) => {
      for (const where of ['на главном экране', 'в «Настройках»']) {
        if (where !== 'на главном экране') {
          await page.locator('#heroAction').click();
          await page.locator('.ds-section-title', { hasText: 'Уведомления' }).waitFor({ timeout: 5000 });
        }
        if (await page.locator('.ds-section-title', { hasText: 'Семьи' }).count()) problems.push(`${where} есть «Семьи»`);
        if (await page.getByRole('button', { name: 'Новая семья' }).count()) problems.push(`${where} есть «Новая семья»`);
      }
      if (await page.locator('#main .ds-hint', { hasText: 'Когда подопечный' }).count()) problems.push('над «Уведомлениями» есть подсказка');
      if (!(await page.locator('#main .ds-segmented').count())) problems.push('нет кнопок режима уведомлений');
    });
    await onPage(problems, '«Подопечный»', tima, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Подопечный' }).click();
      await page.locator('#main .ds-btn', { hasText: 'Написать подопечному' }).waitFor({ timeout: 5000 });
      if (await page.locator('#main .ds-btn', { hasText: '🎭' }).count()) problems.push('на «Подопечном» есть кнопка маски');
      const hint = (await page.locator('#main .ds-hint').allTextContents()).join('|');
      if (!hint.split('|').includes('Есть вопрос?')) problems.push(`подсказка переписки (064 — «Есть вопрос?»): ${hint}`);
    });
    await w.api(tima, 'message.send', { event: E, to: 'ward', text: 'Привет!' });
    await onPage(problems, 'переписка у подопечного', ward, E, async (page) => {
      await page.locator('#main .ds-btn', { hasText: 'Написать Санте' }).first().click();
      const title = page.locator('.ds-sheet .ds-sheet__title');
      await title.waitFor({ timeout: 5000 });
      if ((await title.textContent()) !== 'Твой Тайный Санта') problems.push(`заголовок переписки: «${await title.textContent()}»`);
    });
    await onPage(problems, '«Управление»', admin, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('.ds-section-title', { hasText: 'Журнал' }).waitFor({ timeout: 5000 });
      if (await page.getByText('Учитывать семьи').count()) problems.push('в «Управлении» есть «Учитывать семьи»');
    });
    for (const dark of [false, true]) {
      await shot(admin, '62-home', { fullPage: false, dark });
      await shot(tima, '62-ward', { event: E, tab: 'Подопечный', fullPage: false, dark });
    }

    if (problems.length) colorProblems.push(...problems.map((x) => 'без масок и семей (062): ' + x));
    else console.log('✔ без масок и семей (062): главный экран и «Настройки» без «Семей», над «Уведомлениями» без подсказки, «Подопечный» без маски, переписка — «Твой Тайный Санта», «Управление» без «Учитывать семьи»');
  }

  // 048: управление жеребьёвкой — секция только владельцу; шторка без пар; плашка владельцу-участнику; нарушение —
  // плашка, «Подробнее» свёрнуто, обмен только с галочкой; невозможный обмен — без кнопки; обмен — окно с именами
  async function checkSwap() {
    const problems = [];
    const ppl = [['Арина', 'arina'], ['Борис', 'boris'], ['Вера', 'vera'], ['Дина', 'dina'], ['Ефим', 'efim']]
      .map(([name, username], i) => ({ id: 220 + i, name, username }));
    const [arina, boris, vera, dina, efim] = ppl;
    const E = (await w.api(admin, 'event.create', { participate: false, title: 'Обмен' })).event.id;
    const code = await inv(E);
    for (const p of ppl) { await w.say(p, '/start ' + code); await w.say(p, p.name); }
    await w.api(admin, 'admin.participate', { event: E, on: true });
    await w.api(admin, 'admin.draw', { event: E });
    // Круг: владелец → Арина → Борис → Вера → Дина → Ефим → владелец; подопечных открыли Арина и Ефим (049)
    const cycle = [admin, ...ppl].map((u) => u.id);
    const opened = [arina, efim];
    const setCycle = () => {
      w.sql(`DELETE FROM pairs WHERE event_id = ${Number(E)}`);
      cycle.forEach((id, i) => w.sql(`INSERT INTO pairs (event_id, santa, ward) VALUES (${Number(E)}, ${id}, ${cycle[(i + 1) % cycle.length]})`));
      w.sql(`UPDATE pairs SET seen_text = '' WHERE event_id = ${Number(E)} AND santa IN (${opened.map((u) => u.id).join(', ')})`);
    };
    setCycle();
    const wardOf = (u) => w.query(`SELECT ward FROM pairs WHERE event_id = ${Number(E)} AND santa = ${u.id}`)[0].ward;
    const sheet = (page) => page.locator('.ds-sheet', { hasText: 'Обмен подопечными' }); // 064: было «Управление жеребьёвкой»
    const openSwap = async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('#main .ds-btn', { hasText: '🔀 Открыть меню обмена' }).click();
      await sheet(page).locator('.ds-check').first().waitFor({ timeout: 5000 });
    };
    const box = (page, u) => sheet(page).locator('label.ds-list-item', { hasText: u.name }).locator('input');
    const go = (page) => sheet(page).locator('.ds-btn', { hasText: 'Поменять подопечных' }).first();
    const pick = async (page, ...us) => { for (const u of us) await box(page, u).check(); };
    const unpick = async (page, ...us) => { for (const u of us) await box(page, u).uncheck(); };
    // Есть ли у строки метка «не открыл подопечного» (049)
    const marked = async (page, u) => (await sheet(page).locator('label.ds-list-item', { hasText: u.name }).locator('.ds-chip', { hasText: '👀 не открыл подопечного' }).count()) === 1;
    const expectMarks = async (page, what, want) => {
      for (const u of [admin, ...ppl]) if ((await marked(page, u)) !== want.includes(u)) problems.push(`${what}: метка «не открыл» у ${u.name} — ${!want.includes(u)}`);
    };
    const notes = (u) => w.texts(u).filter((t) => t.includes('Владелец изменил жеребьёвку')).length;

    await onPage(problems, 'шторка обмена', admin, E, async (page) => {
      await openSwap(page);
      const s = sheet(page);
      const rows = await s.locator('label.ds-list-item .ds-grow > div:first-child').allTextContents();
      if (rows.join('|') !== 'Арина|Борис|Вера|Дина|Ефим|Дмитрий (ты)'.split('|').sort((x, y) => x.localeCompare(y, 'ru')).join('|')) problems.push(`список: ${rows.join(', ')}`);
      if (!(await s.locator('.ds-notice', { hasText: 'Ты участник этого события' }).count())) problems.push('нет плашки владельцу-участнику');
      if ((await s.textContent()).includes('→')) problems.push('в шторке видно пару');
      if (!(await go(page).isDisabled())) problems.push('кнопка доступна без выбора');
      await expectMarks(page, 'при открытии', [admin, boris, vera, dina]);

      // Нарушение: Арина и Вера — при кольцевой появится взаимная пара
      await pick(page, arina, vera);
      if (await go(page).isDisabled()) problems.push('кнопка недоступна при двух отмеченных');
      if (!(await box(page, boris).isDisabled())) problems.push('третий флажок доступен при двух отмеченных');
      await go(page).click();
      const notice = s.locator('.ds-notice--error', { hasText: 'Обмен нарушает один из принципов жеребьёвки' });
      await notice.waitFor({ timeout: 5000 });
      await page.waitForTimeout(800); // плавная прокрутка к плашке
      const nb = await notice.boundingBox();
      if (nb.y + nb.height > 844 + 1) problems.push(`плашка ниже края экрана: ${Math.round(nb.y)} + ${Math.round(nb.height)}`);
      const bullet = notice.locator('.ds-bullets li');
      if (await bullet.isVisible()) problems.push('«Подробнее» раскрыто сразу');
      await notice.locator('.ds-details__summary', { hasText: 'Подробнее' }).click();
      if (!(await bullet.isVisible()) || !(await bullet.textContent()).startsWith('Кольцевая жеребьёвка')) problems.push(`«Подробнее»: «${await bullet.textContent()}»`);
      const danger = notice.locator('.ds-btn--danger');
      if (!(await danger.isDisabled())) problems.push('обмен вопреки правилу доступен без галочки');
      await notice.locator('label.ds-check').click();
      if (await danger.isDisabled()) problems.push('галочка «Согласен» не открыла кнопку');
      await unpick(page, vera);
      if (await notice.count()) problems.push('плашка осталась после смены выбора');

      // Невозможный обмен: Арина дарит Борису
      await pick(page, boris);
      await go(page).click();
      const no = s.locator('.ds-notice--error', { hasText: 'Этих двоих поменять нельзя' });
      await no.waitFor({ timeout: 5000 });
      if (await no.locator('.ds-btn').count()) problems.push('у невозможного обмена есть кнопка');
      await unpick(page, arina, boris);

      // Обмен без нарушений: Арина и Дина — окно подтверждения с именами
      await pick(page, arina, dina);
      let asked = '';
      page.once('dialog', (d) => { asked = d.message(); d.accept(); });
      await go(page).click();
      await page.locator('#toast', { hasText: 'Подопечные поменялись' }).waitFor({ timeout: 5000 });
      if (!asked.startsWith('Поменять подопечных у «Арина» и «Дина»? Тем, кто уже открыл подопечного, бот напишет')) problems.push(`окно подтверждения: «${asked}»`);
      if (wardOf(arina) !== efim.id || wardOf(dina) !== boris.id) problems.push('пары на сервере не поменялись');
      if (await box(page, arina).isChecked()) problems.push('отметки не сброшены после обмена');
      // Арина открывала подопечного, Дина — нет: сообщение только Арине, метка — у обеих
      if (notes(arina) !== 1 || notes(dina) !== 0) problems.push(`сообщения о смене: Арина ${notes(arina)}, Дина ${notes(dina)}`);
      await expectMarks(page, 'после обмена', [admin, arina, boris, vera, dina]);
    });
    setCycle(); // снимок — с нарушением: Арина и Вера в прежнем круге
    const openWarning = async (page) => {
      await openSwap(page);
      await pick(page, arina, vera);
      await go(page).click();
      await sheet(page).locator('.ds-details__summary').waitFor({ timeout: 5000 });
      await page.waitForTimeout(800);
      await sheet(page).locator('.ds-details__summary').click();
    };
    await shot(admin, '48-swap-sheet', { event: E, fullPage: false, before: openWarning });
    await shot(admin, '48-swap-sheet', { event: E, fullPage: false, dark: true, before: openWarning });

    await w.api(admin, 'admin.role.grant', { event: E, id: boris.id });
    await onPage(problems, 'админ не видит секцию', boris, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await page.locator('.ds-section-title', { hasText: 'Журнал' }).waitFor({ timeout: 5000 });
      if (await page.locator('.ds-section-title', { hasText: 'Обмен подопечными' }).count()) problems.push('админ видит «Обмен подопечными»');
    });
    await w.api(admin, 'admin.role.revoke', { event: E, id: boris.id });

    if (problems.length) colorProblems.push(...problems.map((x) => 'управление жеребьёвкой (048, 049): ' + x));
    else console.log('✔ управление жеребьёвкой (048, 049): секция только владельцу, шторка без пар с плашкой участнику и метками «не открыл подопечного»; нарушение — плашка, «Подробнее» свёрнуто, обмен только с галочкой; невозможный — без кнопки; обмен — окно с именами, пары поменялись, сообщение только открывшей, метка у обоих');
  }

  async function checkKeyboard() {
    const problems = [];
    const [olya, pasha, roma] = [['Оля', 'olya'], ['Паша', 'pasha'], ['Рома', 'roma']].map(([name, username], i) => ({ id: 190 + i, name, username }));
    const E = (await w.api(admin, 'event.create', { participate: false, title: 'Клавиатура' })).event.id;
    const code = await inv(E);
    for (const p of [olya, pasha, roma]) { await w.say(p, '/start ' + code); await w.say(p, p.name); }
    // Фокус в поле field, касание цели target ([селектор, текст]) → остался ли фокус в поле
    const keeps = (page, field, target, { dx = 0, cancel = false } = {}) => page.evaluate(([f, [sel, text], dx, cancel]) => {
      const el = document.querySelector(f);
      el.focus();
      const t = [...document.querySelectorAll(sel)].find((x) => !text || x.textContent.includes(text));
      const r = t.getBoundingClientRect();
      const at = { bubbles: true, cancelable: true, isPrimary: true, pointerId: 7, pointerType: 'touch', clientX: r.left + Math.min(8, r.width / 2), clientY: r.top + r.height / 2 };
      t.dispatchEvent(new PointerEvent('pointerdown', at));
      if (cancel) t.dispatchEvent(new PointerEvent('pointercancel', at));
      t.dispatchEvent(new PointerEvent('pointerup', { ...at, clientX: at.clientX + dx }));
      return document.activeElement === el;
    }, [field, target, dx, cancel]);
    const expect = async (page, what, field, target, opts, want) => {
      const kept = await keeps(page, field, target, opts);
      if (kept !== want) problems.push(`${what}: фокус ${kept ? 'остался' : 'снят'}`);
    };

    await onPage(problems, 'письмо', olya, E, async (page) => {
      const LETTER_FIELD = '#main textarea.ds-input--letter';
      await page.locator(LETTER_FIELD).fill('Дорогой Санта!');
      await expect(page, 'тап по заголовку', LETTER_FIELD, ['#main .ds-section-title', 'Письмо'], {}, false);
      if ((await page.locator(LETTER_FIELD).inputValue()) !== 'Дорогой Санта!') problems.push('текст письма пропал');
      await expect(page, 'сдвиг пальца 30 px', LETTER_FIELD, ['#main .ds-section-title', 'Письмо'], { dx: 30 }, true);
      await expect(page, 'отменённое касание', LETTER_FIELD, ['#main .ds-section-title', 'Письмо'], { cancel: true }, true);
      await expect(page, 'тап по кнопке «Сохранить»', LETTER_FIELD, ['#main .ds-btn', 'Сохранить'], {}, true);
      await expect(page, 'тап по самому полю', LETTER_FIELD, [LETTER_FIELD, ''], {}, true);
      await expect(page, 'тап по подсказке карточки', LETTER_FIELD, ['#main .ds-hint', 'Письмо увидит'], {}, false);
    });

    // 063: «‹» — к «Моим событиям», ⚙️ — «Настройки» с «Профилем»
    await onPage(problems, 'шторка имени', olya, E, async (page) => {
      await page.locator('#heroBack').click();
      await page.locator('#heroAction').click();
      await page.locator('#main .ds-btn', { hasText: 'Изменить имя' }).click();
      await expect(page, 'шторка имени: тап по подсказке', '.ds-sheet .ds-input', ['.ds-sheet .ds-hint', 'Имя одно'], {}, false);
    });

    // Форма нового события: поле с крестиком, образец и отметка «пригласить» (062: прежде — форма семьи; 063: ещё
    // отметка «Я тоже участвую»)
    const openCreate = async (page, how = 'click') => {
      await page.getByRole('button', { name: '🎄 Создать событие', exact: true })[how]();
      const sheet = page.locator('.ds-sheet');
      await sheet.locator('select').selectOption({ index: 1 });
      const invite = sheet.getByRole('checkbox', { name: 'Пригласить участников образца' });
      if (!(await invite.isEnabled()) || !(await invite.isChecked())) throw new Error('отметка «пригласить» после выбора образца');
      return { sheet, invite };
    };
    await onPage(problems, 'новое событие', admin, null, async (page) => {
      const { sheet, invite } = await openCreate(page);
      const name = sheet.getByRole('textbox');
      const clear = sheet.getByRole('button', { name: /Очистить/ });
      if (await clear.count()) throw new Error('крестик виден в пустом поле');
      await name.fill(' ');
      const hit = await clear.boundingBox();
      const field = await name.boundingBox();
      if (!hit || hit.width < 44 || hit.height < 44 || hit.x + hit.width > field.x + field.width ||
          hit.y < field.y || hit.y + hit.height > field.y + field.height) throw new Error('размер или положение кнопки очистки');
      await clear.click({ position: { x: 3, y: 3 } });
      if (await name.inputValue() || await clear.count() || !(await invite.isChecked())) throw new Error('очистка названия события');
      await name.fill('Праздник');
      const clickedBackdrop = await name.evaluate((field) => {
        const sheet = field.closest('.ds-sheet');
        const title = sheet.querySelector('.ds-sheet__title');
        const { left, top, height } = title.getBoundingClientRect();
        const tap = { bubbles: true, isPrimary: true, pointerId: 7, pointerType: 'touch', clientX: left + 8, clientY: top + height / 2 };
        // Имитируем сдвиг шторки при закрытии клавиатуры и определяем цель click по тем же координатам.
        field.addEventListener('blur', () => { sheet.style.transform = 'translateY(80px)'; }, { once: true });
        title.dispatchEvent(new PointerEvent('pointerdown', tap));
        title.dispatchEvent(new PointerEvent('pointerup', tap));
        const target = document.elementFromPoint(tap.clientX, tap.clientY);
        target.dispatchEvent(new MouseEvent('click', tap));
        sheet.style.transform = '';
        return target === sheet.parentElement;
      });
      if (!clickedBackdrop) problems.push('новое событие: после скрытия клавиатуры тап не попал на фон');
      if (!(await sheet.count())) problems.push('новое событие: тап по заголовку закрыл шторку');
      else {
        if ((await name.inputValue()) !== 'Праздник' || !(await invite.isChecked())) {
          problems.push('новое событие: название или отметка «пригласить» потерялись');
        }
        await page.mouse.click(10, 10); // Фон над шторкой (максимальная высота шторки — 88vh).
        await sheet.waitFor({ state: 'detached' });
      }
    });

    await onPage(problems, 'клавиатура в шторках', admin, null, async (page) => {
      const sheet = page.locator('.ds-sheet');
      const title = sheet.locator('.ds-sheet__title');
      const field = sheet.getByRole('textbox');
      const ime = await page.context().newCDPSession(page);
      async function checkTap(target, word, composing, right = false) {
        await field.fill('');
        if (composing) {
          await ime.send('Input.imeSetComposition', { text: word, selectionStart: word.length, selectionEnd: word.length });
        } else {
          await page.keyboard.insertText(word);
        }
        // Обычный тап экрана. После снятия фокуса WebView не должен послать второй click.
        await page.evaluate(() => { window.sheetClicks = 0; });
        const box = await target.boundingBox();
        await page.touchscreen.tap(box.x + (right ? box.width - 2 : box.width / 2), box.y + box.height / 2);
        if (!(await sheet.count())) throw new Error('шторка закрылась после ввода «' + word + '»');
        if (await field.evaluate(el => document.activeElement === el || window.sheetClicks > 0)) {
          throw new Error('тап не снял фокус или породил click после ввода «' + word + '»');
        }
        if ((await field.inputValue()) !== word) throw new Error('потерян текст «' + word + '»');
      }
      await page.evaluate(() => document.addEventListener('click', () => { window.sheetClicks++; }, true));
      const { invite } = await openCreate(page, 'tap');
      await checkTap(title, 'Праздник', false);
      await checkTap(title, 'Празник', true);
      // Край подсказки под отметкой «пригласить» — не элемент управления (подпись отметки фокус оставляет и переключает её)
      await checkTap(sheet.locator('.ds-hint', { hasText: 'Из образца копируются' }), 'Праздники', true, true);
      if (!(await invite.isChecked())) throw new Error('сброшена отметка «пригласить»');
      await sheet.locator('[title="Закрыть"]').tap();
      await sheet.waitFor({ state: 'detached' });
      await page.locator('#heroAction').tap();
      await page.getByRole('button', { name: '✏️ Изменить имя' }).tap();
      await checkTap(title, 'Админ', false);
      await checkTap(title, 'Адмен', true);
      await sheet.locator('[title="Закрыть"]').tap();
      await sheet.waitFor({ state: 'detached' });
    }, { hasTouch: true, isMobile: true });

    await w.api(admin, 'admin.registration', { event: E, open: false });
    await w.api(admin, 'admin.draw', { event: E });
    await onPage(problems, 'переписка', olya, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Подопечный' }).click();
      await page.locator('#main .ds-btn', { hasText: 'Написать подопечному' }).click();
      await page.locator('.ds-sheet .ds-chat__empty', { hasText: 'Здесь пока пусто' }).waitFor({ timeout: 3000 });
      await expect(page, 'переписка: тап по ленте', '.ds-sheet .ds-composer__input', ['.ds-sheet .ds-chat', ''], {}, false);
      await expect(page, 'переписка: тап по «Отправить»', '.ds-sheet .ds-composer__input', ['.ds-sheet .ds-composer__send', ''], {}, true);
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'клавиатура (039): ' + x));
    else console.log('✔ клавиатура: тап снимает фокус; в формах события и имени обычный и незавершённый ввод сохраняются, отметка «пригласить» остаётся');
  }

  // 063: «Владелец и администраторы» — секция панели события (до 063 — главный экран комнаты; контракт
  // specs/063-events-without-rooms/contracts/events-without-rooms.md, раздел 6). Своё событие «Организаторы»: владелец
  // admin, участники Ира, Кира, Лёва. Владелец назначает участника (выбор и окно с именем) и снимает (✕); администратор
  // видит список и подсказку — без кнопок и выбора; 👑 в строке передаёт владение — новый владелец первым, прежний остаётся
  // администратором. Последней проверкой событие у Иры.
  async function checkOrganizers() {
    const problems = [];
    const [ira, kira, leva] = [['Ира', 'ira'], ['Кира', 'kira'], ['Лёва', 'leva']].map(([name, username], i) => ({ id: 280 + i, name, username }));
    const E = (await w.api(admin, 'event.create', { participate: false, title: 'Организаторы' })).event.id;
    const code = await inv(E);
    for (const p of [ira, kira, leva]) { await w.say(p, '/start ' + code); await w.say(p, p.name); }
    const TITLE = 'Владелец и администраторы';
    const organizers = () => w.query(`SELECT user_id FROM event_admins WHERE event_id = ${Number(E)}`).map((r) => r.user_id);
    const ownerId = () => w.query(`SELECT owner_id FROM events WHERE id = ${Number(E)}`)[0].owner_id;
    const toastIs = (page, text) => page.locator('#toast', { hasText: text }).waitFor({ timeout: 5000 });
    // Список организаторов — первый узел после заголовка секции; строка — по имени в начале («Ира» есть и в «Кира»)
    const row = (page, name) => page.locator('#main .ds-section-title', { hasText: TITLE }).locator('xpath=following-sibling::*[1]')
      .locator('.ds-list-item', { hasText: new RegExp(`^${name} `) });
    // Секция до следующего заголовка: строки «имя: метки [кнопки]», подсказки, выборы (пункты через |), кнопки
    const section = async (page) => {
      await page.locator('#main .ds-section-title', { hasText: TITLE }).waitFor({ timeout: 5000 });
      return page.evaluate((title) => {
        const head = [...document.querySelectorAll('#main .ds-section-title')].find((x) => x.textContent === title);
        const all = (el, sel) => [el, ...el.querySelectorAll(sel)].filter((x) => x.matches(sel));
        const text = (els) => els.map((x) => x.textContent);
        const out = { rows: [], hints: [], selects: [], buttons: [] };
        for (let el = head.nextElementSibling; el && !el.matches('.ds-section-title'); el = el.nextElementSibling) {
          for (const r of all(el, '.ds-list-item')) {
            const name = r.querySelector('.ds-list-item__title')?.firstChild?.textContent ?? r.textContent;
            const btns = text([...r.querySelectorAll('.ds-icon-btn')]);
            out.rows.push(`${name}: ${text([...r.querySelectorAll('.ds-chip')]).join(', ')}${btns.length ? ` [${btns.join(' ')}]` : ''}`);
          }
          out.hints.push(...text(all(el, '.ds-hint').filter((x) => !x.closest('.ds-list-item')))); // @username в строке — тоже ds-hint
          out.selects.push(...all(el, 'select').map((s) => [...s.options].map((o) => o.text).join('|')));
          out.buttons.push(...text(all(el, '.ds-btn')));
        }
        return out;
      }, TITLE);
    };
    const expectSection = (what, got, want) => {
      for (const [k, v] of Object.entries(want)) {
        if (JSON.stringify(got[k]) !== JSON.stringify(v)) problems.push(`${what}: ${k} — ${JSON.stringify(got[k])}, ожидалось ${JSON.stringify(v)}`);
      }
    };
    const rowsAre = (page, n) => waitFor(async () => (await section(page)).rows.length === n, `в списке организаторов ${n}`, 5000);

    await onPage(problems, 'организаторы: назначить и снять', admin, E, async (page) => {
      const asked = [];
      page.on('dialog', (d) => { asked.push(d.message()); d.accept(); });
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      expectSection('владелец, сначала', await section(page), {
        rows: ['Дмитрий: 👑 владелец'],
        hints: [], // 064: подсказки владельцу нет
        selects: ['Кого назначить…|Ира|Кира|Лёва', 'Кого сделать владельцем…|Ира|Кира|Лёва'],
        buttons: ['🛠 Назначить администратором', '👑 Передать владение'],
      });
      const grant = page.locator('#main .ds-card', { has: page.locator('.ds-btn', { hasText: '🛠 Назначить администратором' }) });
      await grant.locator('select').selectOption({ label: 'Ира' });
      await grant.locator('.ds-btn').click();
      await toastIs(page, 'Администратор назначен');
      await rowsAre(page, 2);
      if (!asked[0]?.startsWith('Назначить «Ира» администратором события?')) problems.push(`окно назначения: «${asked[0]}»`);
      if (!organizers().includes(ira.id)) problems.push('назначение: на сервере Иры нет среди организаторов');
      if (!w.texts(ira).some((t) => t.includes('Тебя назначили администратором события'))) problems.push('назначение: Ире нет сообщения');
      expectSection('владелец, Ира назначена', await section(page), {
        rows: ['Дмитрий: 👑 владелец', 'Ира: 🛠 администратор [👑 ✕]'],
        selects: ['Кого назначить…|Кира|Лёва', 'Кого сделать владельцем…|Кира|Лёва'],
      });
      await row(page, 'Ира').locator('.ds-icon-btn[title="Снять права администратора"]').click();
      await toastIs(page, 'Права администратора сняты');
      await rowsAre(page, 1);
      if (asked[1] !== 'Снять права администратора с «Ира»?') problems.push(`окно снятия: «${asked[1]}»`);
      if (organizers().includes(ira.id)) problems.push('снятие: на сервере Ира всё ещё организатор');
    });

    await w.api(admin, 'admin.role.grant', { event: E, id: ira.id });
    await onPage(problems, 'организаторы: администратор', ira, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      expectSection('администратор', await section(page), {
        rows: ['Дмитрий: 👑 владелец', 'Ира: 🛠 администратор'],
        hints: ['Назначает администраторов владелец события — Дмитрий.'],
        selects: [],
        buttons: [],
      });
    });
    const toSection = async (p) => {
      const head = p.locator('#main .ds-section-title', { hasText: TITLE });
      await head.waitFor({ timeout: 5000 });
      await head.evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }); // над ним — липкие вкладки
    };
    for (const dark of [false, true]) {
      await shot(admin, '63-organizers', { event: E, tab: 'Управление', fullPage: false, dark, before: toSection });
      await shot(ira, '63-organizers-admin', { event: E, tab: 'Управление', fullPage: false, dark, before: toSection });
    }

    await onPage(problems, 'организаторы: передать владение', admin, E, async (page) => {
      let asked = '';
      page.on('dialog', (d) => { asked = d.message(); d.accept(); });
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      await section(page);
      await row(page, 'Ира').locator('.ds-icon-btn[title="Передать владение событием"]').click();
      await toastIs(page, '👑 Владение передано');
      await waitFor(async () => (await section(page)).rows[0]?.startsWith('Ира:'), 'Ира — первой в списке', 5000);
      if (!asked.startsWith('Сделать «Ира» владельцем события?')) problems.push(`окно передачи: «${asked}»`);
      if (ownerId() !== ira.id) problems.push(`передача: на сервере владелец ${ownerId()}`);
      if (!organizers().includes(admin.id)) problems.push('передача: прежний владелец больше не администратор');
      const rows = (await section(page)).rows.map((r) => r.replace(/ \[.*\]$/, ''));
      if (rows.join('|') !== 'Ира: 👑 владелец|Дмитрий: 🛠 администратор') problems.push(`после передачи: ${rows.join(', ')}`);
    });
    await onPage(problems, 'организаторы: новый владелец', ira, E, async (page) => {
      await page.locator('.ds-tab', { hasText: 'Управление' }).click();
      expectSection('новый владелец', await section(page), {
        rows: ['Ира: 👑 владелец', 'Дмитрий: 🛠 администратор [👑 ✕]'],
        selects: ['Кого назначить…|Кира|Лёва', 'Кого сделать владельцем…|Кира|Лёва'],
        buttons: ['🛠 Назначить администратором', '👑 Передать владение'],
      });
    });

    if (problems.length) colorProblems.push(...problems.map((x) => 'владелец и администраторы (063): ' + x));
    else console.log('✔ владелец и администраторы (063): секция в панели события — назначить участника (окно, сообщение), снять ✕, передать владение 👑 (новый владелец первым, прежний — администратор); у администратора — подсказка без кнопок');
  }

  // 063: «Настройки» — ⚙️ в шапке «Моих событий», «‹» — обратно. Участнику — «Профиль» (имя, «🌐 Язык»), «Уведомления»
  // (064: без «О боте» и подсказки; «Поддержать проект» — только в открытом боте); владельцу бота ещё «Владелец бота»: «Все события»
  // (новые первыми, выбор открывает событие), «Кто может создавать события» (переключатель — разрешение на сервере и
  // «🎄 Создать событие» у человека; выключение — обратно), журнал бота (записи разрешений сверху), передача прав (выбор
  // и окно; «Отмена» — владелец бота прежний). Снимки — в обеих темах
  async function checkSettings() {
    const problems = [];
    const toSettings = async (page) => {
      await page.locator('#heroAction').click();
      await page.locator('#heroTitle', { hasText: /^Настройки$/ }).waitFor({ timeout: 5000 });
    };
    const titles = (page) => page.locator('#main .ds-section-title').allTextContents();
    const tool = (page, text) => page.locator('#main .ds-btn', { hasText: text });
    const closeSheet = async (page) => {
      await page.locator('.ds-sheet .ds-icon-btn[title="Закрыть"]').click();
      await page.locator('.ds-sheet').waitFor({ state: 'detached', timeout: 5000 });
    };
    const toastIs = (page, text) => page.locator('#toast', { hasText: text }).waitFor({ timeout: 5000 });
    const petya = people[1];
    const canCreate = () => w.query(`SELECT can_create FROM users WHERE tg_id = ${petya.id}`)[0].can_create;
    const petyaBar = (want) => onPage(problems, `главный экран Пети (${want ? 'может' : 'не может'} создавать)`, petya, null, async (page) => {
      const bar = await page.locator('#main .ds-bottom-bar .ds-btn', { hasText: '🎄 Создать событие' }).count();
      if (bar !== (want ? 1 : 0)) problems.push(`Петя ${want ? 'может' : 'не может'} создавать, а «🎄 Создать событие» ${bar ? 'есть' : 'нет'}`);
    });

    await onPage(problems, '«Настройки» участника', petya, null, async (page) => {
      if (await page.locator('#heroBack').isVisible()) problems.push('главный экран: есть «‹»');
      await toSettings(page);
      if (!(await page.locator('#heroBack').isVisible())) problems.push('«Настройки»: нет «‹»');
      if (await page.locator('#heroAction').isVisible()) problems.push('«Настройки»: в шапке осталась ⚙️');
      if ((await page.locator('#heroSub').textContent()) !== 'Привет, Петя!') problems.push(`«Настройки»: подзаголовок «${await page.locator('#heroSub').textContent()}»`);
      const t = await titles(page);
      if (t.join('|') !== 'Профиль|Уведомления') problems.push(`участник: разделы ${t.join(', ')}`);
      if ((await page.locator('#main .ds-text-strong').first().textContent()) !== 'Петя') problems.push('«Профиль»: не своё имя');
      if (!(await tool(page, '✏️ Изменить имя').count())) problems.push('«Профиль»: нет «✏️ Изменить имя»');
      const lang = page.locator('#main .ds-list-item--link', { hasText: '🌐 Язык' });
      const langNow = await lang.locator('.ds-text-muted').textContent();
      if (!langNow.startsWith('Как в Telegram (')) problems.push(`«🌐 Язык»: «${langNow}»`);
      const modes = await page.locator('#main .ds-segmented__item').allTextContents();
      if (modes.join('|') !== '🔔 Звук|🔕 Тихо|🚫 Выкл') problems.push(`«Уведомления»: ${modes.join(', ')}`);
      if ((await page.locator('#main .ds-segmented__item--on').allTextContents()).join('|') !== '🔔 Звук') problems.push('«Уведомления»: выбран не «🔔 Звук»');
      const notifyCard = page.locator('#main .ds-section-title', { hasText: 'Уведомления' }).locator('xpath=following-sibling::*[1]');
      if (await notifyCard.locator('.ds-hint').count()) problems.push('«Уведомления»: осталась подсказка');
      if (await page.locator('#main .ds-donate').count()) problems.push('закрытый бот: в «Настройках» есть «Поддержать проект»');
      await lang.click();
      await page.locator('.ds-sheet__title', { hasText: '🌐 Язык' }).waitFor({ timeout: 5000 });
      const langs = await page.locator('.ds-sheet .ds-btn').allTextContents();
      if (langs.length !== LANGUAGES.length + 1 || !langs[0].startsWith('✓ Как в Telegram (')) problems.push(`шторка языка: ${langs.join(', ')}`);
      await closeSheet(page);
      await page.locator('#heroBack').click();
      await page.locator('#heroTitle', { hasText: /^Тайный Санта$/ }).waitFor({ timeout: 5000 });
      if (!(await page.locator('#heroAction').isVisible())) problems.push('«‹» из «Настроек»: на главном экране нет ⚙️');
    });

    await onPage(problems, '«Настройки» владельца бота', admin, null, async (page) => {
      await toSettings(page);
      const t = await titles(page);
      if (t.join('|') !== 'Профиль|Уведомления|Владелец бота') problems.push(`владелец бота: разделы ${t.join(', ')}`);
      const tools = await page.locator('#main .ds-section-title', { hasText: 'Владелец бота' }).locator('xpath=following-sibling::*[1]').locator('.ds-btn').allTextContents();
      const TOOLS = ['🗂 Все события', '✍️ Кто может создавать события', '📜 Журнал бота', '👑 Передать права владельца бота'];
      if (tools.join('|') !== TOOLS.join('|')) problems.push(`«Владелец бота»: ${tools.join(', ')}`);

      // «Все события»: новые первыми; строка — статус и «Владелец — … · участников: N»; выбор — событие, шторка закрыта
      await tool(page, '🗂 Все события').click();
      const rows = page.locator('.ds-sheet .ds-list-item--link');
      await rows.first().waitFor({ timeout: 5000 });
      const got = await rows.locator('.ds-list-item__title').allTextContents();
      const want = w.query('SELECT title FROM events ORDER BY created_at DESC, id DESC LIMIT 50').map((r) => r.title);
      if (got.join('|') !== want.join('|')) problems.push(`«Все события»: ${got.join(', ')}; ожидалось ${want.join(', ')}`);
      if (await page.locator('.ds-sheet .ds-btn', { hasText: 'Показать ещё' }).isVisible()) problems.push('«Все события»: «Показать ещё» при одной странице');
      const office = rows.filter({ hasText: 'Офис' });
      const officeChips = await office.locator('.ds-chip').allTextContents();
      if (officeChips.join('|') !== 'идёт') problems.push(`«Все события», «Офис»: метки ${officeChips.join(', ')}`);
      const about = await office.locator('.ds-hint').textContent();
      if (!about.startsWith('Владелец — Дмитрий · участников: ')) problems.push(`«Все события», «Офис»: «${about}»`);
      await office.click();
      await page.locator('#heroTitle', { hasText: /^Офис$/ }).waitFor({ timeout: 5000 });
      if (await page.locator('.ds-sheet').count()) problems.push('«Все события»: шторка не закрылась после выбора');
      await page.locator('#heroBack').click();
      await toSettings(page);

      // «Кто может создавать события»: все, кроме самого владельца бота; переключатель Пети — туда и обратно
      await tool(page, '✍️ Кто может создавать события').click();
      await page.locator('.ds-sheet__title', { hasText: 'Кто может создавать события' }).waitFor({ timeout: 5000 });
      const names = await page.locator('.ds-sheet .ds-text-strong').allTextContents();
      if (names.includes('Дмитрий') || !names.includes('Петя')) problems.push(`«Кто может создавать»: ${names.join(', ')}`);
      const sw = page.locator('.ds-sheet label.ds-switch:has(input[aria-label="Петя"])');
      if (await sw.locator('input').isChecked()) problems.push('Петя уже может создавать — проверка разрешения ничего не значит');
      await petyaBar(false);
      await sw.click();
      await toastIs(page, '«Петя» теперь может создавать события');
      if (canCreate() !== 1) problems.push(`разрешение: на сервере can_create = ${canCreate()}`);
      await petyaBar(true);
      await sw.click();
      await toastIs(page, '«Петя» больше не может создавать события');
      if (canCreate() !== 0) problems.push(`снятие разрешения: на сервере can_create = ${canCreate()}`);
      await petyaBar(false);
      await closeSheet(page);

      // Журнал бота: новые сверху — последним было снятие разрешения
      await tool(page, '📜 Журнал бота').click();
      await page.locator('.ds-sheet__title', { hasText: 'Журнал бота' }).waitFor({ timeout: 5000 });
      await page.locator('.ds-sheet .ds-list-item').first().waitFor({ timeout: 5000 });
      const labels = await page.locator('.ds-sheet .ds-list-item__title').allTextContents();
      for (const l of ['✍️ Запрещено создавать события', '✍️ Разрешено создавать события', '🎄 Создано событие']) {
        if (!labels.includes(l)) problems.push(`журнал бота: нет «${l}»`);
      }
      if (labels[0] !== '✍️ Запрещено создавать события') problems.push(`журнал бота: первая запись «${labels[0]}»`);
      await closeSheet(page);

      // Передача прав: выбор без себя, окно с именем; «Отмена» — шторка открыта, владелец бота прежний
      await tool(page, '👑 Передать права владельца бота').click();
      const sheet = page.locator('.ds-sheet', { hasText: 'Права владельца бота' });
      await sheet.locator('select').waitFor({ timeout: 5000 });
      const opts = await sheet.locator('select option').allTextContents();
      if (opts[0] !== 'Кому передать…' || !opts.includes('Петя') || opts.includes('Дмитрий')) problems.push(`передача прав: выбор ${opts.join(', ')}`);
      await sheet.locator('select').selectOption({ label: 'Петя' });
      let asked = '';
      page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
      await sheet.locator('.ds-btn--danger').click();
      await page.waitForTimeout(300);
      if (!asked.startsWith('Передать права владельца бота «Петя»?')) problems.push(`передача прав: окно «${asked}»`);
      if (!(await sheet.count())) problems.push('передача прав: «Отмена» закрыла шторку');
      const owner = w.query("SELECT value FROM settings WHERE key = 'owner_id'")[0]?.value;
      if (String(owner) !== String(admin.id)) problems.push(`передача прав: после «Отмена» владелец бота ${owner}`);
    });

    for (const dark of [false, true]) {
      await shot(petya, '63-settings', { dark, before: toSettings });
      await shot(admin, '63-settings-bot-owner', { dark, before: toSettings });
    }

    if (problems.length) colorProblems.push(...problems.map((x) => '«Настройки» (063): ' + x));
    else console.log('✔ «Настройки» (063): ⚙️ и «‹»; участнику — профиль, язык, уведомления (064: без «О боте»); владельцу бота — все события (новые первыми, открывают событие), кто может создавать (разрешение и кнопка у человека — туда и обратно), журнал бота, передача прав («Отмена» — прежний владелец)');
  }

  // 063: главный экран «Мои события». Идёт после проверок, которые создают события: у admin длинный список — «Идут» (по
  // дате вручения, без даты — в конце, при равных — новые первыми) и «Завершённые · N» (свёрнуты, недавно завершённые
  // первыми). «🎄 Создать событие» — нижняя панель: на 320 точках в обеих темах у нижнего края, подпись целиком, при
  // прокрутке до конца последний пункт над панелью (и с раскрытыми «Завершёнными»). Без права создавать (закрытый бот,
  // people[1]) панели нет.
  async function checkHome() {
    const problems = [];
    const { events } = await w.api(admin, 'me');
    const byDate = (a, b) => (a.event_date && b.event_date ? a.event_date.localeCompare(b.event_date)
      : a.event_date ? -1 : b.event_date ? 1 : 0) || b.id - a.id;
    const going = events.filter((e) => e.status !== 'finished').sort(byDate).map((e) => e.title);
    const done = events.filter((e) => e.status === 'finished').sort((a, b) => (b.finished_at || 0) - (a.finished_at || 0) || b.id - a.id).map((e) => e.title);
    // Панель и содержимое в координатах экрана; last — низ последнего видимого узла страницы, кроме панели
    const bar = (page) => page.evaluate(() => {
      const el = document.querySelector('#main .ds-bottom-bar');
      if (!el) return null;
      const btn = el.querySelector('.ds-btn');
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--ds-color-bg)';
      document.body.append(probe);
      const want = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const r = el.getBoundingClientRect(), b = btn.getBoundingClientRect();
      const content = [...document.getElementById('main').children].filter((x) => x !== el && x.getClientRects().length);
      return {
        top: r.top, bottom: r.bottom, screen: innerHeight, btnTop: b.top, btnBottom: b.bottom, text: btn.textContent,
        fits: btn.scrollWidth <= btn.clientWidth, wide: document.documentElement.scrollWidth > innerWidth,
        last: Math.max(...content.map((x) => x.getBoundingClientRect().bottom)),
        scroll: scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight,
        bg: getComputedStyle(el).backgroundColor, want, padded: document.getElementById('main').classList.contains('ds-page--bar'),
      };
    });
    const expectBar = (what, b, end = false) => {
      if (!b) return problems.push(`${what}: нет нижней панели «Создать событие»`);
      if (b.text !== '🎄 Создать событие') problems.push(`${what}: кнопка «${b.text}»`);
      if (Math.abs(b.bottom - b.screen) > 1) problems.push(`${what}: панель не у нижнего края (низ ${b.bottom}, экран ${b.screen})`);
      if (b.btnTop < 0 || b.btnBottom > b.screen) problems.push(`${what}: кнопка за краем экрана`);
      if (!b.fits) problems.push(`${what}: подпись кнопки обрезана`);
      if (b.wide) problems.push(`${what}: горизонтальная прокрутка страницы`);
      if (!b.padded) problems.push(`${what}: у страницы нет ds-page--bar`);
      if (b.bg !== b.want) problems.push(`${what}: фон панели ${b.bg}, ожидался ${b.want} (--ds-color-bg)`);
      if (end) {
        if (b.maxScroll < 100) problems.push(`${what}: список не длиннее экрана (${b.maxScroll}) — прокрутка не проверена`);
        if (Math.abs(b.scroll - b.maxScroll) > 1) problems.push(`${what}: страница не прокручена до конца (${b.scroll} из ${b.maxScroll})`);
        if (b.last > b.top + 0.5) problems.push(`${what}: последний пункт под панелью (низ ${Math.round(b.last)}, панель с ${Math.round(b.top)})`);
      }
    };
    const toEnd = async (page) => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(200);
    };

    for (const dark of [false, true]) {
      const what = `главный экран, 320${dark ? ' (тёмная)' : ''}`;
      const page = await openPage(what, { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 });
      try {
        await paintTheme(page, dark);
        await page.goto(`${w.base}/app#tgWebAppData=${encodeURIComponent(initData(admin))}`);
        await page.locator('#main .ds-bottom-bar').waitFor({ timeout: 10000 });
        await page.waitForTimeout(300);
        await checkColors(page, what);
        await checkScheme(page, what, dark ? 'dark' : 'light');
        if ((await page.locator('#heroTitle').textContent()) !== 'Тайный Санта') problems.push(`${what}: шапка «${await page.locator('#heroTitle').textContent()}»`);
        if (await page.locator('#heroBack').isVisible()) problems.push(`${what}: есть «‹»`);
        if (!(await page.locator('#heroAction').isVisible())) problems.push(`${what}: нет ⚙️`);
        const heads = await page.locator('#main .ds-section-title').allTextContents();
        if (heads.join('|') !== `Идут|Завершённые · ${done.length}`) problems.push(`${what}: заголовки ${heads.join(', ')}`);
        const shown = await page.locator('#main > .ds-card .ds-list-item__title').allTextContents();
        if (shown.join('|') !== going.join('|')) problems.push(`${what}: «Идут» — ${shown.join(', ')}; ожидалось ${going.join(', ')}`);
        const details = page.locator('#main details.ds-details');
        if (await details.evaluate((d) => d.open)) problems.push(`${what}: «Завершённые» раскрыты сразу`);
        if (await details.locator('.ds-list-item').first().isVisible()) problems.push(`${what}: завершённые видны в свёрнутом списке`);
        const office = await page.locator('#main .ds-list-item--link', { hasText: 'Офис' }).locator('.ds-chip').allTextContents();
        if (office[0] !== '👑 владелец' || office.at(-1) !== 'ты не участвуешь') problems.push(`${what}: метки «Офиса» — ${office.join(', ')}`);
        expectBar(what, await bar(page));
        await page.screenshot({ path: snapPath('63-home-320' + (dark ? '-dark' : '')) });
        await toEnd(page);
        expectBar(`${what}, прокрутка до конца`, await bar(page), true);
        await page.locator('#main .ds-details__summary').click();
        await details.locator('.ds-list-item').first().waitFor({ timeout: 3000 });
        const finished = await details.locator('.ds-list-item__title').allTextContents();
        if (finished.join('|') !== done.join('|')) problems.push(`${what}: «Завершённые» — ${finished.join(', ')}; ожидалось ${done.join(', ')}`);
        await toEnd(page);
        expectBar(`${what}, «Завершённые» раскрыты`, await bar(page), true);
        await page.screenshot({ path: snapPath('63-home-320-end' + (dark ? '-dark' : '')) });
      } catch (e) {
        problems.push(`${what}: ${e.message.split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }

    await onPage(problems, 'главный экран без права создавать', people[1], null, async (page) => {
      if (await page.locator('#main .ds-bottom-bar').count()) problems.push('без права создавать: есть нижняя панель');
      if (await page.getByRole('button', { name: '🎄 Создать событие' }).count()) problems.push('без права создавать: есть «🎄 Создать событие»');
      if (await page.locator('#main.ds-page--bar').count()) problems.push('без права создавать: у страницы ds-page--bar');
    });

    if (problems.length) colorProblems.push(...problems.map((x) => '«Мои события» (063): ' + x));
    else console.log('✔ «Мои события» (063): «Идут» по дате вручения, «Завершённые» свёрнуты; «🎄 Создать событие» внизу на 320 точках в обеих темах — у края, подпись целиком, последний пункт над панелью при прокрутке; без права создавать — панели нет');
  }

  // 063: открытый бот — второй Worker с OPEN_BOT = 1: создавать события может любой. Незнакомец без ссылки — пустые «Мои
  // события» с подсказкой и «🎄 Создать событие» (обе темы); шторка — без образца, «Я тоже участвую» включено, «можно ещё
  // 10»; после создания — новое событие на «Управлении», «‹» — строка с «👑 владелец», «можно ещё 9». Пришедший по ссылке
  // тоже может создать своё. На пределе (10 за 12 месяцев) «Создать» в шторке недоступна, подсказка — с какого числа
  async function checkOpenBot() {
    const problems = [];
    const o = await startWorld({ vars: { OPEN_BOT: '1' } });
    try {
      await o.setup();
      const [zoya, petya] = [{ id: 260, name: 'Зоя', username: 'zoya' }, { id: 261, name: 'Петя', username: 'petya' }];
      await o.say(zoya, '/start');
      await o.say(zoya, zoya.name);
      const go = async (what, user, fn, dark = false) => {
        const page = await openPage(what, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
        try {
          await paintTheme(page, dark);
          await page.goto(`${o.base}/app#tgWebAppData=${encodeURIComponent(initData(user))}`);
          await page.waitForSelector('#heroAction:not([hidden]), .ds-tabs:not([hidden])');
          await fn(page);
          await checkColors(page, what);
        } catch (e) {
          problems.push(`${what}: ${e.message.split('\n')[0]}`);
        } finally {
          await page.close();
        }
      };
      const createBtn = (page) => page.locator('#main .ds-bottom-bar .ds-btn', { hasText: '🎄 Создать событие' });
      const sheet = (page) => page.locator('.ds-sheet', { hasText: 'Новое событие' });
      const openCreate = async (page) => {
        await createBtn(page).click();
        await sheet(page).waitFor({ timeout: 5000 });
      };
      const limitHint = (page) => sheet(page).locator('.ds-hint').last().textContent();
      const ok = (page) => sheet(page).locator('.ds-btn', { hasText: /^Создать$/ });

      for (const dark of [false, true]) {
        await go(`открытый бот: пустые «Мои события»${dark ? ' (тёмная)' : ''}`, zoya, async (page) => {
          await page.locator('#main .ds-hint', { hasText: 'Событий пока нет. Создай своё — кнопка внизу' }).waitFor({ timeout: 5000 });
          if (await page.locator('#heroBack').isVisible()) problems.push('пустые «Мои события»: есть «‹»');
          if (!(await createBtn(page).isVisible())) problems.push('пустые «Мои события»: нет «🎄 Создать событие» внизу');
          await page.screenshot({ path: snapPath('63-open-empty' + (dark ? '-dark' : '')) });
        }, dark);
      }

      await go('открытый бот: незнакомец создаёт событие', zoya, async (page) => {
        await openCreate(page);
        const s = sheet(page);
        if (await s.locator('select').count()) problems.push('шторка: выбор образца, а своих событий нет');
        if (!(await s.getByRole('checkbox', { name: 'Я тоже участвую' }).isChecked())) problems.push('шторка: «Я тоже участвую» выключено');
        if ((await limitHint(page)) !== 'Можно создать ещё 10 событий за 12 месяцев.') problems.push(`шторка: подсказка «${await limitHint(page)}»`);
        await page.screenshot({ path: snapPath('63-open-create') });
        await s.locator('input.ds-input[type="text"]').fill('Ёлка у Зои');
        await ok(page).click();
        await page.locator('#toast', { hasText: '🎄 Событие создано' }).waitFor({ timeout: 5000 });
        await page.locator('#heroTitle', { hasText: /^Ёлка у Зои$/ }).waitFor({ timeout: 5000 });
        await page.locator('.ds-tab--active', { hasText: 'Управление' }).waitFor({ timeout: 5000 });
        await page.locator('#heroBack').click();
        const row = page.locator('#main .ds-list-item--link', { hasText: 'Ёлка у Зои' });
        await row.waitFor({ timeout: 5000 });
        const chips = await row.locator('.ds-chip').allTextContents();
        if (chips.join('|') !== '👑 владелец') problems.push(`строка своего события: метки ${chips.join(', ') || 'нет'}`);
        await openCreate(page);
        if ((await limitHint(page)) !== 'Можно создать ещё 9 событий за 12 месяцев.') problems.push(`после создания: подсказка «${await limitHint(page)}»`);
      });

      const ev = o.query("SELECT id, owner_id FROM events WHERE title = 'Ёлка у Зои'")[0];
      if (!ev) throw new Error('событие Зои не создано');
      if (ev.owner_id !== zoya.id) problems.push(`владелец события Зои — ${ev.owner_id}`);
      if (!o.query(`SELECT 1 FROM members WHERE event_id = ${Number(ev.id)} AND user_id = ${zoya.id}`).length) problems.push('«Я тоже участвую»: Зоя не участница');
      const code = /start=(inv_[a-z0-9]+)/.exec((await o.api(zoya, 'admin.state', { event: ev.id })).settings.invite_link)[1];
      await o.say(petya, '/start ' + code);
      await o.say(petya, petya.name);

      await go('открытый бот: пришедший по ссылке', petya, async (page) => {
        const row = page.locator('#main .ds-list-item--link', { hasText: 'Ёлка у Зои' });
        await row.waitFor({ timeout: 5000 });
        if (await row.locator('.ds-chip').count()) problems.push(`участник: метки ${(await row.locator('.ds-chip').allTextContents()).join(', ')}`);
        if (!(await createBtn(page).isVisible())) problems.push('пришедший по ссылке: нет «🎄 Создать событие»');
        await page.screenshot({ path: snapPath('63-open-member'), fullPage: true });
      });

      for (let i = 2; i <= 10; i++) await o.api(zoya, 'event.create', { participate: false, title: `Ёлка Зои ${i}` });
      await go('открытый бот: предел создания', zoya, async (page) => {
        await openCreate(page);
        if (!(await ok(page).isDisabled())) problems.push('предел: «Создать» доступна');
        const hint = await limitHint(page);
        if (!hint.startsWith('За 12 месяцев можно создать не больше 10 событий. Следующее — с ')) problems.push(`предел: подсказка «${hint}»`);
        await page.screenshot({ path: snapPath('63-open-limit') });
      });
    } catch (e) {
      problems.push(e.message.split('\n')[0]);
    } finally {
      await o.stop();
    }
    if (problems.length) colorProblems.push(...problems.map((x) => 'открытый бот (063): ' + x));
    else console.log('✔ открытый бот (063): незнакомец — пустые «Мои события» с подсказкой и «Создать событие» (обе темы), шторка с лимитом, событие на «Управлении», строка «👑 владелец»; пришедший по ссылке тоже создаёт; на пределе «Создать» недоступна');
  }

  // 053: «Нравится бот?» на «Инфо» — только в открытом боте, сразу под «Нужна помощь?» (или на его месте), последним или
  // перед «Выход из события» (064: «Как это работает» нет); кнопка — openLink без запросов к Worker (заглушка SDK: скрипт
  // Telegram на страницах прогона заблокирован)
  async function checkDonate() {
    const problems = [];
    const DONATE = 'https://dalink.to/trivial_no';
    const CARD = ['☕', 'Поддержать проект',
      'Бот полностью бесплатный. Если он оказался вам полезен, вы можете поддержать его развитие и дальнейшее улучшение.',
      '❤️ Поддержать через DonationAlerts', 'Любая сумма имеет значение. Спасибо!'];
    const info = async (base, what, user, event, { dark = false, width = 390 } = {}) => {
      const page = await openPage(what, { viewport: { width, height: 844 }, deviceScaleFactor: 2 });
      await page.addInitScript((vars) => {
        window.__links = [];
        window.Telegram = { WebApp: {
          initData: '', isVerticalSwipesEnabled: true, ready() {}, expand() {}, isVersionAtLeast: () => false,
          disableVerticalSwipes() {}, enableVerticalSwipes() {}, openLink(url) { window.__links.push(url); },
        } };
        document.addEventListener('DOMContentLoaded', () => {
          for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
        });
      }, dark ? DARK : LIGHT);
      await page.goto(`${base}/app?event=${event}#tgWebAppData=${encodeURIComponent(initData(user))}`);
      await page.waitForSelector('.ds-tabs:not([hidden])');
      await page.locator('.ds-tab', { hasText: 'Инфо' }).click();
      await page.locator('#main .ds-section-title', { hasText: 'Участники' }).waitFor({ timeout: 5000 });
      return page;
    };
    const titles = (page) => page.locator('#main .ds-section-title').allTextContents();
    // Блок на месте и полный; before — заголовок раздела прямо над ним (или null — не проверять)
    const placed = async (page, what, before) => {
      const t = await titles(page);
      const i = t.indexOf('Нравится бот?');
      if (i < 0) return problems.push(`${what}: нет «Нравится бот?» (разделы: ${t.join(' · ')})`);
      if (![undefined, 'Выход из события'].includes(t[i + 1])) problems.push(`${what}: после «Нравится бот?» — «${t[i + 1]}»`);
      if (t.includes('Как это работает')) problems.push(`${what}: остался «Как это работает»`);
      if (before && t[i - 1] !== before) problems.push(`${what}: перед «Нравится бот?» — «${t[i - 1]}», ожидалось «${before}»`);
      const card = await page.locator('#main .ds-donate').evaluate((el) => [...el.children].map((c) => c.textContent));
      if (JSON.stringify(card) !== JSON.stringify(CARD)) problems.push(`${what}: карточка ${JSON.stringify(card)}`);
    };
    const press = async (page, what) => {
      const api = [];
      page.on('request', (r) => { if (r.url().includes('/api/')) api.push(r.url()); });
      await page.locator('#main .ds-btn--donate').click();
      await page.waitForTimeout(300);
      const links = await page.evaluate(() => window.__links);
      if (JSON.stringify(links) !== JSON.stringify([DONATE])) problems.push(`${what}: openLink — ${JSON.stringify(links)}`);
      if (api.length) problems.push(`${what}: нажатие отправило запросы ${api.join(', ')}`);
    };
    const colors = async (page, what) => {
      const c = await page.locator('#main .ds-btn--donate').evaluate((b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color]);
      if (c[0] !== 'rgb(237, 130, 36)' || c[1] !== 'rgb(255, 255, 255)') problems.push(`${what}: кнопка ${c.join(' / ')}`);
    };
    const snap = (page, name) => page.screenshot({ path: snapPath(name), fullPage: true });

    const o = await startWorld({ vars: { OPEN_BOT: '1' } });
    try {
      await o.setup();
      const [lena, kolya] = [{ id: 270, name: 'Лена', username: 'lena' }, { id: 271, name: 'Коля', username: 'kolya' }];
      await o.say(lena, '/start');
      await o.say(lena, lena.name);
      const ev = (await o.api(lena, 'event.create', { participate: false, title: 'Ёлка у Лены' })).event.id;
      const code = /start=(inv_[a-z0-9]+)/.exec((await o.api(lena, 'admin.state', { event: ev })).settings.invite_link)[1];
      await o.say(kolya, '/start ' + code);
      await o.say(kolya, kolya.name);

      for (const dark of [false, true]) {
        const what = `поддержка: участник${dark ? ' (тёмная)' : ''}`;
        const page = await info(o.base, what, kolya, ev, { dark });
        try {
          await placed(page, what, 'Нужна помощь?');
          await colors(page, what);
          await checkColors(page, what);
          await page.locator('#main .ds-donate').scrollIntoViewIfNeeded();
          await snap(page, dark ? '53-donate-dark' : '53-donate');
          if (!dark) await press(page, what);
        } finally {
          await page.close();
        }
      }

      const narrow = await info(o.base, 'поддержка: 320', kolya, ev, { width: 320 });
      try {
        const fit = await narrow.evaluate(() => {
          const b = document.querySelector('#main .ds-btn--donate');
          return { page: document.documentElement.scrollWidth <= window.innerWidth, button: b.scrollWidth <= b.clientWidth };
        });
        if (!fit.page) problems.push('320: горизонтальная прокрутка страницы');
        if (!fit.button) problems.push('320: подпись кнопки обрезана');
        await narrow.locator('#main .ds-donate').scrollIntoViewIfNeeded();
        await snap(narrow, '53-donate-320');
      } finally {
        await narrow.close();
      }

      const own = await info(o.base, 'поддержка: владелец-организатор', lena, ev);
      try {
        await placed(own, 'владелец-организатор', null);
      } finally {
        await own.close();
      }

      await o.api(lena, 'admin.event.finish', { event: ev });
      const done = await info(o.base, 'поддержка: завершённое', kolya, ev);
      try {
        await placed(done, 'завершённое', null);
        await press(done, 'завершённое');
      } finally {
        await done.close();
      }
    } catch (e) {
      problems.push(e.message.split('\n')[0]);
    } finally {
      await o.stop();
    }

    // Закрытый бот (основной мир): блока нет ни у участника, ни у организатора
    for (const [who, user] of [['участник', people[0]], ['организатор', admin]]) {
      const page = await info(w.base, `поддержка: закрытый бот, ${who}`, user, A);
      try {
        if ((await titles(page)).includes('Нравится бот?') || (await page.locator('.ds-donate, .ds-btn--donate').count())) {
          problems.push(`закрытый бот, ${who}: есть «Нравится бот?»`);
        }
      } finally {
        await page.close();
      }
    }

    if (problems.length) colorProblems.push(...problems.map((x) => 'поддержка проекта (053): ' + x));
    else console.log('✔ поддержка проекта: в открытом боте — под «Нужна помощь?», последним или перед «Выход из события» (без «Как это работает»), у организатора и в завершённом; кнопка DonationAlerts в обеих темах, openLink без запросов, 320 точек; в закрытом боте блока нет');
  }

  // event — открыть эвент (как из кнопки бота); без него — главный экран «Мои события» (063)
  async function shot(user, name, { event, tab, dark = false, before, fullPage = true } = {}) {
    const page = await openPage(name + (dark ? ' (тёмная)' : ''), { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await paintTheme(page, dark);
    const q = event ? `?event=${event}` : '';
    await page.goto(`${w.base}/app${q}#tgWebAppData=${encodeURIComponent(initData(user))}`);
    await page.waitForSelector(event ? '.ds-tabs:not([hidden])' : HOME_READY);
    if (tab) { await page.locator('.ds-tab', { hasText: tab }).click(); }
    await page.waitForTimeout(400);
    await checkColors(page, name + (dark ? ' (тёмная)' : ''));
    await checkScheme(page, name + (dark ? ' (тёмная)' : ''), dark ? 'dark' : 'light');
    if (before) { await before(page); await page.waitForTimeout(500); }
    await page.screenshot({ path: snapPath(name + (dark ? '-dark' : '')), fullPage });
    await page.close();
    console.log('✔', name + (dark ? ' (тёмная)' : ''));
  }

  // Главный экран (005, 063): мои события, создание события
  await shot(admin, '00-home');
  await shot(admin, '00-home', { dark: true });
  await shot(admin, '13-new-event', { fullPage: false, before: (p) => p.getByRole('button', { name: '🎄 Создать событие', exact: true }).click() });
  await shot(people[1], '16-home-participant');

  // До жеребьёвки (063: без ?event — «Мои события», событие открывается из адреса)
  await shot(people[4], '01-my-letter-empty', { event: A });
  await shot(people[0], '02-my-letter', { event: A });
  // 006: Катя заблокировала бота (после того как открыла приложение для скриншота 01) — в панели админа у неё метка «не получает сообщения»
  w.sql('UPDATE users SET blocked_at = 1 WHERE tg_id = 105');
  await shot(admin, '03-admin-before-draw', { event: A, tab: 'Управление' });

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
  // 007: объявление во вкладке «Инфо», журнал действий (064: отметки «получил подарок» нет)
  await w.api(admin, 'admin.announce', { event: A, text: 'Собираемся 27 декабря в 18:00 у Маши. Подарки кладём под ёлку, подписываем только именем получателя 🎄' });
  await shot(people[0], '06-info', { event: A, tab: 'Инфо' });
  await shot(admin, '07-admin-after-draw', { event: A, tab: 'Управление' });
  await shot(people[0], '08-admin-as-regular-admin', { event: A, tab: 'Управление' });
  await shot(admin, '08b-admin-not-member', { event: B, tab: 'Управление' });
  // 012: вопрос организатору — «Инфо» → «Нужна помощь?», переписка участника, раздел «Обращения», шторка обращения
  await w.api(people[2], 'support.send', { event: A, text: 'Не могу найти, где написать Санте 🙈' });
  const sup = await w.api(people[3], 'support.send', { event: A, text: 'Можно поменять письмо после жеребьёвки?' });
  await w.api(people[0], 'admin.support.send', { event: A, thread: sup.thread, text: 'Да, во вкладке «Письмо» — Санта сразу увидит новое письмо.' });
  await shot(people[3], '24-info-support', { event: A, tab: 'Инфо' });
  const openMySupport = (p) => p.locator('.ds-btn', { hasText: 'Задать вопрос' }).first().click();
  await shot(people[3], '25-support-chat', { event: A, fullPage: false, tab: 'Инфо', before: openMySupport });
  await shot(people[3], '25-support-chat', { event: A, fullPage: false, tab: 'Инфо', dark: true, before: openMySupport });
  await shot(admin, '26-admin-support', { event: A, fullPage: false, tab: 'Управление', before: (p) => p.locator('.ds-section-title', { hasText: 'Обращения' }).evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }) });
  const openThread = (name) => (p) => p.locator('.ds-list-item--link', { hasText: name }).click();
  await shot(admin, '27-support-thread', { event: A, fullPage: false, tab: 'Управление', before: openThread('Олег') });
  await shot(admin, '27-support-thread-free', { event: A, fullPage: false, tab: 'Управление', before: openThread('Аня') });
  await shot(admin, '18-audit', { event: A, fullPage: false, tab: 'Управление', before: (p) => p.locator('.ds-btn', { hasText: 'Журнал действий' }).click() });
  await shot(admin, '11-participant-menu', { event: A, fullPage: false, tab: 'Управление', before: (p) => p.locator('.ds-icon-btn[title="Действия с участником"]').nth(2).click() });
  await shot(admin, '12-danger-zone', { event: A, fullPage: false, tab: 'Управление', before: async (p) => {
    await p.locator('.ds-btn--danger', { hasText: 'Удалить событие' }).click();
    await p.locator('.ds-sheet .ds-input').fill('УДАЛИТЬ');
  } });
  // 012: принудительная отмена жеребьёвки владельцем (подопечных уже открыли)
  await shot(admin, '28-force-cancel', { event: A, fullPage: false, tab: 'Управление', before: async (p) => {
    await p.locator('.ds-btn--danger', { hasText: 'Отменить жеребьёвку' }).click();
    await p.locator('.ds-sheet .ds-input').fill('ОТМЕНА');
  } });
  // 010: служебный просмотр владельца — вход словом, участник, все пары; журнал с открытиями
  const vaultIn = async (p) => {
    await p.locator('.ds-btn', { hasText: 'Открыть служебный просмотр' }).click();
    await p.locator('.ds-sheet .ds-input').fill('ОТКРЫТЬ');
  };
  await shot(admin, '19-vault-gate', { event: A, fullPage: false, tab: 'Управление', before: vaultIn });
  await shot(admin, '20-vault-person', { event: A, fullPage: false, tab: 'Управление', before: async (p) => {
    await vaultIn(p);
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Войти' }).click();
    await p.locator('.ds-sheet select').selectOption(String(ward.id === admin.id ? people[0].id : ward.id));
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Открыть участника' }).click();
    await p.waitForSelector('.ds-sheet .ds-info-grid');
  } });
  await shot(admin, '21-vault-pairs', { event: A, fullPage: false, tab: 'Управление', before: async (p) => {
    p.once('dialog', (d) => d.accept());
    await vaultIn(p);
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Войти' }).click();
    await p.locator('.ds-sheet .ds-btn', { hasText: 'Показать все пары' }).click();
    await p.waitForSelector('.ds-sheet .ds-section-title');
  } });
  await shot(admin, '23-audit-vault', { event: A, fullPage: false, tab: 'Управление', before: (p) => p.locator('.ds-btn', { hasText: 'Журнал действий' }).click() });
  // 010: запрет возврата и список «Удалённые» в эвенте B
  await w.api(admin, 'admin.game', { event: B, rejoin: false });
  await w.api(admin, 'admin.remove', { event: B, id: people[1].id });
  await shot(admin, '22-removed-list', { event: B, tab: 'Управление' });
  await checkDateFields(admin, B);
  // 027: свой календарь автожеребьёвки — дата не задана: текущий месяц, ничего не выделено, «Готово» недоступна
  const openAutoDraw = (p) => p.locator('.ds-field', { hasText: 'Автожеребьёвка' }).locator('button').click();
  await shot(admin, '29-auto-draw-calendar', { event: B, fullPage: false, tab: 'Управление', before: openAutoDraw });
  await shot(admin, '29-auto-draw-calendar', { event: B, fullPage: false, tab: 'Управление', dark: true, before: openAutoDraw });
  await checkTweaks();
  await checkSheetHandle();
  await shot(people[0], '02-my-letter', { event: A, dark: true });
  await shot(people[2], '05-ward-hidden', { event: A, tab: 'Подопечный', dark: true });
  await shot(admin, '07-admin-after-draw', { event: A, tab: 'Управление', dark: true });

  // Завершённый эвент (005): письмо только для чтения, переписка ещё неделю
  await w.api(admin, 'admin.reveal', { event: A });
  await w.api(admin, 'admin.event.finish', { event: A });
  await shot(people[0], '14-finished-letter', { event: A });
  await shot(admin, '15-finished-ward', { event: A, tab: 'Подопечный' });
  await shot(people[1], '16-home-participant', { dark: true });
  await checkSheetScroll(admin, A);
  await checkUiFixes();
  await checkRegistration();
  await checkSelfService();
  await checkInfoPeople();
  await checkLooks();
  await checkNames();
  await checkKeyboard();
  await checkNoMasksFamilies();
  await checkSwap();
  await checkOrganizers();
  await checkSettings();
  await checkHome();
  await checkCsp();
  await checkOpenBot();
  await checkDonate();
  if (cspSeen.length) colorProblems.push(...cspSeen.map((x) => 'CSP: ' + x));
  else console.log(`✔ CSP (032): ни одного нарушения политики на ${pagesOpened} страницах прогона`);
  console.log('Скриншоты сохранены в test-results/');
  if (colorProblems.length) {
    console.error('✘ Проверки не прошли:\n' + colorProblems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('✔ цвета вкладок и кнопок соответствуют дизайн-системе');
  }
} finally {
  await browser?.close();
  await w.stop();
}

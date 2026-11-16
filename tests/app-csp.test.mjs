// Политика безопасности страницы мини-приложения (032): заголовок /app по контракту, отпечаток встроенного скрипта,
// правила страницы и кода приложения (то, что политика заблокирует в браузере) — с «от противного».
// Контракт — specs/032-app-csp/contracts/app-csp.md; поведение в браузере — checkCsp в tests/screenshots.mjs.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP, where, code } from './support/app-source.mjs';
import { TELEGRAM_SCRIPT, inlineScripts, appPolicy } from '../src/csp.js';

after(restoreFetch);

// Отпечаток так, как его считает браузер: текст после разбора HTML (CRLF и CR — LF), UTF-8, SHA-256, base64
const sha = (s) => createHash('sha256').update(s.replace(/\r\n?/g, '\n'), 'utf8').digest('base64');
const bare = (page) => [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const POLICY = (...hashes) => [
  "default-src 'self'",
  `script-src ${hashes.map((x) => `'sha256-${x}'`).join(' ')} https://telegram.org/js/telegram-web-app.js`,
  "style-src 'unsafe-inline'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  'frame-ancestors https://*.telegram.org',
].join('; ');

describe('заголовок /app', () => {
  test('политика по контракту, отпечаток — единственного встроенного скрипта отданной страницы', async () => {
    const w = await startWorld();
    const page = await w.page();
    assert.equal(page.status, 200);
    const scripts = bare(page.text);
    assert.equal(scripts.length, 1, 'встроенный скрипт один');
    assert.equal(page.headers.get('content-security-policy'), POLICY(sha(scripts[0])));
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const again = await w.page();
    assert.equal(again.headers.get('content-security-policy'), page.headers.get('content-security-policy'), 'второй запрос — то же');
    assert.equal(again.text, page.text);
  });

  test('/setup — прежняя политика, у остальных адресов политики нет', async () => {
    const w = await startWorld();
    assert.equal((await w.request('/setup')).headers.get('content-security-policy'), "frame-ancestors 'none'");
    assert.equal((await w.request('/')).headers.get('content-security-policy'), null);
    assert.equal((await w.request('/api/me', { method: 'POST', body: '{}' })).headers.get('content-security-policy'), null);
  });
});

describe('отпечаток', () => {
  const page = (...scripts) => `<!doctype html><head><script src="${TELEGRAM_SCRIPT}"></script></head><body>` +
    scripts.map((s) => `<script>${s}</script>`).join('') + '</body>';

  test('встроенные скрипты: по порядку, без внешних, переводы строк — LF', () => {
    assert.deepEqual(inlineScripts(page('a\r\nb', 'c\rd', 'e\nf')), ['a\nb', 'c\nd', 'e\nf']);
    assert.deepEqual(inlineScripts(`<script src="x.js"></script><script type="module">m</script>`), []);
  });

  test('CRLF, CR и LF — один отпечаток; изменённый скрипт — другой; два скрипта — два отпечатка', async () => {
    const lf = await appPolicy(page('const a = 1;\nconst b = «я»;\n'));
    assert.equal(lf, POLICY(sha('const a = 1;\nconst b = «я»;\n')));
    assert.equal(await appPolicy(page('const a = 1;\r\nconst b = «я»;\r\n')), lf);
    assert.equal(await appPolicy(page('const a = 1;\rconst b = «я»;\r')), lf);
    assert.notEqual(await appPolicy(page('const a = 2;\nconst b = «я»;\n')), lf);
    assert.equal(await appPolicy(page('x()', 'y()')), POLICY(sha('x()'), sha('y()')));
  });
});

// Правило 1 контракта: каждый <script…> — встроенный без атрибутов (ровно один) или файл Telegram по точному адресу
function pageProblems(page) {
  const out = [];
  const tags = [...page.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  const inline = tags.filter((t) => t === '<script>').length;
  if (inline !== 1) out.push(`встроенных скриптов ${inline}, нужен ровно один`);
  for (const t of tags) {
    if (t !== '<script>' && t !== `<script src="${TELEGRAM_SCRIPT}">`) out.push(`скрипт не разрешён политикой: ${t}`);
  }
  return out;
}

describe('правила страницы', () => {
  test('страница /app — по правилу', async () => {
    const w = await startWorld();
    assert.deepEqual(pageProblems((await w.page()).text), []);
    assert.deepEqual(pageProblems(APP), []);
  });

  test('от противного: второй встроенный, модуль, чужой адрес, лишний атрибут, без встроенного', () => {
    const tg = `<script src="${TELEGRAM_SCRIPT}"></script>`;
    const one = `${tg}<script>a()</script>`;
    assert.deepEqual(pageProblems(one), []);
    assert.deepEqual(pageProblems(one + '<script>b()</script>'), ['встроенных скриптов 2, нужен ровно один']);
    assert.deepEqual(pageProblems(one + '<script type="module">b()</script>'), ['скрипт не разрешён политикой: <script type="module">']);
    assert.deepEqual(pageProblems(one + '<script src="https://cdn.example/x.js"></script>'), ['скрипт не разрешён политикой: <script src="https://cdn.example/x.js">']);
    assert.deepEqual(pageProblems(`<script src="${TELEGRAM_SCRIPT}" defer></script><script>a()</script>`), [`скрипт не разрешён политикой: <script src="${TELEGRAM_SCRIPT}" defer>`]);
    assert.deepEqual(pageProblems(tg), ['встроенных скриптов 0, нужен ровно один']);
  });
});

// Правило 2 контракта: в коде приложения нет того, что политика заблокирует (без 'unsafe-eval' и 'unsafe-inline' у
// скриптов): выполнение строки как кода, адреса javascript:, обработчики событий атрибутом. Место — часть и строка.
const CODE_RULES = [
  [/\beval\s*\(/, 'eval — выполнение строки как кода'],
  [/\bnew\s+Function\b/, 'new Function — выполнение строки как кода'],
  [/\bset(?:Timeout|Interval)\s*\(\s*['"`]/, 'строка в таймере — выполнение строки как кода'],
  [/javascript:/i, 'адрес javascript:'],
  [/\.setAttribute\(\s*['"`]on/i, 'обработчик события атрибутом (setAttribute)'],
  [/<[a-z][^>]*\son[a-z]+\s*=/i, 'обработчик события в разметке (on…=)'],
];

function codeProblems(text, place = (n) => `строка ${n}`) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    const c = code(line);
    for (const [re, what] of CODE_RULES) if (re.test(c)) out.push(`${place(i + 1)}: ${what}`);
  });
  return out;
}

describe('код приложения', () => {
  test('в склейке нет того, что заблокирует политика', () => {
    assert.deepEqual(codeProblems(APP, where), []);
  });

  test('от противного: каждое правило находит своё место', () => {
    const bad = [
      'const x = eval(text);',
      'const f = new Function("a", body);',
      "setTimeout('tick()', 100);",
      'setInterval(`poll()`, 1000);',
      "h('a', { href: 'javascript:void(0)' });",
      "el.setAttribute('onclick', handler);",
      '<button onclick="go()">Ок</button>',
      '<img src="x.png" onerror=alert(1)>',
    ];
    assert.deepEqual(codeProblems(bad.join('\n')), [
      'строка 1: eval — выполнение строки как кода',
      'строка 2: new Function — выполнение строки как кода',
      'строка 3: строка в таймере — выполнение строки как кода',
      'строка 4: строка в таймере — выполнение строки как кода',
      'строка 5: адрес javascript:',
      'строка 6: обработчик события атрибутом (setAttribute)',
      'строка 7: обработчик события в разметке (on…=)',
      'строка 8: обработчик события в разметке (on…=)',
    ]);
    const good = [
      "btn.addEventListener('click', go);",
      'setTimeout(() => el.blur(), 0);',
      "h('button', { class: 'ds-btn', onclick: go }, 'Ок');",
      "el.setAttribute('aria-label', title);",
      '// eval( в комментарии не считается',
      "const url = 'https://t.me/share/url?url=' + link;",
      '<button class="ds-hero__back" id="heroBack" hidden>‹</button>',
    ];
    assert.deepEqual(codeProblems(good.join('\n')), []);
    // Место — часть и строка склейки
    const lines = APP.split('\n');
    const n = lines.findIndex((l) => l.includes('async function start()')) + 1;
    lines.splice(n, 0, '    eval(initData);');
    assert.deepEqual(codeProblems(lines.join('\n'), where), [`${where(n + 1)}: eval — выполнение строки как кода`]);
    assert.match(where(n + 1), /^src\/app\/08-start\.html:\d+$/);
  });
});

// Части мини-приложения (021): каждый файл src/app/ — в сборке ровно один раз и по порядку, формат частей, разбор
// скрипта, один встроенный <script> и start() последним. Проверки — чистые функции; у каждой есть проверка «от
// противного» на искусственных данных. Правила — specs/021-app-parts/contracts/app-parts.md.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Script } from 'node:vm';
import { APP, PARTS } from './support/app-source.mjs';

const DIR = new URL('../src/app/', import.meta.url);
const NAME = /^(\d\d)-[a-z0-9-]+\.(html|js\.txt)$/; // не .js: wrangler собрал бы такой файл как модуль, а не как текст
const TAIL = '  start();\n})();\n</script>\n</body>\n</html>\n';

// Только компиляция, без исполнения (DOM не нужен)
function parses(code) {
  try {
    new Script(code);
    return true;
  } catch {
    return false;
  }
}

// names — части в порядке сборки (src/app-page.js), files — файлы папки src/app/
function listProblems(names, files) {
  const out = [];
  names.forEach((n, i) => {
    const m = NAME.exec(n);
    if (!m) out.push(`${n}: имя не по правилу «NN-слово.html» или «NN-слово.js.txt»`);
    else if (Number(m[1]) !== i + 1) out.push(`${n}: номер ${m[1]} на ${i + 1}-м месте сборки (номера подряд с 01)`);
  });
  for (const n of new Set(names)) if (names.indexOf(n) !== names.lastIndexOf(n)) out.push(`${n}: в сборке дважды`);
  for (const f of files) if (!names.includes(f)) out.push(`${f}: файл есть в src/app/, но не в сборке (src/app-page.js)`);
  for (const n of names) if (!files.includes(n)) out.push(`${n}: в сборке, но файла в src/app/ нет`);
  return out;
}

// Формат части; часть скрипта — целые объявления верхнего уровня обёртки (разбирается как тело функции, строгий режим)
function partProblems(name, text) {
  const out = [];
  if (text.includes('\r')) out.push(`${name}: есть CR — нужен только LF`);
  if (text.startsWith('﻿')) out.push(`${name}: BOM в начале`);
  if (!text.trim()) out.push(`${name}: пустая`);
  else if (!text.endsWith('\n') || /(^|\n)[ \t]*\n$/.test(text)) {
    out.push(`${name}: должна кончаться непустой строкой и ровно одним переводом строки (пустая строка шва — в начале следующей части)`);
  }
  if (name.endsWith('.js.txt') && !parses("(function () { 'use strict';\n" + text + '\n})')) {
    out.push(`${name}: не разбирается как целые объявления верхнего уровня (функция или блок перешли через шов?)`);
  }
  return out;
}

// Склейка: один внешний скрипт (SDK Telegram) и один встроенный, один 'use strict', start() — последний оператор обёртки
function pageProblems(page) {
  const out = [];
  if (!page.startsWith('<!doctype html>\n')) out.push('страница должна начинаться с <!doctype html>');
  if (!page.endsWith(TAIL)) out.push('после start(); в обёртке не должно быть операторов; конец страницы — ' + JSON.stringify(TAIL));
  const external = (page.match(/<script src=[^>]*><\/script>/g) || []).length;
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const all = (page.match(/<script\b/g) || []).length;
  if (external !== 1) out.push(`внешних <script src=…>: ${external}, нужен один (SDK Telegram)`);
  if (inline.length !== 1 || all !== 2) out.push(`встроенных <script>: ${inline.length} (всего тегов ${all}), нужен один`);
  const strict = (page.match(/'use strict'/g) || []).length;
  if (strict !== 1) out.push(`'use strict': ${strict}, нужен один — в начале обёртки`);
  if (inline.length && !parses(inline[0][1])) out.push('встроенный скрипт не разбирается');
  return out;
}

describe('части мини-приложения: проверки находят ошибки (от противного)', () => {
  it('список: лишний и пропущенный файл, порядок, повтор, имя .js', () => {
    const files = ['01-a.html', '02-b.js.txt', '03-c.html'];
    assert.deepEqual(listProblems(files, files), []);
    assert.equal(listProblems(['01-a.html', '02-b.js.txt'], files).length, 1, 'файл не в сборке');
    assert.equal(listProblems([...files, '04-d.js.txt'], files).length, 1, 'в сборке, но файла нет');
    assert.ok(listProblems(['02-b.js.txt', '01-a.html', '03-c.html'], files).length > 0, 'не по порядку');
    assert.ok(listProblems(['01-a.html', '01-a.html', '02-b.js.txt', '03-c.html'], files).length > 0, 'дважды');
    assert.ok(listProblems(['01-a.html', '02-b.js', '03-c.html'], ['01-a.html', '02-b.js', '03-c.html']).length > 0, '.js');
  });

  it('формат части: CR, BOM, пустая, лишний перевод строки в конце, нет перевода, шов внутри функции', () => {
    const ok = "\n  // ---------- раздел ----------\n  function f() {\n    return `${1}`;\n  }\n";
    assert.deepEqual(partProblems('03-x.js.txt', ok), []);
    assert.deepEqual(partProblems('01-x.html', '<!doctype html>\n<script>\n(() => {\n'), [], 'html-часть не разбирается');
    for (const [what, text] of [
      ['CR', ok.replace(/\n/g, '\r\n')],
      ['BOM', '﻿' + ok],
      ['пустая', ''],
      ['пустая строка в конце', ok + '\n'],
      ['строка из пробелов в конце', ok + '  \n'],
      ['без перевода строки', ok.slice(0, -1)],
      ['функция через шов', '  function f() {\n    return 1;\n'],
      ['незакрытый шаблон', '  const s = `abc;\n'],
      ['строгий режим', '  with (a) { b(); }\n'],
    ]) assert.ok(partProblems('03-x.js.txt', text).length > 0, what);
  });

  it('склейка: второй скрипт, оператор после start(), лишний use strict, ошибка разбора', () => {
    const head = '<!doctype html>\n<script src="https://x/sdk.js"></script>\n<script>\n(() => {\n  \'use strict\';\n  function start() {}\n';
    assert.deepEqual(pageProblems(head + TAIL), []);
    for (const [what, page] of [
      ['второй встроенный скрипт', head.replace('<script>', '<script>1;</script>\n<script>') + TAIL],
      ['оператор после start()', head + '  start();\n  more();\n})();\n</script>\n</body>\n</html>\n'],
      ["второй 'use strict'", head + "  'use strict';\n" + TAIL],
      ['ошибка разбора', head + '  if (x) {\n' + TAIL],
      ['нет SDK', head.replace(/<script src[^\n]*\n/, '') + TAIL],
    ]) assert.ok(pageProblems(page).length > 0, what);
  });
});

describe('части мини-приложения: настоящие', () => {
  it('каждый файл src/app/ — в сборке ровно один раз, по порядку', () => {
    const files = readdirSync(DIR).filter((f) => !f.startsWith('.')).sort();
    assert.deepEqual(listProblems(PARTS.map((p) => p.name), files), []);
  });

  it('формат частей и разбор частей скрипта; текст в сборке = файл на диске', () => {
    for (const p of PARTS) {
      assert.deepEqual(partProblems(p.name, p.text), []);
      assert.equal(p.text, readFileSync(new URL(p.name, DIR), 'utf8'), `${p.name}: текст в сборке отличается от файла`);
    }
  });

  it('склейка: один встроенный скрипт, разбирается, start() последним', () => {
    assert.equal(APP, PARTS.map((p) => p.text).join(''));
    assert.deepEqual(pageProblems(APP), []);
  });
});

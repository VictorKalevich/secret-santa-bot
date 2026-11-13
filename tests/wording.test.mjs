// 013: в текстах для людей — «событие», а не «эвент» (бот, API, мини-приложение, /setup); кнопки без «＋».
// Комментарии в коде не проверяются: там «эвент» — внутренний термин разработки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const blank = (m) => m.replace(/[^\n]/g, ' '); // номера строк сохраняются
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/<!--[\s\S]*?-->/g, blank)
  .split('\n')
  .map((line) => line.replace(/(^|[\s;,{}()])\/\/.*$/, '$1')) // «//» после пробела или скобки — комментарий; «https://» — нет
  .join('\n');

const files = [
  ...readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f),
  'src/app.html',
];

test('в текстах для людей нет слова «эвент»', () => {
  const found = [];
  for (const f of files) {
    stripComments(read(f)).split('\n').forEach((line, i) => {
      if (/[Ээ]вент/.test(line)) found.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
  }
  assert.deepEqual(found, [], 'замени «эвент» на «событие» (правила — specs/013-event-wording/research.md, R1)');
});

test('кнопки приложения не начинаются с «＋»', () => {
  const app = stripComments(read('src/app.html'));
  const lines = app.split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => /＋|ui\.btn\(\s*['"`]\+/.test(line));
  assert.deepEqual(lines.map(([n, l]) => `src/app.html:${n}: ${l.trim()}`), []);
});

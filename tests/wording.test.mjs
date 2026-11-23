// 013: в текстах для людей — «событие», а не «эвент» (бот, API, мини-приложение, /setup); кнопки без «＋».
// Комментарии в коде не проверяются: там «эвент» — внутренний термин разработки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { APP, where } from './support/app-source.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const blank = (m) => m.replace(/[^\n]/g, ' '); // номера строк сохраняются
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/<!--[\s\S]*?-->/g, blank)
  .split('\n')
  .map((line) => line.replace(/(^|[\s;,{}()])\/\/.*$/, '$1')) // «//» после пробела или скобки — комментарий; «https://» — нет
  .join('\n');

// [текст, номер строки → место]: модули src/*.js и мини-приложение — склейка частей src/app/ (021), место — часть и строка
const sources = [
  ...readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js'))
    .map((f) => [read('src/' + f), (n) => `src/${f}:${n}`]),
  [APP, where],
];

test('в текстах для людей используются «событие», «владелец» и «администратор»', () => {
  const obsoleteRole = /(?<!\p{L})(?:организатор\p{L}*|админ(?:а|у|ом|е|ы|ов|ам|ами|ах)?)(?!\p{L})/iu;
  const found = [];
  for (const [text, at] of sources) {
    stripComments(text).split('\n').forEach((line, i) => {
      if (/[Ээ]вент/.test(line) || obsoleteRole.test(line)) found.push(`${at(i + 1)}: ${line.trim().slice(0, 140)}`);
    });
  }
  assert.deepEqual(found, [], 'используй названия из спецификаций 013 и 044');
});

test('кнопки приложения не начинаются с «＋»', () => {
  const app = stripComments(APP);
  const lines = app.split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => /＋|ui\.btn\(\s*['"`]\+/.test(line));
  assert.deepEqual(lines.map(([n, l]) => `${where(n)}: ${l.trim()}`), []);
});

// 051 (контракт specs/051-companies/contracts/companies.md, раздел 6): кто может действие владельца в событии или компании,
// говорит помощник ownerWord — «владелец» в компании с назначенным владельцем, «владелец бота» в остальных. Литерал
// «владел… бота» — только там, где речь всегда о владельце бота: [место (начало), часть строки]
const BOT_OWNER_ALWAYS = [
  ['src/bot.js', 'Ты владелец бота — события и администраторы'], // меню владельца бота
  ['src/bot.js', 'Ты — владелец бота «Тайный Санта»'], // ссылка владельца бота (/setup)
  ['src/bot.js', 'Теперь ты владелец бота'],
  ['src/bot.js', 'Ты владелец бота — эту компанию и так ведёшь ты'], // ссылка владельца компании у владельца бота
  ['src/companies.js', 'Компанию снова ведёт владелец бота'],
  ['src/companies.js', "'→ владелец бота'"],
  ['src/companies.js', 'Владелец бота удалил компанию'],
  ['src/roles.js', 'Права владельца бота перешли'], // смена владельца бота
  ['src/roles.js', 'Тебе переданы права владельца бота'],
  ['src/roles.js', 'теперь владелец бота'],
  ['src/setup.js', '<b>владельцем бота</b>'],
  ['src/app/03-home.js.txt', 'Ты здесь как владелец бота'], // плашка гостя
  ['src/app/03-home.js.txt', 'Ты останешься владельцем бота'], // 👑 владельца бота
  ['src/app/04-companies.js.txt', ''], // экран «Компании» и шторки владельца бота
  ['src/app/06-admin.js.txt', 'владелец бота должен один раз открыть /setup'],
  ['src/app/06-admin.js.txt', 'переносить участие — владелец бота'], // admin.transfer
  ['src/app/06-admin.js.txt', 'Переносить участие на новый аккаунт может только владелец бота'],
];

function botOwnerProblems(list, allowed = BOT_OWNER_ALWAYS) {
  const found = [];
  const used = new Set();
  for (const [text, at] of list) {
    stripComments(text).split('\n').forEach((line, i) => {
      if (!/владел\p{L}*\s+бота/iu.test(line)) return;
      const place = at(i + 1);
      const k = allowed.findIndex(([file, part]) => place.startsWith(file + ':') && line.includes(part));
      if (k < 0) found.push(`${place}: ${line.trim().slice(0, 140)}`);
      else used.add(k);
    });
  }
  allowed.forEach(([file, part], k) => { if (!used.has(k)) found.push(`разрешённое место не найдено: ${file} «${part}»`); });
  return found;
}

test('«владелец бота» — через ownerWord, литерал — только где речь всегда о владельце бота (051)', () => {
  assert.deepEqual(botOwnerProblems(sources), []);
  // от противного: прежний текст в событии, текст в чужой части, устаревший список разрешённых мест
  const old = [["      return 'Попроси владельца бота вписать тебя.';", (n) => `src/membership.js:${n}`]];
  assert.equal(botOwnerProblems([...sources, ...old]).length, 1);
  const hint = [["    ui.hint('Вписать в жеребьёвку может владелец бота')", (n) => `src/app/06-admin.js.txt:${n}`]];
  assert.equal(botOwnerProblems([...sources, ...hint]).length, 1);
  assert.deepEqual(botOwnerProblems(sources, [...BOT_OWNER_ALWAYS, ['src/vault.js', 'владелец бота']]),
    ['разрешённое место не найдено: src/vault.js «владелец бота»']);
});

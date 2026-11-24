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

// [текст, номер строки → место]: модули src/*.js, мини-приложение — склейка частей src/app/ (021), место — часть и строка,
// и словари (060: тексты для людей — src/i18n/<язык>/*.js)
const DICTS = readdirSync(new URL('../src/i18n/', import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(new URL(`../src/i18n/${d.name}/`, import.meta.url)).filter((f) => f.endsWith('.js'))
    .map((f) => `src/i18n/${d.name}/${f}`));
const sources = [
  ...readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js'))
    .map((f) => [read('src/' + f), (n) => `src/${f}:${n}`]),
  [APP, where],
  ...DICTS.map((f) => [read(f), (n) => `${f}:${n}`]),
];
// Файл словаря области (060): модуль src/<имя>.js → src/i18n/<язык>/<имя>.js, часть приложения → app-<область>.js
const APP_AREA = { '01-shell.html': 'app-boot', '02-core.js.txt': 'app-core', '03-home.js.txt': 'app-home',
  '04-companies.js.txt': 'app-companies', '05-event.js.txt': 'app-event', '06-admin.js.txt': 'app-admin',
  '07-vault-audit.js.txt': 'app-vault', '08-sheet-chat.js.txt': 'app-sheet', '09-start.html': 'app-boot' };
const areaOf = (file) => {
  const app = /^src\/app\/(.+)$/.exec(file);
  if (app) return APP_AREA[app[1]];
  const mod = /^src\/([\w-]+)\.js$/.exec(file);
  return mod ? (mod[1] === 'format' ? 'common' : mod[1] === 'index' ? 'routes' : mod[1]) : null;
};
// Место в файле или в словаре его области (любого языка)
const inFile = (place, file) => place.startsWith(file + ':') ||
  (!!areaOf(file) && new RegExp(`^src/i18n/[\\w-]+/${areaOf(file)}\\.js:`).test(place));

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

// 059: в текстах для людей — «комната»; «компания» — внутренний термин кода и комментариев. Сообщения исключений
// (`new Error(…)`) людям не показываются — не в счёт
function companyWords(list) {
  const found = [];
  for (const [text, at] of list) {
    stripComments(text).split('\n').forEach((line, i) => {
      if (/компани/iu.test(line) && !/\bnew Error\(/.test(line)) found.push(`${at(i + 1)}: ${line.trim().slice(0, 140)}`);
    });
  }
  return found;
}

test('в текстах для людей — «комната», а не «компания» (059)', () => {
  assert.deepEqual(companyWords(sources), [], 'используй слово из спецификации 059 (contracts/texts.md)');
  // от противного: текст приложения и отказ модуля — нарушения с местом; исключение и комментарий — нет
  const bad = [
    ["    ui.hint('Название компании');", (n) => `src/app/04-companies.js.txt:${n}`],
    ["  if (!c) return no('Компания не найдена.', 404); // 059", (n) => `src/companies.js:${n}`],
    ["  throw new Error('контекст без компании');\n  // компании по номеру", (n) => `src/context.js:${n}`],
  ];
  assert.deepEqual(companyWords(bad).map((s) => s.split(': ')[0]), ['src/app/04-companies.js.txt:1', 'src/companies.js:1']);
});

test('кнопки приложения не начинаются с «＋»', () => {
  const app = stripComments(APP);
  const lines = app.split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => /＋|ui\.btn\(\s*['"`]\+/.test(line));
  assert.deepEqual(lines.map(([n, l]) => `${where(n)}: ${l.trim()}`), []);
  // 060: подписи кнопок — в словарях: нигде «＋», текст не начинается с «+»
  const dict = [];
  for (const f of DICTS) {
    stripComments(read(f)).split('\n').forEach((line, i) => {
      if (/＋|:\s*['"`]\+/.test(line)) dict.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(dict, []);
});

// 051 (контракт specs/051-companies/contracts/companies.md, раздел 6): кто может действие владельца в событии или компании,
// говорит помощник ownerWord — «владелец» в компании с назначенным владельцем, «владелец бота» в остальных. Литерал
// «владел… бота» — только там, где речь всегда о владельце бота: [место (начало), часть строки]
const BOT_OWNER_ALWAYS = [
  ['src/bot.js', 'Ты владелец бота — события и администраторы'], // меню владельца бота
  ['src/bot.js', 'Ты — владелец бота «Тайный Санта»'], // ссылка владельца бота (/setup)
  ['src/bot.js', 'Теперь ты владелец бота'],
  ['src/bot.js', 'Ты владелец бота — эту комнату и так ведёшь ты'], // ссылка владельца компании у владельца бота
  ['src/companies.js', 'Комнату снова ведёт владелец бота'],
  ['src/companies.js', "'→ владелец бота'"],
  ['src/companies.js', 'Владелец бота удалил комнату'],
  ['src/roles.js', 'Права владельца бота перешли'], // смена владельца бота
  ['src/roles.js', 'Тебе переданы права владельца бота'],
  ['src/roles.js', 'теперь владелец бота'],
  ['src/setup.js', '<b>владельцем бота</b>'],
  ['src/app/03-home.js.txt', 'Ты здесь как владелец бота'], // плашка гостя
  ['src/app/03-home.js.txt', 'Ты останешься владельцем бота'], // 👑 владельца бота
  ['src/app/04-companies.js.txt', ''], // экран «Комнаты» и шторки владельца бота
  ['src/app/06-admin.js.txt', 'владелец бота должен один раз открыть /setup'],
  ['src/app/06-admin.js.txt', 'переносить участие — владелец бота'], // admin.transfer
  ['src/app/06-admin.js.txt', 'Переносить участие на новый аккаунт может только владелец бота'],
  // 060: формы ownerWord и отказы только владельцу бота — в словарях (прежде собирались кодом)
  ['src/format.js', "'common.botOwner."],
  ['src/app/02-core.js.txt', "'app.core.botOwner."],
  ['src/api.js', "'api.botOwner."],
  ['src/api.js', "'api.botOnly'"],
];

function botOwnerProblems(list, allowed = BOT_OWNER_ALWAYS) {
  const found = [];
  const used = new Set();
  for (const [text, at] of list) {
    stripComments(text).split('\n').forEach((line, i) => {
      if (!/владел\p{L}*\s+бота/iu.test(line)) return;
      const place = at(i + 1);
      const k = allowed.findIndex(([file, part]) => inFile(place, file) && line.includes(part));
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

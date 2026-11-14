// Мини-приложение по частям (021): части src/app/ склеиваются по порядку без разделителей — страница побайтно та же,
// что прежний src/app.html. Порядок частей задан только здесь (его же берут тесты). Скрипт — один <script> с общей
// областью видимости: части — куски одной функции-обёртки, не модули. Части скрипта — .js.txt: файл .js wrangler
// собрал бы как модуль, а .html и .txt подключаются как текст. Правила частей — specs/021-app-parts/contracts/app-parts.md.

import SHELL from './app/01-shell.html';
import CORE from './app/02-core.js.txt';
import HOME from './app/03-home.js.txt';
import EVENT from './app/04-event.js.txt';
import ADMIN from './app/05-admin.js.txt';
import VAULT_AUDIT from './app/06-vault-audit.js.txt';
import SHEET_CHAT from './app/07-sheet-chat.js.txt';
import START from './app/08-start.html';

// [имя файла в src/app/, текст] — в порядке сборки
export const APP_PARTS = [
  ['01-shell.html', SHELL],
  ['02-core.js.txt', CORE],
  ['03-home.js.txt', HOME],
  ['04-event.js.txt', EVENT],
  ['05-admin.js.txt', ADMIN],
  ['06-vault-audit.js.txt', VAULT_AUDIT],
  ['07-sheet-chat.js.txt', SHEET_CHAT],
  ['08-start.html', START],
];

export default APP_PARTS.map(([, text]) => text).join('');

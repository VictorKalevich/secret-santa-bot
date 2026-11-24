// Проверка файлов во время переноса текстов в словарь (060): кириллица вне словаря и ключи, которых нет в словаре.
//   node tests/support/i18n-check.mjs src/pairs.js src/app/06-admin.js.txt
// Без аргументов — все файлы кода, ещё и неиспользуемые ключи словаря.
import { codeFiles, cyrillicLines, missingKeys, unusedKeys, prefixProblems } from './i18n-rules.mjs';

const files = process.argv.slice(2);
const all = !files.length;
const list = all ? codeFiles() : files;
const problems = [
  ...list.flatMap((f) => cyrillicLines(f)),
  ...missingKeys(list),
  ...prefixProblems(),
  ...(all ? unusedKeys() : []),
];
for (const p of problems) console.log(p);
console.log(problems.length ? `нарушений: ${problems.length}` : 'нарушений нет');
process.exitCode = problems.length ? 1 : 0;

// Проверка словаря одного языка во время перевода (061): node tests/support/i18n-lang-check.mjs en [es …]
// Правила — tests/support/i18n-lang-rules.mjs (контракт specs/061-i18n-languages/contracts/translation.md).
import { AREAS } from '../../src/i18n/ru/index.js';
import { languageProblems, loadLanguage } from './i18n-lang-rules.mjs';

let total = 0;
for (const lang of process.argv.slice(2)) {
  const { areas, error } = await loadLanguage(lang);
  const problems = error ? [error] : languageProblems(lang, AREAS, areas);
  for (const p of problems) console.log(p);
  console.log(`${lang}: ${problems.length ? `нарушений: ${problems.length}` : 'нарушений нет'}`);
  total += problems.length;
}
process.exitCode = total ? 1 : 0;

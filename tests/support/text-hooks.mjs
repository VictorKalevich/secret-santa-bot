// В Worker файлы .html и .css подключаются как текст правилом Text из wrangler.toml, .txt — правилом Text wrangler по
// умолчанию. В Node то же делает этот перехватчик загрузки (module.registerHooks — Node 22.15+ / 23.5+), без
// зависимостей (016). .txt — части скрипта мини-приложения src/app/*.js.txt (021): с расширением .js wrangler собрал бы
// их как модули, а не как текст.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  load(url, context, nextLoad) {
    if (/\.(html|css|txt)$/.test(url)) {
      const text = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(text) + ';' };
    }
    return nextLoad(url, context);
  },
});

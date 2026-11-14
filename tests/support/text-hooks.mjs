// В Worker файлы .html и .css подключаются как текст правилом Text из wrangler.toml. В Node то же делает этот
// перехватчик загрузки (module.registerHooks — Node 22.15+ / 23.5+), без зависимостей (016).
// Расширение .txt добавлено заранее: части app.html (шаг 6 плана рефакторинга) wrangler подключает как текст только
// с не-JS расширением.
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

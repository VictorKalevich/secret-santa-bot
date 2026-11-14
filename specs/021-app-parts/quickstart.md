# Quickstart: проверка фичи 021

Требования: Node 22.15+, `npm install` выполнен, Google Chrome (для скриншотов). Команды — из корня проекта; вспомогательные
скрипты ниже сохраняются во временную папку (вне проекта) и запускаются с путём к проекту.

`BEFORE` — последний коммит, где `src/app.html` ещё целый: `35bc60d` (`main` до фичи).

## 1. Быстрые тесты

```powershell
npm test
```

Ожидается: 0 упавших; новый файл `tests/app-parts.test.mjs` (список частей, формат, разбор, один скрипт, `start()`
последним — и «от противного» на искусственных данных); прежние 164 теста зелёные.

## 2. Склейка = файл до разреза

```powershell
node --import ./tests/support/text-hooks.mjs --input-type=module -e "const { createHash } = await import('node:crypto'); const { execFileSync } = await import('node:child_process'); const page = Buffer.from((await import('./src/app-page.js')).default); const before = execFileSync('git', ['show', '35bc60d:src/app.html']); const sha = (b) => createHash('sha256').update(b).digest('hex'); console.log(sha(page), page.length, page.equals(before) ? 'РАВНЫ' : 'РАЗНЫЕ')"
```

Ожидается: `440b0db84c32e7dab6a4407854796ed2685aa5e83b43d6f614975b716b5f32ff 127062 РАВНЫ`.

## 3. Страница настоящего Worker

`npm run dev` без `.dev.vars` отвечает 500 (нет `BOT_TOKEN`), поэтому страница снимается через харнесс e2e: `wrangler
dev` с секретами и миграциями во временной папке. Скрипт `capture-app.mjs`:

```js
// node capture-app.mjs <папка проекта> <файл>: снять GET /app с wrangler dev и записать как есть
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [repo, out] = process.argv.slice(2);
const { startWorld } = await import(pathToFileURL(repo + '/tests/harness.mjs').href);
const w = await startWorld();
try {
  const r = await fetch(w.base + '/app');
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(out, buf);
  console.log(r.status, r.headers.get('content-type'), r.headers.get('cache-control'), buf.length,
    createHash('sha256').update(buf).digest('hex'));
} finally { await w.stop(); }
```

Снять на `BEFORE` (уже снято 2026-11-14) и на ветке:

```powershell
node $env:TEMP\capture-app.mjs . $env:TEMP\app-after.html
```

Ожидается: `200 text/html; charset=utf-8 no-store 153719 b4ab9c8f819c7f05886eedaac1e857e99dedcfb474bfc47cbae0a7d3fdb01a58` —
то же, что на `BEFORE`.

## 4. Сборка для выката

```powershell
npx wrangler deploy --dry-run --outdir $env:TEMP\santa-dry
```

Ожидается: сборка без ошибок; в `$env:TEMP\santa-dry` — восемь текстовых модулей частей (имена с хэшем и именем файла
части), каждый побайтно равен своему файлу в `src/app/`; `src/app-page.js` и остальной код — в `index.js`.

## 5. Скриншоты

```powershell
npm run screenshots
```

Ожидается: все пункты ✔ (в том числе «цвета вкладок и кнопок…» и «шторка держит прокрутку»). Снимки сравниваются с
двумя прогонами на `BEFORE` попиксельно (PNG побайтно различаются и на одном коде): сравнитель `png-diff.mjs` печатает
для каждого снимка «identical pixels» или число отличающихся пикселей и рамку.

```js
// node png-diff.mjs <папка A> <папка B>: PNG 8 бит без чересстрочности (так снимает Chrome)
import { readFileSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
function decode(file) {
  const b = readFileSync(file); let p = 8, w, h, ct; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct], raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1), row = px.subarray(y * stride), prev = y ? px.subarray((y - 1) * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, up = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      row[x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
const [A, B] = process.argv.slice(2);
for (const f of readdirSync(A).filter((n) => n.endsWith('.png')).sort()) {
  const a = decode(`${A}/${f}`), b = decode(`${B}/${f}`);
  if (a.w !== b.w || a.h !== b.h) { console.log(f, `size ${a.w}x${a.h} vs ${b.w}x${b.h}`); continue; }
  let n = 0;
  for (let i = 0; i < a.px.length; i += a.bpp) if (a.px.compare(b.px, i, i + a.bpp, i, i + a.bpp)) n++;
  console.log(f, n ? `${n} px` : 'identical pixels');
}
```

Критерий (research R8): `00-home`, `00-home-dark`, `01-my-letter-empty`, `12-danger-zone`, `13-new-event`,
`16-home-participant`, `19-vault-gate`, `28-force-cancel` — «identical pixels» против обоих прогонов «до»; остальные
отличаются так же, как два прогона «до» между собой (время, случайный подопечный, высота экрана).

## 6. «От противного»

По одному, с откатом после каждого (`git checkout -- src/app`):

| Правка | Ожидается |
|---|---|
| ` style="x"` в любой строке разметки `ui.*` в `src/app/05-admin.js.txt` | падает `tests/design-system.test.mjs` («атрибуты style= запрещены») |
| «эвент» в строке текста для людей в `src/app/05-admin.js.txt` | падает `tests/wording.test.mjs`, сообщение называет `src/app/05-admin.js.txt:<строка>` |
| `ui.btn('＋ …'` в `src/app/04-event.js.txt` | падает проверка «кнопки … не начинаются с «＋»» с `src/app/04-event.js.txt:<строка>` |
| лишний файл `src/app/09-extra.js.txt` | падает `tests/app-parts.test.mjs` (файл не в сборке) |
| удалённая `}` в `src/app/06-vault-audit.js.txt` | падает `tests/app-parts.test.mjs` (часть не разбирается) |

## 7. Перед слиянием

```powershell
npm run test:e2e
```

Ожидается: все сценарии зелёные, `budget exceeded` в журнале нет. После выката — владелец открывает приложение на iPhone
(формальность при побайтном равенстве страницы).

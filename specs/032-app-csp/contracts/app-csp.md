# Контракт: политика безопасности страницы `/app` (032)

## Заголовок

Ответ `GET /app` (страница мини-приложения; при неготовой базе — прежний текст `500` без политики):

```text
content-type: text/html; charset=utf-8
cache-control: no-store
content-security-policy: default-src 'self'; script-src 'sha256-<B64>' https://telegram.org/js/telegram-web-app.js; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors https://*.telegram.org
```

- `<B64>` — base64 от SHA-256 UTF-8 текста встроенного скрипта страницы (между `<script>` и `</script>`), в котором
  CRLF и CR заменены на LF (так текст видит браузер после разбора HTML).
- Директивы — ровно эти восемь, в этом порядке, через `; `. Отпечатков в `script-src` — столько, сколько встроенных
  скриптов в странице (сейчас и по правилу ниже — один).
- Тело ответа — прежнее (склейка `src/app/` со стилями дизайн-системы), побайтно.
- Остальные адреса Worker (`/setup`, `/api/…`, `/tg`, `/`) не меняются; у `/setup` — прежняя
  `content-security-policy: frame-ancestors 'none'`.

## Код

`src/csp.js` (без импортов):

| Имя | Что делает |
|---|---|
| `TELEGRAM_SCRIPT` | `'https://telegram.org/js/telegram-web-app.js'` — единственный внешний скрипт страницы |
| `inlineScripts(page)` | тексты встроенных скриптов (`<script>` без атрибутов) по порядку, переводы строк — LF |
| `appPolicy(page)` | `Promise<string>` — строка политики по странице (отпечаток каждого встроенного скрипта) |

`src/index.js`: `appCsp ??= appPolicy(APP_PAGE)` при первом `/app` в экземпляре Worker, заголовок —
`await appCsp`.

## Правила страницы (проверяет `tests/app-csp.test.mjs`)

1. Каждый `<script…>` страницы — либо `<script>` без атрибутов (встроенный, ровно один), либо
   `<script src="https://telegram.org/js/telegram-web-app.js">` (без других атрибутов).
2. В коде приложения нет того, что политика заблокирует: `eval(`, `new Function`, строки первым аргументом
   `setTimeout`/`setInterval`, адресов `javascript:`, обработчиков событий атрибутом — `on…=` в HTML-частях
   (`.html`) и `setAttribute('on…'` в скрипте. Обработчики — только `addEventListener` (в `h()` — ключи `on…`
   функциями). Нарушение — с местом: `src/app/<часть>:<строка>`.
3. Атрибут `style` в разметке запрещён и раньше (дизайн-система, `tests/design-system.test.mjs`); изменение стилей из
   скрипта (`el.style.x = …`) политика не ограничивает.

Новый внешний скрипт, шрифт, картинка с чужого адреса или запрос на чужой адрес — только с правкой этого контракта,
`src/csp.js`, теста и проверкой на iPhone.

## Проверка в браузере (`tests/screenshots.mjs`)

- Каждая страница прогона (`openPage`) собирает нарушения политики (`securitypolicyviolation`); на обычных страницах их
  0.
- `checkCsp()`: на открытом приложении «от противного» — встроенный `<script>` (`script-src-elem`), `onclick` в
  разметке (`script-src-attr`), строка в `setTimeout` (`script-src`, `eval`; прямой `eval` из `page.evaluate` Chrome не
  проверяет — это код средств отладки, а строку таймера компилирует сама страница), `<script src>` с чужого адреса и с
  другого пути `telegram.org` (`script-src-elem`), `fetch` на чужой адрес (`connect-src`): нарушение нужного вида есть,
  код не выполнен.
- Проверка проверок: с ослабленной политикой (`'unsafe-inline' 'unsafe-eval' https:`, `style-src 'self'`,
  `connect-src *`, `frame-ancestors *`) прогон падает на каждой пробе, на обоих фреймах и на каждой странице (2026-11-16).
- Фрейм: родитель `https://web.telegram.org` — приложение загружено, `<style>`, созданный в странице, применён;
  родитель `https://csp-check.example` — фрейм заблокирован. При доступной сети — то же с настоящим
  `telegram-web-app.js` и событием `set_custom_style` от родителя.

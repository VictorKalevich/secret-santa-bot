# План 053: «Нравится бот?» — поддержать проект

**Branch**: `053-donate-block` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

На вкладке «Инфо» мини-приложения во втором (открытом) боте — раздел «Нравится бот?» с карточкой поддержки проекта по
образцу владельца: ☕, «Поддержать проект», текст, оранжевая кнопка DonationAlerts «❤️ Поддержать через DonationAlerts»,
строка благодарности. Нажатие на кнопку открывает `https://dalink.to/trivial_no` во внешнем браузере
(`Telegram.WebApp.openLink`, вне Telegram — `window.open`). Признак открытого бота уже есть в приложении (`state.open`
из `me.open`, 052), поэтому меняются только мини-приложение и дизайн-система: сервер, API, база и CSP — нет.

## Technical Context

**Language/Version**: JavaScript ES2022 (мини-приложение — части `src/app/*.js.txt`, один встроенный `<script>`)
**Primary Dependencies**: Telegram Web App SDK (`telegram-web-app.js`, уже подключён) — `openLink`
**Storage**: нет (ссылка — константа в приложении)
**Testing**: `node:test` по склейке приложения (`tests/support/app-source.mjs`), `tests/design-system.test.mjs`;
проверка в Chrome — `tests/screenshots.mjs` (`checkDonate`, мир открытого бота `startWorld({ vars: { OPEN_BOT: '1' } })`)
**Target Platform**: Telegram iOS/Android/Desktop/Web (мини-приложение), Chrome для проверок
**Project Type**: Cloudflare Worker + мини-приложение Telegram
**Performance Goals**: без запросов к Worker и D1 — нажатие только открывает ссылку
**Constraints**: только классы `ds-*`, без `style` и сырых цветов в приложении; CSP `/app` не меняется (переход по ссылке
— не запрос страницы); тексты — дословно от владельца
**Scale/Scope**: один раздел на одной вкладке, два токена, один компонент и вариант кнопки

## Constitution Check

*GATE: проверка до Phase 0 и после Phase 1.*

| Принцип | Проверка | Итог |
|---|---|---|
| I. Тайна | Блок не читает и не показывает данных событий и людей: ни имён, ни пар, ни статусов. Ответы сервера прежние. | ✅ |
| II. Проще некуда | Один заметный, но необязательный блок внизу «Инфо»; одно нажатие — страница сбора в браузере, приложение остаётся открытым. Тексты по-русски. | ✅ |
| III. Спецификация до кода | `specs/053-donate-block/` — spec, plan, research, contracts, quickstart, tasks до кода; запись в `CLAUDE.md`. | ✅ |
| IV. Только дизайн-система | Новый вариант кнопки и карточка — сначала в дизайн-систему (токены → `components.css` → `preview.html` → README), в приложении — только классы. **Отступление**: два фирменных цвета DonationAlerts не берутся из темы Telegram (одинаковы в обеих темах) — см. Complexity Tracking. | ✅ с обоснованием |
| V. Бесплатно | Ни одного запроса к Worker/D1 и платных сервисов; DonationAlerts — внешняя страница, которую человек открывает сам, бот от неё не зависит. | ✅ |
| VI. Проверено до выката | Тест `donate` (`npm test`), `design-system`, `wording`, `app-csp`; в Chrome — `checkDonate` (открытый и закрытый бот, порядок разделов, `openLink`, 320 точек, обе темы); `npm run test:all` перед слиянием. | ✅ |
| VII. Владелец — максимум | Права не затронуты; блок виден всем ролям одинаково. | ✅ |
| Безопасность и данные | Пользовательского текста в блоке нет; новых данных не хранится; CSP прежняя (`openLink` — сообщение клиенту Telegram, `window.open` — переход, не загрузка ресурса страницей). | ✅ |

После Phase 1 — без изменений: дизайн не добавил запросов, данных и прав.

## Project Structure

### Documentation (this feature)

```text
specs/053-donate-block/
├── spec.md
├── plan.md
├── research.md
├── contracts/donate-block.md   # вид, место, поведение и правила кода блока
├── quickstart.md               # проверка и выкат во второй бот
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
design-system/
├── tokens.css        # --ds-color-donate, --ds-color-on-donate (фирменные, одинаковы в обеих темах)
├── components.css    # .ds-btn--donate; .ds-donate, __icon, __title, __text, __note
├── preview.html      # раздел «Поддержка проекта»
└── README.md         # строки токенов и компонентов, версия 1.9.0
src/app/
├── 02-core.js.txt    # openWebLink(url) — внешняя ссылка в браузере (рядом с openTgLink)
└── 05-event.js.txt   # DONATE_URL, donateSection(); место в renderInfo
tests/
├── donate.test.mjs   # правила по склейке и дизайн-системе (новый файл — в скрипт test)
└── screenshots.mjs   # checkDonate
README.md, CLAUDE.md
```

**Structure Decision**: изменения только в мини-приложении и дизайн-системе; сервер не трогается.

## Complexity Tracking

| Отступление | Зачем | Почему не проще |
|---|---|---|
| Принцип IV: цвет кнопки не из темы Telegram | Владелец выбрал фирменный оранжевый DonationAlerts (`#ED8224`, белый текст), чтобы кнопка узнавалась как переход к сбору DonationAlerts | Кнопка цвета темы (`--ds-color-accent`) не отличается от обычных действий бота и не похожа на образец владельца. Так же устроены праздничный цвет жеребьёвки и открытки (038): фиксированные цвета, одинаковые в обеих темах, только токенами |

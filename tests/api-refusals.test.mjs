// Эталон отказов API (019, FR-1910, SC-1902): коды и тексты ответов без прав, на несуществующем событии, без события и
// на завершённом событии — те же, что до перехода на таблицу действий. Эталон — tests/fixtures/api-refusals.json
// (снят tests/fixtures/make-api-refusals.mjs на прежнем коде, не пересоздаётся).
// Намеренные изменения эталона — только точечно, по решениям владельца, со списком:
//   025 (specs/025-behavior-fixes/research.md, R5): служебный просмотр владельцу без слова ОТКРЫТЬ — 6 ответов
//   (owner, finished-owner, finished-old-owner × vault.person, vault.pairs) → 400 «Для служебного просмотра введи слово
//   ОТКРЫТЬ.»; admin.request.decide без approve на завершённых событиях — 4 ответа (finished-owner, finished-admin,
//   finished-old-owner, finished-old-admin) → 400 «Заявка не найдена.» (отклонение разрешено); новые случаи extra
//   vault.pairs-word, vault.person-word-wrong, vault.pairs-word-admin, request.decide-approve-finished.
//   034 (specs/034-small-consistency/spec.md, FR-001): один текст с ботом и приложением — 1 ответ (finished-old-member
//   support.close) → 400 «Событие завершено больше недели назад — обращения только для чтения.»
//   035 (specs/035-self-service/research.md, R7): новые действия name.set и event.leave — прежние ответы те же, новые
//   ключи «035 <ситуация> <действие>» (18 ситуаций × 2) и «035 extra …» (слово, завершённое событие, после жеребьёвки,
//   имя из пробелов и длиннее 40 символов).
//   038 (specs/038-emoji-postcards/research.md, R7): действие card.set — прежние ответы те же, новые
//   ключи «038 <ситуация> <действие>» и «038 extra …» (значок и открытка не из набора, открытка в завершённом событии).
//   040 (specs/040-santa-mask/research.md, R7): новое действие mask.set — прежние ответы те же, новые ключи «040 <ситуация>
//   mask.set» и «040 extra …» (маска не из набора, в завершённом событии, без подопечного, успех, после раскрытия).
//   048 (specs/048-owner-ward-swap/contracts/draw-swap.md): действия admin.draw.swap.check и admin.draw.swap — прежние
//   ответы те же, новые ключи «048 <ситуация> <действие>» и «048 extra …» (один человек дважды, не в жеребьёвке, без
//   жеребьёвки, «сам себе», устаревшая версия, админу).
//   051 (specs/051-companies/plan.md, «Точечные изменения»): действия company.label.set и bot.* — прежние ответы те же
//   (admin.owner.transfer и admin.transfer с прежними телами отвечают прежними текстами), новые ключи «051 <ситуация>
//   <действие>» и «051 extra …» (названия, повтор создания, слово, «есть события», владелец, имя человека двух компаний).
//   052 (specs/052-open-bot/contracts/open-bot.md, раздел 2): действия company.create и company.delete — прежние ответы те
//   же (в сценарии события создаются в компании 1 явно — та же, что раньше), новые ключи «052 <ситуация> <действие>»,
//   «052 extra …» (закрытый бот: не владелец бота, слово, «есть события») и «052 open …» (открытый бот: название, повтор,
//   лимит двух, общее название, удаление — слово, чужая, не владелец, есть события, своя).
//   059 (specs/059-room-wording/research.md, R6): «комната» вместо «компании» — коды и ключи прежние, тексты 53 ответов:
//   «Компания не найдена.» (28) → «Комната не найдена.»; «Выбери компанию.» (1) → «Выбери комнату.»; «Название компании
//   — от 1 до 40 символов.» (16) → «Название комнаты — …»; «Компания с таким названием только что создана.» (2) →
//   «Комната с таким …»; «В компании есть события — сначала удали их.» (3) → «В комнате есть события — …»; «Вести можно
//   не больше двух своих компаний — …» (1) → «… своих комнат — …»; «Удалить компанию может только владелец бота.» (1) и
//   «… только её владелец.» (1) → «Удалить комнату может только …».
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  runRefusals, NEW_ACTIONS, NEW_ACTIONS_038, NEW_ACTIONS_040, NEW_ACTIONS_041, NEW_ACTIONS_042, NEW_ACTIONS_048, NEW_ACTIONS_051,
  NEW_ACTIONS_052,
} from './support/refusals-scenario.mjs';
import { restoreFetch } from './support/world.mjs';
import { ACTIONS } from '../src/api.js';

after(restoreFetch);

const golden = JSON.parse(readFileSync(new URL('./fixtures/api-refusals.json', import.meta.url), 'utf8'));

test('отказы API: каждый код и текст — как в эталоне', async () => {
  const now = await runRefusals();
  assert.deepEqual(now.actions, golden.actions);
  const names = Object.keys(ACTIONS);
  const later = [
    ...NEW_ACTIONS, ...NEW_ACTIONS_038, ...NEW_ACTIONS_040, ...NEW_ACTIONS_041, ...NEW_ACTIONS_042, ...NEW_ACTIONS_048, ...NEW_ACTIONS_051,
    ...NEW_ACTIONS_052,
  ];
  assert.deepEqual(names.filter((a) => !later.includes(a)), golden.actions, 'таблица действий — прежние 59 действий в прежнем порядке');
  assert.deepEqual(names.filter((a) => later.includes(a)).sort(), [...later].sort(), 'новые действия (035, 038, 040, 041, 042, 048, 051, 052) — в таблице');
  const diff = [];
  for (const key of new Set([...Object.keys(golden.cases), ...Object.keys(now.cases)])) {
    const a = JSON.stringify(golden.cases[key]);
    const b = JSON.stringify(now.cases[key]);
    if (a !== b) diff.push(`${key}: было ${a}, стало ${b}`);
  }
  assert.deepEqual(diff, []);
});

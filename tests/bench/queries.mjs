// Таблица «действие → запросов к базе и к Telegram» по сценарию tests/support/queries-scenario.mjs (016).
// Запуск из корня проекта:  node tests/bench/queries.mjs        — таблица
//                           node tests/bench/queries.mjs sql    — ещё и SQL каждого действия
// Базовые числа и проверка «не больше» — таблица в tests/queries.test.mjs.
import { runQueriesScenario } from '../support/queries-scenario.mjs';
import { restoreFetch } from '../support/world.mjs';

const { rows, world, ms } = await runQueriesScenario();
restoreFetch();
const pad = (x, n) => String(x).padEnd(n);
console.log(pad('действие', 52), pad('запросов к базе', 16), 'запросов к Telegram');
for (const { name, db, tg } of rows) console.log(pad(name, 52), pad(db, 16), tg);
console.log(`\nсценарий целиком: ${ms.toFixed(0)} мс, сообщений отправлено: ${world.calls.filter((c) => c.method === 'sendMessage').length}`);
if (process.argv[2] === 'sql') {
  for (const { name, sql } of rows) {
    console.log('\n== ' + name);
    sql.forEach((q, i) => console.log(String(i + 1).padStart(2) + '. ' + q.slice(0, 140)));
  }
}

// Разбор планов запросов (054, 055): какие операторы вызова просматривают таблицу или индекс целиком. Пользуются
// tests/cron-reads.test.mjs (минутная проверка) и tests/api-reads.test.mjs (вызовы API и бота).

// Псевдоним → таблица: FROM/JOIN/UPDATE/INTO <таблица> [AS] <псевдоним>
const KEYWORD = /^(ON|WHERE|JOIN|CROSS|LEFT|INNER|SET|ORDER|GROUP|LIMIT|USING|VALUES|SELECT|AND|RETURNING|UNION)$/i;
export function tablesOf(sql) {
  const names = new Map();
  for (const m of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi)) {
    names.set(m[1], m[1]);
    if (m[2] && !KEYWORD.test(m[2])) names.set(m[2], m[1]);
  }
  return names;
}

// Полные просмотры оператора: ['таблица: строка плана'] — кроме таблиц tables и индексов indexes из allow. Проход по
// всему индексу (SCAN … USING INDEX) — тоже полный просмотр
export function fullScans(sqlite, sql, { tables = [], indexes = [] } = {}) {
  const names = tablesOf(sql);
  return sqlite.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((r) => r.detail).flatMap((d) => {
    const m = /^SCAN (\w+)(?: USING (?:COVERING )?INDEX (\w+))?/.exec(d);
    if (!m || m[1] === 'CONSTANT') return [];
    const table = names.get(m[1]) ?? m[1];
    return tables.includes(table) || indexes.includes(m[2]) ? [] : [`${table}: ${d}`];
  });
}

// Тексты всех операторов, которые выполнил fn (пакеты D1 выполняются оператор за оператором через тот же prepare)
export async function statementsDuring(w, fn) {
  const seen = new Set();
  const { sqlite } = w.DB;
  const own = sqlite.prepare;
  sqlite.prepare = (sql) => {
    if (!/^\s*(BEGIN|COMMIT|ROLLBACK|SELECT total_changes\(\))/i.test(sql)) seen.add(sql.replace(/\s+/g, ' ').trim());
    return own.call(sqlite, sql);
  };
  try {
    await fn();
  } finally {
    sqlite.prepare = own;
  }
  return [...seen];
}

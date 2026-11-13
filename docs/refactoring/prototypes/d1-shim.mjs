// ПРОТОТИП (не используется приложением и `npm test`). Проверен на коммите 24b85d3, Node 24.21.
// Подмена D1 на встроенном node:sqlite. Интерфейс — ровно то, чем пользуется src/:
// prepare → bind → first(col?) / all() / run() / raw(); batch(list) — одна транзакция; exec(sql).
// Через эту подмену проходит весь Worker (src/index.js): см. world.mjs и queries.mjs.
import { DatabaseSync } from 'node:sqlite';

export function createD1(sqlite = new DatabaseSync(':memory:')) {
  const total = sqlite.prepare('SELECT total_changes() AS n, last_insert_rowid() AS id');
  const stats = { queries: 0, statements: 0, log: [] };

  // Как D1: undefined — ошибка, boolean → 0/1. Числа node:sqlite привязывает как REAL — так же, как D1.
  const norm = (v) => {
    if (v === undefined) throw new TypeError("D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'");
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  };

  // Один оператор. changes — по разнице total_changes(): у SELECT это 0, как в D1
  // (sqlite3_changes() после SELECT вернул бы число от предыдущего оператора).
  const execute = (sql, args) => {
    stats.statements++;
    const st = sqlite.prepare(sql);
    const before = total.get().n;
    const rows = st.all(...args.map(norm)).map((r) => ({ ...r }));
    const after = total.get();
    return { success: true, results: rows, meta: { changes: after.n - before, last_row_id: after.id, duration: 0 } };
  };

  const isWrite = (sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
  // «Барьер перед записью» (см. world.together): первая запись вызова ждёт, пока до записи дойдут остальные
  const hold = async (write) => {
    if (api.gate && write) await api.gate();
  };
  const count = (sql) => {
    stats.queries++;
    stats.log.push(sql.replace(/\s+/g, ' ').trim());
  };

  const stmt = (sql, args = []) => ({
    sql,
    args,
    bind: (...a) => stmt(sql, a),
    first: async (col) => {
      await hold(isWrite(sql));
      count(sql);
      const row = execute(sql, args).results[0];
      if (row === undefined) return null;
      return col === undefined ? row : row[col] ?? null;
    },
    all: async () => {
      await hold(isWrite(sql));
      count(sql);
      return execute(sql, args);
    },
    run: async () => {
      await hold(isWrite(sql));
      count(sql);
      return execute(sql, args);
    },
    raw: async () => {
      await hold(isWrite(sql));
      count(sql);
      return execute(sql, args).results.map((r) => Object.values(r));
    },
  });

  const api = {
    gate: null,
    sqlite,
    stats,
    prepare: (sql) => stmt(sql),
    // Одна транзакция: ошибка в любом операторе откатывает все
    batch: async (list) => {
      await hold(true);
      count(`batch(${list.length})`);
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const out = list.map((s) => execute(s.sql, s.args));
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql) => {
      count('exec');
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  return api;
}

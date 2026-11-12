// Бюджет внешних запросов одного вызова Worker (бесплатный тариф Cloudflare: не больше 50 на вызов,
// запросы к D1 входят в это число; batch — один запрос). Счётчик ведётся на обёртке env:
// каждый запрос к D1 и каждый запрос к Telegram (см. telegram.js) увеличивает env.meter.used.

export const SUBREQUEST_LIMIT = 50;

// Обёртка env со счётчиком: { ...env, DB: база со счётчиком, meter }
export function metered(env) {
  if (env.meter) return env;
  const meter = { used: 0, enqueued: false };
  return { ...env, DB: meterDb(env.DB, meter), meter };
}

function meterDb(db, meter) {
  const wrap = (stmt) => ({
    raw_stmt: stmt,
    bind: (...args) => wrap(stmt.bind(...args)),
    first: (...args) => (meter.used++, stmt.first(...args)),
    all: () => (meter.used++, stmt.all()),
    run: () => (meter.used++, stmt.run()),
    raw: (...args) => (meter.used++, stmt.raw(...args)),
  });
  return {
    meter,
    prepare: (sql) => wrap(db.prepare(sql)),
    batch: (list) => (meter.used++, db.batch(list.map((s) => s.raw_stmt || s))),
    exec: (sql) => (meter.used++, db.exec(sql)),
  };
}

// Сколько внешних запросов ещё можно сделать в этом вызове
export const budgetLeft = (env) => SUBREQUEST_LIMIT - (env.meter?.used || 0);

// Превышение видно в журнале Worker (и проверяется в e2e)
export function reportBudget(env, where) {
  if (env.meter && env.meter.used > SUBREQUEST_LIMIT) console.log('budget exceeded', where, env.meter.used);
}

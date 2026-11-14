// Атомарные действия (020): «захват + операторы по условию» — один batch D1. Batch — одна транзакция, транзакции записи
// одной базы идут по очереди, поэтому второй из одновременных вызовов видит то, что записал первый.
// Условие и его параметры задаются один раз; операторы идут в пакете в порядке вызовов методов. Два вида условий:
//   «захват мой» — у захвата есть значение, которого второй вызов не повторит (случайная версия пар, отметка раскрытия,
//     существование опоры, которая удаляется последней); операторы — после захвата;
//   «по прежнему состоянию» — такого значения нет (у двух нажатий одного человека в одну миллисекунду совпадают и время,
//     и автор): операторы — ПЕРЕД захватом и проверяют состояние, которое захват отменяет (повторяя все его условия).
// Время и автор в условии «свой захват» не используются. Контракт — specs/020-claims-snapshots/contracts/claims-snapshots.md.

import { enqueueIfStmt, auditIfStmt } from './db.js';

// Скобки выражения SQL закрыты (содержимое строк в одинарных кавычках не считается)
export function closedParens(sql) {
  let depth = 0;
  let quoted = false;
  for (const c of String(sql)) {
    if (c === "'") quoted = !quoted;
    else if (quoted) continue;
    else if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return false;
  }
  return depth === 0 && !quoted;
}

function checked(cond) {
  if (!closedParens(cond)) throw new Error(`atomic: условие с незакрытой скобкой: ${cond}`);
  return `(${cond})`;
}

// Построитель пакета с условием cond (параметры args). Методы добавления возвращают добавленный оператор.
export function atomic(db, cond, ...args) {
  const batch = { stmts: [], claim: null };
  return builder(db, batch, checked(cond), args);
}

function builder(db, batch, sql, args) {
  const push = (stmt) => {
    batch.stmts.push(stmt);
    return stmt;
  };
  return {
    sql,
    args,
    // Для построителей с параметрами (guard, ...args): addMemberStmt, eventDataDeleteStmts, memberDataDeleteStmts…
    guard: [sql, ...args],
    // Тот же пакет, условие — это и ещё одно
    and: (more, ...moreArgs) => builder(db, batch, `(${sql} AND ${checked(more)})`, [...args, ...moreArgs]),
    enqueue: (chatId, payload) => push(enqueueIfStmt(db, chatId, payload, sql, ...args)),
    audit: (eventId, actor, action, details = '') => push(auditIfStmt(db, eventId, actor, action, details, sql, ...args)),
    // Текст оканчивается условием WHERE: условие добавляется через AND, его параметры — после params
    where: (text, ...params) => push(db.prepare(`${text} AND ${sql}`).bind(...params, ...args)),
    // INSERT … SELECT … без WHERE: условие становится его WHERE
    select: (text, ...params) => push(db.prepare(`${text} WHERE ${sql}`).bind(...params, ...args)),
    // Операторы со своими условиями
    add: (...stmts) => {
      batch.stmts.push(...stmts);
      return stmts.at(-1);
    },
    // Оператор захвата: по нему узнаётся исход вызова; один на пакет
    claim: (stmt) => {
      if (batch.claim) throw new Error('atomic: захват уже отмечен');
      if (!batch.stmts.includes(stmt)) batch.stmts.push(stmt);
      batch.claim = stmt;
      return stmt;
    },
    // Выполнить пакет: won — захват изменил строки (или вернул строку — RETURNING); без захвата — null
    async run() {
      const results = await db.batch(batch.stmts);
      if (!batch.claim) return { won: null, claim: null, results };
      const claim = results[batch.stmts.indexOf(batch.claim)];
      return { won: claim.meta.changes > 0 || !!claim.results?.length, claim, results };
    },
  };
}

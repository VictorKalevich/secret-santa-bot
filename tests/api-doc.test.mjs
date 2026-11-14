// Сводный контракт API (022): docs/api.md ↔ таблица действий ACTIONS (src/api.js) и коды журнала, которые пишет сервер.
// Имена действий — в обе стороны (строка сводной таблицы и раздел «### `имя`»); роль, событие и «в завершённом» — как в
// строке таблицы; тексты отказа «завершено», отказа не владельцу и слова подтверждения — в разделе действия. Проверки —
// чистые функции; у каждой есть проверка «от противного» на искусственном документе. Правила —
// specs/022-docs-contract/contracts/api-doc.md.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ACTIONS, ROLES } from '../src/api.js';

const DOC = readFileSync(new URL('../docs/api.md', import.meta.url), 'utf8');
const SRC = new URL('../src/', import.meta.url);
const SOURCES = readdirSync(SRC)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, text: readFileSync(new URL(f, SRC), 'utf8') }));

// Словарь колонок сводной таблицы (research R4 фичи 022)
const WHO = {
  [ROLES.ANY]: 'любой',
  [ROLES.USER]: 'зарегистрированный',
  [ROLES.VIEWER]: 'участник или админ',
  [ROLES.MEMBER]: 'участник',
  [ROLES.ADMIN]: 'админ',
  [ROLES.OWNER]: 'владелец',
};
const eventCell = (row) => (row.event === true ? 'да' : row.event === 'given' ? 'если передано' : '—');
// finished: true — конвейер пропускает; три значения различают, что дальше делает обработчик
const OPEN_IN_FINISHED = ['да', '7 суток', 'проверяет обработчик'];
const finishedOk = (row, cell) =>
  row.finished === undefined ? cell === '—' : row.finished === true ? OPEN_IN_FINISHED.includes(cell) : cell === 'нет';
const finishedWant = (row) =>
  row.finished === undefined ? '—' : row.finished === true ? OPEN_IN_FINISHED.join(' | ') : 'нет';

// Пробелы и переводы строк — один пробел: текст в документе переносится по строкам
const norm = (s) => s.replace(/\s+/g, ' ');

// Строки главы «## title» (до следующего «## »); null — главы нет
function chapter(doc, title) {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## ' + title);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}

// Строки таблицы, у которых в первой колонке имя в обратных кавычках: [{ name, cells }] (\| — не разделитель)
function tableRows(lines) {
  const out = [];
  for (const l of lines) {
    const m = /^\|\s*`([^`]+)`\s*\|(.*)\|\s*$/.exec(l);
    if (m) out.push({ name: m[1], cells: m[2].split(/(?<!\\)\|/).map((c) => c.trim()) });
  }
  return out;
}

// Разделы «### `имя`» → текст до следующего заголовка «#»–«###»; повторы — отдельно
function sections(doc) {
  const texts = new Map();
  const dup = [];
  let cur = null;
  for (const l of doc.split('\n')) {
    const h = /^###\s+`([^`]+)`\s*$/.exec(l);
    if (h) {
      cur = h[1];
      if (texts.has(cur)) dup.push(cur);
      texts.set(cur, []);
    } else if (/^#{1,3}\s/.test(l)) cur = null;
    else if (cur) texts.get(cur).push(l);
  }
  return { texts: new Map([...texts].map(([k, v]) => [k, norm(v.join('\n'))])), dup };
}

// Расхождения документа с таблицей действий (пусто — совпадают)
function actionProblems(doc, actions) {
  const summary = chapter(doc, 'Сводная таблица действий');
  if (!summary) return ['нет главы «## Сводная таблица действий»'];
  const out = [];
  const rows = tableRows(summary);
  const inTable = new Set();
  for (const r of rows) {
    if (inTable.has(r.name)) out.push(`${r.name}: строка сводной таблицы повторяется`);
    inTable.add(r.name);
  }
  const { texts, dup } = sections(doc);
  for (const n of dup) out.push(`${n}: раздел повторяется`);
  for (const n of Object.keys(actions)) {
    if (!inTable.has(n)) out.push(`${n}: нет строки в сводной таблице`);
    if (!texts.has(n)) out.push(`${n}: нет раздела «### \`${n}\`»`);
  }
  for (const n of inTable) if (!Object.hasOwn(actions, n)) out.push(`${n}: строка сводной таблицы, а действия в коде нет`);
  for (const n of texts.keys()) if (!Object.hasOwn(actions, n)) out.push(`${n}: раздел есть, а действия в коде нет`);
  for (const { name, cells } of rows) {
    const row = Object.hasOwn(actions, name) ? actions[name] : null;
    if (!row) continue;
    const [who, event, finished] = cells;
    if (who !== WHO[row.role]) out.push(`${name}: «кто» — «${who}», в коде — «${WHO[row.role]}»`);
    if (event !== eventCell(row)) out.push(`${name}: «событие» — «${event}», в коде — «${eventCell(row)}»`);
    if (!finishedOk(row, finished)) out.push(`${name}: «в завершённом» — «${finished}», в коде — «${finishedWant(row)}»`);
  }
  for (const [name, row] of Object.entries(actions)) {
    const text = texts.get(name);
    if (text === undefined) continue;
    const need = [
      ...(typeof row.finished === 'string' ? [row.finished] : []),
      ...(row.owner ? [row.owner] : []),
      ...(row.confirm || []),
    ];
    for (const t of need) if (!text.includes(norm(t))) out.push(`${name}: в разделе нет текста «${t}»`);
  }
  return out;
}

// Коды журнала, которые пишет серверный код (research R3 фичи 022): литералы в строке вызова auditStmt / auditIfStmt /
// .audit( или INSERT INTO audit — начиная с вызова; параметр action: 'код' / action = 'код' перед «,» или «}»
const CODE = "'([a-z]+(?:\\.[a-z_]+)*)'";
const AUDIT_CALL = /(?:\bauditStmt|\bauditIfStmt|\.audit)\(|INSERT INTO audit\b/;
const ACTION_PARAM = new RegExp(`\\baction(?::\\s*|\\s*=\\s*)${CODE}(?=\\s*[,}])`, 'g');

function serverAuditCodes(sources) {
  const codes = new Set();
  for (const { text } of sources) {
    for (const line of text.split('\n')) {
      const at = line.search(AUDIT_CALL);
      if (at >= 0) for (const m of line.slice(at).matchAll(new RegExp(CODE, 'g'))) codes.add(m[1]);
      for (const m of line.matchAll(ACTION_PARAM)) codes.add(m[1]);
    }
  }
  return codes;
}

// Коды таблицы «## Коды журнала» документа (с повторами — их ловит auditProblems)
function docAuditCodes(doc) {
  const lines = chapter(doc, 'Коды журнала');
  return lines ? tableRows(lines).map((r) => r.name) : null;
}

function auditProblems(docCodes, serverCodes) {
  if (!docCodes) return ['нет главы «## Коды журнала»'];
  const out = [];
  const seen = new Set();
  for (const c of docCodes) {
    if (seen.has(c)) out.push(`${c}: код журнала повторяется`);
    seen.add(c);
  }
  for (const c of serverCodes) if (!seen.has(c)) out.push(`${c}: сервер пишет код, а в документе его нет`);
  for (const c of seen) if (!serverCodes.has(c)) out.push(`${c}: код в документе, а сервер его не пишет`);
  return out;
}

const has = (problems, part) => problems.some((p) => p.includes(part));

describe('сводный контракт API: документ ↔ таблица действий', () => {
  it('59 действий: строка сводной таблицы и раздел у каждого, роль, событие, «в завершённом» и тексты отказов — как в коде', () => {
    assert.deepEqual(actionProblems(DOC, ACTIONS), []);
    assert.equal(tableRows(chapter(DOC, 'Сводная таблица действий')).length, Object.keys(ACTIONS).length);
    assert.equal(Object.keys(ACTIONS).length, 59);
  });

  it('от противного: действие в коде без описания, лишний раздел и лишняя строка', () => {
    const extra = { ...ACTIONS, 'admin.new': { role: ROLES.ADMIN, event: true, finished: 'X', run() {} } };
    const p = actionProblems(DOC, extra);
    assert.ok(has(p, 'admin.new: нет строки в сводной таблице'), p.join('\n'));
    assert.ok(has(p, 'admin.new: нет раздела'), p.join('\n'));

    const noSection = DOC.replace(/### `admin\.ring`[\s\S]*?(?=\n### )/, '');
    assert.notEqual(noSection, DOC);
    assert.ok(has(actionProblems(noSection, ACTIONS), 'admin.ring: нет раздела'));

    const noRow = DOC.replace(/^\| `me` \|.*\n/m, '');
    assert.notEqual(noRow, DOC);
    assert.ok(has(actionProblems(noRow, ACTIONS), 'me: нет строки в сводной таблице'));

    const ghost = DOC + '\n### `admin.ghost`\n\nТакого действия нет.\n';
    assert.ok(has(actionProblems(ghost, ACTIONS), 'admin.ghost: раздел есть, а действия в коде нет'));

    const ghostRow = DOC.replace(/^(\| `me` \|.*\n)/m, '$1| `admin.ghost` | админ | да | нет | |\n');
    assert.ok(has(actionProblems(ghostRow, ACTIONS), 'admin.ghost: строка сводной таблицы, а действия в коде нет'));

    const twice = DOC.replace(/^(\| `me` \|.*\n)/m, '$1$1');
    assert.ok(has(actionProblems(twice, ACTIONS), 'me: строка сводной таблицы повторяется'));
  });

  it('от противного: неверная роль, событие и «в завершённом» в сводной таблице', () => {
    const role = DOC.replace('| `admin.insert` | владелец |', '| `admin.insert` | админ |');
    assert.notEqual(role, DOC);
    assert.ok(has(actionProblems(role, ACTIONS), 'admin.insert: «кто»'));

    const event = DOC.replace('| `admin.audit` | админ | если передано |', '| `admin.audit` | админ | да |');
    assert.notEqual(event, DOC);
    assert.ok(has(actionProblems(event, ACTIONS), 'admin.audit: «событие»'));

    const finished = DOC.replace('| `admin.reveal` | админ | да | да |', '| `admin.reveal` | админ | да | нет |');
    assert.notEqual(finished, DOC);
    assert.ok(has(actionProblems(finished, ACTIONS), 'admin.reveal: «в завершённом»'));

    const closed = DOC.replace('| `admin.game` | админ | да | нет |', '| `admin.game` | админ | да | 7 суток |');
    assert.notEqual(closed, DOC);
    assert.ok(has(actionProblems(closed, ACTIONS), 'admin.game: «в завершённом»'));
  });

  it('от противного: в разделе нет текста отказа не владельцу, «завершено» или слова подтверждения', () => {
    const owner = DOC.replace('Удалить событие может только владелец бота.', 'Удалить событие может только владелец.');
    assert.notEqual(owner, DOC);
    assert.ok(has(actionProblems(owner, ACTIONS), 'admin.event.delete: в разделе нет текста'));

    const word = DOC.replace('Для полного сброса введи слово СБРОС.', 'Для полного сброса введи слово.');
    assert.notEqual(word, DOC);
    assert.ok(has(actionProblems(word, ACTIONS), 'admin.reset.full: в разделе нет текста «Для полного сброса'));

    const letter = DOC.replace('Событие завершено: письмо теперь только для чтения.', 'Событие завершено.');
    assert.notEqual(letter, DOC);
    assert.ok(has(actionProblems(letter, ACTIONS), 'wishlist.save: в разделе нет текста'));
  });

  it('нет главы сводной таблицы — одно понятное нарушение', () => {
    assert.deepEqual(actionProblems('# пусто\n', ACTIONS), ['нет главы «## Сводная таблица действий»']);
  });
});

describe('сводный контракт API: коды журнала', () => {
  const server = serverAuditCodes(SOURCES);

  it('коды таблицы журнала = коды, которые пишет сервер', () => {
    // Все три образца сбора работают: вызов журнала (в том числе тернарный), INSERT INTO audit, параметр action
    for (const c of ['wishlist.view', 'exclusion.add', 'exclusion.del', 'event.create', 'draw', 'draw.auto', 'draw.cancel.force']) {
      assert.ok(server.has(c), `сбор кодов не нашёл «${c}»`);
    }
    assert.deepEqual(auditProblems(docAuditCodes(DOC), server), []);
  });

  it('от противного: лишний код в документе, код сервера без строки, повтор', () => {
    const extra = DOC.replace(/^(\| `event\.create` \|.*\n)/m, '$1| `draw.fake` | события | — | — |\n');
    assert.notEqual(extra, DOC);
    assert.ok(has(auditProblems(docAuditCodes(extra), server), 'draw.fake: код в документе, а сервер его не пишет'));

    const fromCode = serverAuditCodes([...SOURCES, { name: 'x.js', text: "  x.audit(ev.id, actor, 'new.code', '');" }]);
    assert.ok(has(auditProblems(docAuditCodes(DOC), fromCode), 'new.code: сервер пишет код, а в документе его нет'));

    const twice = DOC.replace(/^(\| `reveal` \|.*\n)/m, '$1$1');
    assert.ok(has(auditProblems(docAuditCodes(twice), server), 'reveal: код журнала повторяется'));

    assert.deepEqual(auditProblems(docAuditCodes('# пусто\n'), server), ['нет главы «## Коды журнала»']);
  });

  it('сбор кодов: литерал только с места вызова журнала, SQL «action = …)» и подробности не считаются', () => {
    const src = [
      "const t = 'not.code'; stmts.push(auditStmt(db, ev.id, actor, 'a.one', 'подробности'));",
      "p.audit(ev.id, actor, approve ? 'b.yes' : 'b.no', name);",
      "db.prepare(`INSERT INTO audit (event_id, actor, action) VALUES (?, ?, 'c.sql')`);",
      "AND NOT EXISTS (SELECT 1 FROM audit WHERE action = 'd.where')",
      "runDraw(ctx, ev, { actor: 0, action: 'e.param' }); function f({ action = 'f.default' } = {}) {}",
    ].join('\n');
    assert.deepEqual([...serverAuditCodes([{ name: 's.js', text: src }])].sort(), ['a.one', 'b.no', 'b.yes', 'c.sql', 'e.param', 'f.default']);
  });
});

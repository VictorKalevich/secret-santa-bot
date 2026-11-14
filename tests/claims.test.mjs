// Помощник атомарных действий (020, src/claim.js): порядок операторов, условия, отметка захвата, «по прежнему
// состоянию» на настоящем SQLite. Ниже — проверка исходников: в src/ нет фрагментов SQL с незакрытой скобкой (FR-2011).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createMigratedD1 } from './support/d1-sqlite.mjs';
import { atomic, closedParens } from '../src/claim.js';

const clean = (s) => s.replace(/\s+/g, ' ').trim();

describe('помощник захватов', () => {
  it('скобки: закрытые — да, незакрытые и лишние — нет, скобки в строках не считаются', () => {
    assert.equal(closedParens('EXISTS (SELECT 1 FROM t WHERE id = ?)'), true);
    assert.equal(closedParens("status = '(' AND (a = 1)"), true);
    assert.equal(closedParens('EXISTS (SELECT 1 FROM t WHERE id = ?'), false);
    assert.equal(closedParens('a = 1) AND (b = 2'), false);
    assert.throws(() => atomic(createMigratedD1(), 'EXISTS (SELECT 1 FROM t WHERE id = ?', 1), /незакрытой скобкой/);
    assert.throws(() => atomic(createMigratedD1(), '1').and('(x = ?', 1), /незакрытой скобкой/);
  });

  it('операторы — в порядке вызовов; условие и его параметры добавляются к каждому; and — тот же пакет', () => {
    const db = createMigratedD1();
    const a = atomic(db, 'EXISTS (SELECT 1 FROM events WHERE id = ?)', 7);
    const b = a.and('EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)', 7, 42);
    const s1 = a.where('DELETE FROM pairs WHERE event_id = ?', 7);
    const s2 = b.select('INSERT INTO pairs (event_id, santa, ward) SELECT ?, ?, ?', 7, 1, 2);
    const s3 = b.enqueue(42, { text: 'x' });
    const s4 = a.audit(7, 9, 'test', 'd');
    const s5 = a.add({ sql: 'SELECT 1', args: [] });
    assert.equal(clean(s1.sql), 'DELETE FROM pairs WHERE event_id = ? AND (EXISTS (SELECT 1 FROM events WHERE id = ?))');
    assert.deepEqual(s1.args, [7, 7]);
    assert.equal(clean(s2.sql),
      'INSERT INTO pairs (event_id, santa, ward) SELECT ?, ?, ? WHERE ((EXISTS (SELECT 1 FROM events WHERE id = ?)) AND (EXISTS (SELECT 1 FROM members WHERE event_id = ? AND user_id = ?)))');
    assert.deepEqual(s2.args, [7, 1, 2, 7, 7, 42]);
    assert.deepEqual(s3.args.slice(-3), [7, 7, 42]);
    assert.deepEqual(s4.args.slice(-1), [7]);
    assert.deepEqual(b.guard, [b.sql, 7, 7, 42]);
    assert.equal(s5.sql, 'SELECT 1');
    const stmt = { sql: 'UPDATE events SET title = ? WHERE id = ?', args: ['t', 7] };
    assert.equal(a.claim(stmt), stmt);
    assert.throws(() => b.claim(s1), /уже отмечен/, 'захват один на пакет — и у построителей из and()');
  });

  it('claim уже добавленного оператора не дублирует его', async () => {
    const db = createMigratedD1();
    const a = atomic(db, '1 = 1');
    const s = a.audit(0, 1, 'x');
    a.claim(s);
    const { won, results } = await a.run();
    assert.equal(results.length, 1);
    assert.equal(won, true);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'x'").get().n, 1);
  });

  it('без захвата — won = null; захват по RETURNING — по вернувшейся строке', async () => {
    const db = createMigratedD1();
    const a = atomic(db, '1 = 1');
    a.audit(0, 1, 'y');
    assert.equal((await a.run()).won, null);
    const b = atomic(db, '1 = 1');
    b.claim(db.prepare("INSERT INTO settings (key, value) SELECT 'k', 'v' WHERE " + b.sql + ' RETURNING key'));
    const r = await b.run();
    assert.equal(r.won, true);
    assert.equal(r.claim.results[0].key, 'k');
  });

  it('по прежнему состоянию: уведомление перед захватом — повтор того же пакета ничего не пишет', async () => {
    const db = createMigratedD1();
    db.sqlite.exec("INSERT INTO settings (key, value) VALUES ('flag', '0')");
    const once = () => {
      const a = atomic(db, "EXISTS (SELECT 1 FROM settings WHERE key = 'flag' AND value = '0')");
      a.enqueue(5, { text: 'один раз' });
      a.audit(0, 5, 'flag.set');
      a.claim(db.prepare("UPDATE settings SET value = '1' WHERE key = 'flag' AND value = '0'"));
      return a.run();
    };
    assert.equal((await once()).won, true);
    assert.equal((await once()).won, false);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM outbox WHERE chat_id = 5').get().n, 1);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'flag.set'").get().n, 1);
  });
});

// ---------- исходники: фрагменты SQL со скобками закрыты (FR-2011) ----------

// Строковые литералы исходника JS: в кавычках и шаблоны (выражение ${…} — «?», литералы внутри него — отдельно).
// Комментарии и регулярные выражения пропускаются.
const REGEX_AFTER_WORD = /(?:^|[^\w$])(return|typeof|case|in|of|void|delete|throw|new|else|yield|await)$/;
export function stringLiterals(src) {
  const out = [];
  let i = 0;
  let prev = ''; // последний значимый символ кода: отличает регулярное выражение от деления
  const escaped = (s) => {
    i += 2;
    return s + src[i - 1];
  };
  const quoted = (q) => {
    let s = '';
    for (i++; i < src.length && src[i] !== q;) s = src[i] === '\\' ? escaped(s) : s + src[i++];
    i++;
    return s;
  };
  const template = () => {
    let s = '';
    for (i++; i < src.length && src[i] !== '`';) {
      if (src[i] === '\\') s = escaped(s);
      else if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        code('}');
        i++;
        s += '?';
      } else s += src[i++];
    }
    i++;
    return s;
  };
  const regexHere = () => {
    if (!prev || '(,=:[!&|?{};+-*%<>~^'.includes(prev)) return true;
    return /[\w$]/.test(prev) && REGEX_AFTER_WORD.test(src.slice(Math.max(0, i - 12), i).trimEnd());
  };
  const skipRegex = () => {
    let cls = false;
    for (i++; i < src.length && (cls || src[i] !== '/'); i++) {
      if (src[i] === '\\') i++;
      else if (src[i] === '[') cls = true;
      else if (src[i] === ']') cls = false;
    }
    for (i++; /[a-z]/.test(src[i] || ''); i++);
  };
  // Код до непарного end (или до конца файла)
  function code(end) {
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === end && depth === 0) return;
      if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (c === '/' && src[i + 1] === '*') {
        i = src.indexOf('*/', i + 2) + 2;
      } else if (c === "'" || c === '"' || c === '`') {
        out.push(c === '`' ? template() : quoted(c));
        prev = 'x';
      } else if (c === '/' && regexHere()) {
        skipRegex();
        prev = 'x';
      } else {
        if (c === '{') depth++;
        if (c === '}') depth--;
        if (!/\s/.test(c)) prev = c;
        i++;
      }
    }
  }
  code(null);
  return out;
}

const SQL_WORDS = /\b(SELECT|INSERT|UPDATE|DELETE|EXISTS|WHERE)\b/;
const unclosedSql = (src) => stringLiterals(src).filter((s) => SQL_WORDS.test(s) && !closedParens(s));

describe('исходники: фрагменты SQL со скобками закрыты', () => {
  it('разбор литералов: кавычки, шаблоны с вложенными ${…}; комментарии и регулярные выражения пропускаются', () => {
    const src = [
      "const a = 'x(' + \"y\\\"\"; // 'комментарий (",
      "/* 'и этот (' */ const r = /'(/g; const t = `a ${f(`b (${c})`, { k: 1 })} d`;",
      "const n = m / 2 / k; function g() { return /\\)'/.test(s); } const z = 'k';",
    ].join('\n');
    assert.deepEqual(stringLiterals(src), ['x(', 'y"', 'b (?)', 'a ? d', 'k']);
  });

  it('от противного: фрагмент с незакрытой скобкой находится — и в шаблоне', () => {
    assert.deepEqual(unclosedSql("const THREAD = 'EXISTS (SELECT 1 FROM t WHERE id = ?';"), ['EXISTS (SELECT 1 FROM t WHERE id = ?']);
    assert.deepEqual(unclosedSql('const q = `UPDATE t SET a = 1 WHERE id = ? AND (${x}`;'), ['UPDATE t SET a = 1 WHERE id = ? AND (?']);
    assert.deepEqual(unclosedSql("const ok = 'EXISTS (SELECT 1 FROM t WHERE id = ?)'; const text = 'Нажми (кнопку';"), []);
  });

  it('в src/*.js у каждого литерала со словами SQL скобки сбалансированы', () => {
    const dir = new URL('../src/', import.meta.url);
    const bad = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
      for (const s of unclosedSql(readFileSync(new URL(f, dir), 'utf8'))) bad.push(`${f}: ${s}`);
    }
    assert.deepEqual(bad, []);
  });
});

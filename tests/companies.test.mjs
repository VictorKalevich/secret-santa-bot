// Компании, шаг 1 (050, specs/050-company-scope/): данные и права — в пределах компании. Здесь — статические правила по
// src/*.js (права не читаются из общего признака users.is_admin, семьи и прошлые пары — с компанией, у журнала нет
// сферы-нуля) и сценарии двух компаний на «мире».
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { restoreFetch } from './support/world.mjs';
import { stringLiterals } from './support/js-literals.mjs';

after(restoreFetch);

// ---------- статические правила (T020) ----------

const SRC = new URL('../src/', import.meta.url);
const sources = () => readdirSync(SRC).filter((n) => n.endsWith('.js')).map((f) => [f, readFileSync(new URL(f, SRC), 'utf8')]);

// 1. Права — из company_members. Общий признак users.is_admin («админ где-нибудь») пишут только adminFlagStmt и перенос
// (UPDATE users SET is_admin …); читать его в SQL как права нельзя
const READS_USER_ADMIN = [/\busers\s+(?:AS\s+)?(?:\w+\s+)?WHERE\s+(?:\w+\.)?is_admin\b/i, /\bu\.is_admin\b/];
const WRITES_USER_ADMIN = /^\s*UPDATE\s+users\s+SET\s+is_admin\b/i;
const userAdminReads = (src) => stringLiterals(src)
  .filter((s) => READS_USER_ADMIN.some((re) => re.test(s)) && !WRITES_USER_ADMIN.test(s));

// 2. Семьи и прошлые пары — всегда с компанией
function familyProblems(src) {
  const bad = [];
  for (const m of src.matchAll(/\bfamilyRowsQuery\(([^()]*)\)/g)) {
    if (m[1].split(',').filter((a) => a.trim()).length < 2) bad.push(m[0]);
  }
  const def = /familyRowsQuery\s*=\s*\(db, companyId\)[^;]*FROM family_members WHERE company_id = \?/;
  if (/familyRowsQuery\s*=/.test(src) && !def.test(src)) bad.push('familyRowsQuery без company_id');
  const prev = /const previousPairsQuery = [\s\S]*?;\n/.exec(src)?.[0];
  if (prev !== undefined && !/e\.company_id = \?/.test(prev)) bad.push('previousPairsQuery без компании');
  return bad;
}

// 3. Журнал: сфера — событие или { company }; ноль — ошибка (контракт, раздел 6)
const ZERO_SPHERE = /\b(?:audit|auditStmt|auditIfStmt|getAudit)\(\s*(?:db\s*,\s*)?0\s*[,)]/g;
const zeroSpheres = (src) => [...src.matchAll(ZERO_SPHERE)].map((m) => m[0]);

describe('компании: статические правила по src/*.js', () => {
  it('права не читаются из users.is_admin в SQL (кроме записи признака) — и «от противного»', () => {
    const bad = sources().flatMap(([f, src]) => userAdminReads(src).map((s) => `${f}: ${s.trim().slice(0, 80)}`));
    assert.deepEqual(bad, []);
    assert.equal(userAdminReads("const q = db.prepare('SELECT * FROM users WHERE is_admin = 1');").length, 1);
    assert.equal(userAdminReads('const q = `SELECT u.tg_id FROM users u WHERE u.is_admin = 1 AND u.registered = 1`;').length, 1);
    assert.equal(userAdminReads('const q = `SELECT tg_id FROM users u JOIN x ON u.is_admin`;').length, 1);
    assert.equal(userAdminReads("const s = 'UPDATE users SET is_admin = (EXISTS (SELECT 1 FROM company_members)) WHERE tg_id = ?';").length, 0);
    assert.equal(userAdminReads('const ok = users.filter((u) => u.is_admin);').length, 0, 'код JS, не SQL');
  });

  it('семьи и прошлые пары — с компанией — и «от противного»', () => {
    const bad = sources().flatMap(([f, src]) => familyProblems(src).map((s) => `${f}: ${s}`));
    assert.deepEqual(bad, []);
    const all = sources().map(([, s]) => s).join('\n');
    assert.ok(/familyRowsQuery\(db, ev\.company_id\)/.test(all) && /const previousPairsQuery = /.test(all), 'правило что-то проверяет');
    assert.deepEqual(familyProblems('x = familyRowsQuery(db);'), ['familyRowsQuery(db)']);
    assert.deepEqual(familyProblems("export const familyRowsQuery = (db) => db.prepare('SELECT user_id, family_id FROM family_members');"),
      ['familyRowsQuery без company_id']);
    assert.deepEqual(familyProblems('const previousPairsQuery = (db, ev) => db.prepare(`SELECT 1 FROM pairs p JOIN events e WHERE p.event_id != ?`);\n'),
      ['previousPairsQuery без компании']);
  });

  it('у журнала нет сферы-нуля — и «от противного»', () => {
    const bad = sources().flatMap(([f, src]) => zeroSpheres(src).map((s) => `${f}: ${s}`));
    assert.deepEqual(bad, []);
    assert.deepEqual(zeroSpheres("a.audit(0, actor, 'x'); auditStmt(db, 0, 1, 'y'); auditIfStmt(db,0, 1); getAudit(db, 0)"),
      ['audit(0,', 'auditStmt(db, 0,', 'auditIfStmt(db,0,', 'getAudit(db, 0)']);
    assert.deepEqual(zeroSpheres("a.audit({ company: id }, 0, 'x'); auditStmt(db, ev.id, 0, 'y')"), []);
  });
});

// Таблица действий API (019, FR-1909): у каждой строки — роль из списка, текст отказа владельца ровно у действий
// владельца, явное «что в завершённом событии» у действий события, слово подтверждения — парой, обработчик.
// Строка без роли или без поля finished у действия события — ошибка с именем действия.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, ROLES } from '../src/api.js';

const ROLE_SET = new Set(Object.values(ROLES));
const filled = (s) => typeof s === 'string' && s.trim().length > 0;

// Список нарушений одной строки (пусто — строка верна)
function rowProblems(name, row) {
  const p = [];
  const admin = name.startsWith('admin.');
  if (!ROLE_SET.has(row.role)) p.push(`${name}: роль не из списка (${row.role})`);
  else if (admin !== (row.role === ROLES.ADMIN || row.role === ROLES.OWNER)) p.push(`${name}: роль ${row.role} не для ${admin ? 'admin.*' : 'участника'}`);
  if ((row.role === ROLES.OWNER) !== filled(row.owner)) p.push(`${name}: текст отказа владельца — тогда и только тогда, когда роль OWNER`);
  if (row.event !== undefined && row.event !== true && row.event !== 'given') p.push(`${name}: event — true, 'given' или не задано`);
  if (row.event && row.finished !== true && !filled(row.finished)) p.push(`${name}: у действия события не задано, что в завершённом событии`);
  if (row.confirm !== undefined && !(Array.isArray(row.confirm) && row.confirm.length === 2 && row.confirm.every(filled))) {
    p.push(`${name}: confirm — пара «слово, текст отказа»`);
  }
  if (typeof row.run !== 'function') p.push(`${name}: нет обработчика`);
  return p;
}

test('таблица действий: 59 строк (13 участника, 46 admin.*), каждая — по правилам', () => {
  const names = Object.keys(ACTIONS);
  assert.equal(names.length, 59);
  assert.equal(names.filter((a) => a.startsWith('admin.')).length, 46);
  assert.deepEqual(names.flatMap((n) => rowProblems(n, ACTIONS[n])), []);
});

test('таблица действий: действия владельца и слова подтверждения — прежние', () => {
  const owner = Object.keys(ACTIONS).filter((a) => ACTIONS[a].role === ROLES.OWNER).sort();
  assert.deepEqual(owner, [
    'admin.draw.cancel.force', 'admin.event.delete', 'admin.fixed.add', 'admin.fixed.del', 'admin.insert', 'admin.owner.transfer',
    'admin.reset.full', 'admin.role.grant', 'admin.role.revoke', 'admin.transfer', 'admin.vault.pairs', 'admin.vault.person',
  ]);
  const words = Object.fromEntries(Object.entries(ACTIONS).filter(([, r]) => r.confirm).map(([a, r]) => [a, r.confirm[0]]));
  assert.deepEqual(words, { 'admin.draw.cancel.force': 'ОТМЕНА', 'admin.event.delete': 'УДАЛИТЬ', 'admin.reset.full': 'СБРОС' });
});

test('таблица действий: «от противного» — строка без роли, без finished, с владельцем без текста — ошибки с именем', () => {
  const row = ACTIONS['admin.game'];
  assert.match(rowProblems('admin.x', { ...row, role: undefined }).join('\n'), /^admin\.x: роль не из списка/);
  assert.match(rowProblems('admin.x', { ...row, finished: undefined }).join('\n'), /admin\.x: у действия события не задано/);
  assert.match(rowProblems('admin.x', { ...row, role: ROLES.OWNER }).join('\n'), /admin\.x: текст отказа владельца/);
  assert.match(rowProblems('admin.x', { ...row, confirm: ['СЛОВО'] }).join('\n'), /admin\.x: confirm/);
  assert.match(rowProblems('ward.x', { ...row }).join('\n'), /ward\.x: роль admin не для участника/);
  assert.match(rowProblems('admin.x', { ...row, run: undefined }).join('\n'), /admin\.x: нет обработчика/);
});

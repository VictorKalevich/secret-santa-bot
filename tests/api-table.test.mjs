// Таблица действий API (019, FR-1909; 063 — без комнат): у каждой строки — роль из списка, текст отказа владельца ровно у действий
// владельца, явное «что в завершённом событии» у действий события, слово подтверждения — парой, обработчик.
// Строка без роли или без поля finished у действия события — ошибка с именем действия.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, ROLES } from '../src/api.js';
import { t, DEFAULT_LANG } from '../src/i18n/index.js';

const ROLE_SET = new Set(Object.values(ROLES));
const filled = (s) => typeof s === 'string' && s.trim().length > 0;

// Список нарушений одной строки (пусто — строка верна)
function rowProblems(name, row) {
  const p = [];
  const admin = name.startsWith('admin.');
  const bot = name.startsWith('bot.');
  if (!ROLE_SET.has(row.role)) p.push(`${name}: роль не из списка (${row.role})`);
  else if (admin !== (row.role === ROLES.ADMIN || row.role === ROLES.OWNER)) p.push(`${name}: роль ${row.role} не для ${admin ? 'admin.*' : 'участника'}`);
  // 051: действия владельца бота — bot.* с ролью BOT, без события
  if (bot !== (row.role === ROLES.BOT)) p.push(`${name}: роль BOT — тогда и только тогда, когда имя bot.*`);
  if (bot && row.event !== undefined) p.push(`${name}: bot.* — без события`);
  // Признак bot у admin.* — «только владелец бота» после проверки владельца (admin.transfer, admin.rename)
  if (row.bot !== undefined && !(row.bot === true && row.role === ROLES.OWNER)) p.push(`${name}: bot — только true и только у роли OWNER`);
  if ((row.role === ROLES.OWNER) !== filled(row.owner)) p.push(`${name}: текст отказа владельца — тогда и только тогда, когда роль OWNER`);
  if (row.event !== undefined && row.event !== true && row.event !== 'given') p.push(`${name}: event — true, 'given' или не задано`);
  if (row.event && row.finished !== true && !filled(row.finished)) p.push(`${name}: у действия события не задано, что в завершённом событии`);
  if (row.confirm !== undefined && !(Array.isArray(row.confirm) && row.confirm.length === 2 && row.confirm.every(filled))) {
    p.push(`${name}: confirm — пара «слово, текст отказа»`);
  }
  if (typeof row.run !== 'function') p.push(`${name}: нет обработчика`);
  // 063: admin.* — над событием; без события — только действие владельца бота (признак bot); комнат (company) нет
  if (admin && row.event !== true && row.bot !== true) p.push(`${name}: admin.* без event: true — только с bot: true`);
  if (row.company !== undefined) p.push(`${name}: company — комнат нет (063)`);
  return p;
}

test('таблица действий: 64 строки (17 действий участника, 42 admin.*, 5 bot.*), каждая — по правилам (064)', () => {
  const names = Object.keys(ACTIONS);
  assert.equal(names.length, 64);
  assert.equal(names.filter((a) => a.startsWith('admin.')).length, 42);
  assert.deepEqual(names.filter((a) => a.startsWith('bot.')).sort(), ['bot.audit', 'bot.creator.set', 'bot.events', 'bot.owner.transfer', 'bot.people']);
  assert.deepEqual(names.flatMap((n) => rowProblems(n, ACTIONS[n])), []);
});

test('таблица действий: действия владельца и слова подтверждения — прежние', () => {
  const owner = Object.keys(ACTIONS).filter((a) => ACTIONS[a].role === ROLES.OWNER).sort();
  assert.deepEqual(owner, [
    'admin.draw.cancel.force', 'admin.draw.swap', 'admin.draw.swap.check', 'admin.event.delete', 'admin.fixed.add', 'admin.fixed.del', 'admin.insert', 'admin.owner.transfer',
    'admin.rename', 'admin.reset.full', 'admin.role.grant', 'admin.role.revoke', 'admin.transfer', 'admin.vault.pairs', 'admin.vault.person',
  ]);
  const words = Object.fromEntries(Object.entries(ACTIONS).filter(([, r]) => r.confirm).map(([a, r]) => [a, t(DEFAULT_LANG, r.confirm[0])]));
  // 025: служебный просмотр — слово ОТКРЫТЬ проверяет и сервер; 035: выход из события — ВЫЙТИ
  assert.deepEqual(words, {
    'event.leave': 'ВЫЙТИ', 'admin.draw.cancel.force': 'ОТМЕНА', 'admin.event.delete': 'УДАЛИТЬ', 'admin.vault.person': 'ОТКРЫТЬ',
    'admin.vault.pairs': 'ОТКРЫТЬ', 'admin.reset.full': 'СБРОС',
  });
});

test('таблица действий: «от противного» — строка без роли, без finished, с владельцем без текста — ошибки с именем', () => {
  const row = ACTIONS['admin.game'];
  assert.match(rowProblems('admin.x', { ...row, role: undefined }).join('\n'), /^admin\.x: роль не из списка/);
  assert.match(rowProblems('admin.x', { ...row, finished: undefined }).join('\n'), /admin\.x: у действия события не задано/);
  assert.match(rowProblems('admin.x', { ...row, role: ROLES.OWNER }).join('\n'), /admin\.x: текст отказа владельца/);
  assert.match(rowProblems('admin.x', { ...row, confirm: ['СЛОВО'] }).join('\n'), /admin\.x: confirm/);
  assert.match(rowProblems('ward.x', { ...row }).join('\n'), /ward\.x: роль admin не для участника/);
  assert.match(rowProblems('admin.x', { ...row, run: undefined }).join('\n'), /admin\.x: нет обработчика/);
  const botOnly = ACTIONS['admin.rename'];
  assert.match(rowProblems('admin.x', { ...botOnly, bot: undefined }).join('\n'), /admin\.x: admin\.\* без event: true — только с bot/);
  assert.match(rowProblems('admin.x', { ...row, company: true }).join('\n'), /admin\.x: company — комнат нет/);
  assert.match(rowProblems('ward.x', { ...ACTIONS['ward.get'], company: true }).join('\n'), /ward\.x: company — комнат нет/);
  // 051: роль BOT — только у bot.*, bot.* — без события; признак bot — только у OWNER
  assert.match(rowProblems('bot.x', { ...ACTIONS.me }).join('\n'), /bot\.x: роль BOT — тогда и только тогда/);
  assert.match(rowProblems('me.x', { ...ACTIONS.me, role: ROLES.BOT }).join('\n'), /me\.x: роль BOT — тогда и только тогда/);
  assert.match(rowProblems('bot.x', { ...ACTIONS.me, role: ROLES.BOT, event: true, finished: true }).join('\n'), /bot\.x: bot\.\* — без события/);
  assert.match(rowProblems('admin.x', { ...row, bot: true }).join('\n'), /admin\.x: bot — только true и только у роли OWNER/);
  assert.deepEqual(rowProblems('admin.transfer', ACTIONS['admin.transfer']), []);
  assert.deepEqual(rowProblems('admin.rename', ACTIONS['admin.rename']), []);
});

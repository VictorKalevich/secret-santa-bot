// 063 (specs/063-events-without-rooms/, контракт — contracts/events-without-rooms.md): события без комнат — главный экран
// (me.events: свои события и роль в каждом), владелец и администраторы события (назначение, снятие, передача владения,
// права только в своём событии), прежняя ссылка владельца комнаты own_ прав не даёт, и статические правила по src/*.js
// вместо правил компаний 050–052. После каждого сценария — инварианты E1–E4 (tests/support/events.mjs).
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { stringLiterals } from './support/js-literals.mjs';
import { newEvent, inviteCode, join, grant, allowCreate, invariants } from './support/events.mjs';

after(restoreFetch);

const boss = { id: 9301, name: 'Владелец', username: 'boss' };
const anya = { id: 9302, name: 'Аня', username: 'anya' };
const bora = { id: 9303, name: 'Боря', username: 'bora' };
const vera = { id: 9304, name: 'Вера', username: 'vera' };
const gena = { id: 9305, name: 'Гена', username: 'gena' };

const NO_EVENT = 'Событие не найдено.';
const ADMIN_ONLY = 'Только для администратора.';

// Закрытый бот: владелец бота boss; событие A — у boss (Аня, Боря, Вера — участники, Боря — администратор), событие B —
// у Веры (ей разрешено создавать; Гена — участник)
async function world() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const A = await newEvent(w, boss, 'Семья');
  const codeA = await inviteCode(w, boss, A);
  for (const u of [anya, bora, vera]) await join(w, u, codeA);
  await grant(w, boss, A, bora);
  await allowCreate(w, boss, vera);
  const B = await newEvent(w, vera, 'Работа', { participate: true });
  await join(w, gena, await inviteCode(w, vera, B));
  return { w, A, B };
}
const refusal = async (w, u, action, body) => {
  const r = await w.api(u, action, body, true);
  return r.data.ok ? 'ok' : `${r.status} ${r.data.error}`;
};
const roles = async (w, u) => Object.fromEntries((await w.api(u, 'me')).events.map((e) => [e.id, [e.role, e.member]]));
const auditOf = (w, id, action) => w.query('SELECT details FROM audit WHERE event_id = ? AND action = ? ORDER BY id', id, action).map((r) => r.details);

describe('главный экран: мои события и роли (US1, T029)', () => {
  it('участник, администратор, владелец события, владелец бота — только свои события и роль в каждом', async () => {
    const { w, A, B } = await world();
    assert.deepEqual(await roles(w, anya), { [A]: ['member', true] });
    assert.deepEqual(await roles(w, bora), { [A]: ['admin', true] });
    assert.deepEqual(await roles(w, vera), { [A]: ['member', true], [B]: ['owner', true] });
    assert.deepEqual(await roles(w, gena), { [B]: ['member', true] });
    // Владелец бота на главном экране — только свои события (решение владельца 1а); чужие — «Все события»
    assert.deepEqual(await roles(w, boss), { [A]: ['owner', false] });
    const all = await w.api(boss, 'bot.events');
    assert.deepEqual(all.events.map((e) => [e.title, e.owner_name, e.people]), [['Работа', 'Вера', 2], ['Семья', 'Владелец', 3]]);
    for (const u of [boss, anya, bora, vera, gena]) {
      const me = await w.api(u, 'me');
      assert.ok(!('companies' in me) && me.events.every((e) => !('company' in e)), 'без комнат: ' + u.name);
    }
    assert.equal((await w.api(boss, 'me')).me.is_owner, true);
    assert.equal((await w.api(vera, 'me')).me.is_owner, false);
    assert.deepEqual(invariants(w), []);
  });

  it('владелец бота в чужом событии — гость: роль guest, в списках и среди организаторов его нет', async () => {
    const { w, B } = await world();
    const g = await w.api(boss, 'event.get', { event: B });
    assert.equal(g.event.role, 'guest');
    assert.equal(g.event.bot_run, false);
    assert.ok(!g.roster.people.some((u) => u.name === boss.name));
    const st = await w.api(boss, 'admin.state', { event: B });
    assert.deepEqual(st.organizers.map((u) => [u.name, u.owner]), [['Вера', true]]);
    assert.equal(st.me_member, false);
    assert.deepEqual(await roles(w, boss), { [Object.keys(await roles(w, boss))[0]]: ['owner', false] }, 'событие B не появилось');
  });
});

describe('владелец и администраторы события (US3, T041)', () => {
  it('организатор события A не видит событие B (404), участник B без прав — 403; права только в своём событии', async () => {
    const { w, A, B } = await world();
    assert.equal(await refusal(w, bora, 'admin.state', { event: B }), '404 ' + NO_EVENT);
    assert.equal(await refusal(w, bora, 'admin.audit', { event: B }), '404 ' + NO_EVENT);
    assert.equal(await refusal(w, gena, 'admin.state', { event: B }), '403 ' + ADMIN_ONLY);
    assert.equal(await refusal(w, bora, 'admin.state', { event: A }), 'ok');
    // Вера — владелец B и участница A: в A прав нет
    assert.equal(await refusal(w, vera, 'admin.state', { event: A }), '403 ' + ADMIN_ONLY);
    assert.equal(await refusal(w, vera, 'admin.role.grant', { event: A, id: anya.id }), '403 ' + ADMIN_ONLY);
    // Администратор назначать не может
    assert.equal(await refusal(w, bora, 'admin.role.grant', { event: A, id: anya.id }), '403 Назначать и снимать администраторов может только владелец.');
  });

  it('назначение — только участника; повтор — отказ; сообщения, журнал события', async () => {
    const { w, A, B } = await world();
    assert.equal(await refusal(w, boss, 'admin.role.grant', { event: A, id: gena.id }), '400 Назначить можно только участника события.');
    assert.equal(await refusal(w, boss, 'admin.role.grant', { event: A, id: bora.id }), '400 Он(а) уже администратор.');
    const before = w.texts(anya).length;
    await w.api(boss, 'admin.role.grant', { event: A, id: anya.id });
    assert.match(w.texts(anya).slice(before).join('\n'), /Тебя назначили администратором события/);
    assert.match(w.lastText(bora), /Аня<\/b> теперь администратор события/);
    assert.deepEqual(auditOf(w, A, 'role.grant'), ['Боря', 'Аня']);
    assert.deepEqual(await roles(w, anya), { [A]: ['admin', true] });
    assert.equal(await refusal(w, anya, 'admin.state', { event: B }), '404 ' + NO_EVENT);
    assert.deepEqual(invariants(w), []);
  });

  it('снятие: не владельца; обращения, которые он вёл, — снова ничьи; событие пропадает у снятого неучастника', async () => {
    const { w, A } = await world();
    assert.equal(await refusal(w, boss, 'admin.role.revoke', { event: A, id: boss.id }), '400 Нельзя снять права владельца. Сначала передай владение событием.');
    assert.equal(await refusal(w, boss, 'admin.role.revoke', { event: A, id: anya.id }), '400 Он(а) не администратор.');
    const id = (await w.api(anya, 'support.send', { event: A, text: 'Помогите' })).thread;
    await w.api(bora, 'admin.support.take', { event: A, thread: id });
    assert.equal(w.query('SELECT assignee FROM support_threads WHERE id = ?', id)[0].assignee, bora.id);
    await w.api(boss, 'admin.role.revoke', { event: A, id: bora.id });
    assert.equal(w.query('SELECT assignee FROM support_threads WHERE id = ?', id)[0].assignee, 0);
    assert.deepEqual(auditOf(w, A, 'role.revoke'), ['Боря']);
    assert.match(w.lastText(bora), /сняли права администратора события/);
    assert.deepEqual(await roles(w, bora), { [A]: ['member', true] });
    // Организатор-неучастник после снятия событие не видит
    await w.api(boss, 'admin.role.grant', { event: A, id: vera.id });
    await w.api(vera, 'admin.participate', { event: A, on: false });
    assert.equal((await roles(w, vera))[A]?.[0], 'admin');
    await w.api(boss, 'admin.role.revoke', { event: A, id: vera.id });
    assert.equal((await roles(w, vera))[A], undefined);
    assert.deepEqual(invariants(w), []);
  });

  it('передача владения: роли, сообщения, журнал; прежний владелец — администратор; повтор — отказ', async () => {
    const { w, A } = await world();
    assert.equal(await refusal(w, boss, 'admin.owner.transfer', { event: A, id: gena.id }), '400 Передать владение можно только участнику или администратору события.');
    assert.equal(await refusal(w, boss, 'admin.owner.transfer', { event: A, id: boss.id }), '400 Ты и так владелец.');
    assert.equal(await refusal(w, bora, 'admin.owner.transfer', { event: A, id: anya.id }), '403 Передать владение событием может только владелец.');
    await w.api(boss, 'admin.owner.transfer', { event: A, id: anya.id });
    assert.match(w.lastText(anya), /Ты теперь владелец события/);
    assert.deepEqual(auditOf(w, A, 'event.owner'), ['→ Аня']);
    assert.deepEqual(await roles(w, anya), { [A]: ['owner', true] });
    assert.deepEqual(await roles(w, boss), { [A]: ['admin', false] });
    assert.equal(await refusal(w, anya, 'admin.owner.transfer', { event: A, id: anya.id }), '400 Ты и так владелец.');
    // Новый владелец назначает; администратор (Боря) — нет
    assert.equal(await refusal(w, anya, 'admin.role.grant', { event: A, id: vera.id }), 'ok');
    // Владелец бота сохраняет права владельца в любом событии
    await w.api(boss, 'admin.owner.transfer', { event: A, id: bora.id });
    assert.match(w.lastText(anya), /Владение событием .* перешло к/);
    assert.deepEqual(await roles(w, anya), { [A]: ['admin', true] });
    assert.deepEqual(invariants(w), []);
  });

  it('переименование — только владелец бота: владелец события — 403', async () => {
    const { w, B } = await world();
    assert.equal(await refusal(w, vera, 'admin.rename', { id: gena.id, name: 'Геннадий' }), '403 Переименовать человека может только владелец бота.');
    await w.api(boss, 'admin.rename', { id: gena.id, name: 'Геннадий' });
    assert.equal((await w.api(vera, 'admin.state', { event: B })).users.find((u) => u.id === gena.id).name, 'Геннадий');
    assert.deepEqual(w.query("SELECT details FROM audit WHERE event_id = 0 AND action = 'rename'").map((r) => r.details), ['Гена → Геннадий']);
  });
});

describe('журналы (US8, T063)', () => {
  it('роли и владение — в журнале события; своё имя журналы не пишет; журнал без события — 404', async () => {
    const { w, A } = await world();
    await w.api(boss, 'admin.role.grant', { event: A, id: anya.id });
    await w.api(boss, 'admin.role.revoke', { event: A, id: anya.id });
    await w.api(boss, 'admin.owner.transfer', { event: A, id: bora.id });
    const codes = (await w.api(bora, 'admin.audit', { event: A })).entries.map((e) => e.action);
    assert.deepEqual(codes.filter((c) => /^(role|event\.owner)/.test(c)), ['event.owner', 'role.revoke', 'role.grant', 'role.grant']);
    const n = w.query('SELECT COUNT(*) AS n FROM audit')[0].n;
    await w.api(anya, 'name.set', { name: 'Анна' });
    assert.equal(w.query('SELECT COUNT(*) AS n FROM audit')[0].n, n);
    assert.equal(await refusal(w, bora, 'admin.audit', {}), '404 ' + NO_EVENT);
    assert.equal(await refusal(w, boss, 'admin.audit', {}), '404 ' + NO_EVENT);
  });
});

describe('прежняя ссылка владельца комнаты own_ (US4, T048)', () => {
  it('знакомому — «ссылка больше не действует» и меню, без прав', async () => {
    const { w, B } = await world();
    await w.say(gena, '/start own_0123456789abcdef');
    assert.match(w.texts(gena).slice(-2).join('\n'), /Эта ссылка больше не действует/);
    assert.equal(w.query('SELECT is_admin FROM users WHERE tg_id = ?', gena.id)[0].is_admin, 0);
    assert.deepEqual(await roles(w, gena), { [B]: ['member', true] });
  });

  it('незнакомцу открытого бота — просьба имени, после имени — регистрация без прав и тот же текст', async () => {
    const w = await startWorld({ open: true });
    const s = await w.setup();
    await w.say(boss, '/start ' + s.adminCode);
    await w.say(boss, boss.name);
    await w.say(anya, '/start own_0123456789abcdef');
    assert.ok(!/больше не действует/.test(w.lastText(anya)), 'сначала — просьба имени');
    await w.say(anya, anya.name);
    assert.match(w.texts(anya).join('\n'), /Эта ссылка больше не действует/);
    const me = await w.api(anya, 'me');
    assert.equal(me.me.is_admin, false);
    assert.deepEqual(me.events, []);
    assert.deepEqual(invariants(w), []);
  });
});

// ---------- статические правила по src/*.js (T044; вместо правил компаний 050–052) ----------

const SRC = new URL('../src/', import.meta.url);
const sources = () => readdirSync(SRC).filter((n) => n.endsWith('.js')).map((f) => [f, readFileSync(new URL(f, SRC), 'utf8')]);

// 1. Права — строки event_admins и owner_id события. Общий признак users.is_admin пишут adminFlagStmt и перенос (UPDATE
// users SET is_admin …); читать его в SQL как права нельзя
const READS_USER_ADMIN = [/\busers\s+(?:AS\s+)?(?:\w+\s+)?WHERE\s+(?:\w+\.)?is_admin\b/i, /\bu\.is_admin\b/];
const WRITES_USER_ADMIN = /^\s*UPDATE\s+users\s+SET\s+is_admin\b/i;
const userAdminReads = (src) => stringLiterals(src).filter((s) => READS_USER_ADMIN.some((re) => re.test(s)) && !WRITES_USER_ADMIN.test(s));

// 2. Таблиц комнат код не читает и не пишет: остались ради отката на 062, их знает только REGISTRY (перенос участия)
const ROOM_TABLE = /\b(?:FROM|JOIN|INTO|UPDATE)\s+compan(?:ies|y_members)\b/i;
const ROOM_ALLOWED = [['db.js', /^\s*UPDATE company_members SET is_admin = MAX\(is_admin/]];
const roomTables = (f, src) => stringLiterals(src)
  .filter((s) => ROOM_TABLE.test(s) && !ROOM_ALLOWED.some(([file, re]) => file === f && re.test(s)));

// 3. Прошлые пары — того же владельца (R7); строк семей сервер не читает (062)
const FAMILY_TABLE = /\b(?:FROM|JOIN)\s+famil(?:ies|y_members)\b/i;
function pairsProblems(src) {
  const bad = stringLiterals(src).filter((s) => FAMILY_TABLE.test(s)).map((s) => 'строки семей: ' + s.trim().slice(0, 40));
  const prev = /const previousPairsQuery = [\s\S]*?;\n/.exec(src)?.[0];
  if (prev !== undefined && !/e\.owner_id = \?/.test(prev)) bad.push('previousPairsQuery не по владельцу');
  return bad;
}

// 4. Журнал: сфера — событие или BOT_LOG; ноль — ошибка
const ZERO_SPHERE = /\b(?:audit|auditStmt|auditIfStmt|getAudit)\(\s*(?:db\s*,\s*)?0\s*[,)]/g;
const zeroSpheres = (src) => [...src.matchAll(ZERO_SPHERE)].map((m) => m[0]);

describe('статические правила по src/*.js (T044)', () => {
  it('права не читаются из users.is_admin в SQL — и «от противного»', () => {
    assert.deepEqual(sources().flatMap(([f, src]) => userAdminReads(src).map((s) => `${f}: ${s.trim().slice(0, 80)}`)), []);
    assert.equal(userAdminReads("const q = db.prepare('SELECT * FROM users WHERE is_admin = 1');").length, 1);
    assert.equal(userAdminReads('const q = `SELECT u.tg_id FROM users u WHERE u.is_admin = 1`;').length, 1);
    assert.equal(userAdminReads("const s = 'UPDATE users SET is_admin = (EXISTS (SELECT 1 FROM event_admins)) WHERE tg_id = ?';").length, 0);
    assert.equal(userAdminReads('const ok = users.filter((u) => u.is_admin);').length, 0, 'код JS, не SQL');
  });

  it('таблиц комнат код не касается (кроме переноса в REGISTRY) — и «от противного»', () => {
    assert.deepEqual(sources().flatMap(([f, src]) => roomTables(f, src).map((s) => `${f}: ${s.trim().slice(0, 80)}`)), []);
    assert.equal(roomTables('events.js', "const q = db.prepare('SELECT owner_id FROM companies WHERE id = ?');").length, 1);
    assert.equal(roomTables('roles.js', 'const q = `INSERT INTO company_members (company_id, user_id) VALUES (?, ?)`;').length, 1);
    assert.equal(roomTables('roles.js', 'const s = `UPDATE company_members SET is_admin = MAX(is_admin, 1)`;').length, 1, 'разрешено только в db.js');
  });

  it('прошлые пары — по владельцу события, семьи не читаются — и «от противного»', () => {
    assert.deepEqual(sources().flatMap(([f, src]) => pairsProblems(src).map((s) => `${f}: ${s}`)), []);
    assert.ok(sources().some(([, s]) => /const previousPairsQuery = /.test(s)), 'правило что-то проверяет');
    assert.deepEqual(pairsProblems('const previousPairsQuery = (db, ev) => db.prepare(`SELECT 1 FROM pairs p JOIN events e WHERE e.company_id = ?`);\n'),
      ['previousPairsQuery не по владельцу']);
    assert.equal(pairsProblems("const q = db.prepare('SELECT user_id FROM family_members');").length, 1);
  });

  it('журнал без сферы-нуля — и «от противного»', () => {
    assert.deepEqual(sources().flatMap(([f, src]) => zeroSpheres(src).map((s) => `${f}: ${s}`)), []);
    assert.deepEqual(zeroSpheres("a.audit(0, me, 'x');\nauditStmt(db, 0, me, 'y')"), ['audit(0,', 'auditStmt(db, 0,']);
  });
});

// Компании, шаг 1 (050, specs/050-company-scope/): данные и права — в пределах компании. Здесь — статические правила по
// src/*.js (права не читаются из общего признака users.is_admin, прошлые пары — с компанией, строки семей сервер не
// читает (062), у журнала нет сферы-нуля) и сценарии двух компаний на «мире».
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { stringLiterals } from './support/js-literals.mjs';
import { addCompany, invariants } from './support/companies.mjs';
import { ACTIONS } from '../src/api.js';

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

// 2. Прошлые пары — всегда с компанией; строк семей сервер не читает (062: семьи стали исключениями событий, таблицы
// остались ради отката — их знает только REGISTRY)
const FAMILY_TABLE = /\b(?:FROM|JOIN)\s+famil(?:ies|y_members)\b/i;
function familyProblems(src) {
  const bad = [];
  for (const lit of stringLiterals(src)) if (FAMILY_TABLE.test(lit)) bad.push('строки семей: ' + lit.trim().slice(0, 40));
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

  it('прошлые пары — с компанией, семьи не читаются — и «от противного»', () => {
    const bad = sources().flatMap(([f, src]) => familyProblems(src).map((s) => `${f}: ${s}`));
    assert.deepEqual(bad, []);
    const all = sources().map(([, s]) => s).join('\n');
    assert.ok(/const previousPairsQuery = /.test(all), 'правило что-то проверяет');
    assert.deepEqual(familyProblems("const q = (db, c) => db.prepare('SELECT user_id, family_id FROM family_members WHERE company_id = ?');"),
      ['строки семей: SELECT user_id, family_id FROM family_me']);
    assert.equal(familyProblems('const q = `SELECT f.name FROM events e JOIN families f ON f.company_id = e.company_id`;').length, 1);
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

// ---------- две компании (T022–T031, T033) ----------

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const person = (id, name) => ({ id, name, username: 'u' + id });
// Компании А (№1) и Б: по два администратора и четыре участника; новички — для вступлений
const SIDES = {
  A: {
    title: 'А', adm: person(9101, 'Альфа-админ'), adm2: person(9102, 'Альфа-второй'),
    people: ['Аня', 'Алла', 'Арина', 'Алиса'].map((n, i) => person(1101 + i, n)),
    fresh: ['Агата', 'Ада', 'Аза'].map((n, i) => person(1191 + i, n)),
  },
  B: {
    title: 'Б', adm: person(9201, 'Бета-админ'), adm2: person(9202, 'Бета-второй'),
    people: ['Борис', 'Белла', 'Богдан', 'Божена'].map((n, i) => person(1201 + i, n)),
    fresh: ['Бажен', 'Берта', 'Бэла'].map((n, i) => person(1291 + i, n)),
  },
};
const everyone = (s) => [s.adm, s.adm2, ...s.people, ...s.fresh];
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];
const NO_EVENT = 'Событие не найдено.';
const ADMIN_ONLY = 'Только для администратора.';
const ADMIN = Object.keys(ACTIONS).filter((a) => a.startsWith('admin.'));
// Минимальное тело, как в тесте rights: без слов подтверждения и без людей
const body = (event) => ({ event, id: 0, from: 0, to: 0, giver: 0, receiver: 0 });
const byNumber = (a, b) => a - b;

// Мир: компании А (№1) и Б. Владелец бота — администратор А и гость Б (строки в Б нет, R15). Всё — настоящими
// действиями: владелец бота создаёт события с { company }, люди входят по ссылке, админы назначаются с { company }.
async function twoCompanies() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const z = { w, guests: [addCompany(w, 'Б')] };
  z.join = async (ev, people) => {
    const code = inviteOf(await w.api(boss, 'admin.state', { event: ev }));
    for (const u of people) {
      const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
      await w.say(u, '/start ' + code);
      if (!known) await w.say(u, u.name);
    }
  };
  z.event = async (company, title, people = []) => {
    const id = (await w.api(boss, 'event.create', { participate: false, title, company })).event.id;
    await z.join(id, people);
    return id;
  };
  for (const [key, company] of [['A', 1], ['B', z.guests[0]]]) {
    const side = SIDES[key];
    z[key] = { ...side, company, ev: await z.event(company, 'Событие ' + side.title, [side.adm, side.adm2, ...side.people]) };
    for (const u of [side.adm, side.adm2]) await w.api(boss, 'admin.role.grant', { company, id: u.id });
  }
  z.A.other = z.B;
  z.B.other = z.A;
  // Снимок базы: число строк каждой таблицы
  z.counts = () => Object.fromEntries(
    w.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .map(({ name }) => [name, w.query(`SELECT COUNT(*) AS n FROM "${name}"`)[0].n])
  );
  // Кому ушли сообщения за время fn
  z.during = async (fn) => {
    const t0 = w.calls.length;
    await fn();
    return new Set(w.calls.slice(t0).filter((c) => c.method === 'sendMessage').map((c) => c.params.chat_id));
  };
  z.answers = (t0) => w.calls.slice(t0).filter((c) => c.method === 'answerCallbackQuery').map((c) => c.params.text);
  z.invariants = () => invariants(w, { guests: z.guests });
  return z;
}

describe('компании: мир из двух компаний (T022)', () => {
  it('в каждой — свои администраторы, участники и событие; инварианты держатся', async () => {
    const z = await twoCompanies();
    for (const s of [z.A, z.B]) {
      const rows = z.w.query('SELECT user_id, is_admin FROM company_members WHERE company_id = ? ORDER BY user_id', s.company);
      const expected = [s.adm, s.adm2, ...s.people].map((u) => u.id);
      if (s === z.A) expected.push(boss.id); // владелец бота — администратор «Основной» (I2); в Б он гость
      assert.deepEqual(rows.map((r) => r.user_id), expected.sort(byNumber));
      assert.deepEqual(rows.filter((r) => r.is_admin).map((r) => r.user_id).sort(byNumber),
        [s.adm.id, s.adm2.id, ...(s === z.A ? [boss.id] : [])].sort(byNumber));
      assert.equal(z.w.query('SELECT company_id FROM events WHERE id = ?', s.ev)[0].company_id, s.company);
    }
    assert.deepEqual(z.invariants(), []);
    assert.ok(invariants(z.w).some((v) => v.startsWith('I2:')), '«от противного»: без guests гость Б нарушает I2');
  });
});

describe('компании: две компании не видят друг друга (US2)', () => {
  let z;
  let dual;
  before(async () => {
    z = await twoCompanies();
    // Человек с двумя компаниями: администратор А и участник события Б
    dual = person(9301, 'Двойной');
    await z.join(z.A.ev, [dual]);
    await z.w.api(boss, 'admin.role.grant', { company: z.A.company, id: dual.id });
    await z.join(z.B.ev, [dual]);
  });

  it('T023: admin.* над чужим событием — 404 «Событие не найдено.», общее действие чужой компании — 403; база прежняя', async () => {
    const before = z.counts();
    const wrong = [];
    for (const [me, other] of [[z.A, z.B], [z.B, z.A]]) {
      for (const a of ADMIN) {
        if (ACTIONS[a].event) {
          const r = await z.w.api(me.adm, a, body(other.ev), true);
          if (r.status !== 404 || r.data.error !== NO_EVENT) wrong.push(`${me.title} ${a}: ${r.status} ${r.data.error}`);
        }
        if (ACTIONS[a].company) {
          const r = await z.w.api(me.adm, a, { ...body(undefined), company: other.company }, true);
          if (r.status !== 403 || r.data.error !== ADMIN_ONLY) wrong.push(`${me.title} ${a} (company): ${r.status} ${r.data.error}`);
        }
      }
    }
    assert.deepEqual(wrong, []);
    assert.deepEqual(z.counts(), before);
  });

  it('T023: без company у человека с двумя компаниями — 400 «Выбери комнату.»; участник чужого события — прежнее 403', async () => {
    for (const u of [dual, boss]) {
      const r = await z.w.api(u, 'admin.users', {}, true);
      assert.equal(r.status, 400, u.name);
      assert.equal(r.data.error, 'Выбери комнату.');
    }
    assert.ok((await z.w.api(dual, 'admin.users', { company: z.A.company })).users.some((u) => u.id === dual.id));
    const notOrganizer = await z.w.api(dual, 'admin.users', { company: z.B.company }, true);
    assert.deepEqual([notOrganizer.status, notOrganizer.data.error], [403, ADMIN_ONLY]);
    assert.ok((await z.w.api(z.A.adm, 'admin.users')).users.some((u) => u.id === z.A.adm.id), 'одна компания — она');
    const r = await z.w.api(z.A.people[0], 'event.get', { event: z.B.ev }, true);
    assert.deepEqual([r.status, r.data.error], [403, 'Ты не участвуешь в этом событии.']);
  });

  it('T024: списки — ни события, ни человека, ни записи чужой компании', async () => {
    for (const s of [z.A, z.B]) {
      s.ev2 = await z.event(s.company, 'Второе ' + s.title, [s.people[0], s.people[1]]);
    }
    for (const s of [z.A, z.B]) {
      const o = s.other;
      // Имена людей и событий другой компании (двойной человек и владелец бота есть в обеих)
      const foreign = [...everyone(o).map((u) => u.name), 'Событие ' + o.title, 'Второе ' + o.title];
      const leaks = (what, data) => {
        const text = JSON.stringify(data);
        assert.deepEqual(foreign.filter((n) => text.includes(n)), [], what);
      };
      const me = await z.w.api(s.adm, 'me');
      assert.deepEqual(me.events.map((e) => e.id).sort(byNumber), [s.ev, s.ev2].sort(byNumber), 'me: все события своей компании');
      leaks('me', me);
      assert.deepEqual((await z.w.api(s.people[2], 'me')).events.map((e) => e.id), [s.ev], 'me участника');
      const st = await z.w.api(s.adm, 'admin.state', { event: s.ev });
      assert.deepEqual(st.other_events.map((e) => e.id), [s.ev2]);
      assert.ok(!('families' in st), 'семей нет (062)');
      leaks('admin.state', st);
      const users = await z.w.api(s.adm, 'admin.users', { company: s.company });
      leaks('admin.users', users);
      assert.ok(users.users.some((u) => u.id === s.people[3].id));
      const audit = await z.w.api(s.adm, 'admin.audit', { company: s.company });
      assert.ok(audit.entries.some((e) => e.action === 'role.grant' && e.details === s.adm.name), 'свои записи есть');
      leaks('admin.audit', audit);
      const template = await z.w.api(s.adm, 'event.create', { participate: false, title: 'По чужому образцу', from: o.ev, company: s.company }, true);
      assert.deepEqual([template.status, template.data.error], [400, 'Образец не найден.']);
      const invite = await z.w.api(s.adm, 'admin.event.invite_from', { event: s.ev, from: o.ev }, true);
      assert.deepEqual([invite.status, invite.data.error], [400, 'Выбери другое событие.']);
    }
    // Владельцу бота — события всех компаний
    const all = (await z.w.api(boss, 'me')).events.map((e) => e.id);
    for (const id of [z.A.ev, z.A.ev2, z.B.ev, z.B.ev2]) assert.ok(all.includes(id));
    assert.deepEqual(z.invariants(), []);
  });
});

// Получатели сообщений организаторам: только своя компания; в Б владелец бота — гость и рассылок не получает
async function organizerFlow(z, s) {
  const { w } = z;
  const foreign = new Set(everyone(s.other).map((u) => u.id));
  const guest = s.company !== 1;
  const check = async (what, fn, to) => {
    const rec = await z.during(fn);
    assert.deepEqual([...rec].filter((id) => foreign.has(id)), [], `${what}: сообщение человеку другой компании`);
    for (const u of to) assert.ok(rec.has(u.id), `${what}: нет сообщения «${u.name}»`);
    if (guest) assert.ok(!rec.has(boss.id), `${what}: гостю — рассылка организаторам`);
  };
  const [n1, n2] = s.fresh;
  const code = inviteOf(await w.api(s.adm, 'admin.state', { event: s.ev }));
  await check('вступление', async () => { await w.say(n1, '/start ' + code); await w.say(n1, n1.name); }, [s.adm, s.adm2]);
  await w.api(s.adm, 'admin.game', { event: s.ev, approval: true });
  await check('заявка', async () => { await w.say(n2, '/start ' + code); await w.say(n2, n2.name); }, [s.adm, s.adm2]);
  const req = (await w.api(s.adm, 'admin.state', { event: s.ev })).requests[0];
  await check('решение по заявке', () => w.api(s.adm, 'admin.request.decide', { event: s.ev, id: req.id, approve: true }), [n2, s.adm2]);
  await w.api(s.adm, 'admin.game', { event: s.ev, approval: false });
  await check('выход участника', () => w.api(n1, 'event.leave', { event: s.ev, confirm: 'ВЫЙТИ' }), [s.adm, s.adm2]);
  const author = s.people[0];
  let thread;
  await check('новое обращение', async () => {
    thread = (await w.api(author, 'support.send', { event: s.ev, text: 'Вопрос' })).thread;
  }, [s.adm, s.adm2]);
  await check('взятие', () => w.api(s.adm2, 'admin.support.take', { event: s.ev, thread }), [author, s.adm]);
  await check('ответ', () => w.api(s.adm2, 'admin.support.send', { event: s.ev, thread, text: 'Ответ' }), [author]);
  await check('передача', () => w.api(s.adm2, 'admin.support.pass', { event: s.ev, thread, to: s.adm.id }), [author, s.adm]);
  await check('закрытие', () => w.api(s.adm, 'admin.support.close', { event: s.ev, thread }), [author]);
  // Снятие прав: обращение, которое вёл второй админ, снова ничьё
  const t2 = (await w.api(s.people[1], 'support.send', { event: s.ev, text: 'Ещё вопрос' })).thread;
  await w.api(s.adm2, 'admin.support.take', { event: s.ev, thread: t2 });
  await check('снятие прав', () => w.api(boss, 'admin.role.revoke', { company: s.company, id: s.adm2.id }), [s.adm]);
  assert.equal(w.query('SELECT assignee FROM support_threads WHERE id = ?', t2)[0].assignee, 0, 'обращение снова ничьё');
  await check('назначение', () => w.api(boss, 'admin.role.grant', { company: s.company, id: s.adm2.id }), [s.adm]);
  // Неудача автожеребьёвки: событие без участников, дата уже наступила
  const empty = await z.event(s.company, 'Пустое ' + s.title);
  await w.api(s.adm, 'admin.game', { event: empty, draw_auto_date: '2020-01-01' });
  await check('автожеребьёвка (cron)', () => w.cron(), [s.adm, s.adm2]);
  assert.equal(w.query("SELECT COUNT(*) AS n FROM audit WHERE action = 'draw.auto.failed' AND event_id = ?", empty)[0].n, 1);
  assert.deepEqual(z.invariants(), []);
}

describe('компании: получатели сообщений (T025)', () => {
  it('в компании Б — только организаторы Б (гостю — нет)', async () => {
    const z = await twoCompanies();
    await organizerFlow(z, z.B);
  });
  it('зеркально в компании А — только организаторы А', async () => {
    const z = await twoCompanies();
    await organizerFlow(z, z.A);
  });
});

describe('компании: кнопки бота (T026)', () => {
  it('администратор А не решает заявку Б, не берёт обращение Б и не отвечает в него — данные Б прежние', async () => {
    const z = await twoCompanies();
    const { w } = z;
    await w.api(z.B.adm, 'admin.game', { event: z.B.ev, approval: true });
    const [n] = z.B.fresh;
    await w.say(n, '/start ' + inviteOf(await w.api(z.B.adm, 'admin.state', { event: z.B.ev })));
    await w.say(n, n.name);
    const req = (await w.api(z.B.adm, 'admin.state', { event: z.B.ev })).requests[0];
    const thread = (await w.api(z.B.people[0], 'support.send', { event: z.B.ev, text: 'Вопрос' })).thread;
    const state = () => JSON.stringify([
      w.query('SELECT status FROM join_requests WHERE id = ?', req.id),
      w.query('SELECT assignee, status FROM support_threads WHERE id = ?', thread),
      w.query('SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ?', thread),
      w.query('SELECT COUNT(*) AS n FROM members WHERE event_id = ?', z.B.ev),
    ]);
    const was = state();
    const before = z.counts();
    for (const data of [`req:${req.id}:a`, `req:${req.id}:r`, `sup:take:${thread}`, `sup:a:${thread}`]) {
      const t0 = w.calls.length;
      await w.press(z.A.adm, data);
      assert.deepEqual(z.answers(t0), [ADMIN_ONLY], data);
    }
    // Режим ответа в обращение Б (как если бы кнопку нажали раньше) — ответ не сохраняется
    w.sql(`UPDATE users SET pending = 'sup_a:${thread}:${Date.now()}' WHERE tg_id = ${z.A.adm.id}`);
    await w.say(z.A.adm, 'Ответ из чужой компании');
    assert.equal(w.lastText(z.A.adm), '❌ Отвечать на обращения могут владелец и администраторы.');
    assert.equal(state(), was);
    assert.deepEqual(z.counts(), before);
    // «от противного»: администратор Б той же кнопкой берёт обращение
    await w.press(z.B.adm, `sup:take:${thread}`);
    assert.equal(w.query('SELECT assignee FROM support_threads WHERE id = ?', thread)[0].assignee, z.B.adm.id);
  });
});

describe('компании: владелец бота — гость компании Б (T027)', () => {
  let z;
  before(async () => { z = await twoCompanies(); });

  it('проходит по правам все admin.* над событием Б и общие действия Б', async () => {
    const denied = [];
    for (const a of ADMIN) {
      const ev = await z.event(z.B.company, 'Гость ' + a);
      const r = await z.w.api(boss, a, { ...body(ev), company: z.B.company }, true);
      if (r.status === 403 || r.data.error === NO_EVENT || r.data.error === 'Выбери комнату.') denied.push(`${a}: ${r.status} ${r.data.error}`);
    }
    assert.deepEqual(denied, []);
  });

  it('его нет в «Организаторах» и людях Б; журнал Б подписан его именем', async () => {
    const { roster } = await z.w.api(z.B.people[0], 'event.get', { event: z.B.ev });
    assert.ok(roster.organizers.some((o) => o.id === z.B.adm.id));
    assert.ok(!roster.organizers.some((o) => o.id === boss.id));
    assert.ok(!(await z.w.api(z.B.adm, 'admin.users', { company: z.B.company })).users.some((u) => u.id === boss.id));
    const general = (await z.w.api(z.B.adm, 'admin.audit', { company: z.B.company })).entries;
    assert.ok(general.some((e) => e.action === 'role.grant' && e.actor_name === boss.name));
    const ofEvent = (await z.w.api(z.B.adm, 'admin.audit', { event: z.B.ev })).entries;
    assert.equal(ofEvent.find((e) => e.action === 'event.create').actor_name, boss.name);
  });

  it('рассылки организаторам Б ему не приходят; передать ему обращение нельзя, взять сам — может', async () => {
    let thread;
    const rec = await z.during(async () => {
      thread = (await z.w.api(z.B.people[0], 'support.send', { event: z.B.ev, text: 'Вопрос' })).thread;
    });
    assert.ok(rec.has(z.B.adm.id) && !rec.has(boss.id));
    await z.w.api(z.B.adm, 'admin.support.take', { event: z.B.ev, thread });
    const pass = await z.w.api(z.B.adm, 'admin.support.pass', { event: z.B.ev, thread, to: boss.id }, true);
    assert.deepEqual([pass.status, pass.data.error], [400, 'Передать можно владельцу или другому администратору.']);
    const t2 = (await z.w.api(z.B.people[1], 'support.send', { event: z.B.ev, text: 'Второй вопрос' })).thread;
    await z.w.api(boss, 'admin.support.take', { event: z.B.ev, thread: t2 });
    assert.equal(z.w.query('SELECT assignee FROM support_threads WHERE id = ?', t2)[0].assignee, boss.id);
    assert.deepEqual(z.invariants(), []);
  });
});

describe('компании: один человек в двух компаниях (US3)', () => {
  it('T028: администратор А и участник события Б — над Б не организатор, сообщений организаторам Б нет', async () => {
    const z = await twoCompanies();
    const dual = person(9301, 'Двойной');
    await z.join(z.A.ev, [dual]);
    await z.w.api(boss, 'admin.role.grant', { company: z.A.company, id: dual.id });
    await z.join(z.B.ev, [dual]);
    const st = await z.w.api(dual, 'admin.state', { event: z.B.ev }, true);
    assert.deepEqual([st.status, st.data.error], [404, NO_EVENT]);
    const ev = await z.w.api(dual, 'event.get', { event: z.B.ev });
    assert.ok(ev.support && !('support_admin' in ev), 'в событии Б — участник');
    assert.ok('support_admin' in (await z.w.api(dual, 'event.get', { event: z.A.ev })), '«от противного»: в А — организатор');
    const rec = await z.during(() => z.join(z.B.ev, [z.B.fresh[0]]));
    assert.ok(rec.has(z.B.adm.id) && !rec.has(dual.id));
    const evA2 = await z.event(z.A.company, 'А без него');
    const evB2 = await z.event(z.B.company, 'Б без него');
    const ids = (await z.w.api(dual, 'me')).events.map((e) => e.id);
    assert.deepEqual(ids.sort(byNumber), [z.A.ev, z.B.ev, evA2].sort(byNumber));
    assert.ok(!ids.includes(evB2));
    assert.deepEqual(z.invariants(), []);
  });

  it('T029: прошлые пары А не дают правила history в обмене события Б', async () => {
    const z = await twoCompanies();
    const { w } = z;
    const [x1, x2, x3, x4] = z.A.people;
    const fixAll = async (ev, links) => {
      for (const [g, r] of links) await w.api(boss, 'admin.fixed.add', { event: ev, giver: g.id, receiver: r.id });
      await w.api(boss, 'admin.draw', { event: ev });
    };
    // Прошлое событие А — кольцо x1→x2→x3→x4→x1; новые — обратное кольцо: обмен x1 и x3 даёт x1→x2 и x3→x4 (пары А)
    const past = await z.event(z.A.company, 'Прошлое А', [x1, x2, x3, x4]);
    await fixAll(past, [[x1, x2], [x2, x3], [x3, x4], [x4, x1]]);
    const reverse = [[x1, x4], [x2, x1], [x3, x2], [x4, x3]];
    const rulesIn = async (company, title) => {
      const ev = await z.event(company, title, [x1, x2, x3, x4]);
      await fixAll(ev, reverse);
      const check = await w.api(boss, 'admin.draw.swap.check', { event: ev, a: x1.id, b: x3.id });
      assert.equal(check.possible, true);
      return check.rules.map((r) => r.rule);
    };
    assert.ok(!(await rulesIn(z.B.company, 'Обмен в Б')).includes('history'), 'пары А в Б — не прошлые');
    assert.ok((await rulesIn(z.A.company, 'Обмен в А')).includes('history'), '«от противного»: в А — прошлые');
    assert.deepEqual(z.invariants(), []);
  });

  it('T029: исключения события А меняются между проверкой и записью жеребьёвки в Б — записана; свои — нет', async () => {
    const z = await twoCompanies();
    const { w } = z;
    const people = z.A.people;
    await w.api(boss, 'admin.exclusion.add', { event: z.A.ev, giver: people[0].id, receiver: people[1].id });
    const first = await z.event(z.B.company, 'Гонка', people);
    w.beforeWrite('UPDATE events SET draw_done = 1', () => {
      w.sql(`DELETE FROM exclusions WHERE event_id = ${z.A.ev}`);
    });
    assert.equal((await w.api(boss, 'admin.draw', { event: first }, true)).status, 200);
    // «от противного»: исключение самого события между проверкой и записью — жеребьёвка не записывается
    const second = await z.event(z.B.company, 'Гонка 2', people);
    await w.api(boss, 'admin.exclusion.add', { event: second, giver: people[2].id, receiver: people[3].id });
    w.beforeWrite('UPDATE events SET draw_done = 1', () => {
      w.sql(`DELETE FROM exclusions WHERE event_id = ${second}`);
    });
    const r = await w.api(boss, 'admin.draw', { event: second }, true);
    assert.deepEqual([r.status, r.data.error], [400, 'Участники или исключения изменились во время жеребьёвки — попробуй ещё раз.']);
    assert.equal(w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', second)[0].n, 0);
    assert.deepEqual(z.invariants(), []);
  });

  it('T030: снятие прав в А не трогает права и обращения в Б; общий признак — пока админ хоть где-то', async () => {
    const z = await twoCompanies();
    const { w } = z;
    const both = person(9401, 'Оба');
    await z.join(z.A.ev, [both]);
    await z.join(z.B.ev, [both]);
    for (const s of [z.A, z.B]) await w.api(boss, 'admin.role.grant', { company: s.company, id: both.id });
    // Обращения, которые он ведёт, — и в А, и в Б
    const thread = (await w.api(z.B.people[0], 'support.send', { event: z.B.ev, text: 'Вопрос' })).thread;
    await w.api(both, 'admin.support.take', { event: z.B.ev, thread });
    const threadA = (await w.api(z.A.people[0], 'support.send', { event: z.A.ev, text: 'Вопрос в А' })).thread;
    await w.api(both, 'admin.support.take', { event: z.A.ev, thread: threadA });
    const flag = () => w.query('SELECT is_admin FROM users WHERE tg_id = ?', both.id)[0].is_admin;
    const assignee = (id = thread) => w.query('SELECT assignee FROM support_threads WHERE id = ?', id)[0].assignee;
    const rec = await z.during(() => w.api(boss, 'admin.role.revoke', { company: z.A.company, id: both.id }));
    assert.ok(rec.has(z.A.people[0].id) && !rec.has(z.B.people[0].id), '«снова ждёт ответа» — только автору обращения А');
    assert.deepEqual(w.query("SELECT event_id FROM audit WHERE action = 'support.return'").map((r) => r.event_id), [z.A.ev]);
    assert.equal(flag(), 1);
    assert.equal(assignee(threadA), 0, 'обращение А снова ничьё');
    assert.equal(assignee(), both.id, 'обращение Б он ведёт по-прежнему');
    const inA = await w.api(both, 'admin.state', { event: z.A.ev }, true);
    assert.deepEqual([inA.status, inA.data.error], [404, NO_EVENT]);
    assert.equal((await w.api(both, 'admin.state', { event: z.B.ev }, true)).status, 200);
    await w.api(boss, 'admin.role.revoke', { company: z.B.company, id: both.id });
    assert.equal(flag(), 0);
    assert.equal(assignee(), 0, 'обращение Б снова ничьё — только после снятия прав в Б');
    assert.deepEqual(z.invariants(), []);
  });

  it('T031: перенос человека из А и Б — строки компаний, права, сообщения и журнал в обеих; name.set — запись в каждую', async () => {
    const z = await twoCompanies();
    const { w } = z;
    const old = person(9501, 'Старый');
    const fresh = person(9502, 'Новый');
    await z.join(z.A.ev, [old, fresh]);
    await z.join(z.B.ev, [old]);
    await w.api(boss, 'admin.role.grant', { company: z.B.company, id: old.id });
    // Цель — администратор любой компании: отказ
    const toAdmin = await w.api(boss, 'admin.transfer', { company: z.A.company, from: old.id, to: z.B.adm.id }, true);
    assert.deepEqual([toAdmin.status, toAdmin.data.error], [400, 'Переносить участие на аккаунт владельца или администратора нельзя.']);
    const rec = await z.during(() => w.api(boss, 'admin.transfer', { company: z.A.company, from: old.id, to: fresh.id }));
    assert.ok(rec.has(z.A.adm.id) && rec.has(z.B.adm.id), 'организаторам обеих компаний');
    const rows = w.query('SELECT company_id, is_admin FROM company_members WHERE user_id = ? ORDER BY company_id', fresh.id);
    assert.deepEqual(rows.map((r) => [r.company_id, r.is_admin]), [[z.A.company, 0], [z.B.company, 1]]);
    assert.equal(w.query('SELECT COUNT(*) AS n FROM company_members WHERE user_id = ?', old.id)[0].n, 0);
    const general = (action) => w.query('SELECT company_id FROM audit WHERE action = ? AND event_id = 0 ORDER BY company_id', action)
      .map((r) => r.company_id);
    assert.deepEqual(general('transfer'), [z.A.company, z.B.company]);
    await w.api(fresh, 'name.set', { name: 'Новое имя' });
    assert.deepEqual(general('rename'), [z.A.company, z.B.company]);
    await w.api(fresh, 'name.set', { name: 'Новое имя' });
    assert.deepEqual(general('rename'), [z.A.company, z.B.company], 'повтор — без записей');
    assert.deepEqual(z.invariants(), []);
  });
});

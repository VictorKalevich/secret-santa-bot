// 062: без масок Санты и семей (specs/062-remove-masks-families/). Миграция 0023 на базе «как у 061»: семьи событий с
// «Учитывать семьи» (идущих и завершённых) становятся взаимными исключениями участников, маски стираются, семей нет,
// остальные строки прежние; сверка — те же операторы, повтор ничего не меняет. После переноса: записи семей и маски,
// оставленные прежним кодом, не действуют и не показываются; действий семей и масок нет; в приложении нет ни семей, ни
// масок, ни подсказки над «Уведомлениями». У каждого правила — «от противного».
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startWorld, restoreFetch } from './support/world.mjs';
import { APP } from './support/app-source.mjs';
import { DICTIONARIES } from '../src/i18n/index.js';

after(restoreFetch);

const SQL23 = readFileSync(new URL('../migrations/0023_remove_masks_families.sql', import.meta.url), 'utf8');
const RECONCILE = readFileSync(new URL('../tools/masks-families-reconcile.sql', import.meta.url), 'utf8');
const statementsOf = (sql) => sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const CONVERT = statementsOf(SQL23)[0];

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vika = { id: 103, name: 'Вика', username: 'vika' };
const gosha = { id: 104, name: 'Гоша', username: 'gosha' };
const dima = { id: 105, name: 'Дима', username: 'dima' };
const person = (id) => [anya, borya, vika, gosha, dima].find((u) => u.id === id);

const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

async function bossWorld() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  w.join = async (ev, people) => {
    const code = inviteOf(await w.api(boss, 'admin.state', { event: ev }));
    for (const u of people) {
      const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
      await w.say(u, '/start ' + code);
      if (!known) await w.say(u, u.name);
    }
  };
  w.event = async (title, people, extra = {}) => {
    const ev = (await w.api(boss, 'event.create', { participate: false, title, ...extra })).event.id;
    await w.join(ev, people);
    return ev;
  };
  return w;
}

const snapshot = (w) => Object.fromEntries(
  w.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map(({ name }) => [name, w.query(`SELECT * FROM ${name}`).map((r) => JSON.stringify(r)).sort()])
);
const exclusions = (w) => w.query('SELECT event_id, giver, receiver FROM exclusions')
  .map((r) => `${r.event_id}:${r.giver}>${r.receiver}`).sort();
const both = (ev, a, b) => [`${ev}:${a.id}>${b.id}`, `${ev}:${b.id}>${a.id}`];

// База «как у 061» (R2): комната 1 — семья Аня/Боря/Вика, Гоша без семьи; X — правило, до жеребьёвки, Аня/Боря/Гоша и
// своё исключение Гоша → Аня; Y — без правила, Аня/Боря/Вика; Z — завершённое с правилом, Аня/Боря/Вика; W — после
// жеребьёвки с правилом, Аня/Вика/Гоша, маски и переписка; V — с правилом и уже исключением Аня → Боря; комната 2 — своя
// семья Аня/Дима и событие с правилом, где Аня, Боря, Дима. Семьи, правило и маски — строками, как их оставил прежний
// код (в коде 062 действий для них нет; умолчание колонки «Учитывать семьи» — 1); версия схемы — 22. Комнаты событий —
// тоже строками (063: новый код создаёт события вне комнат).
async function world061() {
  const w = await bossWorld();
  const ev = {};
  ev.X = await w.event('X', [anya, borya, gosha]);
  ev.Y = await w.event('Y', [anya, borya, vika]);
  ev.Z = await w.event('Z', [anya, borya, vika]);
  ev.W = await w.event('W', [anya, vika, gosha]);
  ev.V = await w.event('V', [anya, borya]);
  const c2 = w.query("INSERT INTO companies (name, created_at) VALUES ('Вторая', 1) RETURNING id")[0].id;
  ev.C2 = await w.event('C2', [anya, borya, dima]);
  await w.api(boss, 'admin.exclusion.add', { event: ev.X, giver: gosha.id, receiver: anya.id });
  await w.api(boss, 'admin.exclusion.add', { event: ev.V, giver: anya.id, receiver: borya.id });
  await w.api(boss, 'admin.draw', { event: ev.W });
  for (const u of [anya, vika, gosha]) await w.api(u, 'ward.get', { event: ev.W });
  const santa = person(w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', ev.W, anya.id)[0].santa);
  await w.api(santa, 'message.send', { event: ev.W, to: 'ward', text: 'Привет!' });
  await w.api(anya, 'message.send', { event: ev.W, to: 'santa', text: 'Спасибо!' });
  w.sql(`INSERT INTO families (id, company_id, name, created_at) VALUES (1, 1, 'Семья', 1), (2, ${c2}, 'Своя', 1);
    INSERT INTO family_members (company_id, user_id, family_id) VALUES
      (1, ${anya.id}, 1), (1, ${borya.id}, 1), (1, ${vika.id}, 1), (${c2}, ${anya.id}, 2), (${c2}, ${dima.id}, 2);
    UPDATE events SET company_id = CASE WHEN id = ${ev.C2} THEN ${c2} ELSE 1 END;
    UPDATE events SET families_on = CASE WHEN id = ${ev.Y} THEN 0 ELSE 1 END;
    UPDATE events SET status = 'finished' WHERE id = ${ev.Z};
    UPDATE pairs SET mask = 'dragon' WHERE event_id = ${ev.W};
    UPDATE settings SET value = '22' WHERE key = 'schema'`);
  return { w, ev, c2 };
}

const withoutMask = (rows) => rows.map((r) => { const o = JSON.parse(r); delete o.mask; return JSON.stringify(o); }).sort();

describe('062: миграция 0023 — семьи в исключения, маски стёрты', () => {
  it('0023: перенос, маски, удаление семей, версия 23 — по порядку', () => {
    const list = statementsOf(SQL23);
    assert.equal(list.length, 5, list.join('\n'));
    assert.match(list[0], /^INSERT OR IGNORE INTO exclusions \(event_id, giver, receiver\) SELECT /);
    assert.match(list[0], /WHERE e\.families_on = 1 AND EXISTS .*m\.user_id = a\.user_id\) AND EXISTS .*m\.user_id = b\.user_id\)$/);
    assert.deepEqual(list.slice(1), [
      "UPDATE pairs SET mask = '' WHERE mask <> ''",
      'DELETE FROM family_members',
      'DELETE FROM families',
      "INSERT INTO settings (key, value) VALUES ('schema', '23') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ]);
    assert.doesNotMatch(SQL23.replace(/--[^\n]*/g, ''), /\b(DROP|ALTER)\b/i, 'таблицы и колонки остаются ради отката');
  });

  it('база 061: исключения — ровно пары одной семьи среди участников событий с правилом; остальное прежнее', async () => {
    const { w, ev } = await world061();
    const was = snapshot(w);
    const ownBefore = exclusions(w);
    assert.deepEqual(ownBefore, [`${ev.X}:${gosha.id}>${anya.id}`, `${ev.V}:${anya.id}>${borya.id}`].sort());
    w.sql(SQL23);
    const added = exclusions(w).filter((x) => !ownBefore.includes(x));
    assert.deepEqual(added, [
      ...both(ev.X, anya, borya), // Гоша без семьи
      ...both(ev.Z, anya, borya), ...both(ev.Z, anya, vika), ...both(ev.Z, borya, vika), // завершённое — тоже
      ...both(ev.W, anya, vika), // после жеребьёвки
      `${ev.V}:${borya.id}>${anya.id}`, // своё Аня → Боря — прежнее, добавлено обратное
      ...both(ev.C2, anya, dima), // комната 2 — только своя семья
    ].sort());
    assert.ok(!added.some((x) => x.startsWith(ev.Y + ':')), 'Y — без правила');
    const now = snapshot(w);
    assert.deepEqual(withoutMask(now.pairs), withoutMask(was.pairs), 'пары — прежние');
    assert.ok(w.query('SELECT mask FROM pairs').every((p) => p.mask === ''), 'маски стёрты');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', ev.W)[0].n, 3);
    assert.deepEqual([now.families, now.family_members], [[], []], 'семей нет');
    assert.equal(w.query("SELECT value FROM settings WHERE key = 'schema'")[0].value, '23');
    for (const t of Object.keys(was).filter((t) => !['exclusions', 'pairs', 'families', 'family_members', 'settings'].includes(t))) {
      assert.deepEqual(now[t], was[t], t);
    }
    assert.ok(was.messages.length >= 2 && was.audit.length > 0, 'переписка и журнал были');
    assert.deepEqual(now.settings.filter((r) => !r.includes('"schema"')), was.settings.filter((r) => !r.includes('"schema"')));
  });

  it('сверка: те же четыре оператора; повтор ничего не меняет; оставленное прежним кодом после миграции — переносится', async () => {
    assert.deepEqual(statementsOf(RECONCILE), statementsOf(SQL23).slice(0, 4), 'операторы миграции без версии схемы');
    const { w, ev } = await world061();
    w.sql(SQL23);
    const once = snapshot(w);
    w.sql(RECONCILE);
    w.sql(RECONCILE);
    assert.deepEqual(snapshot(w), once, 'повтор — без изменений');
    // Прежний код (откат) между миграцией и выкатом: новая семья Боря/Гоша и маска
    w.sql(`INSERT INTO families (id, company_id, name, created_at) VALUES (3, 1, 'Новая', 2);
      INSERT INTO family_members (company_id, user_id, family_id) VALUES (1, ${borya.id}, 3), (1, ${gosha.id}, 3);
      UPDATE pairs SET mask = 'owl' WHERE event_id = ${ev.W}`);
    const before = exclusions(w);
    w.sql(RECONCILE);
    assert.deepEqual(exclusions(w).filter((x) => !before.includes(x)), both(ev.X, borya, gosha).sort(), 'X: Боря ↔ Гоша');
    assert.ok(w.query('SELECT mask FROM pairs').every((p) => p.mask === ''));
    assert.equal(w.query('SELECT COUNT(*) AS n FROM family_members')[0].n + w.query('SELECT COUNT(*) AS n FROM families')[0].n, 0);
  });

  it('от противного: без условия «Учитывать семьи» — исключения в Y; без условия участия — с Викой в X', async () => {
    const noRule = await world061();
    noRule.w.sql(CONVERT.replace('e.families_on = 1', '1 = 1'));
    assert.ok(both(noRule.ev.Y, anya, borya).every((x) => exclusions(noRule.w).includes(x)), 'Y получило исключения');
    const noMembers = await world061();
    const loose = CONVERT.replace(/ AND EXISTS \(SELECT 1 FROM members m WHERE m\.event_id = e\.id AND m\.user_id = [ab]\.user_id\)/g, '');
    assert.notEqual(loose, CONVERT);
    noMembers.w.sql(loose);
    assert.ok(exclusions(noMembers.w).includes(`${noMembers.ev.X}:${anya.id}>${vika.id}`), 'Вика не участвует в X');
  });
});

describe('062: после переноса семьи не действуют', () => {
  let w;
  before(async () => {
    w = await bossWorld();
  });

  it('записи семей и «Учитывать семьи», оставленные прежним кодом, жеребьёвка не читает', async () => {
    const E = await w.event('Остатки', [anya, borya, vika]);
    w.sql(`INSERT INTO families (id, company_id, name, created_at) VALUES (7, 1, 'Старая', 1);
      INSERT INTO family_members (company_id, user_id, family_id) VALUES (1, ${anya.id}, 7), (1, ${borya.id}, 7);
      UPDATE events SET families_on = 1 WHERE id = ${E}`);
    // Из трёх человек любая жеребьёвка связывает Аню и Борю — с семьёй как правилом она была бы невозможна
    const check = await w.api(boss, 'admin.draw.check', { event: E });
    assert.equal(check.possible, true);
    await w.api(boss, 'admin.draw', { event: E });
    const links = w.query('SELECT santa, ward FROM pairs WHERE event_id = ?', E);
    assert.ok(links.some((p) => [p.santa, p.ward].sort().join() === [anya.id, borya.id].join()), 'Аня и Боря связаны');
    w.sql('DELETE FROM family_members; DELETE FROM families');
  });

  it('бывшая семья — исключения: жеребьёвка их соблюдает, невозможная — причина без «семей»', async () => {
    const E = await w.event('Исключения', [anya, borya, vika, gosha]);
    await w.api(boss, 'admin.ring', { event: E, on: false });
    for (const [a, b] of [[anya, borya], [borya, anya]]) await w.api(boss, 'admin.exclusion.add', { event: E, giver: a.id, receiver: b.id });
    for (let i = 0; i < 30; i++) {
      await w.api(boss, 'admin.draw', { event: E });
      const links = w.query('SELECT santa, ward FROM pairs WHERE event_id = ?', E);
      assert.equal(links.length, 4);
      assert.ok(!links.some((p) => [p.santa, p.ward].sort().join() === [anya.id, borya.id].join()), 'Аня и Боря не связаны');
      await w.api(boss, 'admin.draw.cancel', { event: E });
    }
    const F = await w.event('Невозможно', [anya, borya, vika]);
    for (const [a, b] of [[anya, borya], [borya, anya]]) await w.api(boss, 'admin.exclusion.add', { event: F, giver: a.id, receiver: b.id });
    const check = await w.api(boss, 'admin.draw.check', { event: F });
    assert.equal(check.possible, false);
    assert.ok(check.problems.length > 0);
    assert.doesNotMatch(JSON.stringify(check), /семь|famil/i);
    const draw = await w.api(boss, 'admin.draw', { event: F }, true);
    assert.equal(draw.data.ok, false);
    assert.doesNotMatch(draw.text, /семь|famil/i);
  });

  it('вписывание и удаление после жеребьёвки соблюдают бывшие семейные исключения', async () => {
    const linked = (E) => w.query('SELECT santa, ward FROM pairs WHERE event_id = ?', E)
      .some((p) => [p.santa, p.ward].sort().join() === [anya.id, borya.id].join());
    for (let i = 0; i < 8; i++) {
      const E = await w.event('Замены ' + i, [anya, borya, vika, gosha]);
      await w.api(boss, 'admin.ring', { event: E, on: false });
      for (const [a, b] of [[anya, borya], [borya, anya]]) await w.api(boss, 'admin.exclusion.add', { event: E, giver: a.id, receiver: b.id });
      await w.api(boss, 'admin.draw', { event: E });
      await w.api(boss, 'admin.registration', { event: E, open: true });
      await w.join(E, [dima]);
      await w.api(boss, 'admin.insert', { event: E, id: dima.id });
      assert.equal(w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', E)[0].n, 5);
      assert.ok(!linked(E), 'вписывание');
      await w.api(boss, 'admin.remove', { event: E, id: gosha.id });
      assert.equal(w.query('SELECT COUNT(*) AS n FROM pairs WHERE event_id = ?', E)[0].n, 4);
      assert.ok(!linked(E), 'удаление');
    }
  });

  it('действий семей нет: организатору — «Событие не найдено.» без события и «Неизвестное действие» с ним, участнику — 403', async () => {
    const E = await w.event('Действия', [anya]);
    for (const action of ['admin.families', 'admin.family.save', 'admin.family.delete']) {
      const body = { name: 'Ивановы', members: [anya.id, boss.id], id: 1 };
      assert.deepEqual((await w.api(boss, action, body, true)).data, { ok: false, error: 'Событие не найдено.' }, action);
      const r = await w.api(boss, action, { ...body, event: E }, true);
      assert.deepEqual([r.status, r.data], [404, { ok: false, error: 'Неизвестное действие' }], action);
      assert.equal((await w.api(anya, action, { ...body, event: E }, true)).status, 403, action);
    }
    assert.equal(w.query('SELECT COUNT(*) AS n FROM families')[0].n, 0);
  });

  it('«Управление» без семей: admin.state без families и families_on, admin.game с families_on ничего не пишет', async () => {
    const E = await w.event('Панель', [anya]);
    w.sql(`UPDATE events SET families_on = 0 WHERE id = ${E}`);
    const st = await w.api(boss, 'admin.state', { event: E });
    assert.ok(!('families' in st) && !('families_on' in st.settings));
    await w.api(boss, 'admin.game', { event: E, families_on: true });
    assert.equal(w.query('SELECT families_on FROM events WHERE id = ?', E)[0].families_on, 0);
  });

  // 063: прежние общие записи комнат — в журнале бота
  it('прежняя запись журнала семьи показывается текстом на языке смотрящего', async () => {
    const tx = { $t: 'membership.audit.familySave', $p: { name: 'Ивановы', people: { $j: ['Аня', 'Боря'], $s: ', ' } } };
    w.sql(`INSERT INTO audit (event_id, company_id, actor, action, details, details_tx, created_at)
      VALUES (0, 1, ${boss.id}, 'family.save', '«Ивановы»: Аня, Боря', '${JSON.stringify(tx)}', 1)`);
    const entry = async (u) => (await w.api(u, 'bot.audit')).entries.find((e) => e.action === 'family.save');
    assert.equal((await entry(boss)).details, '«Ивановы»: Аня, Боря');
    assert.equal((await entry({ ...boss, language_code: 'en' })).details, '“Ивановы”: Аня, Боря');
  });
});

describe('062: масок нет', () => {
  let w, E, santaOfAnya;
  const MASK_WORDS = /mask|dragon|Дракон|🐉/i;
  before(async () => {
    w = await bossWorld();
    E = await w.event('Маски', [anya, borya, vika]);
    await w.api(boss, 'admin.draw', { event: E });
    // Маска, оставленная прежним кодом (откат после миграции)
    w.sql(`UPDATE pairs SET mask = 'dragon' WHERE event_id = ${E}`);
    santaOfAnya = person(w.query('SELECT santa FROM pairs WHERE event_id = ? AND ward = ?', E, anya.id)[0].santa);
  });

  it('ответы me, event.get, ward.get, chat.get — без маски', async () => {
    const me = await w.api(anya, 'me', {}, true);
    assert.deepEqual(Object.keys(me.data.looks), ['postcards']);
    for (const [u, action, body] of [
      [anya, 'me', {}],
      [anya, 'event.get', { event: E }],
      [santaOfAnya, 'event.get', { event: E }],
      [santaOfAnya, 'ward.get', { event: E }],
      [anya, 'chat.get', { event: E, with: 'santa' }],
      [santaOfAnya, 'chat.get', { event: E, with: 'ward' }],
    ]) {
      const r = await w.api(u, action, body, true);
      assert.equal(r.data.ok, true, action);
      assert.doesNotMatch(r.text, MASK_WORDS, `${action} (${u.id})`);
    }
  });

  it('сообщение Санты, подсказка ответа и раскрытие — «Тайный Санта» без маски', async () => {
    const from = w.calls.length;
    await w.api(santaOfAnya, 'message.send', { event: E, to: 'ward', text: 'Привет!' });
    await w.press(anya, `msg:santa:${E}`);
    await w.press(santaOfAnya, `msg:ward:${E}`);
    await w.say(santaOfAnya, '/cancel');
    await w.api(boss, 'admin.reveal', { event: E });
    const texts = w.calls.slice(from).map((c) => c.params.text).filter(Boolean);
    const toAnya = w.calls.slice(from).filter((c) => c.params.chat_id === anya.id && c.params.text).map((c) => c.params.text);
    assert.ok(toAnya.some((t) => t.includes('Твой Тайный Санта') && t.includes('Привет!')), 'сообщение Санты');
    assert.ok(toAnya.some((t) => t.startsWith('✍️ Напиши сообщение своему Санте')), 'подсказка ответа подопечному');
    assert.ok(texts.some((t) => t.startsWith('✍️ Напиши сообщение подопечному')), 'подсказка ответа Санте');
    assert.ok(toAnya.some((t) => t.includes('Тайна раскрыта')), 'раскрытие');
    for (const t of texts) assert.doesNotMatch(t, MASK_WORDS, t);
  });

  it('mask.set — «Неизвестное действие», пара не меняется', async () => {
    const r = await w.api(santaOfAnya, 'mask.set', { event: E, mask: 'owl' }, true);
    assert.deepEqual([r.status, r.data], [404, { ok: false, error: 'Неизвестное действие' }]);
    assert.equal(w.query('SELECT mask FROM pairs WHERE event_id = ? AND ward = ?', E, anya.id)[0].mask, 'dragon');
  });
});

// ---------- приложение и словари ----------

const GONE = ['openMaskSheet', 'maskedSanta', 'maskLabel', 'santa_mask', 'mask.set', 'app.event.mask.', 'app.sheet.chat.yourMasked',
  'admin.famil', 'renderFamiliesSection', 'openFamily', 'families_on', 'app.home.families', 'app.admin.families',
  'app.home.notify.hint'];
const left = (text) => GONE.filter((w) => text.includes(w));
const GONE_KEYS = /^(app\.home\.notify\.hint|app\.home\.families\.|app\.admin\.families\.|app\.event\.mask\.|app\.sheet\.chat\.yourMasked|looks\.mask|chat\.santaTitleMask|bot\.reply\.to(Ward|Santa)Masked|events\.revealedMask|participant\.(noMask|maskRevealed)|api\.maskClosed|pairs\.(familiesBlock|swapRule\.family)|eventParams\.familiesAfterDraw|membership\.(familyNameRule|familySize|familyNotFound|alreadyInFamily|familyFrozen))/;
const leftKeys = (dict) => Object.keys(dict).filter((k) => GONE_KEYS.test(k));

describe('062: приложение и словари', () => {
  it('в склейке нет масок, семей и подсказки над «Уведомлениями»', () => {
    assert.deepEqual(left(APP), []);
    assert.doesNotMatch(APP, /mask/i);
  });

  it('ни в одном словаре нет удалённых ключей; прежние ключи журнала семей и «app.event.santa» — есть', () => {
    for (const [lang, d] of Object.entries(DICTIONARIES)) {
      const all = { ...d.server, ...d.app };
      assert.deepEqual(leftKeys(all), [], lang);
      for (const k of ['membership.audit.familySave', 'membership.audit.familyDelete', 'app.vault.audit.family.save', 'app.event.santa']) {
        assert.ok(k in all, `${lang}: ${k}`);
      }
    }
  });

  it('от противного: остаток в склейке и в словаре замечен', () => {
    assert.deepEqual(left("ui.card(h('p', { class: 'ds-hint' }, t('app.home.notify.hint')), seg); openMaskSheet(ev);"),
      ['openMaskSheet', 'app.home.notify.hint']);
    assert.deepEqual(leftKeys({ 'app.home.notify.hint': 'x', 'looks.mask.owl': 'x', 'pairs.familiesBlock': 'x', 'app.event.santa': 'x' }),
      ['app.home.notify.hint', 'looks.mask.owl', 'pairs.familiesBlock']);
  });
});

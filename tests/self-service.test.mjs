// 035: участник сам меняет имя и выходит из события (specs/035-self-service/). Выход — только до жеребьёвки, со словом
// ВЫЙТИ, данные участия — по REGISTRY, без отметки «удалён», организаторам — сообщение со звуком, журнал member.leave;
// имя — правило регистрации, журнал rename только при изменении, без сообщений.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const anya = { id: 101, name: 'Аня', username: 'anya' };
const borya = { id: 102, name: 'Боря', username: 'borya' };
const vera = { id: 103, name: 'Вера', username: 'vera' };
const gena = { id: 104, name: 'Гена', username: 'gena' };
const stranger = { id: 105, name: 'Незнакомец', username: 'stranger' };

const WORD = 'Чтобы выйти, введи слово ВЫЙТИ.';
const AFTER_DRAW = 'Жеребьёвка уже прошла. Чтобы выйти, обратись к владельцу или администраторам.';
const FINISHED = 'Событие завершено — выйти из него уже нельзя.';
const NOT_MEMBER = 'Ты не участвуешь в этом событии.';
const NAME_RULE = 'Имя должно быть от 1 до 40 символов';
const LEAVES = 'выходит из события';

// Владелец, админ, трое участников в событии «Проверка» (админ тоже участник); create — ещё одно событие с людьми
async function world() {
  const w = await startWorld();
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const invite = async (id) => /start=(inv_[a-z0-9]+)/.exec((await w.api(boss, 'admin.state', { event: id })).settings.invite_link)[1];
  const join = async (u, code) => {
    const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
    await w.say(u, '/start ' + code);
    if (!known) await w.say(u, u.name);
  };
  const create = async (title, people) => {
    const id = (await w.api(boss, 'event.create', { participate: false, title })).event.id;
    const code = await invite(id);
    for (const u of people) await join(u, code);
    return id;
  };
  const E = await create('Проверка', [adm, anya, borya, vera]);
  await w.api(boss, 'admin.role.grant', { event: E, id: adm.id });
  const leave = (u, event = E, confirm = 'ВЫЙТИ') => w.api(u, 'event.leave', { event, confirm }, true);
  const member = (u, event = E) => w.query('SELECT 1 FROM members WHERE event_id = ? AND user_id = ?', event, u.id).length === 1;
  // Сообщения «… выходит из события» человеку u (вызовы sendMessage целиком)
  const notes = (u) => w.calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === u.id && c.params.text.includes(LEAVES));
  const records = (action, ev) => w.query('SELECT * FROM audit WHERE event_id = ? AND action = ?', ev, action);
  return { w, E, create, invite, join, leave, member, notes, records };
}

describe('выход из события до жеребьёвки (035, US1)', () => {
  let z;
  let F;
  before(async () => {
    z = await world();
    F = await z.create('Другое', [anya, borya, gena]);
    const { w, E } = z;
    await w.api(anya, 'wishlist.save', { event: E, text: 'Книгу' });
    await w.api(boss, 'admin.exclusion.add', { event: E, giver: anya.id, receiver: borya.id });
    await w.api(anya, 'support.send', { event: E, text: 'Вопрос организатору' });
    await w.api(anya, 'wishlist.save', { event: F, text: 'Шарф' });
  });

  it('без слова и с другим словом — отказ, ничего не изменилось', async () => {
    for (const confirm of [null, '', 'ВЫЙТ', 'УДАЛИТЬ']) {
      const r = await z.leave(anya, z.E, confirm);
      assert.equal(r.status, 400, String(confirm));
      assert.equal(r.data.error, WORD);
    }
    assert.ok(z.member(anya), 'участница');
    assert.equal(z.records('member.leave', z.E).length, 0, 'журнал');
    assert.equal(z.notes(boss).length, 0, 'сообщений нет');
  });

  it('слово в любом регистре и с пробелами — выход: участие и данные события удалены, другое событие цело', async () => {
    const r = await z.leave(anya, z.E, ' выйти ');
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { ok: true });
    const { w, E } = z;
    assert.ok(!z.member(anya), 'не участница');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM exclusions WHERE event_id = ? AND (giver = ? OR receiver = ?)', E, anya.id, anya.id)[0].n, 0, 'исключения');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM support_threads WHERE event_id = ? AND user_id = ?', E, anya.id)[0].n, 0, 'обращения');
    assert.equal(w.query('SELECT COUNT(*) AS n FROM removed_members WHERE user_id = ?', anya.id)[0].n, 0, 'отметки «удалён» нет');
    assert.ok(z.member(anya, F), 'участие в другом событии');
    assert.equal(w.query('SELECT wishlist FROM members WHERE event_id = ? AND user_id = ?', F, anya.id)[0].wishlist, 'Шарф');
    assert.ok(z.member(borya) && z.member(vera), 'остальные — участники');
  });

  it('организаторам — по одному сообщению со звуком и кнопкой события; журнал — одна запись с именем', () => {
    for (const u of [boss, adm]) {
      const n = z.notes(u);
      assert.equal(n.length, 1, u.name);
      assert.equal(n[0].params.text, '🚪 <b>Аня</b> выходит из события «Проверка».');
      assert.ok(!n[0].params.disable_notification, 'со звуком');
      const [[button]] = n[0].params.reply_markup.inline_keyboard;
      assert.equal(button.text, '🛠 Открыть событие');
      assert.ok(button.web_app.url.endsWith('/app?event=' + z.E), button.web_app.url);
    }
    assert.equal(z.notes(anya).length, 0, 'самой — нет');
    assert.equal(z.notes(borya).length, 0, 'участникам — нет');
    const rec = z.records('member.leave', z.E);
    assert.equal(rec.length, 1);
    assert.equal(rec[0].actor, anya.id);
    assert.equal(rec[0].details, 'Аня');
  });

  it('повторный выход и не участник — 403 «Ты не участвуешь в этом событии.»', async () => {
    for (const u of [anya, gena, boss]) {
      const r = await z.leave(u);
      assert.equal(r.status, 403, u.name);
      assert.equal(r.data.error, NOT_MEMBER);
    }
    assert.equal(z.records('member.leave', z.E).length, 1);
  });

  it('вернуться по ссылке — без ввода имени, в том числе при запрете возврата удалённых', async () => {
    await z.w.api(boss, 'admin.game', { event: z.E, rejoin: false });
    await z.w.say(anya, '/start ' + (await z.invite(z.E)));
    assert.ok(z.member(anya), 'снова участница');
    assert.equal(z.w.texts(anya).filter((t) => t.includes('Ты в событии «Проверка»')).length, 1, 'вступила без вопроса об имени');
    assert.equal(z.w.query('SELECT name FROM users WHERE tg_id = ?', anya.id)[0].name, 'Аня');
  });

  it('админ-участник выходит так же: сообщение — остальным организаторам, сам остаётся админом', async () => {
    const before = z.notes(boss).length;
    const r = await z.leave(adm);
    assert.equal(r.status, 200);
    assert.equal(z.notes(boss).length, before + 1);
    assert.equal(z.notes(adm).length, 1, 'админу — только прежнее сообщение о выходе Ани');
    assert.equal(z.w.query('SELECT is_admin FROM users WHERE tg_id = ?', adm.id)[0].is_admin, 1);
    assert.ok(!z.member(adm));
  });
});

describe('выход: бот после выхода (035, US1)', () => {
  it('ответ в обращение, начатый до выхода, не уходит — «Ты не участвуешь в этом событии»', async () => {
    const z = await world();
    await z.w.press(borya, 'sup:u:' + z.E);
    assert.equal((await z.leave(borya)).status, 200);
    await z.w.say(borya, 'Можно вопрос?');
    assert.equal(z.w.lastText(borya), '❌ Ты не участвуешь в этом событии.');
    assert.equal(z.w.query('SELECT COUNT(*) AS n FROM support_threads WHERE user_id = ?', borya.id)[0].n, 0);
  });
});

describe('выход после жеребьёвки и в завершённом событии (035, US2)', () => {
  let z;
  before(async () => {
    z = await world();
    await z.w.api(boss, 'admin.draw', { event: z.E });
  });

  it('после жеребьёвки — отказ, участие, пары, журнал и сообщения прежние', async () => {
    const pairs = z.w.query('SELECT santa, ward FROM pairs WHERE event_id = ? ORDER BY santa', z.E);
    const r = await z.leave(anya);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, AFTER_DRAW);
    assert.ok(z.member(anya));
    assert.deepEqual(z.w.query('SELECT santa, ward FROM pairs WHERE event_id = ? ORDER BY santa', z.E), pairs);
    assert.equal(z.records('member.leave', z.E).length, 0);
    assert.equal(z.notes(boss).length + z.notes(adm).length, 0);
  });

  it('слово проверяется раньше: без слова — отказ «введи слово»', async () => {
    const r = await z.leave(anya, z.E, '');
    assert.equal(r.status, 400);
    assert.equal(r.data.error, WORD);
  });

  it('в завершённом событии — отказ «выйти уже нельзя»', async () => {
    await z.w.api(boss, 'admin.event.finish', { event: z.E });
    for (const confirm of ['ВЫЙТИ', '']) {
      const r = await z.leave(anya, z.E, confirm);
      assert.equal(r.status, 400);
      assert.equal(r.data.error, FINISHED);
    }
    assert.ok(z.member(anya));
  });

  it('завершённое до жеребьёвки событие — тот же отказ', async () => {
    const G = await z.create('Без жеребьёвки', [borya, vera]);
    await z.w.api(boss, 'admin.event.finish', { event: G });
    const r = await z.leave(borya, G);
    assert.equal(r.status, 400);
    assert.equal(r.data.error, FINISHED);
    assert.ok(z.member(borya, G));
  });
});

describe('своё имя (035, US3)', () => {
  let z;
  const rename = (u, name) => z.w.api(u, 'name.set', { name }, true);
  const nameOf = (u) => z.w.query('SELECT name FROM users WHERE tg_id = ?', u.id)[0].name;
  const renames = () => z.w.query("SELECT * FROM audit WHERE event_id = 0 AND action = 'rename'");
  before(async () => { z = await world(); });

  // 063: журнала комнат нет — своё имя журнал не пишет
  it('новое имя — пробелы схлопнуты, ответ { name }, журнал не пишется, сообщений нет', async () => {
    const r = await rename(vera, '  Вера   Петрова ');
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { ok: true, name: 'Вера Петрова' });
    assert.equal(z.w.last.tg, 0, 'сообщений нет');
    assert.equal(nameOf(vera), 'Вера Петрова');
    assert.equal(renames().length, 0);
  });

  it('то же имя — успех без записи', async () => {
    const r = await rename(vera, 'Вера Петрова');
    assert.equal(r.status, 200);
    assert.equal(renames().length, 0);
  });

  it('пустое, из пробелов и длиннее 40 символов — отказ, имя прежнее; ровно 40 — можно', async () => {
    for (const name of [undefined, '', '   ', 'я'.repeat(41)]) {
      const r = await rename(vera, name);
      assert.equal(r.status, 400, String(name));
      assert.equal(r.data.error, NAME_RULE);
    }
    assert.equal(nameOf(vera), 'Вера Петрова');
    assert.equal((await rename(vera, 'я'.repeat(40))).status, 200);
    assert.equal(nameOf(vera), 'я'.repeat(40));
  });

  it('админ и владелец меняют своё имя так же; незарегистрированному — 403', async () => {
    assert.equal((await rename(adm, 'Админ Иванов')).data.name, 'Админ Иванов');
    assert.equal((await rename(boss, 'Владелец')).status, 200);
    const r = await rename(stranger, 'Кто-то');
    assert.equal(r.status, 403);
    assert.equal(r.data.error, 'Сначала зарегистрируйся по пригласительной ссылке.');
  });
});

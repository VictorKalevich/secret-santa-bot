// ПРОТОТИП. Таблица атомарности: два одновременных вызова с навязанным чередованием («все читают, затем все
// пишут» — world.together) и два случая с обратным порядком записи (world.beforeWrite).
// Запуск из корня проекта:  node docs/refactoring/prototypes/atomic.mjs
// Результат на коммите 24b85d3 записан в docs/refactoring/baseline.md. «ДУБЛЬ/ПОРЧА» — известные дефекты:
// их устраняют шаги 3 и 5; строки без захвата (объявление, напоминание, сброс, роли) — решение владельца.
import { startWorld } from './world.mjs';

const boss = { id: 9001, name: 'Владелец', username: 'boss' };
const adm = { id: 9002, name: 'Админ', username: 'adm' };
const adm2 = { id: 9003, name: 'Второй админ', username: 'adm2' };
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, name: 'Игрок' + (i + 1), username: 'p' + (i + 1) }));
const inviteOf = (st) => /start=(inv_[a-z0-9]+)/.exec(st.settings.invite_link)[1];

async function world({ draw = false, n = 6, approval = false } = {}) {
  const w = await startWorld();
  const people = mk(n);
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  const ev = (await w.api(boss, 'admin.events.create', { title: 'Атомарность' })).event;
  const code = inviteOf(await w.api(boss, 'admin.state', { event: ev.id }));
  for (const u of [adm, adm2, ...people]) { await w.say(u, '/start ' + code); await w.say(u, u.name); }
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  await w.api(boss, 'admin.role.grant', { id: adm2.id });
  if (approval) await w.api(boss, 'admin.game', { event: ev.id, approval: true });
  if (draw) await w.api(boss, 'admin.draw', { event: ev.id });
  const sent = (u, sub) => w.texts(u).filter((t) => t.includes(sub)).length;
  const audit = (action) => w.query(`SELECT COUNT(*) AS n FROM audit WHERE action = '${action}'`)[0].n;
  const orphans = () => w.query(`SELECT COUNT(*) AS n FROM pairs p WHERE p.event_id = ${ev.id}
     AND (p.santa NOT IN (SELECT user_id FROM members WHERE event_id = ${ev.id}) OR p.ward NOT IN (SELECT user_id FROM members WHERE event_id = ${ev.id}))`)[0].n;
  return { w, ev, people, code, sent, audit, orphans };
}

const rows = [];
const add = (name, ok, detail) => rows.push([ok ? 'один результат' : 'ДУБЛЬ/ПОРЧА', name, detail]);
const st = (rs) => rs.map((r) => r.status).join(',');
const twice = (w, user, action, body) => w.together([1, 2].map(() => () => w.api(user, action, body, true)));

{ // жеребьёвка, раскрытие, завершение, удаление события
  const { w, ev, people, sent, audit } = await world();
  let rs = await twice(w, adm, 'admin.draw', { event: ev.id });
  add('admin.draw ×2', sent(people[0], 'Жеребьёвка в событии') === 1 && audit('draw') === 1, `ответы ${st(rs)}; сообщений участнику: ${sent(people[0], 'Жеребьёвка в событии')}; журнал: ${audit('draw')}`);
  rs = await twice(w, adm, 'admin.reveal', { event: ev.id });
  add('admin.reveal ×2', sent(people[0], 'Тайна раскрыта') === 1 && audit('reveal') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[0], 'Тайна раскрыта')}; журнал: ${audit('reveal')}`);
  rs = await twice(w, adm, 'admin.event.finish', { event: ev.id });
  add('admin.event.finish ×2', sent(people[0], 'завершено') === 1 && audit('finish') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[0], 'завершено')}; журнал: ${audit('finish')}`);
  rs = await twice(w, boss, 'admin.event.delete', { event: ev.id, confirm: 'УДАЛИТЬ' });
  add('admin.event.delete ×2', sent(people[0], 'удалено организатором') === 1 && audit('event.delete') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[0], 'удалено организатором')}; журнал: ${audit('event.delete')}`);
}
{ // отмены жеребьёвки
  const { w, ev, people, sent, audit } = await world({ draw: true });
  let rs = await twice(w, adm, 'admin.draw.cancel', { event: ev.id });
  add('admin.draw.cancel ×2', sent(people[0], 'отменил жеребьёвку') === 1 && audit('draw.cancel') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[0], 'отменил жеребьёвку')}; журнал: ${audit('draw.cancel')}`);
  await w.api(boss, 'admin.draw', { event: ev.id });
  rs = await twice(w, boss, 'admin.draw.cancel.force', { event: ev.id, confirm: 'ОТМЕНА' });
  add('admin.draw.cancel.force ×2', sent(people[0], 'отменил жеребьёвку') === 2 && audit('draw.cancel.force') === 1, `ответы ${st(rs)}; журнал: ${audit('draw.cancel.force')}`);
}
{ // удаление и вписывание после жеребьёвки
  const { w, ev, people, sent, audit, orphans } = await world({ draw: true });
  let rs = await twice(w, adm, 'admin.remove', { event: ev.id, id: people[0].id });
  add('admin.remove ×2 (один человек, после жеребьёвки)', audit('member.remove') === 1 && orphans() === 0 && sent(people[0], 'удалил тебя') === 1, `ответы ${st(rs)}; журнал: ${audit('member.remove')}; сообщений удалённому: ${sent(people[0], 'удалил тебя')}`);
  rs = await w.together([() => w.api(adm, 'admin.remove', { event: ev.id, id: people[1].id }, true), () => w.api(adm2, 'admin.remove', { event: ev.id, id: people[2].id }, true)]);
  add('admin.remove двух разных людей одновременно', orphans() === 0, `ответы ${st(rs)} (второй просит повторить); пар с не-участником: ${orphans()}`);
  const late = { id: 777, name: 'Опоздавший', username: 'late' };
  await w.api(boss, 'admin.registration', { event: ev.id, open: true });
  await w.say(late, '/start ' + inviteOf(await w.api(boss, 'admin.state', { event: ev.id })));
  await w.say(late, late.name);
  rs = await twice(w, boss, 'admin.insert', { event: ev.id, id: late.id });
  const inPairs = w.query(`SELECT COUNT(*) AS n FROM pairs WHERE event_id = ${ev.id} AND santa = ${late.id}`)[0].n;
  add('admin.insert ×2', audit('member.insert') === 1 && inPairs === 1 && sent(late, 'Ты в игре') === 1, `ответы ${st(rs)}; журнал: ${audit('member.insert')}; сообщений вписанному: ${sent(late, 'Ты в игре')}`);
}
{ // до жеребьёвки: удаление, исключения, рассылки без захвата
  const { w, ev, people, sent, audit } = await world();
  let rs = await twice(w, adm, 'admin.remove', { event: ev.id, id: people[0].id });
  add('admin.remove ×2 (до жеребьёвки)', audit('member.remove') === 1 && sent(people[0], 'удалил тебя') === 1, `ответы ${st(rs)}; журнал: ${audit('member.remove')}; сообщений: ${sent(people[0], 'удалил тебя')}`);
  rs = await twice(w, adm, 'admin.exclusion.add', { event: ev.id, giver: people[1].id, receiver: people[2].id });
  add('admin.exclusion.add ×2', audit('exclusion.add') === 1, `ответы ${st(rs)}; журнал: ${audit('exclusion.add')} (исключение одно)`);
  rs = await twice(w, adm, 'admin.announce', { event: ev.id, text: 'Привет' });
  add('admin.announce ×2', sent(people[1], 'Объявление') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[1], 'Объявление')} (захвата нет)`);
  rs = await twice(w, adm, 'admin.remind.unfilled', { event: ev.id });
  add('admin.remind.unfilled ×2', sent(people[1], 'Напоминание') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[1], 'Напоминание')} (захвата нет)`);
  rs = await twice(w, boss, 'admin.reset.full', { event: ev.id, confirm: 'СБРОС' });
  add('admin.reset.full ×2', sent(people[1], 'начал событие') === 1 && audit('reset') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[1], 'начал событие')}; журнал: ${audit('reset')} (захвата нет)`);
}
{ // «Я участвую» выкл ↔ жеребьёвка: оба порядка записи
  let { w, ev, orphans } = await world();
  await w.api(adm, 'admin.participate', { event: ev.id, on: true });
  const pair = () => [() => w.api(adm, 'admin.participate', { event: ev.id, on: false }, true), () => w.api(boss, 'admin.draw', { event: ev.id }, true)];
  let rs = await w.together(pair());
  add('«Я участвую» выкл ↔ admin.draw (участие пишется первым)', orphans() === 0, `ответы ${st(rs)}; пар с не-участником: ${orphans()}`);
  ({ w, ev, orphans } = await world());
  await w.api(adm, 'admin.participate', { event: ev.id, on: true });
  rs = await w.together(pair(), { writeOrder: [1, 0] });
  add('«Я участвую» выкл ↔ admin.draw (жеребьёвка пишется первой)', orphans() === 0, `ответы ${st(rs)}; пар с не-участником: ${orphans()}`);
  // Для сравнения: штатное удаление в том же порядке защищено (здесь — через beforeWrite)
  let people;
  ({ w, ev, orphans, people } = await world());
  w.beforeWrite('DELETE FROM members WHERE event_id = ? AND user_id = ?', () => w.api(boss, 'admin.draw', { event: ev.id }));
  const r2 = await w.api(adm, 'admin.remove', { event: ev.id, id: people[0].id }, true);
  add('admin.remove ↔ admin.draw (жеребьёвка пишется первой)', orphans() === 0 && r2.status === 400, `ответ ${r2.status}; пар с не-участником: ${orphans()}`);
}
{ // заявки
  const { w, ev, sent, audit, code } = await world({ approval: true });
  const guest = { id: 888, name: 'Гость', username: 'guest' };
  await w.say(guest, '/start ' + code);
  await w.say(guest, guest.name);
  const req = w.query(`SELECT id FROM join_requests WHERE user_id = ${guest.id}`)[0];
  const rs = await w.together([() => w.api(adm, 'admin.request.decide', { event: ev.id, id: req.id, approve: true }, true), () => w.api(adm2, 'admin.request.decide', { event: ev.id, id: req.id, approve: false }, true)]);
  const got = sent(guest, 'Заявка одобрена') + sent(guest, 'не одобрил заявку');
  add('admin.request.decide: один принимает, другой отклоняет', got === 1, `ответы ${st(rs)}; сообщений гостю: ${got}; журнал approve/reject: ${audit('request.approve')}/${audit('request.reject')}`);
}
{ // обращения
  const { w, ev, people, sent, audit } = await world();
  await w.api(people[0], 'support.send', { event: ev.id, text: 'Помогите' });
  const th = w.query('SELECT id FROM support_threads')[0].id;
  let rs = await w.together([() => w.api(adm, 'admin.support.take', { event: ev.id, thread: th }, true), () => w.api(adm2, 'admin.support.take', { event: ev.id, thread: th }, true)]);
  add('admin.support.take двумя админами', audit('support.take') === 1 && sent(people[0], 'взял(а)') === 1, `ответы ${st(rs)}; журнал: ${audit('support.take')}; сообщений автору: ${sent(people[0], 'взял(а)')}`);
  await w.api(people[1], 'support.send', { event: ev.id, text: 'И мне' });
  const th2 = w.query('SELECT id FROM support_threads ORDER BY id DESC')[0].id;
  rs = await w.together([() => w.api(adm, 'admin.support.send', { event: ev.id, thread: th2, text: 'Отвечаю' }, true), () => w.api(adm2, 'admin.support.send', { event: ev.id, thread: th2, text: 'И я' }, true)]);
  const answers = w.query(`SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ${th2} AND from_admin = 1`)[0].n;
  add('ответ двух админов на ничьё обращение', answers === 1, `ответы ${st(rs)}; ответов записано: ${answers}; сообщений автору: ${sent(people[1], 'отвечает')}`);
  const assignee = w.query(`SELECT assignee FROM support_threads WHERE id = ${th2}`)[0].assignee;
  const who = assignee === adm.id ? adm : adm2;
  rs = await w.together([() => w.api(who, 'admin.support.close', { event: ev.id, thread: th2 }, true), () => w.api(people[1], 'support.close', { event: ev.id }, true)]);
  add('закрытие обращения админом и участником одновременно', audit('support.close') === 1, `ответы ${st(rs)}; журнал: ${audit('support.close')}`);
}
{ // перенос участия: новый аккаунт уже участник того же события (до жеребьёвки)
  const { w, ev, people, sent, audit } = await world();
  await w.api(people[0], 'wishlist.save', { event: ev.id, text: 'Письмо старого аккаунта' });
  const before = w.query(`SELECT COUNT(*) AS n FROM members WHERE event_id = ${ev.id}`)[0].n;
  const rs = await twice(w, boss, 'admin.transfer', { from: people[0].id, to: people[1].id });
  const after = w.query(`SELECT COUNT(*) AS n FROM members WHERE event_id = ${ev.id}`)[0].n;
  const kept = w.query(`SELECT wishlist FROM members WHERE event_id = ${ev.id} AND user_id = ${people[1].id}`)[0];
  add('admin.transfer ×2 (новый аккаунт уже в событии)', !!kept && audit('transfer') === 1,
    `ответы ${st(rs)}; участников было ${before}, стало ${after} (ожидалось ${before - 1}); участие нового аккаунта: ${kept ? 'есть' : 'ПРОПАЛО вместе с письмом'}; журнал: ${audit('transfer')}; сообщений новому: ${sent(people[1], 'перенёс на этот аккаунт')}`);
}
{ // роли, семья, владение
  const { w, people, sent, audit } = await world();
  let rs = await twice(w, boss, 'admin.role.grant', { id: people[0].id });
  add('admin.role.grant ×2', sent(people[0], 'назначил тебя администратором') === 1, `ответы ${st(rs)}; сообщений: ${sent(people[0], 'назначил тебя администратором')} (захвата нет)`);
  rs = await twice(w, boss, 'admin.family.save', { name: 'Ивановы', members: [people[1].id, people[2].id] });
  const fams = w.query('SELECT COUNT(*) AS n FROM families')[0].n;
  add('admin.family.save ×2 (новая семья)', fams === 1 && rs.every((r) => r.status !== 500), `ответы ${st(rs)}; семей создано: ${fams} (второй вызов — 500 «Ошибка сервера»)`);
  rs = await twice(w, boss, 'admin.owner.transfer', { id: adm.id });
  add('admin.owner.transfer ×2', sent(adm, 'переданы права владельца') === 1, `ответы ${st(rs)}; сообщений новому владельцу: ${sent(adm, 'переданы права владельца')}; журнал: ${audit('owner.transfer')} (захвата нет)`);
}
{ // ссылка владельца: двое одновременно
  const w = await startWorld();
  const s = await w.setup();
  const a = { id: 1, name: 'Первый', username: 'a' };
  const b = { id: 2, name: 'Второй', username: 'b' };
  await w.together([() => w.say(a, '/start ' + s.adminCode), () => w.say(b, '/start ' + s.adminCode)]);
  const admins = w.query('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')[0].n;
  add('ссылка владельца: двое одновременно', admins === 1, `администраторов после перехода: ${admins}`);
}
{ // «подарок получен»: признак захвата — метка времени
  const { w, ev, people, sent } = await world({ draw: true });
  const p = w.query(`SELECT santa, ward FROM pairs WHERE event_id = ${ev.id} LIMIT 1`)[0];
  const all = [boss, adm, adm2, ...people];
  const ward = all.find((u) => u.id === p.ward);
  const santa = all.find((u) => u.id === p.santa);
  const rs = await w.together([1, 2].map(() => () => w.api(ward, 'ward.received', { event: ev.id, received: true }, true)), { sameMoment: true });
  add('ward.received ×2 (в одну миллисекунду)', sent(santa, 'получил подарок') === 1, `ответы ${st(rs)}; сообщений Санте: ${sent(santa, 'получил подарок')}`);
}

const pad = (x, n) => String(x).padEnd(n);
// Строка «api failed … UNIQUE constraint failed» выше таблицы — ожидаемая: это 500 от admin.family.save ×2
for (const [v, name, detail] of rows) console.log(pad(v, 15), pad(name, 58), detail);
const bad = rows.filter((r) => r[0] !== 'один результат').length;
console.log(`\nитого: ${rows.length} проверок, один результат — ${rows.length - bad}, дубль или порча — ${bad}`);

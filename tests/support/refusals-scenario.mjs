// Эталон отказов API (019, FR-1910): для каждого действия — код и текст ответа без прав, на несуществующем событии, без
// события, на завершённом событии (свежем, с адресом доставки, завершённом больше недели назад). Эталон снят до
// перехода на таблицу действий (`tests/fixtures/make-api-refusals.mjs`) и не пересоздаётся: тест
// `tests/api-refusals.test.mjs` прогоняет тот же сценарий и сравнивает целиком.
//
// Мир детерминирован: номера событий — по порядку создания, вызовы — в одном и том же порядке, тела минимальные (без
// слов подтверждения, людей и текстов) — опасные действия получают отказ по данным, а не по правам. Админ и владелец
// в ситуациях `admin` и `owner` вызывают каждое действие на свежем событии (как tests/rights.test.mjs).
//
// Действия, появившиеся после эталона (035: NEW_ACTIONS, 038: NEW_ACTIONS_038, 041, 048, 051, 061, 063), проходят те
// же ситуации отдельными проходами в самом конце — номера событий и тексты прежних случаев не сдвигаются; их ответы —
// новые ключи эталона «035 …», «038 …», «041 …», «048 …», «051 …», «061 …» и «063 …» (063 — ещё и второй мир,
// открытый бот: «063 open …»). 062: действий семей и маски (040) нет; 063: нет действий комнат (051, 052) и
// admin.events.create, admin.users; 064: нет адреса, отметок подарка, посылки (042) и напоминания Сантам — их ответы из
// эталона удалены (tests/api-refusals.test.mjs).
import { startWorld } from './world.mjs';

// 50 действий в порядке таблицы ACTIONS (src/api.js): 10 участника, 2 общих админа, 38 — в пределах события (062: без
// admin.families, admin.family.save, admin.family.delete; 063: без admin.events.create и admin.users, admin.audit и
// действия ролей — действия события; 064: без delivery.save, ward.gift, ward.received, admin.remind.santas)
export const ACTION_LIST = [
  'me', 'notify.set', 'event.get', 'wishlist.save', 'ward.get',
  'message.send', 'chat.get', 'support.get', 'support.send', 'support.close',
  'admin.rename', 'admin.transfer',
  'admin.state', 'admin.audit', 'admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer', 'admin.wishlist', 'admin.game', 'admin.ring', 'admin.registration', 'admin.invite.regen',
  'admin.avoid_previous', 'admin.participate', 'admin.remove', 'admin.removed.allow', 'admin.insert',
  'admin.exclusion.add', 'admin.exclusion.del', 'admin.fixed.add', 'admin.fixed.del', 'admin.draw.check', 'admin.draw',
  'admin.draw.cancel', 'admin.draw.cancel.force', 'admin.support.get', 'admin.support.take', 'admin.support.send',
  'admin.support.pass', 'admin.support.close', 'admin.announce', 'admin.request.decide', 'admin.remind.unfilled',
  'admin.reveal', 'admin.event.finish', 'admin.event.invite_from', 'admin.event.delete',
  'admin.vault.person', 'admin.vault.pairs', 'admin.reset.full',
];
// Неизвестные действия идут тем же путём, что и известные (админа — до события, участника — до участия)
export const UNKNOWN = ['admin.nope', 'nope'];
// 035: своё имя и выход из события
export const NEW_ACTIONS = ['name.set', 'event.leave'];
// 038: значок у имени и открытка письма
export const NEW_ACTIONS_038 = ['card.set'];
export const NEW_ACTIONS_041 = ['wishlist.draft', 'wishlist.publish'];
// 048: обмен подопечных после жеребьёвки — только владелец
export const NEW_ACTIONS_048 = ['admin.draw.swap.check', 'admin.draw.swap'];
// 051: действия владельца бота (063: без действий комнат)
export const NEW_ACTIONS_051 = ['bot.owner.transfer', 'bot.audit'];
// 061: выбор языка
export const NEW_ACTIONS_061 = ['lang.set'];
// 063: создание события и раздел «Владелец бота»
export const NEW_ACTIONS_063 = ['event.create', 'bot.events', 'bot.people', 'bot.creator.set'];

const MISSING = 999999;
const WEEK = 7 * 24 * 3600 * 1000;

const boss = { id: 9101, name: 'Владелец', username: 'boss' };
const adm = { id: 9102, name: 'Админ', username: 'adm' };
const member = { id: 9103, name: 'Участник', username: 'member' };
const outsider = { id: 9104, name: 'Посторонний', username: 'outsider' };
const stranger = { id: 9105, name: 'Незнакомец', username: 'stranger' };

const body = (event) => ({ ...(event === undefined ? {} : { event }), id: 0, from: 0, to: 0, giver: 0, receiver: 0 });

export async function runRefusals() {
  const w = await startWorld();
  const cases = {};
  const record = async (key, user, action, b) => {
    const r = await w.api(user, action, b, true);
    cases[key] = { status: r.status, error: r.data.ok ? null : r.data.error };
  };

  // ---------- мир ----------
  const s = await w.setup();
  await w.say(boss, '/start ' + s.adminCode);
  await w.say(boss, boss.name);
  let n = 0;
  const create = async (title) => (await w.api(boss, 'event.create', { participate: false, title })).event.id;
  const fresh = () => create('Свежее ' + ++n);
  const join = async (ev, users) => {
    const link = (await w.api(boss, 'admin.state', { event: ev })).settings.invite_link;
    const code = /start=(inv_[a-z0-9]+)/.exec(link)[1];
    for (const u of users) {
      const known = w.query('SELECT registered FROM users WHERE tg_id = ?', u.id)[0]?.registered;
      await w.say(u, '/start ' + code);
      if (!known) await w.say(u, u.name);
    }
  };
  const O = await create('Прихожая');
  await join(O, [adm, outsider]);
  await w.api(boss, 'admin.role.grant', { event: O, id: adm.id });
  // 063: администратор — свой у каждого события. Прежде он был администратором комнаты и не участвовал в событиях —
  // так и здесь: строка организатора без участия (назначить через API можно только участника)
  const withAdmin = (ev) => {
    w.sql(`INSERT INTO event_admins (event_id, user_id, created_at) VALUES (${ev}, ${adm.id}, 1)`);
    return ev;
  };
  const E = withAdmin(await create('Идёт'));
  await join(E, [member]);
  const F = withAdmin(await create('Завершено'));
  await join(F, [member]);
  await w.api(boss, 'admin.event.finish', { event: F });
  const FD = withAdmin(await create('Завершено с адресом'));
  w.sql(`UPDATE events SET delivery_on = 1 WHERE id = ${FD}`); // 064: как оставил прежний код — ответы от этого не зависят
  await join(FD, [member]);
  await w.api(boss, 'admin.event.finish', { event: FD });
  const FO = withAdmin(await create('Завершено давно'));
  await join(FO, [member]);
  await w.api(boss, 'admin.event.finish', { event: FO });
  w.sql(`UPDATE events SET finished_at = finished_at - ${WEEK + 3600 * 1000} WHERE id = ${FO}`);

  const all = [...ACTION_LIST, ...UNKNOWN];
  // ---------- ситуации: кто, на каком событии ----------
  const situations = [
    ['stranger', stranger, () => E],
    ['outsider', outsider, () => E],
    ['member', member, () => E],
    ['admin', adm, async () => withAdmin(await fresh())],
    ['owner', boss, fresh],
    ['missing-owner', boss, () => MISSING],
    ['missing-admin', adm, () => MISSING],
    ['missing-member', member, () => MISSING],
    ['none-owner', boss, () => undefined],
    ['none-admin', adm, () => undefined],
    ['none-member', member, () => undefined],
    ['finished-owner', boss, () => F],
    ['finished-admin', adm, () => F],
    ['finished-member', member, () => F],
    ['finished-delivery-member', member, () => FD],
    ['finished-old-owner', boss, () => FO],
    ['finished-old-admin', adm, () => FO],
    ['finished-old-member', member, () => FO],
  ];
  for (const [name, user, ev] of situations) {
    for (const a of all) await record(`${name} ${a}`, user, a, body(await ev()));
  }

  // ---------- точечные случаи: порядок своих отказов, слово подтверждения, условные права ----------
  const extra = [
    ['invite_from-finished-owner', boss, 'admin.event.invite_from', { event: F, from: E }],
    ['invite_from-finished-admin', adm, 'admin.event.invite_from', { event: F, from: E }],
    ['invite_from-same', boss, 'admin.event.invite_from', { event: E, from: E }],
    ['cancel.force-word', boss, 'admin.draw.cancel.force', async () => ({ event: await fresh(), confirm: ' отмена ' })],
    ['cancel.force-word-admin', adm, 'admin.draw.cancel.force', async () => ({ event: withAdmin(await fresh()), confirm: 'ОТМЕНА' })],
    ['reset.full-word', boss, 'admin.reset.full', async () => ({ event: await fresh(), confirm: 'сброс' })],
    ['reset.full-word-finished', boss, 'admin.reset.full', { event: F, confirm: 'СБРОС' }],
    ['event.delete-word', boss, 'admin.event.delete', async () => ({ event: await fresh(), confirm: 'Удалить' })],
    ['event.delete-word-admin', adm, 'admin.event.delete', async () => ({ event: withAdmin(await fresh()), confirm: 'УДАЛИТЬ' })],
    ['rename-owner-by-admin', adm, 'admin.rename', { id: boss.id, name: 'Иной' }],
    ['rename-self-admin', adm, 'admin.rename', { id: adm.id, name: adm.name }],
    ['rename-admin-by-owner', boss, 'admin.rename', { id: adm.id, name: adm.name }],
    ['remove-owner', adm, 'admin.remove', { event: E, id: boss.id }],
    ['remove-self', adm, 'admin.remove', { event: E, id: adm.id }],
    ['remove-not-member', adm, 'admin.remove', { event: E, id: outsider.id }],
    ['transfer-owner-record', boss, 'admin.transfer', { from: boss.id, to: outsider.id }],
    ['transfer-to-admin', boss, 'admin.transfer', { from: outsider.id, to: adm.id }],
    ['audit-event-zero', boss, 'admin.audit', { event: 0 }],
    ['audit-event-finished', adm, 'admin.audit', { event: F }],
    ['wishlist-finished', member, 'wishlist.save', { event: F, text: 'Книга' }],
    ['event.get-admin', adm, 'event.get', { event: E }],
    ['ward.get-admin', adm, 'ward.get', { event: E }],
    ['notify.set-stranger', stranger, 'notify.set', { mode: 'off' }],
    ['notify.set-bad', member, 'notify.set', { mode: 'loud' }],
    // 025: слово служебного просмотра и отклонение заявки в завершённом событии (в конце — номера событий прежних случаев
    // не сдвигаются)
    ['vault.pairs-word', boss, 'admin.vault.pairs', async () => ({ event: await fresh(), confirm: ' открыть ' })],
    ['vault.person-word-wrong', boss, 'admin.vault.person', { event: E, id: member.id, confirm: 'СБРОС' }],
    ['vault.pairs-word-admin', adm, 'admin.vault.pairs', { event: E, confirm: 'ОТКРЫТЬ' }],
    ['request.decide-approve-finished', adm, 'admin.request.decide', { event: F, id: 0, approve: true }],
  ];
  for (const [name, user, action, b] of extra) {
    await record(`extra ${name}`, user, action, typeof b === 'function' ? await b() : b);
  }

  // Не POST и неверная подпись — до любых проверок прав
  const get = await w.request('/api/admin.state', { method: 'GET' });
  cases['extra GET'] = { status: get.status, error: (await get.json()).error };
  const forged = await w.api('user=%7B%7D&hash=00', 'admin.state', { event: E }, true);
  cases['extra forged'] = { status: forged.status, error: forged.data.error };

  // ---------- 035: новые действия — те же ситуации; слово, имя и выход после жеребьёвки ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS) await record(`035 ${name} ${a}`, user, a, body(await ev()));
  }
  const D = await create('С жеребьёвкой');
  await join(D, [member, outsider]);
  await w.api(boss, 'admin.participate', { event: D, on: true });
  await w.api(boss, 'admin.draw', { event: D });
  const extra035 = [
    ['leave-word-wrong', member, 'event.leave', { event: E, confirm: 'УДАЛИТЬ' }],
    ['leave-word-finished', member, 'event.leave', { event: F, confirm: 'ВЫЙТИ' }],
    ['leave-after-draw', member, 'event.leave', { event: D, confirm: ' выйти ' }],
    ['name-blank', member, 'name.set', { name: '   ' }],
    ['name-long', member, 'name.set', { name: 'я'.repeat(41) }],
  ];
  for (const [name, user, action, b] of extra035) await record(`035 extra ${name}`, user, action, b);

  // ---------- 038: значок и открытка — те же ситуации; не из набора, открытка в завершённом ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_038) await record(`038 ${name} ${a}`, user, a, body(await ev()));
  }
  const extra038 = [
    ['card-unknown', member, 'card.set', { event: E, card: 'nope' }],
    ['card-finished', member, 'card.set', { event: F, card: 'snow' }],
  ];
  for (const [name, user, action, b] of extra038) await record(`038 extra ${name}`, user, action, b);

  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_041) await record(`041 ${name} ${a}`, user, a, body(await ev()));
  }
  // ---------- 048: обмен подопечных — те же ситуации; один человек дважды, не в жеребьёвке, «сам себе», версия ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_048) await record(`048 ${name} ${a}`, user, a, body(await ev()));
  }
  const S = withAdmin(await create('Обмен'));
  await join(S, [member, outsider, adm]);
  await w.api(boss, 'admin.draw', { event: S });
  const wardOf = (id) => w.query('SELECT ward FROM pairs WHERE event_id = ? AND santa = ?', S, id)[0].ward;
  const version = w.query('SELECT draw_token FROM events WHERE id = ?', S)[0].draw_token;
  const extra048 = [
    ['swap.check-same', boss, 'admin.draw.swap.check', { event: S, a: member.id, b: member.id }],
    ['swap.check-not-in-draw', boss, 'admin.draw.swap.check', { event: S, a: member.id, b: stranger.id }],
    ['swap.check-no-draw', boss, 'admin.draw.swap.check', { event: E, a: member.id, b: outsider.id }],
    ['swap-self', boss, 'admin.draw.swap', { event: S, a: member.id, b: wardOf(member.id), version }],
    ['swap-stale', boss, 'admin.draw.swap', { event: S, a: member.id, b: outsider.id, version: 'old' }],
    ['swap.check-admin', adm, 'admin.draw.swap.check', { event: S, a: member.id, b: outsider.id }],
  ];
  for (const [name, user, action, b] of extra048) await record(`048 extra ${name}`, user, action, b);

  // ---------- 051: компании — те же ситуации; названия, повтор создания, слово, «есть события», владелец ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_051) await record(`051 ${name} ${a}`, user, a, body(await ev()));
  }
  const extra051 = [
    ['owner.transfer-admin', adm, 'admin.owner.transfer', { event: E, id: adm.id }],
    ['owner.transfer-self', boss, 'admin.owner.transfer', { event: E, id: boss.id }],
    ['owner.transfer-stranger', boss, 'admin.owner.transfer', { event: E, id: stranger.id }],
    ['owner.transfer-no-company', boss, 'admin.owner.transfer', { id: adm.id }],
    ['bot.owner.transfer-self', boss, 'bot.owner.transfer', { id: boss.id }],
    ['bot.owner.transfer-admin', adm, 'bot.owner.transfer', { id: adm.id }],
    ['rename-many-companies', adm, 'admin.rename', { id: member.id, name: 'Иное' }],
  ];
  for (const [name, user, action, b] of extra051) await record(`051 extra ${name}`, user, action, b);

  // ---------- 061: выбор языка — те же ситуации; код не из списка, язык и «как в Telegram» ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_061) await record(`061 ${name} ${a}`, user, a, body(await ev()));
  }
  const extra061 = [
    ['unknown', member, 'lang.set', { lang: 'xx' }],
    ['upper', member, 'lang.set', { lang: 'RU' }],
    ['proto', member, 'lang.set', { lang: 'constructor' }],
    ['ru', member, 'lang.set', { lang: 'ru' }],
    ['auto', member, 'lang.set', { lang: '' }],
  ];
  for (const [name, user, action, b] of extra061) await record(`061 extra ${name}`, user, action, b);

  // ---------- 063: создание события и «Владелец бота» — те же ситуации; разрешение, название, образец, роли ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_063) await record(`063 ${name} ${a}`, user, a, body(await ev()));
  }
  const extra063 = [
    ['create-no-right', member, 'event.create', { title: 'Своё' }],
    ['create-blank', boss, 'event.create', { title: '   ' }],
    ['create-long', boss, 'event.create', { title: 'я'.repeat(81) }],
    ['create-template-missing', boss, 'event.create', { title: 'По образцу', from: MISSING }],
    ['grant-not-member', boss, 'admin.role.grant', { event: E, id: outsider.id }],
    ['grant-again', boss, 'admin.role.grant', { event: E, id: adm.id }],
    ['grant-by-admin', adm, 'admin.role.grant', { event: E, id: member.id }],
    ['revoke-owner', boss, 'admin.role.revoke', { event: E, id: boss.id }],
    ['revoke-not-admin', boss, 'admin.role.revoke', { event: E, id: member.id }],
    ['owner-not-member', boss, 'admin.owner.transfer', { event: E, id: outsider.id }],
    ['rename-by-owner-only', adm, 'admin.rename', { id: member.id, name: 'Иное' }],
    ['creator-not-registered', boss, 'bot.creator.set', { id: stranger.id, on: true }],
    ['creator-off-already', boss, 'bot.creator.set', { id: member.id, on: false }],
    ['audit-no-event', adm, 'admin.audit', {}],
  ];
  for (const [name, user, action, b] of extra063) await record(`063 extra ${name}`, user, action, b);
  // Создатель без разрешения после разрешения — может; образец чужого события — «Образец не найден.»
  await w.api(boss, 'bot.creator.set', { id: member.id, on: true });
  await record('063 extra create-template-foreign', member, 'event.create', { title: 'Чужой образец', from: E });
  await record('063 extra creator-on-already', boss, 'bot.creator.set', { id: member.id, on: true });
  await openRefusals(cases);
  return { actions: ACTION_LIST, cases };
}

// 063: открытый бот — люди без ссылки создают события: название, лимит, разрешений нет
async function openRefusals(cases) {
  const o = await startWorld({ open: true });
  const record = async (key, user, action, b) => {
    const r = await o.api(user, action, b, true);
    cases[`063 open ${key}`] = { status: r.status, error: r.data.ok ? null : r.data.error };
    return r.data;
  };
  const s = await o.setup();
  await o.say(boss, '/start ' + s.adminCode);
  await o.say(boss, boss.name);
  const anya = { id: 9201, name: 'Аня', username: 'anya' };
  const borya = { id: 9202, name: 'Боря', username: 'borya' };
  for (const u of [anya, borya]) {
    await o.say(u, '/start');
    await o.say(u, u.name);
  }
  await record('create-blank', anya, 'event.create', { title: '   ' });
  for (let i = 1; i <= 10; i++) await record('create-' + i, anya, 'event.create', { title: 'Событие ' + i });
  // Дата в тексте лимита зависит от дня прогона — в эталоне только начало текста
  const limit = await o.api(anya, 'event.create', { title: 'Одиннадцатое' }, true);
  cases['063 open create-limit'] = { status: limit.status, error: limit.data.error.replace(/ — с .*$/, ' — с …') };
  await record('creator-set-open', boss, 'bot.creator.set', { id: borya.id, on: true });
  await record('people-not-bot-owner', borya, 'bot.people', {});
}

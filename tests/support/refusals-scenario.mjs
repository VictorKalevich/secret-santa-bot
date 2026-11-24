// Эталон отказов API (019, FR-1910): для каждого действия — код и текст ответа без прав, на несуществующем событии, без
// события, на завершённом событии (свежем, с адресом доставки, завершённом больше недели назад). Эталон снят до
// перехода на таблицу действий (`tests/fixtures/make-api-refusals.mjs`) и не пересоздаётся: тест
// `tests/api-refusals.test.mjs` прогоняет тот же сценарий и сравнивает целиком.
//
// Мир детерминирован: номера событий — по порядку создания, вызовы — в одном и том же порядке, тела минимальные (без
// слов подтверждения, людей и текстов) — опасные действия получают отказ по данным, а не по правам. Админ и владелец
// в ситуациях `admin` и `owner` вызывают каждое действие на свежем событии (как tests/rights.test.mjs).
//
// Действия, появившиеся после эталона (035: NEW_ACTIONS, 038: NEW_ACTIONS_038, 040: NEW_ACTIONS_040, 041, 042, 048, 051,
// 052), проходят те же ситуации отдельными проходами в самом конце — номера событий и тексты прежних случаев не сдвигаются;
// их ответы — новые ключи эталона «035 …», «038 …», «040 …», «041 …», «042 …», «048 …», «051 …» и «052 …» (052 — ещё и
// второй мир, открытый бот: «052 open …»).
import { startWorld } from './world.mjs';

// 59 действий в порядке прежних `case` в src/api.js: 13 участника, 11 общих админа, 35 — в пределах события
export const ACTION_LIST = [
  'me', 'notify.set', 'event.get', 'wishlist.save', 'delivery.save', 'ward.get', 'ward.gift', 'ward.received',
  'message.send', 'chat.get', 'support.get', 'support.send', 'support.close',
  'admin.events.create', 'admin.families', 'admin.family.save', 'admin.family.delete', 'admin.audit', 'admin.users',
  'admin.rename', 'admin.transfer', 'admin.role.grant', 'admin.role.revoke', 'admin.owner.transfer',
  'admin.state', 'admin.wishlist', 'admin.game', 'admin.ring', 'admin.registration', 'admin.invite.regen',
  'admin.avoid_previous', 'admin.participate', 'admin.remove', 'admin.removed.allow', 'admin.insert',
  'admin.exclusion.add', 'admin.exclusion.del', 'admin.fixed.add', 'admin.fixed.del', 'admin.draw.check', 'admin.draw',
  'admin.draw.cancel', 'admin.draw.cancel.force', 'admin.support.get', 'admin.support.take', 'admin.support.send',
  'admin.support.pass', 'admin.support.close', 'admin.announce', 'admin.request.decide', 'admin.remind.unfilled',
  'admin.remind.santas', 'admin.reveal', 'admin.event.finish', 'admin.event.invite_from', 'admin.event.delete',
  'admin.vault.person', 'admin.vault.pairs', 'admin.reset.full',
];
// Неизвестные действия идут тем же путём, что и известные (админа — до события, участника — до участия)
export const UNKNOWN = ['admin.nope', 'nope'];
// 035: своё имя и выход из события
export const NEW_ACTIONS = ['name.set', 'event.leave'];
// 038: значок у имени и открытка письма
export const NEW_ACTIONS_038 = ['card.set'];
// 040: маска Санты в переписке
export const NEW_ACTIONS_040 = ['mask.set'];
export const NEW_ACTIONS_042 = ['ward.shipment'];
export const NEW_ACTIONS_041 = ['wishlist.draft', 'wishlist.publish'];
// 048: обмен подопечных после жеребьёвки — только владелец
export const NEW_ACTIONS_048 = ['admin.draw.swap.check', 'admin.draw.swap'];
// 051: компании — своё название и действия владельца бота
export const NEW_ACTIONS_051 = ['company.label.set', 'bot.company.create', 'bot.company.link', 'bot.company.delete', 'bot.owner.transfer', 'bot.audit'];
// 052: открытый бот — своя компания
export const NEW_ACTIONS_052 = ['company.create', 'company.delete'];

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
  // Компания 1 — явно: после 051 у владельца бота их две
  const create = async (title) => (await w.api(boss, 'admin.events.create', { title, company: 1 })).event.id;
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
  await w.api(boss, 'admin.role.grant', { id: adm.id });
  const E = await create('Идёт');
  await join(E, [member]);
  const F = await create('Завершено');
  await join(F, [member]);
  await w.api(boss, 'admin.event.finish', { event: F });
  const FD = await create('Завершено с адресом');
  await w.api(boss, 'admin.game', { event: FD, delivery_on: true });
  await join(FD, [member]);
  await w.api(boss, 'admin.event.finish', { event: FD });
  const FO = await create('Завершено давно');
  await join(FO, [member]);
  await w.api(boss, 'admin.event.finish', { event: FO });
  w.sql(`UPDATE events SET finished_at = finished_at - ${WEEK + 3600 * 1000} WHERE id = ${FO}`);

  const all = [...ACTION_LIST, ...UNKNOWN];
  // ---------- ситуации: кто, на каком событии ----------
  const situations = [
    ['stranger', stranger, () => E],
    ['outsider', outsider, () => E],
    ['member', member, () => E],
    ['admin', adm, fresh],
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
    ['cancel.force-word-admin', adm, 'admin.draw.cancel.force', async () => ({ event: await fresh(), confirm: 'ОТМЕНА' })],
    ['reset.full-word', boss, 'admin.reset.full', async () => ({ event: await fresh(), confirm: 'сброс' })],
    ['reset.full-word-finished', boss, 'admin.reset.full', { event: F, confirm: 'СБРОС' }],
    ['event.delete-word', boss, 'admin.event.delete', async () => ({ event: await fresh(), confirm: 'Удалить' })],
    ['event.delete-word-admin', adm, 'admin.event.delete', async () => ({ event: await fresh(), confirm: 'УДАЛИТЬ' })],
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
    ['delivery-finished', member, 'delivery.save', { event: FD, text: 'Минск' }],
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

  // ---------- 040: маска — те же ситуации; не из набора, в завершённом, без подопечного, после раскрытия ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_040) await record(`040 ${name} ${a}`, user, a, body(await ev()));
  }
  const extra040 = [
    ['mask-unknown', member, 'mask.set', { event: D, mask: 'nope' }],
    ['mask-finished', member, 'mask.set', { event: F, mask: 'dragon' }],
    ['mask-no-ward', member, 'mask.set', { event: E, mask: 'dragon' }],
    ['mask-ok', member, 'mask.set', { event: D, mask: 'dragon' }],
  ];
  for (const [name, user, action, b] of extra040) await record(`040 extra ${name}`, user, action, b);
  await w.api(boss, 'admin.reveal', { event: D });
  await record('040 extra mask-revealed', member, 'mask.set', { event: D, mask: 'ghost' });

  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_041) await record(`041 ${name} ${a}`, user, a, body(await ev()));
  }
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_042) await record(`042 ${name} ${a}`, user, a, body(await ev()));
  }
  // ---------- 048: обмен подопечных — те же ситуации; один человек дважды, не в жеребьёвке, «сам себе», версия ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_048) await record(`048 ${name} ${a}`, user, a, body(await ev()));
  }
  const S = await create('Обмен');
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
  // Участник — ещё и во второй компании: имя меняет он сам
  const second = (await w.api(boss, 'bot.company.create', { name: 'Работа' })).company;
  w.sql(`INSERT INTO company_members (company_id, user_id, is_admin, joined_at) VALUES (${second}, ${member.id}, 0, 1)`);
  const extra051 = [
    ['create-repeat', boss, 'bot.company.create', { name: 'Работа' }],
    ['label-long', member, 'company.label.set', { company: 1, label: 'я'.repeat(41) }],
    ['label-missing', member, 'company.label.set', { company: MISSING, label: 'Своя' }],
    ['label-not-visible', outsider, 'company.label.set', { company: second, label: 'Своя' }],
    ['create-blank', boss, 'bot.company.create', { name: '   ' }],
    ['create-long', boss, 'bot.company.create', { name: 'я'.repeat(41) }],
    ['link-missing', boss, 'bot.company.link', { company: MISSING, on: true }],
    ['delete-word', boss, 'bot.company.delete', { company: 1, confirm: 'СБРОС' }],
    ['delete-has-events', boss, 'bot.company.delete', { company: 1, confirm: 'УДАЛИТЬ' }],
    ['delete-missing', boss, 'bot.company.delete', { company: MISSING, confirm: 'УДАЛИТЬ' }],
    ['owner.transfer-admin', adm, 'admin.owner.transfer', { company: 1, id: adm.id }],
    ['owner.transfer-self', boss, 'admin.owner.transfer', { company: 1, id: boss.id }],
    ['owner.transfer-stranger', boss, 'admin.owner.transfer', { company: 1, id: stranger.id }],
    ['owner.transfer-no-company', boss, 'admin.owner.transfer', { id: adm.id }],
    ['bot.owner.transfer-self', boss, 'bot.owner.transfer', { id: boss.id }],
    ['bot.owner.transfer-admin', adm, 'bot.owner.transfer', { id: adm.id }],
    ['rename-many-companies', adm, 'admin.rename', { id: member.id, name: 'Иное' }],
  ];
  for (const [name, user, action, b] of extra051) await record(`051 extra ${name}`, user, action, b);

  // ---------- 052: своя компания — те же ситуации в закрытом боте, затем открытый бот ----------
  for (const [name, user, ev] of situations) {
    for (const a of NEW_ACTIONS_052) await record(`052 ${name} ${a}`, user, a, body(await ev()));
  }
  const extra052 = [
    ['create-closed', member, 'company.create', { name: 'Своя' }],
    ['create-bot-owner-blank', boss, 'company.create', { name: '   ' }],
    ['delete-closed', member, 'company.delete', { company: second, confirm: 'УДАЛИТЬ' }],
    ['delete-word', boss, 'company.delete', { company: second, confirm: 'СБРОС' }],
    ['delete-has-events', boss, 'company.delete', { company: 1, confirm: 'УДАЛИТЬ' }],
  ];
  for (const [name, user, action, b] of extra052) await record(`052 extra ${name}`, user, action, b);
  await openRefusals(cases);
  return { actions: ACTION_LIST, cases };
}

// 052: открытый бот — люди без ссылки, свои компании: название, повтор, лимит, удаление (слово, чужая, не владелец, есть
// события), общее название
async function openRefusals(cases) {
  const o = await startWorld({ open: true });
  const record = async (key, user, action, b) => {
    const r = await o.api(user, action, b, true);
    cases[`052 open ${key}`] = { status: r.status, error: r.data.ok ? null : r.data.error };
    return r.data;
  };
  await o.setup();
  const anya = { id: 9201, name: 'Аня', username: 'anya' };
  const borya = { id: 9202, name: 'Боря', username: 'borya' };
  for (const u of [anya, borya]) {
    await o.say(u, '/start');
    await o.say(u, u.name);
  }
  await record('create-blank', anya, 'company.create', { name: '   ' });
  await record('create-long', anya, 'company.create', { name: 'я'.repeat(41) });
  const X = (await record('create-first', anya, 'company.create', { name: 'Своя' })).company;
  await record('create-repeat', anya, 'company.create', { name: 'Своя' });
  const Y = (await record('create-second', anya, 'company.create', { name: 'Вторая' })).company;
  await record('create-limit', anya, 'company.create', { name: 'Третья' });
  await record('label-blank', anya, 'company.label.set', { company: X, label: '  ' });
  await record('delete-word', anya, 'company.delete', { company: Y, confirm: 'СБРОС' });
  await record('delete-missing', anya, 'company.delete', { company: MISSING, confirm: 'УДАЛИТЬ' });
  await record('delete-not-visible', borya, 'company.delete', { company: X, confirm: 'УДАЛИТЬ' });
  o.sql(`INSERT INTO company_members (company_id, user_id, is_admin, joined_at) VALUES (${X}, ${borya.id}, 1, 1)`);
  await record('delete-not-owner', borya, 'company.delete', { company: X, confirm: 'УДАЛИТЬ' });
  await o.api(anya, 'admin.events.create', { company: X, title: 'Ёлка' });
  await record('delete-has-events', anya, 'company.delete', { company: X, confirm: 'УДАЛИТЬ' });
  await record('delete-own', anya, 'company.delete', { company: Y, confirm: 'УДАЛИТЬ' });
  await record('create-after-delete', anya, 'company.create', { name: 'Третья' });
}

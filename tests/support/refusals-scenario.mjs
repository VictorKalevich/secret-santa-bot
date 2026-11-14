// Эталон отказов API (019, FR-1910): для каждого действия — код и текст ответа без прав, на несуществующем событии, без
// события, на завершённом событии (свежем, с адресом доставки, завершённом больше недели назад). Эталон снят до
// перехода на таблицу действий (`tests/fixtures/make-api-refusals.mjs`) и не пересоздаётся: тест
// `tests/api-refusals.test.mjs` прогоняет тот же сценарий и сравнивает целиком.
//
// Мир детерминирован: номера событий — по порядку создания, вызовы — в одном и том же порядке, тела минимальные (без
// слов подтверждения, людей и текстов) — опасные действия получают отказ по данным, а не по правам. Админ и владелец
// в ситуациях `admin` и `owner` вызывают каждое действие на свежем событии (как tests/rights.test.mjs).
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
  const create = async (title) => (await w.api(boss, 'admin.events.create', { title })).event.id;
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
  ];
  for (const [name, user, action, b] of extra) {
    await record(`extra ${name}`, user, action, typeof b === 'function' ? await b() : b);
  }

  // Не POST и неверная подпись — до любых проверок прав
  const get = await w.request('/api/admin.state', { method: 'GET' });
  cases['extra GET'] = { status: get.status, error: (await get.json()).error };
  const forged = await w.api('user=%7B%7D&hash=00', 'admin.state', { event: E }, true);
  cases['extra forged'] = { status: forged.status, error: forged.data.error };

  return { actions: ACTION_LIST, cases };
}

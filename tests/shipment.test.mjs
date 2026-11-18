import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { shipmentWorld } from './support/shipment-world.mjs';
import { restoreFetch } from './support/world.mjs';

after(restoreFetch);
test('042: реквизиты только у пары; отправка, правка, отмена, повтор и старые формы', async () => {
  const { w, event, call, admin, santa, recipient, outsidePair } = await shipmentWorld();
  const outgoing = async () => (await call(santa, 'ward.get')).shipment;
  const incoming = async () => (await call(recipient, 'event.get')).member.shipment;
  const save = (version, sent, fields) => call(santa, 'ward.shipment', { version, sent, ...fields });
  const notifications = () => w.calls.filter(c => c.method === 'sendMessage' &&
    c.params.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url.includes('shipment=1'));
  await w.api(recipient, 'notify.set', { mode: 'silent' });
  let { version } = await outgoing();
  for (const date of ['2020-02-31', '2999-01-01']) await assert.rejects(save(version, true, { date }), /день/);
  const body = { event, version, sent: true };
  const race = await w.together([1, 2].map(() => () => w.api(santa, 'ward.shipment', body, true)));
  assert.deepEqual(race.map(r => r.status), [200, 400]);
  assert.equal((await call(santa, 'ward.get')).gift_ready, true);
  await assert.rejects(call(santa, 'ward.gift', { ready: false }), /сними отметку/);
  version = race[0].data.shipment.version;
  for (let bits = 0; bits < 8; bits++) {
    const fields = { date: bits & 1 ? '2024-02-29' : '', carrier: bits & 2 ? 'Почта-042' : '', tracking: bits & 4 ? '000-AB-042' : '' };
    version = (await save(version, true, fields)).shipment.version;
    assert.deepEqual(await incoming(), { sent: true, ...fields });
  }
  for (const [who, action, args] of [[admin, 'admin.state'], [admin, 'admin.vault.person', { id: santa.id, confirm: 'ОТКРЫТЬ' }],
    [outsidePair, 'ward.get'], [outsidePair, 'event.get'], [admin, 'admin.audit']]) {
    const data = await call(who, action, args);
    assert.doesNotMatch(JSON.stringify(data), /000-AB-042|Почта-042|2024-02-29/);
    if (action === 'admin.state') assert.equal(data.users.find(u => u.id === santa.id).gift_sent, true);
  }
  assert.equal(notifications().length, 1);
  assert.equal(notifications()[0].params.disable_notification, true);
  assert.equal(notifications()[0].params.chat_id, recipient.id);
  assert.doesNotMatch(notifications()[0].params.text, /000-AB-042|Почта-042/);
  await call(admin, 'admin.game', { delivery_on: false });
  assert.equal(await incoming(), undefined);
  assert.equal(await outgoing(), undefined);
  await assert.rejects(save(version, false), /выключена/);
  await call(admin, 'admin.game', { delivery_on: true });
  await call(recipient, 'ward.received', { received: true });
  const reset = await save(version, false);
  assert.deepEqual(await incoming(), { sent: false });
  assert.equal((await call(recipient, 'event.get')).member.gift_received, true);
  assert.equal((await call(santa, 'ward.get')).gift_ready, true);
  const resent = await save(reset.shipment.version, true);
  await assert.rejects(save(version, false), /изменились/);
  assert.equal(notifications().length, 3);
  await w.api(recipient, 'notify.set', { mode: 'off' });
  await save(resent.shipment.version, false);
  assert.equal(notifications().length, 3);
  const old = await outgoing();
  await call(admin, 'admin.draw.cancel.force', { confirm: 'ОТМЕНА' });
  await call(admin, 'admin.draw');
  await assert.rejects(save(old.version, true), /изменились/);
  await call(admin, 'admin.event.finish');
  await assert.rejects(save((await outgoing()).version, true), /завершено/);
});

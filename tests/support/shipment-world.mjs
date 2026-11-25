import { startWorld } from './world.mjs';

export async function shipmentWorld() {
  const w = await startWorld();
  const people = ['Организатор', 'Санта', 'Участник', 'Игрок'].map((name, i) => ({ name, id: 900 + i }));
  const [admin, santa] = people;
  await w.say(admin, '/start ' + (await w.setup()).adminCode);
  await w.say(admin, admin.name);
  const event = (await w.api(admin, 'event.create', { participate: false, title: 'Доставка' })).event.id;
  const call = (who, action, body) => w.api(who, action, { event, ...body });
  const invite = (await call(admin, 'admin.state')).settings.invite_link.split('start=')[1];
  await call(admin, 'admin.participate', { on: true });
  for (const u of people.slice(1)) {
    await w.say(u, '/start ' + invite);
    await w.say(u, u.name);
  }
  await call(admin, 'admin.game', { delivery_on: true });
  await call(admin, 'admin.fixed.add', { giver: santa.id, receiver: people[2].id });
  await call(admin, 'admin.draw');
  return { w, event, call, admin, santa, recipient: people[2], outsidePair: people[3] };
}

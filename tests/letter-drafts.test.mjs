import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, restoreFetch } from './support/world.mjs';

after(restoreFetch);

test('041: черновик личный, публикация явная, устаревшие записи отклоняются', async () => {
  const w = await startWorld();
  const admin = { id: 101, name: 'Санта' }, author = { id: 102, name: 'Автор' };
  await w.say(admin, '/start ' + (await w.setup()).adminCode);
  await w.say(admin, admin.name);
  const event = (await w.api(admin, 'event.create', { participate: false, title: 'Черновики' })).event.id;
  const call = (who, action, body) => w.api(who, action, { event, ...body });
  const mode = (on) => call(admin, 'admin.game', { letter_drafts: on });
  const mine = async () => (await call(author, 'event.get')).member;
  const settings = (await call(admin, 'admin.state')).settings;
  await w.say(author, '/start ' + settings.invite_link.split('start=')[1]);
  await w.say(author, author.name);
  await call(admin, 'admin.participate', { on: true });
  await call(admin, 'admin.ring', { on: false });
  await call(admin, 'admin.draw');
  assert.equal(settings.letter_drafts, false);
  assert.equal((await mine()).draft, undefined);
  await mode(true);
  const initial = (await mine()).draft;
  const write = (action, text, revision) => call(author, action, { text, revision, joined_at: initial.joined_at });
  const privateText = 'Личный черновик ещё не для Санты';
  const first = await write('wishlist.draft', privateText, initial.revision);
  assert.equal((await mine()).wishlist_updated_at, 0);
  const before = w.calls.length;
  await w.cron();
  assert.equal(w.calls.slice(before).some(c => c.params.text?.includes('обновил письмо')), false);
  for (const [action, body] of [['ward.get'], ['event.get'], ['admin.state'], ['admin.wishlist', { id: author.id }],
    ['admin.vault.person', { id: author.id, confirm: 'ОТКРЫТЬ' }]]) {
    assert.ok(!JSON.stringify(await call(admin, action, body)).includes(privateText), action);
  }
  await assert.rejects(write('wishlist.publish', privateText, initial.revision), /изменились/);
  await assert.rejects(write('wishlist.publish', '  ', first.revision), /Напиши письмо/);
  await assert.rejects(write('wishlist.draft', 'x'.repeat(4001), first.revision), /4000/);
  await assert.rejects(call(author, 'wishlist.save', { text: 'старый клиент' }), /Включены черновики/);
  const publication = await write('wishlist.publish', 'Книгу', first.revision);
  assert.equal((await call(admin, 'ward.get')).ward.wishlist, 'Книгу');
  assert.equal((await mine()).draft.text, null);
  await w.cron();
  assert.ok(w.texts(admin).some(text => text.includes('обновил письмо')));
  const snapshot = { event, text: 'Шарф', revision: publication.revision, joined_at: initial.joined_at };
  const results = await w.together(['Шарф', 'Свитер'].map(text => () => w.api(author, 'wishlist.draft', { ...snapshot, text }, true)));
  assert.deepEqual(results.map(r => r.status), [200, 400]);
  assert.equal((await mine()).wishlist_updated_at, publication.updated_at);
  await mode(false);
  assert.equal((await mine()).draft, undefined);
  await assert.rejects(write('wishlist.publish', 'Шарф', publication.revision + 1), /выключены/);
  await mode(true);
  assert.equal((await mine()).draft.stale, false);
  await mode(false);
  await call(author, 'wishlist.save', { text: 'Свежая публикация' });
  await mode(true);
  assert.equal((await mine()).draft.text, 'Шарф');
  assert.equal((await mine()).draft.stale, true);
  assert.equal((await call(admin, 'ward.get')).ward.wishlist, 'Свежая публикация');
  await call(admin, 'admin.event.finish');
  await assert.rejects(write('wishlist.publish', 'Шарф', (await mine()).draft.revision), /завершено/);
});

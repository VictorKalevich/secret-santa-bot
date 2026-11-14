// Тестовые секреты и подпись initData (016): общие для быстрых тестов («мир») и e2e (tests/harness.mjs).
// Без child_process и сети — быстрым тестам не нужен модуль, который запускает wrangler.
import { createHmac } from 'node:crypto';

export const TOKEN = '123456TESTTOKEN';
export const ADMIN_SECRET = 'super-secret-admin';

// Подпись initData так же, как это делает Telegram.
export function initData(user, { authDate = Math.floor(Date.now() / 1000), token = TOKEN } = {}) {
  const p = new URLSearchParams();
  p.set('auth_date', String(authDate));
  p.set('query_id', 'AAQ' + user.id);
  p.set('user', JSON.stringify({ id: user.id, first_name: user.name, username: user.username }));
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}

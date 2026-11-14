// Контекст вызова (019): один объект на вызов API, сообщение боту и запуск расписания. Функции модулей получают его
// первым параметром. Настройки, список пользователей и владелец читаются не больше одного раза на вызов и лениво
// (кроме начала вызова API и сообщения боту: пользователь и настройки — одним пакетом). Кэш живёт, пока живёт вызов;
// упавшее чтение кэш сбрасывает (шаги расписания изолированы: ошибка одного не отравляет следующий).

import { readMany, userQuery, settingsQuery, settingsFrom, usersQuery, getSettings, allUsers } from './db.js';
import { resolveOwner } from './roles.js';

// Обещание в кэше; при ошибке — забыть его
function remember(promise, forget) {
  promise.catch(forget);
  return promise;
}

// Служебные имена кэшируемых чтений в пакете ctx.read (не пересекаются с именами вызывающего)
const USERS = '\u0000users';
const SETTINGS = '\u0000settings';

export function makeContext(env,{ me = null, settings = null } = {}) {
  const db = env.DB;
  let settingsP = settings ? Promise.resolve(settings) : null;
  let usersP = null;
  let ownerP = null;

  const ctx = {
    env,
    db,
    me,
    settings: () => (settingsP ||= remember(getSettings(db), () => { settingsP = null; })),
    users: () => (usersP ||= remember(allUsers(db), () => { usersP = null; })),
    // resolveOwner может записать нового владельца (самый ранний админ, если прежний недействителен): в вызове admin.*
    // его вычисляют сразу после проверки «админ» (api.js), как раньше
    ownerId: () => (ownerP ||= remember(
      Promise.all([ctx.settings(), ctx.users()]).then(([s, u]) => resolveOwner(db, s, u)),
      () => { ownerP = null; },
    )),
    isOwner: async () => !!ctx.me && (await ctx.ownerId()) === ctx.me.tg_id,
    // Пакет именованных чтений; users: true / settings: true — из кэша или в этом же пакете
    async read({ users = false, settings: wantSettings = false, ...named } = {}) {
      const q = { ...named };
      const withUsers = users && !usersP;
      const withSettings = wantSettings && !settingsP;
      if (withUsers) q[USERS] = usersQuery(db);
      if (withSettings) q[SETTINGS] = settingsQuery(db);
      const r = await readMany(db, q);
      if (withUsers) usersP = Promise.resolve(r[USERS]);
      if (withSettings) settingsP = Promise.resolve(settingsFrom(r[SETTINGS]));
      delete r[USERS];
      delete r[SETTINGS];
      if (users) r.users = await ctx.users();
      if (wantSettings) r.settings = await ctx.settings();
      return r;
    },
    // Вызов сам добавил пользователя (ссылка владельца в чате): следующее чтение списка — заново
    forgetUsers() {
      usersP = null;
      ownerP = null;
    },
  };
  return ctx;
}

// Начало вызова API и сообщения боту: пользователь и настройки — одним пакетом
export async function openContext(env, userId) {
  const r = await readMany(env.DB, { me: userQuery(env.DB, userId), settings: settingsQuery(env.DB) });
  return makeContext(env, { me: r.me[0] ?? null, settings: settingsFrom(r.settings) });
}

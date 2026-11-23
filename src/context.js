// Контекст вызова (019): один объект на вызов API, сообщение боту и запуск расписания. Функции модулей получают его
// первым параметром. Настройки, список пользователей и владелец читаются не больше одного раза на вызов и лениво
// (кроме начала вызова API и сообщения боту: пользователь, настройки, его компании, компании и владелец бота — одним
// пакетом). Кэш живёт, пока живёт вызов; упавшее чтение кэш сбрасывает (шаги расписания изолированы: ошибка одного не
// отравляет следующий).
//
// Компании (050, specs/050-company-scope/contracts/company-scope.md): общий контекст знает компании, свои строки
// вызывающего и владельца бота; ctx.in(companyId) — контекст, привязанный к компании: users(), ownerId(), isOwner(),
// me.is_admin и read({ users: true }) в нём значат «в этой компании». Модули работают только с привязанным контекстом.

import {
  readMany, userQuery, settingsQuery, settingsFrom, usersQuery, getSettings, allUsers,
  companiesQuery, myCompaniesQuery, botOwnerQuery, companyUsersQuery, companyUsersFrom,
} from './db.js';
import { resolveOwner, resolveBotOwner } from './roles.js';

// Обещание в кэше; при ошибке — забыть его
function remember(promise, forget) {
  promise.catch(forget);
  return promise;
}

// Служебные имена кэшируемых чтений в пакете ctx.read (не пересекаются с именами вызывающего)
const USERS = '\u0000users';
const SETTINGS = '\u0000settings';
const COMPANIES = '\u0000companies';

const companiesFrom = (rows) => new Map(rows.map((c) => [c.id, { id: c.id, owner_id: c.owner_id }]));
const mineFrom = (rows) => new Map(rows.map((r) => [r.company_id, { is_admin: r.is_admin, label: r.label }]));

// first — строки первого пакета (openContext): mine, companies, owner (запись владельца бота по настройке)
export function makeContext(env, { me = null, settings = null, first = null } = {}) {
  const db = env.DB;
  let settingsP = settings ? Promise.resolve(settings) : null;
  let companiesP = first ? Promise.resolve(companiesFrom(first.companies)) : null;
  let mineP = first ? Promise.resolve(mineFrom(first.mine)) : null;
  let ownerRowP = first ? Promise.resolve(first.owner[0] ?? null) : null;
  let botOwnerP = null;
  let usersP = null;
  let ownerP = null;
  const bound = new Map();
  const live = new Set(); // готовые привязанные контексты (forgetUsers сбрасывает и их людей)

  // Пакет именованных чтений с кэшируемыми: users — заданным запросом людей (общий или компании)
  async function readWith(cache, { users = false, settings: wantSettings = false, companies: wantCompanies = false, ...named }) {
    const q = { ...named };
    const withUsers = users && !cache.get();
    const withSettings = wantSettings && !settingsP;
    const withCompanies = wantCompanies && !companiesP;
    if (withUsers) q[USERS] = cache.query();
    if (withSettings) q[SETTINGS] = settingsQuery(db);
    if (withCompanies) q[COMPANIES] = companiesQuery(db);
    const r = await readMany(db, q);
    if (withUsers) cache.set(Promise.resolve(cache.from(r[USERS])));
    if (withSettings) settingsP = Promise.resolve(settingsFrom(r[SETTINGS]));
    if (withCompanies) companiesP = Promise.resolve(companiesFrom(r[COMPANIES]));
    delete r[USERS];
    delete r[SETTINGS];
    delete r[COMPANIES];
    if (users) r.users = await cache.users();
    if (wantSettings) r.settings = await ctx.settings();
    if (wantCompanies) r.companies = await ctx.companies();
    return r;
  }

  const ctx = {
    env,
    db,
    me,
    settings: () => (settingsP ||= remember(getSettings(db), () => { settingsP = null; })),
    companies: () => (companiesP ||= remember(readMany(db, { c: companiesQuery(db) }).then((r) => companiesFrom(r.c)), () => { companiesP = null; })),
    mine: () => (mineP ||= remember(
      me ? readMany(db, { m: myCompaniesQuery(db, me.tg_id) }).then((r) => mineFrom(r.m)) : Promise.resolve(new Map()),
      () => { mineP = null; },
    )),
    // Владелец бота (resolveOwner): запись по настройке owner_id действительна — она; иначе — самый ранний админ компаний,
    // которые ведёт владелец бота. Может записать нового владельца в настройки
    botOwnerId: () => (botOwnerP ||= remember((async () => {
      if (!ownerRowP) {
        const r = await readMany(db, { owner: botOwnerQuery(db), ...(settingsP ? {} : { settings: settingsQuery(db) }) });
        if (!settingsP) settingsP = Promise.resolve(settingsFrom(r.settings));
        ownerRowP = Promise.resolve(r.owner[0] ?? null);
      }
      return resolveBotOwner(db, await ctx.settings(), await ownerRowP);
    })(), () => { botOwnerP = null; })),
    isBotOwner: async () => !!me && (await ctx.botOwnerId()) === me.tg_id,
    // Единственная компания вызывающего (общее действие организатора без поля company) или 0: у человека — единственная
    // его строка; у владельца бота — единственная компания бота
    async soleCompany() {
      const mine = await ctx.mine();
      if (mine.size === 1) return [...mine.keys()][0];
      if (await ctx.isBotOwner()) {
        const all = await ctx.companies();
        if (all.size === 1) return [...all.keys()][0];
      }
      return 0;
    },
    // Контекст компании; компании нет — null. Один объект на компанию за вызов
    in(companyId) {
      const id = Number(companyId) || 0;
      if (!bound.has(id)) bound.set(id, remember(bindCompany(ctx, id), () => bound.delete(id)));
      return bound.get(id);
    },
    // Временно (до снятия в 050, T019): общий список людей и владелец — как до компаний
    users: () => (usersP ||= remember(allUsers(db), () => { usersP = null; })),
    ownerId: () => (ownerP ||= remember(
      Promise.all([ctx.settings(), ctx.users()]).then(([s, u]) => resolveOwner(db, s, u)),
      () => { ownerP = null; },
    )),
    isOwner: async () => !!ctx.me && (await ctx.ownerId()) === ctx.me.tg_id,
    read(want = {}) {
      return readWith({
        get: () => usersP,
        set: (p) => { usersP = p; },
        query: () => usersQuery(db),
        from: (rows) => rows,
        users: () => ctx.users(),
      }, want);
    },
    // Вызов сам добавил пользователя (ссылка владельца в чате): следующее чтение списка и владельца — заново
    forgetUsers() {
      usersP = null;
      ownerP = null;
      ownerRowP = null;
      botOwnerP = null;
      for (const c of live) c.forgetUsers();
    },
  };

  // Привязанный контекст: наследует общий, переопределяет людей, владельца и права вызывающего
  async function bindCompany(base, id) {
    const company = (await base.companies()).get(id);
    if (!company) return null;
    let me = base.me;
    if (me) {
      const row = (await base.mine()).get(id);
      const organizer = !!row?.is_admin || company.owner_id === me.tg_id || (await base.isBotOwner());
      me = { ...me, is_admin: organizer ? 1 : 0 };
    }
    let cUsersP = null;
    const c = Object.create(base);
    Object.assign(c, {
      company,
      me,
      users: () => (cUsersP ||= remember(
        readMany(db, { u: companyUsersQuery(db, id) }).then((r) => companyUsersFrom(r.u)),
        () => { cUsersP = null; },
      )),
      ownerId: async () => company.owner_id || (await base.botOwnerId()) || null,
      isOwner: async () => !!me && ((await c.ownerId()) === me.tg_id || (await base.isBotOwner())),
      read(want = {}) {
        return readWith({
          get: () => cUsersP,
          set: (p) => { cUsersP = p; },
          query: () => companyUsersQuery(db, id),
          from: companyUsersFrom,
          users: () => c.users(),
        }, want);
      },
      forgetUsers() {
        cUsersP = null;
      },
    });
    live.add(c);
    return c;
  }

  return ctx;
}

// Начало вызова API, сообщения боту и нажатия кнопки: пользователь, настройки, его компании, компании и запись
// владельца бота — одним пакетом
export async function openContext(env, userId) {
  const db = env.DB;
  const r = await readMany(db, {
    me: userQuery(db, userId),
    settings: settingsQuery(db),
    mine: myCompaniesQuery(db, userId),
    companies: companiesQuery(db),
    owner: botOwnerQuery(db),
  });
  return makeContext(env, { me: r.me[0] ?? null, settings: settingsFrom(r.settings), first: r });
}

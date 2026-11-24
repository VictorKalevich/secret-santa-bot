// Контекст вызова (019): один объект на вызов API, сообщение боту и запуск расписания. Функции модулей получают его
// первым параметром. Настройки, список пользователей и владелец читаются не больше одного раза на вызов и лениво
// (кроме начала вызова API и сообщения боту: пользователь, настройки, его строки компаний, его компании и владелец бота —
// одним пакетом). Кэш живёт, пока живёт вызов; упавшее чтение кэш сбрасывает (шаги расписания изолированы: ошибка одного не
// отравляет следующий).
//
// Компании (050, specs/050-company-scope/contracts/company-scope.md): общий контекст знает компании вызывающего (055:
// свои; владельцу бота — все; любую другую — company(id) по номеру), свои строки вызывающего и владельца бота; ctx.in(companyId) — контекст, привязанный к компании: users(), ownerId(), isOwner(),
// me.is_admin и read({ users: true }) в нём значат «в этой компании». Модули работают только с привязанным контекстом:
// у общего users(), ownerId(), isOwner() и read({ users: true }) бросают ошибку «контекст без компании».

import {
  readMany, userQuery, settingsQuery, settingsFrom, getSettings,
  companiesQuery, companyQuery, myCompaniesQuery, botOwnerQuery, companyUsersQuery, companyUsersFrom,
} from './db.js';
import { resolveOwner } from './roles.js';
import { ownerWord } from './format.js';
import { langOf, translator } from './i18n/index.js';

// Обещание в кэше; при ошибке — забыть его
function remember(promise, forget) {
  promise.catch(forget);
  return promise;
}

// Служебные имена кэшируемых чтений в пакете ctx.read (не пересекаются с именами вызывающего)
const USERS = '\u0000users';
const SETTINGS = '\u0000settings';
const COMPANY = '\u0000company';

// name и link (051) — только для ответов владельцу бота; name при shared (052) — и людям компании
const companiesFrom = (rows) => new Map(rows.map((c) => [c.id, { id: c.id, owner_id: c.owner_id, name: c.name, link: !!c.link, shared: !!c.shared }]));

// Люди, владелец и «я владелец» есть только у контекста компании (ctx.in): общий контекст их не знает
const noCompany = () => {
  throw new Error('контекст без компании');
};
const mineFrom = (rows) => new Map(rows.map((r) => [r.company_id, { is_admin: r.is_admin, label: r.label, joined_at: r.joined_at }]));

// first — строки первого пакета (openContext): mine, companies, owner (запись владельца бота по настройке)
export function makeContext(env, { me = null, settings = null, first = null } = {}) {
  const db = env.DB;
  let settingsP = settings ? Promise.resolve(settings) : null;
  // 055: компании первого пакета — свои; all — все (вызывающий — владелец бота по настройке, как условие companiesQuery)
  let firstCompanies = first
    ? { map: companiesFrom(first.companies), all: !!me && Number(settings?.owner_id || 0) === me.tg_id }
    : null;
  let companiesP = null;
  const one = new Map(); // компании по номеру (company): id → обещание строки или null
  let mineP = first ? Promise.resolve(mineFrom(first.mine)) : null;
  let ownerRowP = first ? Promise.resolve(first.owner[0] ?? null) : null;
  let botOwnerP = null;
  const bound = new Map();
  const live = new Set(); // готовые привязанные контексты (forgetUsers сбрасывает и их людей)

  // Пакет именованных чтений с кэшируемыми: users — заданным запросом людей (общий или компании); inCompany — строка
  // компании для ctx.in тем же пакетом (055: человек ещё не в компании — вступление по ссылке)
  async function readWith(cache, { users = false, settings: wantSettings = false, inCompany = 0, ...named }) {
    const q = { ...named };
    const withUsers = users && !cache.get();
    const withSettings = wantSettings && !settingsP;
    const withCompany = inCompany && !one.has(inCompany) && !firstCompanies?.map.has(inCompany);
    if (withUsers) q[USERS] = cache.query();
    if (withSettings) q[SETTINGS] = settingsQuery(db);
    if (withCompany) q[COMPANY] = companyQuery(db, inCompany);
    const r = await readMany(db, q);
    if (withUsers) cache.set(Promise.resolve(cache.from(r[USERS])));
    if (withSettings) settingsP = Promise.resolve(settingsFrom(r[SETTINGS]));
    if (withCompany) one.set(inCompany, Promise.resolve(companiesFrom(r[COMPANY]).get(inCompany) ?? null));
    delete r[USERS];
    delete r[SETTINGS];
    delete r[COMPANY];
    if (users) r.users = await cache.users();
    if (wantSettings) r.settings = await ctx.settings();
    return r;
  }

  const lang = langOf(me);
  const ctx = {
    env,
    db,
    me,
    // 060: язык вызывающего (без человека — по умолчанию) и строки словаря на нём; привязанный контекст наследует
    lang,
    t: translator(lang),
    settings: () => (settingsP ||= remember(getSettings(db), () => { settingsP = null; })),
    // Компании, которые знает вызывающий (055): свои — по его строкам компаний; владельцу бота — все. Владелец бота,
    // найденный запасным поиском (resolveOwner записал его в настройки), дочитывает все; без вызывающего — ни одной
    companies: () => (companiesP ||= remember((async () => {
      if (!me) return new Map();
      if (firstCompanies && (firstCompanies.all || !(await ctx.isBotOwner()))) return firstCompanies.map;
      return companiesFrom((await readMany(db, { c: companiesQuery(db, me.tg_id) })).c);
    })(), () => { companiesP = null; })),
    // Одна компания по номеру или null (055): из прочитанных — без запроса, иначе — одна строка; не больше раза за вызов
    company(id) {
      if (!one.has(id)) {
        one.set(id, remember((async () => {
          const known = firstCompanies?.map.get(id) ?? (companiesP && (await companiesP).get(id));
          if (known) return known;
          return companiesFrom((await readMany(db, { c: companyQuery(db, id) })).c).get(id) ?? null;
        })(), () => one.delete(id)));
      }
      return one.get(id);
    },
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
      return resolveOwner(db, await ctx.settings(), await ownerRowP);
    })(), () => { botOwnerP = null; })),
    isBotOwner: async () => !!me && (await ctx.botOwnerId()) === me.tg_id,
    // Единственная компания вызывающего (общее действие организатора без поля company) или 0: у человека — единственная
    // его строка; у владельца бота — единственная компания бота
    async soleCompany() {
      const set = (await ctx.isBotOwner()) ? await ctx.companies() : await ctx.mine();
      return set.size === 1 ? [...set.keys()][0] : 0;
    },
    // Контекст компании; компании нет — null. Один объект на компанию за вызов
    in(companyId) {
      const id = Number(companyId) || 0;
      if (!bound.has(id)) bound.set(id, remember(bindCompany(ctx, id), () => bound.delete(id)));
      return bound.get(id);
    },
    users: noCompany,
    ownerId: noCompany,
    isOwner: noCompany,
    ownerWord: noCompany,
    read(want = {}) {
      if (want.users) noCompany();
      return readWith({ get: noCompany }, want);
    },
    // Вызов сам добавил пользователя или сменил владельца (ссылки владельца в чате): следующее чтение людей, компаний и
    // владельца — заново
    forgetUsers() {
      ownerRowP = null;
      botOwnerP = null;
      firstCompanies = null; // 051: владелец компании мог смениться
      companiesP = null;
      one.clear();
      mineP = null; // права в компаниях могли измениться: следующий ctx.in считает их заново
      bound.clear();
      for (const c of live) c.forgetUsers();
    },
  };

  // Привязанный контекст: наследует общий, переопределяет людей, владельца и права вызывающего
  async function bindCompany(base, id) {
    const company = await base.company(id);
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
      // Как назвать того, кто может действие владельца (051): компанию ведёт владелец бота — «владелец бота»
      ownerWord: () => ownerWord(!company.owner_id),
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

// Начало вызова API, сообщения боту и нажатия кнопки: пользователь, настройки, его строки компаний, его компании (055:
// владельцу бота — все) и запись владельца бота — одним пакетом
export async function openContext(env, userId) {
  const db = env.DB;
  const r = await readMany(db, {
    me: userQuery(db, userId),
    settings: settingsQuery(db),
    mine: myCompaniesQuery(db, userId),
    companies: companiesQuery(db, userId),
    owner: botOwnerQuery(db),
  });
  return makeContext(env, { me: r.me[0] ?? null, settings: settingsFrom(r.settings), first: r });
}

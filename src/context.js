// Контекст вызова (019): один объект на вызов API, сообщение боту и запуск расписания. Функции модулей получают его
// первым параметром. Настройки, список пользователей и владелец читаются не больше одного раза на вызов и лениво
// (кроме начала вызова API и сообщения боту: пользователь, настройки, события, где он организатор, и владелец бота —
// одним пакетом). Кэш живёт, пока живёт вызов; упавшее чтение кэш сбрасывает (шаги расписания изолированы: ошибка одного не
// отравляет следующий).
//
// События (063, specs/063-events-without-rooms/research.md R3): общий контекст знает вызывающего, события, где он
// организатор, и владельца бота; ctx.at(ev) — контекст, привязанный к событию: users(), ownerId(), isOwner(), ownerWord(),
// me.is_admin и read({ users: true }) в нём значат «в этом событии». Модули работают только с привязанным контекстом:
// у общего users(), ownerId(), isOwner(), ownerWord() и read({ users: true }) бросают ошибку «контекст без события».

import {
  readMany, userQuery, settingsQuery, settingsFrom, getSettings, eventQuery,
  organizerOfQuery, botOwnerQuery, eventUsersQuery, eventUsersFrom,
} from './db.js';
import { resolveOwner } from './roles.js';
import { ownerWord } from './format.js';
import { langOf, translator } from './i18n/index.js';
import { profileFrom } from './bot-profile.js';

// Обещание в кэше; при ошибке — забыть его
function remember(promise, forget) {
  promise.catch(forget);
  return promise;
}

// Служебные имена кэшируемых чтений в пакете ctx.read (не пересекаются с именами вызывающего)
const USERS = '\u0000users';
const SETTINGS = '\u0000settings';

// Люди, владелец и «я владелец» есть только у контекста события (ctx.at): общий контекст их не знает
const noEvent = () => {
  throw new Error('контекст без события');
};
const organizerFrom = (rows) => new Set(rows.map((r) => r.event_id));

// first — строки первого пакета (openContext): organizer (события, где вызывающий организатор), owner (запись владельца
// бота по настройке)
export function makeContext(env, { me = null, settings = null, first = null, telegramLang = '' } = {}) {
  const db = env.DB;
  let settingsP = settings ? Promise.resolve(settings) : null;
  let organizerP = first ? Promise.resolve(organizerFrom(first.organizer)) : null;
  let ownerRowP = first ? Promise.resolve(first.owner[0] ?? null) : null;
  let botOwnerP = null;
  const bound = new Map();
  const live = new Set(); // готовые привязанные контексты (forgetUsers сбрасывает и их людей)

  // Пакет именованных чтений с кэшируемыми: users — людьми события привязанного контекста
  async function readWith(cache, { users = false, settings: wantSettings = false, ...named }) {
    const q = { ...named };
    const withUsers = users && !cache.get();
    const withSettings = wantSettings && !settingsP;
    if (withUsers) q[USERS] = cache.query();
    if (withSettings) q[SETTINGS] = settingsQuery(db);
    const r = await readMany(db, q);
    if (withUsers) cache.set(Promise.resolve(cache.from(r[USERS])));
    if (withSettings) settingsP = Promise.resolve(settingsFrom(r[SETTINGS]));
    delete r[USERS];
    delete r[SETTINGS];
    if (users) r.users = await cache.users();
    if (wantSettings) r.settings = await ctx.settings();
    return r;
  }

  const lang = langOf(me, telegramLang);
  const ctx = {
    env,
    db,
    me,
    // 060: язык вызывающего (без человека — по умолчанию) и строки словаря на нём; привязанный контекст наследует.
    // 061: язык человека по правилу langOf с языком Telegram этого обращения (уже приведённым, '' — неизвестен);
    // выбор языка в том же вызове меняет оба поля (setLanguage, src/language.js)
    lang,
    t: translator(lang),
    telegramLang,
    settings: () => (settingsP ||= remember(getSettings(db), () => { settingsP = null; })),
    // События, где вызывающий организатор (строки event_admins; владелец события — тоже): номера
    organizerOf: () => (organizerP ||= remember(
      me ? readMany(db, { a: organizerOfQuery(db, me.tg_id) }).then((r) => organizerFrom(r.a)) : Promise.resolve(new Set()),
      () => { organizerP = null; },
    )),
    // Владелец бота (resolveOwner): запись по настройке owner_id действительна — она; иначе — самый ранний организатор
    // событий без владельца. Может записать нового владельца в настройки
    botOwnerId: () => (botOwnerP ||= remember((async () => {
      if (!ownerRowP) {
        const r = await readMany(db, { owner: botOwnerQuery(db), ...(settingsP ? {} : { settings: settingsQuery(db) }) });
        if (!settingsP) settingsP = Promise.resolve(settingsFrom(r.settings));
        ownerRowP = Promise.resolve(r.owner[0] ?? null);
      }
      return resolveOwner(db, await ctx.settings(), await ownerRowP);
    })(), () => { botOwnerP = null; })),
    isBotOwner: async () => !!ctx.me && (await ctx.botOwnerId()) === ctx.me.tg_id,
    // Контекст события (уже прочитанной строки events). Один объект на событие за вызов
    at(ev) {
      if (!ev?.id) throw new Error('контекст события без события');
      if (!bound.has(ev.id)) bound.set(ev.id, remember(bindEvent(ctx, ev), () => bound.delete(ev.id)));
      return bound.get(ev.id);
    },
    users: noEvent,
    ownerId: noEvent,
    isOwner: noEvent,
    ownerWord: noEvent,
    read(want = {}) {
      if (want.users) noEvent();
      return readWith({ get: noEvent }, want);
    },
    // Вызов сам добавил пользователя, сменил владельца или организаторов: следующее чтение людей, прав и владельца —
    // заново
    forgetUsers() {
      ownerRowP = null;
      botOwnerP = null;
      organizerP = null;
      bound.clear();
      for (const c of live) c.forgetUsers();
    },
  };

  // Привязанный контекст: наследует общий, переопределяет людей, владельца и права вызывающего
  async function bindEvent(base, ev) {
    let me = base.me;
    if (me) {
      const organizer = (await base.organizerOf()).has(ev.id) || (await base.isBotOwner());
      me = { ...me, is_admin: organizer ? 1 : 0 };
    }
    let cUsersP = null;
    const c = Object.create(base);
    Object.assign(c, {
      event: ev,
      me,
      users: () => (cUsersP ||= remember(
        readMany(db, { u: eventUsersQuery(db, ev.id) }).then((r) => eventUsersFrom(r.u)),
        () => { cUsersP = null; },
      )),
      ownerId: async () => ev.owner_id || (await base.botOwnerId()) || null,
      isOwner: async () => !!me && ((await c.ownerId()) === me.tg_id || (await base.isBotOwner())),
      // Как назвать того, кто может действие владельца (051): событие без владельца ведёт владелец бота
      ownerWord: () => ownerWord(!ev.owner_id),
      read(want = {}) {
        return readWith({
          get: () => cUsersP,
          set: (p) => { cUsersP = p; },
          query: () => eventUsersQuery(db, ev.id),
          from: eventUsersFrom,
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

// Начало вызова API, сообщения боту и нажатия кнопки: пользователь, настройки, события, где он организатор, и запись
// владельца бота — одним пакетом
// telegramLang — язык Telegram обращения, приведённый telegramLanguage (061); eventId — событие действия API (063): его
// строка — тем же пакетом, ctx.firstEvent (null — нет такого)
export async function openContext(env, userId, { telegramLang = '', eventId = 0 } = {}) {
  const db = env.DB;
  const id = Number(eventId) || 0;
  const r = await readMany(db, {
    me: userQuery(db, userId),
    settings: settingsQuery(db),
    organizer: organizerOfQuery(db, userId),
    owner: botOwnerQuery(db),
    ...(id ? { event: eventQuery(db, id) } : {}),
  });
  const settings = settingsFrom(r.settings);
  // 061: профиль бота ещё не весь у Telegram — afterRequest отправит часть после ответа (src/bot-profile.js)
  if (env.meter) env.meter.profile = profileFrom(settings);
  const ctx = makeContext(env, { me: r.me[0] ?? null, settings, first: r, telegramLang });
  ctx.firstEvent = r.event?.[0] ?? null;
  return ctx;
}

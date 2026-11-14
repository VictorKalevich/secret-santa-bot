// JSON API для мини-приложения. Каждый запрос подписан Telegram (initData).
// 019: каждое действие — строка таблицы ACTIONS (роль, нужно ли событие, что в завершённом событии, текст отказа
// владельца, слово подтверждения, обработчик); общие проверки — один конвейер в handleApi до обработчика, в прежнем
// порядке. Предметная логика и SQL — в модулях; здесь — разбор запроса, таблица и ответ. Контракт —
// specs/019-api-actions/contracts/api-actions.md.

import { getUser, updateUser, getEvent, getMember, getAudit } from './db.js';
import { validateInitData } from './telegram.js';
import { inviteLink, oneLine, NOT_REGISTERED, ADMIN_ONLY, NO_DRAW } from './format.js';
import { isFinished, publicEvent } from './status.js';
import { openContext } from './context.js';
import {
  createEvent, finishEvent, deleteEvent, resetEvent, inviteFromEvent, revealAll, remindUnfilled, remindSantas, announce,
  saveEventSettings, setRing, setRegistration, regenInvite, setAvoidPrevious,
} from './events.js';
import { checkDraw, runDraw, removeMember, insertMember, cancelDraw, forceCancelDraw } from './pairs.js';
import { sendChatMessage, chatHistory } from './chat.js';
import { grantAdmin, revokeAdmin, transferOwnership, transferAccount } from './roles.js';
import { saveFamily, deleteFamily, decideRequest, familiesList, participate, allowRemoved } from './membership.js';
import { vaultPerson, vaultPairs } from './vault.js';
import {
  participantView, sendFromUser, closeByUser, adminThread, take, sendFromAdmin, pass, closeByAdmin,
} from './support.js';
import { homeView, eventView, saveWishlist, saveDelivery, wardView, setGiftReady, setGiftReceived } from './participant.js';
import { adminState, memberLetter, usersList } from './panel.js';
import { changeExclusions, changeFixed } from './constraints.js';

// ---------- роли и общие отказы ----------

// ANY — любой с подписью; USER — зарегистрированный; VIEWER — участник события или админ; MEMBER — участник события;
// ADMIN — админ; OWNER — владелец бота (с текстом отказа в поле owner)
export const ROLES = Object.freeze({ ANY: 'any', USER: 'user', VIEWER: 'viewer', MEMBER: 'member', ADMIN: 'admin', OWNER: 'owner' });
const { ANY, USER, VIEWER, MEMBER, ADMIN, OWNER } = ROLES;

// Завершённый эвент — только просмотр, раскрытие, удаление и приглашение его участников в новый. Сброс запрещён: он
// вернул бы эвент в «идёт», а завершение необратимо (FR-506).
const CLOSED = 'Событие завершено — менять его уже нельзя (доступны просмотр, раскрытие и удаление).';
const onlyOwner = (what) => `${what} может только владелец бота.`;
const ROLES_OWNER = onlyOwner('Назначать и снимать администраторов');
const VAULT_OWNER = 'Служебный просмотр доступен только владельцу бота.';
const LETTER_CLOSED = 'Событие завершено: письмо теперь только для чтения.';
const MARK_CLOSED = 'Событие завершено: отметка только для чтения.';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const fail = (error, status = 400) => json({ ok: false, error }, status);

// Отказ обработчика: тот же ответ, что fail
class Refusal {
  constructor(error, status = 400) {
    this.error = error;
    this.status = status;
  }
}
const refuse = (error, status) => new Refusal(error, status);
// Результат модуля { ok, ...данные } / { ok: false, error, status? } → данные ответа или отказ
const out = (r, pick = ({ ok, ...data }) => data) => (r.ok ? pick(r) : refuse(r.error, r.status));
const none = () => ({});
const confirmed = (body, word) => String(body.confirm || '').trim().toUpperCase() === word;

// ---------- таблица действий ----------
// Порядок строк — порядок прежних `case` (автотест e2e «владелец ⊇ админ» выполняет действия по очереди на одном
// событии). У действия события поле finished обязательно: true — разрешено в завершённом (чтение, свой отказ или
// проверка переписки внутри); строка — отказ 400 этим текстом. Условные права (зависят от данных) — в обработчиках.

export const ACTIONS = {
  // ---------- участник ----------
  me: { role: ANY, run: (ctx) => homeView(ctx) },
  'notify.set': {
    role: USER,
    async run(ctx, body) {
      if (!['sound', 'silent', 'off'].includes(body.mode)) return refuse('bad mode');
      await updateUser(ctx.db, ctx.me.tg_id, { notify_mode: body.mode });
      return {};
    },
  },
  'event.get': { role: VIEWER, event: true, finished: true, run: (ctx, body, ev, member) => eventView(ctx, ev, member) },
  'wishlist.save': { role: MEMBER, event: true, finished: LETTER_CLOSED, run: async (ctx, body, ev, member) => out(await saveWishlist(ctx, ev, member, body.text)) },
  // Свой порядок отказов: «адрес не нужен» раньше «завершено» (в модуле)
  'delivery.save': { role: MEMBER, event: true, finished: true, run: async (ctx, body, ev, member) => out(await saveDelivery(ctx, ev, member, body.text)) },
  'ward.get': { role: MEMBER, event: true, finished: true, run: (ctx, body, ev) => wardView(ctx, ev) },
  'ward.gift': { role: MEMBER, event: true, finished: MARK_CLOSED, run: async (ctx, body, ev) => out(await setGiftReady(ctx, ev, body.ready)) },
  'ward.received': { role: MEMBER, event: true, finished: MARK_CLOSED, run: async (ctx, body, ev) => out(await setGiftReceived(ctx, ev, body.received)) },
  // Переписка в завершённом — 7 суток (chat.js)
  'message.send': {
    role: MEMBER,
    event: true,
    finished: true,
    async run(ctx, body, ev) {
      const r = await sendChatMessage(ctx, ev, ctx.me.tg_id, body.to === 'santa' ? 'santa' : 'ward', body.text);
      return r.ok ? { message: r.message } : refuse(r.error);
    },
  },
  'chat.get': {
    role: MEMBER,
    event: true,
    finished: true,
    run: (ctx, body, ev) => chatHistory(ctx, ev, body.with === 'santa' ? 'santa' : 'ward', Number(body.after) || 0),
  },
  // ---------- обращения к организатору (012): изменения — пока открыта переписка (support.js) ----------
  'support.get': { role: MEMBER, event: true, finished: true, run: (ctx, body, ev) => participantView(ctx, ev) },
  'support.send': {
    role: MEMBER,
    event: true,
    finished: true,
    run: async (ctx, body, ev) => out(await sendFromUser(ctx, ev, body.text), (r) => ({ thread: r.thread, message: r.message })),
  },
  'support.close': { role: MEMBER, event: true, finished: true, run: async (ctx, body, ev) => out(await closeByUser(ctx, ev), none) },

  // ---------- администратор: общие (без события) ----------
  'admin.events.create': {
    role: ADMIN,
    async run(ctx, body) {
      let from = null;
      if (body.from) {
        from = await getEvent(ctx.db, body.from);
        if (!from) return refuse('Образец не найден.');
      }
      const r = await createEvent(ctx, body.title, ctx.me.tg_id, { from, invite: !!body.invite });
      return out(r, () => ({ event: publicEvent(r.event), invited: r.invited, invite_error: r.inviteError }));
    },
  },
  // Семьи (008) — общие для бота; адресов и пар здесь нет
  'admin.families': { role: ADMIN, run: (ctx) => familiesList(ctx) },
  // Владелец видит пары и так — заморозка семей против вычисления пар на него не действует (010, FR-1008)
  'admin.family.save': {
    role: ADMIN,
    run: async (ctx, body) => out(await saveFamily(ctx, ctx.me.tg_id, { id: body.id, name: body.name, members: body.members }), none),
  },
  'admin.family.delete': {
    role: ADMIN,
    run: async (ctx, body) => out(await deleteFamily(ctx, ctx.me.tg_id, body.id), none),
  },
  // Без поля event — общий журнал, с ним — журнал события (несуществующее — 404)
  'admin.audit': { role: ADMIN, event: 'given', finished: true, run: async (ctx, body, ev) => ({ entries: await getAudit(ctx.db, ev ? ev.id : 0) }) },
  'admin.users': { role: ADMIN, run: (ctx) => usersList(ctx) },
  'admin.rename': {
    role: ADMIN,
    async run(ctx, body) {
      const name = oneLine(body.name);
      if (!name || name.length > 40) return refuse('Имя должно быть от 1 до 40 символов');
      const target = await getUser(ctx.db, Number(body.id));
      if (!target) return refuse('Участник не найден');
      // Администраторов и владельца переименовывает только владелец; себя — любой админ (006, FR-613)
      const ownerId = await ctx.ownerId();
      if ((target.is_admin || target.tg_id === ownerId) && target.tg_id !== ctx.me.tg_id && !(await ctx.isOwner())) {
        return refuse('Переименовать администратора может только владелец бота.', 403);
      }
      await updateUser(ctx.db, target.tg_id, { name });
      return {};
    },
  },
  // Иначе админ перенёс бы участие игрока на свой второй, не-админский аккаунт и увидел его пары (010, FR-1001)
  'admin.transfer': {
    role: OWNER,
    owner: onlyOwner('Переносить участие на новый аккаунт'),
    async run(ctx, body) {
      const ownerId = await ctx.ownerId();
      const from = Number(body.from);
      if (from === ownerId) {
        return refuse('Запись владельца не переносится: владелец восстанавливает доступ по новой ссылке владельца (смена ADMIN_SECRET → страница /setup).');
      }
      const to = Number(body.to);
      const toUser = await getUser(ctx.db, to);
      // Иначе админ получил бы чужие пары и переписку (Конституция, принцип I; 006, FR-601)
      if (toUser?.is_admin || to === ownerId) return refuse('Переносить участие на аккаунт администратора нельзя.');
      return out(await transferAccount(ctx, from, to, ctx.me.tg_id), (r) => ({ events: r.events }));
    },
  },
  'admin.role.grant': { role: OWNER, owner: ROLES_OWNER, run: async (ctx, body) => out(await grantAdmin(ctx, Number(body.id), ctx.me.tg_id), none) },
  'admin.role.revoke': { role: OWNER, owner: ROLES_OWNER, run: async (ctx, body) => out(await revokeAdmin(ctx, Number(body.id), ctx.me.tg_id), none) },
  'admin.owner.transfer': {
    role: OWNER,
    owner: onlyOwner('Передать права владельца'),
    run: async (ctx, body) => out(await transferOwnership(ctx, ctx.me.tg_id, Number(body.id)), none),
  },

  // ---------- администратор: в пределах события ----------
  'admin.state': { role: ADMIN, event: true, finished: true, run: (ctx, body, ev) => adminState(ctx, ev) },
  'admin.wishlist': { role: ADMIN, event: true, finished: true, run: async (ctx, body, ev) => out(await memberLetter(ctx, ev, body.id)) },
  'admin.game': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await saveEventSettings(ctx, ev, body, ctx.me.tg_id), none) },
  'admin.ring': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await setRing(ctx, ev, body.on, ctx.me.tg_id), none) },
  'admin.registration': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await setRegistration(ctx, ev, body.open, ctx.me.tg_id), none) },
  'admin.invite.regen': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await regenInvite(ctx, ev, ctx.me.tg_id), none) },
  'admin.avoid_previous': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await setAvoidPrevious(ctx, ev, body.on, ctx.me.tg_id), none) },
  'admin.participate': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await participate(ctx, ev, body.on, ctx.me.tg_id), none) },
  'admin.remove': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    async run(ctx, body, ev) {
      const { db, me } = ctx;
      const id = Number(body.id);
      if (id === me.tg_id) return refuse('Нельзя удалить самого себя — выключи «Я участвую».');
      if (id === (await ctx.ownerId())) return refuse('Владельца нельзя удалить из события. Сначала он должен передать права владельца.');
      // Человек — из списка пользователей вызова (019); «не участвует» отвечает removeMember тем же текстом
      const target = (await ctx.users()).find((u) => u.tg_id === id);
      if (target?.is_admin && !(await ctx.isOwner())) return refuse('Удалить администратора может только владелец бота.', 403);
      // Отметка «удалён организатором» (010): при запрете возврата человек не войдёт по ссылке снова
      return out(await removeMember(ctx, ev, id, { actor: me.tg_id, mark: true }), none);
    },
  },
  'admin.removed.allow': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await allowRemoved(ctx, ev, body.id, ctx.me.tg_id), none) },
  // Только владелец (012, FR-1201): админ по отметкам «не открыл подопечного» и «подарок готов» понял бы, у кого
  // сменился подопечный, — то есть кто дарит новичку. Владелец пары видит и так (010) и может вписать себя.
  'admin.insert': {
    role: OWNER,
    owner: onlyOwner('Вписывать в жеребьёвку после неё'),
    event: true,
    finished: CLOSED,
    run: async (ctx, body, ev) => out(await insertMember(ctx, ev, Number(body.id), ctx.me.tg_id), none),
  },
  // После жеребьёвки — только владелец (заморозка в модуле, 009/010)
  'admin.exclusion.add': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeExclusions(ctx, ev, { add: true, ...pair(body) }), none) },
  'admin.exclusion.del': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeExclusions(ctx, ev, { add: false, ...pair(body) }), none) },
  // 014: закреплённые пары — будущие пары жеребьёвки; видит и меняет только владелец (админ узнал бы пары)
  'admin.fixed.add': { role: OWNER, owner: onlyOwner('Закреплять пары'), event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeFixed(ctx, ev, { add: true, ...pair(body) }), none) },
  'admin.fixed.del': { role: OWNER, owner: onlyOwner('Закреплять пары'), event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeFixed(ctx, ev, { add: false, ...pair(body) }), none) },
  'admin.draw.check': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    async run(ctx, body, ev) {
      if (ev.draw_done) return refuse('Жеребьёвка уже проведена.');
      const c = await checkDraw(ctx, ev);
      // Без признаков учёта прошлых пар: по ним можно было бы вычислить чужие пары прошлого года (009, FR-904)
      return { possible: c.res.ok, count: c.people.length, ring: c.ring, problems: c.problems, empty_wishlists: c.emptyWishlists };
    },
  },
  'admin.draw': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    run: async (ctx, body, ev) => out(await runDraw(ctx, ev, { actor: ctx.me.tg_id }), (r) => ({ count: r.count, single_cycle: r.singleCycle })),
  },
  'admin.draw.cancel': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await cancelDraw(ctx, ev, ctx.me.tg_id), count) },
  // 012, FR-1205: в любой момент до раскрытия — только владелец (участвующий админ переигрывал бы жеребьёвку)
  'admin.draw.cancel.force': {
    role: OWNER,
    owner: onlyOwner('Принудительно отменить жеребьёвку'),
    event: true,
    finished: CLOSED,
    confirm: ['ОТМЕНА', 'Для отмены введи слово ОТМЕНА.'],
    run: async (ctx, body, ev) => out(await forceCancelDraw(ctx, ev, ctx.me.tg_id), count),
  },
  // ---------- обращения к организатору (012): чтение всегда, изменения — пока открыта переписка (support.js) ----------
  'admin.support.get': {
    role: ADMIN,
    event: true,
    finished: true,
    run: async (ctx, body, ev) => out(await adminThread(ctx, ev, thread(body)),
      (r) => ({ thread: r.thread, messages: r.messages, admins: r.admins })),
  },
  'admin.support.take': { role: ADMIN, event: true, finished: true, run: async (ctx, body, ev) => out(await take(ctx, ev, thread(body)), none) },
  'admin.support.send': {
    role: ADMIN,
    event: true,
    finished: true,
    run: async (ctx, body, ev) => out(await sendFromAdmin(ctx, ev, thread(body), body.text), (r) => ({ message: r.message })),
  },
  'admin.support.pass': {
    role: ADMIN,
    event: true,
    finished: true,
    run: async (ctx, body, ev) => out(await pass(ctx, ev, thread(body), body.to), none),
  },
  'admin.support.close': {
    role: ADMIN,
    event: true,
    finished: true,
    run: async (ctx, body, ev) => out(await closeByAdmin(ctx, ev, thread(body)), none),
  },
  'admin.announce': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await announce(ctx, ev, ctx.me.tg_id, body.text), count) },
  'admin.request.decide': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    run: async (ctx, body, ev) => out(await decideRequest(ctx, body.id, ctx.me.tg_id, !!body.approve, { inEvent: ev }), none),
  },
  'admin.remind.unfilled': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => count(await remindUnfilled(ctx, ev, ctx.me.tg_id)) },
  'admin.remind.santas': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    async run(ctx, body, ev) {
      if (!ev.draw_done) return refuse(NO_DRAW);
      return count(await remindSantas(ctx, ev, ctx.me.tg_id));
    },
  },
  // Повторно имена не рассылаются (006, FR-610), в том числе при одновременных вызовах (009)
  'admin.reveal': { role: ADMIN, event: true, finished: true, run: async (ctx, body, ev) => out(await revealAll(ctx, ev, ctx.me.tg_id), count) },
  'admin.event.finish': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await finishEvent(ctx, ev, ctx.me.tg_id), none) },
  // Разрешено в завершённом ради своего порядка отказов: «Выбери другое событие.» раньше «приглашать нельзя»
  'admin.event.invite_from': {
    role: ADMIN,
    event: true,
    finished: true,
    async run(ctx, body, ev) {
      const fromEv = await getEvent(ctx.db, body.from);
      if (!fromEv || fromEv.id === ev.id) return refuse('Выбери другое событие.');
      if (isFinished(ev)) return refuse('Событие завершено — приглашать в него нельзя.');
      return out(await inviteFromEvent(ctx, ev, fromEv, ctx.me.tg_id), count);
    },
  },
  'admin.event.delete': {
    role: OWNER,
    owner: onlyOwner('Удалить событие'),
    event: true,
    finished: true,
    confirm: ['УДАЛИТЬ', 'Для удаления введи слово УДАЛИТЬ.'],
    run: async (ctx, body, ev) => out(await deleteEvent(ctx, ev, ctx.me.tg_id), (r) => ({ notified: r.count })),
  },
  // ---------- служебный просмотр владельца (010, FR-1009–FR-1013): только чтение ----------
  'admin.vault.person': {
    role: OWNER,
    owner: VAULT_OWNER,
    event: true,
    finished: true,
    run: async (ctx, body, ev) => out(await vaultPerson(ctx, ev, Number(body.id) || 0, ctx.me.tg_id)),
  },
  'admin.vault.pairs': { role: OWNER, owner: VAULT_OWNER, event: true, finished: true, run: async (ctx, body, ev) => out(await vaultPairs(ctx, ev, ctx.me.tg_id)) },
  'admin.reset.full': {
    role: OWNER,
    owner: onlyOwner('Полный сброс'),
    event: true,
    finished: CLOSED,
    confirm: ['СБРОС', 'Для полного сброса введи слово СБРОС.'],
    async run(ctx, body, ev) {
      const r = await resetEvent(ctx, ev, await ctx.ownerId(), ctx.me.tg_id);
      return { removed: r.removed, invite_link: inviteLink(await ctx.settings(), { invite_code: r.inviteCode }) };
    },
  },
};

function pair(body) {
  return { giver: body.giver, receiver: body.receiver, mutual: body.mutual };
}
function thread(body) {
  return Number(body.thread) || 0;
}
function count(r) {
  return { count: r.count };
}

// Неизвестное действие идёт тем же путём, что известное: админа — до события и «завершено», участника — до участия
const unknown = () => refuse('Неизвестное действие', 404);
const UNKNOWN_ADMIN = { role: ADMIN, event: true, finished: CLOSED, run: unknown };
const UNKNOWN = { role: MEMBER, event: true, finished: true, run: unknown };

const respond = (data) => (data instanceof Refusal ? fail(data.error, data.status) : json({ ok: true, ...data }));

// ---------- конвейер проверок ----------

export async function handleApi(request, env, action) {
  if (request.method !== 'POST') return fail('method', 405);
  const tgUser = await validateInitData(request.headers.get('x-init-data'), env.BOT_TOKEN);
  if (!tgUser) return fail('Не удалось проверить вход. Открой приложение заново из чата с ботом.', 401);
  const body = await request.json().catch(() => ({}));
  const ctx = await openContext(env, tgUser.id); // пользователь и настройки — одним пакетом
  const { db, me } = ctx;
  // Человек открыл приложение — значит, бот у него не заблокирован (006, FR-609)
  if (me?.blocked_at) await updateUser(db, me.tg_id, { blocked_at: 0 });

  const admin = action.startsWith('admin.');
  const row = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : admin ? UNKNOWN_ADMIN : UNKNOWN;
  if (row.role !== ANY && (!me || !me.registered)) return fail(NOT_REGISTERED, 403);
  if (admin) {
    if (!me.is_admin) return fail(ADMIN_ONLY, 403);
    // Владелец — сразу: если он в настройках недействителен, назначается самый ранний админ (не откладывать запись)
    await ctx.ownerId();
  }
  const owner = async () => !row.owner || (await ctx.isOwner());

  if (!(row.event === true || (row.event === 'given' && body.event))) {
    if (!(await owner())) return fail(row.owner, 403);
    return respond(await row.run(ctx, body));
  }
  const ev = await getEvent(db, body.event);
  if (!ev) return fail('Событие не найдено.', 404);
  let member = null;
  if (!admin) {
    member = await getMember(db, ev.id, me.tg_id);
    if (!member && !(row.role === VIEWER && me.is_admin)) return fail('Ты не участвуешь в этом событии.', 403);
  }
  if (isFinished(ev) && row.finished !== true) return fail(row.finished);
  // Владелец — после «событие завершено»: админ на завершённом событии получает 400, а не 403
  if (!(await owner())) return fail(row.owner, 403);
  if (row.confirm && !confirmed(body, row.confirm[0])) return fail(row.confirm[1]);
  return respond(await row.run(ctx, body, ev, member));
}

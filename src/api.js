// JSON API для мини-приложения. Каждый запрос подписан Telegram (initData).
// 019: каждое действие — строка таблицы ACTIONS (роль, нужно ли событие, что в завершённом событии, текст отказа
// владельца, слово подтверждения, обработчик); общие проверки — один конвейер в handleApi до обработчика, в прежнем
// порядке. Предметная логика и SQL — в модулях; здесь — разбор запроса, таблица и ответ. Контракт —
// specs/019-api-actions/contracts/api-actions.md.

import { updateUser, getUser, getEvent, getMember, getAudit } from './db.js';
import { validateInitData } from './telegram.js';
import { saveShipment } from './shipment.js';
import { inviteLink, oneLine, NOT_REGISTERED, ADMIN_ONLY, NO_DRAW, NOT_MEMBER } from './format.js';
import { t, tx, render, appTexts, DEFAULT_LANG, telegramLanguage, foldWord } from './i18n/index.js';
import { syncLanguage, setLanguage, languagesView } from './language.js';
import { isFinished, publicEvent } from './status.js';
import { openContext } from './context.js';
import {
  createEvent, finishEvent, deleteEvent, resetEvent, inviteFromEvent, revealAll, remindUnfilled, remindSantas, announce,
  saveEventSettings, setRing, setRegistration, regenInvite, setAvoidPrevious,
} from './events.js';
import { checkDraw, runDraw, removeMember, insertMember, cancelDraw, forceCancelDraw, checkSwap, swapWards } from './pairs.js';
import { sendChatMessage, chatHistory } from './chat.js';
import { grantAdmin, revokeAdmin, transferEventOwner, transferBotOwnership, transferAccount } from './roles.js';
import { canCreate, CREATE_RIGHT } from './creation.js';
import { botAudit, eventsPage, peopleView, setCreator } from './bot-owner.js';
import { decideRequest, participate, allowRemoved, leaveEvent, LEAVE_FINISHED } from './membership.js';
import { vaultPerson, vaultPairs } from './vault.js';
import {
  participantView, sendFromUser, closeByUser, adminThread, take, sendFromAdmin, pass, closeByAdmin,
} from './support.js';
import {
  homeView, eventView, saveWishlist, writeLetterDraft, saveDelivery, wardView, setGiftReady, setGiftReceived, setCard,
} from './participant.js';
import { adminState, memberLetter, renameUser } from './panel.js';
import { changeExclusions, changeFixed } from './constraints.js';

// ---------- роли и общие отказы ----------

// ANY — любой с подписью; USER — зарегистрированный; VIEWER — участник события или админ; MEMBER — участник события;
// ADMIN — админ; OWNER — владелец (с текстом отказа в поле owner); BOT — владелец бота (051, действия bot.*). 063: админ и
// владелец — в событии действия (организатор этого события; владелец события или владелец бота); действие без события
// с ролью OWNER — только владелец бота (признак bot)
export const ROLES = Object.freeze({
  ANY: 'any', USER: 'user', VIEWER: 'viewer', MEMBER: 'member', ADMIN: 'admin', OWNER: 'owner', BOT: 'bot',
});
const { ANY, USER, VIEWER, MEMBER, ADMIN, OWNER, BOT } = ROLES;

// 060: тексты таблицы — ключи словаря (src/i18n/<язык>/api.js), ответ собирается на языке вызывающего.
// Завершённый эвент — только просмотр, раскрытие, удаление и приглашение его участников в новый. Сброс запрещён: он
// вернул бы эвент в «идёт», а завершение необратимо (FR-506).
const CLOSED = 'api.closed';
// Слово подтверждения: [ключ слова (его вводит человек — словарь приложения), ключ отказа с подстановкой {word}]
const VAULT_WORD = ['app.core.word.open', 'api.confirm.vault'];
const DELETE_WORD = ['app.core.word.delete', 'api.confirm.delete'];
// Отказ не владельцу (051): ключ api.owner.* — со словом «владелец» события действия ({owner.…}, ownerWord), ключ
// api.botOwner.* — всегда «владелец бота»; docs/api.md показывает текст события с владельцем
const ownerRefusal = (key, c) => (key.startsWith('api.owner.') ? tx(key, { owner: c.ownerWord() }) : tx(key));
const BOT_ONLY = tx('api.botOnly');
const ROLES_OWNER = 'api.owner.roles';
const OWNER_ROLES = 'api.owner.transfer';
const VAULT_OWNER = 'api.owner.vault';
const SWAP_OWNER = 'api.owner.swap';
const LETTER_CLOSED = 'api.letterClosed';
const MARK_CLOSED = 'api.markClosed';
// Имя — одна строка до 40 символов, как при регистрации в боте: своё (035) и от организатора
const NAME_RULE = tx('api.nameRule');
const validName = (raw) => {
  const name = oneLine(raw);
  return name && name.length <= 40 ? name : '';
};

// Ответ: отложенные тексты (tx) собираются на языке вызывающего (060); словарь приложения (texts) — как есть
const json = (data, status, lang) => {
  const { texts, ...rest } = data;
  const body = render(rest, lang);
  if (texts) body.texts = texts;
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
};

const fail = (error, status = 400, lang = DEFAULT_LANG) => json({ ok: false, error }, status, lang);

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
// Слово подтверждения — на языке вызывающего, как его показывает приложение; без регистра и диакритики (061)
const confirmed = (ctx, body, [word]) => foldWord(body.confirm, ctx.lang) === foldWord(t(ctx.lang, word), ctx.lang);
const wordRefusal = ([word, refusal]) => tx(refusal, { word: tx(word) });

// me (060): язык, версия словаря приложения и сам словарь — если у приложения его нет или он другой; 061: выбор языка и
// список языков
async function withTexts(ctx, body, view) {
  const { version, texts } = appTexts(ctx.lang);
  return {
    ...(await view), lang: ctx.lang, ...languagesView(ctx), texts_version: version, ...(body.texts === version ? {} : { texts }),
  };
}

// ---------- таблица действий ----------
// Порядок строк — порядок прежних `case` (автотест e2e «владелец ⊇ админ» выполняет действия по очереди на одном
// событии). У действия события поле finished обязательно: true — разрешено в завершённом (чтение, свой отказ или
// проверка переписки внутри); строка — отказ 400 этим текстом. Условные права (зависят от данных) — в обработчиках.

export const ACTIONS = {
  // ---------- участник ----------
  me: { role: ANY, run: (ctx, body) => withTexts(ctx, body, homeView(ctx)) },
  'notify.set': {
    role: USER,
    async run(ctx, body) {
      if (!['sound', 'silent', 'off'].includes(body.mode)) return refuse('bad mode');
      await updateUser(ctx.db, ctx.me.tg_id, { notify_mode: body.mode });
      return {};
    },
  },
  // 061: язык бота и приложения — '' (как в Telegram) или код языка; ответ — уже на новом языке
  'lang.set': { role: USER, run: async (ctx, body) => out(await setLanguage(ctx, body.lang)) },
  // 035: своё имя; 063 — без журнала и сообщений
  'name.set': {
    role: USER,
    async run(ctx, body) {
      const name = validName(body.name);
      if (!name) return refuse(NAME_RULE);
      await renameUser(ctx, ctx.me, name, ctx.me.tg_id, false);
      return { name };
    },
  },
  // 063: своё событие — создатель становится владельцем (и участником при participate); образец — событие, где он
  // организатор (владельцу бота — любое); лимит и разрешение — условием записи (creation.js)
  'event.create': {
    role: USER,
    async run(ctx, body) {
      if (!(await canCreate(ctx))) return refuse(CREATE_RIGHT, 403);
      let from = null;
      if (body.from) {
        from = await getEvent(ctx.db, body.from);
        if (!from || !((await ctx.organizerOf()).has(from.id) || (await ctx.isBotOwner()))) return refuse(tx('api.templateNotFound'));
      }
      const r = await createEvent(ctx, body.title, ctx.me.tg_id, { from, invite: !!body.invite, participate: body.participate !== false });
      return out(r, () => ({ event: { ...publicEvent(r.event), role: 'owner' }, invited: r.invited, invite_error: r.inviteError }));
    },
  },
  // 038: открытка письма — из набора src/looks.js, без журнала и сообщений
  'card.set': { role: MEMBER, event: true, finished: LETTER_CLOSED, run: async (ctx, body, ev) => out(await setCard(ctx, ev, body.card)) },
  'event.get': { role: VIEWER, event: true, finished: true, run: (ctx, body, ev, member) => eventView(ctx, ev, member) },
  'wishlist.save': { role: MEMBER, event: true, finished: LETTER_CLOSED, run: async (ctx, body, ev, member) => out(await saveWishlist(ctx, ev, member, body.text)) },
  'wishlist.draft': { role: MEMBER, event: true, finished: LETTER_CLOSED, run: async (ctx, body, ev, member) => out(await writeLetterDraft(ctx, ev, member, body, false)) },
  'wishlist.publish': { role: MEMBER, event: true, finished: LETTER_CLOSED, run: async (ctx, body, ev, member) => out(await writeLetterDraft(ctx, ev, member, body, true)) },
  // Свой порядок отказов: «адрес не нужен» раньше «завершено» (в модуле)
  'delivery.save': { role: MEMBER, event: true, finished: true, run: async (ctx, body, ev, member) => out(await saveDelivery(ctx, ev, member, body.text)) },
  'ward.get': { role: MEMBER, event: true, finished: true, run: (ctx, body, ev) => wardView(ctx, ev) },
  'ward.gift': { role: MEMBER, event: true, finished: MARK_CLOSED, run: async (ctx, body, ev) => out(await setGiftReady(ctx, ev, body.ready)) },
  'ward.shipment': { role: MEMBER, event: true, finished: MARK_CLOSED, run: async (ctx, body, ev) => out(await saveShipment(ctx, ev, body)) },
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
  // 035: выход — только до жеребьёвки (после неё — через организатора), слово ВЫЙТИ проверяет и сервер
  'event.leave': {
    role: MEMBER,
    event: true,
    finished: LEAVE_FINISHED,
    confirm: ['app.core.word.leave', 'api.confirm.leave'],
    run: async (ctx, body, ev) => out(await leaveEvent(ctx, ev), none),
  },

  // ---------- владелец бота: люди (без события) ----------
  // 063: переименовать человека — только владелец бота (имя одно во всех событиях); журнал бота — при изменении
  'admin.rename': {
    role: OWNER,
    bot: true,
    owner: 'api.botOwner.rename',
    async run(ctx, body) {
      const name = validName(body.name);
      if (!name) return refuse(NAME_RULE);
      const target = await getUser(ctx.db, Number(body.id) || 0);
      if (!target?.registered) return refuse(tx('api.memberNotFound'));
      await renameUser(ctx, target, name, ctx.me.tg_id, true);
      return {};
    },
  },
  // Иначе админ перенёс бы участие игрока на свой второй, не-админский аккаунт и увидел его пары (010, FR-1001). 051: только
  // владелец бота — аккаунт один на все события
  'admin.transfer': {
    role: OWNER,
    bot: true,
    owner: 'api.botOwner.transfer',
    async run(ctx, body) {
      const from = Number(body.from);
      if (from === (await ctx.botOwnerId())) return refuse(tx('api.ownerNotTransferred'));
      // Цель — не владелец бота и не организатор где-нибудь — проверяет transferAccount, до остальных отказов
      return out(await transferAccount(ctx, from, Number(body.to), ctx.me.tg_id), (r) => ({ events: r.events }));
    },
  },

  // ---------- администратор: в пределах события ----------
  'admin.state': { role: ADMIN, event: true, finished: true, run: (ctx, body, ev) => adminState(ctx, ev) },
  // 063: журнал только события; без события — «Событие не найдено.»
  'admin.audit': { role: ADMIN, event: true, finished: true, run: async (ctx, body, ev) => ({ entries: await getAudit(ctx.db, ev.id, ctx.t) }) },
  // 063: администраторы и владение событием — только владелец события (или владелец бота)
  'admin.role.grant': { role: OWNER, owner: ROLES_OWNER, event: true, finished: true, run: async (ctx, body, ev) => out(await grantAdmin(ctx, Number(body.id), ctx.me.tg_id), none) },
  'admin.role.revoke': { role: OWNER, owner: ROLES_OWNER, event: true, finished: true, run: async (ctx, body, ev) => out(await revokeAdmin(ctx, Number(body.id), ctx.me.tg_id), none) },
  'admin.owner.transfer': {
    role: OWNER,
    owner: OWNER_ROLES,
    event: true,
    finished: true,
    run: async (ctx, body) => out(await transferEventOwner(ctx, Number(body.id), ctx.me.tg_id), none),
  },
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
      if (id === me.tg_id) return refuse(tx('api.removeSelf'));
      if (id === (await ctx.ownerId())) return refuse(tx('api.removeOwner'));
      // Человек — из списка пользователей вызова (019); «не участвует» отвечает removeMember тем же текстом
      const target = (await ctx.users()).find((u) => u.tg_id === id);
      if (target?.is_admin && !(await ctx.isOwner())) return refuse(tx('api.removeAdmin', { owner: ctx.ownerWord() }), 403);
      // Отметка «удалён организатором» (010): при запрете возврата человек не войдёт по ссылке снова
      return out(await removeMember(ctx, ev, id, { actor: me.tg_id, mark: true }), none);
    },
  },
  'admin.removed.allow': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await allowRemoved(ctx, ev, body.id, ctx.me.tg_id), none) },
  // Только владелец (012, FR-1201): админ по отметкам «не открыл подопечного» и «подарок готов» понял бы, у кого
  // сменился подопечный, — то есть кто дарит новичку. Владелец пары видит и так (010) и может вписать себя.
  'admin.insert': {
    role: OWNER,
    owner: 'api.owner.insert',
    event: true,
    finished: CLOSED,
    run: async (ctx, body, ev) => out(await insertMember(ctx, ev, Number(body.id), ctx.me.tg_id), none),
  },
  // После жеребьёвки — только владелец (заморозка в модуле, 009/010)
  'admin.exclusion.add': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeExclusions(ctx, ev, { add: true, ...pair(body) }), none) },
  'admin.exclusion.del': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeExclusions(ctx, ev, { add: false, ...pair(body) }), none) },
  // 014: закреплённые пары — будущие пары жеребьёвки; видит и меняет только владелец (админ узнал бы пары)
  'admin.fixed.add': { role: OWNER, owner: 'api.owner.fixed', event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeFixed(ctx, ev, { add: true, ...pair(body) }), none) },
  'admin.fixed.del': { role: OWNER, owner: 'api.owner.fixed', event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await changeFixed(ctx, ev, { add: false, ...pair(body) }), none) },
  'admin.draw.check': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    async run(ctx, body, ev) {
      if (ev.draw_done) return refuse(tx('api.drawDone'));
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
    owner: 'api.owner.forceCancel',
    event: true,
    finished: CLOSED,
    confirm: ['app.core.word.cancel', 'api.confirm.cancel'],
    run: async (ctx, body, ev) => out(await forceCancelDraw(ctx, ev, ctx.me.tg_id), count),
  },
  // 048: обмен подопечных у двух участников после жеребьёвки — только владелец (админ по смене статусов вычислил бы
  // пары); ответы — коды и тексты правил без имён и версия пар, пар нет
  'admin.draw.swap.check': {
    role: OWNER,
    owner: SWAP_OWNER,
    event: true,
    finished: CLOSED,
    run: async (ctx, body, ev) => out(await checkSwap(ctx, ev, Number(body.a), Number(body.b))),
  },
  'admin.draw.swap': {
    role: OWNER,
    owner: SWAP_OWNER,
    event: true,
    finished: CLOSED,
    run: async (ctx, body, ev) => out(await swapWards(ctx, ev,
      { a: Number(body.a), b: Number(body.b), version: body.version, agree: body.agree }, ctx.me.tg_id), none),
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
  // В завершённом — только отклонить (025): как кнопкой бота req:<id>:r; принять — прежний отказ
  'admin.request.decide': {
    role: ADMIN,
    event: true,
    finished: true,
    async run(ctx, body, ev) {
      if (isFinished(ev) && body.approve) return refuse(tx(CLOSED));
      return out(await decideRequest(ctx, body.id, ctx.me.tg_id, !!body.approve, { inEvent: ev }), none);
    },
  },
  'admin.remind.unfilled': { role: ADMIN, event: true, finished: CLOSED, run: async (ctx, body, ev) => out(await remindUnfilled(ctx, ev, ctx.me.tg_id), count) },
  'admin.remind.santas': {
    role: ADMIN,
    event: true,
    finished: CLOSED,
    async run(ctx, body, ev) {
      if (!ev.draw_done) return refuse(NO_DRAW);
      return out(await remindSantas(ctx, ev, ctx.me.tg_id), count);
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
      // 063: источник — событие, где вызывающий организатор (владельцу бота — любое)
      const allowed = fromEv && ((await ctx.organizerOf()).has(fromEv.id) || (await ctx.isBotOwner()));
      if (!allowed || fromEv.id === ev.id) return refuse(tx('api.chooseOtherEvent'));
      if (isFinished(ev)) return refuse(tx('api.inviteFinished'));
      return out(await inviteFromEvent(ctx, ev, fromEv, ctx.me.tg_id), count);
    },
  },
  'admin.event.delete': {
    role: OWNER,
    owner: 'api.owner.eventDelete',
    event: true,
    finished: true,
    confirm: DELETE_WORD,
    run: async (ctx, body, ev) => out(await deleteEvent(ctx, ev, ctx.me.tg_id), (r) => ({ notified: r.count })),
  },
  // ---------- служебный просмотр владельца (010, FR-1009–FR-1013): только чтение ----------
  // Слово ОТКРЫТЬ проверяет и сервер (025) — как СБРОС, УДАЛИТЬ, ОТМЕНА; отказ по слову — до журнала
  'admin.vault.person': {
    role: OWNER,
    owner: VAULT_OWNER,
    event: true,
    finished: true,
    confirm: VAULT_WORD,
    run: async (ctx, body, ev) => out(await vaultPerson(ctx, ev, Number(body.id) || 0, ctx.me.tg_id)),
  },
  'admin.vault.pairs': { role: OWNER, owner: VAULT_OWNER, event: true, finished: true, confirm: VAULT_WORD, run: async (ctx, body, ev) => out(await vaultPairs(ctx, ev, ctx.me.tg_id)) },
  'admin.reset.full': {
    role: OWNER,
    owner: 'api.owner.reset',
    event: true,
    finished: CLOSED,
    confirm: ['app.core.word.reset', 'api.confirm.reset'],
    async run(ctx, body, ev) {
      const r = await resetEvent(ctx, ev, await ctx.ownerId(), ctx.me.tg_id);
      if (!r.ok) return refuse(r.error); // второй из одновременных сбросов (024)
      return { removed: r.removed, invite_link: inviteLink(await ctx.settings(), { invite_code: r.inviteCode }) };
    },
  },

  // ---------- владелец бота (051, 063): права владельца бота, журнал бота, все события, кто создаёт события ----------
  // Прежняя передача прав владельца бота (до 051 — admin.owner.transfer)
  'bot.owner.transfer': { role: BOT, run: async (ctx, body) => out(await transferBotOwnership(ctx, ctx.me.tg_id, Number(body.id)), none) },
  'bot.audit': { role: BOT, run: (ctx) => botAudit(ctx) },
  'bot.events': { role: BOT, run: (ctx, body) => eventsPage(ctx, Number(body.offset) || 0) },
  'bot.people': { role: BOT, run: (ctx) => peopleView(ctx) },
  'bot.creator.set': { role: BOT, run: async (ctx, body) => out(await setCreator(ctx, Number(body.id) || 0, !!body.on), none) },
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
const unknown = () => refuse(tx('api.unknownAction'), 404);
const UNKNOWN_ADMIN = { role: ADMIN, event: true, finished: CLOSED, run: unknown };
const UNKNOWN = { role: MEMBER, event: true, finished: true, run: unknown };

const NO_EVENT = tx('api.noEvent');

// ---------- конвейер проверок ----------

export async function handleApi(request, env, action) {
  if (request.method !== 'POST') return fail('method', 405);
  const tgUser = await validateInitData(request.headers.get('x-init-data'), env.BOT_TOKEN);
  if (!tgUser) return fail(tx('api.badInitData'), 401);
  const body = await request.json().catch(() => ({}));
  const admin = action.startsWith('admin.');
  const row = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : admin ? UNKNOWN_ADMIN : UNKNOWN;
  // Пользователь, настройки и событие действия (063) — одним пакетом; 061: язык Telegram — из подписанных данных,
  // запоминается при изменении
  const ctx = await openContext(env, tgUser.id, {
    telegramLang: telegramLanguage(tgUser.language_code),
    eventId: row.event === true ? body.event : 0,
  });
  await syncLanguage(ctx);
  const { db, me } = ctx;
  // Ответ и отказ — на языке вызывающего (060)
  const no = (error, status) => fail(error, status, ctx.lang);
  const respond = (data) => (data instanceof Refusal ? no(data.error, data.status) : json({ ok: true, ...data }, 200, ctx.lang));
  // Человек открыл приложение — значит, бот у него не заблокирован (006, FR-609)
  if (me?.blocked_at) await updateUser(db, me.tg_id, { blocked_at: 0 });

  if (row.role !== ANY && (!me || !me.registered)) return no(NOT_REGISTERED, 403);
  // Действия владельца бота (051): без события
  if (row.role === BOT && !(await ctx.isBotOwner())) return no(BOT_ONLY, 403);
  if (admin) {
    // Общий признак: организатор хотя бы одного события или владелец бота (063)
    if (!me.is_admin && !(await ctx.isBotOwner())) return no(ADMIN_ONLY, 403);
    // Владелец бота — сразу: если он в настройках недействителен, назначается самый ранний админ (не откладывать запись)
    await ctx.botOwnerId();
  }
  const word = () => row.confirm && !confirmed(ctx, body, row.confirm);

  if (row.event !== true) {
    // Действие владельца без события — только владельцу бота (признак bot): у общего контекста владельца события нет
    if (row.owner && !(await ctx.isBotOwner())) return no(tx(row.owner), 403);
    return word() ? no(wordRefusal(row.confirm)) : respond(await row.run(ctx, body));
  }
  const ev = ctx.firstEvent;
  if (!ev) return no(NO_EVENT, 404);
  const c = await ctx.at(ev);
  let member = null;
  if (admin) {
    // Не организатор этого события (063, R4): участнику — «только для администратора», остальным событие — как
    // несуществующее: номера событий не выдают чужих
    if (!c.me.is_admin) return (await getMember(db, ev.id, me.tg_id)) ? no(ADMIN_ONLY, 403) : no(NO_EVENT, 404);
  } else {
    member = await getMember(db, ev.id, me.tg_id);
    if (!member && !(row.role === VIEWER && c.me.is_admin)) return no(NOT_MEMBER, 403);
  }
  if (isFinished(ev) && row.finished !== true) return no(tx(row.finished));
  // Владелец — после «событие завершено»: админ на завершённом событии получает 400, а не 403
  if (row.owner && !(await c.isOwner())) return no(ownerRefusal(row.owner, c), 403);
  if (word()) return no(wordRefusal(row.confirm));
  return respond(await row.run(c, body, ev, member));
}

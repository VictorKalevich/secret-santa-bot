// JSON API для мини-приложения. Каждый запрос подписан Telegram (initData).
// 019: каждое действие — строка таблицы ACTIONS (роль, нужно ли событие, что в завершённом событии, текст отказа
// владельца, слово подтверждения, обработчик); общие проверки — один конвейер в handleApi до обработчика, в прежнем
// порядке. Предметная логика и SQL — в модулях; здесь — разбор запроса, таблица и ответ. Контракт —
// specs/019-api-actions/contracts/api-actions.md.

import { updateUser, getEvent, getMember, getAudit } from './db.js';
import { validateInitData } from './telegram.js';
import { saveShipment } from './shipment.js';
import { inviteLink, oneLine, ownerWord, NOT_REGISTERED, ADMIN_ONLY, NO_DRAW, NOT_MEMBER } from './format.js';
import { isFinished, publicEvent } from './status.js';
import { openContext } from './context.js';
import {
  createEvent, finishEvent, deleteEvent, resetEvent, inviteFromEvent, revealAll, remindUnfilled, remindSantas, announce,
  saveEventSettings, setRing, setRegistration, regenInvite, setAvoidPrevious,
} from './events.js';
import { checkDraw, runDraw, removeMember, insertMember, cancelDraw, forceCancelDraw, checkSwap, swapWards } from './pairs.js';
import { sendChatMessage, chatHistory } from './chat.js';
import { grantAdmin, revokeAdmin, transferBotOwnership, transferAccount } from './roles.js';
import { createCompany, setLabel, setCompanyOwner, ownerLink, deleteCompany, botAudit } from './companies.js';
import {
  saveFamily, deleteFamily, decideRequest, familiesList, participate, allowRemoved, leaveEvent, LEAVE_FINISHED,
} from './membership.js';
import { vaultPerson, vaultPairs } from './vault.js';
import {
  participantView, sendFromUser, closeByUser, adminThread, take, sendFromAdmin, pass, closeByAdmin,
} from './support.js';
import {
  homeView, eventView, saveWishlist, writeLetterDraft, saveDelivery, wardView, setGiftReady, setGiftReceived, setCard, setMask,
} from './participant.js';
import { adminState, memberLetter, usersList, renameUser, companyCountQuery } from './panel.js';
import { changeExclusions, changeFixed } from './constraints.js';

// ---------- роли и общие отказы ----------

// ANY — любой с подписью; USER — зарегистрированный; VIEWER — участник события или админ; MEMBER — участник события;
// ADMIN — админ; OWNER — владелец (с текстом отказа в поле owner); BOT — владелец бота (051, действия bot.*). 050: админ и
// владелец — в компании действия (событие — его компания; общее действие организатора с признаком company — body.company
// или единственная компания); 051: владелец — владелец этой компании или владелец бота
export const ROLES = Object.freeze({
  ANY: 'any', USER: 'user', VIEWER: 'viewer', MEMBER: 'member', ADMIN: 'admin', OWNER: 'owner', BOT: 'bot',
});
const { ANY, USER, VIEWER, MEMBER, ADMIN, OWNER, BOT } = ROLES;

// Завершённый эвент — только просмотр, раскрытие, удаление и приглашение его участников в новый. Сброс запрещён: он
// вернул бы эвент в «идёт», а завершение необратимо (FR-506).
const CLOSED = 'Событие завершено — менять его уже нельзя (доступны просмотр, раскрытие и удаление).';
const VAULT_WORD = ['ОТКРЫТЬ', 'Для служебного просмотра введи слово ОТКРЫТЬ.'];
// Отказ не владельцу (051): в таблице — текст компании, которую ведёт владелец бота (прежний, его сверяет docs/api.md);
// в компании с назначенным владельцем конвейер строит тот же текст со словом «владелец» (ownerRefusal)
const OWNER_TEXTS = new Map();
const byOwner = (build) => {
  const text = build(ownerWord(true));
  OWNER_TEXTS.set(text, build);
  return text;
};
const ownerRefusal = (text, c) => OWNER_TEXTS.get(text)?.(c.ownerWord()) ?? text;
const onlyOwner = (what) => byOwner((w) => `${what} может только ${w.nom}.`);
// Только владельцу бота — в любой компании одним текстом
const onlyBotOwner = (what) => `${what} может только ${ownerWord(true).nom}.`;
const BOT_ONLY = `Только для ${ownerWord(true).gen}.`;
const ROLES_OWNER = onlyOwner('Назначать и снимать администраторов');
const VAULT_OWNER = byOwner((w) => `Служебный просмотр доступен только ${w.dat}.`);
const SWAP_OWNER = onlyOwner('Менять подопечных после жеребьёвки');
const LETTER_CLOSED = 'Событие завершено: письмо теперь только для чтения.';
const MARK_CLOSED = 'Событие завершено: отметка только для чтения.';
// Имя — одна строка до 40 символов, как при регистрации в боте: своё (035) и от организатора
const NAME_RULE = 'Имя должно быть от 1 до 40 символов';
const validName = (raw) => {
  const name = oneLine(raw);
  return name && name.length <= 40 ? name : '';
};

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
  // 035: своё имя — журнал только при настоящем изменении (renameUser), сообщений нет
  'name.set': {
    role: USER,
    async run(ctx, body) {
      const name = validName(body.name);
      if (!name) return refuse(NAME_RULE);
      // Запись rename — в журнал каждой компании человека (050)
      await renameUser(ctx, ctx.me, name, ctx.me.tg_id, [...(await ctx.mine()).keys()]);
      return { name };
    },
  },
  // 051: «как я называю эту компанию» — владельцу бота название компании, остальным своё; без журнала и сообщений
  'company.label.set': { role: USER, run: async (ctx, body) => out(await setLabel(ctx, body.company, body.label)) },
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
  // 040: маска Санты в переписке — из набора src/looks.js, до раскрытия, без журнала и сообщений
  'mask.set': { role: MEMBER, event: true, finished: 'Событие завершено: маску больше не сменить.', run: async (ctx, body, ev) => out(await setMask(ctx, ev, body.mask)) },
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
    confirm: ['ВЫЙТИ', 'Чтобы выйти, введи слово ВЫЙТИ.'],
    run: async (ctx, body, ev) => out(await leaveEvent(ctx, ev), none),
  },

  // ---------- администратор: общие (без события) ----------
  'admin.events.create': {
    role: ADMIN,
    company: true,
    async run(ctx, body) {
      let from = null;
      if (body.from) {
        from = await getEvent(ctx.db, body.from);
        // Образец — событие той же компании (050)
        if (!from || from.company_id !== ctx.company.id) return refuse('Образец не найден.');
      }
      const r = await createEvent(ctx, body.title, ctx.me.tg_id, { from, invite: !!body.invite });
      return out(r, () => ({ event: publicEvent(r.event), invited: r.invited, invite_error: r.inviteError }));
    },
  },
  // Семьи (008) — общие для компании (050); адресов и пар здесь нет
  'admin.families': { role: ADMIN, company: true, run: (ctx) => familiesList(ctx) },
  // Владелец видит пары и так — заморозка семей против вычисления пар на него не действует (010, FR-1008)
  'admin.family.save': {
    role: ADMIN,
    company: true,
    run: async (ctx, body) => out(await saveFamily(ctx, ctx.me.tg_id, { id: body.id, name: body.name, members: body.members }), none),
  },
  'admin.family.delete': {
    role: ADMIN,
    company: true,
    run: async (ctx, body) => out(await deleteFamily(ctx, ctx.me.tg_id, body.id), none),
  },
  // Без поля event — общий журнал компании, с ним — журнал события (несуществующее — 404)
  'admin.audit': {
    role: ADMIN,
    event: 'given',
    company: true,
    finished: true,
    run: async (ctx, body, ev) => ({ entries: await getAudit(ctx.db, ev ? ev.id : { company: ctx.company.id }) }),
  },
  'admin.users': { role: ADMIN, company: true, run: (ctx) => usersList(ctx) },
  'admin.rename': {
    role: ADMIN,
    company: true,
    async run(ctx, body) {
      const name = validName(body.name);
      if (!name) return refuse(NAME_RULE);
      // Цель — человек компании (050; гость — не человек компании); в скольких компаниях он — тем же пакетом (051)
      const { users, count } = await ctx.read({ users: true, count: companyCountQuery(ctx.db, Number(body.id) || 0) });
      const target = users.find((u) => u.tg_id === Number(body.id) && !u.guest);
      if (!target) return refuse('Участник не найден');
      // Администраторов и владельца переименовывает только владелец; себя — любой админ (006, FR-613)
      const ownerId = await ctx.ownerId();
      if ((target.is_admin || target.tg_id === ownerId) && target.tg_id !== ctx.me.tg_id && !(await ctx.isOwner())) {
        return refuse(`Переименовать администратора может только ${ctx.ownerWord().nom}.`, 403);
      }
      // 051, FR-5116: имя одно во всех компаниях — человека из нескольких компаний переименовывает он сам
      if (count[0].n > 1 && !(await ctx.isBotOwner())) return refuse('Имя этого человека меняет он сам: «Профиль» → «✏️ Изменить имя».');
      await renameUser(ctx, target, name, ctx.me.tg_id, [ctx.company.id]); // журнал — только при настоящем изменении (025)
      return {};
    },
  },
  // Иначе админ перенёс бы участие игрока на свой второй, не-админский аккаунт и увидел его пары (010, FR-1001). 051: только
  // владелец бота (bot) — аккаунт один на все компании, владелец компании увидел бы чужие пары в другой компании
  'admin.transfer': {
    role: OWNER,
    company: true,
    bot: true,
    owner: onlyBotOwner('Переносить участие на новый аккаунт'),
    async run(ctx, body) {
      const from = Number(body.from);
      if (from === (await ctx.ownerId()) || from === (await ctx.botOwnerId())) {
        return refuse('Запись владельца не переносится: владелец восстанавливает доступ по новой ссылке владельца (смена ADMIN_SECRET → страница /setup).');
      }
      // Цель — не владелец и не администратор (050: где-нибудь) — проверяет transferAccount, до остальных отказов
      return out(await transferAccount(ctx, from, Number(body.to), ctx.me.tg_id), (r) => ({ events: r.events }));
    },
  },
  'admin.role.grant': { role: OWNER, company: true, owner: ROLES_OWNER, run: async (ctx, body) => out(await grantAdmin(ctx, Number(body.id), ctx.me.tg_id), none) },
  'admin.role.revoke': { role: OWNER, company: true, owner: ROLES_OWNER, run: async (ctx, body) => out(await revokeAdmin(ctx, Number(body.id), ctx.me.tg_id), none) },
  // 051: «сделать владельцем этой компании» — назначение, передача своих прав и «Вести самому» (id — владелец бота)
  'admin.owner.transfer': {
    role: OWNER,
    company: true,
    owner: onlyOwner('Передать права владельца'),
    run: async (ctx, body) => out(await setCompanyOwner(ctx, body.id), none),
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
      if (target?.is_admin && !(await ctx.isOwner())) return refuse(`Удалить администратора может только ${ctx.ownerWord().nom}.`, 403);
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
      if (isFinished(ev) && body.approve) return refuse(CLOSED);
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
      if (!fromEv || fromEv.id === ev.id || fromEv.company_id !== ev.company_id) return refuse('Выбери другое событие.');
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
    owner: onlyOwner('Полный сброс'),
    event: true,
    finished: CLOSED,
    confirm: ['СБРОС', 'Для полного сброса введи слово СБРОС.'],
    async run(ctx, body, ev) {
      const r = await resetEvent(ctx, ev, await ctx.ownerId(), ctx.me.tg_id);
      if (!r.ok) return refuse(r.error); // второй из одновременных сбросов (024)
      return { removed: r.removed, invite_link: inviteLink(await ctx.settings(), { invite_code: r.inviteCode }) };
    },
  },

  // ---------- владелец бота (051): компании, их ссылки владельца, права владельца бота, журнал бота ----------
  'bot.company.create': { role: BOT, run: async (ctx, body) => out(await createCompany(ctx, body.name)) },
  'bot.company.link': { role: BOT, run: async (ctx, body) => out(await ownerLink(ctx, body.company, !!body.on)) },
  'bot.company.delete': {
    role: BOT,
    confirm: ['УДАЛИТЬ', 'Для удаления введи слово УДАЛИТЬ.'],
    run: async (ctx, body) => out(await deleteCompany(ctx, body.company), none),
  },
  // Прежняя передача прав владельца бота (до 051 — admin.owner.transfer)
  'bot.owner.transfer': { role: BOT, run: async (ctx, body) => out(await transferBotOwnership(ctx, ctx.me.tg_id, Number(body.id)), none) },
  'bot.audit': { role: BOT, run: (ctx) => botAudit(ctx) },
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

const NO_EVENT = 'Событие не найдено.';

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
  // Действия владельца бота (051): без события и без компании конвейера — компанию из тела проверяет обработчик
  if (row.role === BOT && !(await ctx.isBotOwner())) return fail(BOT_ONLY, 403);
  if (admin) {
    // Общий признак: админ хотя бы в одной компании или владелец бота (050)
    if (!me.is_admin && !(await ctx.isBotOwner())) return fail(ADMIN_ONLY, 403);
    // Владелец бота — сразу: если он в настройках недействителен, назначается самый ранний админ (не откладывать запись)
    await ctx.botOwnerId();
  }
  const owner = async (c) => !row.owner || ((await c.isOwner()) && (!row.bot || (await c.isBotOwner())));
  const word = () => row.confirm && !confirmed(body, row.confirm[0]);

  if (!(row.event === true || (row.event === 'given' && body.event))) {
    if (!row.company) return word() ? fail(row.confirm[1]) : respond(await row.run(ctx, body));
    // Общее действие организатора — в компании из запроса или в единственной компании вызывающего
    const id = Number(body.company) || (await ctx.soleCompany());
    if (!id) return fail('Выбери компанию.');
    const c = await ctx.in(id);
    if (!c?.me.is_admin) return fail(ADMIN_ONLY, 403);
    if (!(await owner(c))) return fail(ownerRefusal(row.owner, c), 403);
    return respond(await row.run(c, body));
  }
  const ev = await getEvent(db, body.event);
  const c = ev && (await ctx.in(ev.company_id));
  if (!c) return fail(NO_EVENT, 404);
  let member = null;
  if (admin) {
    // Событие чужой компании — как несуществующее: номера событий не выдают соседей (050, R9)
    if (!c.me.is_admin) return fail(NO_EVENT, 404);
  } else {
    member = await getMember(db, ev.id, me.tg_id);
    if (!member && !(row.role === VIEWER && c.me.is_admin)) return fail(NOT_MEMBER, 403);
  }
  if (isFinished(ev) && row.finished !== true) return fail(row.finished);
  // Владелец — после «событие завершено»: админ на завершённом событии получает 400, а не 403
  if (!(await owner(c))) return fail(ownerRefusal(row.owner, c), 403);
  if (word()) return fail(row.confirm[1]);
  return respond(await row.run(c, body, ev, member));
}

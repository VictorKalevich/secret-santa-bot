import { atomic } from './claim.js';
import { getUser, pairOfSanta } from './db.js';
import { ISO_DATE, localDate, msg, appKeyboard, q, randomCode } from './format.js';
import { no } from './result.js';

export function shipmentDetails(pair) {
  return pair.gift_sent ? { sent: true, date: pair.sent_date, carrier: pair.carrier, tracking: pair.tracking } : { sent: false };
}

export async function saveShipment(ctx, ev, body) {
  if (!ev.delivery_on) return no('Доставка в этом событии выключена.');
  const { db, me } = ctx;
  const pair = await pairOfSanta(db, ev.id, me.tg_id);
  if (!pair) return no('У тебя пока нет подопечного.');
  const conflict = 'Данные изменились. Открой вкладку «Подопечный» заново.';
  if (body.version !== pair.shipment_version) return no(conflict);
  if (typeof body.sent !== 'boolean') return no('Выбери состояние отправки.');
  const { sent } = body;
  const { date = '', carrier = '', tracking = '' } = sent ? body : {};
  if (typeof date !== 'string' || (date && (!ISO_DATE.test(date) || !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date || date > localDate(ctx.env).iso))) return no('Выбери сегодняшний или прошедший день.');
  if ([carrier, tracking].some(s => typeof s !== 'string' || s.length > 200 || /[\r\n]/.test(s))) return no('Служба и трек-номер — по одной строке до 200 символов.');
  if (!sent && !pair.gift_sent) return no('Подарок ещё не отправлен.');

  const a = atomic(db, `EXISTS (SELECT 1 FROM pairs p JOIN events e ON e.id = p.event_id
    WHERE e.id = ? AND e.status = 'active' AND e.delivery_on = 1 AND e.draw_done = 1
    AND p.santa = ? AND p.ward = ? AND p.shipment_version = ?)`, ev.id, me.tg_id, pair.ward, body.version);
  if (sent !== !!pair.gift_sent) {
    const recipient = await getUser(db, pair.ward);
    if (recipient && recipient.notify_mode !== 'off') {
      const notice = sent ? '📦 Твой Тайный Санта отправил подарок' : 'Твой Тайный Санта снял отметку об отправке';
      a.enqueue(pair.ward, msg(`${notice} в событии ${q(ev)}.`, {
        disable_notification: recipient.notify_mode === 'silent',
        ...appKeyboard(await ctx.settings(), 'Открыть посылку', { event: ev.id, shipment: 1 }),
      }));
    }
  }
  const version = randomCode(24);
  a.claim(a.where(`UPDATE pairs SET gift_sent = ?, gift_ready = 1, sent_date = ?, carrier = ?, tracking = ?,
    shipment_version = ? WHERE event_id = ? AND santa = ?`, Number(sent), date, carrier.trim(), tracking.trim(), version, ev.id, me.tg_id));
  if (!(await a.run()).won) return no(conflict);
  const details = sent ? { date, carrier: carrier.trim(), tracking: tracking.trim() } : {};
  return { ok: true, shipment: { sent, ...details, version } };
}

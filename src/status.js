// Простые проверки состояния события (019): без импортов — их берут API, бот, расписание и все модули логики.

// Переписка завершённого эвента открыта ещё 7 суток (005, FR-506)
export const CHAT_GRACE_MS = 7 * 24 * 3600 * 1000;

export const isFinished = (ev) => ev.status === 'finished';
export const chatUntil = (ev) => (isFinished(ev) ? ev.finished_at + CHAT_GRACE_MS : 0);
export const chatWritable = (ev, now = Date.now()) => !isFinished(ev) || now < chatUntil(ev);

// Поля события, которые видят участник и панель организатора (без кода приглашения и служебных полей)
export function publicEvent(ev) {
  return {
    id: ev.id,
    title: ev.title,
    status: ev.status,
    finished_at: ev.finished_at,
    chat_until: chatUntil(ev),
    budget: ev.budget,
    event_date: ev.event_date,
    place: ev.place,
    deadline: ev.deadline,
    notes: ev.notes,
    draw_done: !!ev.draw_done,
    revealed: !!ev.revealed,
    ring: !!ev.ring,
    delivery_on: !!ev.delivery_on, // 008
    approval: !!ev.approval,
    rejoin: !!ev.rejoin, // 010: удалённые организатором могут вернуться по ссылке
  };
}

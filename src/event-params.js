// Параметры события — один список (029): из него строятся создание события, полный сброс, сохранение параметров
// (src/events.js) и перечень полей, допустимых к записи (EVENT_FIELDS, src/db.js). Импорт — только format.js (он без импортов).
// Новая колонка events — строка в EVENT_PARAMS (параметр) или в служебных ниже: тест tests/server-shape.test.mjs
// сверяет оба списка со схемой и умолчания — с DEFAULT схемы.
//   kind — 'text' (обрезается до max символов), 'date' (YYYY-MM-DD или ''), 'flag' (0/1);
//   default — значение нового и сброшенного события;
//   template — копируется из события-образца (даты — нет, 007);
//   beforeDraw — меняется только до жеребьёвки: текст отказа;
//   own — у параметра своё действие (admin.ring, admin.avoid_previous): общим сохранением не меняется.
// Порядок строк — порядок проверок сохранения (при двух причинах отказа отвечает первая).
import { ISO_DATE } from './format.js';

export const EVENT_PARAMS = {
  letter_drafts: { kind: 'flag', default: 0 },
  budget: { kind: 'text', max: 100, default: '', template: true },
  place: { kind: 'text', max: 200, default: '', template: true },
  notes: { kind: 'text', max: 2000, default: '', template: true },
  event_date: { kind: 'date', default: '' },
  deadline: { kind: 'date', default: '' },
  // Расписание (007, FR-702)
  draw_auto_date: { kind: 'date', default: '', beforeDraw: 'Дату автожеребьёвки после жеребьёвки не задать.' },
  delivery_on: { kind: 'flag', default: 0, template: true }, // 008
  approval: { kind: 'flag', default: 0, template: true },
  rejoin: { kind: 'flag', default: 1, template: true }, // 010
  families_on: { kind: 'flag', default: 1, template: true, beforeDraw: 'После жеребьёвки правило семей не изменить.' },
  reveal_auto: { kind: 'flag', default: 0, template: true },
  finish_auto: { kind: 'flag', default: 0, template: true },
  ring: { kind: 'flag', default: 1, template: true, own: true },
  avoid_previous: { kind: 'flag', default: 1, template: true, own: true },
  contacts_on: { kind: 'flag', default: 0, template: true }, // 037: @username и чат в списке участников на «Инфо»
};

// Служебные колонки. Состояние события — со значением после полного сброса; код приглашения сброс задаёт новым;
// остальное сброс не трогает (название меняется сохранением, со своей проверкой). finish_warned — отметка предупреждения
// об автозавершении (056, src/stale.js); checked_on — «на сегодня проверено» ежедневного шага (057, src/cron.js): его
// снимают и сохранение параметров, и жеребьёвка.
export const EVENT_STATE_RESET = {
  status: 'active', finished_at: 0, registration_open: 1, draw_done: 0, draw_at: 0, draw_token: '', revealed: 0, last_daily: '',
  finish_warned: '', checked_on: '',
};
export const EVENT_SERVICE = ['id', 'company_id', 'title', 'created_at', 'created_by', 'invite_code', ...Object.keys(EVENT_STATE_RESET)];

// Значение параметра из тела запроса — как его хранит база
export function paramValue(spec, raw) {
  if (spec.kind === 'text') return String(raw ?? '').slice(0, spec.max);
  if (spec.kind === 'date') return ISO_DATE.test(raw || '') ? raw : '';
  return raw ? 1 : 0;
}

// Все параметры со значениями по умолчанию (новое событие, полный сброс)
export const eventDefaults = () => Object.fromEntries(Object.entries(EVENT_PARAMS).map(([k, p]) => [k, p.default]));

// Параметры нового события: копируемые — из образца from (нет значения — умолчание), без образца — умолчания.
// Остальные (даты) в создание не входят: их задаёт схема.
export function templateValues(from = null) {
  const out = {};
  for (const [k, p] of Object.entries(EVENT_PARAMS)) {
    if (p.template) out[k] = from ? from[k] ?? p.default : p.default;
  }
  return out;
}

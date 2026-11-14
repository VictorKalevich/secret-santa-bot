// Общие помощники: тексты сообщений, HTML, даты, имена, ссылки. Без обращений к базе.

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Название эвента в кавычках для сообщений бота (HTML)
export const q = (ev) => `«${escapeHtml(ev.title)}»`;

export function msg(text, extra = {}) {
  return { text, parse_mode: 'HTML', ...extra };
}

// Короткое название для заголовков и кнопок: не больше max единиц UTF-16, суррогатная пара не разрывается (006, FR-603).
export function shortTitle(title, max = 40) {
  const s = String(title ?? '');
  if (s.length <= max) return s;
  let out = '';
  for (const ch of s) {
    if (out.length + ch.length > max - 1) break;
    out += ch;
  }
  return out.trimEnd() + '…';
}

// Текст от пользователя: переводы строк Windows → \n, пробелы по краям убраны
export const cleanText = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();

// Однострочное значение (имя, название): пробелы и переводы строк схлопнуты в один пробел
export const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Как показать человека в сообщениях и журнале
export function displayName(u) {
  return u?.name || (u?.username ? '@' + u.username : 'Кто-то');
}

// Кому из админов писать: зарегистрированные администраторы, кроме перечисленных
export function adminRecipients(users, exclude = []) {
  return users.filter((u) => u.is_admin && u.registered && !exclude.includes(u.tg_id));
}

// ---------- даты ----------

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

export function formatMs(ms, offsetHours = 3) {
  const d = new Date(ms + offsetHours * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// Местные дата (YYYY-MM-DD), час и минута суток по TIMEZONE_OFFSET_HOURS
export function localDate(env, now = Date.now()) {
  const offset = Number(env.TIMEZONE_OFFSET_HOURS ?? 3);
  const d = new Date(now + offset * 3600 * 1000);
  return { iso: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// Сколько дней от сегодняшней местной даты до iso (null — дата не задана)
export function daysUntil(env, iso) {
  if (!ISO_DATE.test(iso || '')) return null;
  const today = localDate(env).iso;
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}

// ---------- ссылки и кнопки ----------

export function appUrl(settings, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return (settings.base_url || '') + '/app' + (query ? '?' + query : '');
}

export function openAppButton(settings, text = '🎁 Открыть приложение', params = {}) {
  return { text, web_app: { url: appUrl(settings, params) } };
}

// Одна кнопка приложения под сообщением (019): msg(text, appKeyboard(…)) или { …, ...appKeyboard(…) } — ключ последним
export const appKeyboard = (settings, text, params) => ({ reply_markup: { inline_keyboard: [[openAppButton(settings, text, params)]] } });

// Общие тексты (019): побайтно одинаковые в нескольких модулях
export const NOT_REGISTERED = 'Сначала зарегистрируйся по пригласительной ссылке.';
export const ADMIN_ONLY = 'Только для администратора.';
export const NO_DRAW = 'Жеребьёвка ещё не проведена.';
export const PAIRS_RACE = 'Пары изменились одновременно с этим действием — попробуй ещё раз.';

export function inviteLink(settings, ev) {
  if (!settings.bot_username || !ev?.invite_code) return '';
  return `https://t.me/${settings.bot_username}?start=inv_${ev.invite_code}`;
}

export function randomCode(len = 10) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

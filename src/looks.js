// Значок у имени и открытка письма (038, specs/038-emoji-postcards/contracts/looks.md): один набор на сервере —
// приложение получает его в ответе `me`. Вид открытки (узор, бумага, цвет текста, наклейка) — тема `ds-postcard--<id>`
// в дизайн-системе; тест looks сверяет набор с темами и витриной в обе стороны.

export const EMOJIS = [
  '🎄', '🎅', '⛄', '❄️', '⭐', '✨', '🎁', '🎀', '🔔', '🍪', '🍊', '☕', '🧣', '🧤', '🍭', '🦌', '🛷', '🕯️',
  '🐻', '🐼', '🐨', '🦊', '🐰', '🐱', '🐶', '🐧', '🦉', '🐿️', '🦔', '🐺', '🐯', '🦄',
  '🌈', '🍀', '🔥', '💎', '🚀', '🎸', '📚', '🎮',
];

export const POSTCARDS = [
  { id: 'snow', title: 'Снегопад' },
  { id: 'firs', title: 'Ёлочки' },
  { id: 'gingerbread', title: 'Имбирное печенье' },
  { id: 'night', title: 'Звёздная ночь' },
  { id: 'tartan', title: 'Тёплый плед' },
  { id: 'candy', title: 'Леденец' },
  { id: 'aurora', title: 'Северное сияние' },
  { id: 'fireplace', title: 'У камина' },
  { id: 'snowman', title: 'Снеговик' },
  { id: 'tangerine', title: 'Мандарины' },
  { id: 'cocoa', title: 'Какао с зефиром' },
  { id: 'gift', title: 'Подарок с лентой' },
  { id: 'sparkle', title: 'Золотые блёстки' },
  { id: 'nordic', title: 'Скандинавский узор' },
  { id: 'airmail', title: 'Авиапочта' },
];

// Значение из набора или '' («без»); иначе null
export const validEmoji = (x) => (x === '' || EMOJIS.includes(x) ? x : null);
export const validCard = (x) => (x === '' || POSTCARDS.some((c) => c.id === x) ? x : null);

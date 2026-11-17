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

// Маска Санты в переписке (040, specs/040-santa-mask/contracts/mask.md): у пары в событии, видна только её Санте и
// подопечному. Ни эмодзи, ни смыслом не совпадает со значками EMOJIS — иначе маска выдала бы Санту по списку участников
// (тест mask)
export const MASKS = [
  { id: 'elf', emoji: '🧝', title: 'Эльф' },
  { id: 'wizard', emoji: '🧙', title: 'Волшебник' },
  { id: 'fairy', emoji: '🧚', title: 'Фея' },
  { id: 'genie', emoji: '🧞', title: 'Джинн' },
  { id: 'dragon', emoji: '🐉', title: 'Дракон' },
  { id: 'ghost', emoji: '👻', title: 'Привидение' },
  { id: 'matryoshka', emoji: '🪆', title: 'Матрёшка' },
  { id: 'agent', emoji: '🕵️', title: 'Тайный агент' },
  { id: 'ninja', emoji: '🥷', title: 'Ниндзя' },
  { id: 'stranger', emoji: '🎭', title: 'Незнакомец' },
  { id: 'superhero', emoji: '🦸', title: 'Супергерой' },
  { id: 'robot', emoji: '🤖', title: 'Робот' },
  { id: 'alien', emoji: '👽', title: 'Пришелец' },
  { id: 'dinosaur', emoji: '🦖', title: 'Динозавр' },
  { id: 'lion', emoji: '🦁', title: 'Лев' },
  { id: 'frog', emoji: '🐸', title: 'Лягушка' },
  { id: 'turtle', emoji: '🐢', title: 'Черепаха' },
  { id: 'octopus', emoji: '🐙', title: 'Осьминог' },
  { id: 'whale', emoji: '🐳', title: 'Кит' },
  { id: 'seal', emoji: '🦭', title: 'Тюлень' },
];

// Значение из набора или '' («без»); иначе null
export const validEmoji = (x) => (x === '' || EMOJIS.includes(x) ? x : null);
export const validCard = (x) => (x === '' || POSTCARDS.some((c) => c.id === x) ? x : null);
export const validMask = (x) => (x === '' || MASKS.some((m) => m.id === x) ? x : null);

// «🐉 Дракон»; '' — без маски или маски больше нет в наборе
export const maskLabel = (id) => {
  const m = MASKS.find((x) => x.id === id);
  return m ? `${m.emoji} ${m.title}` : '';
};

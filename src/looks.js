// Открытка письма (038, specs/038-emoji-postcards/contracts/looks.md): один набор на сервере —
// приложение получает его в ответе `me`. Вид открытки (узор, бумага, цвет текста, наклейка) — тема `ds-postcard--<id>`
// в дизайн-системе; тест looks сверяет набор с темами и витриной в обе стороны.
// 060: названия — в словаре (looks.card.<id>, looks.mask.<id>), набор хранит только id и эмодзи.

import { tx } from './i18n/index.js';

export const POSTCARDS = [
  { id: 'snow' },
  { id: 'firs' },
  { id: 'gingerbread' },
  { id: 'night' },
  { id: 'tartan' },
  { id: 'candy' },
  { id: 'aurora' },
  { id: 'fireplace' },
  { id: 'snowman' },
  { id: 'tangerine' },
  { id: 'cocoa' },
  { id: 'gift' },
  { id: 'sparkle' },
  { id: 'nordic' },
  { id: 'airmail' },
];

// Маска Санты в переписке (040, specs/040-santa-mask/contracts/mask.md): у пары в событии, видна только её Санте и
// подопечному.
export const MASKS = [
  { id: 'elf', emoji: '🧝' },
  { id: 'wizard', emoji: '🧙' },
  { id: 'fairy', emoji: '🧚' },
  { id: 'genie', emoji: '🧞' },
  { id: 'dragon', emoji: '🐉' },
  { id: 'ghost', emoji: '👻' },
  { id: 'matryoshka', emoji: '🪆' },
  { id: 'agent', emoji: '🕵️' },
  { id: 'ninja', emoji: '🥷' },
  { id: 'stranger', emoji: '🎭' },
  { id: 'superhero', emoji: '🦸' },
  { id: 'robot', emoji: '🤖' },
  { id: 'alien', emoji: '👽' },
  { id: 'dinosaur', emoji: '🦖' },
  { id: 'lion', emoji: '🦁' },
  { id: 'frog', emoji: '🐸' },
  { id: 'turtle', emoji: '🐢' },
  { id: 'octopus', emoji: '🐙' },
  { id: 'whale', emoji: '🐳' },
  { id: 'seal', emoji: '🦭' },
];

// Наборы для ответа me (038, 040): названия — отложенные тексты, ответ собирается на языке вызывающего
export const looksView = () => ({
  postcards: POSTCARDS.map((c) => ({ ...c, title: tx('looks.card.' + c.id) })),
  masks: MASKS.map((m) => ({ ...m, title: tx('looks.mask.' + m.id) })),
});

// Значение из набора или '' («без»); иначе null
export const validCard = (x) => (x === '' || POSTCARDS.some((c) => c.id === x) ? x : null);
export const validMask = (x) => (x === '' || MASKS.some((m) => m.id === x) ? x : null);

// «🐉 Дракон» — отложенный текст (060: только значение подстановки); '' — без маски или маски больше нет в наборе
export const maskLabel = (id) => {
  const m = MASKS.find((x) => x.id === id);
  return m ? tx('looks.maskLabel', { emoji: m.emoji, title: tx('looks.mask.' + m.id) }) : '';
};

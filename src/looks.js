// Открытка письма (038, specs/038-emoji-postcards/contracts/looks.md): один набор на сервере —
// приложение получает его в ответе `me`. Вид открытки (узор, бумага, цвет текста, наклейка) — тема `ds-postcard--<id>`
// в дизайн-системе; тест looks сверяет набор с темами и витриной в обе стороны.
// 060: названия — в словаре (looks.card.<id>), набор хранит только id.

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

// Набор для ответа me (038): названия — отложенные тексты, ответ собирается на языке вызывающего
export const looksView = () => ({
  postcards: POSTCARDS.map((c) => ({ ...c, title: tx('looks.card.' + c.id) })),
});

// Значение из набора или '' («без»); иначе null
export const validCard = (x) => (x === '' || POSTCARDS.some((c) => c.id === x) ? x : null);

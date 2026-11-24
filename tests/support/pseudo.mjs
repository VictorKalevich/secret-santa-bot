// Псевдоязык (060, US3, research R10): каждая строка русского словаря — транслитом в ⟪…⟫. Человек с этим языком не
// должен увидеть ни одной буквы кириллицы (текст из кода, а не из словаря, или текст на чужом языке), а остальные —
// ни одной скобки ⟪ (текст его языка ушёл другому). Подстановки {имя}, HTML-теги, эмодзи и строки без кириллицы
// (формат даты, локаль) — как есть; списки и наборы форм — по элементам.
import { DICTIONARIES, LANGUAGES, DEFAULT_LANG } from '../../src/i18n/index.js';

export const PSEUDO = 'xx';
export const CYRILLIC = /[А-Яа-яЁё]/;

const LETTERS = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: "'", э: 'e', ю: 'yu', я: 'ya',
};

// Транслит с регистром: «ОТКРЫТЬ» → «OTKRYT'» (слово подтверждения сравнивается в верхнем регистре)
export function translit(s) {
  return s.replace(/[А-Яа-яЁё]/g, (c) => {
    const low = c.toLowerCase();
    return c === low ? LETTERS[low] : LETTERS[low].toUpperCase();
  });
}

export function pseudo(value) {
  if (Array.isArray(value)) return value.map(pseudo);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pseudo(v)]));
  return typeof value === 'string' && CYRILLIC.test(value) ? '⟪' + translit(value) + '⟫' : value;
}

// Добавить язык xx (формы числа — русские); вернуть функцию, которая его убирает
export function pseudoLanguage() {
  const ru = DICTIONARIES[DEFAULT_LANG];
  DICTIONARIES[PSEUDO] = { server: pseudo(ru.server), app: pseudo(ru.app), plural: DEFAULT_LANG };
  if (!LANGUAGES.includes(PSEUDO)) LANGUAGES.push(PSEUDO);
  return () => {
    delete DICTIONARIES[PSEUDO];
    if (LANGUAGES.includes(PSEUDO)) LANGUAGES.splice(LANGUAGES.indexOf(PSEUDO), 1);
  };
}

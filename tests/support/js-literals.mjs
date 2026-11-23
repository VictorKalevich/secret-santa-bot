// Разбор исходника JS для статических проверок (020, перенесено из tests/claims.test.mjs в 050 — нужен и тесту
// companies): строковые литералы без комментариев и регулярных выражений.

// Строковые литералы исходника JS: в кавычках и шаблоны (выражение ${…} — «?», литералы внутри него — отдельно).
// Комментарии и регулярные выражения пропускаются.
const REGEX_AFTER_WORD = /(?:^|[^\w$])(return|typeof|case|in|of|void|delete|throw|new|else|yield|await)$/;
export function stringLiterals(src) {
  const out = [];
  let i = 0;
  let prev = ''; // последний значимый символ кода: отличает регулярное выражение от деления
  const escaped = (s) => {
    i += 2;
    return s + src[i - 1];
  };
  const quoted = (q) => {
    let s = '';
    for (i++; i < src.length && src[i] !== q;) s = src[i] === '\\' ? escaped(s) : s + src[i++];
    i++;
    return s;
  };
  const template = () => {
    let s = '';
    for (i++; i < src.length && src[i] !== '`';) {
      if (src[i] === '\\') s = escaped(s);
      else if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        code('}');
        i++;
        s += '?';
      } else s += src[i++];
    }
    i++;
    return s;
  };
  const regexHere = () => {
    if (!prev || '(,=:[!&|?{};+-*%<>~^'.includes(prev)) return true;
    return /[\w$]/.test(prev) && REGEX_AFTER_WORD.test(src.slice(Math.max(0, i - 12), i).trimEnd());
  };
  const skipRegex = () => {
    let cls = false;
    for (i++; i < src.length && (cls || src[i] !== '/'); i++) {
      if (src[i] === '\\') i++;
      else if (src[i] === '[') cls = true;
      else if (src[i] === ']') cls = false;
    }
    for (i++; /[a-z]/.test(src[i] || ''); i++);
  };
  // Код до непарного end (или до конца файла)
  function code(end) {
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === end && depth === 0) return;
      if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (c === '/' && src[i + 1] === '*') {
        i = src.indexOf('*/', i + 2) + 2;
      } else if (c === "'" || c === '"' || c === '`') {
        out.push(c === '`' ? template() : quoted(c));
        prev = 'x';
      } else if (c === '/' && regexHere()) {
        skipRegex();
        prev = 'x';
      } else {
        if (c === '{') depth++;
        if (c === '}') depth--;
        if (!/\s/.test(c)) prev = c;
        i++;
      }
    }
  }
  code(null);
  return out;
}

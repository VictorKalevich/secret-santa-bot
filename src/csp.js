// Политика безопасности страницы мини-приложения (032): скрипты — только встроенный (по отпечатку) и файл Telegram,
// стили — встроенные (скрипт Telegram в веб-клиенте сам создаёт блок темы), запросы и прочее — свой адрес, встраивать
// страницу — только сайтам Telegram. Контракт — specs/032-app-csp/contracts/app-csp.md.

export const TELEGRAM_SCRIPT = 'https://telegram.org/js/telegram-web-app.js';

// Тексты встроенных скриптов (<script> без атрибутов) так, как их видит браузер: разбор HTML превращает CRLF и CR в LF
export function inlineScripts(page) {
  return [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].replace(/\r\n?/g, '\n'));
}

async function sha256(text) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...digest));
}

export async function appPolicy(page) {
  const hashes = await Promise.all(inlineScripts(page).map(async (s) => `'sha256-${await sha256(s)}'`));
  return [
    "default-src 'self'",
    `script-src ${hashes.join(' ')} ${TELEGRAM_SCRIPT}`,
    "style-src 'unsafe-inline'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'frame-ancestors https://*.telegram.org',
  ].join('; ');
}

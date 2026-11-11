// Тонкая обёртка над Telegram Bot API.

export function tgApi(env) {
  const base = (env.TG_API || 'https://api.telegram.org') + '/bot' + env.BOT_TOKEN + '/';
  return async function call(method, params = {}) {
    try {
      const res = await fetch(base + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json().catch(() => ({ ok: false, description: 'bad json' }));
      if (!data.ok) console.log('Telegram API error', method, data.error_code, data.description);
      return data;
    } catch (e) {
      console.log('Telegram API fetch failed', method, String(e));
      return { ok: false, description: String(e) };
    }
  };
}

const enc = new TextEncoder();

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Производные секреты, чтобы владельцу не нужно было придумывать лишние пароли.
export async function derivedSecret(env, label, length = 32) {
  return hex(await hmac(enc.encode(env.BOT_TOKEN), 'santa-bot:' + label)).slice(0, length);
}

// Проверка подписи данных мини-приложения Telegram (initData).
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export async function validateInitData(initData, botToken, maxAgeSec = 24 * 3600) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await hmac(enc.encode('WebAppData'), botToken);
  const calc = hex(await hmac(secretKey, dataCheckString));
  if (calc.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') || 'null');
    if (!user || !user.id) return null;
    return user;
  } catch {
    return null;
  }
}

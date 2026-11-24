// Правила поддельного Telegram Bot API (016): одна чистая функция для HTTP-имитации e2e (tests/mock-telegram.mjs)
// и для «мира» быстрых тестов (tests/support/world.mjs) — оба отвечают боту одинаково.

export const BLOCKED_CHAT = 555000555; // этот «пользователь» заблокировал бота → 403

// Длина текста так, как её считает Telegram: после разбора HTML-разметки (теги не в счёт, сущности — 1 символ).
export function visibleLength(params) {
  let t = String(params.text || '');
  if (params.parse_mode === 'HTML') {
    t = t.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot);/g, '_');
  }
  return t.length;
}

// Telegram отвергает строки с одиночной половинкой суррогатной пары (разорванный эмодзи) — в тексте и в кнопках (009)
export function brokenUtf16(params) {
  const buttons = (params.reply_markup?.inline_keyboard || []).flat().map((b) => b.text || '');
  return [params.text || '', ...buttons].some((s) => !String(s).isWellFormed());
}

const failure = (code, description) => ({ status: code, body: { ok: false, error_code: code, description } });

// Ответ Telegram на вызов бота: { status, body }. nextMessageId() вызывается только для сообщения, которое Telegram
// принял, — номера идут подряд, как у настоящего чата.
// Пределы профиля бота (061): описание команды 1…256, команда — латиница, цифры и «_» до 32, описание ≤ 512, краткое ≤ 120
export const PROFILE_LIMITS = { command: 256, description: 512, short: 120 };
function profileRefusal(method, params) {
  if (method === 'setMyCommands') {
    for (const c of params.commands || []) {
      if (!/^[a-z0-9_]{1,32}$/.test(c.command)) return failure(400, 'Bad Request: BOT_COMMAND_INVALID');
      if (!c.description || c.description.length > PROFILE_LIMITS.command) return failure(400, 'Bad Request: BOT_COMMAND_DESCRIPTION_INVALID');
    }
  }
  if (method === 'setMyDescription' && String(params.description ?? '').length > PROFILE_LIMITS.description) {
    return failure(400, 'Bad Request: description is too long');
  }
  if (method === 'setMyShortDescription' && String(params.short_description ?? '').length > PROFILE_LIMITS.short) {
    return failure(400, 'Bad Request: short description is too long');
  }
  return null;
}

export function telegramReply(method, params, nextMessageId) {
  const refused = profileRefusal(method, params);
  if (refused) return refused;
  let result = true;
  if (method === 'getMe') result = { id: 1, is_bot: true, first_name: 'Santa', username: 'test_santa_bot' };
  if (method === 'sendMessage') {
    if (params.chat_id === BLOCKED_CHAT) return failure(403, 'Forbidden: bot was blocked by the user');
    if (visibleLength(params) > 4096) return failure(400, 'Bad Request: message is too long');
    if (brokenUtf16(params)) return failure(400, 'Bad Request: strings must be encoded in UTF-8');
    result = { message_id: nextMessageId(), chat: { id: params.chat_id }, text: params.text };
  }
  return { status: 200, body: { ok: true, result } };
}

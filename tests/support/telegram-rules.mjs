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
export function telegramReply(method, params, nextMessageId) {
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

// Имитация Telegram Bot API для локальных тестов: записывает все вызовы бота.
import http from 'node:http';

export const BLOCKED_CHAT = 555000555; // этот «пользователь» заблокировал бота → 403

// Длина текста так, как её считает Telegram: после разбора HTML-разметки (теги не в счёт, сущности — 1 символ).
function visibleLength(params) {
  let t = String(params.text || '');
  if (params.parse_mode === 'HTML') {
    t = t.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot);/g, '_');
  }
  return t.length;
}

// Telegram отвергает строки с одиночной половинкой суррогатной пары (разорванный эмодзи) — в тексте и в кнопках (009)
function brokenUtf16(params) {
  const buttons = (params.reply_markup?.inline_keyboard || []).flat().map((b) => b.text || '');
  return [params.text || '', ...buttons].some((s) => !String(s).isWellFormed());
}

// port = 0 — свободный порт выбирает система (без случайных совпадений с занятыми портами)
export function startMockTelegram(port = 0) {
  const calls = [];
  let messageId = 1;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url || '');
      const method = m ? m[2] : 'unknown';
      let params = {};
      try { params = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
      calls.push({ method, params, token: m && m[1], at: Date.now() });
      let result = true;
      let reply = null;
      if (method === 'getMe') result = { id: 1, is_bot: true, first_name: 'Santa', username: 'test_santa_bot' };
      if (method === 'sendMessage') {
        if (params.chat_id === BLOCKED_CHAT) reply = { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' };
        else if (visibleLength(params) > 4096) reply = { ok: false, error_code: 400, description: 'Bad Request: message is too long' };
        else if (brokenUtf16(params)) reply = { ok: false, error_code: 400, description: 'Bad Request: strings must be encoded in UTF-8' };
        else result = { message_id: messageId++, chat: { id: params.chat_id }, text: params.text };
      }
      // connection: close (015) — без переиспользования соединений: Node закрывает простаивающее keep-alive соединение
      // через 5 с, и локальный workerd изредка отправлял запрос в уже закрытое («Network connection lost»)
      res.writeHead(reply ? reply.error_code : 200, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(reply || { ok: true, result }));
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({
      port: server.address().port,
      calls,
      messagesTo: (chatId) => calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === chatId),
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
    }));
  });
}
